import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Bookmark,
  Briefcase,
  Compass,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Rocket,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";
import { Logo } from "./Logo";
import { OnboardingTour, startAppTour } from "./OnboardingTour";
import { InstallAPKModal } from "./InstallAPKModal";
import { OfflineIndicator } from "./OfflineIndicator";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
  { icon: Sparkles, label: "Suggestions", path: "/suggestions" },
  { icon: ShieldAlert, label: "Risk Analysis", path: "/risk" },
  { icon: Rocket, label: "Career Optimiser", path: "/career" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const mobileMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
  { icon: Bookmark, label: "Watchlist", path: "/watchlist" },
  { icon: ShieldAlert, label: "Risk", path: "/risk" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const adminMenuItem = { icon: Users, label: "Users", path: "/users" };

const PIN_STORAGE_KEY = "wholewealth_sidebar_pinned";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isLoading, user, refresh, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PIN_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const providers = trpc.auth.providers.useQuery(undefined, {
    staleTime: 60_000,
  });
  const googleEnabled = providers.data?.google ?? false;

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, String(isPinned));
    } catch {
      // ignore
    }
  }, [isPinned]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle pin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsPinned(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 100);
  };

  // No-auth mode: while the workspace initializes (cold start), keep retrying.
  useEffect(() => {
    if (isLoading || user || googleEnabled) return;
    const t = setInterval(() => refresh(), 3000);
    return () => clearInterval(t);
  }, [isLoading, user, googleEnabled, refresh]);

  if (isLoading) {
    return <AuthLayoutSkeleton />;
  }

  // Google sign-in configured: unauthenticated users go to the login page.
  if (!user && googleEnabled) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen app-pattern-bg">
        <div className="flex flex-col items-center gap-5 p-8 max-w-md w-full bg-[#0f1014] border border-white/10 rounded-lg shadow-xl">
          <Logo size={40} />
          <h1 className="text-lg font-bold tracking-tight text-center text-white mt-1">
            Preparing your workspace…
          </h1>
          <p className="text-xs font-mono text-muted-foreground text-center max-w-sm">
            The terminal is initialising market feeds and security session.
          </p>
          <Button
            onClick={() => refresh()}
            size="default"
            className="w-full bg-white text-black font-mono font-semibold uppercase tracking-wider hover:bg-zinc-200"
          >
            Retry now
          </Button>
        </div>
      </div>
    );
  }

  const visibleMenuItems =
    user?.role === "admin" ? [...menuItems, adminMenuItem] : menuItems;
  const activeMenuItem =
    visibleMenuItems.find((item) => item.path === location.pathname) ||
    mobileMenuItems.find((item) => item.path === location.pathname);

  const isExpanded = isPinned || isHovered;

  return (
    <div className="min-h-screen flex app-pattern-bg text-[#f1f2f4] antialiased overflow-x-hidden">
      {/* ── DESKTOP SIDEBAR (Hardware Accelerated, Smooth Transitions) ── */}
      {!isMobile && (
        <>
          {/* Static Spacer when pinned to push main content smoothly */}
          <div
            className="hidden md:block shrink-0 transition-[width] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: isPinned ? "230px" : "64px" }}
          />

          {/* Floating / Anchored Sidebar Container */}
          <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`fixed inset-y-0 left-0 z-40 hidden md:flex flex-col bg-[#0b0c0f] border-r border-white/[0.08] transition-[width] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] select-none ${
              isExpanded
                ? "w-[230px] shadow-[4px_0_24px_rgba(0,0,0,0.6)]"
                : "w-[64px]"
            }`}
          >
            {/* Header / Logo - Click to toggle sidebar pin */}
            <div
              id="sidebar-header"
              className="h-14 shrink-0 flex items-center px-2.5 border-b border-white/[0.07] bg-[#0b0c10]/70 backdrop-blur-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsPinned(prev => !prev)}
                className="flex items-center w-full h-10 px-1 rounded-lg hover:bg-white/[0.05] active:scale-[0.98] transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 text-left"
                title={isPinned ? "Sidebar pinned. Click to unpin (Ctrl+B)" : "Click to pin sidebar open (Ctrl+B)"}
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              >
                <div className="w-[42px] h-full flex items-center justify-center shrink-0">
                  <Logo size={30} showText={false} isPinned={isPinned} />
                </div>

                {/* Sliding/Fading Text Label */}
                <div
                  className={`overflow-hidden whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center ml-1 ${
                    isExpanded
                      ? "opacity-100 translate-x-0 max-w-[160px] pointer-events-auto"
                      : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                  }`}
                >
                  <span className="font-semibold tracking-tight text-sm text-white">
                    Whole<span className="text-emerald-400 font-semibold">Wealth</span>
                  </span>
                </div>
              </button>
            </div>

            {/* Navigation Menu Links */}
            <nav
              id="sidebar-nav"
              className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none"
            >
              {visibleMenuItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`relative w-full h-10 rounded-lg flex items-center transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent text-white font-medium border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] border border-transparent"
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Active Emerald Accent Bar */}
                    {isActive && (
                      <span className="absolute left-0 inset-y-2 w-1 rounded-r-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                    )}

                    {/* Fixed Icon Container */}
                    <div className="w-[46px] h-full flex items-center justify-center shrink-0">
                      <item.icon
                        className={`h-4 w-4 transition-all duration-150 ${
                          isActive
                            ? "text-emerald-400 scale-105"
                            : "text-zinc-400 group-hover:text-zinc-200 group-hover:scale-105"
                        }`}
                      />
                    </div>

                    {/* Sliding/Fading Text Label */}
                    <div
                      className={`overflow-hidden whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center ${
                        isExpanded
                          ? "opacity-100 translate-x-0 max-w-[150px] pointer-events-auto"
                          : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                      }`}
                    >
                      <span className="text-xs font-medium tracking-normal leading-none truncate">
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Footer / User Profile */}
            <div className="shrink-0 p-2 border-t border-white/[0.06] bg-[#090a0d]">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-11 rounded-md flex items-center hover:bg-white/[0.06] transition-colors focus:outline-none cursor-pointer px-1 group"
                  >
                    {/* Fixed Avatar */}
                    <div className="w-[42px] h-full flex items-center justify-center shrink-0">
                      <Avatar className="h-7 w-7 border border-white/10 group-hover:border-white/20 transition-colors">
                        {user?.avatar ? (
                          <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
                        ) : null}
                        <AvatarFallback className="text-[11px] font-medium bg-white/10 text-white group-hover:text-emerald-400">
                          {user?.name?.charAt(0).toUpperCase() || "N"}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* User Metadata */}
                    <div
                      className={`overflow-hidden whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex-1 text-left ${
                        isExpanded
                          ? "opacity-100 translate-x-0 max-w-[140px] pointer-events-auto ml-1"
                          : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                      }`}
                    >
                      <div className="text-[10px] text-zinc-400 leading-none mb-0.5">
                        Account
                      </div>
                      <div className="text-xs text-zinc-200 truncate leading-tight font-medium">
                        {user?.name || user?.email || "Workspace User"}
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52 bg-[#0f1014] border-white/10 text-white shadow-xl">
                  <div className="px-2.5 py-2 border-b border-white/10 font-mono text-xs">
                    <div className="text-muted-foreground text-[10px] uppercase">Signed in as</div>
                    <div className="font-semibold text-white truncate">{user?.name || "Workspace User"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
                  </div>
                  <DropdownMenuItem
                    onClick={() => setInstallModalOpen(true)}
                    className="cursor-pointer text-emerald-400 hover:text-emerald-300 focus:text-emerald-300 focus:bg-emerald-500/10 text-xs font-mono mt-1"
                  >
                    <Smartphone className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                    <span>Install App / APK</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => startAppTour()}
                    className="cursor-pointer text-zinc-300 hover:text-white focus:text-white focus:bg-white/10 text-xs font-mono mt-0.5"
                  >
                    <Compass className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                    <span>Product Tour</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs font-mono mt-0.5"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </aside>
        </>
      )}

      {/* ── MOBILE FIXED TOP HEADER & FIXED BOTTOM NAV (<768px) ── */}
      {isMobile && (
        <>
          {/* Top Mobile Bar - Clean Logo & Section indicator (no hamburger button) */}
          <header className="fixed top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-3.5 sm:px-4 bg-[#0c0c0e]/95 border-b border-white/[0.08] backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
            <div className="flex items-center gap-2.5">
              <Logo size={26} showText={true} />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInstallModalOpen(true)}
                className="h-8 px-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-sans font-semibold flex items-center gap-1.5 hover:bg-emerald-500/20 active:scale-95 transition-all shadow-sm cursor-pointer"
                title="Install Android App / APK"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                <span>APK</span>
              </button>
              <span className="text-xs font-sans font-medium text-zinc-200 px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 truncate max-w-[130px] shadow-sm">
                {activeMenuItem?.label ?? "Terminal"}
              </span>
            </div>
          </header>

          {/* Fixed Mobile Bottom Navigation Bar (< 768px) */}
          <nav
            aria-label="Mobile Navigation"
            className="fixed bottom-0 inset-x-0 z-50 h-16 bg-[#0c0d12]/95 backdrop-blur-xl border-t border-white/[0.08] flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none"
          >
            {mobileMenuItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 py-1 transition-all cursor-pointer relative ${
                    isActive
                      ? "text-emerald-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 active:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-0 inset-x-3 h-0.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  )}
                  <item.icon
                    className={`h-4 w-4 mb-1 transition-transform ${
                      isActive ? "scale-110 text-emerald-400" : "text-zinc-400"
                    }`}
                  />
                  <span className="text-[11px] font-sans font-medium tracking-tight leading-tight truncate max-w-[58px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* ── MAIN VIEWPORT ── */}
      <main className={`flex-1 min-w-0 transition-all ${isMobile ? "pt-14 pb-20" : ""}`}>
        <div key={location.pathname} className="page-fade">
          {children}
        </div>
      </main>

      {/* ── INTERACTIVE ONBOARDING TOUR (Auto-opens on first sign in) ── */}
      <OnboardingTour />

      {/* ── ANDROID APK & PWA INSTALL MODAL ── */}
      <InstallAPKModal
        open={installModalOpen}
        onOpenChange={setInstallModalOpen}
      />

      {/* ── OFFLINE STATUS INDICATOR ── */}
      <OfflineIndicator />
    </div>
  );
}
