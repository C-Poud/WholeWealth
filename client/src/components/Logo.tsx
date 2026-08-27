import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  isPinned?: boolean;
}

export function Logo({ size = 32, showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div
        className="shrink-0 flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/25"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-4 h-4 text-emerald-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-sans font-semibold tracking-tight text-sm text-white">
            Whole<span className="text-emerald-400 font-semibold">Wealth</span>
          </span>
        </div>
      )}
    </div>
  );
}
