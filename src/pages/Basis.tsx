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
import { ScoreBar, DeltaGauge } from "@/components/Gauges";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { Coins } from "lucide-react";

function scoreLabel(s: number): string {
  if (s >= 8) return `${s.toFixed(1)} Excellent`;
  if (s >= 6.5) return `${s.toFixed(1)} Good`;
  if (s >= 5) return `${s.toFixed(1)} Fair`;
  return `${s.toFixed(1)} Weak`;
}

export default function Basis() {
  const { data, isLoading, error, refetch } = trpc.analytics.basisSuggestions.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);
  const current =
    suggestions.find((s) => s.symbol === selected) ?? suggestions[0];

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
            Basis Improvement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Covered-call suggestions that lower your cost basis. Small percentages compound dramatically.
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
        <div className="panel-card py-20 text-center space-y-4">
          <Coins className="h-12 w-12 mx-auto text-muted-foreground stroke-1" />
          <p className="text-xl font-display font-bold">Nothing to optimise yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {data?.message ??
              error?.message ??
              "Add a long stock position with at least 100 shares to see covered-call suggestions."}
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
                <SelectValue placeholder="Choose a position" />
              </SelectTrigger>
              <SelectContent className="bg-[#141417] border-white/10 font-mono text-sm">
                {suggestions.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol}>
                    {s.symbol}
                    {s.description ? ` — ${s.description}` : ""} · {s.shares} sh @{" "}
                    {fmtMoney(s.basis)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && !current.best && (
            <div className="panel-card p-8 text-center text-sm text-muted-foreground">
              No suitable covered-call candidates for {current.symbol} in the
              10–60 DTE, Δ0.08–0.45 window right now.
            </div>
          )}

          {current?.best && (
            <div className="panel-card p-6 sm:p-8 grid gap-8 lg:grid-cols-2">
              {/* Left: metrics */}
              <div className="space-y-6">
                <div>
                  <div className="font-display font-bold text-xl text-white">
                    Basis Improvement: {current.symbol}
                    {current.description ? ` — ${current.description}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Small percentages compound dramatically
                  </div>
                </div>

                <div className="text-sm font-mono text-muted-foreground bg-white/[0.03] p-3 rounded border border-white/5">
                  Sell {current.best.contracts} covered call
                  {current.best.contracts > 1 ? "s" : ""} · Strike{" "}
                  <span className="text-white font-bold">{fmtMoney(current.best.strike)}</span> · Expires{" "}
                  <span className="text-white font-bold">{fmtDate(current.best.expiry)}</span> ({current.best.dte} DTE, Δ
                  {current.best.delta.toFixed(4)})
                </div>

                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    Mechanic Score
                  </div>
                  <ScoreBar
                    score={current.best.score}
                    label={scoreLabel(current.best.score)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                      Yield
                    </div>
                    <div className="font-mono text-lg font-bold text-primary">
                      {fmtPct(current.best.yieldPct)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                      Annualized
                    </div>
                    <div className="font-mono text-lg font-bold text-white">
                      {fmtPct(current.best.annualizedYieldPct, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                      New Basis
                    </div>
                    <div className="font-mono text-lg font-bold text-white">
                      {fmtMoney(current.best.newBasis)}
                    </div>
                  </div>
                </div>

                <DeltaGauge delta={current.best.delta} />

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground pt-2 border-t border-white/5">
                  <span>
                    Manage by:{" "}
                    <b className="text-white font-normal">
                      {fmtDate(current.best.manageBy)}
                    </b>
                  </span>
                  <span>
                    50% target:{" "}
                    <b className="text-white font-normal">
                      {fmtMoney(current.best.target50)}
                    </b>
                  </span>
                  <span>
                    Breakeven:{" "}
                    <b className="text-white font-normal">
                      {fmtMoney(current.best.breakeven)}
                    </b>
                  </span>
                  <span>
                    Total Premium:{" "}
                    <b className="text-primary font-bold">
                      +{fmtMoney(current.best.premiumTotal)}
                    </b>
                  </span>
                </div>
              </div>

              {/* Right: narrative */}
              <div className="text-sm leading-relaxed text-muted-foreground flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-8 pt-6 lg:pt-0">
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3">
                    Execution Plan & Rationale
                  </span>
                  <p className="text-zinc-300">
                    Sell {current.best.contracts} covered call
                    {current.best.contracts > 1 ? "s" : ""} at the{" "}
                    <strong className="text-white">{fmtMoney(current.best.strike)}</strong> strike expiring{" "}
                    <strong className="text-white">{fmtDate(current.best.expiry)}</strong> ({current.best.dte} DTE, Δ
                    {current.best.delta.toFixed(4)}). This structure yields a
                    Mechanic Score of <strong className="text-primary">{current.best.score.toFixed(1)}</strong>, driven
                    primarily by delta alignment relative to the underlying price
                    of {fmtMoney(current.spot)}.
                  </p>
                  <p className="mt-3 text-zinc-300">
                    The trade generates a yield of{" "}
                    <strong className="text-primary">{fmtPct(current.best.yieldPct)}</strong> (
                    {fmtPct(current.best.annualizedYieldPct, 1)} annualized),
                    resulting in a new cost basis of{" "}
                    <strong className="text-white">{fmtMoney(current.best.newBasis)}</strong> and a breakeven of{" "}
                    {fmtMoney(current.best.breakeven)}. Management targets a 50%
                    profit exit ({fmtMoney(current.best.target50)}) or a
                    transition at the {fmtDate(current.best.manageBy)} management
                    date, with an approximate{" "}
                    {(current.best.assignmentProb * 100).toFixed(0)}% probability
                    of assignment.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block mb-2">
                    Key Drivers
                  </span>
                  <ul className="space-y-1.5 list-disc pl-4 text-xs text-muted-foreground">
                    {current.best.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {current && current.alternatives.length > 0 && (
            <div className="panel-card p-6 overflow-hidden">
              <div className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Alternative strikes & expiries — {current.symbol}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground text-xs font-normal">
                      <th className="pb-3 text-right font-normal">Score</th>
                      <th className="pb-3 text-right font-normal">Strike</th>
                      <th className="pb-3 font-normal">Expiry</th>
                      <th className="pb-3 text-right font-normal">DTE</th>
                      <th className="pb-3 text-right font-normal">Δ</th>
                      <th className="pb-3 text-right font-normal">Bid</th>
                      <th className="pb-3 text-right font-normal">Yield</th>
                      <th className="pb-3 text-right font-normal">Annualized</th>
                      <th className="pb-3 text-right font-normal">New basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] font-mono text-xs">
                    {current.alternatives.map((a) => (
                      <tr key={`${a.expiry}-${a.strike}`} className="hover:bg-white/[0.02]">
                        <td className="py-3 text-right font-bold text-primary">
                          {a.score.toFixed(1)}
                        </td>
                        <td className="py-3 text-right text-white">
                          {fmtMoney(a.strike)}
                        </td>
                        <td className="py-3 text-muted-foreground">{fmtDate(a.expiry)}</td>
                        <td className="py-3 text-right text-muted-foreground">{a.dte}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {a.delta.toFixed(3)}
                        </td>
                        <td className="py-3 text-right text-white">
                          {fmtMoney(a.bid)}
                        </td>
                        <td className="py-3 text-right text-primary font-medium">
                          {fmtPct(a.yieldPct)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {fmtPct(a.annualizedYieldPct, 1)}
                        </td>
                        <td className="py-3 text-right text-white">
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

      <p className="text-xs text-muted-foreground font-mono">
        Generated by a quantitative heuristic from live or demo option-chain data. Not financial advice.
      </p>
    </div>
  );
}
