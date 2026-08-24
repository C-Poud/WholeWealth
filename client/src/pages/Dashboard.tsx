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
  ShieldAlert,
  Coins,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  FolderPlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

const POPULAR_WHEEL_TICKERS = [
  "NVDA",
  "AAPL",
  "TSLA",
  "AMD",
  "SPY",
  "MSFT",
  "AMZN",
  "PLTR",
  "GOOGL",
];

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.portfolio.overview.useQuery();
  const { data: deltaData } = trpc.suggestions.spxDelta.useQuery();

  // Watchlist state & queries
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | undefined>(undefined);
  const [tickerInput, setTickerInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
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
      setNotesInput("");
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

    const allocation = [...bySymbol.entries()]
      .map(([symbol, data]) => ({
        symbol,
        value: +(data.mktVal || data.cost || 0).toFixed(2),
      }))
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

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
      pnl: equityValue - totalCost,
      pnlPct: totalCost > 0 ? (equityValue - totalCost) / totalCost : null,
      count: positions.length,
      allocation,
      hasDemo: positions.some((p) => p.source === "demo"),
    };
  }, [data]);

  const handleQuickAdd = (sym: string) => {
    if (!activeWlId) return;
    addSymbolMut.mutate({
      watchlistId: activeWlId,
      symbol: sym,
      notes: "Quick added from Wheel preset",
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWlId || !tickerInput.trim()) return;
    addSymbolMut.mutate({
      watchlistId: activeWlId,
      symbol: tickerInput.trim().toUpperCase(),
      notes: notesInput.trim() || undefined,
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
      <div className="p-4 sm:p-10 space-y-6 max-w-[1500px] mx-auto">
        <Skeleton className="h-12 w-80 bg-white/5" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-80 bg-white/5" />
      </div>
    );
  }

  const positions = data?.positions ?? [];

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Portfolio
          </h1>
          <p className="meta-label mt-2">
            Live holdings, SPX Beta Delta & custom watchlists
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deltaData?.hasPositions && (
            <Link
              to="/suggestions"
              className="px-3 py-1.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
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
            <div className="neon-badge shrink-0 self-start md:self-auto">
              Demo Data Active
            </div>
          ) : (
            <div className="neon-badge shrink-0 self-start md:self-auto">
              Live Workspace
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="p-4 rounded border border-destructive/40 bg-destructive/10 flex items-center justify-between gap-4">
          <p className="text-sm text-destructive font-mono">
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

      {positions.length === 0 ? (
        <div className="panel-box py-20 text-center space-y-4">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground stroke-1" />
          <p className="text-xl font-display font-bold uppercase tracking-tight">
            No positions yet
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect a brokerage via SnapTrade, upload a broker export, or load a demo portfolio to explore the analytics.
          </p>
          <Link
            to="/portfolio"
            className="inline-block mt-3 rounded bg-primary px-5 py-2.5 text-xs font-mono font-bold text-black hover:bg-primary/90 uppercase tracking-wider cursor-pointer"
          >
            Go to Portfolio
          </Link>
        </div>
      ) : (
        <>
          {/* Stats & Risk KPIs Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <div className="stat-card">
              <div className="meta-label">Capital at Work</div>
              <div className="stat-value text-white">
                {fmtMoney(stats.capitalAtWork)}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {fmtMoney(stats.stockCostBasis)} stock · {fmtMoney(stats.cspCollateral)} CSP
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">Available Buying Power</div>
              <div className="stat-value text-primary">
                {fmtMoney(stats.availableBuyingPower)}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {fmtMoney(stats.cash)} total cash in accounts
              </div>
            </div>

            {/* Whole Portfolio SPX Beta Delta (Decimals) */}
            <div className="stat-card">
              <div className="meta-label flex items-center justify-between">
                <span>Portfolio SPX Beta Δ</span>
                <span className="text-[10px] text-muted-foreground font-mono">β {deltaData?.portfolioBeta?.toFixed(2) ?? "1.00"}</span>
              </div>
              <div
                className={`stat-value flex items-center gap-1.5 ${
                  deltaData?.neutral
                    ? "text-white"
                    : (deltaData?.totalDelta ?? 0) > 0
                      ? "text-primary"
                      : "text-red-400"
                }`}
              >
                {deltaData?.hasPositions && !deltaData.neutral && (
                  (deltaData.totalDelta > 0 ? (
                    <ArrowUpRight className="h-6 w-6 shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 shrink-0" />
                  ))
                )}
                <span>
                  {(deltaData?.spxBetaDelta ?? 0) >= 0 ? "+" : ""}
                  {(deltaData?.spxBetaDelta ?? 0).toFixed(2)}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Δ
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono flex items-center justify-between">
                <span>
                  {((deltaData?.spyBetaDelta ?? 0) >= 0 ? "+" : "") + (deltaData?.spyBetaDelta ?? 0).toFixed(1)} SPY equiv.
                </span>
                <Link
                  to="/suggestions"
                  className="text-primary hover:underline"
                >
                  Hedge →
                </Link>
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">Option Coverage</div>
              <div className="stat-value text-white">
                {stats.coveragePct.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {fmtNum(stats.coveredShares, 0)} / {fmtNum(stats.roundLotShares, 0)} shares · {stats.shortCallCount} CC / {stats.shortPutCount} CSP
              </div>
            </div>

            <div className="stat-card">
              <div className="meta-label">Unrealized P&L</div>
              <div
                className={`stat-value ${
                  stats.pnl >= 0 ? "text-primary" : "text-red-400"
                }`}
              >
                {stats.pnl >= 0 ? `+${fmtMoney(stats.pnl)}` : fmtMoney(stats.pnl)}
              </div>
              {stats.pnlPct != null && (
                <div
                  className={`text-xs font-mono mt-2 ${
                    stats.pnl >= 0 ? "text-primary" : "text-red-400"
                  }`}
                >
                  {stats.pnlPct >= 0 ? "+" : ""}{fmtPct(stats.pnlPct)} {stats.pnl >= 0 ? "▲" : "▼"}
                </div>
              )}
            </div>
          </section>

          {/* Positions Table & Allocation Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {/* Positions Table Panel */}
            <div className="panel-box p-6 lg:col-span-2 xl:col-span-3 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="meta-label">
                  Active Positions [{String(positions.length).padStart(2, "0")}]
                </span>
                <Link
                  to="/portfolio"
                  className="meta-label text-muted-foreground hover:text-white transition-colors"
                >
                  Manage Holdings →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                      <th className="pb-3 font-normal meta-label">Symbol</th>
                      <th className="pb-3 font-normal meta-label">Type</th>
                      <th className="pb-3 font-normal meta-label text-right">Qty</th>
                      <th className="pb-3 font-normal meta-label text-right">Cost</th>
                      <th className="pb-3 font-normal meta-label text-right">Price</th>
                      <th className="pb-3 font-normal meta-label text-right">Value</th>
                      <th className="pb-3 font-normal meta-label text-right">P&L</th>
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
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 font-mono font-bold text-white">
                            {label}
                          </td>
                          <td className="py-3 capitalize text-muted-foreground text-xs font-sans">
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
                              pnl >= 0 ? "gain" : "text-red-400"
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

              {/* Real-time Log Activity Widget */}
              <div className="activity-widget mt-6">
                <div className="meta-label mb-2 text-[0.6rem]">Real-time Portfolio Greek Stream</div>
                <div className="activity-line">
                  <span>{new Date().toLocaleTimeString()}</span>
                  <span>
                    SPX BETA DELTA: {(deltaData?.spxBetaDelta ?? 0) >= 0 ? "+" : ""}{(deltaData?.spxBetaDelta ?? 0).toFixed(2)} Δ · WEIGHTED BETA: {deltaData?.portfolioBeta?.toFixed(2) ?? "1.00"}
                  </span>
                </div>
                <div className="activity-line">
                  <span>MARKET FEED</span>
                  <span>{positions.length} ACTIVE CONTRACTS/EQUITIES MONITORED</span>
                </div>
              </div>
            </div>

            {/* Allocation Matrix Panel */}
            <div className="panel-box p-6 flex flex-col justify-between">
              <div>
                <span className="meta-label block mb-4">
                  Allocation Matrix
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
                          innerRadius={55}
                          outerRadius={80}
                          strokeWidth={2}
                          stroke="#111113"
                          paddingAngle={3}
                        >
                          {stats.allocation.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [fmtMoney(v), "Value"]}
                          labelStyle={{ color: "#ffffff", fontWeight: 600, marginBottom: "2px" }}
                          itemStyle={{ color: "#d4ff00", fontWeight: 500 }}
                          contentStyle={{
                            backgroundColor: "#111113",
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            borderRadius: "4px",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "12px",
                            color: "#ffffff",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-white/[0.08]">
                {stats.allocation.map((a, i) => (
                  <div
                    key={a.symbol}
                    className="flex justify-between items-center text-xs py-1"
                  >
                    <span className="flex items-center font-medium font-sans">
                      <span
                        className="w-2 h-2 rounded-[1px] inline-block mr-2.5"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      {a.symbol}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {fmtMoney(a.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* CUSTOM USER WATCHLIST COMPONENT                                           */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.08] pt-8">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white">
                Wheel Target Watchlists
              </h2>
              <span className="neon-badge">Custom Watchlist</span>
            </div>
            <p className="meta-label mt-1">
              Create lists, track option candidate pricing, beta sensitivity & launch mechanic analysis
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Watchlist selector tabs/buttons */}
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded border border-white/[0.06]">
              {watchlists?.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWatchlistId(w.id)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    activeWlId === w.id
                      ? "bg-primary text-black"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>

            {/* Create Watchlist Modal */}
            <Dialog open={isNewListOpen} onOpenChange={setIsNewListOpen}>
              <DialogTrigger asChild>
                <button className="px-3 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer">
                  <FolderPlus className="h-3.5 w-3.5 text-primary" />
                  <span>+ New List</span>
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
                      placeholder="e.g. AI Champions, High Yield CSPs"
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
                      placeholder="e.g. Candidates for 30-45 DTE Cash Secured Puts"
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
                <button className="px-3 py-1.5 rounded bg-primary text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Ticker</span>
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
                      placeholder="e.g. NVDA, AAPL, TSLA, SPY"
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                      required
                      className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono uppercase placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="meta-label block mb-1.5">Strategy Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Target 0.20Δ Put under $125"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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

            {/* Delete List button (if more than 1 list) */}
            {watchlists && watchlists.length > 1 && activeWlId && (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this watchlist?")) {
                    deleteListMut.mutate({ watchlistId: activeWlId });
                  }
                }}
                disabled={deleteListMut.isPending}
                className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                title="Delete this watchlist"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Add Preset Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-muted-foreground">
          <span className="meta-label text-[10px]">Quick Add Wheel Favorites:</span>
          {POPULAR_WHEEL_TICKERS.map((sym) => {
            const alreadyInList = watchlistData?.items.some((i) => i.symbol === sym);
            return (
              <button
                key={sym}
                onClick={() => !alreadyInList && handleQuickAdd(sym)}
                disabled={alreadyInList || addSymbolMut.isPending}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  alreadyInList
                    ? "border-white/5 text-muted-foreground/40 cursor-default"
                    : "border-white/10 bg-white/[0.02] text-white hover:border-primary/50 hover:text-primary"
                }`}
              >
                {alreadyInList ? `✓ ${sym}` : `+ ${sym}`}
              </button>
            );
          })}
        </div>

        {/* Watchlist Table Panel */}
        <div className="panel-box p-6 overflow-hidden">
          {isWatchlistLoading ? (
            <div className="py-12 space-y-3">
              <Skeleton className="h-8 w-full bg-white/5" />
              <Skeleton className="h-8 w-full bg-white/5" />
              <Skeleton className="h-8 w-full bg-white/5" />
            </div>
          ) : !watchlistData || watchlistData.items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-mono text-white">This watchlist is empty</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add tickers using the button above or pick from quick-add suggestions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                    <th className="pb-3 font-normal meta-label">Ticker / Asset</th>
                    <th className="pb-3 font-normal meta-label text-right">Price</th>
                    <th className="pb-3 font-normal meta-label text-right">Today's Chg</th>
                    <th className="pb-3 font-normal meta-label text-right">Beta (vs SPX)</th>
                    <th className="pb-3 font-normal meta-label">Wheel Category</th>
                    <th className="pb-3 font-normal meta-label">Notes</th>
                    <th className="pb-3 font-normal meta-label text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                  {watchlistData.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Ticker & Name */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {item.symbol}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-sans truncate max-w-[140px] sm:max-w-[200px]">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 text-right font-medium text-white text-sm">
                        {item.price ? fmtMoney(item.price) : "—"}
                      </td>

                      {/* Day Change */}
                      <td
                        className={`py-3.5 text-right font-medium ${
                          item.change >= 0 ? "text-primary" : "text-red-400"
                        }`}
                      >
                        {item.price ? (
                          <>
                            {item.change >= 0 ? "+" : ""}
                            {item.change.toFixed(2)} ({item.changePct >= 0 ? "+" : ""}
                            {item.changePct.toFixed(2)}%)
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Beta */}
                      <td className="py-3.5 text-right text-white font-bold">
                        {item.beta ? item.beta.toFixed(2) : "1.00"}
                      </td>

                      {/* Wheel Category */}
                      <td className="py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-medium uppercase tracking-wider ${
                            item.beta > 1.4
                              ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                              : item.beta < 0.8
                                ? "bg-blue-400/10 text-blue-400 border border-blue-400/20"
                                : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {item.wheelCategory}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 text-muted-foreground font-sans text-xs max-w-[180px] truncate">
                        {item.notes || "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/basis?symbol=${item.symbol}`}
                            className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-bold text-primary hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
                            title="Run Basis Improvement / Covered Call analysis"
                          >
                            <Coins className="h-3 w-3" />
                            <span>Basis</span>
                          </Link>
                          <Link
                            to={`/risk?symbol=${item.symbol}`}
                            className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-bold text-muted-foreground hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
                            title="Run Risk & ±2σ Expected Move Check"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            <span>Risk</span>
                          </Link>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
