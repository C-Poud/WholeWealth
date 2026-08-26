import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  ShieldAlert,
  Lightbulb,
  Rocket,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Link2,
  Upload,
  Layers,
  Compass,
} from "lucide-react";

export const TOUR_STORAGE_KEY = "networth_tour_seen_v1";

export interface TourStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  visual: "welcome" | "portfolio" | "greeks" | "hedging" | "career" | "finish";
  primaryActionLabel?: string;
  primaryActionRoute?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    badge: "Step 1 of 6 · Welcome",
    title: "Welcome to NetWorth.io",
    subtitle: "Institutional-Grade Quantitative Portfolio & Delta-Neutral Terminal",
    description:
      "You are starting with a clean slate with 0 positions and no preloaded data. NetWorth.io gives you institutional-level quantitative risk analytics, real-time Greek simulations, and mathematical hedging tailored to your actual portfolio.",
    icon: Compass,
    visual: "welcome",
  },
  {
    id: "portfolio",
    badge: "Step 2 of 6 · Clean Portfolio",
    title: "Zero Clutter, Real Data",
    subtitle: "Connect your broker, upload statements, or log lots manually",
    description:
      "Your workspace starts completely empty without demo clutter. Connect directly to 20+ brokerages via SnapTrade, upload CSV/Excel files from IBKR, Schwab or Fidelity, or record custom equity and option lots manually.",
    icon: Briefcase,
    visual: "portfolio",
  },
  {
    id: "greeks",
    badge: "Step 3 of 6 · Quantitative Risk",
    title: "Delta Neutral & Greek Modeling",
    subtitle: "Real-time portfolio derivative sensitivity: Δ_portfolio = ∑ w_i Δ_i = 0",
    description:
      "Monitor your total portfolio beta-weighted delta against the S&P 500 (SPX / SPY). Track gamma curvature, theta time decay, and tail risk (1σ and 2σ downside shocks) to protect against unexpected volatility.",
    icon: ShieldAlert,
    visual: "greeks",
  },
  {
    id: "hedging",
    badge: "Step 4 of 6 · Hedge Engine",
    title: "Delta Neutral Hedging Engine",
    subtitle: "Quantified covered calls, protective puts, and collar strategies",
    description:
      "Receive mathematical trade suggestions that balance positive or negative directional exposure back toward neutral (Δ = 0). Preview exact residual delta after execution before putting on risk.",
    icon: Lightbulb,
    visual: "hedging",
  },
  {
    id: "career",
    badge: "Step 5 of 6 · Human Capital",
    title: "Career & Income Correlation",
    subtitle: "Protect against double exposure to your employment sector",
    description:
      "Your human capital (salary and job security) is your largest asset. Model correlation between your employer's sector and your investment holdings to eliminate hidden single-point-of-failure risks.",
    icon: Rocket,
    visual: "career",
  },
  {
    id: "finish",
    badge: "Step 6 of 6 · Ready",
    title: "You're All Set to Trade",
    subtitle: "Your clean workspace is ready for your positions",
    description:
      "Get started by adding your first position or importing your brokerage data. You can re-open this tour at any time from the Settings menu or the top navigation bar.",
    icon: CheckCircle2,
    visual: "finish",
    primaryActionLabel: "Go to Portfolio",
    primaryActionRoute: "/portfolio",
  },
];

