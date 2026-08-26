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
import { VolatilityConeChart } from "@/components/VolatilityConeChart";
import { VolatilityBoxCalculator } from "@/components/VolatilityBoxCalculator";
import { CompanyLogo } from "@/components/CompanyLogo";
import {
  ShieldAlert,
  Activity,
  Zap,
  TrendingUp,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Calculator,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function scoreLabel(s: number): string {
  if (s < 4) return `${s.toFixed(1)} Low`;
  if (s < 6) return `${s.toFixed(1)} Moderate`;
  if (s < 8) return `${s.toFixed(1)} Elevated`;
  return `${s.toFixed(1)} High`;
}

function scoreTextColor(s: number): string {
  if (s < 4) return "text-zinc-300";
  if (s < 6) return "text-sky-400";
  if (s < 8) return "text-amber-400";
  return "text-rose-400";
}

export default function Risk() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSym = searchParams.get("symbol");
  const [activeTab, setActiveTab] = useState<string>("portfolio");

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

  // Aggregated Portfolio Value at Risk (VaR) under 1σ and 2σ moves
  const portfolioVaR = useMemo(() => {
    let totalDown1 = 0;
    let totalDown2 = 0;
    let totalUp1 = 0;
    let totalUp2 = 0;
    let weightedIvSum = 0;
    let totalWeight = 0;

    for (const r of reports) {
      if (r.dollarImpactDown1Sigma != null) totalDown1 += Math.abs(r.dollarImpactDown1Sigma);
      if (r.dollarImpactDown2Sigma != null) totalDown2 += Math.abs(r.dollarImpactDown2Sigma);
      if (r.dollarImpactUp1Sigma != null) totalUp1 += r.dollarImpactUp1Sigma;
      if (r.dollarImpactUp2Sigma != null) totalUp2 += r.dollarImpactUp2Sigma;
      if (r.iv30 != null) {
        weightedIvSum += r.iv30 * r.portfolioWeight;
        totalWeight += r.portfolioWeight;
      }
    }

    const avgIv = totalWeight > 0 ? weightedIvSum / totalWeight : null;
    return { totalDown1, totalDown2, totalUp1, totalUp2, avgIv };
  }, [reports]);

  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 space-y-6 max-w-[1550px] mx-auto">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <Skeleton className="h-12 w-full bg-white/5" />
        <Skeleton className="h-80 bg-white/5" />
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1550px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight font-display">
              Risk & Volatility Analysis
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Zap className="h-3 w-3" /> VolatilityBox Model
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-sans max-w-2xl">
            Multi-horizon expected moves, probability cones (1-sigma, 2-sigma, 3-sigma), and ATM Straddle implied volatility bounds grounded in empirical options research.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {data?.mode === "demo" && (
            <div className="terminal-badge shrink-0 text-amber-300 border-amber-500/30 bg-amber-500/10">
              Demo Data
            </div>
          )}
          {data?.mode === "yahoo" && (
            <div className="terminal-badge shrink-0 text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
              15m Delayed
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

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 sm:space-y-6">
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <TabsList className="bg-[#121419] border border-white/10 p-1 inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger
              value="portfolio"
              className="text-xs font-mono data-[state=active]:bg-white/10 data-[state=active]:text-white whitespace-nowrap"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
              Portfolio Risk ({reports.length})
            </TabsTrigger>
            <TabsTrigger
              value="simulator"
              className="text-xs font-mono data-[state=active]:bg-white/10 data-[state=active]:text-white whitespace-nowrap"
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
              Volatility Box Simulator
            </TabsTrigger>
            <TabsTrigger
              value="methodology"
              className="text-xs font-mono data-[state=active]:bg-white/10 data-[state=active]:text-white whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
              Expected Move Methodology
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Portfolio Holdings Risk Analysis */}
        <TabsContent value="portfolio" className="space-y-5 sm:space-y-6">
          {/* Portfolio-Level Value at Risk Summary */}
          {reports.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="panel-box p-3.5 sm:p-4 space-y-1">
                <div className="meta-label text-[10px]">Portfolio Value</div>
                <div className="font-mono text-lg sm:text-2xl font-bold text-white truncate">
                  {fmtMoney(data?.portfolioValue ?? 0)}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400">
                  {reports.length} Active Asset{reports.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="panel-box p-3.5 sm:p-4 space-y-1">
                <div className="meta-label text-[10px]">Avg Portfolio IV (30D)</div>
                <div className="font-mono text-lg sm:text-2xl font-bold text-sky-400 truncate">
                  {portfolioVaR.avgIv != null ? `${(portfolioVaR.avgIv * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400">
                  Weighted IV
                </div>
              </div>

              <div className="panel-box p-3.5 sm:p-4 space-y-1 border-rose-500/20 bg-rose-500/[0.03]">
                <div className="meta-label text-[10px] text-rose-400">1σ Downside (68%)</div>
                <div className="font-mono text-lg sm:text-2xl font-bold text-rose-400 truncate">
                  −{fmtMoney(portfolioVaR.totalDown1)}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 truncate">
                  {data?.portfolioValue ? `-${((portfolioVaR.totalDown1 / data.portfolioValue) * 100).toFixed(1)}% shock` : "Expected 1σ"}
                </div>
              </div>

              <div className="panel-box p-3.5 sm:p-4 space-y-1 border-rose-500/30 bg-rose-500/[0.06]">
                <div className="meta-label text-[10px] text-rose-300">2σ Tail Down (95%)</div>
                <div className="font-mono text-lg sm:text-2xl font-bold text-rose-300 truncate">
                  −{fmtMoney(portfolioVaR.totalDown2)}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400">
                  95.4% Extreme Risk
                </div>
              </div>
            </div>
          )}

          {reports.length === 0 ? (
            <div className="panel-box py-16 text-center space-y-3">
              <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
              <p className="text-lg font-display font-bold text-white">No positions to analyze</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add holdings on the Portfolio page or use the Volatility Box Simulator tab to test any ticker.
              </p>
            </div>
          ) : (
            <>
              {/* Position Selector & Context */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="meta-label text-xs">Select Position for Deep Volatility Box Breakdown</div>
                  <Select value={current?.symbol} onValueChange={handleSelectSymbol}>
                    <SelectTrigger className="w-full sm:w-80 bg-[#121419] border-white/10 font-mono text-xs text-white">
                      <SelectValue placeholder="Choose a symbol" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121419] border-white/10 font-mono text-xs text-white">
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
                    <span>
                      IV30:{" "}
                      <strong className="text-white">
                        {current.iv30 != null ? `${(current.iv30 * 100).toFixed(1)}%` : "—"}
                      </strong>
                    </span>
                    <span>
                      Spot: <strong className="text-white">{fmtMoney(current.spot)}</strong>
                    </span>
                    <span>
                      Weight:{" "}
                      <strong className="text-white">{fmtPct(current.portfolioWeight, 1)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {current && (
                <div className="panel-box p-6 sm:p-7 space-y-6">
                  {/* Position Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-4">
                    <div className="font-display font-bold text-lg text-white uppercase tracking-tight flex items-center gap-2.5">
                      <CompanyLogo symbol={current.symbol} size="sm" />
                      <Activity className="h-4 w-4 text-sky-400" />
                      <span>{current.symbol}</span>
                      {current.description && (
                        <span className="text-zinc-400 text-sm font-normal">· {current.description}</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      Composite Risk Score:{" "}
                      <span className={`font-bold ${scoreTextColor(current.riskScore)}`}>{scoreLabel(current.riskScore)}</span>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="space-y-1.5">
                    <div className="meta-label text-xs">Risk Assessment & Outlier Exposure</div>
                    <ScoreBar score={current.riskScore} invert label={scoreLabel(current.riskScore)} />
                  </div>

                  {/* Multi-Horizon Cards for Current Position */}
                  {current.horizons && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded bg-white/[0.02] border border-white/10 space-y-1">
                        <div className="meta-label text-[10px]">1-Day Expected Move</div>
                        <div className="text-lg font-bold font-mono text-white">
                          ±${current.horizons.daily1D?.dollar.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          ±{((current.horizons.daily1D?.pct ?? 0) * 100).toFixed(2)}% (1D)
                        </div>
                      </div>

                      <div className="p-3.5 rounded bg-white/[0.02] border border-white/10 space-y-1">
                        <div className="meta-label text-[10px]">1-Week Move (7D)</div>
                        <div className="text-lg font-bold font-mono text-white">
                          ±${current.horizons.weekly1W?.dollar.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          ±{((current.horizons.weekly1W?.pct ?? 0) * 100).toFixed(2)}% (7D)
                        </div>
                      </div>

                      <div className="p-3.5 rounded bg-sky-500/10 border border-sky-500/30 space-y-1">
                        <div className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider">
                          {current.dte}-Day Move (1σ)
                        </div>
                        <div className="text-lg font-bold font-mono text-white">
                          ±${current.expectedMove1Sigma?.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-[11px] font-mono text-sky-300">
                          ±{(((current.expectedMove1Sigma ?? 0) / current.spot) * 100).toFixed(2)}% (68.2% Conf)
                        </div>
                      </div>

                      <div className="p-3.5 rounded bg-white/[0.02] border border-white/10 space-y-1">
                        <div className="meta-label text-[10px]">30-Day Move (1σ)</div>
                        <div className="text-lg font-bold font-mono text-white">
                          ±${current.horizons.monthly30D?.dollar.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          ±{((current.horizons.monthly30D?.pct ?? 0) * 100).toFixed(2)}% (30D)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volatility Cone Chart */}
                  {current.iv30 != null && current.iv30 > 0 && (
                    <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-sky-400" />
                          Probability Cone & Expected Move Envelopes ({current.symbol})
                        </h3>
                        <span className="text-xs font-mono text-zinc-400">
                          30D Implied Vol: <strong className="text-white">{(current.iv30 * 100).toFixed(1)}%</strong>
                        </span>
                      </div>
                      <VolatilityConeChart
                        spot={current.spot}
                        iv={current.iv30}
                        dte={current.dte}
                        symbol={current.symbol}
                      />
                    </div>
                  )}

                  {/* Volatility Box Levels Matrix & ATM Straddle */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Volatility Box Matrix */}
                    <div className="lg:col-span-2 space-y-3 p-4 rounded-lg bg-black/40 border border-white/10">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <div className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-sky-400" />
                          Volatility Box Price Levels ({current.dte} DTE)
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          Spot: <strong className="text-white">{fmtMoney(current.spot)}</strong>
                        </span>
                      </div>

                      {current.boxLevels ? (
                        <div className="space-y-1.5 font-mono text-xs">
                          {/* +3σ Extreme */}
                          <div className="flex items-center justify-between p-2 rounded bg-rose-500/5 border border-rose-500/20 text-rose-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
                              R3 (+3σ Upper Extreme · 99.7%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.r3)}</span>
                              <span className="text-[10px] text-rose-400 ml-2">
                                +{(((current.boxLevels.r3 - current.spot) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* +2σ Volatility Resistance */}
                          <div className="flex items-center justify-between p-2 rounded bg-amber-500/5 border border-amber-500/20 text-amber-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
                              R2 (+2σ Volatility Resistance · 95.4%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.r2)}</span>
                              <span className="text-[10px] text-amber-400 ml-2">
                                +{(((current.boxLevels.r2 - current.spot) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* +1σ Expected Move Upper */}
                          <div className="flex items-center justify-between p-2 rounded bg-sky-500/5 border border-sky-500/20 text-sky-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
                              R1 (+1σ Expected Move Upper · 68.2%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.r1)}</span>
                              <span className="text-[10px] text-sky-400 ml-2">
                                +{(((current.boxLevels.r1 - current.spot) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Current Spot Reference */}
                          <div className="flex items-center justify-between p-2.5 rounded bg-white/10 border border-white/20 text-white font-bold">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-white inline-block" />
                              Spot Reference Price
                            </span>
                            <span className="text-base text-white">{fmtMoney(current.spot)}</span>
                          </div>

                          {/* -1σ Expected Move Lower */}
                          <div className="flex items-center justify-between p-2 rounded bg-sky-500/5 border border-sky-500/20 text-sky-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowDownRight className="h-3.5 w-3.5 text-sky-400" />
                              S1 (−1σ Expected Move Lower · 68.2%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.s1)}</span>
                              <span className="text-[10px] text-sky-400 ml-2">
                                −{(((current.spot - current.boxLevels.s1) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* -2σ Volatility Support */}
                          <div className="flex items-center justify-between p-2 rounded bg-cyan-500/5 border border-cyan-500/20 text-cyan-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowDownRight className="h-3.5 w-3.5 text-cyan-400" />
                              S2 (−2σ Volatility Support · 95.4%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.s2)}</span>
                              <span className="text-[10px] text-cyan-400 ml-2">
                                −{(((current.spot - current.boxLevels.s2) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* -3σ Extreme Lower */}
                          <div className="flex items-center justify-between p-2 rounded bg-rose-500/5 border border-rose-500/20 text-rose-300">
                            <span className="font-bold flex items-center gap-1.5">
                              <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                              S3 (−3σ Lower Extreme · 99.7%)
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-white">{fmtMoney(current.boxLevels.s3)}</span>
                              <span className="text-[10px] text-rose-400 ml-2">
                                −{(((current.spot - current.boxLevels.s3) / current.spot) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono">
                          Option chain data unavailable for multi-sigma box levels.
                        </p>
                      )}
                    </div>

                    {/* ATM Straddle & Value at Risk */}
                    <div className="space-y-4 p-4 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2 border-b border-white/10 pb-2.5">
                          <Zap className="h-3.5 w-3.5 text-cyan-400" />
                          ATM Straddle Market Implied Move
                        </div>

                        {current.atmStraddle ? (
                          <div className="space-y-2.5 font-mono text-xs">
                            <div className="p-2.5 rounded bg-white/[0.03] border border-white/10 space-y-1.5">
                              <div className="flex justify-between text-zinc-400 text-[11px]">
                                <span>Expiry:</span>
                                <span className="text-white font-bold">
                                  {current.atmStraddle.expiry} ({current.atmStraddle.dte}d)
                                </span>
                              </div>
                              <div className="flex justify-between text-zinc-400 text-[11px]">
                                <span>ATM Strike:</span>
                                <span className="text-white font-bold">${current.atmStraddle.strike}</span>
                              </div>
                              <div className="flex justify-between text-zinc-400 text-[11px]">
                                <span>Call / Put Mid:</span>
                                <span className="text-white font-bold">
                                  ${current.atmStraddle.callMid.toFixed(2)} / ${current.atmStraddle.putMid.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-zinc-300 pt-1 border-t border-white/10">
                                <span>Straddle Price:</span>
                                <span className="text-white font-bold">${current.atmStraddle.straddlePrice.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="p-3 rounded bg-cyan-500/10 border border-cyan-500/30 space-y-1 text-center">
                              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                                Straddle Move (85% Rule)
                              </div>
                              <div className="text-xl font-bold text-white">
                                ±${current.atmStraddle.expectedMove.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Market Pricing: <strong className="text-cyan-300">{current.atmStraddle.pricingStatus}</strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded bg-white/[0.02] border border-white/10 text-xs font-mono text-zinc-400 text-center">
                            Formula IV expected move active. Real-time options chain quotes derived from IV30.
                          </div>
                        )}
                      </div>

                      {/* Value at Risk on this holding */}
                      <div className="p-3 rounded bg-white/[0.02] border border-white/5 space-y-2 font-mono text-xs">
                        <div className="text-[11px] font-bold text-zinc-300">Position Dollar Impact (VaR EM):</div>
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>−1σ Adverse Move:</span>
                          <span className="text-rose-400 font-bold">
                            {current.dollarImpactDown1Sigma != null ? fmtMoney(current.dollarImpactDown1Sigma) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>−2σ Tail Move:</span>
                          <span className="text-rose-400 font-bold">
                            {current.dollarImpactDown2Sigma != null ? fmtMoney(current.dollarImpactDown2Sigma) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Risk Context */}
                  {current.notes && current.notes.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <span className="meta-label block mb-2 text-xs">Quantitative Risk Context</span>
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
                    className={`panel-box p-4 text-left transition-all hover:border-sky-500/40 cursor-pointer ${
                      current?.symbol === r.symbol
                        ? "border-sky-500/80 bg-white/[0.03] shadow-[0_0_15px_rgba(56,189,248,0.12)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CompanyLogo symbol={r.symbol} size="xs" />
                        <span className="font-mono font-bold text-base text-white">{r.symbol}</span>
                      </div>
                      <span className={`font-mono text-xs font-bold ${scoreTextColor(r.riskScore)}`}>
                        {scoreLabel(r.riskScore)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ScoreBar score={r.riskScore} invert />
                    </div>
                    <div className="mt-2.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                      <span>IV {r.iv30 != null ? `${(r.iv30 * 100).toFixed(0)}%` : "—"}</span>
                      <span>1W: ±${r.horizons?.weekly1W?.dollar.toFixed(1) ?? "—"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Interactive Volatility Box Simulator */}
        <TabsContent value="simulator" className="space-y-6">
          <VolatilityBoxCalculator initialSymbol={current?.symbol ?? "SPY"} />
        </TabsContent>

        {/* Tab 3: Research Methodology & Guidelines */}
        <TabsContent value="methodology" className="space-y-6">
          <div className="panel-box p-6 sm:p-8 space-y-6 max-w-4xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <BookOpen className="h-5 w-5 text-sky-400" />
              <h2 className="text-xl font-bold font-display text-white">
                VolatilityBox Options Expected Move Research
              </h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed">
              <p>
                The <strong>Expected Move (EM)</strong> is the market-implied range in which a stock, ETF, or index is statistically expected to trade over a defined timeframe, derived directly from live option pricing.
              </p>

              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
                <div className="text-sky-400 font-bold text-sm">
                  1. The Standard Implied Volatility Model
                </div>
                <div className="p-2.5 rounded bg-white/[0.03] text-white text-sm font-bold">
                  Expected Move (±1σ) = Spot Price × IV × √(DTE / 365)
                </div>
                <p className="text-zinc-400 font-sans">
                  Represents <strong>1 standard deviation (68.2% probability)</strong>. Prices stay inside this envelope ~68% of the time, with 15.9% upside tails and 15.9% downside tails.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
                <div className="text-cyan-400 font-bold text-sm">
                  2. The 85% ATM Straddle Rule (Market-Implied Pricing)
                </div>
                <div className="p-2.5 rounded bg-white/[0.03] text-white text-sm font-bold">
                  Expected Move ≈ 0.85 × (ATM Call Mid + ATM Put Mid)
                </div>
                <p className="text-zinc-400 font-sans">
                  While a 100% straddle equals the pure market-maker breakeven cost, empirical backtesting across thousands of expirations shows that <strong>85% of the at-the-money straddle</strong> accurately models the 1-standard-deviation boundary (68.2%).
                </p>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
                <div className="text-amber-400 font-bold text-sm">
                  3. Multi-Sigma Volatility Box Levels
                </div>
                <ul className="space-y-1.5 text-zinc-300 font-sans">
                  <li>• <strong className="font-mono text-rose-300">R3 / S3 (±3σ)</strong>: 99.7% Extreme Outlier Boundary (Black Swan / High Margin of Safety)</li>
                  <li>• <strong className="font-mono text-amber-300">R2 / S2 (±2σ)</strong>: 95.4% Volatility Resistance & Support (Ideal for credit spread wings)</li>
                  <li>• <strong className="font-mono text-sky-300">R1 / S1 (±1σ)</strong>: 68.2% Standard Expected Range (Covered call & cash-secured put target)</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
