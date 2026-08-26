import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Briefcase,
  Scale,
  Plus,
  Trash2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  FolderPlus,
  X,
  PieChart as PieIcon,
  Compass,
} from "lucide-react";
import { startAppTour } from "@/components/OnboardingTour";
import { ConnectBrokerCard } from "@/components/ConnectBrokerCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COLORS = [
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#64748b",
];

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.portfolio.overview.useQuery();
  const { data: deltaData } = trpc.suggestions.spxNeutral.useQuery();

  // Watchlist state & queries
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | undefined>(undefined);
  const [tickerInput, setTickerInput] = useState("");
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

  const addSymbolMut = trpc.watchlist.addSymbol.useMutation({
    onSuccess: () => {
      utils.watchlist.get.invalidate({ watchlistId: activeWlId });
      setTickerInput("");
      setIsAddOpen(false);
    },
  });

  const removeSymbolMut = trpc.watchlist.removeSymbol.useMutation({
    onSuccess: () => {
      utils.watchlist.get.invalidate({ watchlistId: activeWlId });
    },
  });

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWlId || !tickerInput.trim()) return;
    addSymbolMut.mutate({
      watchlistId: activeWlId,
      symbol: tickerInput.trim().toUpperCase(),
    });
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    createListMut.mutate({
      name: newListName.trim(),
      description: newListDesc.trim() || undefined,
    });
  };

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
              className="px-2.5 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
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

      {/* Broker Connection Recommendation */}
      <ConnectBrokerCard variant={positions.length === 0 ? "card" : "compact"} />

      {/* Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-4">
        <div className="stat-card col-span-2 sm:col-span-1 p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs text-zinc-400">Portfolio Value</div>
          <div className="text-white text-xl sm:text-2xl mt-1 font-bold font-mono">
            {fmtMoney(stats.equityValue + stats.cash)}
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
            {fmtMoney(stats.equityValue)} equity · {fmtMoney(stats.cash)} cash
          </div>
        </div>

        <div className="stat-card p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs text-zinc-400">Available Cash</div>
          <div className="text-emerald-400 text-lg sm:text-2xl mt-1 font-bold font-mono truncate">
            {fmtMoney(stats.availableBuyingPower)}
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono truncate">
            {fmtMoney(stats.cash)} buying power
          </div>
        </div>

        {/* SPX Beta Delta */}
        <div className="stat-card p-3.5 sm:p-5">
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
            <Link to="/suggestions" className="text-emerald-400 hover:underline shrink-0 ml-1">
              Hedge →
            </Link>
          </div>
        </div>

        <div className="stat-card p-3.5 sm:p-5">
          <div className="text-[11px] sm:text-xs text-zinc-400">Positions</div>
          <div className="text-white text-lg sm:text-2xl mt-1 font-bold font-mono">
            {stats.count}
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
            {stats.allocation.length} holdings
          </div>
        </div>

        <div className="stat-card p-3.5 sm:p-5">
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
                                {label}
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
            <div className="panel-box p-4 sm:p-7 overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3 min-h-[34px]">
                  <div className="flex items-center gap-2">
                    <span className="meta-label font-bold text-white uppercase flex items-center gap-1.5 text-xs">
                      <PieIcon className="h-4 w-4 text-primary" /> Capital Allocation
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    Total <span className="text-white font-semibold">{fmtMoney(stats.equityValue + stats.cash)}</span>
                  </span>
                </div>

              {stats.allocation.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <PieIcon className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
                  <p className="text-xs font-mono text-muted-foreground">
                    No equity positions available to chart.
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
                            innerRadius={50}
                            outerRadius={78}
                            strokeWidth={2}
                            stroke="#111113"
                            paddingAngle={3}
                          >
                            {stats.allocation.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const pData = payload[0];
                              const aItem = pData.payload as { symbol: string; value: number; pct: number; fill?: string };
                              return (
                                <div className="bg-[#141417] border border-primary/40 rounded-md px-3.5 py-2.5 shadow-[0_0_20px_rgba(212,255,0,0.18)] font-mono text-xs z-50 pointer-events-none">
                                  <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/10">
                                    <span
                                      className="w-2.5 h-2.5 rounded-sm inline-block shrink-0 shadow-[0_0_8px_currentColor]"
                                      style={{ backgroundColor: pData.fill || aItem?.fill || "#d4ff00" }}
                                    />
                                    <span className="font-bold text-white uppercase tracking-wider">{aItem?.symbol || pData.name}</span>
                                    <span className="text-primary font-bold ml-auto">{aItem?.pct}%</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
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
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Equity</span>
                        <span className="text-xs font-mono font-bold text-white">{fmtMoney(stats.equityValue)}</span>
                      </div>
                    </div>

                    <div className="sm:col-span-6 space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {stats.allocation.map((a, i) => (
                        <div
                          key={a.symbol}
                          className="flex justify-between items-center text-xs py-1.5 px-2 rounded hover:bg-white/[0.04] transition-colors border-b border-white/[0.03]"
                        >
                          <span className="flex items-center font-medium font-sans text-white text-xs">
                            <span
                              className="w-2.5 h-2.5 rounded-[2px] inline-block mr-2 shrink-0 shadow-[0_0_6px_rgba(0,0,0,0.5)]"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {a.symbol}
                          </span>
                          <div className="flex items-center gap-2.5 font-mono text-xs">
                            <span className="text-primary font-semibold">{a.pct}%</span>
                            <span className="text-muted-foreground">{fmtMoney(a.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Asset class balance bar */}
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                      <span>Equities ({stats.equityValue > 0 ? ((stats.equityValue / (stats.equityValue + stats.cash)) * 100).toFixed(0) : 0}%)</span>
                      <span>Free Cash / Buying Power ({fmtMoney(stats.availableBuyingPower)})</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                      <div
                        className="bg-primary h-full shadow-[0_0_10px_rgba(212,255,0,0.3)]"
                        style={{
                          width: `${stats.equityValue + stats.cash > 0 ? Math.min(100, (stats.equityValue / (stats.equityValue + stats.cash)) * 100) : 0}%`,
                        }}
                      />
                      <div
                        className="bg-sky-400 h-full"
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
        {/* ROW 2: WATCHLIST (Full Width)                                             */}
        {/* ========================================================================= */}
        <div className="w-full space-y-4">
          <div className="panel-box p-4 sm:p-7 overflow-hidden">
            {/* Header & Watchlist Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5 mb-4 sm:mb-5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="meta-label font-bold text-white uppercase flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-4 w-4 text-primary" /> Watchlist
                </span>
                {/* Watchlist switcher buttons when multiple lists exist */}
                {watchlists && watchlists.length > 1 && (
                  <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded border border-white/[0.08] overflow-x-auto max-w-full">
                    {watchlists.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWatchlistId(w.id)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                          activeWlId === w.id
                            ? "bg-primary text-black"
                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons: New List & Add Ticker */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Create Watchlist Modal */}
                <Dialog open={isNewListOpen} onOpenChange={setIsNewListOpen}>
                  <DialogTrigger asChild>
                    <button className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer">
                      <FolderPlus className="h-3 w-3 text-primary" />
                      <span>+ List</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#111113] border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase tracking-wide">
                        Create Custom Watchlist
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateList} className="space-y-4 mt-2">
                      <div>
                        <label className="meta-label block mb-1.5">Watchlist Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Growth, Tech, Dividend"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          required
                          className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="meta-label block mb-1.5">Description (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Core tracked tickers"
                          value={newListDesc}
                          onChange={(e) => setNewListDesc(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsNewListOpen(false)}
                          className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-muted-foreground uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createListMut.isPending}
                          className="px-4 py-2 rounded bg-primary text-black font-mono text-xs font-bold uppercase hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                        >
                          {createListMut.isPending ? "Creating..." : "Create Watchlist"}
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Add Ticker Modal */}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <button className="px-2.5 py-1 rounded bg-primary text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-primary/90 transition-colors cursor-pointer">
                      <Plus className="h-3 w-3" />
                      <span>+ Ticker</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#111113] border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold uppercase tracking-wide">
                        Add Ticker to Watchlist
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddSubmit} className="space-y-4 mt-2">
                      <div>
                        <label className="meta-label block mb-1.5">Ticker Symbol</label>
                        <input
                          type="text"
                          placeholder="e.g. NVDA, AAPL, TSLA, SPY, AMD"
                          value={tickerInput}
                          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                          required
                          className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono uppercase placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddOpen(false)}
                          className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-muted-foreground uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addSymbolMut.isPending}
                          className="px-4 py-2 rounded bg-primary text-black font-mono text-xs font-bold uppercase hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                        >
                          {addSymbolMut.isPending ? "Adding..." : "Add to List"}
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Delete List button */}
                {watchlists && watchlists.length > 1 && activeWlId && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this watchlist?")) {
                        deleteListMut.mutate({ watchlistId: activeWlId });
                      }
                    }}
                    disabled={deleteListMut.isPending}
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                    title="Delete this watchlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Watchlist Table */}
            {isWatchlistLoading ? (
              <div className="py-12 space-y-2.5">
                <Skeleton className="h-7 w-full bg-white/5" />
                <Skeleton className="h-7 w-full bg-white/5" />
                <Skeleton className="h-7 w-full bg-white/5" />
              </div>
            ) : !watchlistData || watchlistData.items.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Sparkles className="h-7 w-7 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-white">Watchlist is empty</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Add tickers above to track live prices, IV Rank, YTD performance, and 52-week High/Low.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mt-2">
                <table className="w-full text-left border-collapse text-xs font-mono min-w-[620px]">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-muted-foreground text-[11px]">
                      <th className="pb-2.5 font-normal meta-label">Ticker</th>
                      <th className="pb-2.5 font-normal meta-label text-right">Price</th>
                      <th className="pb-2.5 font-normal meta-label text-right">Day Chg</th>
                      <th className="pb-2.5 font-normal meta-label text-center">IVR</th>
                      <th className="pb-2.5 font-normal meta-label text-right">YTD</th>
                      <th className="pb-2.5 font-normal meta-label text-right">High</th>
                      <th className="pb-2.5 font-normal meta-label text-right">Low</th>
                      <th className="pb-2.5 font-normal meta-label text-center min-w-[140px]">52W Range</th>
                      <th className="pb-2.5 font-normal meta-label text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {watchlistData.items.map((item) => {
                      const iv = item.ivRank ?? 35;
                      const ivColor =
                        iv >= 60
                          ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                          : iv >= 30
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-blue-400/15 text-blue-300 border-blue-400/30";

                      const pos52 = item.fiftyTwoWeekPos ?? 50;
                      const ytd = item.ytdChangePct;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-white/[0.03] transition-colors group"
                        >
                          {/* Ticker Symbol & Name */}
                          <td className="py-3">
                            <div className="font-bold text-white text-sm">
                              {item.symbol}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-sans truncate max-w-[140px]">
                              {item.name}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3 text-right font-medium text-white text-xs">
                            {item.price ? fmtMoney(item.price) : "—"}
                          </td>

                          {/* Day Change */}
                          <td
                            className={`py-3 text-right font-medium text-xs ${
                              item.change >= 0 ? "text-primary" : "text-red-400"
                            }`}
                          >
                            {item.price ? (
                              <>
                                <div>
                                  {item.change >= 0 ? "+" : ""}
                                  {item.change.toFixed(2)}
                                </div>
                                <div className="text-[10px]">
                                  {item.changePct >= 0 ? "+" : ""}
                                  {item.changePct.toFixed(2)}%
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* IVR (IV Rank) */}
                          <td className="py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${ivColor}`}
                              title={`Implied Volatility Rank: ${iv}%`}
                            >
                              {iv}%
                            </span>
                          </td>

                          {/* YTD Return */}
                          <td
                            className={`py-3 text-right font-medium text-xs ${
                              ytd == null
                                ? "text-muted-foreground"
                                : ytd >= 0
                                  ? "text-primary"
                                  : "text-red-400"
                            }`}
                          >
                            {ytd != null ? `${ytd >= 0 ? "+" : ""}${ytd.toFixed(2)}%` : "—"}
                          </td>

                          {/* 52W High */}
                          <td className="py-3 text-right font-medium text-white/90 text-xs">
                            {item.fiftyTwoWeekHigh ? fmtMoney(item.fiftyTwoWeekHigh) : "—"}
                          </td>

                          {/* 52W Low */}
                          <td className="py-3 text-right font-medium text-muted-foreground text-xs">
                            {item.fiftyTwoWeekLow ? fmtMoney(item.fiftyTwoWeekLow) : "—"}
                          </td>

                          {/* 52W Range Visual */}
                          <td className="py-3 px-3">
                            <div className="w-full flex flex-col items-center gap-1">
                              <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden relative">
                                <div
                                  className="bg-primary h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.max(3, pos52))}%` }}
                                />
                              </div>
                              <div className="w-full flex justify-between text-[9px] text-muted-foreground font-mono">
                                <span>{item.fiftyTwoWeekLow ? fmtMoney(item.fiftyTwoWeekLow) : "Low"}</span>
                                <span className="text-white/80 font-bold">{pos52}%</span>
                                <span>{item.fiftyTwoWeekHigh ? fmtMoney(item.fiftyTwoWeekHigh) : "High"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Remove Action */}
                          <td className="py-3 text-right">
                            <button
                              onClick={() =>
                                removeSymbolMut.mutate({
                                  watchlistId: item.watchlistId,
                                  symbol: item.symbol,
                                })
                              }
                              className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remove from watchlist"
                            >
                              <X className="h-3.5 w-3.5" />
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
    </div>
  );
}
