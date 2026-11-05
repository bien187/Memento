"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  UserCheck,
  ShieldBan,
  Check,
  X,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useStore } from "./store";
import { supabase } from "@/lib/supabase/browser";
import { Button, Empty, useToast, useConfirm } from "./ui";
import { FormattedText } from "./journal";
import { catalogLabel, ranks, branches } from "@/lib/domain/catalogs";
import { BranchInsignia } from "./military-fields";
import { entryTitle } from "@/lib/domain/dates";
import { message } from "@/lib/utils";
type Person = {
  id: string;
  name: string;
  username: string | null;
  private_profile: boolean;
  rank_id: string | null;
  branch_id: string | null;
  following: boolean;
  requested: boolean;
  followers: number;
};
type Feed = {
  id: string;
  owner_id: string;
  date: string;
  subtitle: string;
  content: string;
  milestone: boolean;
  media_ids: string[];
  cover_id: string | null;
  name: string;
  username: string | null;
  start_date: string;
};
export function Community() {
  const { identity, demo } = useStore(),
    toast = useToast(),
    confirm = useConfirm(),
    cache = useQueryClient();
  const [search, setSearch] = useState(""),
    [tab, setTab] = useState<"feed" | "people" | "requests">("feed"),
    [person, setPerson] = useState<Person | null>(null),
    [busy, setBusy] = useState("");
  const cloud = identity?.mode === "cloud";
  const people = useQuery({
    queryKey: ["people", identity?.id, search],
    enabled: cloud,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_people", {
        query: search,
      });
      if (error) throw error;
      return data as Person[];
    },
  });
  const feed = useQuery({
    queryKey: ["feed", identity?.id, person?.id],
    enabled: cloud,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_feed", {
        person: person?.id ?? null,
      });
      if (error) throw error;
      return data as Feed[];
    },
  });
  const requests = useQuery({
    queryKey: ["requests", identity?.id],
    enabled: cloud,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_requests");
      if (error) throw error;
      return data as { id: string; name: string; username: string | null }[];
    },
  });
  async function action(target: string, type: string) {
    setBusy(target);
    try {
      if (cloud) {
        const { error } = await supabase().rpc("community_action", {
          target,
          action: type,
        });
        if (error) throw error;
        await Promise.all([
          cache.invalidateQueries({ queryKey: ["people"] }),
          cache.invalidateQueries({ queryKey: ["feed"] }),
          cache.invalidateQueries({ queryKey: ["requests"] }),
        ]);
      }
      toast(
        type === "follow"
          ? "Folgen aktualisiert. Private Profile müssen die Anfrage bestätigen."
          : type === "block"
            ? "Person blockiert."
            : "Auswahl gespeichert.",
      );
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy("");
    }
  }
  if (!cloud)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Gemeinsam erinnern</p>
            <h1>
              Community<span className="heading-dot">.</span>
            </h1>
          </div>
        </div>
        {demo ? (
          <Empty
            title="In der Demo nicht verfügbar."
            text="Die Community verbindet echte Konten über bestätigte Follows und einen privaten Feed. Damit keine fiktiven Daten mit echten Personen vermischt werden, ist sie in der Demo deaktiviert."
          />
        ) : (
          <Empty
            title="Eine Verbindung braucht ein Konto."
            text="Die Community verwendet Supabase-Konten und bestätigte Freigaben. Dein lokales Tagebuch bleibt auf diesem Gerät."
          />
        )}
      </>
    );
  const list = people.data ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Gemeinsam erinnern</p>
          <h1>
            Geschichten verbinden<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Einblicke von Menschen, die ihren eigenen Weg gehen.
          </p>
        </div>
      </div>
      <div className="journal-tabs">
        {(
          [
            { id: "feed", label: "Dein Feed" },
            { id: "people", label: "Menschen finden" },
            {
              id: "requests",
              label: `Anfragen${requests.data?.length ? ` (${requests.data.length})` : ""}`,
            },
          ] as const
        ).map((t) => (
          <button
            className={tab === t.id ? "active" : ""}
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setPerson(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {(people.error || feed.error || requests.error) && (
        <div role="alert" className="error-message">
          Community konnte nicht geladen werden. Prüfe die Verbindung und die
          Datenbankmigrationen.
          <Button
            variant="outline"
            onClick={() => void cache.invalidateQueries()}
          >
            Erneut laden
          </Button>
        </div>
      )}
      {tab === "people" && (
        <>
          <div className="search-field community-search">
            <Search size={17} />
            <input
              aria-label="Personen suchen"
              value={search}
              placeholder="Name oder Benutzername suchen"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {people.isLoading ? (
            <p role="status">Profile werden gesucht …</p>
          ) : !list.length ? (
            <Empty
              title="Noch niemanden gefunden."
              text="Versuche einen anderen Namen. Nur auffindbare Profile werden angezeigt."
            />
          ) : (
            <div className="people-list">
              {list.map((p) => (
                <article key={p.id}>
                  <button
                    className="person-open"
                    onClick={() => {
                      setPerson(p);
                      setTab("feed");
                    }}
                  >
                    <BranchInsignia id={p.branch_id} />
                    <div>
                      <h3>{p.name}</h3>
                      <p>
                        @{p.username ?? "ohne_benutzername"} ·{" "}
                        {catalogLabel(branches, p.branch_id)}
                      </p>
                      <small>
                        {catalogLabel(ranks, p.rank_id)} ·{" "}
                        {p.private_profile
                          ? "Privates Profil"
                          : "Offenes Profil"}
                      </small>
                    </div>
                  </button>
                  <Button
                    variant={p.following ? "outline" : "default"}
                    disabled={busy === p.id}
                    onClick={() =>
                      void action(
                        p.id,
                        p.following || p.requested ? "unfollow" : "follow",
                      )
                    }
                  >
                    {p.following ? (
                      <UserCheck size={16} />
                    ) : (
                      <UserPlus size={16} />
                    )}
                    {p.following
                      ? "Gefolgt"
                      : p.requested
                        ? "Angefragt"
                        : "Folgen"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${p.name} blockieren`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Person blockieren?",
                          text: "Follow-Beziehungen und Anfragen werden entfernt. Ihr seht gegenseitig keine Community-Inhalte.",
                          label: "Blockieren",
                          danger: true,
                        })
                      )
                        await action(p.id, "block");
                    }}
                  >
                    <ShieldBan size={17} />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "requests" && (
        <>
          {requests.isLoading ? (
            <p role="status">Anfragen werden geladen …</p>
          ) : !requests.data?.length ? (
            <Empty
              title="Alles ruhig hier."
              text="Neue Follow-Anfragen erscheinen an dieser Stelle."
            />
          ) : (
            <div className="people-list">
              {requests.data.map((p) => (
                <article key={p.id}>
                  <span className="avatar">{p.name[0]}</span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>@{p.username}</p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy === p.id}
                    onClick={() => void action(p.id, "accept")}
                  >
                    <Check size={16} />
                    Annehmen
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Anfrage ablehnen"
                    onClick={() => void action(p.id, "reject")}
                  >
                    <X size={17} />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "feed" && (
        <>
          {person && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setPerson(null);
                  setTab("people");
                }}
              >
                <ArrowLeft size={16} />
                Zur Suche
              </Button>
              <div className="public-person">
                <span className="avatar">{person.name[0]}</span>
                <div>
                  <h2>{person.name}</h2>
                  <p>
                    @{person.username} · {person.followers} Follower
                  </p>
                </div>
              </div>
            </>
          )}
          {feed.isLoading ? (
            <p role="status">Freigegebene Einträge werden geladen …</p>
          ) : !feed.data?.length ? (
            <Empty
              title={
                person
                  ? "Noch kein Einblick freigegeben."
                  : "Hier ist Platz für andere Perspektiven."
              }
              text={
                person
                  ? "Du siehst ausschliesslich Einträge, für die du berechtigt bist."
                  : "Folge Menschen und lies die Erinnerungen, die sie mit dir teilen."
              }
              action={
                <Button variant="outline" onClick={() => setTab("people")}>
                  Menschen finden
                  <UserPlus size={16} />
                </Button>
              }
            />
          ) : (
            <div className="community-feed">
              {feed.data.map((e) => (
                <article key={e.id}>
                  <header>
                    <span className="avatar">{e.name[0]}</span>
                    <div>
                      <strong>{e.name}</strong>
                      <p>{entryTitle(e.date, e.start_date)}</p>
                    </div>
                  </header>
                  <h2>{e.subtitle || "Ein Tag, der bleibt."}</h2>
                  <FormattedText text={e.content} />
                  <div className="reader-photos">
                    {e.media_ids.map((id, i) => (
                      <img
                        key={id}
                        src={`/api/community/media/${id}`}
                        alt={`Freigegebenes Foto ${i + 1}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
