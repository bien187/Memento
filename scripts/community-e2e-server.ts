// Isolated HTTP contract fixture. Never used by the app or production runtime.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  viewerId,
  authorId,
  requestId,
  own,
  preferences,
  person,
  requester,
  publicProfile,
  publicEntries,
  publicPhoto,
  secondPhoto,
  avatarId,
} from "../tests/fixtures/community";
const port = 54389;
let requests = [requester],
  following = true;
const records: Record<string, Record<string, unknown>[]> = {};
function reset() {
  requests = [requester];
  following = true;
  Object.assign(records, {
    profiles: [structuredClone(own.profile)],
    service_periods: [structuredClone(own.period)],
    user_preferences: [structuredClone(preferences)],
    diary_entries: [],
    entry_media: [],
    books: [],
    book_versions: [],
    book_chapters: [],
  });
}
reset();
const user = {
  id: viewerId,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const encode = (data: unknown) =>
  Buffer.from(JSON.stringify(data)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: viewerId, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.synthetic-signature`;
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3101");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,accept-profile,content-profile,x-retry-count,x-upsert",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url!, `http://localhost:${port}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (url.pathname.startsWith("/storage/v1/")) {
    if (req.method === "GET") {
      res.setHeader("Content-Type", "image/png");
      res.end(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0gAAAABJRU5ErkJggg==",
          "base64",
        ),
      );
    } else res.end(JSON.stringify({ Key: url.pathname }));
    return;
  }
  const body = chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString())
    : {};
  let result: unknown = [];
  if (url.pathname === "/__reset") {
    reset();
    result = { ok: true };
  } else if (url.pathname === "/auth/v1/user") result = user;
  else if (url.pathname === "/auth/v1/token")
    result = {
      access_token: token,
      refresh_token: "synthetic-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    };
  else if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpc = url.pathname.split("/").at(-1);
    if (rpc === "community_requests") result = requests;
    else if (rpc === "community_media" || rpc === "community_avatar") {
      const id = rpc === "community_avatar" ? avatarId : body.media_id;
      result = [publicPhoto, secondPhoto, avatarId].includes(id)
        ? {
            id,
            owner_id: authorId,
            storage_path: `${authorId}/${id}.png`,
            mime: "image/png",
          }
        : null;
    } else if (rpc === "community_people" || rpc === "community_connections")
      result = [{ ...person, following }];
    else if (rpc === "community_profile")
      result =
        body.person === authorId
          ? { ...publicProfile, following }
          : body.person === requestId
            ? { ...publicProfile, ...requester }
            : null;
    else if (rpc === "community_feed") {
      const selected = body.only_milestones
        ? publicEntries.filter((entry) => entry.milestone)
        : publicEntries;
      const start = body.before_id
        ? selected.findIndex((e) => e.id === body.before_id) + 1
        : 0;
      result = selected
        .slice(start, start + (body.page_size ?? 20))
        .map((e) => ({ ...e, content: e.content.slice(0, 600) }));
    } else if (rpc === "community_entry")
      result = publicEntries.find((e) => e.id === body.entry_id) ?? null;
    else if (rpc === "community_action") {
      if (body.action === "accept" || body.action === "reject")
        requests = requests.filter((e) => e.id !== body.target);
      if (body.action === "follow") following = true;
      if (body.action === "unfollow") following = false;
      result = null;
    } else if (rpc === "sync_entity") {
      const table =
        records[body.entity_table] ?? (records[body.entity_table] = []);
      const old = table.find((e) => e.id === body.payload.id);
      const record = {
        ...body.payload,
        created_at:
          old?.created_at ?? new Date().toISOString().replace("Z", "+00:00"),
        updated_at: new Date().toISOString().replace("Z", "+00:00"),
        version: ((old?.version as number) ?? 0) + 1,
      };
      const index = table.findIndex((e) => e.id === record.id);
      if (index < 0) table.push(record);
      else table[index] = record;
      result = { record };
    }
  } else if (url.pathname.startsWith("/rest/v1/"))
    result = records[url.pathname.split("/").at(-1)!] ?? [];
  res.end(JSON.stringify(result));
});
await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-test-key",
};
const next = "node_modules/next/dist/bin/next";
const build = spawn(process.execPath, [next, "build", "--webpack"], {
  env,
  stdio: "inherit",
  windowsHide: true,
});
const code = await new Promise<number | null>((resolve) =>
  build.on("exit", resolve),
);
if (code !== 0) {
  server.close();
  process.exit(code ?? 1);
}
const app = spawn(
  process.execPath,
  [next, "start", "--hostname", "localhost", "--port", "3101"],
  { env, stdio: "inherit", windowsHide: true },
);
function close() {
  app.kill();
  server.close();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
app.on("exit", () => {
  server.close();
  process.exit();
});
