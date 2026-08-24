import { useState } from "react";
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
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Percent,
  Compass,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export default function Suggestions() {
  const { data, isLoading, error, refetch } =
    trpc.suggestions.spxNeutral.useQuery();
  const brokerApi = trpc.settings.getBrokerApi.useQuery();

  const [expandedResearchId, setExpandedResearchId] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<"ALL" | "DEFINED" | "UNLIMITED">("ALL");

  const pushMut = trpc.suggestions.pushTrade.useMutation({
    onSuccess: () => toast.success("Trade pushed to your broker API."),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-80 bg-white/5" />
      </div>
    );
  }

  const long = (data?.totalDelta ?? 0) >= 0;
  const filteredIdeas = (data?.ideas ?? []).filter((idea) => {
    if (filterRisk === "DEFINED") return idea.riskType === "Defined" || idea.riskType === "Capped";
    if (filterRisk === "UNLIMITED") return idea.riskType === "Unlimited";
    return true;
  });

  return (
    <div className="p-5 sm:p-8 lg:p-10 space-y-7 max-w-[1550px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#f0f0f2] uppercase">
            Suggestions & Research
          </h1>
          <p className="meta-label mt-1.5">
            SPX Beta delta hedging, win probabilities (POP), and risk models.
          </p>
        </div>
        {data?.hasPositions && (
          <div className="flex items-center gap-2">
            <span className="neon-badge shrink-0 self-start md:self-auto">
              Real quotes · 15m delay
            </span>
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

      {!data?.hasPositions ? (
        <div className="panel-box py-16 text-center space-y-3">
          <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
          <p className="text-lg font-display font-bold text-white">No positions to hedge</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {data?.message ??
              "Add positions via brokerage sync, CSV import, or load demo data in Portfolio."}
          </p>
        </div>
      ) : (
        <>
          {/* Delta overview KPI Row */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="meta-label text-xs">SPX Beta Delta</div>
              <div
                className={`stat-value text-2xl mt-1 flex items-center gap-1 font-bold ${
                  data.neutral
                    ? "text-white"
                    : long
                      ? "text-primary drop-shadow-[0_0_8px_rgba(212,255,0,0.3)]"
                      : "text-red-400"
                }`}
              >
                {!data.neutral &&
                  (long ? (
                    <ArrowUpRight className="h-5 w-5 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 shrink-0" />
                  ))}
                <span>
                  {(data.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                  {(data.spxBetaDelta ?? 0).toFixed(2)}
                </span>
                <span className="text-xs font-mono text-muted-foreground">Δ</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {((data.spyBetaDelta ?? 0) >= 0 ? "+" : "") + (data.spyBetaDelta ?? 0).toFixed(1)} SPY eq. · {data.totalDelta >= 0 ? "+" : ""}{fmtMoney(data.totalDelta)}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label text-xs">Portfolio Beta (vs SPX)</div>
              <div className="stat-value text-white text-2xl mt-1 font-bold">
                {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {(data.portfolioBeta ?? 1) > 1.15
                  ? "High sensitivity"
                  : (data.portfolioBeta ?? 1) < 0.85
                    ? "Low sensitivity"
                    : "Market correlated"}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label text-xs">Index Reference</div>
              <div className="stat-value text-white text-2xl mt-1 font-bold">
                {data.spxSpot ? `SPX ${data.spxSpot.toFixed(0)}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                SPY {data.spySpot ? `$${data.spySpot.toFixed(2)}` : "—"}
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label text-xs">Book Neutrality</div>
              <div className="flex items-center gap-2 mt-1">
                <Scale className="h-4 w-4 text-primary shrink-0" />
                <span
                  className={`font-mono text-lg font-bold uppercase tracking-wider ${
                    data.neutral ? "text-primary" : "text-amber-400"
                  }`}
                >
                  {data.neutral ? "Delta Neutral" : `Net ${long ? "Long" : "Short"}`}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {data.neutral ? "Optimal tail protection" : "Hedge to offset bias"}
              </div>
            </div>
          </section>

          {/* Trade Suggestions & Research Section */}
          {!data.neutral && data.ideas.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-display font-bold uppercase tracking-tight text-white">
                    Suggested Hedges
                  </h2>
                  <span className="text-xs font-mono text-muted-foreground">
                    ({filteredIdeas.length})
                  </span>
                </div>

                {/* Risk Filter Toggle */}
                <div className="flex items-center gap-1 p-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                  <button
                    onClick={() => setFilterRisk("ALL")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      filterRisk === "ALL"
                        ? "bg-primary text-black font-bold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterRisk("DEFINED")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      filterRisk === "DEFINED"
                        ? "bg-primary text-black font-bold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Defined Risk
                  </button>
                  <button
                    onClick={() => setFilterRisk("UNLIMITED")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      filterRisk === "UNLIMITED"
                        ? "bg-primary text-black font-bold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Unlimited Risk
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {filteredIdeas.map((idea) => {
                  const isExpanded = expandedResearchId === idea.id;
                  const isUnlimited = idea.riskType === "Unlimited";

                  return (
                    <div
                      key={idea.id}
                      className={`panel-box p-5 flex flex-col justify-between transition-all border ${
                        isUnlimited
                          ? "border-red-500/25 hover:border-red-500/45"
                          : "border-white/[0.08] hover:border-primary/40"
                      }`}
                    >
                      <div className="space-y-3.5">
                        {/* Title & Risk Badge */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-display font-bold text-lg text-white uppercase tracking-tight">
                              {idea.title}
                            </div>
                            {isUnlimited ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400">
                                <AlertTriangle className="h-3 w-3" />
                                {idea.riskLevel}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                <ShieldCheck className="h-3 w-3" />
                                {idea.riskLevel}
                              </span>
                            )}
                          </div>

                          <div className="font-mono text-xs text-primary font-bold mt-1 uppercase">
                            {idea.action}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {idea.instrument}
                          </div>
                        </div>

                        {/* Quantitative Delta & Probability Grid */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                          <div>
                            <div className="meta-label flex items-center gap-1 text-[10px]">
                              <Activity className="h-3 w-3 text-primary" /> Delta Offset
                            </div>
                            <div className="font-mono text-xs font-bold text-white mt-0.5">
                              {idea.deltaUnit}
                            </div>
                            <div className="text-[10px] font-mono text-primary">
                              {fmtMoney(idea.deltaRemoved)} SPX $Δ
                            </div>
                          </div>

                          <div>
                            <div className="meta-label flex items-center gap-1 text-[10px]">
                              <Percent className="h-3 w-3 text-primary" /> Win Prob (POP)
                            </div>
                            <div className="font-mono text-xs font-bold text-white mt-0.5 flex items-center gap-1">
                              <span>{idea.probabilityOfProfit}%</span>
                              <span className="text-[10px] font-normal text-muted-foreground">POP</span>
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  idea.probabilityOfProfit >= 60
                                    ? "bg-primary"
                                    : idea.probabilityOfProfit >= 50
                                      ? "bg-amber-400"
                                      : "bg-red-400"
                                }`}
                                style={{ width: `${idea.probabilityOfProfit}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Risk Profile Breakdown */}
                        <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Max Loss:</span>
                            <span
                              className={`font-bold ${
                                isUnlimited ? "text-red-400" : "text-white"
                              }`}
                            >
                              {idea.maxLoss}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Max Profit:</span>
                            <span className="text-white">{idea.maxProfit}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Breakeven:</span>
                            <span className="text-primary font-bold">{idea.breakeven}</span>
                          </div>
                          {idea.estCost != null && (
                            <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                              <span className="text-muted-foreground">Est. Capital / Debit:</span>
                              <span className="text-white font-bold">{fmtMoney(idea.estCost)}</span>
                            </div>
                          )}
                        </div>

                        {/* Rationale Bullet Points (Crisp & Scannable) */}
                        <ul className="space-y-1 list-disc pl-3.5 text-xs text-muted-foreground font-sans">
                          {idea.rationale.slice(0, 2).map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>

                        {/* Expandable Research */}
                        <div>
                          <button
                            onClick={() =>
                              setExpandedResearchId(isExpanded ? null : idea.id)
                            }
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-mono text-muted-foreground hover:text-white transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <BarChart3 className="h-3.5 w-3.5 text-primary" />
                              {isExpanded ? "Hide Details" : "Research & Payoff Model"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 p-3 rounded bg-black/40 border border-white/[0.08] space-y-3 text-xs font-mono">
                              {/* Greeks Overview */}
                              {idea.greeks && (
                                <div className="space-y-1">
                                  <div className="meta-label text-[10px]">Option Greeks</div>
                                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                                    <div>Delta: <span className="text-white">{idea.greeks.delta}</span></div>
                                    <div>Theta: <span className="text-white">{idea.greeks.theta}</span></div>
                                    <div>Vega: <span className="text-white">{idea.greeks.vega}</span></div>
                                    <div>Gamma: <span className="text-white">{idea.greeks.gamma}</span></div>
                                  </div>
                                </div>
                              )}

                              {/* Payoff Simulation Table */}
                              {idea.researchScenarios && idea.researchScenarios.length > 0 && (
                                <div>
                                  <div className="meta-label text-[10px] mb-1">Scenario Simulation</div>
                                  <div className="space-y-1">
                                    {idea.researchScenarios.map((sc, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between text-[11px] py-0.5 border-b border-white/[0.04] last:border-0"
                                      >
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          {sc.estimatedPnL >= 0 ? (
                                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                                          ) : (
                                            <TrendingDown className="h-3 w-3 text-red-400" />
                                          )}
                                          {sc.scenario}
                                        </span>
                                        <div className="flex items-center gap-1.5 font-mono">
                                          <span
                                            className={
                                              sc.estimatedPnL >= 0
                                                ? "text-emerald-400 font-bold"
                                                : "text-red-400"
                                            }
                                          >
                                            {sc.estimatedPnL >= 0 ? "+" : ""}
                                            {fmtMoney(sc.estimatedPnL)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Push to Broker Action */}
                      <div className="mt-4 pt-3 border-t border-white/[0.06]">
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
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          {pushMut.isPending
                            ? "Pushing…"
                            : brokerApi.data?.configured
                              ? "Push to broker"
                              : "Set broker API in Settings"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SPX Beta Delta Breakdown Table */}
          <div className="panel-box p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.08] pb-2.5">
              <span className="meta-label text-xs">
                SPX Beta Delta Breakdown
              </span>
              <span className="neon-badge text-[10px]">
                Weighted β {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08] text-muted-foreground text-[11px]">
                    <th className="pb-2.5 font-normal meta-label">Symbol</th>
                    <th className="pb-2.5 font-normal meta-label">Type</th>
                    <th className="pb-2.5 text-right font-normal meta-label">Qty</th>
                    <th className="pb-2.5 text-right font-normal meta-label">Price</th>
                    <th className="pb-2.5 text-right font-normal meta-label">Beta</th>
                    <th className="pb-2.5 text-right font-normal meta-label">SPX Δ (Dec)</th>
                    <th className="pb-2.5 text-right font-normal meta-label">SPX Δ $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {data.breakdown.map((b) => (
                    <tr
                      key={`${b.symbol}-${b.assetType}`}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 text-white font-bold">{b.symbol}</td>
                      <td className="py-2.5 text-muted-foreground capitalize font-sans">
                        {b.assetType}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {b.quantity}
                      </td>
                      <td className="py-2.5 text-right text-white">
                        {fmtMoney(b.price)}
                      </td>
                      <td className="py-2.5 text-right text-primary font-bold">
                        {b.beta.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold ${
                          (b.spxBetaDelta ?? 0) >= 0 ? "text-primary" : "text-red-400"
                        }`}
                      >
                        {(b.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                        {(b.spxBetaDelta ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-medium ${
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
        </>
      )}
    </div>
  );
}
