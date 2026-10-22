"use client";
import { useEffect, useState, useCallback } from "react";
import { BookReader, type ReadingData } from "./book-reader";
import { Button, Field } from "./ui";
export function PublicReader({ token }: { token: string }) {
  const [data, setData] = useState<ReadingData | null>(null),
    [password, setPassword] = useState(""),
    [locked, setLocked] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async (password?: string) => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/public/${token}`,
          password
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
                cache: "no-store",
              }
            : { cache: "no-store" },
        );
        const result = await response.json();
        if (response.status === 401) {
          setLocked(true);
          if (password) setError("Das Passwort stimmt nicht.");
          return;
        }
        if (!response.ok) throw new Error(result.error);
        setData(result);
        setLocked(false);
        setError("");
      } catch {
        setError(
          "Diese Freigabe ist nicht verfügbar oder wurde zurückgezogen.",
        );
      } finally {
        setBusy(false);
      }
    },
    [token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (data) return <BookReader data={data} />;
  return (
    <main className="public-gate">
      <p className="eyebrow">Memento / Persönliche Erinnerungen</p>
      <h1>
        {locked
          ? "Eine persönliche Geschichte."
          : busy
            ? "Das Journal wird geöffnet."
            : "Dieser Einblick ist geschlossen."}
      </h1>
      {locked ? (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void load(password);
          }}
        >
          <p>Dieses Journal ist mit einem Passwort geschützt.</p>
          <Field label="Freigabepasswort">
            <input
              type="password"
              required
              value={password}
              maxLength={128}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button disabled={busy}>Journal öffnen</Button>
        </form>
      ) : null}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
