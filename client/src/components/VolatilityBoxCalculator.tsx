import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtMoney } from "@/lib/format";
import { VolatilityConeChart } from "./VolatilityConeChart";
import { CompanyLogo } from "./CompanyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Search,
  Zap,
  TrendingUp,
  Shield,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  HelpCircle,
} from "lucide-react";

const QUICK_SYMBOLS = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "MSFT", "AMD", "IWM"];

export function VolatilityBoxCalculator({
  initialSymbol = "SPY",
}: {
  initialSymbol?: string;
}) {
  const [symbolInput, setSymbolInput] = useState(initialSymbol);
  const [activeSymbol, setActiveSymbol] = useState(initialSymbol);
  const [dte, setDte] = useState(22);
  const [ivShock, setIvShock] = useState(0); // in percent (-30 to +50)

  const { data, isLoading, error } =
    trpc.analytics.expectedMoveLookup.useQuery(
      {
        symbol: activeSymbol,
        dte,
        ivShockPct: ivShock,
      },
      {
        staleTime: 60_000,
      },
    );

  const report = data?.report;
  const spot = report?.spot ?? 0;
  const iv = report?.iv30 ?? 0.25;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbolInput.trim()) {
      setActiveSymbol(symbolInput.trim().toUpperCase());
    }
  };

  const handleQuickSelect = (sym: string) => {
    setSymbolInput(sym);
    setActiveSymbol(sym);
  };

  return (
    <div className="panel-box p-5 sm:p-7 space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <CompanyLogo symbol={activeSymbol} size="sm" />
            <h2 className="text-lg sm:text-xl font-bold font-display text-white flex items-center gap-2">
              <span>{activeSymbol}</span>
              <span className="text-zinc-400 text-sm font-normal">· Volatility Box & Expected Move Simulator</span>
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            Grounded in statistical volatility research (IV × √t & 85% ATM Straddle Breakeven).
          </p>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              placeholder="e.g. SPY, NVDA"
              className="pl-8 w-36 sm:w-44 h-8 text-xs font-mono bg-black/50 border-white/15 text-white uppercase placeholder:text-zinc-600"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-8 px-3 text-xs font-mono font-bold bg-sky-500 text-black hover:bg-sky-400 cursor-pointer"
          >
            Calculate
          </Button>
        </form>
      </div>

      {/* Quick Ticker Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-mono text-zinc-500 mr-1">Quick Scenarios:</span>
        {QUICK_SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleQuickSelect(s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              activeSymbol === s
                ? "bg-sky-500/20 border border-sky-500/50 text-sky-300 font-bold"
                : "bg-white/[0.03] border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.07]"
            }`}
          >
            <CompanyLogo symbol={s} size="xs" />
            <span>{s}</span>
          </button>
        ))}
      </div>

      {/* Controls: DTE and IV Shock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-black/30 border border-white/[0.08]">
        {/* DTE Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-300 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-sky-400" /> Time Horizon (DTE):
            </span>
            <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">
              {dte} Days ({dte === 1 ? "Daily" : dte === 7 ? "Weekly" : dte === 30 ? "Monthly" : "Custom"})
            </span>
          </div>
          <Slider
            value={[dte]}
            onValueChange={([v]) => setDte(v)}
            min={1}
            max={90}
            step={1}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <button
              type="button"
              onClick={() => setDte(1)}
              className="hover:text-sky-400 cursor-pointer"
            >
              1D (Daily)
            </button>
            <button
              type="button"
              onClick={() => setDte(7)}
              className="hover:text-sky-400 cursor-pointer"
            >
              7D (Weekly)
            </button>
            <button
              type="button"
              onClick={() => setDte(22)}
              className="hover:text-sky-400 cursor-pointer"
            >
              22D (Monthly Exp)
            </button>
            <button
              type="button"
              onClick={() => setDte(45)}
              className="hover:text-sky-400 cursor-pointer"
            >
              45D (Tasty Standard)
            </button>
            <button
              type="button"
              onClick={() => setDte(90)}
              className="hover:text-sky-400 cursor-pointer"
            >
              90D (Quarterly)
            </button>
          </div>
        </div>

        {/* IV Stress Shock */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-300 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> IV Shock / Stress Test:
            </span>
            <span
              className={`font-bold px-2 py-0.5 rounded ${
                ivShock > 0
                  ? "text-rose-400 bg-rose-500/10"
                  : ivShock < 0
                    ? "text-sky-400 bg-sky-500/10"
                    : "text-zinc-300 bg-white/10"
              }`}
            >
              {ivShock > 0 ? `+${ivShock}% IV Expansion` : ivShock < 0 ? `${ivShock}% IV Crush` : "Baseline IV"}
            </span>
          </div>
          <Slider
            value={[ivShock]}
            onValueChange={([v]) => setIvShock(v)}
            min={-30}
            max={50}
            step={5}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <button
              type="button"
              onClick={() => setIvShock(-20)}
              className="hover:text-cyan-400 cursor-pointer"
            >
              -20% (Post-Earnings Crush)
            </button>
            <button
              type="button"
              onClick={() => setIvShock(0)}
              className="hover:text-white cursor-pointer"
            >
              0% (Baseline)
            </button>
            <button
              type="button"
              onClick={() => setIvShock(25)}
              className="hover:text-rose-400 cursor-pointer"
            >
              +25% (VIX Spike)
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-xs font-mono text-zinc-400 animate-pulse">
          Computing Black-Scholes Greeks and Volatility Box levels for {activeSymbol}…
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-destructive/10 border border-destructive/30 text-xs font-mono text-destructive">
          Error computing expected move: {error.message}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Top KPI Cards: Multi-Horizon Moves */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1D Move */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 space-y-1">
              <div className="meta-label text-[10px]">1-Day Expected Move</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                ±${report.horizons.daily1D?.dollar.toFixed(2) ?? "—"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                ±{((report.horizons.daily1D?.pct ?? 0) * 100).toFixed(2)}% (1D)
              </div>
            </div>

            {/* 1W Move */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 space-y-1">
              <div className="meta-label text-[10px]">1-Week Move (7D)</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                ±${report.horizons.weekly1W?.dollar.toFixed(2) ?? "—"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                ±{((report.horizons.weekly1W?.pct ?? 0) * 100).toFixed(2)}% (7D)
              </div>
            </div>

            {/* Selected Horizon Move */}
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3.5 space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                {dte}-Day Horizon Move (1σ)
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                ±${report.expectedMove1Sigma?.toFixed(2) ?? "—"}
              </div>
              <div className="text-[11px] font-mono text-sky-300">
                ±{(((report.expectedMove1Sigma ?? 0) / spot) * 100).toFixed(2)}% (68.2% Conf)
              </div>
            </div>

            {/* 30D / Monthly Move */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 space-y-1">
              <div className="meta-label text-[10px]">30-Day Move (1σ)</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                ±${report.horizons.monthly30D?.dollar.toFixed(2) ?? "—"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                ±{((report.horizons.monthly30D?.pct ?? 0) * 100).toFixed(2)}% (30D)
              </div>
            </div>
          </div>

          {/* Volatility Cone Chart */}
          <div className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                Dynamic Volatility Cone ({activeSymbol})
              </h3>
              <span className="text-xs font-mono text-zinc-400">
                Implied Volatility: <strong className="text-white">{(iv * 100).toFixed(1)}%</strong>
              </span>
            </div>
            <VolatilityConeChart spot={spot} iv={iv} dte={dte} symbol={activeSymbol} />
          </div>

          {/* Volatility Box Levels Table & ATM Straddle Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Volatility Box Matrix */}
            <div className="lg:col-span-2 space-y-3 p-4 rounded-lg bg-black/40 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-sky-400" />
                  Volatility Box Price Levels ({dte} DTE)
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Spot: <strong className="text-white">{fmtMoney(spot)}</strong>
                </span>
              </div>

              {report.boxLevels && (
                <div className="space-y-1.5 font-mono text-xs">
                  {/* +3σ Extreme */}
                  <div className="flex items-center justify-between p-2 rounded bg-rose-500/5 border border-rose-500/20 text-rose-300">
                    <span className="font-bold flex items-center gap-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
                      R3 (+3σ Upper Extreme · 99.7%)
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.r3)}</span>
                      <span className="text-[10px] text-rose-400 ml-2">
                        +{(((report.boxLevels.r3 - spot) / spot) * 100).toFixed(1)}%
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
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.r2)}</span>
                      <span className="text-[10px] text-amber-400 ml-2">
                        +{(((report.boxLevels.r2 - spot) / spot) * 100).toFixed(1)}%
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
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.r1)}</span>
                      <span className="text-[10px] text-sky-400 ml-2">
                        +{(((report.boxLevels.r1 - spot) / spot) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Current Spot Reference */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-white/10 border border-white/20 text-white font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white inline-block" />
                      Current Reference Spot Price
                    </span>
                    <span className="text-base text-white">{fmtMoney(spot)}</span>
                  </div>

                  {/* -1σ Expected Move Lower */}
                  <div className="flex items-center justify-between p-2 rounded bg-sky-500/5 border border-sky-500/20 text-sky-300">
                    <span className="font-bold flex items-center gap-1.5">
                      <ArrowDownRight className="h-3.5 w-3.5 text-sky-400" />
                      S1 (−1σ Expected Move Lower · 68.2%)
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.s1)}</span>
                      <span className="text-[10px] text-sky-400 ml-2">
                        −{(((spot - report.boxLevels.s1) / spot) * 100).toFixed(1)}%
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
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.s2)}</span>
                      <span className="text-[10px] text-cyan-400 ml-2">
                        −{(((spot - report.boxLevels.s2) / spot) * 100).toFixed(1)}%
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
                      <span className="font-bold text-white">{fmtMoney(report.boxLevels.s3)}</span>
                      <span className="text-[10px] text-rose-400 ml-2">
                        −{(((spot - report.boxLevels.s3) / spot) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ATM Straddle & Option Market Edge */}
            <div className="space-y-4 p-4 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2 border-b border-white/10 pb-2.5">
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                  ATM Straddle Market Price
                </div>

                {report.atmStraddle ? (
                  <div className="space-y-2.5 font-mono text-xs">
                    <div className="p-2.5 rounded bg-white/[0.03] border border-white/10 space-y-1.5">
                      <div className="flex justify-between text-zinc-400 text-[11px]">
                        <span>Expiry Date:</span>
                        <span className="text-white font-bold">{report.atmStraddle.expiry} ({report.atmStraddle.dte}d)</span>
                      </div>
                      <div className="flex justify-between text-zinc-400 text-[11px]">
                        <span>ATM Strike:</span>
                        <span className="text-white font-bold">${report.atmStraddle.strike}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400 text-[11px]">
                        <span>Call / Put Mid:</span>
                        <span className="text-white font-bold">
                          ${report.atmStraddle.callMid.toFixed(2)} / ${report.atmStraddle.putMid.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-300 pt-1 border-t border-white/10">
                        <span>Total Straddle:</span>
                        <span className="text-white font-bold">${report.atmStraddle.straddlePrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-cyan-500/10 border border-cyan-500/30 space-y-1 text-center">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                        Straddle-Implied Move (85% Rule)
                      </div>
                      <div className="text-xl font-bold text-white">
                        ±${report.atmStraddle.expectedMove.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Market Pricing: <strong className="text-cyan-300">{report.atmStraddle.pricingStatus}</strong> (
                        {report.atmStraddle.straddleIvDiffPct > 0 ? "+" : ""}
                        {report.atmStraddle.straddleIvDiffPct}% vs IV formula)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-white/[0.02] border border-white/10 text-xs font-mono text-zinc-400 text-center">
                    Option chain not currently active for real-time straddle mid pricing. Formula IV EM is active.
                  </div>
                )}
              </div>

              <div className="p-3 rounded bg-white/[0.02] border border-white/5 space-y-1.5 text-[11px] text-zinc-400 font-sans">
                <div className="font-mono font-bold text-white flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 text-sky-400" />
                  VolatilityBox Edge Principle
                </div>
                <p className="leading-relaxed">
                  Selling credit spreads or covered calls outside the $1\sigma$ or $2\sigma$ Volatility Box levels gives a statistical win-rate probability $\ge 68.2\%$ to $95.4\%$.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
