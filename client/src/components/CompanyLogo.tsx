import { useState } from "react";

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

export function getTickerColor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TICKER_ACCENT_COLORS.length;
  return TICKER_ACCENT_COLORS[index];
}

/** Extracts the clean root ticker symbol from potential option labels or multi-word strings */
export function extractRootSymbol(raw: string): string {
  if (!raw) return "";
  const first = raw.trim().split(/[\s/]/)[0] ?? "";
  // Check if OCC option format e.g. NFLX261016C00095000
  const occMatch = first.match(/^([A-Za-z.]{1,7})\d{6}[CPcp]/);
  if (occMatch) return occMatch[1].toUpperCase();
  return first.toUpperCase();
}

interface CompanyLogoProps {
  symbol: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function CompanyLogo({
  symbol,
  name,
  size = "md",
  className = "",
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);
  const rootSymbol = extractRootSymbol(symbol);
  const tColor = getTickerColor(rootSymbol);

  const sizeClasses = {
    xs: "h-5 w-5 text-[9px] rounded",
    sm: "h-6 w-6 text-[10px] rounded-md",
    md: "h-8 w-8 text-xs rounded-lg",
    lg: "h-10 w-10 text-sm rounded-xl",
  }[size];

  const logoUrl = `https://assets.parqet.com/logos/symbol/${rootSymbol}?format=png`;

  if (hasError || !rootSymbol) {
    return (
      <div
        className={`${sizeClasses} ${tColor.bg} ${tColor.border} border flex items-center justify-center font-bold font-mono ${tColor.text} shadow-sm shrink-0 select-none ${className}`}
        title={name || rootSymbol}
      >
        {rootSymbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} bg-[#181a20] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group p-0.5 ${className}`}
      title={name || rootSymbol}
    >
      <img
        src={logoUrl}
        alt={`${rootSymbol} logo`}
        className="w-full h-full object-contain rounded transition-transform duration-200 group-hover:scale-105"
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
