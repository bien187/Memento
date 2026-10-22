"use client";
import { useEffect, useId, useState } from "react";
import { MapPin, Shield, Grid2X2 } from "lucide-react";
import {
  branches,
  functionGroups,
  functions,
  functionTeam,
} from "@/lib/domain/catalogs";
import {
  barracks,
  barracksForFunction,
  barracksSource,
} from "@/lib/domain/barracks";
import { insigniaForBranch } from "@/lib/domain/insignia";
import { Button, Field, Modal } from "./ui";

export function BranchInsignia({
  id,
  className = "",
}: {
  id: string | null;
  className?: string;
}) {
  const name =
    branches.find(([key]) => key === id)?.[1] ?? "Truppengattung noch offen";
  const asset = insigniaForBranch(id);
  return asset ? (
    <img
      className={`branch-insignia ${className}`}
      src={asset.path}
      alt={`Abzeichen ${name}${id === "seelsorge" ? " (christliche Variante)" : ""}`}
      width={36}
      height={50}
    />
  ) : (
    <span
      className={`branch-insignia-placeholder ${className}`}
      title="Neutrales Ersatzsymbol, kein militärisches Abzeichen"
      aria-label={`${name}: neutrales Ersatzsymbol`}
    >
      <Shield size={22} />
    </span>
  );
}

export function CatalogField({
  label,
  value,
  onChange,
  catalog,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  catalog: readonly (readonly [string, string])[];
}) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  return (
    <Field label={label}>
      <input
        list={id}
        value={catalog.find(([key]) => key === value)?.[1] ?? query ?? ""}
        placeholder="Suchen oder noch offen lassen"
        onChange={(e) => {
          const match = catalog.find(([, name]) => name === e.target.value);
          setQuery(match ? null : e.target.value);
          onChange(match?.[0] ?? null);
        }}
      />
      <datalist id={id}>
        {catalog.map(([key, name]) => (
          <option key={key} value={name} />
        ))}
      </datalist>
    </Field>
  );
}
export function FunctionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [team, setTeam] = useState("");
  const selected = functionTeam(value);
  const options = team
    ? functionGroups.find((group) => group.id === team)!.functions
    : functions;
  return (
    <div className="function-picker">
      <Field label="Funktionsteam">
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Alle Teams · 125 Funktionen</option>
          {functionGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} · {group.functions.length}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={label}
        hint={selected ? selected.name : "Funktion suchen oder offen lassen."}
      >
        <input
          list={id}
          value={functions.find(([key]) => key === value)?.[1] ?? query ?? ""}
          placeholder="Funktion suchen …"
          onChange={(e) => {
            const match = functions.find(([, name]) => name === e.target.value);
            setQuery(match ? null : e.target.value);
            onChange(match?.[0] ?? null);
          }}
        />
        <datalist id={id}>
          {options.map(([key, name]) => (
            <option key={key} value={name} label={functionTeam(key)?.name} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}
export function BarracksField({
  functionId,
  value,
  onChange,
}: {
  functionId: string | null;
  value?: string | null;
  onChange: (id: string | null) => void;
}) {
  const suggestions = barracksForFunction(functionId);
  const selected = barracks.find((location) => location.id === value);
  const defaultId = suggestions[0]?.id;
  useEffect(() => {
    if (value === undefined && defaultId) onChange(defaultId);
  }, [value, defaultId, onChange]);
  const alternatives = barracks.filter(
    (location) =>
      !suggestions.some((suggestion) => suggestion.id === location.id),
  );
  return (
    <div className="barracks-picker">
      <Field
        label="Kaserne / Standort (privat)"
        hint={
          suggestions.length
            ? `${suggestions.length > 1 ? "Mehrere Standorte möglich. " : ""}Vorschlag anhand der Funktion – bitte mit deinem Aufgebot abgleichen. Du kannst ihn ändern oder entfernen.`
            : "Keine automatische Zuordnung hinterlegt. Du kannst einen Standort selbst auswählen oder offen lassen."
        }
      >
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Noch offen</option>
          {suggestions.length > 0 && (
            <optgroup label="Passend zur Funktion">
              {suggestions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.canton})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup
            label={suggestions.length ? "Weitere Standorte" : "Alle Standorte"}
          >
            {alternatives.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.canton})
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      {selected && (
        <p className="barracks-school">
          <MapPin size={16} aria-hidden="true" />
          <span>{selected.school}</span>
        </p>
      )}
      <a
        className="catalog-source"
        href={barracksSource}
        target="_blank"
        rel="noreferrer"
      >
        Offizielles Schulverzeichnis
      </a>
    </div>
  );
}
export function BranchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [gallery, setGallery] = useState(false);
  return (
    <div className="branch-picker">
      <CatalogField
        label={label}
        catalog={branches}
        value={value}
        onChange={onChange}
      />
      <div className="branch-preview">
        <BranchInsignia id={value} />
        <span>
          {branches.find(([key]) => key === value)?.[1] ?? "Noch offen"}
          {value === "seelsorge" && (
            <small>Abgebildet: christliche Variante</small>
          )}
          {value === "sozialdienst" && <small>Neutrales Ersatzsymbol</small>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => setGallery(true)}
        >
          <Grid2X2 size={16} />
          Alle Abzeichen
        </Button>
      </div>
      <a
        className="catalog-source"
        href="/insignia/NOTICE.txt"
        target="_blank"
        rel="noreferrer"
      >
        Bildquellen und Lizenzen
      </a>
      {gallery && (
        <Modal
          title="Truppengattungen & Dienstzweige"
          description="Wähle deine Truppengattung. Funktion und Dienstgrad bleiben davon unabhängig."
          open
          onOpenChange={setGallery}
          wide
        >
          <div className="insignia-grid">
            {branches.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-label={name}
                aria-pressed={id === value}
                onClick={() => {
                  onChange(id);
                  setGallery(false);
                }}
              >
                <BranchInsignia id={id} />
                <span>{name}</span>
                {id === "sozialdienst" && <small>Neutrales Ersatzsymbol</small>}
                {id === "seelsorge" && <small>Christliche Variante</small>}
              </button>
            ))}
          </div>
          <p className="muted insignia-credit">
            SVG-Darstellungen: Magnum045 / Wikimedia Commons ·{" "}
            <a href="/insignia/NOTICE.txt" target="_blank" rel="noreferrer">
              CC BY-SA 4.0, Quellen
            </a>
          </p>
        </Modal>
      )}
    </div>
  );
}
