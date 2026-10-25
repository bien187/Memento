import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
import { z } from "zod";
import { entrySchema } from "@/lib/domain/models";
import { demoRecords } from "./fixtures/notebook";

const sql = new PGlite();
const owner = crypto.randomUUID();
const fixture = demoRecords(owner);
async function save(
  table: string,
  payload: unknown,
  version = 0,
  operation = crypto.randomUUID(),
) {
  const result = await sql.query<{
    result: { record: Record<string, unknown> };
  }>("select public.sync_entity($1,$2::jsonb,$3,$4::uuid) as result", [
    table,
    JSON.stringify(payload),
    version,
    operation,
  ]);
  return result.rows[0].result;
}
beforeAll(async () => {
  await sql.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
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
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await sql.exec(
      readFileSync(`supabase/migrations/${file}`, "utf8").replace(
        "create extension if not exists pgcrypto with schema extensions;",
        "",
      ),
    );
  await sql.query("insert into auth.users values($1)", [owner]);
  await sql.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  await sql.exec("set timezone='UTC'");
  await sql.exec("set role authenticated");
  await save("profiles", fixture.profile);
  await save("service_periods", fixture.period);
});
afterAll(() => sql.close());

it("roundtrips a PostgreSQL offset timestamp and uses server creation metadata instead of submitted values", async () => {
  const { created_at: _, updated_at: __, ...input } = fixture.entries[0];
  const result = await save("diary_entries", input);
  const record = entrySchema.parse(result.record);
  // This is the actual output shape responsible for the original editor failure.
  expect(z.iso.datetime().safeParse(record.created_at).success).toBe(false);
  expect(record.created_at).toMatch(/\+00:00$/);
  expect(record.updated_at).toMatch(/\+00:00$/);
  expect(record.date).toBe(input.date);
  expect(record.media_ids).toEqual([]);
  await sql.exec("set timezone='Europe/Zurich'");
  const alternative = await sql.query<{ record: unknown }>(
    "select to_jsonb(e) as record from public.diary_entries e where id=$1",
    [record.id],
  );
  const swissRecord = entrySchema.parse(alternative.rows[0].record);
  expect(swissRecord.created_at).toMatch(/\+0[12]:00$/);
  expect(new Date(swissRecord.created_at).getTime()).toBe(
    new Date(record.created_at).getTime(),
  );
  await sql.exec("set timezone='UTC'");
  const forged = await save("diary_entries", {
    ...fixture.entries[1],
    created_at: "",
    updated_at: "not-a-timestamp",
  });
  expect(forged.record.created_at).not.toMatch(/^1900/);
  expect(forged.record.updated_at).not.toMatch(/^1900/);
  expect(entrySchema.safeParse(forged.record).success).toBe(true);
});

it("updates metadata automatically, preserves creation time and keeps retries idempotent with images and assessments", async () => {
  const image = crypto.randomUUID();
  const input = {
    ...fixture.entries[2],
    subtitle: "Meilenstein",
    milestone: true,
    mood: 0,
    condition: 100,
    media_ids: [image],
    cover_id: image,
  };
  const first = await save("diary_entries", input);
  const operation = crypto.randomUUID();
  const edit = {
    ...input,
    subtitle: "Ergänzung",
    created_at: "1900-01-01T00:00:00Z",
  };
  const second = await save("diary_entries", edit, 1, operation);
  expect(second.record.created_at).toBe(first.record.created_at);
  expect(second.record.updated_at).not.toBe(first.record.updated_at);
  expect(second.record).toMatchObject({
    subtitle: "Ergänzung",
    mood: 0,
    condition: 100,
    milestone: true,
    media_ids: [image],
    cover_id: image,
    date: input.date,
  });
  expect(await save("diary_entries", edit, 1, operation)).toEqual(second);
  expect(entrySchema.safeParse(second.record).success).toBe(true);
  await sql.exec("reset role");
  await sql.query(
    "update public.diary_entries set created_at='1900-01-01',updated_at='1900-01-01',content='server edit' where id=$1",
    [input.id],
  );
  const direct = await sql.query<{
    valid: boolean;
    creation_preserved: boolean;
  }>(
    "select updated_at>created_at as valid,created_at=$2::timestamptz as creation_preserved from public.diary_entries where id=$1",
    [input.id, first.record.created_at],
  );
  expect(direct.rows[0]).toEqual({ valid: true, creation_preserved: true });
});
