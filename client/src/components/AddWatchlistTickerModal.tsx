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
import { CompanyLogo } from "@/components/CompanyLogo";
import { fmtMoney } from "@/lib/format";
import {
  Search,
  Plus,
  X,
  Target,
  FileText,
} from "lucide-react";

interface AddWatchlistTickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watchlistId: number;
  watchlistName?: string;
  onSuccess?: () => void;
  initialSymbol?: string;
}

export function AddWatchlistTickerModal({
  open,
  onOpenChange,
  watchlistId,
  watchlistName,
  onSuccess,
  initialSymbol = "",
}: AddWatchlistTickerModalProps) {
  const [query, setQuery] = useState(initialSymbol || "");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol || "");
  const [targetStrike, setTargetStrike] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
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

  const addSymbolMut = trpc.watchlist.addSymbol.useMutation({
    onSuccess: (item) => {
      toast.success(`Added ${item.symbol} to watchlist`);
      handleClose();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message || "Failed to add ticker to watchlist"),
  });

  const resetForm = () => {
    setQuery("");
    setSelectedSymbol("");
    setTargetStrike("");
    setNotes("");
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
    if (price && price > 0 && !targetStrike) {
      // Pre-calculate standard ~5% OTM strike suggestion
      const otm5 = Math.round(price * 1.05);
      setTargetStrike(otm5.toString());
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

  const spotPrice = previewQuery.data?.price ?? null;
  const numTargetStrike = parseFloat(targetStrike);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol.trim()) {
      toast.error("Please enter or select a ticker symbol");
      return;
    }

    addSymbolMut.mutate({
      watchlistId,
      symbol: selectedSymbol.trim().toUpperCase(),
      targetStrike: !isNaN(numTargetStrike) && numTargetStrike > 0 ? numTargetStrike : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111318] border border-white/10 text-white sm:max-w-[440px] w-full p-0 overflow-hidden shadow-2xl rounded-2xl min-h-[500px] max-h-[90vh] flex flex-col justify-between">
        <div>
          <DialogHeader className="p-5 pb-4 border-b border-white/[0.08] bg-[#14161d] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white font-sans tracking-tight">
                    Add Stock / ETF to Watchlist
                  </DialogTitle>
                  {watchlistName && (
                    <p className="text-xs text-zinc-400">
                      {watchlistName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} id="add-watchlist-form" className="p-5 space-y-5">
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
                  placeholder="Type ticker or name (e.g. AAPL, SPY, NVDA)…"
                  className="bg-[#0a0c10] border-white/15 text-white font-mono text-sm pl-9 pr-8 py-2.5 focus:border-emerald-500 h-11 rounded-lg"
                />
                <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-3.5 pointer-events-none" />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedSymbol("");
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-3 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && suggestions.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 left-0 right-0 top-[72px] bg-[#141720] border border-white/15 rounded-lg shadow-2xl max-h-60 overflow-y-auto divide-y divide-white/[0.06]"
                >
                  {suggestions.map((item, idx) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => handleSelectSymbol(item.symbol, item.price)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                        selectedIndex === idx
                          ? "bg-emerald-500/15 text-white"
                          : "hover:bg-white/[0.06] text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo symbol={item.symbol} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-sm text-white">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] uppercase px-1 py-0.2 rounded bg-white/10 text-zinc-400 font-mono">
                              {item.assetType}
                            </span>
                            {item.recommendationTag && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                                {item.recommendationTag}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 truncate max-w-[200px] sm:max-w-[240px]">
                            {item.name}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        {item.price != null && (
                          <div className="text-xs font-bold text-white">
                            {fmtMoney(item.price)}
                          </div>
                        )}
                        {item.changePct != null && (
                          <div
                            className={`text-[10px] ${
                              item.changePct >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {item.changePct >= 0 ? "+" : ""}
                            {item.changePct.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Auto-Pricing & Market Preview Card */}
            {selectedSymbol && (
              <div className="p-4 rounded-xl border border-white/10 bg-[#0d0f14] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo symbol={selectedSymbol} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-base text-white">
                          {selectedSymbol}
                        </span>
                        {previewQuery.data?.assetType && (
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
                            {previewQuery.data.assetType}
                          </span>
                        )}
                        {previewQuery.isLoading && (
                          <span className="text-[10px] text-zinc-400 animate-pulse font-mono">
                            Loading quote…
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {previewQuery.data?.name || "Active Ticker"}
                      </div>
                    </div>
                  </div>

                  {spotPrice != null && (
                    <div className="text-right font-mono">
                      <div className="text-base font-bold text-white">
                        {fmtMoney(spotPrice)}
                      </div>
                      {previewQuery.data?.changePct != null && (
                        <div
                          className={`text-xs font-semibold ${
                            previewQuery.data.changePct >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {previewQuery.data.changePct >= 0 ? "+" : ""}
                          {previewQuery.data.changePct.toFixed(2)}%
                          {previewQuery.data.change != null && ` (${previewQuery.data.change >= 0 ? "+" : ""}${fmtMoney(previewQuery.data.change)})`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Target Strike & Notes Inputs */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <Target className="h-3 w-3 text-amber-400" /> Target Strike / Price (Optional)
                </Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 150"
                  value={targetStrike}
                  onChange={(e) => setTargetStrike(e.target.value)}
                  className="bg-[#0a0c10] border-white/15 text-white font-mono text-xs h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <FileText className="h-3 w-3 text-zinc-400" /> Strategy Notes (Optional)
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Covered Call target, high IV candidate"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-[#0a0c10] border-white/15 text-white font-mono text-xs h-10 rounded-lg"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-white/[0.08] bg-[#14161d]/50 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="text-xs font-mono border-white/10 hover:bg-white/5 text-zinc-400 h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-watchlist-form"
            disabled={!selectedSymbol.trim() || addSymbolMut.isPending}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs px-6 h-10 shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {addSymbolMut.isPending ? "Adding..." : `Add ${selectedSymbol || "Ticker"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
