import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  Scale,
  Send,
} from "lucide-react";

export default function Suggestions() {
  const { data, isLoading, error, refetch } =
    trpc.suggestions.spxNeutral.useQuery();
  const brokerApi = trpc.settings.getBrokerApi.useQuery();

  const pushMut = trpc.suggestions.pushTrade.useMutation({
    onSuccess: () => toast.success("Trade pushed to your broker API."),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-10 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-12 w-80 bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-72 bg-white/5" />
      </div>
    );
  }

  const long = (data?.totalDelta ?? 0) >= 0;

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Suggestions
          </h1>
          <p className="meta-label mt-2">
            SPX beta-weighted delta of your book, with trade ideas to bring it delta-neutral.
          </p>
        </div>
        {data?.hasPositions && (
          <div className="neon-badge shrink-0 self-start md:self-auto">
            Real quotes · 15m delay
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

      {!data?.hasPositions ? (
        <div className="panel-box py-20 text-center space-y-4">
          <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground stroke-1" />
          <p className="text-xl font-display font-bold">No positions yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {data?.message ??
              "Add positions first — connect a brokerage, import a file, or load the demo portfolio."}
          </p>
        </div>
      ) : (
        <>
          {/* Delta overview */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card">
              <div className="meta-label">
                SPX Beta Delta (Whole Portfolio)
              </div>
              <div
                className={`stat-value flex items-center gap-1.5 ${
                  data.neutral
                    ? "text-white"
                    : long
                      ? "text-primary"
                      : "text-red-400"
                }`}
              >
                {!data.neutral &&
                  (long ? (
                    <ArrowUpRight className="h-6 w-6 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 shrink-0" />
                  ))}
                <span>
                  {(data.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                  {(data.spxBetaDelta ?? 0).toFixed(2)}
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-1">
                  Δ (SPX equiv.)
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {((data.spyBetaDelta ?? 0) >= 0 ? "+" : "") + (data.spyBetaDelta ?? 0).toFixed(1)} SPY shares equiv. · {data.totalDelta >= 0 ? "+" : ""}{fmtMoney(data.totalDelta)}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">
                Portfolio Beta (vs SPX)
              </div>
              <div className="stat-value text-white">
                {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {(data.portfolioBeta ?? 1) > 1.15
                  ? "Aggressive (High sensitivity)"
                  : (data.portfolioBeta ?? 1) < 0.85
                    ? "Defensive (Low sensitivity)"
                    : "Market correlated"}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">
                SPX / SPY Index Reference
              </div>
              <div className="stat-value text-white">
                {data.spxSpot ? data.spxSpot.toFixed(2) : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                SPY {data.spySpot ? data.spySpot.toFixed(2) : "—"}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">
                Book Status
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Scale className="h-5 w-5 text-primary shrink-0" />
                <span
                  className={`font-mono text-base sm:text-lg font-bold uppercase tracking-wider ${
                    data.neutral ? "text-primary" : "text-amber-400"
                  }`}
                >
                  {data.neutral
                    ? "Delta Neutral"
                    : `Net ${long ? "Long" : "Short"}`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {data.neutral ? "Optimal tail protection" : "Hedge suggested to neutralize"}
              </div>
            </div>
          </section>

          {/* Trade ideas */}
          {!data.neutral && data.ideas.length > 0 && (
            <section className="space-y-4">
              <span className="meta-label">
                Suggested trades to neutralize
              </span>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {data.ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className="panel-box p-6 flex flex-col gap-4"
                  >
                    <div>
                      <div className="font-display font-bold text-lg text-white uppercase">
                        {idea.title}
                      </div>
                      <div className="font-mono text-xs text-primary font-bold mt-1 uppercase tracking-wider">
                        {idea.action}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">
                        {idea.instrument}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 rounded bg-white/[0.02] border border-white/[0.06]">
                      <div>
                        <div className="meta-label">
                          Delta offset (SPX $)
                        </div>
                        <div className="font-mono text-sm font-bold text-white mt-0.5">
                          {fmtMoney(idea.deltaRemoved)}
                        </div>
                      </div>
                      <div>
                        <div className="meta-label">
                          Est. cost
                        </div>
                        <div className="font-mono text-sm font-bold text-white mt-0.5">
                          {idea.estCost != null ? fmtMoney(idea.estCost) : "—"}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1.5 list-disc pl-4 text-xs text-muted-foreground flex-1 font-sans">
                      {idea.rationale.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>

                    <button
                      onClick={() =>
                        pushMut.mutate({
                          title: idea.title,
                          action: idea.action,
                          instrument: idea.instrument,
                          quantity: idea.quantity,
                          estCost: idea.estCost,
                        })
                      }
                      disabled={pushMut.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {pushMut.isPending
                        ? "Pushing…"
                        : brokerApi.data?.configured
                          ? "Push to broker"
                          : "Set broker API in Settings"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Breakdown */}
          <div className="panel-box p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
              <span className="meta-label">
                SPX Beta Delta Breakdown by Position
              </span>
              <span className="neon-badge">
                Weighted Beta: {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                    <th className="pb-3 font-normal meta-label">Symbol</th>
                    <th className="pb-3 font-normal meta-label">Type</th>
                    <th className="pb-3 text-right font-normal meta-label">Qty</th>
                    <th className="pb-3 text-right font-normal meta-label">Price</th>
                    <th className="pb-3 text-right font-normal meta-label">Beta</th>
                    <th className="pb-3 text-right font-normal meta-label">SPX Δ (Dec)</th>
                    <th className="pb-3 text-right font-normal meta-label">SPX Δ $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                  {data.breakdown.map((b) => (
                    <tr
                      key={`${b.symbol}-${b.assetType}`}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 text-white font-bold">{b.symbol}</td>
                      <td className="py-3 text-muted-foreground capitalize font-sans">
                        {b.assetType}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {b.quantity}
                      </td>
                      <td className="py-3 text-right text-white">
                        {fmtMoney(b.price)}
                      </td>
                      <td className="py-3 text-right text-primary font-bold">
                        {b.beta.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 text-right font-bold ${
                          (b.spxBetaDelta ?? 0) >= 0 ? "text-primary" : "text-red-400"
                        }`}
                      >
                        {(b.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                        {(b.spxBetaDelta ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`py-3 text-right font-medium ${
                          b.spxDelta >= 0 ? "text-white" : "text-red-300"
                        }`}
                      >
                        {b.spxDelta >= 0 ? "+" : ""}
                        {fmtMoney(b.spxDelta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            {data.note}
          </p>
        </>
      )}
    </div>
  );
}
