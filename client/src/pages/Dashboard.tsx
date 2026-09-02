import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Briefcase,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  Compass,
  Sparkles,
  Plus,
  Trash2,
  FolderPlus,
  Flame,
  Activity,
  X,
} from "lucide-react";
import { startAppTour } from "@/components/OnboardingTour";
import { CompanyLogo } from "@/components/CompanyLogo";
import { BrokerFiguresCards } from "@/components/BrokerFiguresCards";
import { AddWatchlistTickerModal } from "@/components/AddWatchlistTickerModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COLORS = [
  "#38bdf8", // Sky
  "#818cf8", // Indigo
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Blue-indigo
];

const TICKER_ACCENT_COLORS = [
  { bg: "bg-sky-500/15", border: "border-sky-500/30", text: "text-sky-400" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/30", text: "text-indigo-400" },
  { bg: "bg-purple-500/15", border: "border-purple-500/30", text: "text-purple-400" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400" },
  { bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/30", text: "text-cyan-400" },
  { bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-400" },
];

function _getTickerColor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TICKER_ACCENT_COLORS.length;
  return TICKER_ACCENT_COLORS[index];
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.portfolio.overview.useQuery();
  const { data: deltaData } = trpc.suggestions.spxNeutral.useQuery();

  // Watchlist state & queries (Visible on PC / Tablet, hidden on mobile)
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const utils = trpc.useUtils();
  const { data: watchlists } = trpc.watchlist.list.useQuery();
  
  const activeWlId = selectedWatchlistId ?? watchlists?.[0]?.id;
  const { data: watchlistData, isLoading: isWatchlistLoading } =
    trpc.watchlist.get.useQuery(
      { watchlistId: activeWlId },
      { enabled: !!activeWlId },
    );

  const createListMut = trpc.watchlist.create.useMutation({
    onSuccess: (newList) => {
      utils.watchlist.list.invalidate();
      setSelectedWatchlistId(newList.id);
      setIsNewListOpen(false);
      setNewListName("");
      setNewListDesc("");
    },
  });

  const deleteListMut = trpc.watchlist.delete.useMutation({
    onSuccess: () => {
      utils.watchlist.list.invalidate();
      setSelectedWatchlistId(undefined);
    },
  });

  const removeSymbolMut = trpc.watchlist.removeSymbol.useMutation({
    onSuccess: () => {
      utils.watchlist.get.invalidate({ watchlistId: activeWlId });
    },
  });

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    createListMut.mutate({
      name: newListName.trim(),
      description: newListDesc.trim() || undefined,
    });
  };

  const stats = useMemo(() => {
    const positions = data?.positions ?? [];
    const accounts = data?.accounts ?? [];
    let equityValue = 0;
    let totalCost = 0;
    let stockCostBasis = 0;
    let cash = 0;
    let cspCollateral = 0;
    let totalShares = 0;
    let coveredShares = 0;
    let shortCallCount = 0;
    let shortPutCount = 0;
    let optionPremiumCaptured = 0;

    for (const a of accounts) if (a.enabled !== false) cash += a.cash ?? 0;

    const bySymbol = new Map<
      string,
      { shares: number; cost: number; mktVal: number; callsSold: number; putsSold: number }
    >();

    for (const p of positions) {
      const px = p.price ?? p.costBasis ?? 0;
      const mult = p.assetType === "option" ? 100 : 1;
      const mv = p.quantity * px * mult;
      equityValue += mv;
      totalCost += p.quantity * (p.costBasis ?? px) * mult;

      const sym = p.symbol.toUpperCase();
      const cur = bySymbol.get(sym) ?? {
        shares: 0,
        cost: 0,
        mktVal: 0,
        callsSold: 0,
        putsSold: 0,
      };

      if (p.assetType === "option") {
        if (p.optionType === "put" && p.quantity < 0) {
          const strike = p.strike ?? px;
          const contracts = Math.abs(p.quantity);
          cspCollateral += strike * 100 * contracts;
          shortPutCount += contracts;
          cur.putsSold += contracts;
          optionPremiumCaptured += (p.costBasis ?? px) * 100 * contracts;
        } else if (p.optionType === "call" && p.quantity < 0) {
          const contracts = Math.abs(p.quantity);
          shortCallCount += contracts;
          cur.callsSold += contracts;
          optionPremiumCaptured += (p.costBasis ?? px) * 100 * contracts;
        }
      } else {
        if (p.quantity > 0) {
          stockCostBasis += p.quantity * (p.costBasis ?? px);
          totalShares += p.quantity;
          cur.shares += p.quantity;
          cur.cost += p.quantity * (p.costBasis ?? px);
          cur.mktVal += p.quantity * px;
        }
      }
      bySymbol.set(sym, cur);
    }

    for (const [, symData] of bySymbol.entries()) {
      const coveredLots = Math.min(Math.floor(symData.shares / 100), symData.callsSold);
      coveredShares += coveredLots * 100;
    }

    const capitalAtWork = stockCostBasis + cspCollateral;
    const availableBuyingPower = Math.max(0, cash - cspCollateral);
    const roundLotShares = Math.floor(totalShares / 100) * 100;
    const coveragePct = roundLotShares > 0 ? (coveredShares / roundLotShares) * 100 : 0;

    const totalAllocVal = [...bySymbol.values()].reduce((sum, d) => sum + (d.mktVal || d.cost || 0), 0);
    const allocation = [...bySymbol.entries()]
      .map(([symbol, data]) => {
        const val = +(data.mktVal || data.cost || 0).toFixed(2);
        return {
          symbol,
          value: val,
          pct: totalAllocVal > 0 ? +((val / totalAllocVal) * 100).toFixed(1) : 0,
        };
      })
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      capitalAtWork,
      availableBuyingPower,
      cash,
      cspCollateral,
      stockCostBasis,
      totalShares,
      coveredShares,
      roundLotShares,
      coveragePct,
      shortCallCount,
      shortPutCount,
      optionPremiumCaptured,
      equityValue,
      totalAllocVal,
      pnl: equityValue - totalCost,
      pnlPct: totalCost > 0 ? (equityValue - totalCost) / totalCost : null,
      count: positions.length,
      allocation,
      hasDemo: positions.some((p) => p.source === "demo"),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="h-96 lg:col-span-6 bg-white/5" />
          <Skeleton className="h-96 lg:col-span-6 bg-white/5" />
        </div>
      </div>
    );
  }

  const positions = data?.positions ?? [];

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-8 max-w-[1750px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {deltaData?.hasPositions && (
            <Link
              to="/suggestions"
              className="px-2.5 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>
                {deltaData.neutral
                  ? "Book Neutral"
                  : `Hedge: Net ${deltaData.direction === "long" ? "Long" : "Short"}`}
              </span>
            </Link>
          )}
          {stats.hasDemo ? (
            <div className="terminal-badge shrink-0 text-amber-300 border-amber-500/30 bg-amber-500/10">
              Demo Data
            </div>
          ) : (
            <div className="terminal-badge shrink-0">
              Live
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="p-3 rounded border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-3">
          <p className="text-xs text-destructive font-mono">
            Failed to load portfolio: {error.message}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono underline text-foreground hover:text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Broker Reported Balances & Quick Integration Bar (Unified in Same Row) */}
      <BrokerFiguresCards showSyncButton={true} />

      {/* Metrics Section: Beta Delta, Positions, Unrealized P&L in a unified segmented panel */}
      <section className="rounded-lg border border-white/[0.08] bg-[#111318] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] overflow-hidden">
        {/* SPX Beta Delta */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="text-[11px] sm:text-xs text-zinc-400 flex items-center justify-between">
            <span>Portfolio Beta Δ</span>
            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono">β {deltaData?.portfolioBeta?.toFixed(2) ?? "1.00"}</span>
          </div>
          <div
            className={`text-lg sm:text-2xl mt-1 flex items-center gap-1 font-bold font-mono ${
              deltaData?.neutral
                ? "text-white"
                : (deltaData?.totalDelta ?? 0) > 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}
          >
            {deltaData?.hasPositions && !deltaData.neutral && (
              (deltaData.totalDelta > 0 ? (
                <ArrowUpRight className="h-4 sm:h-5 w-4 sm:w-5 shrink-0" />
              ) : (
                <ArrowDownRight className="h-4 sm:h-5 w-4 sm:w-5 shrink-0" />
              ))
            )}
            <span className="truncate">
              {(deltaData?.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
              {(deltaData?.spxBetaDelta ?? 0).toFixed(2)}
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-zinc-500">Δ</span>
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono flex items-center justify-between">
            <span className="truncate">
              {((deltaData?.spyBetaDelta ?? 0) >= 0 ? "+" : "") + (deltaData?.spyBetaDelta ?? 0).toFixed(1)} SPY
            </span>
            <Link to="/suggestions" className="text-zinc-400 hover:text-white hover:underline shrink-0 ml-1">
              Hedge →
            </Link>
          </div>
        </div>

        {/* Positions Count */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="text-[11px] sm:text-xs text-zinc-400">Positions</div>
          <div className="text-white text-lg sm:text-2xl mt-1 font-bold font-mono">
            {stats.count}
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono flex items-center justify-between">
            <span>{stats.allocation.length} holdings</span>
            <Link to="/portfolio" className="text-zinc-400 hover:text-white hover:underline shrink-0 ml-1">
              Manage →
            </Link>
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="text-[11px] sm:text-xs text-zinc-400">Unrealized P&L</div>
          <div
            className={`text-lg sm:text-2xl mt-1 font-bold font-mono truncate ${
              stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.pnl >= 0 ? `+${fmtMoney(stats.pnl)}` : fmtMoney(stats.pnl)}
          </div>
          {stats.pnlPct != null && (
            <div
              className={`text-[10px] sm:text-xs font-mono mt-1 ${
                stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {stats.pnl >= 0 ? "+" : ""}{fmtPct(stats.pnlPct)}
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Holdings + Allocation (Row 1) & Target Watchlist (Row 2) */}
      <div className="space-y-8">
        
        {/* Top Row: Active Holdings Table (3 cols) + Asset Allocation Pie Chart (2 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
          
          {/* Active Holdings Table */}
          <div className="xl:col-span-3 flex flex-col">
            <div className="panel-box p-4 sm:p-7 overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3 min-h-[34px]">
                  <div className="flex items-center gap-2">
                    <span className="meta-label font-bold text-white uppercase flex items-center gap-1.5 text-xs">
                      <Briefcase className="h-4 w-4 text-primary" /> Active Holdings
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
                      {positions.length}
                    </span>
                  </div>
                  <Link
                    to="/portfolio"
                    className="text-xs font-mono text-primary hover:underline font-medium"
                  >
                    Manage Portfolio →
                  </Link>
                </div>

                {positions.length === 0 ? (
                  <div className="py-10 sm:py-14 text-center space-y-3 font-mono">
                    <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 stroke-1" />
                    <p className="text-sm text-white font-semibold">No active positions</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Your workspace is clean. Import your broker statements or add lots in Portfolio.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <Link
                        to="/portfolio"
                        className="inline-block rounded bg-primary px-4 py-2 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider shadow-[0_0_15px_rgba(212,255,0,0.25)]"
                      >
                        Open Portfolio
                      </Link>
                      <button
                        onClick={() => startAppTour()}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        <Compass className="h-3.5 w-3.5 text-emerald-400" />
                        Take Tour
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full text-left border-collapse text-xs font-mono min-w-[500px]">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-muted-foreground text-[11px]">
                          <th className="pb-2.5 font-normal meta-label">Symbol</th>
                          <th className="pb-2.5 font-normal meta-label">Type</th>
                          <th className="pb-2.5 font-normal meta-label text-right">Qty</th>
                          <th className="pb-2.5 font-normal meta-label text-right">Cost</th>
                          <th className="pb-2.5 font-normal meta-label text-right">Price</th>
                          <th className="pb-2.5 font-normal meta-label text-right">Value</th>
                          <th className="pb-2.5 font-normal meta-label text-right">P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
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
                            <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-2.5 font-bold text-white">
                                <div className="flex items-center gap-2">
                                  <CompanyLogo symbol={p.symbol} size="xs" />
                                  <span>{label}</span>
                                </div>
                              </td>
                              <td className="py-2.5 capitalize text-muted-foreground font-sans text-[11px]">
                                {p.assetType}
                              </td>
                              <td className="py-2.5 text-right text-muted-foreground">
                                {fmtNum(p.quantity, 0)}
                              </td>
                              <td className="py-2.5 text-right text-muted-foreground">
                                {fmtMoney(p.costBasis)}
                              </td>
                              <td className="py-2.5 text-right text-white">
                                {fmtMoney(px)}
                              </td>
                              <td className="py-2.5 text-right font-medium text-white">
                                {fmtMoney(mv)}
                              </td>
                              <td
                                className={`py-2.5 text-right font-semibold ${
                                  pnl >= 0 ? "text-primary" : "text-red-400"
                                }`}
                              >
                                {pnl >= 0 ? `+${fmtMoney(pnl)}` : fmtMoney(pnl)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Real-time Greek Stream widget */}
              <div className="activity-widget mt-5">
                <div className="meta-label mb-1.5 text-[0.6rem]">Real-time Portfolio Greek Stream</div>
                <div className="activity-line text-[11px] flex-wrap gap-1">
                  <span>{new Date().toLocaleTimeString()}</span>
                  <span className="truncate">
                    SPX BETA DELTA: {(deltaData?.spxBetaDelta ?? 0) >= 0 ? "+" : ""}{(deltaData?.spxBetaDelta ?? 0).toFixed(2)} Δ · BETA: {deltaData?.portfolioBeta?.toFixed(2) ?? "1.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Pie Chart Section */}
          <div className="xl:col-span-2 flex flex-col">
            <div className="panel-box p-4 sm:p-6 overflow-hidden flex-1 flex flex-col justify-between relative bg-gradient-to-b from-[#151720] to-[#101217] border border-white/[0.09] shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
              {/* Subtle ambient corner glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 border-b border-white/[0.07] pb-3.5 min-h-[36px]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500/20 via-sky-500/15 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                      <PieIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-xs tracking-tight flex items-center gap-1.5 uppercase font-sans">
                        Capital Allocation
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono">
                    <span className="text-zinc-400 text-[11px]">Total</span>
                    <span className="text-white font-bold">{fmtMoney(stats.equityValue + stats.cash)}</span>
                  </div>
                </div>

              {stats.allocation.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <PieIcon className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-semibold text-white">No equity positions charted</p>
                  <p className="text-xs font-mono text-zinc-400 max-w-xs mx-auto">
                    Add or import stock and option holdings to visualize live capital weighting.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-6 h-52 w-full flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.allocation}
                            dataKey="value"
                            nameKey="symbol"
                            innerRadius={52}
                            outerRadius={80}
                            strokeWidth={2}
                            stroke="#13151b"
                            paddingAngle={4}
                          >
                            {stats.allocation.map((_, i) => (
                              <Cell 
                                key={i} 
                                fill={COLORS[i % COLORS.length]} 
                                className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const pData = payload[0];
                              const aItem = pData.payload as { symbol: string; value: number; pct: number; fill?: string };
                              const itemColor = pData.fill || aItem?.fill || "#38bdf8";
                              return (
                                <div className="bg-[#12141a]/95 backdrop-blur-md border border-white/15 rounded-lg px-3.5 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] font-mono text-xs z-50 pointer-events-none">
                                  <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/10">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-[0_0_8px_currentColor]"
                                      style={{ backgroundColor: itemColor }}
                                    />
                                    <span className="font-bold text-white uppercase tracking-wider">{aItem?.symbol || pData.name}</span>
                                    <span 
                                      className="font-bold ml-auto px-1.5 py-0.5 rounded text-[10px] bg-white/10"
                                      style={{ color: itemColor }}
                                    >
                                      {aItem?.pct}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-400">
                                    <span>Holding Value:</span>
                                    <span className="text-white font-semibold">{fmtMoney(Number(pData.value))}</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center total overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mb-1" />
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Equity</span>
                        <span className="text-xs font-mono font-bold text-white tracking-tight">{fmtMoney(stats.equityValue)}</span>
                      </div>
                    </div>

                    <div className="sm:col-span-6 space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {stats.allocation.map((a, i) => {
                        const itemColor = COLORS[i % COLORS.length];
                        return (
                          <div
                            key={a.symbol}
                            className="group relative flex justify-between items-center text-xs py-1.5 px-2.5 rounded-md bg-white/[0.02] hover:bg-white/[0.06] transition-all border border-white/[0.04] hover:border-white/15"
                          >
                            {/* Proportional background accent bar */}
                            <div
                              className="absolute left-0 top-0 bottom-0 rounded-md opacity-10 pointer-events-none transition-all"
                              style={{
                                width: `${Math.min(100, a.pct)}%`,
                                backgroundColor: itemColor,
                              }}
                            />
                            <span className="flex items-center font-medium font-sans text-white text-xs z-10">
                              <span
                                className="w-2.5 h-2.5 rounded-sm inline-block mr-2 shrink-0 shadow-[0_0_8px_currentColor]"
                                style={{ backgroundColor: itemColor, color: itemColor }}
                              />
                              <span className="font-mono font-bold">{a.symbol}</span>
                            </span>
                            <div className="flex items-center gap-2.5 font-mono text-xs z-10">
                              <span 
                                className="font-bold px-1.5 py-0.5 rounded text-[11px] bg-white/5 border border-white/10"
                                style={{ color: itemColor }}
                              >
                                {a.pct}%
                              </span>
                              <span className="text-zinc-300 font-medium">{fmtMoney(a.value)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Asset class balance bar */}
                  <div className="pt-3.5 border-t border-white/[0.07] space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
                        <span className="text-zinc-300">
                          Equities ({stats.equityValue + stats.cash > 0 ? ((stats.equityValue / (stats.equityValue + stats.cash)) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                        <span className="text-zinc-300">
                          Cash ({fmtMoney(stats.availableBuyingPower)})
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/5 shadow-inner">
                      <div
                        className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-l-full shadow-[0_0_12px_rgba(56,189,248,0.4)] transition-all duration-500"
                        style={{
                          width: `${stats.equityValue + stats.cash > 0 ? Math.min(100, (stats.equityValue / (stats.equityValue + stats.cash)) * 100) : 0}%`,
                        }}
                      />
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all duration-500"
                        style={{
                          width: `${stats.equityValue + stats.cash > 0 ? Math.min(100, (stats.availableBuyingPower / (stats.equityValue + stats.cash)) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 2: WATCHLIST (PC ONLY - HIDDEN ON MOBILE)                            */}
        {/* ========================================================================= */}
        <div className="hidden md:block w-full space-y-3 font-sans">
          <div className="panel-box p-4 sm:p-5 relative bg-[#0c0d12] border border-white/[0.08] shadow-sm">
            {/* Header & Watchlist Selector matching mobile styling */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-wrap">
                <span className="text-sm font-bold tracking-tight text-white font-sans pr-1">
                  Watchlist
                </span>

                <div className="h-4 w-[1px] bg-white/20 shrink-0 mx-1" />

                {/* Watchlist switcher buttons */}
                {watchlists && watchlists.map((w) => (
                  <div key={w.id} className="flex items-center shrink-0">
                    <button
                      onClick={() => setSelectedWatchlistId(w.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer whitespace-nowrap ${
                        activeWlId === w.id
                          ? "bg-white/15 text-white font-semibold shadow-sm"
                          : "text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      {w.name}
                    </button>
                    {watchlists.length > 1 && activeWlId === w.id && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete watchlist "${w.name}"?`)) {
                            deleteListMut.mutate({ watchlistId: w.id });
                          }
                        }}
                        disabled={deleteListMut.isPending}
                        className="ml-1 p-1 rounded hover:bg-red-500/15 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete watchlist"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Create Watchlist Modal */}
                <Dialog open={isNewListOpen} onOpenChange={setIsNewListOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add list</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#12141a] border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-sans font-bold">
                        Create Custom Watchlist
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateList} className="space-y-4 mt-2">
                      <div>
                        <label className="text-xs font-medium text-zinc-400 block mb-1.5">Watchlist Name</label>
                        <input
                          type="text"
                          placeholder="e.g. High IV, Tech Giants, Growth"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          required
                          className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-sm text-white font-sans placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 block mb-1.5">Description (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Core tracked tickers"
                          value={newListDesc}
                          onChange={(e) => setNewListDesc(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-sm text-white font-sans placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsNewListOpen(false)}
                          className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs font-sans text-muted-foreground cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createListMut.isPending}
                          className="px-3.5 py-1.5 rounded bg-white text-black font-sans text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                        >
                          {createListMut.isPending ? "Creating..." : "Create"}
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Add Ticker Button */}
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="p-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Add Ticker"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Watchlist Table */}
            {isWatchlistLoading ? (
              <div className="py-8 space-y-2">
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
              </div>
            ) : !watchlistData || watchlistData.items.length === 0 ? (
              <div className="py-10 text-center space-y-2 font-sans">
                <p className="text-sm font-semibold text-white">Watchlist is currently empty</p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Add symbols to track real-time price quotes, Tastylive IV Rank, YTD, and 52-week channels.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(true)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-sans font-medium transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Ticker</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs min-w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-400 text-xs">
                      <th className="pb-2.5 font-medium">Symbol</th>
                      <th className="pb-2.5 font-medium text-right">Price</th>
                      <th className="pb-2.5 font-medium text-right">Change</th>
                      <th
                        className="pb-2.5 font-medium text-center cursor-help"
                        title="Tastylive Implied Volatility Rank (IVR)"
                      >
                        IVR
                      </th>
                      <th className="pb-2.5 font-medium text-right">YTD</th>
                      <th className="pb-2.5 font-medium text-center min-w-[160px]">52W Channel</th>
                      <th className="pb-2.5 font-medium text-right w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {watchlistData.items.map((item) => {
                      const iv = item.ivRank ?? 35;
                      const ivStyle =
                        iv >= 60
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                          : iv >= 30
                            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                            : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";

                      const pos52 = item.fiftyTwoWeekPos ?? 50;
                      const ytd = item.ytdChangePct;
                      const isPositive = (item.change ?? 0) >= 0;

                      const formattedPrice = item.price
                        ? Number(item.price).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—";

                      const low52Formatted =
                        item.fiftyTwoWeekLow != null
                          ? `$${Number(item.fiftyTwoWeekLow).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : item.price
                            ? `$${(Number(item.price) * 0.78).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "—";

                      const high52Formatted =
                        item.fiftyTwoWeekHigh != null
                          ? `$${Number(item.fiftyTwoWeekHigh).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : item.price
                            ? `$${(Number(item.price) * 1.28).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "—";

                      const changeFormatted =
                        item.change != null
                          ? `${isPositive ? "+" : ""}${item.change.toFixed(2)}`
                          : "—";

                      const pctFormatted =
                        item.changePct != null
                          ? `${isPositive ? "+" : ""}${item.changePct.toFixed(2)}%`
                          : "";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Symbol + Name & Logo matching mobile typography */}
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <CompanyLogo symbol={item.symbol} name={item.name} size="md" />
                              <div className="min-w-0">
                                <div className="font-bold text-white text-sm sm:text-base tracking-tight font-sans">
                                  {item.symbol}
                                </div>
                                <div className="text-xs text-zinc-400 font-sans truncate max-w-[160px] leading-tight mt-0.5">
                                  {item.name}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3 text-right font-semibold text-white text-sm sm:text-base font-sans tracking-tight">
                            {formattedPrice}
                          </td>

                          {/* Price Change */}
                          <td className="py-3 text-right">
                            <div
                              className={`text-xs sm:text-[13px] font-medium font-sans tracking-tight ${
                                isPositive ? "text-emerald-400" : "text-rose-500"
                              }`}
                            >
                              {changeFormatted} {pctFormatted}
                            </div>
                          </td>

                          {/* IVR */}
                          <td className="py-3 text-center">
                            {item.ivRank != null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-sans border ${ivStyle}`}
                                title={`Tastylive IV Rank: ${item.ivRank}%`}
                              >
                                {item.ivRank >= 60 && <Flame className="h-3 w-3 text-amber-400 shrink-0" />}
                                {item.ivRank < 60 && item.ivRank >= 30 && <Activity className="h-3 w-3 text-cyan-400 shrink-0" />}
                                <span>{item.ivRank}%</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-xs">—</span>
                            )}
                          </td>

                          {/* YTD Return */}
                          <td className="py-3 text-right">
                            {ytd != null ? (
                              <span
                                className={`text-xs font-medium font-sans ${
                                  ytd >= 0 ? "text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {ytd >= 0 ? "+" : ""}{ytd.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>

                          {/* 52W Range Visual Track (Retained) */}
                          <td className="py-3 px-3">
                            <div className="w-full flex flex-col items-center gap-1">
                              <div className="w-full bg-white/10 h-1.5 rounded-full relative overflow-visible">
                                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500/80 via-amber-400/80 to-emerald-400/80" />
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border border-zinc-950 shadow-sm z-10 transition-all"
                                  style={{ left: `${Math.min(96, Math.max(4, pos52))}%` }}
                                />
                              </div>
                              <div className="w-full flex justify-between items-center text-[10px] font-sans text-zinc-400 gap-1">
                                <span className="font-mono text-zinc-400 tabular-nums" title="52-Week Low">
                                  {low52Formatted}
                                </span>
                                <span className="font-semibold text-white px-1 py-0.2 rounded bg-white/[0.04]">
                                  {pos52}%
                                </span>
                                <span className="font-mono text-zinc-400 tabular-nums" title="52-Week High">
                                  {high52Formatted}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 text-right">
                            <button
                              onClick={() =>
                                removeSymbolMut.mutate({
                                  watchlistId: item.watchlistId,
                                  symbol: item.symbol,
                                })
                              }
                              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remove from watchlist"
                            >
                              <X className="h-4 w-4" />
                            </button>
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

      </div>

      {activeWlId && (
        <AddWatchlistTickerModal
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          watchlistId={activeWlId}
          watchlistName={watchlists?.find((w) => w.id === activeWlId)?.name}
          onSuccess={() => {
            utils.watchlist.get.invalidate({ watchlistId: activeWlId });
          }}
        />
      )}
    </div>
  );
}
