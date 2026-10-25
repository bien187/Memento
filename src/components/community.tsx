"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  LayoutGrid,
  List,
  Menu,
  Search,
  Shield,
  ShieldBan,
  Star,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { supabase } from "@/lib/supabase/browser";
import { Button, Empty, Modal, useToast, useConfirm } from "./ui";
import { FormattedText } from "./journal";
import {
  catalogLabel,
  ranks,
  branches,
  functions,
} from "@/lib/domain/catalogs";
import { dateLabel } from "@/lib/domain/dates";
import { BranchInsignia } from "./military-fields";
import { EntryCollection, readableTitle } from "./entry-collection";
import {
  communityEntrySchema,
  communityPersonSchema,
  communityProfileSchema,
  profileHref,
  type CommunityPerson,
} from "@/lib/domain/community";

const PAGE_SIZE = 20;
type Panel = "menu" | "people" | "requests" | "followers" | "following";
type Cursor = {
  before_date: string;
  before_created_at: string;
  before_id: string;
} | null;
let navigatedToProfile = false;
function rememberProfileNavigation() {
  navigatedToProfile = true;
}

export function CommunityAvatar({
  id,
  name,
  avatarId,
}: {
  id: string;
  name: string;
  avatarId: string | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id, avatarId]);
  return (
    <span className="avatar community-avatar">
      {avatarId && !failed ? (
        <img
          src={`/api/community/avatar/${id}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

function useCommunityActions() {
  const cache = useQueryClient(),
    toast = useToast();
  const [busy, setBusy] = useState("");
  async function action(target: string, type: string) {
    setBusy(target);
    try {
      const { error } = await supabase().rpc("community_action", {
        target,
        action: type,
      });
      if (error) throw error;
      await Promise.all(
        ["community", "connections", "follow-counts"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast(
        type === "follow"
          ? "Folgen aktualisiert. Private Profile bestätigen deine Anfrage."
          : type === "block"
            ? "Person blockiert."
            : "Auswahl gespeichert.",
      );
    } catch (error) {
      console.error("Community action failed", error);
      toast(
        "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.",
      );
    } finally {
      setBusy("");
    }
  }
  return { busy, action };
}

function FollowButton({
  person,
  busy,
  action,
}: {
  person: CommunityPerson;
  busy: string;
  action: (target: string, type: string) => Promise<void>;
}) {
  const { identity } = useStore();
  if (person.id === identity?.id)
    return (
      <Button asChild variant="outline">
        <Link href="/profile">Eigenes Profil verwalten</Link>
      </Button>
    );
  return (
    <Button
      variant={person.following || person.requested ? "outline" : "default"}
      disabled={!!busy}
      onClick={() =>
        void action(
          person.id,
          person.following || person.requested ? "unfollow" : "follow",
        )
      }
    >
      {person.following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      {person.following
        ? "Entfolgen"
        : person.requested
          ? "Anfrage zurückziehen"
          : "Folgen"}
    </Button>
  );
}

function PersonLink({
  person,
  onNavigate,
}: {
  person: CommunityPerson;
  onNavigate?: () => void;
}) {
  return (
    <Link
      className="person-open"
      href={profileHref(person.id)}
      onClick={() => {
        rememberProfileNavigation();
        onNavigate?.();
      }}
    >
      <CommunityAvatar
        id={person.id}
        name={person.name}
        avatarId={person.avatar_id}
      />
      <div>
        <h3>{person.name}</h3>
        {person.username && <p>@{person.username}</p>}
        <small>
          {person.branch_id
            ? catalogLabel(branches, person.branch_id)
            : person.private_profile
              ? "Privates Profil"
              : "Offenes Profil"}
        </small>
      </div>
    </Link>
  );
}

function CommunityPanel({
  panel,
  setPanel,
  close,
}: {
  panel: Panel;
  setPanel: (panel: Panel) => void;
  close: () => void;
}) {
  const { identity } = useStore(),
    confirm = useConfirm();
  const { busy, action } = useCommunityActions();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [branch, setBranch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const people = useQuery({
    queryKey: ["community", "people", identity?.id, query, branch],
    enabled: panel === "people",
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_people", {
        query,
        branch: branch || null,
      });
      if (error) throw error;
      return communityPersonSchema.array().parse(data);
    },
  });
  const list = useQuery({
    queryKey: ["community", "list", identity?.id, panel],
    enabled: panel !== "menu" && panel !== "people",
    queryFn: async () => {
      const { data, error } =
        panel === "requests"
          ? await supabase().rpc("community_requests")
          : await supabase().rpc("community_connections", { kind: panel });
      if (error) throw error;
      return communityPersonSchema.array().parse(data);
    },
  });
  if (panel === "menu")
    return (
      <div className="community-menu-options">
        {(
          [
            ["people", "Leute finden", Search],
            ["requests", "Follow-Anfragen", UserPlus],
            ["following", "Gefolgte Benutzer", UserCheck],
            ["followers", "Follower", Users],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button key={key} variant="ghost" onClick={() => setPanel(key)}>
            <Icon size={19} />
            {label}
          </Button>
        ))}
        <Button asChild variant="ghost">
          <Link href="/profile" onClick={close}>
            <Shield size={19} />
            Community-Einstellungen
          </Link>
        </Button>
      </div>
    );
  const result = panel === "people" ? people : list;
  return (
    <>
      <Button variant="ghost" onClick={() => setPanel("menu")}>
        <ArrowLeft size={16} />
        Zum Menü
      </Button>
      {panel === "people" && (
        <div className="community-search-controls">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Personen suchen"
              placeholder="Name oder Benutzername"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label>
            Truppengattung
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Alle</option>
              {branches.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {result.isLoading ? (
        <p role="status">Profile werden geladen …</p>
      ) : result.error ? (
        <div role="alert">
          <p>Die Liste konnte nicht geladen werden.</p>
          <Button variant="outline" onClick={() => void result.refetch()}>
            Erneut laden
          </Button>
        </div>
      ) : !result.data?.length ? (
        <Empty
          title={
            panel === "requests"
              ? "Alles ruhig hier."
              : "Noch niemanden gefunden."
          }
          text={
            panel === "requests"
              ? "Neue Follow-Anfragen erscheinen hier."
              : "Hier erscheinen ausschliesslich freigegebene Profile."
          }
        />
      ) : (
        <div className="people-list">
          {result.data.map((person) => (
            <article key={person.id}>
              <PersonLink person={person} onNavigate={close} />
              <div className="person-actions">
                {panel === "requests" ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void action(person.id, "accept")}
                    >
                      <Check size={16} />
                      Annehmen
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!!busy}
                      aria-label={`Anfrage von ${person.name} ablehnen`}
                      onClick={() => void action(person.id, "reject")}
                    >
                      <X size={17} />
                    </Button>
                  </>
                ) : (
                  <FollowButton person={person} busy={busy} action={action} />
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!!busy}
                  aria-label={`${person.name} blockieren`}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Person blockieren?",
                        text: "Follow-Beziehungen und Anfragen werden entfernt. Ihr seht gegenseitig keine Community-Inhalte.",
                        label: "Blockieren",
                        danger: true,
                      })
                    )
                      await action(person.id, "block");
                  }}
                >
                  <ShieldBan size={17} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SocialEntries({
  person,
  profile,
}: {
  person?: string;
  profile?: boolean;
}) {
  const { identity } = useStore();
  const [view, setView] = useState<"grid" | "timeline">("grid"),
    [milestones, setMilestones] = useState(false),
    [reader, setReader] = useState<string | null>(null),
    [photo, setPhoto] = useState<string | null>(null);
  const feed = useInfiniteQuery({
    queryKey: ["community", "feed", identity?.id, person, milestones],
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase().rpc("community_feed", {
        person: person ?? null,
        page_size: PAGE_SIZE,
        only_milestones: milestones,
        ...(pageParam ?? {}),
      });
      if (error) throw error;
      return communityEntrySchema.array().parse(data);
    },
    getNextPageParam: (last) => {
      if (last.length < PAGE_SIZE) return undefined;
      const entry = last[last.length - 1];
      return {
        before_date: entry.date,
        before_created_at: entry.created_at,
        before_id: entry.id,
      };
    },
  });
  const detail = useQuery({
    queryKey: ["community", "entry", identity?.id, reader],
    enabled: !!reader,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_entry", {
        entry_id: reader,
      });
      if (error) throw error;
      return communityEntrySchema.nullable().parse(data);
    },
  });
  const all = feed.data?.pages.flat() ?? [],
    entries = milestones ? all.filter((entry) => entry.milestone) : all;
  return (
    <>
      {profile && (
        <div className="journal-toolbar public-entry-toolbar">
          <div className="journal-tabs">
            <button
              className={!milestones ? "active" : ""}
              aria-pressed={!milestones}
              onClick={() => setMilestones(false)}
            >
              Alle Einträge
            </button>
            <button
              className={milestones ? "active" : ""}
              aria-pressed={milestones}
              onClick={() => setMilestones(true)}
            >
              <Star size={14} />
              Meilensteine
            </button>
          </div>
          <div className="view-switch" role="group" aria-label="Profilansicht">
            <button
              aria-label="Kachelansicht"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              aria-label="Timeline"
              aria-pressed={view === "timeline"}
              onClick={() => setView("timeline")}
            >
              <List size={17} />
            </button>
          </div>
        </div>
      )}
      {feed.isLoading ? (
        <div className="feed-loading" role="status">
          Erinnerungen werden geladen …
        </div>
      ) : feed.error && !all.length ? (
        <div role="alert" className="error-message">
          <p>
            Der Feed konnte nicht geladen werden. Bitte prüfe deine Verbindung.
          </p>
          <Button variant="outline" onClick={() => void feed.refetch()}>
            Erneut laden
          </Button>
        </div>
      ) : !entries.length ? (
        <Empty
          title={
            milestones
              ? "Noch keine sichtbaren Meilensteine."
              : "Hier ist Platz für Geschichten."
          }
          text="Du siehst nur Einträge, die für dich freigegeben sind."
        />
      ) : (
        <EntryCollection
          entries={entries}
          view={profile ? view : "cards"}
          feed
          onOpen={(entry) => setReader(entry.id)}
          renderPhoto={(id, alt) => (
            <img src={`/api/community/media/${id}`} alt={alt} loading="lazy" />
          )}
          renderHeader={(entry) => (
            <header className="social-author">
              <Link
                href={profileHref(entry.owner_id)}
                onClick={rememberProfileNavigation}
              >
                <CommunityAvatar
                  id={entry.owner_id}
                  name={entry.name}
                  avatarId={entry.avatar_id}
                />
                <span>
                  <strong>{entry.name}</strong>
                  {entry.username && <small>@{entry.username}</small>}
                </span>
              </Link>
              {(entry.rank_id || entry.branch_id) && (
                <span className="social-author-detail">
                  {entry.rank_id
                    ? catalogLabel(ranks, entry.rank_id)
                    : catalogLabel(branches, entry.branch_id)}
                </span>
              )}
            </header>
          )}
        />
      )}
      {feed.hasNextPage && (
        <div className="load-more">
          <Button
            variant="outline"
            disabled={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage
              ? "Wird geladen …"
              : "Weitere Einträge laden"}
          </Button>
        </div>
      )}
      {feed.isFetchNextPageError && (
        <p role="alert">
          Weitere Einträge konnten nicht geladen werden. Bitte versuche es
          erneut.
        </p>
      )}
      {reader && (
        <Modal
          open
          wide
          title={
            detail.data ? readableTitle(detail.data) : "Freigegebener Eintrag"
          }
          onOpenChange={(open) => {
            if (!open) {
              setReader(null);
              setPhoto(null);
            }
          }}
        >
          {detail.isLoading ? (
            <p role="status">Eintrag wird geladen …</p>
          ) : detail.error ? (
            <div role="alert">
              <p>Der Eintrag konnte nicht geladen werden.</p>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                Erneut laden
              </Button>
            </div>
          ) : !detail.data ? (
            <p>Dieser Eintrag ist nicht mehr freigegeben.</p>
          ) : (
            <article className="reader">
              <Link
                className="reader-author"
                href={profileHref(detail.data.owner_id)}
                onClick={() => setReader(null)}
              >
                {detail.data.name}
              </Link>
              <h2>{detail.data.subtitle || "Ein Tag, der bleibt."}</h2>
              {detail.data.milestone && (
                <p className="milestone-label">
                  <Star size={16} />
                  Meilenstein
                </p>
              )}
              <div className="reader-photos">
                {detail.data.media_ids.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => setPhoto(id)}
                    aria-label={`Foto ${i + 1} vergrössern`}
                  >
                    <img
                      src={`/api/community/media/${id}`}
                      alt={`Freigegebenes Foto ${i + 1}`}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              <FormattedText text={detail.data.content} />
            </article>
          )}
        </Modal>
      )}
      {photo && (
        <Modal
          open
          wide
          title="Freigegebenes Foto"
          onOpenChange={(open) => {
            if (!open) setPhoto(null);
          }}
        >
          <img
            className="public-gallery-photo"
            src={`/api/community/media/${photo}`}
            alt="Vergrössertes Tagebuchfoto"
          />
          <div className="actions">
            {detail.data?.media_ids.map((id, i) => (
              <Button
                key={id}
                variant="outline"
                aria-pressed={id === photo}
                onClick={() => setPhoto(id)}
              >
                Foto {i + 1}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function PublicProfile({ person }: { person: string }) {
  const router = useRouter(),
    canGoBack = useRef(navigatedToProfile);
  useEffect(() => {
    navigatedToProfile = false;
  }, [person]);
  const { identity } = useStore(),
    { busy, action } = useCommunityActions();
  const [connections, setConnections] = useState<
    "followers" | "following" | null
  >(null);
  const profile = useQuery({
    queryKey: ["community", "profile", identity?.id, person],
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_profile", {
        person,
      });
      if (error) throw error;
      return communityProfileSchema.nullable().parse(data);
    },
  });
  const list = useQuery({
    queryKey: ["community", "connections", identity?.id, person, connections],
    enabled: !!connections,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_connections", {
        person,
        kind: connections,
      });
      if (error) throw error;
      return communityPersonSchema.array().parse(data);
    },
  });
  const p = profile.data;
  return (
    <>
      <Button asChild variant="ghost">
        <Link
          href="/community"
          onClick={(event) => {
            if (canGoBack.current) {
              event.preventDefault();
              router.back();
            }
          }}
        >
          <ArrowLeft size={16} />
          Zurück zur Community
        </Link>
      </Button>
      {profile.isLoading ? (
        <p role="status">Profil wird geladen …</p>
      ) : profile.error ? (
        <div role="alert">
          <p>Das Profil konnte nicht geladen werden.</p>
          <Button variant="outline" onClick={() => void profile.refetch()}>
            Erneut laden
          </Button>
        </div>
      ) : !p ? (
        <Empty
          title="Dieses Profil ist nicht verfügbar."
          text="Die Person hat ihr Profil nicht freigegeben oder ist nicht erreichbar."
        />
      ) : (
        <>
          <section className="public-profile-summary">
            <div className="public-person">
              <CommunityAvatar id={p.id} name={p.name} avatarId={p.avatar_id} />
              <div>
                <p className="eyebrow">Freigegebene Erinnerungen</p>
                <h1>{p.name}</h1>
                {p.username && <p>@{p.username}</p>}
              </div>
            </div>
            <div className="public-military">
              {p.rank_id && (
                <span>
                  <Shield size={15} aria-label="Neutrales Dienstgradsymbol" />
                  {catalogLabel(ranks, p.rank_id)}
                </span>
              )}
              {p.branch_id && (
                <span>
                  <BranchInsignia id={p.branch_id} />
                  {catalogLabel(branches, p.branch_id)}
                </span>
              )}
              {p.function_id && (
                <span>{catalogLabel(functions, p.function_id)}</span>
              )}
            </div>
            <div className="profile-counts">
              <div>
                <strong>{p.entry_count}</strong>
                <span>Sichtbare Einträge</span>
              </div>
              <div>
                <strong>{p.milestone_count}</strong>
                <span>Meilensteine</span>
              </div>
              {p.followers !== null && (
                <button onClick={() => setConnections("followers")}>
                  <strong>{p.followers}</strong>
                  <span>Follower</span>
                </button>
              )}
              {p.following_count !== null && (
                <button onClick={() => setConnections("following")}>
                  <strong>{p.following_count}</strong>
                  <span>Gefolgt</span>
                </button>
              )}
            </div>
            <FollowButton person={p} busy={busy} action={action} />
            {p.private_profile && (
              <p className="fineprint">
                Follow-Anfragen werden bestätigt. Private Einträge bleiben
                privat.
              </p>
            )}
            {p.periods.length > 0 && (
              <div className="public-periods">
                {p.periods.map((period) => (
                  <p key={period.id}>
                    <strong>{period.type}</strong> ·{" "}
                    {dateLabel(period.start_date)} –{" "}
                    {dateLabel(period.end_date)}
                  </p>
                ))}
              </div>
            )}
          </section>
          <SocialEntries person={person} profile />
        </>
      )}
      {connections && (
        <Modal
          open
          title={connections === "followers" ? "Follower" : "Gefolgte Benutzer"}
          onOpenChange={(open) => {
            if (!open) setConnections(null);
          }}
        >
          {list.isLoading ? (
            <p role="status">Wird geladen …</p>
          ) : list.error ? (
            <p role="alert">Die Liste konnte nicht geladen werden.</p>
          ) : !list.data?.length ? (
            <p>Keine freigegebenen Verbindungen.</p>
          ) : (
            <div className="people-list">
              {list.data.map((person) => (
                <article key={person.id}>
                  <PersonLink
                    person={person}
                    onNavigate={() => setConnections(null)}
                  />
                  <FollowButton person={person} busy={busy} action={action} />
                </article>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export function Community({ profileId }: { profileId?: string }) {
  const { identity } = useStore();
  const [panel, setPanel] = useState<Panel | null>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const requests = useQuery({
    queryKey: ["community", "requests", identity?.id],
    enabled: identity?.mode === "cloud",
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_requests");
      if (error) throw error;
      return communityPersonSchema.array().parse(data);
    },
  });
  if (identity?.mode !== "cloud")
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
        <Empty
          title="Eine Verbindung braucht ein Konto."
          text="Die Community verwendet Supabase-Konten und bestätigte Freigaben. Dein lokales Tagebuch bleibt auf diesem Gerät."
        />
      </>
    );
  if (profileId) return <PublicProfile key={profileId} person={profileId} />;
  const titles = {
    menu: "Community-Menü",
    people: "Leute finden",
    requests: "Follow-Anfragen",
    followers: "Follower",
    following: "Gefolgte Benutzer",
  };
  function close() {
    setPanel(null);
    requestAnimationFrame(() => menuButton.current?.focus());
  }
  return (
    <>
      <div className="page-heading community-heading">
        <div>
          <p className="eyebrow">Gemeinsam erinnern</p>
          <h1>
            Community<span className="heading-dot">.</span>
          </h1>
        </div>
        <Button
          ref={menuButton}
          size="icon"
          variant="outline"
          aria-label={`Community-Menü${requests.data?.length ? `, ${requests.data.length} neue Follow-Anfragen` : ""}`}
          aria-haspopup="dialog"
          aria-expanded={panel !== null}
          onClick={() => setPanel("menu")}
        >
          <Menu size={20} />
          {!!requests.data?.length && (
            <span className="request-count">{requests.data.length}</span>
          )}
        </Button>
      </div>
      <SocialEntries />
      {panel && (
        <Modal
          open
          title={titles[panel]}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <CommunityPanel panel={panel} setPanel={setPanel} close={close} />
        </Modal>
      )}
    </>
  );
}
