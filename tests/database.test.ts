import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { demoRecords } from "./fixtures/notebook";
import type { Entity } from "@/lib/domain/models";

const sql = new PGlite();
const alice = crypto.randomUUID(),
  bob = crypto.randomUUID();
const a = demoRecords(alice),
  b = demoRecords(bob);
async function as<T>(
  user: string | null,
  action: () => Promise<T>,
): Promise<T> {
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
async function save(
  table: string,
  value: Entity,
  version = 0,
  operation = crypto.randomUUID(),
) {
  const result = await sql.query<{
    result: { record: Record<string, unknown>; conflict?: boolean };
  }>("select public.sync_entity($1,$2::jsonb,$3,$4::uuid) as result", [
    table,
    JSON.stringify(value),
    version,
    operation,
  ]);
  return result.rows[0].result;
}
beforeAll(async () => {
  // Real PostgreSQL engine, with only Supabase-owned auth/storage scaffolding stubbed.
  await sql.exec(`create role anon; create role authenticated; create role service_role bypassrls;
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
    .sort()) {
    const migration = readFileSync(
      `supabase/migrations/${file}`,
      "utf8",
    ).replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    );
    await sql.exec(migration);
  }
  await sql.exec(readFileSync("supabase/seed.sql", "utf8"));
  await sql.query("insert into auth.users values($1),($2)", [alice, bob]);
  for (const [user, fixture] of [
    [alice, a],
    [bob, b],
  ] as const)
    await as(user, async () => {
      await save("profiles", {
        ...fixture.profile,
        username: `user_${user.slice(0, 8)}`,
        discoverable: true,
      });
      await save("service_periods", fixture.period);
      await save("diary_entries", {
        ...fixture.entries[0],
        visibility: "private",
      });
    });
});
afterAll(() => sql.close());
describe("PostgreSQL authorization and sync transactions", () => {
  it("isolates private rows and denies anonymous access", async () => {
    await as(bob, async () => {
      const { rows } = await sql.query("select id from public.diary_entries");
      expect(rows).toEqual([{ id: b.entries[0].id }]);
      expect((await sql.query("select id from public.profiles")).rows).toEqual([
        { id: bob },
      ]);
    });
    await expect(
      as(null, () => sql.query("select * from public.diary_entries")),
    ).rejects.toThrow(/permission denied/);
    await as(null, async () =>
      expect(
        (await sql.query("select * from public.military_ranks")).rows.length,
      ).toBeGreaterThan(20),
    );
  });
  it("syncs private barracks, preserves older payloads and protects the new catalogs", async () => {
    const owner = crypto.randomUUID();
    const fixture = demoRecords(owner);
    await sql.query("insert into auth.users values($1)", [owner]);
    await as(owner, async () => {
      const profile = {
        ...fixture.profile,
        username: null,
        function_id: "artillerist",
        barracks_id: "biere",
        discoverable: true,
      };
      const first = await save("profiles", profile);
      expect(first.record.barracks_id).toBe("biere");
      const period = await save("service_periods", {
        ...fixture.period,
        function_id: "truppenkoch",
        barracks_id: "thun",
      });
      expect(period.record.barracks_id).toBe("thun");
      const { barracks_id: _, ...oldPayload } = profile;
      expect((await save("profiles", oldPayload, 1)).record.barracks_id).toBe(
        "biere",
      );
      expect(
        (await save("profiles", { ...profile, barracks_id: null }, 2)).record
          .barracks_id,
      ).toBeNull();
      await expect(
        save("profiles", { ...profile, barracks_id: "made-up-location" }, 3),
      ).rejects.toThrow(/foreign key/);
    });
    await as(bob, async () => {
      expect(
        (
          await sql.query(
            "select id from public.service_periods where owner_id=$1",
            [owner],
          )
        ).rows,
      ).toHaveLength(0);
      const result = await sql.query<{ people: Record<string, unknown>[] }>(
        "select public.community_people('Lukas') as people",
      );
      const person = result.rows[0].people.find(
        (person) => person.id === owner,
      );
      expect(person).toBeDefined();
      expect(person).not.toHaveProperty("barracks_id");
      expect(person).not.toHaveProperty("unit");
    });
    await as(null, async () => {
      expect(
        (await sql.query("select id from public.military_functions")).rows,
      ).toHaveLength(125);
      expect(
        (await sql.query("select id from public.military_barracks")).rows,
      ).toHaveLength(29);
      expect(
        (await sql.query("select * from public.military_function_barracks"))
          .rows.length,
      ).toBeGreaterThan(50);
      await expect(
        sql.query(
          "insert into public.military_barracks values('x','x','BE','x','x')",
        ),
      ).rejects.toThrow(/permission denied/);
    });
    // Catalog regeneration is idempotent and never overwrites personal selections.
    await sql.exec(readFileSync("supabase/seed.sql", "utf8"));
    expect(
      (
        await sql.query<{ barracks_id: string }>(
          "select barracks_id from public.service_periods where id=$1",
          [fixture.period.id],
        )
      ).rows[0].barracks_id,
    ).toBe("thun");
  });
  it("prevents direct writes and client-supplied owner spoofing", async () => {
    await expect(
      as(bob, () =>
        sql.query(
          "update public.diary_entries set content='stolen' where owner_id=$1",
          [alice],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(bob, () => save("diary_entries", a.entries[0])),
    ).rejects.toThrow(/Owner mismatch/);
    await expect(
      as(bob, () =>
        save("diary_entries", { ...b.entries[1], period_id: a.period.id }),
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      as(null, () => sql.query("select public.community_people('')")),
    ).rejects.toThrow(/permission denied/);
  });
  it("uses atomic expected versions and idempotent operation receipts", async () => {
    const operation = crypto.randomUUID();
    const entry = { ...a.entries[1], content: "first" };
    await as(alice, async () => {
      const first = await save("diary_entries", entry, 0, operation);
      expect(first.record.version).toBe(1);
      const repeated = await save("diary_entries", entry, 0, operation);
      expect(repeated).toEqual(first);
      const conflict = await save(
        "diary_entries",
        { ...entry, content: "outdated" },
        0,
      );
      expect(conflict.conflict).toBe(true);
      expect(conflict.record.content).toBe("first");
      const second = await save(
        "diary_entries",
        { ...entry, content: "second" },
        1,
      );
      expect(second.record.version).toBe(2);
    });
  });
  it("limits images to four and validates date ranges and independent scores", async () => {
    await as(alice, async () => {
      const entry = {
        ...a.entries[2],
        media_ids: Array.from({ length: 4 }, () => crypto.randomUUID()),
        mood: null,
        condition: 0,
      };
      await save("diary_entries", entry);
      await expect(
        save(
          "diary_entries",
          { ...entry, media_ids: [...entry.media_ids, crypto.randomUUID()] },
          1,
        ),
      ).rejects.toThrow(/check constraint/);
      await expect(
        save("diary_entries", { ...a.entries[3], date: "2027-01-01" }),
      ).rejects.toThrow(/Date outside/);
      await expect(
        save("diary_entries", { ...a.entries[3], mood: 101 }),
      ).rejects.toThrow(/check constraint/);
    });
  });
  it("requires approved follows, exposes no scores, and enforces blocks", async () => {
    await as(alice, async () => {
      await save("diary_entries", { ...a.entries[4], visibility: "followers" });
    });
    await as(bob, async () => {
      await sql.query("select public.community_action($1,'follow')", [alice]);
      const { rows } = await sql.query<{ feed: unknown[] }>(
        "select public.community_feed($1) as feed",
        [alice],
      );
      expect(rows[0].feed).toHaveLength(0);
    });
    await as(alice, () =>
      sql.query("select public.community_action($1,'accept')", [bob]),
    );
    await as(bob, async () => {
      const { rows } = await sql.query<{ feed: Record<string, unknown>[] }>(
        "select public.community_feed($1) as feed",
        [alice],
      );
      expect(rows[0].feed).toHaveLength(1);
      expect(rows[0].feed[0]).not.toHaveProperty("mood");
      expect(rows[0].feed[0]).not.toHaveProperty("condition");
      expect(rows[0].feed[0]).not.toHaveProperty("unit");
    });
    await as(alice, () =>
      sql.query("select public.community_action($1,'block')", [bob]),
    );
    await as(bob, async () => {
      expect(
        (
          await sql.query<{ feed: unknown[] }>(
            "select public.community_feed($1) as feed",
            [alice],
          )
        ).rows[0].feed,
      ).toHaveLength(0);
      await expect(
        sql.query("select public.community_action($1,'follow')", [alice]),
      ).rejects.toThrow(/Unavailable/);
    });
  });
  it("retains immutable published versions and protects share metadata", async () => {
    await as(alice, async () => {
      for (const entry of a.entries) {
        const existing = await sql.query(
          "select id from public.diary_entries where id=$1",
          [entry.id],
        );
        if (!existing.rows.length) await save("diary_entries", entry);
      }
      await save("books", a.book);
      await save("book_versions", a.version);
      await sql.query("select public.archive_book_version($1,true)", [
        a.version.id,
      ]);
      const { rows } = await sql.query<{
        snapshot: unknown;
        archived: boolean;
      }>("select snapshot,archived from public.book_versions where id=$1", [
        a.version.id,
      ]);
      expect(rows[0].archived).toBe(true);
      expect(rows[0].snapshot).toEqual(a.version.snapshot);
    });
    await expect(
      sql.query("update public.book_versions set snapshot='{}' where id=$1", [
        a.version.id,
      ]),
    ).rejects.toThrow(/immutable/);
    await as(bob, async () =>
      expect(
        (await sql.query("select * from public.book_versions")).rows,
      ).toHaveLength(0),
    );
    await as(alice, () =>
      sql.query(
        "insert into public.diary_shares(owner_id,period_id,token_hash,display_name) values($1,$2,$3,'Lukas')",
        [alice, a.period.id, "a".repeat(64)],
      ),
    );
    await as(bob, async () =>
      expect(
        (await sql.query("select * from public.diary_shares")).rows,
      ).toHaveLength(0),
    );
    await expect(
      as(null, () => sql.query("select * from public.diary_shares")),
    ).rejects.toThrow(/permission denied/);
  });
});
