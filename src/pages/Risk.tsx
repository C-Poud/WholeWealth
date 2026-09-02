import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBar } from "@/components/Gauges";
import { fmtMoney, fmtPct } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

function scoreLabel(s: number): string {
  if (s < 4) return `${s.toFixed(1)} Low`;
  if (s < 6) return `${s.toFixed(1)} Moderate`;
  if (s < 8) return `${s.toFixed(1)} Elevated`;
  return `${s.toFixed(1)} High`;
}

export default function Risk() {
  const { data, isLoading, error, refetch } = trpc.analytics.riskReports.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const current = reports.find((r) => r.symbol === selected) ?? reports[0];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-10 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-12 w-80 bg-white/5" />
        <Skeleton className="h-10 w-72 bg-white/5" />
        <Skeleton className="h-80 bg-white/5" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f0f0f2] leading-tight">
            Extreme Risk Detection
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Expected-move ranges derived from implied volatility, plus portfolio
            concentration risk. Total portfolio value{" "}
            <span className="font-mono text-white font-bold">{fmtMoney(data?.portfolioValue)}</span>.
          </p>
        </div>
        {data?.mode === "demo" && (
          <div className="neon-badge shrink-0 self-start md:self-auto">
            Demo market data
          </div>
        )}
        {data?.mode === "yahoo" && (
          <div className="neon-badge shrink-0 self-start md:self-auto">
            Real quotes · 15 min delay
          </div>
        )}
      </header>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-sm text-destructive font-mono">
            Failed to load risk analysis: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono underline text-foreground hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="panel-card py-20 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground stroke-1" />
          <p className="text-xl font-display font-bold">No positions to analyse</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Add positions on the Portfolio page to see expected-move and
            outlier-risk analysis.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Select Position
            </div>
            <Select value={current?.symbol} onValueChange={setSelected}>
              <SelectTrigger className="w-full max-w-md bg-[#141417] border-white/10 font-mono text-sm">
                <SelectValue placeholder="Choose a symbol" />
              </SelectTrigger>
              <SelectContent className="bg-[#141417] border-white/10 font-mono text-sm">
                {reports.map((r) => (
                  <SelectItem key={r.symbol} value={r.symbol}>
                    {r.symbol} · {fmtPct(r.portfolioWeight, 1)} of portfolio
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && (
            <div className="panel-card p-6 sm:p-8 space-y-6">
              <div className="flex items-baseline justify-between flex-wrap gap-2 border-b border-white/10 pb-4">
                <div className="font-display font-bold text-xl text-white">
                  Extreme Risk Detection: {current.symbol}
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  IV Regime:{" "}
                  <span className="text-white font-bold">
                    {current.iv30 != null
                      ? `${(current.iv30 * 100).toFixed(1)}%`
                      : "unavailable"}
                  </span>{" "}
                  · Weight{" "}
                  <span className="text-white font-bold">
                    {fmtPct(current.portfolioWeight, 1)}
                  </span>
                </div>
              </div>

              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Risk Score
                </div>
                <ScoreBar
                  score={current.riskScore}
                  invert
                  label={scoreLabel(current.riskScore)}
                />
              </div>

              {current.lower2 != null ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center">
                      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        −2σ Boundary
                      </div>
                      <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-white">
                        {fmtMoney(current.lower2)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary p-5 text-center text-black">
                      <div className="font-mono text-xs uppercase tracking-wider font-bold opacity-80">
                        Current Price
                      </div>
                      <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold">
                        {fmtMoney(current.spot)}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center">
                      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        +2σ Boundary
                      </div>
                      <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-white">
                        {fmtMoney(current.upper2)}
                      </div>
                    </div>
                  </div>

                  {/* 95% probable range bar */}
                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex font-mono text-[10px] text-muted-foreground">
                      <span className="w-[15%] text-center">2.5%</span>
                      <span className="flex-1 text-center text-primary font-bold">
                        95% Probable Range (2σ)
                      </span>
                      <span className="w-[15%] text-center">2.5%</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
                      <div className="w-[15%] bg-white/10" />
                      <div className="flex-1 bg-primary/70" />
                      <div className="w-[15%] bg-white/10" />
                    </div>
                    <div className="flex justify-between font-mono text-xs text-muted-foreground">
                      <span>{fmtMoney(current.lower2)}</span>
                      <span>
                        1σ: {fmtMoney(current.lower1)} – {fmtMoney(current.upper1)}
                      </span>
                      <span>{fmtMoney(current.upper2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground pt-2">
                    <span>
                      1σ Range: <b className="text-white">±{fmtMoney(current.expectedMove1Sigma)}</b>
                    </span>
                    <span>
                      2σ Range: <b className="text-white">±{fmtMoney(current.expectedMove2Sigma)}</b>
                    </span>
                    <span>
                      DTE: <b className="text-white">{current.dte}</b>
                    </span>
                    {current.probBelowBasis != null && (
                      <span>
                        P(below basis):{" "}
                        <b className="text-primary font-bold">
                          {fmtPct(current.probBelowBasis, 0)}
                        </b>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Expected move unavailable — no option chain data for this symbol.
                </p>
              )}

              <div className="pt-4 border-t border-white/10">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                  Risk Notes
                </span>
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-muted-foreground">
                  {current.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Overview grid of all symbols */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <button
                key={r.symbol}
                onClick={() => setSelected(r.symbol)}
                className={`panel-card p-5 text-left transition-all hover:border-primary/50 cursor-pointer ${
                  current?.symbol === r.symbol ? "border-primary shadow-[0_0_12px_rgba(212,255,0,0.15)]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-lg text-white">{r.symbol}</span>
                  <span className="font-mono text-xs font-bold text-primary">
                    {scoreLabel(r.riskScore)}
                  </span>
                </div>
                <div className="mt-3">
                  <ScoreBar score={r.riskScore} invert />
                </div>
                <div className="mt-3 flex justify-between font-mono text-xs text-muted-foreground">
                  <span>
                    IV {r.iv30 != null ? `${(r.iv30 * 100).toFixed(0)}%` : "—"}
                  </span>
                  <span>{fmtPct(r.portfolioWeight, 1)} weight</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground font-mono">
        Outlier-risk analysis is based on implied volatility and reflects statistical probabilities, not predictions. Not financial advice.
      </p>
    </div>
  );
}
