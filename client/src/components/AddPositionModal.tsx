import { useState, useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import {
  Search,
  Sparkles,
  Plus,
  Building2,
  X,
} from "lucide-react";

interface AddPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts?: Array<{ id: number; name: string; institution?: string | null }>;
  initialSymbol?: string;
}

const POPULAR_QUICK_PICKS = [
  { symbol: "SPY", label: "SPY", name: "S&P 500 ETF", type: "etf" },
  { symbol: "QQQ", label: "QQQ", name: "Nasdaq-100", type: "etf" },
  { symbol: "AAPL", label: "AAPL", name: "Apple", type: "stock" },
  { symbol: "NVDA", label: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "TSLA", label: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "MSFT", label: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "AMZN", label: "AMZN", name: "Amazon", type: "stock" },
  { symbol: "AMD", label: "AMD", name: "AMD", type: "stock" },
];

export function AddPositionModal({
  open,
  onOpenChange,
  onSuccess,
  accounts = [],
  initialSymbol = "",
}: AddPositionModalProps) {
  const [query, setQuery] = useState(initialSymbol || "");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol || "");
  const [quantity, setQuantity] = useState<string>("100");
  const [costBasis, setCostBasis] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && initialSymbol) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSymbol(initialSymbol.toUpperCase());
      setQuery(initialSymbol.toUpperCase());
    }
  }, [open, initialSymbol]);

  // Search suggestions query with fast response
  const searchQuery = trpc.portfolio.searchSymbols.useQuery(
    { query },
    {
      enabled: open,
      staleTime: 30_000,
    }
  );

  // Live detail preview for the selected symbol
  const previewQuery = trpc.portfolio.symbolPreview.useQuery(
    { symbol: selectedSymbol },
    {
      enabled: open && !!selectedSymbol,
      staleTime: 60_000,
    }
  );

  const addManualMut = trpc.portfolio.addManual.useMutation({
    onSuccess: (d) => {
      toast.success(
        d.name
          ? `Added ${quantity} shares of ${selectedSymbol} (${d.name})`
          : `Added position ${selectedSymbol}`
      );
      handleClose();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-fill cost basis when live price preview arrives if costBasis is empty
  useEffect(() => {
    if (previewQuery.data?.price && (!costBasis || costBasis === "0")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCostBasis(previewQuery.data.price.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewQuery.data?.price]);

  const resetForm = () => {
    setQuery("");
    setSelectedSymbol("");
    setQuantity("100");
    setCostBasis("");
    setSelectedAccountId(null);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetForm();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSymbol = (sym: string, price?: number | null) => {
    const upper = sym.toUpperCase();
    setSelectedSymbol(upper);
    setQuery(upper);
    setIsDropdownOpen(false);
    if (price && price > 0) {
      setCostBasis(price.toFixed(2));
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  const suggestions = searchQuery.data ?? [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsDropdownOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSymbol(suggestions[selectedIndex].symbol, suggestions[selectedIndex].price);
      } else if (query.trim()) {
        handleSelectSymbol(query.trim());
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const numQuantity = Number(quantity) || 0;
  const numCostBasis = Number(costBasis) || 0;
  const totalInvestment = numQuantity * numCostBasis;
  const spotPrice = previewQuery.data?.price ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111318] border border-white/10 text-white sm:max-w-xl p-0 overflow-hidden shadow-2xl rounded-xl">
        <DialogHeader className="p-5 pb-4 border-b border-white/[0.08] bg-[#14161d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white font-sans tracking-tight">
                  Add Stock / ETF Position
                </DialogTitle>
                <p className="text-xs text-zinc-400">
                  Search with live recommendations, auto-pricing, and lot helpers
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Symbol Search Field with live Autocomplete Dropdown */}
          <div className="space-y-2 relative">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-emerald-400" /> Symbol / Company Search
              </Label>
              {selectedSymbol && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Selected: {selectedSymbol}
                </span>
              )}
            </div>

            <div className="relative">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedSymbol(e.target.value.trim().toUpperCase());
                  setIsDropdownOpen(true);
                  setSelectedIndex(-1);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Type ticker or name (e.g. AAPL, SPY, NVDA, Tesla)…"
                className="bg-[#0a0c10] border-white/15 text-white font-mono text-sm pl-9 pr-8 py-2.5 focus:border-emerald-500 h-10"
              />
              <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedSymbol("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick-Pick Recommended Tickers */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mr-1">
                <Sparkles className="h-3 w-3 text-emerald-400" /> Popular:
              </span>
              {POPULAR_QUICK_PICKS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => handleSelectSymbol(item.symbol)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer border ${
                    selectedSymbol === item.symbol
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                      : "bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Autocomplete Suggestions Menu */}
            {isDropdownOpen && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 left-0 right-0 top-[68px] bg-[#141720] border border-white/15 rounded-lg shadow-2xl max-h-64 overflow-y-auto overflow-x-hidden divide-y divide-white/[0.06]"
              >
                <div className="px-3 py-1.5 bg-[#181b26] text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Suggestions & Recommendations</span>
                  <span>Use ↑↓ to navigate</span>
                </div>
                {suggestions.map((item, idx) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => handleSelectSymbol(item.symbol, item.price)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors ${
                      selectedIndex === idx
                        ? "bg-emerald-500/15 text-white"
                        : "hover:bg-white/[0.05] text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-sm text-emerald-400 w-14">
                        {item.symbol}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-white truncate max-w-[240px] font-medium">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                          <span className="uppercase font-mono text-[9px] bg-white/[0.08] px-1 py-0.2 rounded text-zinc-300">
                            {item.assetType}
                          </span>
                          {item.recommendationTag && (
                            <span className="text-emerald-400/90 truncate">
                              • {item.recommendationTag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right pl-2 shrink-0">
                      {item.price ? (
                        <div className="font-mono text-xs font-semibold text-white">
                          {fmtMoney(item.price)}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">Live</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Symbol Insights & Recommendation Card */}
          {selectedSymbol && (
            <div className="p-3.5 rounded-lg bg-[#0e1017] border border-white/10 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono text-white">
                      {selectedSymbol}
                    </span>
                    <span className="text-[10px] uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                      {previewQuery.data?.assetType ?? "Stock"}
                    </span>
                    {previewQuery.data?.category && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {previewQuery.data.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {previewQuery.data?.name || "Looking up live quote…"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-zinc-400">Current Price</div>
                  <div className="text-base font-mono font-bold text-emerald-400">
                    {spotPrice != null ? fmtMoney(spotPrice) : "…"}
                  </div>
                </div>
              </div>

              {/* Strategy recommendation tip */}
              {previewQuery.data?.tip && (
                <div className="flex items-center gap-2 text-xs bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 px-2.5 py-1.5 rounded">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="leading-snug">{previewQuery.data.tip}</span>
                </div>
              )}
            </div>
          )}

          {/* Quantity & Cost Basis Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-300">Quantity (Shares)</Label>
                <span className="text-[10px] text-zinc-500 font-mono">100 = 1 Option Lot</span>
              </div>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                className="bg-[#0a0c10] border-white/15 text-white font-mono text-sm h-10"
              />
              <div className="flex items-center gap-1 pt-1">
                {[100, 200, 50, 10].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuantity(String(qty))}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      quantity === String(qty)
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold"
                        : "bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-white"
                    }`}
                  >
                    {qty === 100 ? "100 (1 Lot)" : qty}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Basis */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-300">Cost Basis ($ / share)</Label>
                {spotPrice != null && (
                  <button
                    type="button"
                    onClick={() => setCostBasis(spotPrice.toFixed(2))}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono underline cursor-pointer"
                  >
                    Use Market Price
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder={spotPrice ? spotPrice.toFixed(2) : "0.00"}
                className="bg-[#0a0c10] border-white/15 text-white font-mono text-sm h-10"
              />
              <div className="text-[10px] text-zinc-500 font-mono pt-1">
                {spotPrice ? `Live Spot: ${fmtMoney(spotPrice)}` : "Optional — defaults to spot"}
              </div>
            </div>
          </div>

          {/* Account Selection (if user has accounts) */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-zinc-400" /> Assign to Brokerage Account (Optional)
              </Label>
              <select
                value={selectedAccountId ?? ""}
                onChange={(e) =>
                  setSelectedAccountId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full bg-[#0a0c10] border border-white/15 rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 h-9"
              >
                <option value="">Default Portfolio (Manual)</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.institution ? `(${acc.institution})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Calculated Total Position Value */}
          {totalInvestment > 0 && (
            <div className="p-3 bg-[#0a0c10] rounded-lg border border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Total Position Capital:</span>
              <span className="text-white font-bold text-sm">
                {fmtMoney(totalInvestment)}
                <span className="text-zinc-500 font-normal text-xs ml-1">
                  ({numQuantity} sh @ {fmtMoney(numCostBasis || spotPrice || 0)})
                </span>
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedSymbol || !numQuantity) return;
                addManualMut.mutate({
                  symbol: selectedSymbol,
                  quantity: numQuantity,
                  costBasis: numCostBasis > 0 ? numCostBasis : undefined,
                  accountId: selectedAccountId,
                });
              }}
              disabled={
                !selectedSymbol ||
                !numQuantity ||
                numQuantity <= 0 ||
                addManualMut.isPending
              }
              className="text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] cursor-pointer px-5"
            >
              {addManualMut.isPending ? (
                "Adding Position…"
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Position
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
