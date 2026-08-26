import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { fmtMoney } from "@/lib/format";
import { CompanyLogo } from "@/components/CompanyLogo";
import {
  TrendingUp,
  Activity,
  Zap,
  Info,
  Layers,
  Calculator,
  ShieldCheck,
  Search,
  Scale,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PortfolioGreeksPanelProps {
  onSelectSymbol?: (symbol: string) => void;
}

export function PortfolioGreeksPanel({ onSelectSymbol }: PortfolioGreeksPanelProps) {
  const { data, isLoading } = trpc.analytics.portfolioGreeks.useQuery(undefined, {
    staleTime: 30_000,
  });

  const [viewMode, setViewMode] = useState<"underlyings" | "positions">("underlyings");
  const [filterType, setFilterType] = useState<"all" | "covered" | "unhedged" | "options">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFormulaDetails, setShowFormulaDetails] = useState(true);

  const greeks = data?.greeks;

  const underlyings = useMemo(() => {
    if (!greeks?.underlyings) return [];
    return greeks.underlyings.filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!u.symbol.toLowerCase().includes(q) && !u.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterType === "covered") return u.coverageRatio > 0;
      if (filterType === "unhedged") return u.coverageRatio === 0 && u.equityShares > 0;
      if (filterType === "options") return Math.abs(u.optionDelta) > 0;
      return true;
    });
  }, [greeks, filterType, searchQuery]);

  const filteredPositions = useMemo(() => {
    if (!greeks?.positions) return [];
    return greeks.positions.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.symbol.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterType === "covered") return p.optionDetails?.isCovered;
      if (filterType === "unhedged") return p.assetType === "stock" || p.assetType === "etf";
      if (filterType === "options") return p.assetType === "option";
      return true;
    });
  }, [greeks, filterType, searchQuery]);

  if (isLoading) {
    return (
      <div className="panel-box p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="h-24 bg-white/5 rounded" />
          <div className="h-24 bg-white/5 rounded" />
          <div className="h-24 bg-white/5 rounded" />
          <div className="h-24 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!greeks || greeks.positions.length === 0) {
    return (
      <div className="panel-box p-8 text-center space-y-3">
        <Scale className="h-10 w-10 text-muted-foreground mx-auto stroke-1" />
        <h3 className="text-base font-bold text-white font-display">No Positions Available for Greeks Analysis</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Add stock, ETF, or options positions in your Portfolio to view live Beta-Weighted SPX Delta and Net Portfolio Delta breakdowns.
        </p>
      </div>
    );
  }

  const isBullish = greeks.totalSpyBetaDelta > 30;
  const isBearish = greeks.totalSpyBetaDelta < -30;

  return (
    <div className="space-y-6">
      {/* Top Banner: Concept Explanation & Benchmark Reference */}
      <div className="panel-box p-5 sm:p-6 bg-gradient-to-r from-[#11141c] via-[#131722] to-[#11141c] border border-white/10 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Scale className="h-4 w-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight">
                SPX Beta-Weighted Delta & Portfolio Delta Breakdown
              </h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              <strong className="text-white">SPX Delta</strong> standardizes your diversified portfolio against the S&P 500 index using statistical covariance (Beta). In contrast, <strong className="text-white">Portfolio Delta</strong> sums your raw share directional exposures across individual tickers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 font-mono text-xs shrink-0 p-3 rounded-lg bg-black/40 border border-white/10">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Benchmark S&P 500</span>
              <span className="font-bold text-white text-sm">SPY ${greeks.benchmark.spySpot.toFixed(2)}</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Index Equivalent</span>
              <span className="font-bold text-sky-400 text-sm">SPX ~{greeks.benchmark.spxSpot.toFixed(0)}</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Market Bias</span>
              <span
                className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${
                  isBullish
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : isBearish
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                }`}
              >
                {greeks.directionalBias.label.split(" ")[0]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: SPX Beta-Weighted Delta */}
        <div className="panel-box p-4 sm:p-5 space-y-2 border-sky-500/20 bg-sky-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-sky-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> SPX Beta-Weighted Delta
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-zinc-500 hover:text-zinc-300">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[#141720] border-white/15 text-xs text-zinc-200 max-w-xs font-sans">
                  Measures sensitivity to a $1 move in the S&P 500 Index (SPX). Calculated by weighting every holding's delta by its price ratio to SPX and its statistical beta ($\beta$).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {greeks.totalSpxBetaDelta >= 0 ? "+" : ""}
              {greeks.totalSpxBetaDelta.toFixed(2)}{" "}
              <span className="text-xs font-normal text-sky-400">Δ SPX</span>
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-white/[0.06] text-[11px] font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>SPY Equivalent:</span>
              <span className="text-white font-bold">
                {greeks.totalSpyBetaDelta >= 0 ? "+" : ""}
                {greeks.totalSpyBetaDelta.toFixed(1)} Δ SPY
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Per $1 SPY Move:</span>
              <span className="text-sky-300 font-bold">
                {greeks.totalSpyBetaDelta >= 0 ? "+$" : "-$"}
                {Math.abs(greeks.totalSpyBetaDelta).toFixed(0)} P&L
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Portfolio Raw Directional Delta */}
        <div className="panel-box p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-400" /> Portfolio Net Delta
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-zinc-500 hover:text-zinc-300">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[#141720] border-white/15 text-xs text-zinc-200 max-w-xs font-sans">
                  The arithmetic sum of all share-equivalent deltas across your stocks, ETFs, and short/long options without market benchmark weighting.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
            {greeks.netPortfolioDelta >= 0 ? "+" : ""}
            {greeks.netPortfolioDelta.toFixed(0)}{" "}
            <span className="text-xs font-normal text-zinc-400">Shares</span>
          </div>

          <div className="space-y-1 pt-1 border-t border-white/[0.06] text-[11px] font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>Equity Shares:</span>
              <span className="text-emerald-400 font-bold">+{greeks.totalEquityDelta.toFixed(0)} Δ</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Options Hedge Delta:</span>
              <span className={`font-bold ${greeks.totalOptionDelta < 0 ? "text-amber-400" : "text-zinc-300"}`}>
                {greeks.totalOptionDelta >= 0 ? "+" : ""}
                {greeks.totalOptionDelta.toFixed(0)} Δ
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: 1% S&P 500 Market Shock Impact */}
        <div className="panel-box p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> 1% S&P 500 Shock ($ Impact)
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-zinc-500 hover:text-zinc-300">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[#141720] border-white/15 text-xs text-zinc-200 max-w-xs font-sans">
                  The dollar amount your portfolio is projected to gain or lose if the broad S&P 500 index moves up or down by exactly 1.0%.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
            {greeks.spx1PctDollarImpact >= 0 ? "+" : "−"}
            {fmtMoney(Math.abs(greeks.spx1PctDollarImpact))}
          </div>

          <div className="space-y-1 pt-1 border-t border-white/[0.06] text-[11px] font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>Portfolio P&L Shock:</span>
              <span className="text-white font-bold">
                {greeks.portfolioValue > 0
                  ? `${((greeks.spx1PctDollarImpact / greeks.portfolioValue) * 100).toFixed(2)}% / 1% SPX`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Dollar Delta (Delta $):</span>
              <span className="text-zinc-300 font-bold">{fmtMoney(greeks.totalDollarDelta)}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Portfolio Beta (vs SPX) & Hedging Guide */}
        <div className="panel-box p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Portfolio Beta (vs SPX)
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
            {greeks.effectivePortfolioBeta.toFixed(2)}β{" "}
            <span className="text-xs font-normal text-zinc-400">vs SPX</span>
          </div>

          <div className="space-y-1 pt-1 border-t border-white/[0.06] text-[11px] font-mono">
            <div className="flex justify-between text-zinc-400">
              <span>To Delta Neutral (0 Δ):</span>
              <span className="text-amber-400 font-bold">
                {greeks.hedgingGuide.spySharesToNeutral >= 0 ? "Buy" : "Short"}{" "}
                {Math.abs(greeks.hedgingGuide.spySharesToNeutral)} SPY
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Micro Futures (MES):</span>
              <span className="text-zinc-300 font-bold">
                {greeks.hedgingGuide.mesContractsToNeutral >= 0 ? "+" : ""}
                {greeks.hedgingGuide.mesContractsToNeutral} contract{Math.abs(greeks.hedgingGuide.mesContractsToNeutral) === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Formula & Calculation Methodology Banner */}
      <div className="panel-box p-5 sm:p-6 bg-[#0f1118] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold font-display text-white">
                How Portfolio Delta is Calculated
              </h3>
              <p className="text-xs text-zinc-400">
                Converting every position into its equivalent number of underlying shares: <span className="font-mono text-emerald-400">Portfolio Delta = Σ (quantity × delta × multiplier)</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowFormulaDetails(!showFormulaDetails)}
            className="text-xs text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 self-start sm:self-auto"
          >
            {showFormulaDetails ? "Hide Worked Example" : "Show Worked Example & Rules"}
          </button>
        </div>

        {showFormulaDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Stock & ETF Positions
                </div>
                <div className="font-mono text-emerald-300 text-[11px] bg-emerald-950/30 p-1.5 rounded border border-emerald-500/20">
                  Stock contribution = shares × 1 (multiplier = 1, delta = 1)
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Long shares carry delta of +1.0; short shares carry delta of -1.0. Multiplier is 1.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Option Contracts
                </div>
                <div className="font-mono text-sky-300 text-[11px] bg-sky-950/30 p-1.5 rounded border border-sky-500/20">
                  Option contribution = contracts × option delta × contract multiplier (100)
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Use negative quantities for short positions. Calls have positive delta (0 to +1); puts have negative delta (0 to -1).
                </p>
              </div>
            </div>

            {/* Standard Example Walkthrough */}
            <div className="p-4 rounded-lg bg-black/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-zinc-300">
                  Worked Example Walkthrough
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Total Delta = +240 Shares
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 text-[10px] uppercase">
                      <th className="pb-1.5">Position</th>
                      <th className="pb-1.5">Formula (Quantity × Delta × Multiplier)</th>
                      <th className="pb-1.5 text-right">Delta Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                    <tr>
                      <td className="py-1.5 font-semibold text-white">Long 200 shares</td>
                      <td className="py-1.5 text-zinc-400">200 × 1 × 1</td>
                      <td className="py-1.5 text-right font-bold text-emerald-400">+200</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-semibold text-white">Long 3 calls, delta 0.50</td>
                      <td className="py-1.5 text-zinc-400">3 × 0.50 × 100</td>
                      <td className="py-1.5 text-right font-bold text-emerald-400">+150</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-semibold text-white">Long 2 puts, delta −0.25</td>
                      <td className="py-1.5 text-zinc-400">2 × (−0.25) × 100</td>
                      <td className="py-1.5 text-right font-bold text-rose-400">−50</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-semibold text-white">Short 1 call, delta 0.60</td>
                      <td className="py-1.5 text-zinc-400">−1 × 0.60 × 100</td>
                      <td className="py-1.5 text-right font-bold text-rose-400">−60</td>
                    </tr>
                    <tr className="border-t border-white/10 font-bold bg-white/[0.02]">
                      <td className="py-2 text-white">Total Portfolio Delta</td>
                      <td className="py-2 text-zinc-300">200 + 150 − 50 − 60</td>
                      <td className="py-2 text-right text-emerald-400 text-xs">+240 shares</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 rounded bg-sky-950/20 border border-sky-500/20 text-xs text-sky-200 leading-relaxed font-sans">
                <strong>Real-World Meaning:</strong> The portfolio has approximately <strong>+240 shares</strong> of net delta exposure. A $1 increase in the underlying would theoretically increase the portfolio’s value by about <strong>+$240</strong>, while a $1 decrease would reduce it by about <strong>-$240</strong> (an approximation because option delta changes dynamically as spot price moves).
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Breakdown Section with View Toggle */}
      <div className="panel-box p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" />
              {viewMode === "underlyings" ? "Underlying Roll-up Breakdown" : "Individual Positions Breakdown (Q × Δ × M)"}
            </h3>
            <p className="text-xs text-zinc-400">
              {viewMode === "underlyings"
                ? `Consolidated share delta, option hedging, and beta weighting across ${underlyings.length} underlyings.`
                : `Line-by-line breakdown of each position's Quantity, Contract Delta, Multiplier, and Delta Contribution.`}
            </p>
          </div>

          {/* View Mode & Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switch */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => setViewMode("underlyings")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "underlyings" ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30" : "text-zinc-400 hover:text-white"
                }`}
              >
                Underlyings ({greeks.underlyings.length})
              </button>
              <button
                onClick={() => setViewMode("positions")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "positions" ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30" : "text-zinc-400 hover:text-white"
                }`}
              >
                Positions ({greeks.positions.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 font-mono focus:outline-none focus:border-sky-500/50 w-32 sm:w-40"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => setFilterType("all")}
                className={`px-2 py-1 rounded transition-colors ${
                  filterType === "all" ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("covered")}
                className={`px-2 py-1 rounded transition-colors ${
                  filterType === "covered" ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Covered
              </button>
              <button
                onClick={() => setFilterType("options")}
                className={`px-2 py-1 rounded transition-colors ${
                  filterType === "options" ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Options
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Table: Underlyings vs Positions */}
        {viewMode === "underlyings" ? (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-400 tracking-wider">
                  <th className="pb-2.5 font-medium">Underlying</th>
                  <th className="pb-2.5 font-medium text-right">Spot</th>
                  <th className="pb-2.5 font-medium text-right">Beta</th>
                  <th className="pb-2.5 font-medium text-right">Equity Shares</th>
                  <th className="pb-2.5 font-medium text-right">Option Delta</th>
                  <th className="pb-2.5 font-medium text-right text-emerald-400">Net Delta</th>
                  <th className="pb-2.5 font-medium text-right">$1 Move P&L</th>
                  <th className="pb-2.5 font-medium text-right">Coverage</th>
                  <th className="pb-2.5 font-medium text-right text-sky-400">SPX Beta Delta</th>
                  <th className="pb-2.5 font-medium text-right">1% SPX Shock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {underlyings.map((u) => (
                  <tr
                    key={u.symbol}
                    onClick={() => onSelectSymbol?.(u.symbol)}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    {/* Symbol & Name */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <CompanyLogo symbol={u.symbol} size="xs" />
                        <div>
                          <div className="font-bold text-white group-hover:text-sky-400 transition-colors">
                            {u.symbol}
                          </div>
                          {u.description && (
                            <div className="text-[10px] text-zinc-500 truncate max-w-[130px] font-sans">
                              {u.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Spot Price */}
                    <td className="py-3 text-right text-white font-semibold">
                      {fmtMoney(u.spot)}
                    </td>

                    {/* Beta */}
                    <td className="py-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          u.beta > 1.4
                            ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                            : u.beta < 0.8
                            ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                            : "text-zinc-300 bg-white/5"
                        }`}
                      >
                        {u.beta.toFixed(2)}β
                      </span>
                    </td>

                    {/* Equity Shares */}
                    <td className="py-3 text-right text-zinc-300">
                      {u.equityShares > 0 ? `+${u.equityShares}` : u.equityShares}
                    </td>

                    {/* Option Delta */}
                    <td className="py-3 text-right">
                      {u.optionDelta !== 0 ? (
                        <span className={u.optionDelta < 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                          {u.optionDelta >= 0 ? "+" : ""}
                          {u.optionDelta.toFixed(0)} Δ
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Net Delta */}
                    <td className="py-3 text-right font-bold text-emerald-400">
                      {u.netDelta >= 0 ? "+" : ""}
                      {u.netDelta.toFixed(0)} Δ
                    </td>

                    {/* $1 Move P&L */}
                    <td className="py-3 text-right font-semibold text-white">
                      {u.perDollarMoveImpact >= 0 ? "+$" : "-$"}
                      {Math.abs(u.perDollarMoveImpact).toFixed(0)}
                    </td>

                    {/* Coverage */}
                    <td className="py-3 text-right">
                      {u.equityShares >= 100 ? (
                        u.coverageRatio >= 80 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {u.coverageRatio}% Covered
                          </span>
                        ) : u.coverageRatio > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            {u.coverageRatio}% Covered
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                            Unhedged
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-600 text-[10px]">&lt;100 sh</span>
                      )}
                    </td>

                    {/* SPX Beta Delta */}
                    <td className="py-3 text-right font-bold text-sky-400">
                      {u.spxBetaDelta >= 0 ? "+" : ""}
                      {u.spxBetaDelta.toFixed(2)}
                    </td>

                    {/* 1% SPX Shock */}
                    <td className="py-3 text-right font-semibold text-zinc-200">
                      {u.spx1PctDollarImpact >= 0 ? "+" : "−"}
                      {fmtMoney(Math.abs(u.spx1PctDollarImpact))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Position-Level Line-by-Line Breakdown (Q * Delta * Multiplier) */
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-400 tracking-wider">
                  <th className="pb-2.5 font-medium">Position</th>
                  <th className="pb-2.5 font-medium">Type</th>
                  <th className="pb-2.5 font-medium text-right">Quantity (Q)</th>
                  <th className="pb-2.5 font-medium text-right">Contract Δ</th>
                  <th className="pb-2.5 font-medium text-right">Multiplier (M)</th>
                  <th className="pb-2.5 font-medium text-right text-zinc-400">Calculation</th>
                  <th className="pb-2.5 font-medium text-right text-emerald-400">Delta Contribution</th>
                  <th className="pb-2.5 font-medium text-right">$1 Underlying Move</th>
                  <th className="pb-2.5 font-medium text-right text-sky-400">SPX Beta Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredPositions.map((p, idx) => {
                  const isStock = p.assetType === "stock" || p.assetType === "etf";
                  const calcString = isStock
                    ? `${p.quantity} × 1 × 1`
                    : `${p.quantity} × ${p.contractDelta.toFixed(2)} × ${p.multiplier}`;

                  return (
                    <tr
                      key={p.id ?? `${p.symbol}-${idx}`}
                      onClick={() => onSelectSymbol?.(p.symbol)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Position Symbol & Option Details */}
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <CompanyLogo symbol={p.symbol} size="xs" />
                          <div>
                            <div className="font-bold text-white group-hover:text-sky-400 transition-colors">
                              {p.symbol}
                              {p.optionDetails && (
                                <span className="ml-1.5 text-xs text-sky-300 font-normal">
                                  ${p.optionDetails.strike} {p.optionDetails.optionType.toUpperCase()} ({p.optionDetails.expiry})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[150px]">
                              Spot {fmtMoney(p.spot)} · Beta {p.beta.toFixed(2)}β
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isStock
                              ? "bg-white/10 text-zinc-300"
                              : p.optionDetails?.optionType === "call"
                              ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                              : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {isStock ? "Equity" : `${p.quantity < 0 ? "Short" : "Long"} ${p.optionDetails?.optionType?.toUpperCase()}`}
                        </span>
                      </td>

                      {/* Quantity (Q) */}
                      <td className="py-3 text-right font-bold text-white">
                        {p.quantity > 0 ? `+${p.quantity}` : p.quantity}
                      </td>

                      {/* Contract Delta */}
                      <td className="py-3 text-right">
                        <span className={p.contractDelta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {p.contractDelta >= 0 ? "+" : ""}
                          {p.contractDelta.toFixed(2)}
                        </span>
                      </td>

                      {/* Multiplier (M) */}
                      <td className="py-3 text-right text-zinc-400">
                        {p.multiplier}×
                      </td>

                      {/* Calculation String */}
                      <td className="py-3 text-right text-zinc-400 font-mono text-[11px]">
                        {calcString}
                      </td>

                      {/* Delta Contribution */}
                      <td className="py-3 text-right font-bold text-emerald-400">
                        {p.positionDelta >= 0 ? "+" : ""}
                        {p.positionDelta.toFixed(1)} Δ
                      </td>

                      {/* $1 Underlying Move Impact */}
                      <td className="py-3 text-right font-semibold text-white">
                        {p.perDollarMoveImpact >= 0 ? "+$" : "-$"}
                        {Math.abs(p.perDollarMoveImpact).toFixed(1)}
                      </td>

                      {/* SPX Beta Delta */}
                      <td className="py-3 text-right font-bold text-sky-400">
                        {p.spxBetaDelta >= 0 ? "+" : ""}
                        {p.spxBetaDelta.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
