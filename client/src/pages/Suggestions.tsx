import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import { CompanyLogo } from "@/components/CompanyLogo";
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
  Sparkles,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
  Coins,
  Percent,
  Layers,
  HelpCircle,
} from "lucide-react";

export default function Suggestions() {
  const { data, isLoading, error, refetch } =
    trpc.suggestions.spxNeutral.useQuery();
  const brokerApi = trpc.settings.getBrokerApi.useQuery();

  const [activeTab, setActiveTab] = useState<
    "SCORECARD" | "COVERED_CALLS" | "MACRO_HEDGES" | "SIGNATURE_PLAYS" | "ALERTS"
  >("SCORECARD");
  const [filterRisk, setFilterRisk] = useState<"ALL" | "DEFINED" | "UNLIMITED">("ALL");
  const [expandedResearchId, setExpandedResearchId] = useState<string | null>(null);

  const pushMut = trpc.suggestions.pushTrade.useMutation({
    onSuccess: () => toast.success("Trade pushed to your broker API."),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-[1550px] mx-auto">
        <Skeleton className="h-10 w-72 bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-96 bg-white/5" />
      </div>
    );
  }

  const long = (data?.totalDelta ?? 0) >= 0;
  const filteredIdeas = (data?.ideas ?? []).filter((idea) => {
    if (filterRisk === "DEFINED") return idea.riskType === "Defined" || idea.riskType === "Capped";
    if (filterRisk === "UNLIMITED") return idea.riskType === "Unlimited";
    return true;
  });

  const scorecard = data?.sosnoffScorecard;

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1550px] mx-auto">
      {/* ── HEADER ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-400 shrink-0" />
              Portfolio Suggestions
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Quantitative Portfolio Health
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
            Quantitative options trade suggestions and portfolio health diagnosis:
            Beta-Weighted Delta, daily Theta rent harvest (~0.1% NLV), 45 DTE entries, and 21 DTE / 50% profit management.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className="terminal-badge shrink-0">15m Delayed Feed</span>
        </div>
      </header>

      {error && (
        <div className="p-3.5 rounded border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-xs text-destructive font-mono">
            Failed to load suggestions: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono underline text-foreground hover:text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!data?.hasPositions ? (
        <div className="panel-box py-12 sm:py-16 text-center space-y-3">
          <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
          <p className="text-base font-semibold text-white">No positions to analyse</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {data?.message ??
              "Add positions via brokerage sync, CSV import, or load demo data in Portfolio."}
          </p>
        </div>
      ) : (
        <>
          {/* ── EXECUTIVE SOSNOFF DIAGNOSIS BANNER ── */}
          {scorecard && (
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-[#181510] via-[#121318] to-[#0c0d12] p-4 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                {/* Left: Grade + Title + Verdict */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-amber-500/10 border-2 border-amber-400/40 text-center shadow-[0_0_20px_rgba(251,191,36,0.15)]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      Grade
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-white leading-none mt-0.5">
                      {scorecard.overallGrade}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                        Portfolio Health Verdict:
                      </span>
                      <span className="text-sm sm:text-base font-bold text-white">
                        {scorecard.gradeTitle}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl">
                      "{scorecard.verdictSummary}"
                    </p>
                  </div>
                </div>

                {/* Right: Key Stats Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 shrink-0 min-w-[280px]">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08]">
                    <div className="text-[10px] font-mono text-zinc-400">Beta-Weighted Δ</div>
                    <div className="text-sm font-bold font-mono text-white mt-0.5">
                      {scorecard.spyBetaDelta >= 0 ? "+" : ""}
                      {scorecard.spyBetaDelta.toFixed(1)} SPY
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {scorecard.spyDeltaDollars >= 0 ? "+" : ""}
                      {fmtMoney(scorecard.spyDeltaDollars)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08]">
                    <div className="text-[10px] font-mono text-zinc-400">Daily Theta Rent</div>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                      +${scorecard.dailyTheta.toFixed(2)}/day
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {scorecard.dailyThetaPct.toFixed(3)}% of NLV/day
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08]">
                    <div className="text-[10px] font-mono text-zinc-400">Buying Power Used</div>
                    <div className="text-sm font-bold font-mono text-white mt-0.5">
                      {scorecard.bpuPct}% BPU
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {scorecard.cashPct}% Cash Reserve
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08]">
                    <div className="text-[10px] font-mono text-zinc-400">Action Alerts</div>
                    <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                      {scorecard.manageAlerts.length} Due
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      21 DTE & 50% Profit
                    </div>
                  </div>
                </div>
              </div>

              {/* Top 3 Priority Moves Quick Strip */}
              {scorecard.top3PriorityMoves.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-white/[0.08]">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    Top Priority Moves to Optimise Your Portfolio:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {scorecard.top3PriorityMoves.map((move) => (
                      <div
                        key={move.rank}
                        className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/40 transition-all flex flex-col justify-between gap-1.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              #{move.rank}
                            </span>
                            <span className="text-xs font-bold text-white truncate">
                              {move.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-300 font-mono mt-1 line-clamp-2">
                            {move.action}
                          </p>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-sans">
                          ⚡ {move.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NAVIGATION TABS ── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/[0.08] scrollbar-none">
            <button
              onClick={() => setActiveTab("SCORECARD")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "SCORECARD"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Health Scorecard ({scorecard?.pillars.length ?? 6} Pillars)
            </button>

            <button
              onClick={() => setActiveTab("COVERED_CALLS")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "COVERED_CALLS"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              Stock Covered Calls ({data.singleAssetHedges?.length ?? 0})
            </button>

            <button
              onClick={() => setActiveTab("MACRO_HEDGES")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "MACRO_HEDGES"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Delta Neutral & Macro Hedges ({data.ideas.length})
            </button>

            <button
              onClick={() => setActiveTab("SIGNATURE_PLAYS")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "SIGNATURE_PLAYS"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              High IV & Uncorrelated Plays ({scorecard?.signaturePlays.length ?? 3})
            </button>

            <button
              onClick={() => setActiveTab("ALERTS")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "ALERTS"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              21 DTE & Profit Management ({scorecard?.manageAlerts.length ?? 0})
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════
              TAB 1: 6-PILLAR HEALTH SCORECARD
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "SCORECARD" && scorecard && (
            <div className="space-y-6">
              {/* The 6 Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scorecard.pillars.map((pillar) => (
                  <div
                    key={pillar.id}
                    className="p-4 rounded-xl border border-white/[0.08] bg-[#0e1015] flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          {pillar.title}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            pillar.status === "GOOD"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : pillar.status === "WARN"
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {pillar.badge}
                        </span>
                      </div>

                      <div className="mt-3 space-y-0.5">
                        <div className="text-xl font-bold font-mono text-white">
                          {pillar.currentValue}
                        </div>
                        {pillar.subValue && (
                          <div className="text-xs font-mono text-zinc-400">
                            {pillar.subValue}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] font-mono text-zinc-500">
                        <span className="text-zinc-400">Target:</span> {pillar.targetValue}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
                      <div className="text-[11px] text-zinc-300 italic bg-white/[0.02] p-2 rounded border border-white/[0.04]">
                        "{pillar.tomTake}"
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {pillar.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 2: STOCK COVERED CALL CASH-FLOW ENGINE
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "COVERED_CALLS" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Stock Monetization Engine (Covered Calls):
                    </span>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      45 DTE · 30Δ & 16Δ OTM Calls
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    "If you own stock, sell 45 DTE covered calls to generate monthly cash flow, harvest theta, and lower your cost basis."
                  </p>
                </div>
              </div>

              {(!data.singleAssetHedges || data.singleAssetHedges.length === 0) ? (
                <div className="panel-box py-12 text-center text-zinc-400 text-xs font-mono">
                  No single stock holdings detected to monetize with covered calls.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {data.singleAssetHedges.map((hedge) => (
                    <div
                      key={hedge.symbol}
                      className="p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-[#0d0f14] space-y-4 shadow-lg"
                    >
                      {/* Stock Header */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                        <div className="flex items-center gap-3">
                          <CompanyLogo symbol={hedge.symbol} className="w-9 h-9 rounded-lg" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-white font-mono">
                                {hedge.symbol}
                              </span>
                              <span className="text-xs font-mono text-zinc-400">
                                {hedge.quantity} Shares @ {fmtMoney(hedge.price)}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500">
                              Position Value: {fmtMoney(hedge.dollarDelta)} · Beta: {hedge.beta.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-[10px] text-zinc-500 uppercase">Stock Delta</div>
                          <div className="text-sm font-bold text-emerald-400">
                            +{hedge.rawDelta} Δ
                          </div>
                        </div>
                      </div>

                      {/* 2 Options Cards: Active 30Δ vs Conservative 16Δ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 30-Delta Call */}
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-amber-500/20 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-amber-300 font-mono">
                                45 DTE 30Δ Call (Active)
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {hedge.callHedge.pop}% POP
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white font-mono mt-1">
                              Sell ${hedge.callHedge.strike} Call
                            </div>
                            <div className="text-xs text-zinc-300 font-mono mt-1 space-y-0.5">
                              <div>Premium: <span className="text-emerald-400 font-bold">+{fmtMoney(hedge.callHedge.premium)}</span></div>
                              <div>Yield: <span className="text-white">{hedge.callHedge.yieldPct}% / 45d</span></div>
                              <div>Annualized: <span className="text-amber-400 font-bold">{((hedge.callHedge.yieldPct / 45) * 365).toFixed(1)}%</span></div>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              pushMut.mutate({
                                title: `Covered Call: ${hedge.symbol} ${hedge.callHedge.strike}C`,
                                action: hedge.callHedge.action,
                                instrument: `${hedge.symbol} ${hedge.callHedge.strike}C 45DTE`,
                                quantity: hedge.callHedge.contracts,
                                estCost: hedge.callHedge.premium,
                              })
                            }
                            disabled={pushMut.isPending}
                            className="w-full mt-2 py-1.5 px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono font-semibold border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Push to Broker
                          </button>
                        </div>

                        {/* 16-Delta Call */}
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-zinc-300 font-mono">
                                45 DTE 16Δ Call (Safe)
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {hedge.conservativeCall.pop}% POP
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white font-mono mt-1">
                              Sell ${hedge.conservativeCall.strike} Call
                            </div>
                            <div className="text-xs text-zinc-300 font-mono mt-1 space-y-0.5">
                              <div>Premium: <span className="text-emerald-400 font-bold">+{fmtMoney(hedge.conservativeCall.premium)}</span></div>
                              <div>Yield: <span className="text-white">{hedge.conservativeCall.yieldPct}% / 45d</span></div>
                              <div>Annualized: <span className="text-zinc-400">{((hedge.conservativeCall.yieldPct / 45) * 365).toFixed(1)}%</span></div>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              pushMut.mutate({
                                title: `Covered Call: ${hedge.symbol} ${hedge.conservativeCall.strike}C`,
                                action: `SELL ${hedge.conservativeCall.contracts}x ${hedge.symbol} ${hedge.conservativeCall.strike}C (45 DTE)`,
                                instrument: `${hedge.symbol} ${hedge.conservativeCall.strike}C 45DTE`,
                                quantity: hedge.conservativeCall.contracts,
                                estCost: hedge.conservativeCall.premium,
                              })
                            }
                            disabled={pushMut.isPending}
                            className="w-full mt-2 py-1.5 px-3 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Push to Broker
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: DELTA NEUTRAL & MACRO HEDGES
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "MACRO_HEDGES" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                <div>
                  <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Macro Delta Neutralisation (SPX / SPY):
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Portfolio Delta: {data.spyBetaDelta >= 0 ? "+" : ""}{data.spyBetaDelta.toFixed(1)} SPY eq. ({fmtMoney(data.totalDelta)})
                  </p>
                </div>

                <div className="flex items-center gap-1 p-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                  <button
                    onClick={() => setFilterRisk("ALL")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      filterRisk === "ALL" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterRisk("DEFINED")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      filterRisk === "DEFINED" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Defined Risk
                  </button>
                  <button
                    onClick={() => setFilterRisk("UNLIMITED")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      filterRisk === "UNLIMITED" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Unlimited Risk
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {filteredIdeas.map((idea) => {
                  const isExpanded = expandedResearchId === idea.id;
                  return (
                    <div
                      key={idea.id}
                      className="p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-[#0c0e14] space-y-4 shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white">
                              {idea.title}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                idea.riskType === "Defined"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {idea.riskType} Risk ({idea.probabilityLabel})
                            </span>
                          </div>
                          <div className="text-xs font-mono text-zinc-400 mt-1">
                            {idea.action}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
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
                            className="py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Push Trade
                          </button>
                          <button
                            onClick={() => setExpandedResearchId(isExpanded ? null : idea.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                            title={isExpanded ? "Collapse research" : "Expand payoff research"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Key Stats Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                        <div className="p-2.5 rounded bg-black/40 border border-white/[0.05]">
                          <div className="text-[10px] text-zinc-500">Capital / Cost</div>
                          <div className="text-white font-bold">{idea.estCost != null ? fmtMoney(idea.estCost) : "Zero Outlay"}</div>
                        </div>
                        <div className="p-2.5 rounded bg-black/40 border border-white/[0.05]">
                          <div className="text-[10px] text-zinc-500">Delta Offset</div>
                          <div className="text-emerald-400 font-bold">{idea.tradeDelta >= 0 ? "+" : ""}{idea.tradeDelta.toFixed(1)} SPX eq.</div>
                        </div>
                        <div className="p-2.5 rounded bg-black/40 border border-white/[0.05]">
                          <div className="text-[10px] text-zinc-500">Residual Delta</div>
                          <div className="text-white font-bold">{idea.postHedgeDelta >= 0 ? "+" : ""}{idea.postHedgeDelta.toFixed(1)} SPX eq.</div>
                        </div>
                        <div className="p-2.5 rounded bg-black/40 border border-white/[0.05]">
                          <div className="text-[10px] text-zinc-500">Neutralisation</div>
                          <div className="text-amber-400 font-bold">{idea.neutralityPct}%</div>
                        </div>
                      </div>

                      {/* Rationale Bullet Points */}
                      <div className="space-y-1">
                        {idea.rationale.map((r, i) => (
                          <div key={i} className="text-xs text-zinc-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>

                      {/* Expanded Payoff Research Scenarios */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-white/[0.08] space-y-3">
                          <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                            Payoff Research Scenarios (PnL vs Market Moves):
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                              <thead>
                                <tr className="border-b border-white/10 text-zinc-400 text-left">
                                  <th className="py-2 px-3">Market Scenario</th>
                                  <th className="py-2 px-3">Move</th>
                                  <th className="py-2 px-3">Estimated Hedge P&L</th>
                                  <th className="py-2 px-3">Residual Delta</th>
                                  <th className="py-2 px-3 text-right">ROI %</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.05]">
                                {idea.researchScenarios.map((sc, i) => (
                                  <tr key={i} className="hover:bg-white/[0.02]">
                                    <td className="py-2 px-3 font-semibold text-white">{sc.scenario}</td>
                                    <td className="py-2 px-3 text-zinc-400">{sc.marketMove}</td>
                                    <td className={`py-2 px-3 font-bold ${sc.estimatedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {sc.estimatedPnL >= 0 ? "+" : ""}{fmtMoney(sc.estimatedPnL)}
                                    </td>
                                    <td className="py-2 px-3 text-zinc-400">{sc.residualDelta >= 0 ? "+" : ""}{sc.residualDelta.toFixed(1)}</td>
                                    <td className={`py-2 px-3 text-right font-bold ${sc.roiPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {sc.roiPct >= 0 ? "+" : ""}{sc.roiPct}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 4: HIGH IV RANK & UNCORRELATED SIGNATURE PLAYS
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "SIGNATURE_PLAYS" && scorecard && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Signature Premium Plays (High IV & Non-Correlated Assets):
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  "Trade small, trade often, and diversify into commodities (Gold/GLD) and Treasuries (TLT) to create non-correlated occurrences."
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {scorecard.signaturePlays.map((play) => (
                  <div
                    key={play.id}
                    className="p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-[#0c0e14] flex flex-col justify-between gap-4 shadow-lg"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CompanyLogo symbol={play.symbol} className="w-8 h-8 rounded-lg" />
                          <div>
                            <span className="text-base font-bold text-white font-mono">{play.symbol}</span>
                            <div className="text-[10px] text-zinc-400 truncate">{play.name}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                          IVR {play.ivr}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1">
                        <div className="text-xs font-bold text-white font-mono">{play.strategy}</div>
                        <div className="text-[11px] text-emerald-400 font-mono font-semibold">{play.action}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 rounded bg-white/[0.02]">
                          <div className="text-[10px] text-zinc-500">Probability of Profit</div>
                          <div className="text-emerald-400 font-bold">{play.pop}% POP</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02]">
                          <div className="text-[10px] text-zinc-500">Daily Theta</div>
                          <div className="text-white font-bold">+${play.targetThetaDaily.toFixed(2)}/d</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02]">
                          <div className="text-[10px] text-zinc-500">Est. Credit</div>
                          <div className="text-emerald-400 font-bold">+{fmtMoney(play.estCredit)}</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02]">
                          <div className="text-[10px] text-zinc-500">Buying Power</div>
                          <div className="text-white font-bold">{fmtMoney(play.bpu)}</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-zinc-300 italic bg-white/[0.02] p-2.5 rounded border border-white/[0.04]">
                        "{play.whyTomRecommends}"
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        pushMut.mutate({
                          title: `${play.symbol} ${play.strategy}`,
                          action: play.action,
                          instrument: `${play.symbol} 45DTE`,
                          quantity: 1,
                          estCost: play.estCredit,
                        })
                      }
                      disabled={pushMut.isPending}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono font-semibold border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Push Signature Trade
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 5: 21 DTE & 50% PROFIT MANAGEMENT ALERTS
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "ALERTS" && scorecard && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Position Management Rules (21 DTE & 50% Profit):
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  "Take profits at 50% of maximum profit. Manage or roll positions at 21 DTE to eliminate gamma risk."
                </p>
              </div>

              {scorecard.manageAlerts.length === 0 ? (
                <div className="panel-box py-12 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-white">All Clear! No Positions Need Management</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    All open option positions are currently outside the 21 DTE danger window and haven't triggered the 50% profit target yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scorecard.manageAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-amber-500/30 bg-[#12100d] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span className="text-sm font-bold text-white font-mono">
                            {alert.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          {alert.actionType === "ROLL_21_DTE" ? "21 DTE Rule" : "50% Profit Rule"}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                        {alert.recommendation}
                      </p>

                      <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-500">Urgency: <span className="text-amber-400 font-bold">{alert.urgency}</span></span>
                        <button
                          onClick={() =>
                            pushMut.mutate({
                              title: alert.title,
                              action: `CLOSE/ROLL ${alert.symbol} POSITION`,
                              instrument: alert.symbol,
                              quantity: 1,
                              estCost: null,
                            })
                          }
                          disabled={pushMut.isPending}
                          className="py-1 px-2.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-medium transition-all cursor-pointer"
                        >
                          Execute Management
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
