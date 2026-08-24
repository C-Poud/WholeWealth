import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  isPinned?: boolean;
}

export function Logo({ size = 32, showText = true, className = "", isPinned }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`relative shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-b from-[#1c1c20] to-[#0c0c0e] border transition-all ${
          isPinned
            ? "border-primary/50 shadow-[0_0_20px_rgba(212,255,0,0.3)]"
            : "border-white/10 shadow-[0_0_15px_rgba(212,255,0,0.12)] group-hover:border-primary/40 group-hover:shadow-[0_0_20px_rgba(212,255,0,0.25)]"
        }`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[70%] h-[70%]"
        >
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4FF00" />
              <stop offset="100%" stopColor="#9DE000" />
            </linearGradient>
            <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d="M7 25V7L25 25V7"
            stroke="url(#logo-grad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#logo-glow)"
          />
          <circle cx="25" cy="7" r="2.5" fill="#D4FF00" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display font-extrabold tracking-tight text-sm text-white uppercase tracking-wider">
            NetWorth<span className="text-primary font-mono">.io</span>
          </span>
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 text-primary bg-primary/10 border border-primary/30 rounded shadow-[0_0_8px_rgba(212,255,0,0.15)]">
            PRO
          </span>
        </div>
      )}
    </div>
  );
}