export function OnboardingTour({
  forceOpen = false,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const connectMut = trpc.snaptrade.connect.useMutation({
    onSuccess: (d) => {
      window.open(d.url, "_blank", "noopener");
      toast.info("Finish connecting in the SnapTrade portal, then click Sync in your portfolio.");
      setIsOpen(false);
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Check if tour should auto-open on first sign in
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }

    try {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!seen) {
        // Slight delay so the UI finishes mounting smoothly
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [forceOpen]);

  // Listen for custom global event to trigger tour from anywhere
  useEffect(() => {
    const handleOpenTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };
    window.addEventListener("open-networth-tour", handleOpenTour);
    return () => window.removeEventListener("open-networth-tour", handleOpenTour);
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleActionClick = (route?: string) => {
    handleDismiss();
    if (route) {
      navigate(route);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent
        id="onboarding-tour-modal"
        showCloseButton={false}
        className="bg-[#0e1015] border border-white/10 text-white sm:max-w-2xl p-0 overflow-hidden shadow-2xl rounded-xl focus:outline-none"
      >
        <DialogTitle className="sr-only">
          {step.title} - Step {currentStep + 1} of {TOUR_STEPS.length}
        </DialogTitle>
        {/* Header Strip with Progress */}
        <div className="bg-[#090a0d] border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                {step.badge}
              </span>
              <div className="text-xs text-zinc-400 font-medium">Quick Product Walkthrough</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step indicator dots */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                    idx === currentStep
                      ? "w-6 bg-white"
                      : idx < currentStep
                        ? "w-2 bg-white/50"
                        : "w-2 bg-white/10 hover:bg-white/20"
                  }`}
                  title={`Go to step ${idx + 1}`}
                  aria-label={`Step ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Skip Tour (Esc)"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Main Visual Representation */}
          <div className="rounded-lg border border-white/[0.08] bg-[#07080a] p-5 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            {step.visual === "welcome" && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-zinc-400 text-[11px]">
                  <span className="flex items-center gap-1.5 text-white font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-zinc-300" /> Clean Terminal Initialization
                  </span>
                  <span className="text-zinc-500">Status: Active</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-500 uppercase">Positions</div>
                    <div className="text-sm font-bold text-white mt-0.5">0</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Ready for import</div>
                  </div>
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-500 uppercase">Portfolio Δ</div>
                    <div className="text-sm font-bold text-white mt-0.5">0.00</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Delta Neutral</div>
                  </div>
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-500 uppercase">Risk Engine</div>
                    <div className="text-sm font-bold text-white mt-0.5">Online</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Black-Scholes</div>
                  </div>
                </div>
              </div>
            )}

            {step.visual === "portfolio" && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-zinc-400 text-[11px]">
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-zinc-300" /> Three Ways to Add Data
                  </span>
                  <span className="text-zinc-300 text-[10px]">API Sync Recommended</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <button
                    type="button"
                    onClick={() => connectMut.mutate({ origin: window.location.origin })}
                    disabled={connectMut.isPending}
                    className="p-2.5 rounded bg-white/5 border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all text-left group cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <Link2 className="h-4 w-4 text-white mb-1 group-hover:scale-110 transition-transform" />
                      <div className="font-semibold text-white text-[11px] flex items-center gap-1">
                        SnapTrade API
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">20+ Brokerages</div>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-zinc-200 group-hover:underline">
                      {connectMut.isPending ? "Connecting…" : "Connect Now →"}
                    </div>
                  </button>
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06] text-left flex flex-col justify-between">
                    <div>
                      <Upload className="h-4 w-4 text-cyan-400 mb-1" />
                      <div className="font-semibold text-white text-[11px]">CSV / Excel</div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">IBKR, Schwab, etc.</div>
                    </div>
                    <div className="mt-2 text-[9px] text-zinc-500">
                      Export from broker
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06] text-left flex flex-col justify-between">
                    <div>
                      <Layers className="h-4 w-4 text-amber-400 mb-1" />
                      <div className="font-semibold text-white text-[11px]">Manual Entry</div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">Stocks & Options</div>
                    </div>
                    <div className="mt-2 text-[9px] text-zinc-500">
                      Custom lots & strikes
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step.visual === "greeks" && (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-[11px] text-white font-semibold">
                    First-Order Derivative Condition: Δ_p = 0
                  </span>
                  <span className="text-[10px] text-zinc-500 font-sans">SPX Beta Weighted</span>
                </div>
                <div className="bg-black/40 rounded p-2.5 border border-white/[0.06] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-400">Total Beta Delta:</span>{" "}
                    <span className="font-bold text-white">+0.00 Δ</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 text-[11px]">1σ Down Stress:</span>{" "}
                    <span className="text-zinc-300 font-bold">$0.00 (0.0%)</span>
                  </div>
                </div>
              </div>
            )}

            {step.visual === "hedging" && (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-white font-semibold text-[11px]">
                    Actionable Quantitative Hedging Strategies
                  </span>
                  <span className="text-[10px] text-zinc-300 font-semibold">Δ → 0.00</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-white font-bold text-[11px]">Covered Calls</div>
                    <div className="text-[10px] text-zinc-400">Income on long lots (Δ &gt; 0)</div>
                  </div>
                  <div className="p-2 rounded bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-cyan-400 font-bold text-[11px]">Protective Collars</div>
                    <div className="text-[10px] text-zinc-400">Downside floor + funded call</div>
                  </div>
                </div>
              </div>
            )}

            {step.visual === "career" && (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-white font-semibold text-[11px]">
                    Human Capital vs. Financial Asset Matrix
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold">Concentration Guard</span>
                </div>
                <div className="bg-white/[0.02] p-2.5 rounded border border-white/[0.06] flex items-center justify-between">
                  <div className="text-[11px]">
                    <span className="text-zinc-400">Industry:</span>{" "}
                    <span className="text-white font-semibold">Technology / Software</span>
                  </div>
                  <div className="text-[11px] text-amber-400 font-semibold">
                    Sector Correlation: 0.78
                  </div>
                </div>
              </div>
            )}

            {step.visual === "finish" && (
              <div className="text-center py-2 space-y-3">
                <div className="inline-flex p-3 rounded-full bg-white/10 border border-white/20 text-white mb-1">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">Your Workspace is Initialized & Clean</h4>
                <p className="text-xs text-zinc-400 font-mono max-w-sm mx-auto">
                  0 positions loaded. Connect your brokerage to sync live holdings or explore the terminal.
                </p>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => connectMut.mutate({ origin: window.location.origin })}
                    disabled={connectMut.isPending}
                    className="text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    {connectMut.isPending ? "Connecting…" : "Connect Broker via SnapTrade"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Typography Details */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-white font-sans">
              {step.title}
            </h3>
            <p className="text-xs font-mono text-zinc-400 font-medium">
              {step.subtitle}
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed font-sans pt-1">
              {step.description}
            </p>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="bg-[#090a0d] border-t border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:bg-white/5 cursor-pointer"
          >
            Skip Tour
          </Button>

          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="text-xs font-mono border-white/10 hover:bg-white/5 text-zinc-300 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            )}

            {isLast ? (
              <Button
                size="sm"
                onClick={() => handleActionClick(step.primaryActionRoute)}
                className="text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 uppercase tracking-wider shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer"
              >
                {step.primaryActionLabel || "Get Started"} <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleNext}
                className="text-xs font-mono font-semibold bg-white text-black hover:bg-zinc-200 cursor-pointer"
              >
                Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Helper function to open the tour programmatically from anywhere in the app */
export function startAppTour() {
  window.dispatchEvent(new CustomEvent("open-networth-tour"));
}
