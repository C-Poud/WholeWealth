import { useMemo, useState, useCallback } from "react";
import { fmtMoney } from "@/lib/format";

interface VolatilityConeChartProps {
  spot: number;
  iv: number; // e.g. 0.32
  dte?: number;
  symbol?: string;
}

export function VolatilityConeChart({ spot, iv, dte = 30 }: VolatilityConeChartProps) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const days = useMemo(() => [0, 2, 5, 10, 15, 22, 30, 45, 60, 90], []);

  const points = useMemo(() => {
    return days.map((d) => {
      const t = Math.max(d, 0.25) / 365;
      const em1 = spot * iv * Math.sqrt(t);
      return {
        day: d,
        spot,
        upper2: spot + em1 * 2,
        upper1: spot + em1,
        lower1: Math.max(0, spot - em1),
        lower2: Math.max(0, spot - em1 * 2),
        em1,
      };
    });
  }, [days, spot, iv]);

  // Coordinate scales for SVG
  const width = 640;
  const height = 240;
  const padding = useMemo(() => ({ top: 20, right: 30, bottom: 30, left: 60 }), []);

  const minPrice = Math.max(0, spot - spot * iv * Math.sqrt(90 / 365) * 2.2);
  const maxPrice = spot + spot * iv * Math.sqrt(90 / 365) * 2.2;

  const xScale = useCallback(
    (d: number) => padding.left + (d / 90) * (width - padding.left - padding.right),
    [padding],
  );

  const yScale = useCallback(
    (p: number) =>
      height -
      padding.bottom -
      ((p - minPrice) / (maxPrice - minPrice)) * (height - padding.top - padding.bottom),
    [padding, minPrice, maxPrice],
  );

  // SVG path generation
  const area2Path = useMemo(() => {
    if (points.length === 0) return "";
    const u2 = points.map((pt) => `${xScale(pt.day)},${yScale(pt.upper2)}`).join(" L ");
    const l2 = points
      .slice()
      .reverse()
      .map((pt) => `${xScale(pt.day)},${yScale(pt.lower2)}`)
      .join(" L ");
    return `M ${u2} L ${l2} Z`;
  }, [points, xScale, yScale]);

  const area1Path = useMemo(() => {
    if (points.length === 0) return "";
    const u1 = points.map((pt) => `${xScale(pt.day)},${yScale(pt.upper1)}`).join(" L ");
    const l1 = points
      .slice()
      .reverse()
      .map((pt) => `${xScale(pt.day)},${yScale(pt.lower1)}`)
      .join(" L ");
    return `M ${u1} L ${l1} Z`;
  }, [points, xScale, yScale]);

  const currentHoverPt = useMemo(() => {
    if (hoverDay == null) {
      return points.find((p) => p.day === Math.min(30, dte)) ?? points[5];
    }
    return (
      points.reduce((prev, curr) =>
        Math.abs(curr.day - hoverDay) < Math.abs(prev.day - hoverDay) ? curr : prev,
      ) ?? points[5]
    );
  }, [hoverDay, points, dte]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-400 inline-block" />
            68.2% Probability ($1\sigma$)
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/20 border border-cyan-400/50 inline-block" />
            95.4% Probability ($2\sigma$)
          </span>
        </div>
        <div className="text-zinc-400">
          Target: <strong className="text-white">{currentHoverPt.day} DTE</strong> · Spot:{" "}
          <strong className="text-white">{fmtMoney(spot)}</strong> · 1σ Range:{" "}
          <strong className="text-emerald-400">
            {fmtMoney(currentHoverPt.lower1)} – {fmtMoney(currentHoverPt.upper1)}
          </strong>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg bg-black/40 border border-white/10 p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none touch-none cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const normX = (mouseX / rect.width) * width;
            const dayRatio = Math.max(0, Math.min(1, (normX - padding.left) / (width - padding.left - padding.right)));
            setHoverDay(Math.round(dayRatio * 90));
          }}
          onMouseLeave={() => setHoverDay(null)}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = touch.clientX - rect.left;
            const normX = (mouseX / rect.width) * width;
            const dayRatio = Math.max(0, Math.min(1, (normX - padding.left) / (width - padding.left - padding.right)));
            setHoverDay(Math.round(dayRatio * 90));
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = touch.clientX - rect.left;
            const normX = (mouseX / rect.width) * width;
            const dayRatio = Math.max(0, Math.min(1, (normX - padding.left) / (width - padding.left - padding.right)));
            setHoverDay(Math.round(dayRatio * 90));
          }}
          onTouchEnd={() => setHoverDay(null)}
        >
          <defs>
            <linearGradient id="coneGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.05)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.20)" />
            </linearGradient>
            <linearGradient id="coneGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.15)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.35)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[minPrice, (minPrice + spot) / 2, spot, (spot + maxPrice) / 2, maxPrice].map((p, idx) => {
            const y = yScale(p);
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ${p.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          {[0, 15, 30, 45, 60, 75, 90].map((d) => {
            const x = xScale(d);
            return (
              <g key={d}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="rgba(255,255,255,0.05)"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {d}d
                </text>
              </g>
            );
          })}

          {/* 95% Envelope Area */}
          <path d={area2Path} fill="url(#coneGrad2)" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1" />

          {/* 68% Envelope Area */}
          <path d={area1Path} fill="url(#coneGrad1)" stroke="rgba(16, 185, 129, 0.7)" strokeWidth="1.5" />

          {/* Center Spot Line */}
          <line
            x1={padding.left}
            y1={yScale(spot)}
            x2={width - padding.right}
            y2={yScale(spot)}
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Target / Hover Marker */}
          {currentHoverPt && (
            <g>
              <line
                x1={xScale(currentHoverPt.day)}
                y1={padding.top}
                x2={xScale(currentHoverPt.day)}
                y2={height - padding.bottom}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={xScale(currentHoverPt.day)}
                y={yScale(currentHoverPt.upper2)}
                r="3"
                fill="#06b6d4"
              />
              <circle
                cx={xScale(currentHoverPt.day)}
                y={yScale(currentHoverPt.upper1)}
                r="3.5"
                fill="#10b981"
              />
              <circle
                cx={xScale(currentHoverPt.day)}
                y={yScale(currentHoverPt.spot)}
                r="4"
                fill="#ffffff"
              />
              <circle
                cx={xScale(currentHoverPt.day)}
                y={yScale(currentHoverPt.lower1)}
                r="3.5"
                fill="#10b981"
              />
              <circle
                cx={xScale(currentHoverPt.day)}
                y={yScale(currentHoverPt.lower2)}
                r="3"
                fill="#06b6d4"
              />
            </g>
          )}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>Model: Standard Volatility Model (S × IV × √T)</span>
        <span>Volatility: {(iv * 100).toFixed(1)}% Annualized IV</span>
      </div>
    </div>
  );
}
