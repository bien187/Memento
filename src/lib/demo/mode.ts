/**
 * Public demo mode. The demo lives under /demo, uses its own IndexedDB database
 * and a fixed, fictional owner. It never reads or writes the identity of the
 * regular app and never talks to Supabase.
 */
export const DEMO_BASE = "/demo";
export const DEMO_DATABASE = "memento-demo-v1";
export const DEMO_OWNER = "0d3e0000-0000-4000-8000-000000000001";
/** Optional link back to the portfolio. Without a configured URL no button is shown. */
export const PORTFOLIO_URL =
  process.env.NEXT_PUBLIC_PORTFOLIO_URL?.trim() || "";

export function isDemoPath(pathname: string) {
  return pathname === DEMO_BASE || pathname.startsWith(`${DEMO_BASE}/`);
}

/** Decided once per page load. Leaving the demo always uses a full navigation. */
export const demoMode =
  typeof window !== "undefined" && isDemoPath(window.location.pathname);

/** Maps an app path ("/", "/calendar") into the current environment. */
export function appPath(path: string, demo = demoMode) {
  if (!demo) return path;
  return path === "/" ? DEMO_BASE : `${DEMO_BASE}${path}`;
}

/** Strips the demo prefix so the shell can match its sections. */
export function sectionPath(pathname: string, demo = demoMode) {
  if (!demo || !isDemoPath(pathname)) return pathname;
  return pathname.slice(DEMO_BASE.length) || "/";
}
