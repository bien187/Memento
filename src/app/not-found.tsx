import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <p className="eyebrow">404 / Memento</p>
      <h1>Diese Seite fehlt.</h1>
      <Link href="/">Zurück zum Tagebuch</Link>
    </main>
  );
}
