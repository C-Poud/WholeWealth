import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bookmark,
  Plus,
  Trash2,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { AddWatchlistTickerModal } from "@/components/AddWatchlistTickerModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SwipeableRowProps {
  item: {
    id: number;
    watchlistId: number;
    symbol: string;
    name: string;
    price?: number | null;
    change?: number | null;
    changePct?: number | null;
  };
  onDelete: (watchlistId: number, symbol: string) => void;
}

const ACTION_WIDTH = 76; // single delete button width

function SwipeableWatchlistRow({ item, onDelete }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentOffsetRef = useRef(0);

  const isPositive = (item.change ?? 0) >= 0;
  const formattedPrice = item.price
    ? Number(item.price).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  const changeFormatted =
    item.change != null
      ? `${isPositive ? "+" : ""}${item.change.toFixed(2)}`
      : "—";

  const pctFormatted =
    item.changePct != null
      ? `${isPositive ? "+" : ""}${item.changePct.toFixed(2)}%`
      : "";

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = offsetX;
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detect horizontal swipe
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      let targetX = currentOffsetRef.current + diffX;
      // Resistance when dragging right past 0
      if (targetX > 0) {
        targetX = Math.pow(targetX, 0.6);
      }
      // Damping when dragging past button reveal
      if (targetX < -ACTION_WIDTH) {
        targetX = -ACTION_WIDTH - Math.pow(Math.abs(targetX + ACTION_WIDTH), 0.7);
      }
      setOffsetX(targetX);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const diffX = e.clientX - startXRef.current;
    const wasClick = Math.abs(diffX) < 6 && Math.abs(e.clientY - startYRef.current) < 6;

    // If it was just a tap and row is open, close/pause it
    if (wasClick && offsetX < -10) {
      setOffsetX(0);
      return;
    }

    // Thresholds:
    // Past -160px: full slide-out delete
    // Past -35px: pause/snap open at -ACTION_WIDTH (-76px)
    // Otherwise: snap closed to 0
    if (offsetX < -160) {
      triggerDelete();
    } else if (offsetX < -35) {
      // Pause open at delete button width
      setOffsetX(-ACTION_WIDTH);
    } else {
      // Snap closed
      setOffsetX(0);
    }
  };

  const triggerDelete = () => {
    setIsDeleting(true);
    setOffsetX(-500); // Slide completely off screen
    setTimeout(() => {
      onDelete(item.watchlistId, item.symbol);
    }, 280);
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
        isDeleting ? "max-h-0 opacity-0 -my-1 py-0" : "max-h-24 opacity-100"
      }`}
    >
      {/* Background Delete Button revealed on slide */}
      <div className="absolute inset-y-0 right-0 w-[76px] flex items-stretch z-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerDelete();
          }}
          className="w-full bg-[#ef4444] hover:bg-red-600 flex items-center justify-center text-white cursor-pointer transition-colors active:opacity-80"
          title="Delete from Watchlist"
        >
          <Trash2 className="h-6 w-6 stroke-[2.2]" />
        </button>
      </div>

      {/* Foreground Content with Swipe Translation */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isDragging
            ? "none"
            : "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="relative z-10 bg-[#0c0d12] py-3.5 px-1 flex items-center justify-between border-b border-white/[0.06] hover:bg-white/[0.02] cursor-grab active:cursor-grabbing select-none w-full touch-pan-y"
      >
        {/* Left: Logo + Symbol & Company Name */}
        <div className="flex items-center gap-3 min-w-0 pr-2 pointer-events-none">
          <CompanyLogo symbol={item.symbol} name={item.name} size="md" />
          <div className="min-w-0">
            <div className="font-bold text-white text-sm sm:text-base tracking-tight font-sans">
              {item.symbol}
            </div>
            <div className="text-xs text-zinc-400 font-sans truncate max-w-[130px] sm:max-w-[320px] leading-tight mt-0.5">
              {item.name}
            </div>
          </div>
        </div>

        {/* Right: Price & Price Change positioned far right */}
        <div className="text-right shrink-0 ml-auto pr-0 pointer-events-none">
          <div className="font-semibold text-white text-sm sm:text-base font-sans tracking-tight">
            {formattedPrice}
          </div>
          <div
            className={`text-xs sm:text-[13px] font-medium font-sans tracking-tight mt-0.5 ${
              isPositive ? "text-emerald-400" : "text-rose-500"
            }`}
          >
            {changeFormatted} {pctFormatted}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Watchlist() {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const utils = trpc.useUtils();
  const { data: watchlists, isLoading: isListLoading } = trpc.watchlist.list.useQuery();

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
      if (activeWlId) {
        utils.watchlist.get.invalidate({ watchlistId: activeWlId });
      }
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

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-5 space-y-3 sm:space-y-4 font-sans text-white select-none">
      {/* Top Bar matching reference */}
      <div className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-sans">
          Watchlist
        </h1>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="p-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Add Ticker"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Subheader Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none px-1 border-b border-white/[0.06] pb-3">
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-white shrink-0 cursor-pointer"
          title="Filter / Sort"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-white/20 shrink-0" />

        {watchlists && watchlists.map((w) => (
          <div key={w.id} className="flex items-center shrink-0">
            <button
              onClick={() => setSelectedWatchlistId(w.id)}
              className={`px-3.5 py-1 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer whitespace-nowrap ${
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
                  placeholder="e.g. Core watchlist symbols for swing trades"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-sm text-white font-sans placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewListOpen(false)}
                  className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 text-xs font-sans text-muted-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createListMut.isPending}
                  className="px-4 py-2 rounded-md bg-white/15 hover:bg-white/20 text-white font-sans text-xs font-semibold disabled:opacity-50 cursor-pointer border border-white/15"
                >
                  {createListMut.isPending ? "Creating..." : "Create Watchlist"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Stock List matching image */}
      <div className="w-full">
        {isListLoading || isWatchlistLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-14 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-14 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-14 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-14 w-full bg-white/5 rounded-lg" />
          </div>
        ) : !watchlistData || watchlistData.items.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-2">
            <div className="h-10 w-10 mx-auto rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400">
              <Bookmark className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-white">Watchlist is currently empty</p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-sans font-medium transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Ticker</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {watchlistData.items.map((item) => (
              <SwipeableWatchlistRow
                key={item.id}
                item={item}
                onDelete={(watchlistId, symbol) => {
                  removeSymbolMut.mutate({ watchlistId, symbol });
                }}
              />
            ))}
          </div>
        )}
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
