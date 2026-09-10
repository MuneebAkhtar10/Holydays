export function PageLoader({ label = "Loading", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={compact ? "grid place-items-center py-20" : "grid min-h-[70vh] place-items-center px-5 py-16"}>
      <LoaderMark label={label} />
    </div>
  );
}

export function LoaderOverlay({ show, label = "Updating" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/72 backdrop-blur-sm" aria-live="polite" aria-busy>
      <LoaderMark label={label} />
    </div>
  );
}

export function LoaderMark({ label }: { label: string }) {
  return (
    <div className="serai-loader flex flex-col items-center gap-5">
      <div className="relative h-20 w-20">
        <span className="serai-ring serai-ring-outer" />
        <span className="serai-ring serai-ring-mid" />
        <span className="serai-ring serai-ring-inner" />
        <span className="serai-dot" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-brass">{label}</p>
    </div>
  );
}
