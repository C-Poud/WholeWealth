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
  BarChart3,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export default function Suggestions() {
  const { data, isLoading, error, refetch } =
    trpc.suggestions.spxNeutral.useQuery();
  const brokerApi = trpc.settings.getBrokerApi.useQuery();

  const [expandedResearchId, setExpandedResearchId] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<"ALL" | "DEFINED" | "UNLIMITED">("ALL");
  const [activeTab, setActiveTab] = useState<"MACRO" | "SINGLE_ASSET">("MACRO");

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
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1550px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            Delta Neutral Suggestions
          </h1>
        </div>
        {data?.hasPositions && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="terminal-badge shrink-0">
              15m Delay
            </span>
          </div>
        )}
      </header>

      {error && (
        <div className="p-3.5 rounded border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
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
        <div className="panel-box py-12 sm:py-16 text-center space-y-3">
          <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
          <p className="text-base font-semibold text-white">No positions to hedge</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {data?.message ??
              "Add positions via brokerage sync, CSV import, or load demo data in Portfolio."}
          </p>
        </div>
      ) : (
        <>
          {/* Delta Neutral Formula Bar */}
          <div className="p-3.5 sm:p-4 rounded border border-white/[0.08] bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Delta Neutral Principle:
                </span>
                <code className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Δ_portfolio = Σ(w_i · Δ_i) = 0
                </code>
              </div>
              <p className="text-xs text-zinc-400">
                Calculates required hedge sizing to stabilize portfolio market delta near neutral.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 rounded bg-black/40 border border-white/[0.06] text-right font-mono text-xs">
                <div className="text-[10px] text-zinc-500">Neutral Threshold</div>
                <div className="text-white font-bold">Within ±$500 SPX Delta</div>
              </div>
            </div>
          </div>

          {/* Delta overview KPI Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="stat-card p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-400">Portfolio Beta Δ</div>
              <div
                className={`text-lg sm:text-2xl mt-1 flex items-center gap-1 font-bold font-mono truncate ${
                  data.neutral
                    ? "text-white"
                    : long
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {!data.neutral &&
                  (long ? (
                    <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  ))}
                <span className="truncate">
                  {(data.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                  {(data.spxBetaDelta ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] sm:text-xs font-mono text-zinc-500">SPX eq.</span>
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono truncate">
                {((data.spyBetaDelta ?? 0) >= 0 ? "+" : "") + (data.spyBetaDelta ?? 0).toFixed(1)} SPY · {data.totalDelta >= 0 ? "+" : ""}{fmtMoney(data.totalDelta)}
              </div>
            </div>

            <div className="stat-card p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-400">Portfolio Beta (vs SPX)</div>
              <div className="text-white text-lg sm:text-2xl mt-1 font-bold font-mono truncate">
                {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono truncate">
                {(data.portfolioBeta ?? 1) > 1.15
                  ? "High sensitivity"
                  : (data.portfolioBeta ?? 1) < 0.85
                    ? "Low sensitivity"
                    : "Market correlated"}
              </div>
            </div>

            <div className="stat-card p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-400">Index Reference</div>
              <div className="text-white text-lg sm:text-2xl mt-1 font-bold font-mono truncate">
                {data.spxSpot ? `SPX ${data.spxSpot.toFixed(0)}` : "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono truncate">
                SPY {data.spySpot ? `$${data.spySpot.toFixed(2)}` : "—"}
              </div>
            </div>

            <div className="stat-card p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-400">Delta Neutral State</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Scale className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span
                  className={`font-mono text-xs sm:text-base font-bold uppercase truncate ${
                    data.neutral ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {data.neutral ? "Delta Neutral" : `Net ${long ? "Long" : "Short"}`}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono truncate">
                {data.neutral ? "Δ ≈ 0" : "Requires hedge"}
              </div>
            </div>
          </section>

          {/* Navigation Tabs between Macro Delta Hedges and Single Asset Hedges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-2 gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
              <button
                onClick={() => setActiveTab("MACRO")}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === "MACRO"
                    ? "bg-white/10 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Macro Hedges ({data.ideas.length})
              </button>
              <button
                onClick={() => setActiveTab("SINGLE_ASSET")}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === "SINGLE_ASSET"
                    ? "bg-white/10 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Single Asset Hedges ({data.singleAssetHedges?.length ?? 0})
              </button>
            </div>

            {activeTab === "MACRO" && !data.neutral && data.ideas.length > 0 && (
              <div className="flex items-center gap-1 p-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                <button
                  onClick={() => setFilterRisk("ALL")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterRisk === "ALL"
                      ? "bg-white text-black font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterRisk("DEFINED")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterRisk === "DEFINED"
                      ? "bg-white text-black font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Defined Risk
                </button>
                <button
                  onClick={() => setFilterRisk("UNLIMITED")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterRisk === "UNLIMITED"
                      ? "bg-white text-black font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Unlimited Risk
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: Macro Portfolio Delta-Neutral Hedges */}
          {activeTab === "MACRO" && (
            <>
              {!data.neutral && data.ideas.length > 0 ? (
                <section className="space-y-4">
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
                              : "border-white/[0.08] hover:border-white/20"
                          }`}
                        >
                          <div className="space-y-3.5">
                            {/* Title & Risk Badge */}
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-bold text-base text-white">
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

                              <div className="font-mono text-xs text-emerald-400 font-bold mt-1 uppercase">
                                {idea.action}
                              </div>
                              <div className="font-mono text-xs text-zinc-400">
                                {idea.instrument}
                              </div>
                            </div>

                            {/* Exact Wikipedia Delta Neutrality Metrics */}
                            <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06] space-y-2">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-zinc-400">Delta Neutrality:</span>
                                <span className="text-emerald-400 font-bold">
                                  {idea.neutralityPct}% Neutralized
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px] bg-black/40 p-2 rounded border border-white/[0.04]">
                                <div>
                                  <div className="text-[9px] text-zinc-500">Pre-Hedge Δ</div>
                                  <div className="text-white font-bold">{idea.preHedgeDelta >= 0 ? "+" : ""}{idea.preHedgeDelta.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] text-zinc-500">Trade Δ</div>
                                  <div className="text-emerald-400 font-bold">{idea.tradeDelta >= 0 ? "+" : ""}{idea.tradeDelta.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] text-zinc-500">Residual Δ</div>
                                  <div className="text-white font-bold">{idea.postHedgeDelta >= 0 ? "+" : ""}{idea.postHedgeDelta.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>

                            {/* Risk Profile Breakdown */}
                            <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Max Loss:</span>
                                <span
                                  className={`font-bold ${
                                    isUnlimited ? "text-red-400" : "text-white"
                                  }`}
                                >
                                  {idea.maxLoss}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Max Profit:</span>
                                <span className="text-white">{idea.maxProfit}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Breakeven:</span>
                                <span className="text-white font-bold">{idea.breakeven}</span>
                              </div>
                              {idea.estCost != null && (
                                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                                  <span className="text-zinc-400">Est. Capital / Cost:</span>
                                  <span className="text-white font-bold">{fmtMoney(idea.estCost)}</span>
                                </div>
                              )}
                            </div>

                            {/* Rationale Bullet Points */}
                            <ul className="space-y-1 list-disc pl-4 text-xs text-zinc-400">
                              {idea.rationale.slice(0, 2).map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>

                            {/* Expandable Research & Gamma Sensitivity */}
                            <div>
                              <button
                                onClick={() =>
                                  setExpandedResearchId(isExpanded ? null : idea.id)
                                }
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-mono text-zinc-400 hover:text-white transition-all cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                                  {isExpanded ? "Hide Details" : "Greeks & Gamma Drift Model"}
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
                                    <div className="space-y-1.5">
                                      <div className="text-[10px] text-zinc-400 uppercase font-bold">Analytic Greeks</div>
                                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-400">
                                        <div>Delta (Δ): <span className="text-white font-bold">{idea.greeks.delta}</span></div>
                                        <div>Gamma (Γ): <span className="text-white font-bold">{idea.greeks.gamma}</span></div>
                                        <div>Theta (Θ): <span className="text-white font-bold">{idea.greeks.theta}</span></div>
                                        <div>Vega (V): <span className="text-white font-bold">{idea.greeks.vega}</span></div>
                                      </div>
                                      <div className="text-[10px] text-zinc-500 pt-1 border-t border-white/[0.04]">
                                        {idea.rebalanceThreshold}
                                      </div>
                                    </div>
                                  )}

                                  {/* Payoff Simulation Table with Gamma Delta Drift */}
                                  {idea.researchScenarios && idea.researchScenarios.length > 0 && (
                                    <div>
                                      <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1.5">
                                        Price Shock & Residual Delta Drift
                                      </div>
                                      <div className="space-y-1">
                                        {idea.researchScenarios.map((sc, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between text-[11px] py-1 border-b border-white/[0.04] last:border-0"
                                          >
                                            <span className="text-zinc-400 flex items-center gap-1">
                                              {sc.estimatedPnL >= 0 ? (
                                                <TrendingUp className="h-3 w-3 text-emerald-400" />
                                              ) : (
                                                <TrendingDown className="h-3 w-3 text-red-400" />
                                              )}
                                              {sc.scenario}
                                            </span>
                                            <div className="flex items-center gap-2 font-mono">
                                              <span className="text-[10px] text-zinc-500">
                                                Res. Δ: {sc.residualDelta >= 0 ? "+" : ""}{sc.residualDelta.toFixed(1)}
                                              </span>
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
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-white px-3 py-2 text-xs font-mono font-bold text-black hover:bg-zinc-200 uppercase tracking-wider disabled:opacity-50 transition-colors cursor-pointer"
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
              ) : (
                <div className="panel-box p-8 text-center space-y-2">
                  <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto" />
                  <div className="text-white font-bold text-base">Book is Currently Delta Neutral</div>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Portfolio beta-weighted delta is within the ±$500 threshold. Directional market risk is balanced.
                  </p>
                </div>
              )}
            </>
          )}

          {/* TAB 2: Single Asset Delta Hedges */}
          {activeTab === "SINGLE_ASSET" && (
            <div className="space-y-4">
              <div className="panel-box p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-3 border-b border-white/[0.08] pb-2.5">
                  <div>
                    <span className="text-sm font-semibold text-white">Single-Asset Delta Neutrality</span>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      For each individual long equity holding, hedge ratio <code className="text-zinc-300 font-mono">N = -Shares / (100 · Δ)</code> offsets position delta directly.
                    </p>
                  </div>
                </div>

                {(!data.singleAssetHedges || data.singleAssetHedges.length === 0) ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    No active stock holdings found to calculate single-asset delta hedges.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-zinc-400 text-[11px]">
                          <th className="pb-2.5 font-normal">Holding</th>
                          <th className="pb-2.5 text-right font-normal">Shares / Value</th>
                          <th className="pb-2.5 text-right font-normal">Current Δ</th>
                          <th className="pb-2.5 font-normal pl-4">Covered Call Delta Hedge</th>
                          <th className="pb-2.5 font-normal pl-4">Protective Put Delta Hedge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.singleAssetHedges.map((sh) => (
                          <tr key={sh.symbol} className="hover:bg-white/[0.02]">
                            <td className="py-3 font-bold text-white">
                              {sh.symbol}
                              <div className="text-[10px] text-zinc-500 font-normal">β {sh.beta.toFixed(2)} · {fmtMoney(sh.price)}</div>
                            </td>
                            <td className="py-3 text-right text-zinc-300">
                              {sh.quantity} shs
                              <div className="text-[10px] text-zinc-500">{fmtMoney(sh.dollarDelta)}</div>
                            </td>
                            <td className="py-3 text-right font-bold text-emerald-400">
                              +{sh.rawDelta} Δ
                            </td>
                            <td className="py-3 pl-4">
                              <div className="space-y-0.5">
                                <div className="text-white font-medium">{sh.callHedge.action}</div>
                                <div className="text-[10px] text-zinc-400">
                                  Yield: <span className="text-emerald-400">+{fmtMoney(sh.callHedge.premium)}</span> · Res. Δ: <span className="text-zinc-300">+{sh.callHedge.postDelta}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pl-4">
                              <div className="space-y-0.5">
                                <div className="text-white font-medium">{sh.putHedge.action}</div>
                                <div className="text-[10px] text-zinc-400">
                                  Cost: <span className="text-zinc-300">{fmtMoney(sh.putHedge.cost)}</span> · Res. Δ: <span className="text-zinc-300">+{sh.putHedge.postDelta}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SPX Beta Delta Breakdown Table */}
          <div className="panel-box p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.08] pb-2.5">
              <span className="text-xs font-semibold text-zinc-300">
                Portfolio Holdings Beta Delta Breakdown
              </span>
              <span className="terminal-badge text-[10px]">
                Portfolio β {(data.portfolioBeta ?? 1.0).toFixed(2)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08] text-zinc-400 text-[11px]">
                    <th className="pb-2.5 font-normal">Symbol</th>
                    <th className="pb-2.5 font-normal hidden sm:table-cell">Type</th>
                    <th className="pb-2.5 text-right font-normal">Qty</th>
                    <th className="pb-2.5 text-right font-normal hidden md:table-cell">Price</th>
                    <th className="pb-2.5 text-right font-normal hidden sm:table-cell">Beta</th>
                    <th className="pb-2.5 text-right font-normal hidden md:table-cell">SPX Delta</th>
                    <th className="pb-2.5 text-right font-normal">SPX Dollar Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {data.breakdown.map((b) => (
                    <tr
                      key={`${b.symbol}-${b.assetType}`}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 text-white font-bold">{b.symbol}</td>
                      <td className="py-2.5 text-zinc-400 capitalize font-sans hidden sm:table-cell">
                        {b.assetType}
                      </td>
                      <td className="py-2.5 text-right text-zinc-400">
                        {b.quantity}
                      </td>
                      <td className="py-2.5 text-right text-white hidden md:table-cell">
                        {fmtMoney(b.price)}
                      </td>
                      <td className="py-2.5 text-right text-zinc-300 font-bold hidden sm:table-cell">
                        {b.beta.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold hidden md:table-cell ${
                          (b.spxBetaDelta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
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
