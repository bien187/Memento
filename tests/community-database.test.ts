import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { demoRecords } from "./fixtures/notebook";
import { baseRecord } from "@/lib/domain/models";

const sql = new PGlite();
type JsonRecord = Record<string, unknown>;
type PublicEntry = {
  id: string;
  date: string;
  created_at: string;
  content: string;
  media_ids: string[];
  start_date: string | null;
};
async function as<T>(user: string | null, action: () => Promise<T>) {
  await sql.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  await sql.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return await action();
  } finally {
    await sql.exec("reset role");
  }
}
async function rpc<T>(
  user: string | null,
  name: string,
  values: unknown[] = [],
) {
  return as(
    user,
    async () =>
      (
        await sql.query<{ result: T }>(
          `select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as result`,
          values,
        )
      ).rows[0].result,
  );
}
async function save(user: string, table: string, payload: object, version = 0) {
  return rpc<{ record: JsonRecord }>(user, "sync_entity", [
    table,
    JSON.stringify(payload),
    version,
    crypto.randomUUID(),
  ]);
}
async function person(options: JsonRecord = {}) {
  const id = crypto.randomUUID(),
    fixture = demoRecords(id);
  const profile = {
    ...fixture.profile,
    username: `user_${id.slice(0, 8)}`,
    discoverable: true,
    ...options,
  };
  await sql.query("insert into auth.users values($1)", [id]);
  await save(id, "profiles", profile);
  await save(id, "service_periods", fixture.period);
  return { id, fixture, profile };
}

beforeAll(async () => {
  await sql.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant all on storage.objects to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await sql.exec(
      readFileSync(`supabase/migrations/${file}`, "utf8").replace(
        "create extension if not exists pgcrypto with schema extensions;",
        "",
      ),
    );
  await sql.exec(readFileSync("supabase/seed.sql", "utf8"));
});
afterAll(() => sql.close());

