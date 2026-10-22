/** Shared wordmark. Icon palette intentionally stays neutral across branch themes. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <img
        src="/logo.svg"
        className="brand-icon"
        width={36}
        height={36}
        alt={compact ? "Memento" : ""}
      />
      {!compact && <span className="brand-wordmark">Memento</span>}
    </span>
  );
}
