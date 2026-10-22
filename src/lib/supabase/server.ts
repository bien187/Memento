import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
export async function serverClient() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase ist nicht eingerichtet.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components cannot set cookies; proxy refreshes them. */
        }
      },
    },
  });
}
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url)
    throw new Error("Server-Konfiguration für Freigaben fehlt.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function requireUser() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Bitte anmelden.");
  return { client, user: data.user };
}
