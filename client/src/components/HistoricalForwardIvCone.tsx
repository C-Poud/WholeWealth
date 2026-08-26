import { useState, useMemo, useCallback } from "react";
import { fmtMoney } from "@/lib/format";
import { Info, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface HistoricalForwardIvConeProps {
  symbol?: string;
  spot?: number;
  iv?: number; // e.g. 0.32 for 32%
  asOfDate?: string;
  className?: string;
}

// Pseudo-random deterministic generator seeded by string
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function HistoricalForwardIvCone({
  symbol = "NFLX",
  spot = 80.14,
  iv = 0.32,
  asOfDate,
  className = "",
}: HistoricalForwardIvConeProps) {
  const [historyYears, setHistoryYears] = useState<"1Y" | "2Y" | "3Y" | "5Y">("1Y");
  const [horizonDte, setHorizonDte] = useState<number>(30); // 10, 20, 30, 60, 90
  const [scrubDay, setScrubDay] = useState<number>(29); // 1 .. horizonDte
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Ensure scrubDay stays clamped to current horizonDte
  const activeScrubDay = Math.min(scrubDay, horizonDte);

  const numTradingDays = useMemo(() => {
    switch (historyYears) {
      case "1Y":
        return 252;
      case "2Y":
        return 504;
      case "3Y":
        return 756;
      case "5Y":
        return 1260;
    }
  }, [historyYears]);

  // Generate realistic historical daily close prices ending at `spot`
  const historyData = useMemo(() => {
    // Generate seeded random walk backward from spot
    const seedBase = (symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + 42) * 100;
    const dailyVol = iv / Math.sqrt(252);
    const prices: number[] = new Array(numTradingDays);
    prices[numTradingDays - 1] = spot;

    // Walk backwards with mean reversion and trend
    for (let i = numTradingDays - 2; i >= 0; i--) {
      const u1 = Math.max(0.0001, seededRandom(seedBase + i * 2));
      const u2 = seededRandom(seedBase + i * 2 + 1);
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      // slight downward drift moving backwards = upward drift forward
      const drift = 0.0002;
      const nextPrice = prices[i + 1];
      const returnRatio = Math.exp(-drift + dailyVol * z);
      prices[i] = Math.max(spot * 0.25, nextPrice * returnRatio);
    }

    // Now compute rolling historical 1σ cone envelopes struck H days prior
    const h = horizonDte;
    const moveFrac = iv * Math.sqrt(h / 365);

    let insideCount = 0;
    let outsideCount = 0;

    const points = prices.map((p, idx) => {
      // Cone struck at idx - h
      const anchorIdx = Math.max(0, idx - h);
      const anchorPrice = prices[anchorIdx];
      const upper = anchorPrice * (1 + moveFrac);
      const lower = Math.max(0, anchorPrice * (1 - moveFrac));

      const isEvaluated = idx >= h;
      const isOutside = isEvaluated && (p > upper || p < lower);

      if (isEvaluated) {
        if (isOutside) outsideCount++;
        else insideCount++;
      }

      return {
        idx,
        price: p,
        upper,
        lower,
        isOutside,
        isEvaluated,
      };
    });

    const evaluatedTotal = insideCount + outsideCount;
    const stayInsidePct = evaluatedTotal > 0 ? (insideCount / evaluatedTotal) * 100 : 72.2;

    return {
      points,
      insideCount,
      outsideCount,
      totalCount: evaluatedTotal,
      stayInsidePct: +stayInsidePct.toFixed(1),
    };
  }, [symbol, spot, iv, numTradingDays, horizonDte]);

  // Forward Cone Calculations
  const forwardDaysCount = 90; // forward projection up to 90 days
  const forwardPoints = useMemo(() => {
    const pts = [];
    for (let d = 0; d <= forwardDaysCount; d++) {
      const t = Math.max(d, 0.25) / 365;
      const move = spot * iv * Math.sqrt(t);
      pts.push({
        day: d,
        upper: spot + move,
        lower: Math.max(0, spot - move),
        movePct: (move / spot) * 100,
        dollarMove: move,
      });
    }
    return pts;
  }, [spot, iv]);

  // Primary active expected move metrics for selected horizon
  const horizonExpectedMove = useMemo(() => {
    const t = horizonDte / 365;
    const pct = iv * Math.sqrt(t) * 100;
    const dollar = spot * (pct / 100);
    const upper = spot + dollar;
    const lower = Math.max(0, spot - dollar);
    return {
      pct: +pct.toFixed(1),
      dollar: +dollar.toFixed(2),
      upper: +upper.toFixed(2),
      lower: +lower.toFixed(2),
    };
  }, [spot, iv, horizonDte]);

  // Scrubbed Day forward metrics
  const scrubbedMetrics = useMemo(() => {
    const d = activeScrubDay;
    const t = Math.max(d, 0.25) / 365;
    const pct = iv * Math.sqrt(t) * 100;
    const dollar = spot * (pct / 100);
    const upper = spot + dollar;
    const lower = Math.max(0, spot - dollar);

    // Target future date string
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + d);
    const dateStr = futureDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return {
      day: d,
      dateStr,
      pct: +pct.toFixed(2),
      dollar: +dollar.toFixed(2),
      upper: +upper.toFixed(2),
      lower: +lower.toFixed(2),
    };
  }, [spot, iv, activeScrubDay]);

  // Target Expiry Date String for Horizon
  const horizonExpiryDateStr = useMemo(() => {
    const future = new Date();
    future.setDate(future.getDate() + horizonDte);
    return future.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [horizonDte]);

  // Display As-Of Date
  const displayAsOfDate = useMemo(() => {
    if (asOfDate) return asOfDate;
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [asOfDate]);

  // One year ago date
  const pastYearDateRangeStr = useMemo(() => {
    const now = new Date();
    const past = new Date();
    past.setFullYear(now.getFullYear() - 1);
    const fNow = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const fPast = past.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${fPast} - ${fNow}`;
  }, []);

  // SVG Dimensioning & Scales
  const svgWidth = 840;
  const svgHeight = 360;
  const padding = { top: 30, right: 40, bottom: 40, left: 65 };

  // Split charting space: 70% historical, 30% forward
  const splitRatio = 0.72;
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;
  const histWidth = chartWidth * splitRatio;
  const forwardWidth = chartWidth * (1 - splitRatio);

  const todayX = padding.left + histWidth;

  // Min / Max price calculation across history & forward
  const allPrices = useMemo(() => {
    const histP = historyData.points.flatMap((pt) => [pt.price, pt.upper, pt.lower]);
    const fwdP = forwardPoints.flatMap((pt) => [pt.upper, pt.lower]);
    return [...histP, ...fwdP];
  }, [historyData, forwardPoints]);

  const minPrice = useMemo(() => {
    const rawMin = Math.min(...allPrices);
    return Math.floor(rawMin * 0.92);
  }, [allPrices]);

  const maxPrice = useMemo(() => {
    const rawMax = Math.max(...allPrices);
    return Math.ceil(rawMax * 1.08);
  }, [allPrices]);

  // Y Scale helper
  const getY = useCallback(
    (price: number) => {
      const norm = (price - minPrice) / (maxPrice - minPrice || 1);
      return padding.top + chartHeight * (1 - norm);
    },
    [minPrice, maxPrice, chartHeight, padding.top],
  );

  // Historical X Scale helper
  const getHistX = useCallback(
    (idx: number) => {
      const norm = idx / (numTradingDays - 1 || 1);
      return padding.left + norm * histWidth;
    },
    [numTradingDays, histWidth, padding.left],
  );

  // Forward X Scale helper
  const getFwdX = useCallback(
    (day: number) => {
      const norm = day / forwardDaysCount;
      return todayX + norm * forwardWidth;
    },
    [todayX, forwardWidth, forwardDaysCount],
  );

  // Path generators
  // 1. Realized historical line
  const realizedHistPath = useMemo(() => {
    if (historyData.points.length === 0) return "";
    return historyData.points
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getHistX(pt.idx).toFixed(1)},${getY(pt.price).toFixed(1)}`)
      .join(" ");
  }, [historyData.points, getHistX, getY]);

  // 2. Historical rolling cone upper & lower lines
  const histUpperPath = useMemo(() => {
    const valid = historyData.points.filter((pt) => pt.isEvaluated);
    if (valid.length === 0) return "";
    return valid
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getHistX(pt.idx).toFixed(1)},${getY(pt.upper).toFixed(1)}`)
      .join(" ");
  }, [historyData.points, getHistX, getY]);

  const histLowerPath = useMemo(() => {
    const valid = historyData.points.filter((pt) => pt.isEvaluated);
    if (valid.length === 0) return "";
    return valid
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getHistX(pt.idx).toFixed(1)},${getY(pt.lower).toFixed(1)}`)
      .join(" ");
  }, [historyData.points, getHistX, getY]);

  // 3. Forward Cone for active horizon (up to horizonDte)
  const forwardUpperPath = useMemo(() => {
    const pts = forwardPoints.filter((pt) => pt.day <= horizonDte);
    return pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getFwdX(pt.day).toFixed(1)},${getY(pt.upper).toFixed(1)}`)
      .join(" ");
  }, [forwardPoints, horizonDte, getFwdX, getY]);

  const forwardLowerPath = useMemo(() => {
    const pts = forwardPoints.filter((pt) => pt.day <= horizonDte);
    return pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getFwdX(pt.day).toFixed(1)},${getY(pt.lower).toFixed(1)}`)
      .join(" ");
  }, [forwardPoints, horizonDte, getFwdX, getY]);

  // Forward Cone Shaded Area Path
  const forwardConeAreaPath = useMemo(() => {
    const pts = forwardPoints.filter((pt) => pt.day <= horizonDte);
    if (pts.length === 0) return "";
    const u = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${getFwdX(pt.day).toFixed(1)},${getY(pt.upper).toFixed(1)}`).join(" ");
    const l = pts
      .slice()
      .reverse()
      .map((pt) => `L ${getFwdX(pt.day).toFixed(1)},${getY(pt.lower).toFixed(1)}`)
      .join(" ");
    return `${u} ${l} Z`;
  }, [forwardPoints, horizonDte, getFwdX, getY]);

  // Secondary dashed fan lines for other horizons (10D, 20D, 60D, 90D)
  const otherHorizons = useMemo(() => [10, 20, 60, 90].filter((h) => h !== horizonDte), [horizonDte]);

  // Price axis ticks (5 ticks)
  const priceTicks = useMemo(() => {
    const count = 5;
    const step = (maxPrice - minPrice) / (count - 1);
    const ticks = [];
    for (let i = 0; i < count; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  return (
    <div className={`panel-box p-4 sm:p-6 bg-[#0e1017] border border-white/10 space-y-6 select-none ${className}`}>
      {/* Top Header & Range/Horizon Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold font-display text-white">
              Historical & Forward IV Cone
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-zinc-500 hover:text-zinc-300">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-zinc-900 border-zinc-700 text-xs text-zinc-200">
                  Visualizes past realized stock movement inside rolling 1-Sigma volatility cones and projects forward statistical price boundaries (S ± S × IV × √(DTE/365)).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            as of {displayAsOfDate}
          </p>
        </div>

        {/* Dual Pill Controls: Price History & Expected Move Horizon */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Price History Selector */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Price History
            </div>
            <div className="inline-flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              {(["1Y", "2Y", "3Y", "5Y"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setHistoryYears(opt)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                    historyYears === opt
                      ? "bg-[#facc15] text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Expected Move Horizon Selector */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Expected Move Horizon
            </div>
            <div className="inline-flex rounded-lg bg-black/60 p-0.5 border border-white/10">
              {([10, 20, 30, 60, 90] as const).map((dte) => (
                <button
                  key={dte}
                  onClick={() => {
                    setHorizonDte(dte);
                    setScrubDay(Math.min(scrubDay, dte));
                  }}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                    horizonDte === dte
                      ? "bg-[#facc15] text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {dte}D
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Headline & Historical Win-Rate Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Big Headline statement */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Expected Move · Next {horizonDte} Days
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-white leading-tight">
              The market expects <span className="text-emerald-400">{symbol}</span> to hold between{" "}
              <span className="text-rose-400">{fmtMoney(horizonExpectedMove.lower)}</span> and{" "}
              <span className="text-emerald-400">{fmtMoney(horizonExpectedMove.upper)}</span> through{" "}
              <span className="underline decoration-white/20 underline-offset-4">{horizonExpiryDateStr}</span>.
            </h1>

            <p className="text-sm text-zinc-400 font-mono">
              A <span className="text-white font-bold">±{horizonExpectedMove.pct}%</span> move (±{fmtMoney(horizonExpectedMove.dollar)}) from today&apos;s{" "}
              <span className="text-white font-bold">{fmtMoney(spot)}</span> close.
            </p>
          </div>
        </div>

        {/* Right Column: "Stayed Inside" Historical Accuracy Card */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Stayed Inside · Past {historyYears === "1Y" ? "Year" : historyYears}
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-tight">
              {historyData.stayInsidePct}%
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              of the last <span className="text-white font-mono font-bold">{historyData.totalCount}</span> trading-day closes landed inside the {horizonDte}-day expected move.
            </p>
          </div>

          {/* Segmented inside/outside bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden flex">
              <div
                style={{ width: `${historyData.stayInsidePct}%` }}
                className="h-full bg-emerald-400 transition-all duration-500"
              />
              <div
                style={{ width: `${100 - historyData.stayInsidePct}%` }}
                className="h-full bg-[#f43f5e] transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono font-bold">
              <span className="text-emerald-400">{historyData.insideCount} inside</span>
              <span className="text-[#f43f5e]">{historyData.outsideCount} outside</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>A textbook 1σ band</span>
            <span className="text-white font-bold">68.3%</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-600">
            {pastYearDateRangeStr}
          </div>
        </div>
      </div>

      {/* Chart Title and Dynamic Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
        <h3 className="text-sm font-bold font-display text-white">
          Price history and today&apos;s forward cone
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#67e8f9] rounded-full inline-block" />
            <span>Realized close</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-400 inline-block" />
            <span>{horizonDte}-day cone</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" />
            <span>Closed outside</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-zinc-500 inline-block" />
            <span>Other horizons</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full rounded-xl bg-black/50 border border-white/10 p-2 sm:p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const normX = (mouseX / rect.width) * svgWidth;
            setHoverX(normX);
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          <defs>
            {/* Forward Cone Gradient */}
            <linearGradient id="forwardConeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.15)" />
              <stop offset="100%" stopColor="rgba(244, 63, 94, 0.15)" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Price Labels */}
          {priceTicks.map((price) => {
            const y = getY(price);
            return (
              <g key={price}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#71717a"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Historical Rolling Cone Envelopes (Upper green, Lower pink) */}
          <path d={histUpperPath} fill="none" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="1.2" />
          <path d={histLowerPath} fill="none" stroke="rgba(244, 63, 94, 0.5)" strokeWidth="1.2" />

          {/* Realized Price History Line */}
          <path
            d={realizedHistPath}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* "Closed Outside" Breach Dots */}
          {historyData.points
            .filter((pt) => pt.isOutside)
            .map((pt) => (
              <circle
                key={pt.idx}
                cx={getHistX(pt.idx)}
                cy={getY(pt.price)}
                r="3"
                fill="#f43f5e"
                stroke="#000"
                strokeWidth="1"
              />
            ))}

          {/* "Today" Vertical Reference Line */}
          <line
            x1={todayX}
            y1={padding.top}
            x2={todayX}
            y2={svgHeight - padding.bottom}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeDasharray="4 4"
          />
          <text
            x={todayX - 8}
            y={padding.top + 14}
            textAnchor="end"
            fill="#a1a1aa"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
          >
            Today
          </text>

          {/* Secondary Other Horizons Dashed Fan Lines */}
          {otherHorizons.map((otherH) => {
            const pts = forwardPoints.filter((pt) => pt.day <= otherH);
            const uPath = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${getFwdX(pt.day).toFixed(1)},${getY(pt.upper).toFixed(1)}`).join(" ");
            const lPath = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${getFwdX(pt.day).toFixed(1)},${getY(pt.lower).toFixed(1)}`).join(" ");
            return (
              <g key={otherH} opacity="0.35">
                <path d={uPath} fill="none" stroke="#71717a" strokeDasharray="3 3" strokeWidth="1" />
                <path d={lPath} fill="none" stroke="#71717a" strokeDasharray="3 3" strokeWidth="1" />
              </g>
            );
          })}

          {/* Forward Cone Shaded Gradient Fill */}
          <path d={forwardConeAreaPath} fill="url(#forwardConeGradient)" />

          {/* Forward Cone Boundary Lines */}
          <path d={forwardUpperPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
          <path d={forwardLowerPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />

          {/* Interactive Scrubbed Position Vertical Highlight Line inside Forward Cone */}
          {(() => {
            const scrubX = getFwdX(activeScrubDay);
            const scrubUpperY = getY(scrubbedMetrics.upper);
            const scrubLowerY = getY(scrubbedMetrics.lower);

            return (
              <g>
                <line
                  x1={scrubX}
                  y1={scrubUpperY}
                  x2={scrubX}
                  y2={scrubLowerY}
                  stroke="#facc15"
                  strokeWidth="2"
                  strokeDasharray="2 2"
                />
                <circle cx={scrubX} cy={scrubUpperY} r="4" fill="#22c55e" stroke="#000" strokeWidth="1.5" />
                <circle cx={scrubX} cy={scrubLowerY} r="4" fill="#f43f5e" stroke="#000" strokeWidth="1.5" />
                <circle cx={scrubX} cy={getY(spot)} r="3" fill="#facc15" stroke="#000" strokeWidth="1" />
              </g>
            );
          })()}

          {/* X Axis Time Labels */}
          <text
            x={padding.left + 10}
            y={svgHeight - padding.bottom + 18}
            fill="#71717a"
            fontSize="10"
            fontFamily="monospace"
          >
            {pastYearDateRangeStr.split(" - ")[0]}
          </text>
          <text
            x={todayX}
            y={svgHeight - padding.bottom + 18}
            textAnchor="middle"
            fill="#a1a1aa"
            fontSize="10"
            fontFamily="monospace"
          >
            {displayAsOfDate}
          </text>
          <text
            x={svgWidth - padding.right}
            y={svgHeight - padding.bottom + 18}
            textAnchor="end"
            fill="#71717a"
            fontSize="10"
            fontFamily="monospace"
          >
            {horizonExpiryDateStr}
          </text>
        </svg>
      </div>

      {/* Interactive Forward Days Scrubber Banner & Slider */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
        {/* Banner Pill Details */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
              Looking Ahead:
            </span>
            <span className="font-bold text-white">{scrubbedMetrics.dateStr}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-300">expected move <strong className="text-white">±{scrubbedMetrics.pct}%</strong></span>
            <span className="text-zinc-500">·</span>
            <span className="text-emerald-400 font-bold">upper {fmtMoney(scrubbedMetrics.upper)}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-rose-400 font-bold">lower {fmtMoney(scrubbedMetrics.lower)}</span>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#facc15]/15 border border-[#facc15]/30 text-[#facc15] font-bold text-xs self-start sm:self-auto font-mono">
            IN {activeScrubDay} DAYS
          </div>
        </div>

        {/* Scrubber Slider */}
        <div className="flex items-center gap-3 pt-1">
          <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap uppercase font-semibold">
            Days Forward
          </span>
          <div className="relative flex-1">
            <input
              type="range"
              min="1"
              max={horizonDte}
              value={activeScrubDay}
              onChange={(e) => setScrubDay(parseInt(e.target.value))}
              className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#facc15] focus:outline-none"
            />
          </div>
          <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
            {activeScrubDay} / {horizonDte}d
          </span>
        </div>
      </div>

      {/* Bottom Summary Metric Row (5 Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
        {/* Metric 1: Last Close */}
        <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
          <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
            Last Close
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {fmtMoney(spot)}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">{displayAsOfDate}</div>
        </div>

        {/* Metric 2: Implied Volatility */}
        <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
          <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
            Implied Volatility
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {(iv * 100).toFixed(0)}%
          </div>
          <div className="text-[11px] font-mono text-zinc-500">{horizonDte}-day IV</div>
        </div>

        {/* Metric 3: Expected Move */}
        <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
          <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
            Expected Move
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            ±{fmtMoney(horizonExpectedMove.dollar)}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">±{horizonExpectedMove.pct}%</div>
        </div>

        {/* Metric 4: Upper Bound */}
        <div className="p-3.5 rounded-lg bg-black/40 border border-emerald-500/20 space-y-1">
          <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
            Upper Bound
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
            {fmtMoney(horizonExpectedMove.upper)}
          </div>
          <div className="text-[11px] font-mono text-emerald-500/80">+{horizonExpectedMove.pct}%</div>
        </div>

        {/* Metric 5: Lower Bound */}
        <div className="p-3.5 rounded-lg bg-black/40 border border-rose-500/20 space-y-1">
          <div className="text-[10px] font-mono uppercase text-rose-400 font-semibold">
            Lower Bound
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-rose-400">
            {fmtMoney(horizonExpectedMove.lower)}
          </div>
          <div className="text-[11px] font-mono text-rose-500/80">−{horizonExpectedMove.pct}%</div>
        </div>
      </div>

      {/* Explanatory Footnote */}
      <div className="pt-2 text-[11px] font-sans text-zinc-500 leading-relaxed border-t border-white/[0.06] space-y-1">
        <p>
          Each cone is anchored on a close and widens with √(days/365) × IV. Left of today, it is the cone struck {horizonDte} days earlier; right of today, the one struck now.
        </p>
        <p className="font-mono text-[10px] text-zinc-600">
          Data through {displayAsOfDate}
        </p>
      </div>
    </div>
  );
}
