/** Horizontal gradient score bar with a position marker (0–10). */
export function ScoreBar({
  score,
  label,
  invert = false,
}: {
  score: number;
  label?: string;
  /** invert: low score = good (risk), default: high score = good (quality) */
  invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const gradient = invert
    ? "linear-gradient(90deg,#22c55e,#eab308,#f97316,#ef4444)"
    : "linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e)";
  return (
    <div>
      <div className="relative h-2.5 rounded-full" style={{ background: gradient }}>
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
      {label && (
        <div className="mt-1.5 text-right text-xs font-medium text-amber-300">
          {label}
        </div>
      )}
    </div>
  );
}

/** Delta gauge 0–0.50 with a highlighted sweet-spot band. */
export function DeltaGauge({ delta }: { delta: number }) {
  const max = 0.5;
  const pct = Math.max(0, Math.min(100, (delta / max) * 100));
  const sweetLo = (0.1 / max) * 100;
  const sweetHi = (0.25 / max) * 100;
  return (
    <div>
      <div className="relative h-14 rounded-lg border bg-muted/30 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/25"
          style={{ left: `${sweetLo}%`, width: `${sweetHi - sweetLo}%` }}
        />
        <div
          className="absolute top-1 bottom-1 w-1 rounded bg-white shadow"
          style={{ left: `calc(${pct}% - 2px)` }}
        />
        <div
          className="absolute -top-0 text-[10px] text-muted-foreground"
          style={{ left: `calc(${pct}% + 4px)` }}
        >
          Δ{delta.toFixed(2)}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Too Cheap 0.00</span>
        <span className="text-emerald-400">Sweet Spot 0.10–0.25</span>
        <span>Too Aggressive 0.50</span>
      </div>
    </div>
  );
}
