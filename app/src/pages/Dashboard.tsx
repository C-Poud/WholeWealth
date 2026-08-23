import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Briefcase } from "lucide-react";

const COLORS = [
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#22d3ee",
];

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.portfolio.overview.useQuery();

  const stats = useMemo(() => {
    const positions = data?.positions ?? [];
    const accounts = data?.accounts ?? [];
    let equityValue = 0;
    let totalCost = 0;
    let cash = 0;
    for (const a of accounts) cash += a.cash ?? 0;
    const bySymbol = new Map<string, number>();
    for (const p of positions) {
      const px = p.price ?? p.costBasis ?? 0;
      const mult = p.assetType === "option" ? 100 : 1;
      const mv = p.quantity * px * mult;
      equityValue += mv;
      totalCost += p.quantity * (p.costBasis ?? px) * mult;
      bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + Math.abs(mv));
    }
    const allocation = [...bySymbol.entries()]
      .map(([symbol, value]) => ({ symbol, value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return {
      equityValue,
      cash,
      totalValue: equityValue + cash,
      pnl: equityValue - totalCost,
      pnlPct: totalCost > 0 ? (equityValue - totalCost) / totalCost : null,
      count: positions.length,
      allocation,
      hasDemo: positions.some((p) => p.source === "demo"),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 sm:p-10 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-12 w-80 bg-white/5" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-80 bg-white/5" />
      </div>
    );
  }

  const positions = data?.positions ?? [];

  return (
    <div className="p-6 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f0f0f2] leading-tight">
            Portfolio Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Holdings, performance and allocation across connected accounts.
          </p>
        </div>
        {stats.hasDemo && (
          <div className="neon-badge shrink-0 self-start md:self-auto">
            Includes demo data
          </div>
        )}
      </header>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-sm text-destructive font-mono">
            Failed to load portfolio: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono underline text-foreground hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="panel-card py-20 text-center space-y-4">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground stroke-1" />
          <p className="text-xl font-display font-bold">No positions yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect a brokerage via SnapTrade, upload a broker export, or load a
            demo portfolio to explore the analytics.
          </p>
          <Link
            to="/portfolio"
            className="inline-block mt-3 rounded bg-primary px-5 py-2.5 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider"
          >
            Go to Portfolio
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                Total Value
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {fmtMoney(stats.totalValue)}
              </div>
            </div>

            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                Equity Value
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {fmtMoney(stats.equityValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {positions.length} open position{positions.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                Cash
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {fmtMoney(stats.cash)}
              </div>
            </div>

            <div className="stat-card-border pl-5 py-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">
                Unrealized P&L
              </span>
              <div
                className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight ${
                  stats.pnl >= 0 ? "text-primary" : "text-red-400"
                }`}
              >
                {stats.pnl >= 0 ? `+${fmtMoney(stats.pnl)}` : fmtMoney(stats.pnl)}
              </div>
              {stats.pnlPct != null && (
                <div
                  className={`text-xs font-mono mt-1 ${
                    stats.pnl >= 0 ? "text-primary" : "text-red-400"
                  }`}
                >
                  {fmtPct(stats.pnlPct)} {stats.pnl >= 0 ? "▲" : "▼"}
                </div>
              )}
            </div>
          </section>

          {/* Data Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {/* Positions Table Panel */}
            <div className="panel-card p-6 lg:col-span-2 xl:col-span-3 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Positions
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {positions.length} active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground text-xs font-normal">
                      <th className="pb-3 font-normal">Symbol</th>
                      <th className="pb-3 font-normal">Type</th>
                      <th className="pb-3 font-normal text-right">Qty</th>
                      <th className="pb-3 font-normal text-right">Cost</th>
                      <th className="pb-3 font-normal text-right">Price</th>
                      <th className="pb-3 font-normal text-right">Mkt Value</th>
                      <th className="pb-3 font-normal text-right">P&L</th>
                      <th className="pb-3 font-normal text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {positions.map((p) => {
                      const px = p.price ?? p.costBasis ?? 0;
                      const mult = p.assetType === "option" ? 100 : 1;
                      const mv = p.quantity * px * mult;
                      const cb = p.costBasis ?? px;
                      const pnl = p.quantity * (px - cb) * mult;
                      const label =
                        p.assetType === "option"
                          ? `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${
                              p.optionType === "put" ? "P" : "C"
                            }`
                          : p.symbol;
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 font-mono font-bold text-white">
                            {label}
                          </td>
                          <td className="py-3 capitalize text-muted-foreground text-xs">
                            {p.assetType}
                          </td>
                          <td className="py-3 text-right font-mono text-muted-foreground">
                            {fmtNum(p.quantity, 0)}
                          </td>
                          <td className="py-3 text-right font-mono text-muted-foreground">
                            {fmtMoney(p.costBasis)}
                          </td>
                          <td className="py-3 text-right font-mono text-white">
                            {fmtMoney(px)}
                          </td>
                          <td className="py-3 text-right font-mono font-medium text-white">
                            {fmtMoney(mv)}
                          </td>
                          <td
                            className={`py-3 text-right font-mono font-semibold ${
                              pnl >= 0 ? "text-primary" : "text-red-400"
                            }`}
                          >
                            {pnl >= 0 ? `+${fmtMoney(pnl)}` : fmtMoney(pnl)}
                          </td>
                          <td className="py-3 text-right">
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                              {p.source}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Allocation Panel */}
            <div className="panel-card p-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-4">
                  Allocation
                </span>

                {stats.allocation.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No equity value to chart.
                  </p>
                ) : (
                  <div className="h-52 w-full flex items-center justify-center my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.allocation}
                          dataKey="value"
                          nameKey="symbol"
                          innerRadius={50}
                          outerRadius={80}
                          strokeWidth={2}
                          stroke="#141417"
                          paddingAngle={2}
                        >
                          {stats.allocation.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => fmtMoney(v)}
                          contentStyle={{
                            background: "#141417",
                            border: "1px solid rgba(240, 240, 242, 0.15)",
                            borderRadius: 4,
                            fontFamily: "Space Mono, monospace",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <ul className="space-y-2 mt-4 pt-4 border-t border-white/10">
                {stats.allocation.map((a, i) => (
                  <li
                    key={a.symbol}
                    className="flex justify-between items-center text-xs py-1"
                  >
                    <span className="flex items-center font-medium">
                      <span
                        className="w-2 h-2 rounded-[2px] inline-block mr-2.5"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      {a.symbol}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {fmtMoney(a.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
