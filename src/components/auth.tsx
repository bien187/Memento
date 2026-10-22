"use client";
import { Brand } from "./brand";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUpRight,
  BookOpen,
  LockKeyhole,
  ArrowRight,
  Check,
} from "lucide-react";
import { useStore } from "./store";
import { Button, Field, useToast } from "./ui";
import { cloudConfigured, supabase } from "@/lib/supabase/browser";
import {
  baseRecord,
  profileSchema,
  periodSchema,
  type Profile,
  type Period,
} from "@/lib/domain/models";
import {
  CatalogField,
  FunctionField,
  BarracksField,
  BranchField,
} from "./military-fields";
import { ranks } from "@/lib/domain/catalogs";
import { suggestedBarracks } from "@/lib/domain/barracks";
import { today, addDays } from "@/lib/domain/dates";
import { message } from "@/lib/utils";
const authSchema = z.object({
  email: z.email("Gültige E-Mail erforderlich"),
  password: z.string().min(12, "Mindestens 12 Zeichen verwenden"),
});
export function Auth() {
  const { enterLocal } = useStore(),
    toast = useToast();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
  });
  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      const client = supabase();
      const { data, error } = register
        ? await client.auth.signUp({
            ...values,
            options: { emailRedirectTo: `${location.origin}/auth/callback` },
          })
        : await client.auth.signInWithPassword(values);
      if (error) throw error;
      if (register && !data.session)
        toast(
          "Bitte bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden.",
        );
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  });
  async function oauth(provider: "google" | "apple") {
    try {
      const { error } = await supabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      toast(message(e));
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/">
          <Brand />
        </a>
        <div>
          <p className="eyebrow">Dein persönliches Militärtagebuch</p>
          <h1>
            Deine Dienstzeit.
            <br />
            Deine Geschichte.
          </h1>
          <p>
            Für die Tage, die dich prägen.
            <br />
            Und die Erinnerungen, die bleiben.
          </p>
          <div className="story-rule" />
          <p className="small-caps">Festhalten · Zurückblicken · Bewahren</p>
        </div>
        <p className="auth-foot">
          <LockKeyhole size={14} /> Privat beginnt bei dir.
        </p>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <p className="eyebrow">Willkommen bei Memento</p>
          <h2>
            {register ? "Deine Geschichte beginnt." : "Schön, dass du da bist."}
          </h2>
          <p className="muted">
            {register
              ? "Erstelle dein persönliches Konto."
              : "Öffne dein Tagebuch und schreib weiter."}
          </p>
          <form onSubmit={submit} className="form-stack">
            <Field label="E-Mail" error={form.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Passwort"
              error={form.formState.errors.password?.message}
            >
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                {...form.register("password")}
              />
            </Field>
            <Button disabled={!cloudConfigured || busy} type="submit">
              {busy
                ? "Einen Moment …"
                : register
                  ? "Konto erstellen"
                  : "Anmelden"}
              <ArrowRight size={18} />
            </Button>
          </form>
          {cloudConfigured ? (
            <>
              <div className="oauth-row">
                {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
                  <Button
                    variant="outline"
                    onClick={() => void oauth("google")}
                  >
                    Mit Google
                  </Button>
                )}
                {process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true" && (
                  <Button variant="outline" onClick={() => void oauth("apple")}>
                    Mit Apple
                  </Button>
                )}
              </div>
              <button
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Bereits ein Konto? Anmelden"
                  : "Noch kein Konto? Registrieren"}
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  const email = form.getValues("email");
                  if (!email)
                    return toast("Bitte zuerst deine E-Mail eingeben.");
                  const { error } = await supabase().auth.resetPasswordForEmail(
                    email,
                    {
                      redirectTo: `${location.origin}/auth/callback?recovery=1`,
                    },
                  );
                  toast(
                    error
                      ? error.message
                      : "Wenn ein Konto besteht, erhältst du eine E-Mail zum Zurücksetzen.",
                  );
                }}
              >
                Passwort vergessen
              </button>
            </>
          ) : (
            <p className="setup-note">
              Cloud-Anmeldung ist noch nicht eingerichtet. Du kannst dein
              Tagebuch bereits lokal auf diesem Gerät führen. Einrichtung:
              DEPLOYMENT.md.
            </p>
          )}
          <div className="local-options">
            <Button
              variant="outline"
              onClick={() => void enterLocal().catch((e) => toast(message(e)))}
            >
              Lokales Tagebuch öffnen
              <ArrowUpRight size={16} />
            </Button>
            <button
              className="text-button"
              onClick={() =>
                void enterLocal(true).catch((e) => toast(message(e)))
              }
            >
              Mit fiktivem Beispiel entdecken <ArrowRight size={14} />
            </button>
            <small>
              Lokale Daten bleiben in diesem Browser. Regelmässig ein Backup
              exportieren.
            </small>
          </div>
        </div>
      </section>
    </main>
  );
}
export function ProfileFields({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (v: Profile) => void;
}) {
  return (
    <>
      <Field label="Vollständiger Name">
        <input
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </Field>
      <Field
        label="Öffentlicher Benutzername (optional)"
        hint="3–30 Zeichen: Kleinbuchstaben, Zahlen und Unterstrich"
      >
        <input
          value={value.username ?? ""}
          onChange={(e) =>
            onChange({ ...value, username: e.target.value || null })
          }
          pattern="[a-z0-9_]{3,30}"
        />
      </Field>
      <CatalogField
        label="Dienstgrad"
        catalog={ranks}
        value={value.rank_id}
        onChange={(rank_id) => onChange({ ...value, rank_id })}
      />
      <FunctionField
        label="Grundfunktion"
        value={value.function_id}
        onChange={(function_id) =>
          onChange({
            ...value,
            function_id,
            barracks_id: suggestedBarracks(function_id, value.barracks_id),
          })
        }
      />
      <BarracksField
        functionId={value.function_id}
        value={value.barracks_id}
        onChange={(barracks_id) => onChange({ ...value, barracks_id })}
      />
      <BranchField
        label="Truppengattung / Dienstzweig"
        value={value.branch_id}
        onChange={(branch_id) => onChange({ ...value, branch_id })}
      />
      <Field label="Einheit / Verband (privat)">
        <input
          maxLength={100}
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value })}
        />
      </Field>
    </>
  );
}
export function PeriodFields({
  value,
  onChange,
}: {
  value: Period;
  onChange: (v: Period) => void;
}) {
  return (
    <>
      <Field label="Art der Dienstperiode">
        <select
          value={value.type}
          onChange={(e) =>
            onChange({ ...value, type: e.target.value as Period["type"] })
          }
        >
          {["RS", "WK", "UOS", "OS", "Andere"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Titel">
        <input
          required
          minLength={2}
          maxLength={120}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <div className="form-pair">
        <Field label="Beginn">
          <input
            type="date"
            required
            value={value.start_date}
            onChange={(e) => onChange({ ...value, start_date: e.target.value })}
          />
        </Field>
        <Field label="Ende">
          <input
            type="date"
            required
            min={value.start_date}
            value={value.end_date}
            onChange={(e) => onChange({ ...value, end_date: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Einheit / Verband">
        <input
          maxLength={100}
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value })}
        />
      </Field>
      <CatalogField
        label="Dienstgrad in dieser Periode"
        catalog={ranks}
        value={value.rank_id}
        onChange={(rank_id) => onChange({ ...value, rank_id })}
      />
      <FunctionField
        label="Funktion in dieser Periode"
        value={value.function_id}
        onChange={(function_id) =>
          onChange({
            ...value,
            function_id,
            barracks_id: suggestedBarracks(function_id, value.barracks_id),
          })
        }
      />
      <BarracksField
        functionId={value.function_id}
        value={value.barracks_id}
        onChange={(barracks_id) => onChange({ ...value, barracks_id })}
      />
      <BranchField
        label="Truppengattung in dieser Periode"
        value={value.branch_id}
        onChange={(branch_id) => onChange({ ...value, branch_id })}
      />
    </>
  );
}
export function newPeriod(owner: string, profile?: Profile): Period {
  return {
    ...baseRecord(owner),
    type: "RS",
    title: "Meine Rekrutenschule",
    start_date: today(),
    end_date: addDays(today(), 125),
    unit: profile?.unit ?? "",
    rank_id: profile?.rank_id ?? null,
    function_id: profile?.function_id ?? null,
    branch_id: profile?.branch_id ?? null,
    barracks_id: profile?.barracks_id ?? null,
  };
}
export function Onboarding() {
  const { identity, save, setPreferences } = useStore(),
    toast = useToast();
  const [step, setStep] = useState(0),
    [skip, setSkip] = useState(false),
    [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => ({
    ...baseRecord(identity!.id, identity!.id),
    name: "",
    username: null,
    rank_id: null,
    function_id: null,
    branch_id: null,
    barracks_id: null,
    unit: "",
    discoverable: false,
    private_profile: true,
    avatar_id: null,
  }));
  const [period, setPeriod] = useState(() => newPeriod(identity!.id));
  async function finish() {
    setBusy(true);
    try {
      profileSchema.parse(profile);
      if (!skip) periodSchema.parse(period);
      if (!skip) {
        await save("service_periods", period);
        await setPreferences({ active_period_id: period.id });
      }
      await save("profiles", profile);
      toast("Dein Memento ist bereit.");
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="onboarding">
      <a className="brand" href="/">
        <Brand />
      </a>
      <div className="onboarding-card">
        <p className="eyebrow">Dein Memento / {step + 1} von 3</p>
        <div className="step-track">
          {[0, 1, 2].map((s) => (
            <span key={s} className={s <= step ? "active" : ""} />
          ))}
        </div>
        <h1>
          {
            [
              "Ein paar Worte zu dir.",
              "Dein nächstes Kapitel.",
              "Deine Erinnerungen gehören dir.",
            ][step]
          }
        </h1>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 0) {
              const parsed = profileSchema.safeParse(profile);
              if (!parsed.success) return toast(parsed.error.issues[0].message);
              setPeriod((p) => ({
                ...p,
                rank_id: profile.rank_id,
                function_id: profile.function_id,
                branch_id: profile.branch_id,
                barracks_id: profile.barracks_id ?? null,
                unit: profile.unit,
              }));
            }
            if (step < 2) {
              if (step === 1 && !skip) {
                const parsed = periodSchema.safeParse(period);
                if (!parsed.success)
                  return toast(parsed.error.issues[0].message);
              }
              setStep(step + 1);
            } else void finish();
          }}
        >
          {step === 0 && (
            <ProfileFields value={profile} onChange={setProfile} />
          )}
          {step === 1 && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={skip}
                  onChange={(e) => setSkip(e.target.checked)}
                />{" "}
                Ich bin noch nicht eingerückt. Dienstperiode später erfassen.
              </label>
              {!skip && <PeriodFields value={period} onChange={setPeriod} />}
            </>
          )}
          {step === 2 && (
            <div className="privacy-intro">
              <LockKeyhole size={32} />
              <p>
                Neue Einträge sind privat. Du entscheidest für jeden Eintrag, ob
                du ihn später teilst.
              </p>
              <p>
                Funktion und Dienstgrad dürfen offen bleiben. Du kannst alles
                jederzeit im Profil anpassen.
              </p>
              {identity?.mode !== "cloud" && (
                <p>
                  Dieses lokale Tagebuch wird auf diesem Gerät gespeichert. Ein
                  ZIP-Backup schützt deine Erinnerungen beim Browserwechsel.
                </p>
              )}
              <p className="muted">
                Bitte keine klassifizierten Informationen oder unzulässigen
                Aufnahmen erfassen.
              </p>
            </div>
          )}
          <div className="actions">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
              >
                Zurück
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {step === 2 ? "Tagebuch öffnen" : "Weiter"}
              {step === 2 ? <Check size={18} /> : <ArrowRight size={18} />}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
