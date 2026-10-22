"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">Memento</p>
      <h1>Etwas hat nicht geklappt.</h1>
      <p>Deine lokal gespeicherten Einträge bleiben erhalten.</p>
      <button className="button button-primary" onClick={reset}>
        Erneut versuchen
      </button>
    </main>
  );
}
