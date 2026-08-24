import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBar } from "@/components/Gauges";
import { fmtMoney, fmtPct } from "@/lib/format";
import { ShieldAlert, Activity } from "lucide-react";

function scoreLabel(s: number): string {
  if (s < 4) return `${s.toFixed(1)} Low`;
  if (s < 6) return `${s.toFixed(1)} Moderate`;
  if (s < 8) return `${s.toFixed(1)} Elevated`;
  return `${s.toFixed(1)} High`;
}

export default function Risk() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSym = searchParams.get("symbol");
  const { data, isLoading, error, refetch } = trpc.analytics.riskReports.useQuery();
  
  const reports = useMemo(() => data?.reports ?? [], [data]);
  const [selected, setSelected] = useState<string | null>(null);

  const current = useMemo(() => {
    if (selected) {
      return reports.find((r) => r.symbol.toUpperCase() === selected.toUpperCase()) ?? reports[0];
    }
    if (paramSym) {
      return reports.find((r) => r.symbol.toUpperCase() === paramSym.toUpperCase()) ?? reports[0];
    }
    return reports[0];
  }, [reports, selected, paramSym]);

  const handleSelectSymbol = (sym: string) => {
    setSelected(sym);
    setSearchParams({ symbol: sym });
  };

  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <Skeleton className="h-10 w-72 bg-white/5" />
        <Skeleton className="h-72 bg-white/5" />
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 lg:p-10 space-y-7 max-w-[1550px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f0f0f2] uppercase">
            Risk & Expected Moves
          </h1>
          <p className="meta-label mt-1.5">
            Implied volatility boundaries, 2σ statistical ranges, and position concentration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.mode === "demo" && (
            <div className="neon-badge shrink-0 self-start md:self-auto">
              Demo Market Data
            </div>
          )}
          {data?.mode === "yahoo" && (
            <div className="neon-badge shrink-0 self-start md:self-auto">
              Real quotes · 15m delay
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-xs text-destructive font-mono">
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
        <div className="panel-box py-16 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
          <p className="text-lg font-display font-bold text-white">No positions to analyze</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add holdings on the Portfolio page to evaluate expected moves and risk outliers.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="meta-label text-xs">Select Position</div>
              <Select
                value={current?.symbol}
                onValueChange={handleSelectSymbol}
              >
                <SelectTrigger className="w-full sm:w-80 bg-[#141417] border-white/10 font-mono text-xs">
                  <SelectValue placeholder="Choose a symbol" />
                </SelectTrigger>
                <SelectContent className="bg-[#141417] border-white/10 font-mono text-xs">
                  {reports.map((r) => (
                    <SelectItem key={r.symbol} value={r.symbol}>
                      {r.symbol} · {fmtPct(r.portfolioWeight, 1)} of portfolio
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {current && (
              <div className="text-xs font-mono text-muted-foreground flex items-center gap-3">
                <span>IV30: <strong className="text-white">{current.iv30 != null ? `${(current.iv30 * 100).toFixed(1)}%` : "—"}</strong></span>
                <span>Portfolio Weight: <strong className="text-primary">{fmtPct(current.portfolioWeight, 1)}</strong></span>
              </div>
            )}
          </div>

          {current && (
            <div className="panel-box p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3.5">
                <div className="font-display font-bold text-lg text-white uppercase tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {current.symbol} {current.description ? `· ${current.description}` : ""}
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  Risk Level: <span className="text-primary font-bold">{scoreLabel(current.riskScore)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="meta-label text-xs">Composite Risk Score</div>
                <ScoreBar
                  score={current.riskScore}
                  invert
                  label={scoreLabel(current.riskScore)}
                />
              </div>

              {current.lower2 != null ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-center">
                      <div className="meta-label text-xs">−2σ Boundary</div>
                      <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-red-400">
                        {fmtMoney(current.lower2)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        95% downside limit
                      </div>
                    </div>

                    <div className="rounded bg-primary p-4 text-center text-black shadow-[0_0_15px_rgba(212,255,0,0.2)]">
                      <div className="font-mono text-[10px] uppercase tracking-wider font-bold opacity-80">
                        Spot Price
                      </div>
                      <div className="mt-1 font-mono text-xl sm:text-2xl font-bold">
                        {fmtMoney(current.spot)}
                      </div>
                      <div className="text-[10px] font-mono opacity-80 mt-0.5">
                        Current reference
                      </div>
                    </div>

                    <div className="rounded border border-white/10 bg-white/[0.02] p-4 text-center">
                      <div className="meta-label text-xs">+2σ Boundary</div>
                      <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-emerald-400">
                        {fmtMoney(current.upper2)}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        95% upside limit
                      </div>
                    </div>
                  </div>

                  {/* 95% probable range bar */}
                  <div className="p-3.5 rounded bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex font-mono text-[10px] text-muted-foreground">
                      <span className="w-[15%] text-center">2.5%</span>
                      <span className="flex-1 text-center text-primary font-bold">
                        95% Probable Expected Range (2σ)
                      </span>
                      <span className="w-[15%] text-center">2.5%</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-muted-foreground pt-2">
                    <div>
                      <span className="text-[10px] block text-muted-foreground/70">1σ Expected Move:</span>
                      <span className="text-white font-bold">±{fmtMoney(current.expectedMove1Sigma)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] block text-muted-foreground/70">2σ Expected Move:</span>
                      <span className="text-white font-bold">±{fmtMoney(current.expectedMove2Sigma)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] block text-muted-foreground/70">Analysis Horizon:</span>
                      <span className="text-white font-bold">{current.dte} DTE</span>
                    </div>
                    {current.probBelowBasis != null && (
                      <div>
                        <span className="text-[10px] block text-muted-foreground/70">Prob. Below Basis:</span>
                        <span className="text-primary font-bold">{fmtPct(current.probBelowBasis, 0)}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">
                  Expected move statistics unavailable (no option chain data found for this symbol).
                </p>
              )}

              {current.notes && current.notes.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <span className="meta-label block mb-2 text-xs">
                    Risk Context
                  </span>
                  <ul className="space-y-1 list-disc pl-4 text-xs text-muted-foreground font-sans">
                    {current.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Quick card overview grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reports.map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleSelectSymbol(r.symbol)}
                className={`panel-box p-4 text-left transition-all hover:border-primary/50 cursor-pointer ${
                  current?.symbol === r.symbol ? "border-primary shadow-[0_0_12px_rgba(212,255,0,0.12)]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-base text-white">{r.symbol}</span>
                  <span className="font-mono text-xs font-bold text-primary">
                    {scoreLabel(r.riskScore)}
                  </span>
                </div>
                <div className="mt-2">
                  <ScoreBar score={r.riskScore} invert />
                </div>
                <div className="mt-2.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>IV {r.iv30 != null ? `${(r.iv30 * 100).toFixed(0)}%` : "—"}</span>
                  <span>{fmtPct(r.portfolioWeight, 1)} weight</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
