"use client";
import { ArrowUpRight, FlaskConical, RotateCcw } from "lucide-react";
import { PORTFOLIO_URL } from "@/lib/demo/mode";
import { useStore } from "./store";
/** Quiet notice shown on every demo page. */
export function DemoBanner() {
  const { resetDemo } = useStore();
  return (
    <div className="demo-banner" role="note" aria-label="Demo-Hinweis">
      <FlaskConical size={15} aria-hidden />
      <p>
        <strong>Memento-Demo.</strong> Alle Einträge und Angaben sind fiktive
        Testdaten. Änderungen bleiben nur in dieser Demo und werden beim
        Neuladen zurückgesetzt.
      </p>
      <div className="demo-banner-actions">
        <button type="button" onClick={() => void resetDemo()}>
          <RotateCcw size={13} aria-hidden />
          Zurücksetzen
        </button>
        {PORTFOLIO_URL && (
          <a href={PORTFOLIO_URL} rel="noopener">
            Zum Portfolio
            <ArrowUpRight size={13} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
