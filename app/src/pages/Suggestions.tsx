import { trpc } from "@/lib/trpc";
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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f0f0f2] leading-tight">
            Suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            SPX beta-weighted delta of your book, with trade ideas to bring it
            delta-neutral.
          </p>
        </div>
        {data?.hasPositions && (
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

      {!data?.hasPositions ? (
        <div className="panel-card py-20 text-center space-y-4">
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
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                SPX Beta-Weighted Delta
              </span>
              <div
                className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2 ${
                  data.neutral
                    ? "text-white"
                    : long
                      ? "text-primary"
                      : "text-red-400"
                }`}
              >
                {!data.neutral &&
                  (long ? (
                    <ArrowUpRight className="h-7 w-7" />
                  ) : (
                    <ArrowDownRight className="h-7 w-7" />
                  ))}
                {data.totalDelta >= 0 ? "+" : ""}
                {fmtMoney(data.totalDelta)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                per $1 SPX move ≈{" "}
                {fmtMoney(Math.abs(data.totalDelta) / (data.spxSpot ?? 1))}
              </div>
            </div>

            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                SPX / SPY
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {data.spxSpot ? fmtMoney(data.spxSpot) : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                SPY {data.spySpot ? fmtMoney(data.spySpot) : "—"}
              </div>
            </div>

            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Scale className="h-6 w-6 text-primary" />
                <span
                  className={`font-mono text-lg font-bold uppercase tracking-wider ${
                    data.neutral ? "text-primary" : "text-amber-400"
                  }`}
                >
                  {data.neutral
                    ? "Delta Neutral"
                    : `Net ${long ? "Long" : "Short"} — hedge suggested`}
                </span>
              </div>
            </div>
          </section>

          {/* Trade ideas */}
          {!data.neutral && data.ideas.length > 0 && (
            <section className="space-y-4">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Suggested trades to neutralize
              </span>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {data.ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className="panel-card p-6 flex flex-col gap-4"
                  >
                    <div>
                      <div className="font-display font-bold text-lg text-white">
                        {idea.title}
                      </div>
                      <div className="font-mono text-xs text-primary font-bold mt-1 uppercase tracking-wider">
                        {idea.action}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">
                        {idea.instrument}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                          Delta offset
                        </div>
                        <div className="font-mono text-sm font-bold text-white">
                          {fmtMoney(idea.deltaRemoved)}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                          Est. cost
                        </div>
                        <div className="font-mono text-sm font-bold text-white">
                          {idea.estCost != null ? fmtMoney(idea.estCost) : "—"}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1.5 list-disc pl-4 text-xs text-muted-foreground flex-1">
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
                      className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider disabled:opacity-50 transition-colors"
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
          <div className="panel-card p-6 overflow-hidden">
            <div className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              SPX delta by position
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-muted-foreground text-xs font-normal">
                    <th className="pb-3 font-normal">Symbol</th>
                    <th className="pb-3 font-normal">Type</th>
                    <th className="pb-3 text-right font-normal">Qty</th>
                    <th className="pb-3 text-right font-normal">Price</th>
                    <th className="pb-3 text-right font-normal">Beta</th>
                    <th className="pb-3 text-right font-normal">SPX Δ $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono text-xs">
                  {data.breakdown.map((b) => (
                    <tr
                      key={`${b.symbol}-${b.assetType}`}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="py-3 text-white font-bold">{b.symbol}</td>
                      <td className="py-3 text-muted-foreground capitalize">
                        {b.assetType}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {b.quantity}
                      </td>
                      <td className="py-3 text-right text-white">
                        {fmtMoney(b.price)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {b.beta.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 text-right font-bold ${
                          b.spxDelta >= 0 ? "text-primary" : "text-red-400"
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