describe("Community profile projections and authorization", () => {
  it("defaults to private extra fields and counts only visible entries without exposing ratings", async () => {
    const alice = await person(),
      bob = await person();
    for (const [i, visibility] of [
      "public",
      "private",
      "followers",
      "link",
    ].entries())
      await save(alice.id, "diary_entries", {
        ...alice.fixture.entries[i],
        visibility,
        milestone: true,
        mood: 99,
        condition: 1,
      });
    const profile = await rpc<JsonRecord>(bob.id, "community_profile", [
      alice.id,
    ]);
    expect(profile).toMatchObject({
      id: alice.id,
      function_id: null,
      followers: null,
      following_count: null,
      entry_count: 1,
      milestone_count: 1,
      periods: [],
    });
    for (const field of ["mood", "condition", "unit", "barracks_id", "email"])
      expect(profile).not.toHaveProperty(field);
    const feed = await rpc<JsonRecord[]>(bob.id, "community_feed", [alice.id]);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ start_date: null, period_type: null });
    for (const field of [
      "mood",
      "condition",
      "unit",
      "barracks_id",
      "function_id",
      "period_id",
    ])
      expect(feed[0]).not.toHaveProperty(field);
    const people = await rpc<JsonRecord[]>(bob.id, "community_people", [
      alice.profile.username,
      "infanterie",
    ]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: alice.id,
      function_id: null,
      followers: null,
    });
    expect(
      await rpc(bob.id, "community_people", [
        alice.profile.username,
        "luftwaffe",
      ]),
    ).toEqual([]);
    await as(bob.id, async () => {
      expect(
        (
          await sql.query("select id from public.profiles where id=$1", [
            alice.id,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await sql.query(
            "select id from public.diary_entries where owner_id=$1",
            [alice.id],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        sql.query(
          "update public.profiles set share_connections=true where id=$1",
          [alice.id],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("releases only explicitly selected service and connection information and preserves flags for older clients", async () => {
    const alice = await person({ private_profile: false }),
      bob = await person();
    await save(alice.id, "diary_entries", {
      ...alice.fixture.entries[0],
      visibility: "public",
    });
    await rpc(bob.id, "community_action", [alice.id, "follow"]);
    await save(
      alice.id,
      "profiles",
      {
        ...alice.profile,
        share_function: true,
        share_service_period: true,
        share_connections: true,
      },
      1,
    );
    const profile = await rpc<JsonRecord>(bob.id, "community_profile", [
      alice.id,
    ]);
    expect(profile).toMatchObject({
      function_id: "infanterist",
      followers: 1,
      following_count: 0,
      periods: [
        {
          id: alice.fixture.period.id,
          type: "RS",
          start_date: "2026-01-12",
          end_date: "2026-05-15",
        },
      ],
    });
    expect(JSON.stringify(profile)).not.toContain("unit");
    expect(JSON.stringify(profile)).not.toContain("barracks");
    expect(
      (await rpc<PublicEntry[]>(bob.id, "community_feed", [alice.id]))[0]
        .start_date,
    ).toBe("2026-01-12");
    expect(
      await rpc<JsonRecord[]>(bob.id, "community_connections", [
        "followers",
        alice.id,
      ]),
    ).toHaveLength(1);
    // Missing flags from an older offline client must not reset an explicit choice.
    await save(alice.id, "profiles", alice.profile, 2);
    expect(
      await rpc<JsonRecord>(bob.id, "community_profile", [alice.id]),
    ).toMatchObject({
      share_function: true,
      share_service_period: true,
      share_connections: true,
    });
    await save(
      alice.id,
      "profiles",
      {
        ...alice.profile,
        share_function: false,
        share_service_period: false,
        share_connections: false,
      },
      3,
    );
    expect(
      await rpc<JsonRecord>(bob.id, "community_profile", [alice.id]),
    ).toMatchObject({ function_id: null, periods: [], followers: null });
    expect(
      await rpc(bob.id, "community_connections", ["followers", alice.id]),
    ).toEqual([]);
  });

  it("makes follows and approvals idempotent while keeping private entries private and blocks immediate", async () => {
    const alice = await person(),
      bob = await person();
    await save(alice.id, "diary_entries", {
      ...alice.fixture.entries[0],
      visibility: "followers",
    });
    await save(alice.id, "diary_entries", {
      ...alice.fixture.entries[1],
      visibility: "private",
    });
    await rpc(bob.id, "community_action", [alice.id, "follow"]);
    await rpc(bob.id, "community_action", [alice.id, "follow"]);
    expect(
      await rpc<JsonRecord[]>(alice.id, "community_requests"),
    ).toHaveLength(1);
    expect(await rpc(bob.id, "community_feed", [alice.id])).toEqual([]);
    await rpc(alice.id, "community_action", [bob.id, "accept"]);
    await rpc(alice.id, "community_action", [bob.id, "accept"]);
    await rpc(bob.id, "community_action", [alice.id, "follow"]);
    expect(await rpc(alice.id, "community_requests")).toEqual([]);
    expect(
      await rpc<JsonRecord[]>(bob.id, "community_feed", [alice.id]),
    ).toHaveLength(1);
    expect(
      await rpc(bob.id, "community_entry", [alice.fixture.entries[1].id]),
    ).toBeNull();
    await rpc(alice.id, "community_action", [bob.id, "block"]);
    expect(await rpc(bob.id, "community_profile", [alice.id])).toBeNull();
    expect(await rpc(alice.id, "community_profile", [bob.id])).toBeNull();
    expect(await rpc(bob.id, "community_feed", [alice.id])).toEqual([]);
    expect(await rpc(bob.id, "community_connections", ["following"])).toEqual(
      [],
    );
    expect(
      await rpc(bob.id, "community_connections", ["blocked", alice.id]),
    ).toEqual([]);
    await expect(
      rpc(bob.id, "community_action", [alice.id, "follow"]),
    ).rejects.toThrow(/Unavailable/);
    await rpc(alice.id, "community_action", [bob.id, "unblock"]);
    await rpc(bob.id, "community_action", [alice.id, "follow"]);
    await rpc(alice.id, "community_action", [bob.id, "reject"]);
    expect(await rpc(alice.id, "community_requests")).toEqual([]);
    expect(
      await rpc<JsonRecord>(bob.id, "community_profile", [alice.id]),
    ).toMatchObject({ following: false, requested: false });
  });

  it("uses a stable three-part cursor and loads the complete entry separately", async () => {
    const alice = await person(),
      bob = await person();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await sql.query(
        `insert into public.diary_entries(id,owner_id,period_id,date,content,visibility,created_at)
        values($1,$2,$3,'2026-01-12',$4,'public','2026-01-12T08:00:00Z')`,
        [id, alice.id, alice.fixture.period.id, "A".repeat(1200)],
      );
    }
    const seen: string[] = [];
    let cursor: unknown[] = [null, null, null];
    for (let page = 0; page < 7; page++) {
      const entries = await rpc<PublicEntry[]>(bob.id, "community_feed", [
        alice.id,
        4,
        ...cursor,
      ]);
      seen.push(...entries.map((entry) => entry.id));
      for (const entry of entries) expect(entry.content).toHaveLength(600);
      const last = entries.at(-1);
      if (!last) break;
      cursor = [last.date, last.created_at, last.id];
    }
    expect(seen).toEqual([...ids].sort().reverse());
    expect(new Set(seen).size).toBe(25);
    const olderMilestone = [...ids].sort()[0];
    await sql.query(
      "update public.diary_entries set milestone=true where id=$1",
      [olderMilestone],
    );
    const milestones = await rpc<PublicEntry[]>(bob.id, "community_feed", [
      alice.id,
      4,
      null,
      null,
      null,
      true,
    ]);
    expect(milestones.map((entry) => entry.id)).toEqual([olderMilestone]);
    expect(
      (await rpc<PublicEntry>(bob.id, "community_entry", [ids[0]])).content,
    ).toHaveLength(1200);
    await expect(
      rpc(bob.id, "community_feed", [alice.id, 20, "2026-01-12"]),
    ).rejects.toThrow(/Incomplete pagination cursor/);
  });

  it("authorizes exact media references, rejects forged avatars and revokes images with content access", async () => {
    const alice = await person(),
      bob = await person();
    const photo = crypto.randomUUID(),
      avatar = crypto.randomUUID();
    const entry = {
      ...alice.fixture.entries[0],
      visibility: "public",
      media_ids: [photo],
      cover_id: photo,
    };
    await save(alice.id, "diary_entries", entry);
    for (const [id, entryId] of [
      [photo, entry.id],
      [avatar, null],
    ] as const)
      await save(alice.id, "entry_media", {
        ...baseRecord(alice.id, id),
        entry_id: entryId,
        name: "photo.jpeg",
        mime: "image/jpeg",
        size: 200,
        storage_path: `${alice.id}/${id}.jpeg`,
      });
    await save(
      alice.id,
      "profiles",
      { ...alice.profile, avatar_id: avatar },
      1,
    );
    expect(
      await rpc<JsonRecord>(bob.id, "community_media", [photo]),
    ).toMatchObject({ id: photo, owner_id: alice.id });
    expect(
      await rpc<JsonRecord>(bob.id, "community_avatar", [alice.id]),
    ).toMatchObject({ id: avatar });
    expect(await rpc(bob.id, "community_media", [avatar])).toBeNull();
    await save(bob.id, "profiles", { ...bob.profile, avatar_id: photo }, 1);
    expect(await rpc(alice.id, "community_avatar", [bob.id])).toBeNull();
    expect(
      await rpc<JsonRecord>(alice.id, "community_profile", [bob.id]),
    ).toMatchObject({ avatar_id: null });
    await save(
      alice.id,
      "diary_entries",
      { ...entry, visibility: "private" },
      1,
    );
    expect(await rpc(bob.id, "community_media", [photo])).toBeNull();
    await rpc(bob.id, "community_action", [alice.id, "block"]);
    expect(await rpc(bob.id, "community_avatar", [alice.id])).toBeNull();
    expect(await rpc(alice.id, "community_avatar", [bob.id])).toBeNull();
  });

  it("denies hidden/deleted profiles, deleted periods, anonymous calls and direct internal predicates", async () => {
    const hidden = await person({ discoverable: false }),
      bob = await person();
    expect(await rpc(bob.id, "community_profile", [hidden.id])).toBeNull();
    expect(
      await rpc(bob.id, "community_people", [hidden.profile.username]),
    ).toEqual([]);
    await expect(rpc(null, "community_profile", [bob.id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      rpc(bob.id, "community_can_view_profile", [bob.id, hidden.id]),
    ).rejects.toThrow(/permission denied/);
    const alice = await person();
    await save(alice.id, "diary_entries", {
      ...alice.fixture.entries[0],
      visibility: "public",
    });
    await save(
      alice.id,
      "service_periods",
      { ...alice.fixture.period, deleted_at: new Date().toISOString() },
      1,
    );
    expect(
      await rpc(bob.id, "community_entry", [alice.fixture.entries[0].id]),
    ).toBeNull();
    await save(
      alice.id,
      "profiles",
      { ...alice.profile, deleted_at: new Date().toISOString() },
      1,
    );
    expect(await rpc(bob.id, "community_profile", [alice.id])).toBeNull();
  });
});
