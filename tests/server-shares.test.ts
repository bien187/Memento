import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { demoRecords } from "@/lib/local/demo";
import {
  authorizedShare,
  publicContents,
  newToken,
  hash,
  passwordHash,
  checkPassword,
  assertOrigin,
  cookieName,
  cookieProof,
} from "@/lib/server/shares";
const storage = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
}));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({
    from: (name: string) => {
      const matches: ((row: Record<string, unknown>) => boolean)[] = [];
      let single = false;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          matches.push((row) => row[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => {
          matches.push((row) => row[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          matches.push((row) => values.includes(row[key]));
          return query;
        },
        order: () => query,
        maybeSingle: () => {
          single = true;
          return query;
        },
        single: () => {
          single = true;
          return query;
        },
        then: (resolve: (r: unknown) => unknown) => {
          const rows = (storage.tables[name] ?? []).filter((row) =>
            matches.every((m) => m(row)),
          );
          return Promise.resolve(
            resolve({ data: single ? (rows[0] ?? null) : rows, error: null }),
          );
        },
      };
      return query;
    },
  }),
}));
const owner = crypto.randomUUID(),
  token = newToken(),
  f = demoRecords(owner);
const shared = { ...f.entries[0], visibility: "link", mood: 88, condition: 12 };
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = crypto.randomUUID();
  storage.tables = {
    diary_shares: [
      {
        id: crypto.randomUUID(),
        owner_id: owner,
        period_id: f.period.id,
        token_hash: hash(token),
        password_hash: null,
        display_name: "Gewählter Name",
        excluded_entry_ids: [],
        expires_at: null,
        revoked_at: null,
      },
    ],
    book_shares: [],
    service_periods: [f.period],
    diary_entries: [
      shared,
      { ...f.entries[1], visibility: "private" },
      { ...f.entries[2], visibility: "followers" },
    ],
    entry_media: [],
  };
});
describe("token-authorized public reading", () => {
  it("uses 256-bit tokens, salted password hashes and origin validation", () => {
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const password = crypto.randomUUID(),
      stored = passwordHash(password);
    expect(stored).not.toContain(password);
    expect(passwordHash(password)).not.toBe(stored);
    expect(checkPassword(password, stored)).toBe(true);
    expect(checkPassword(crypto.randomUUID(), stored)).toBe(false);
    expect(() =>
      assertOrigin(
        new Request("https://example.test/api", {
          headers: { origin: "https://other.test" },
        }),
      ),
    ).toThrow();
  });
  it("publishes only eligible entries and omits personal scores and military details", async () => {
    const request = new NextRequest(`https://example.test/api/public/${token}`);
    const access = await authorizedShare(request, token);
    const { snapshot } = await publicContents(access, token);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].id).toBe(shared.id);
    expect(snapshot.entries[0]).not.toHaveProperty("mood");
    expect(snapshot.entries[0]).not.toHaveProperty("condition");
    expect(snapshot.period).not.toHaveProperty("unit");
    expect(snapshot.period).not.toHaveProperty("barracks_id");
    expect(snapshot.display_name).toBe("Gewählter Name");
    storage.tables.diary_shares[0].excluded_entry_ids = [shared.id];
    expect(
      (await publicContents(await authorizedShare(request, token), token))
        .snapshot.entries,
    ).toHaveLength(0);
  });
  it("omits private barracks from published book snapshots as well", async () => {
    const share = storage.tables.diary_shares[0];
    storage.tables.diary_shares = [];
    storage.tables.book_shares = [{ ...share, version_id: f.version.id }];
    storage.tables.book_versions = [
      { id: f.version.id, owner_id: owner, snapshot: f.version.snapshot },
    ];
    const request = new NextRequest(`https://example.test/api/public/${token}`);
    const { snapshot } = await publicContents(
      await authorizedShare(request, token),
      token,
    );
    expect(snapshot.period).not.toHaveProperty("barracks_id");
    expect(snapshot.period).not.toHaveProperty("unit");
  });
  it("rejects revoked and expired links even with a previously valid cookie", async () => {
    const password = crypto.randomUUID(),
      stored = passwordHash(password);
    storage.tables.diary_shares[0].password_hash = stored;
    const request = new NextRequest(
      `https://example.test/api/public/${token}`,
      {
        headers: {
          cookie: `${cookieName(token)}=${cookieProof(token, stored)}`,
        },
      },
    );
    await expect(authorizedShare(request, token)).resolves.toBeDefined();
    storage.tables.diary_shares[0].revoked_at = new Date().toISOString();
    await expect(authorizedShare(request, token)).rejects.toThrow(
      /nicht verfügbar/,
    );
    storage.tables.diary_shares[0].revoked_at = null;
    storage.tables.diary_shares[0].expires_at = "2020-01-01T00:00:00Z";
    await expect(authorizedShare(request, token)).rejects.toThrow(
      /nicht verfügbar/,
    );
  });
  it("requires a password and never authorizes an unselected or foreign media path", async () => {
    const request = new NextRequest(`https://example.test/api/public/${token}`),
      password = crypto.randomUUID();
    storage.tables.diary_shares[0].password_hash = passwordHash(password);
    await expect(authorizedShare(request, token)).rejects.toThrow(
      "PASSWORD_REQUIRED",
    );
    await expect(authorizedShare(request, token, "incorrect")).rejects.toThrow(
      "PASSWORD_REQUIRED",
    );
    const id = crypto.randomUUID();
    shared.media_ids = [id];
    storage.tables.entry_media = [
      {
        id,
        owner_id: owner,
        storage_path: `${owner}/../another-owner/private.jpeg`,
      },
    ];
    const result = await publicContents(
      await authorizedShare(request, token, password),
      token,
    );
    expect(result.paths.size).toBe(0);
    expect(result.snapshot.media).toHaveLength(0);
    shared.media_ids = [];
  });
});
