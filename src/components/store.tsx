"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { db, ownData, saveEntity } from "@/lib/local/db";
import { cloudConfigured, supabase } from "@/lib/supabase/browser";
import { sync } from "@/lib/local/sync";
import {
  defaultPreferences,
  type Entity,
  type EntityTable,
  type Preferences,
} from "@/lib/domain/models";
import { removeRetiredDemo } from "@/lib/local/retired-demo";
import { FeedbackProvider, useToast } from "./ui";
import { message } from "@/lib/utils";
type Identity = { id: string; mode: "cloud" | "local" };
type Data = Awaited<ReturnType<typeof ownData>>;
type Store = {
  identity: Identity | null;
  ready: boolean;
  data: Data | undefined;
  online: boolean;
  syncError: string;
  cloudLoaded: boolean;
  save: <T extends Entity>(
    table: EntityTable,
    value: T,
    baseline?: Entity,
  ) => Promise<T>;
  enterLocal: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setPreferences: (value: Partial<Preferences>) => Promise<void>;
};
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});
export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <StoreProvider>{children}</StoreProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
}
function StoreProvider({ children }: PropsWithChildren) {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [ready, setReady] = useState(false),
    [online, setOnline] = useState(true),
    [loadedOwner, setLoadedOwner] = useState<string | null>(null),
    [syncError, setSyncError] = useState("");
  const toast = useToast();
  const changeIdentity = useCallback((value: Identity | null) => {
    setIdentity((previous) =>
      previous?.id === value?.id && previous?.mode === value?.mode
        ? previous
        : value,
    );
    if (value) localStorage.setItem("feldbuch.identity", JSON.stringify(value));
    else localStorage.removeItem("feldbuch.identity");
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function init() {
      try {
        const raw = localStorage.getItem("feldbuch.identity");
        await removeRetiredDemo(localStorage);
        const cached: Identity | null = raw ? JSON.parse(raw) : null;
        if (cached?.mode === "local") {
          if (active) changeIdentity(cached);
        } else if (cached && cached.mode === "cloud" && !navigator.onLine) {
          if (active) changeIdentity(cached);
        } else if (cloudConfigured) {
          const { data } = await supabase().auth.getSession();
          if (active)
            changeIdentity(
              data.session ? { id: data.session.user.id, mode: "cloud" } : null,
            );
        }
        if (cloudConfigured) {
          const { data } = supabase().auth.onAuthStateChange(
            (_event, session) => {
              if (active && session)
                changeIdentity({ id: session.user.id, mode: "cloud" });
              else if (active && _event === "SIGNED_OUT") changeIdentity(null);
            },
          );
          unsubscribe = () => data.subscription.unsubscribe();
        }
      } catch (e) {
        toast(message(e));
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [changeIdentity, toast]);
  const data = useLiveQuery(
    () => (identity ? ownData(identity.id) : undefined),
    [identity?.id],
  );
  const refresh = useCallback(async () => {
    if (identity?.mode === "cloud") {
      if (!navigator.onLine) return;
      try {
        await sync(identity.id);
        setSyncError("");
        setLoadedOwner(identity.id);
      } catch (e) {
        setSyncError(message(e));
      }
    }
  }, [identity]);
  useEffect(() => {
    if (online && identity?.mode === "cloud") {
      void refresh();
      const t = setInterval(() => void refresh(), 15000);
      return () => clearInterval(t);
    }
  }, [online, identity, refresh]);
  useEffect(() => {
    const preference = data?.user_preferences[0];
    const theme = preference?.theme ?? "system";
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.setAttribute(
        "data-theme",
        theme === "system" ? (media.matches ? "dark" : "light") : theme,
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data?.user_preferences]);
  useEffect(() => {
    document.documentElement.dataset.branch =
      data?.profiles[0]?.branch_id ?? "";
  }, [data?.profiles[0]?.branch_id]);
  const save = useCallback(
    async <T extends Entity>(
      table: EntityTable,
      value: T,
      baseline?: Entity,
    ) => {
      if (!identity) throw new Error("Kein persönliches Notizbuch ausgewählt.");
      if (value.owner_id !== identity.id)
        throw new Error("Keine Berechtigung.");
      try {
        const saved = await saveEntity(
          table,
          value,
          identity.mode,
          db,
          baseline,
        );
        if (
          baseline &&
          (
            await db.operations
              .where("[table+entity_id]")
              .equals([table, value.id])
              .first()
          )?.status === "conflict"
        )
          toast(
            "Beide Fassungen sind gesichert. Bitte den Änderungskonflikt im Profil prüfen.",
          );
        if (online) void refresh();
        return saved;
      } catch (e) {
        toast(message(e));
        throw e;
      }
    },
    [identity, online, refresh, toast],
  );
  async function enterLocal() {
    let id = localStorage.getItem("feldbuch.local-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("feldbuch.local-id", id);
    }
    if (!(await db.user_preferences.get(id)))
      await db.user_preferences.put(defaultPreferences(id));
    changeIdentity({ id, mode: "local" });
  }
  async function logout() {
    if (identity?.mode === "cloud") await supabase().auth.signOut();
    changeIdentity(null);
    queryClient.clear();
    toast(
      "Abgemeldet. Lokale Daten bleiben auf diesem Gerät, bis du sie im Profil löschst.",
    );
  }
  async function setPreferences(value: Partial<Preferences>) {
    if (!identity) return;
    await save("user_preferences", {
      ...(data?.user_preferences[0] ?? defaultPreferences(identity.id)),
      ...value,
    });
  }
  return (
    <Context.Provider
      value={{
        identity,
        ready,
        data,
        online,
        syncError,
        cloudLoaded: identity?.mode !== "cloud" || loadedOwner === identity.id,
        save,
        enterLocal,
        logout,
        refresh,
        setPreferences,
      }}
    >
      {children}
    </Context.Provider>
  );
}
