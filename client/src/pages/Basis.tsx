import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBar, DeltaGauge } from "@/components/Gauges";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { Coins, Sparkles, Plus } from "lucide-react";
import { AddPositionModal } from "@/components/AddPositionModal";

function scoreLabel(s: number): string {
  if (s >= 8) return `${s.toFixed(1)} Excellent`;
  if (s >= 6.5) return `${s.toFixed(1)} Good`;
  if (s >= 5) return `${s.toFixed(1)} Fair`;
  return `${s.toFixed(1)} Weak`;
}

export default function Basis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSym = searchParams.get("symbol");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { data, isLoading, error, refetch } = trpc.analytics.basisSuggestions.useQuery();
  
  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);
  const [selected, setSelected] = useState<string | null>(null);

  const current = useMemo(() => {
    if (selected) {
      return suggestions.find((s) => s.symbol.toUpperCase() === selected.toUpperCase()) ?? suggestions[0];
    }
    if (paramSym) {
      return suggestions.find((s) => s.symbol.toUpperCase() === paramSym.toUpperCase()) ?? suggestions[0];
    }
    return suggestions[0];
  }, [suggestions, selected, paramSym]);

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            Basis Improvement
          </h1>
        </div>
        {data?.mode === "demo" && (
          <div className="terminal-badge shrink-0 self-start md:self-auto text-amber-300 border-amber-500/30 bg-amber-500/10">
            Demo Data
          </div>
        )}
        {data?.mode === "yahoo" && (
          <div className="terminal-badge shrink-0 self-start md:self-auto">
            15m Delay
          </div>
        )}
      </header>

      {error && (
        <div className="p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-xs text-destructive font-mono">
            Failed to load suggestions: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono underline text-foreground hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="panel-box py-16 text-center space-y-4">
          <Coins className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
          <div>
            <p className="text-lg font-display font-bold text-white">No qualifying stock positions</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {data?.message ??
                error?.message ??
                "Add a long stock position with at least 100 shares to see covered-call basis strategies."}
            </p>
          </div>
          <div className="pt-1">
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-emerald-500 text-black hover:bg-emerald-400 font-mono text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add 100+ Shares Position
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="meta-label text-xs">Select Underlying Asset</div>
              <Select
                value={current?.symbol}
                onValueChange={handleSelectSymbol}
              >
                <SelectTrigger className="w-full sm:w-80 bg-[#141417] border-white/10 font-mono text-xs">
                  <SelectValue placeholder="Choose a position" />
                </SelectTrigger>
                <SelectContent className="bg-[#141417] border-white/10 font-mono text-xs">
                  {suggestions.map((s) => (
                    <SelectItem key={s.symbol} value={s.symbol}>
                      {s.symbol} {s.description ? `(${s.description})` : ""} · {s.shares} sh @ {fmtMoney(s.basis)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {current && (
              <div className="text-xs font-mono text-muted-foreground flex items-center gap-3">
                <span>Spot: <strong className="text-white">{fmtMoney(current.spot)}</strong></span>
                <span>Basis: <strong className="text-white">{fmtMoney(current.basis)}</strong></span>
                <span>Lots: <strong className="text-primary">{Math.floor(current.shares / 100)}</strong> ({current.shares} sh)</span>
              </div>
            )}
          </div>

          {current && !current.best && (
            <div className="panel-box p-8 text-center text-xs font-mono text-muted-foreground">
              No optimal covered-call contracts available for {current.symbol} within the 10–60 DTE, Δ0.08–0.45 threshold.
            </div>
          )}

          {current?.best && (
            <div className="panel-box p-6 sm:p-7 grid gap-6 lg:grid-cols-2">
              {/* Left: metrics & gauges */}
              <div className="space-y-5">
                <div>
                  <div className="font-display font-bold text-lg text-white uppercase tracking-tight flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Recommended Covered Call
                  </div>
                  <div className="text-xs font-mono text-primary font-bold mt-1">
                    Sell {current.best.contracts}x {current.symbol} {fmtMoney(current.best.strike)}C · {fmtDate(current.best.expiry)} ({current.best.dte} DTE)
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="meta-label text-xs">Mechanic Score</div>
                  <ScoreBar
                    score={current.best.score}
                    label={scoreLabel(current.best.score)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 p-3.5 rounded bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <div className="meta-label text-[10px]">Trade Yield</div>
                    <div className="font-mono text-base font-bold text-primary mt-0.5">
                      {fmtPct(current.best.yieldPct)}
                    </div>
                  </div>
                  <div>
                    <div className="meta-label text-[10px]">Annualized</div>
                    <div className="font-mono text-base font-bold text-white mt-0.5">
                      {fmtPct(current.best.annualizedYieldPct, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="meta-label text-[10px]">New Cost Basis</div>
                    <div className="font-mono text-base font-bold text-white mt-0.5">
                      {fmtMoney(current.best.newBasis)}
                    </div>
                  </div>
                </div>

                <DeltaGauge delta={current.best.delta} />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-muted-foreground pt-3 border-t border-white/5">
                  <div>
                    <span className="text-[10px] block text-muted-foreground/70">Premium:</span>
                    <span className="text-primary font-bold">+{fmtMoney(current.best.premiumTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block text-muted-foreground/70">Breakeven:</span>
                    <span className="text-white">{fmtMoney(current.best.breakeven)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block text-muted-foreground/70">50% Exit Target:</span>
                    <span className="text-white">{fmtMoney(current.best.target50)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block text-muted-foreground/70">Manage Date:</span>
                    <span className="text-white">{fmtDate(current.best.manageBy)}</span>
                  </div>
                </div>
              </div>

              {/* Right: Key Rationale & Strategy Summary */}
              <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-6 pt-5 lg:pt-0 space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    Trade Specifications
                  </span>
                  <div className="p-3.5 rounded bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-zinc-300 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Contract:</span>
                      <span className="text-white">{current.best.contracts}x {current.symbol} {fmtMoney(current.best.strike)}C</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Expiry / DTE:</span>
                      <span className="text-white">{fmtDate(current.best.expiry)} ({current.best.dte} DTE)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Delta / Assignment:</span>
                      <span className="text-white">Δ{current.best.delta.toFixed(3)} ({(current.best.assignmentProb * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Premium Captured:</span>
                      <span className="text-emerald-400 font-bold">+{fmtMoney(current.best.premiumTotal)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/10">
                      <span className="text-zinc-500">Basis Reduction:</span>
                      <span className="text-white font-bold">{fmtMoney(current.basis)} → {fmtMoney(current.best.newBasis)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                  <span className="text-xs font-semibold text-zinc-300 block mb-2">
                    Optimization Rationale
                  </span>
                  <ul className="space-y-1 list-disc pl-4 text-xs text-zinc-400">
                    {current.best.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {current && current.alternatives.length > 0 && (
            <div className="panel-box p-5 sm:p-6 overflow-hidden">
              <div className="mb-3.5 meta-label text-xs">
                Alternative Strikes & Expiries ({current.alternatives.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground text-[11px]">
                      <th className="pb-2.5 text-right font-normal meta-label">Score</th>
                      <th className="pb-2.5 text-right font-normal meta-label">Strike</th>
                      <th className="pb-2.5 font-normal meta-label">Expiry</th>
                      <th className="pb-2.5 text-right font-normal meta-label">DTE</th>
                      <th className="pb-2.5 text-right font-normal meta-label">Δ</th>
                      <th className="pb-2.5 text-right font-normal meta-label">Bid</th>
                      <th className="pb-2.5 text-right font-normal meta-label">Yield</th>
                      <th className="pb-2.5 text-right font-normal meta-label">Annualized</th>
                      <th className="pb-2.5 text-right font-normal meta-label">New Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {current.alternatives.map((a) => (
                      <tr key={`${a.expiry}-${a.strike}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 text-right font-bold text-primary">
                          {a.score.toFixed(1)}
                        </td>
                        <td className="py-2.5 text-right text-white">
                          {fmtMoney(a.strike)}
                        </td>
                        <td className="py-2.5 text-muted-foreground">{fmtDate(a.expiry)}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{a.dte}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {a.delta.toFixed(3)}
                        </td>
                        <td className="py-2.5 text-right text-white">
                          {fmtMoney(a.bid)}
                        </td>
                        <td className="py-2.5 text-right text-primary font-medium">
                          {fmtPct(a.yieldPct)}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {fmtPct(a.annualizedYieldPct, 1)}
                        </td>
                        <td className="py-2.5 text-right text-white">
                          {fmtMoney(a.newBasis)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AddPositionModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
