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
  Briefcase,
  Compass,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Rocket,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";
import { Logo } from "./Logo";
import { OnboardingTour, startAppTour } from "./OnboardingTour";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
  { icon: ShieldAlert, label: "Risk Analysis", path: "/risk" },
  { icon: Lightbulb, label: "Suggestions", path: "/suggestions" },
  { icon: Rocket, label: "Career Optimizer", path: "/career" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const adminMenuItem = { icon: Users, label: "Users", path: "/users" };

const PIN_STORAGE_KEY = "networth_sidebar_pinned";

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
  const [mobileOpen, setMobileOpen] = useState(false);
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
            The terminal is initializing market feeds and security session.
          </p>
          <Button
            onClick={() => refresh()}
            size="default"
            className="w-full bg-emerald-500 text-black font-mono font-semibold uppercase tracking-wider hover:bg-emerald-400"
          >
            Retry now
          </Button>
        </div>
      </div>
    );
  }

  const visibleMenuItems =
    user?.role === "admin" ? [...menuItems, adminMenuItem] : menuItems;
  const activeMenuItem = visibleMenuItems.find(item => item.path === location.pathname);

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
            <div className="h-14 shrink-0 flex items-center px-2 border-b border-white/[0.06] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPinned(prev => !prev)}
                className="flex items-center w-full h-10 px-1 rounded-md hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer group focus:outline-none text-left"
                title={isPinned ? "Sidebar pinned. Click logo to unpin (Ctrl+B)" : "Click logo to pin sidebar open (Ctrl+B)"}
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              >
                <div className="w-[42px] h-full flex items-center justify-center shrink-0">
                  <Logo size={32} showText={false} isPinned={isPinned} />
                </div>

                {/* Sliding/Fading Text Label */}
                <div
                  className={`overflow-hidden whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-1.5 ml-1 ${
                    isExpanded
                      ? "opacity-100 translate-x-0 max-w-[160px] pointer-events-auto"
                      : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                  }`}
                >
                  <span className="font-semibold tracking-tight text-sm text-white">
                    NetWorth<span className="text-emerald-400 font-medium">.io</span>
                  </span>
                </div>
              </button>
            </div>

            {/* Navigation Menu Links */}
            <nav className="flex-1 py-2.5 px-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none">
              {visibleMenuItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`relative w-full h-10 rounded-md flex items-center transition-colors duration-100 group cursor-pointer ${
                      isActive
                        ? "bg-white/[0.08] text-white font-medium border border-white/10"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Active Accent Bar */}
                    {isActive && (
                      <span className="absolute left-0 inset-y-2 w-0.5 rounded-r bg-emerald-400" />
                    )}

                    {/* Fixed Icon Container */}
                    <div className="w-[46px] h-full flex items-center justify-center shrink-0">
                      <item.icon
                        className={`h-4 w-4 transition-transform duration-100 ${
                          isActive
                            ? "text-emerald-400"
                            : "opacity-75 group-hover:opacity-100"
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
                    onClick={() => startAppTour()}
                    className="cursor-pointer text-zinc-300 hover:text-white focus:text-white focus:bg-white/10 text-xs font-mono mt-1"
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

      {/* ── MOBILE SLIDE-IN DRAWER & HEADER (<768px) ── */}
      {isMobile && (
        <>
          {/* Top Mobile Bar */}
          <header className="fixed top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-3.5 bg-[#0c0c0e]/95 border-b border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Open Navigation Drawer"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Logo size={26} showText={true} />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startAppTour()}
                className="h-8 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium flex items-center gap-1 active:bg-emerald-500/20"
                title="Open Product Tour"
              >
                <Compass className="h-3 w-3" />
                <span>Tour</span>
              </button>
              <span className="text-[11px] font-mono text-zinc-300 font-medium px-2 py-1 rounded bg-white/5 border border-white/10 truncate max-w-[110px]">
                {activeMenuItem?.label ?? "Terminal"}
              </span>
            </div>
          </header>

          {/* Backdrop Overlay */}
          {mobileOpen && (
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
            />
          )}

          {/* Slide-out Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-[#0c0d10] border-r border-white/10 flex flex-col transition-transform duration-200 ease-out shadow-2xl ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.08] bg-[#0a0b0e]">
              <Logo size={28} showText={true} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-9 w-9 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close Drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 border-b border-white/[0.06] bg-[#0f1117]/50">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border border-white/10">
                  {user?.avatar ? (
                    <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
                  ) : null}
                  <AvatarFallback className="text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">{user?.name || "Workspace User"}</div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">{user?.email || "Terminal"}</div>
                </div>
              </div>
            </div>

            <nav className="flex-1 py-3 px-3 space-y-1.5 overflow-y-auto">
              <div className="px-2 pb-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Navigation</div>
              {visibleMenuItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate(item.path);
                    }}
                    className={`w-full h-11 rounded-lg flex items-center px-3.5 gap-3 transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "text-zinc-300 hover:text-white hover:bg-white/5 active:bg-white/10"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                    <span className="text-xs font-mono">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/10 space-y-2 bg-[#090a0d]">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  startAppTour();
                }}
                className="w-full h-10 rounded-lg flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-300 text-xs font-mono border border-emerald-500/25 cursor-pointer transition-colors"
              >
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                <span>Product Tour</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full h-10 rounded-lg flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 text-destructive text-xs font-mono border border-destructive/20 cursor-pointer transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          {/* Fixed Mobile Bottom Navigation Bar (< 768px) */}
          <nav
            aria-label="Mobile Navigation"
            className="fixed bottom-0 inset-x-0 z-40 h-16 bg-[#090a0d]/95 backdrop-blur-lg border-t border-white/[0.08] flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]"
          >
            {visibleMenuItems.slice(0, 5).map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 py-1 transition-all cursor-pointer relative ${
                    isActive ? "text-emerald-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-0 inset-x-4 h-0.5 bg-emerald-400 rounded-full" />
                  )}
                  <item.icon className={`h-4 w-4 mb-1 transition-transform ${isActive ? "scale-110 text-emerald-400" : ""}`} />
                  <span className="text-[10px] font-mono leading-none truncate max-w-[62px]">
                    {item.label === "Risk Analysis" ? "Risk" : item.label === "Career Optimizer" ? "Career" : item.label}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 py-1 transition-all cursor-pointer relative ${
                location.pathname === "/settings" ? "text-emerald-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {location.pathname === "/settings" && (
                <span className="absolute top-0 inset-x-4 h-0.5 bg-emerald-400 rounded-full" />
              )}
              <Settings className={`h-4 w-4 mb-1 transition-transform ${location.pathname === "/settings" ? "scale-110 text-emerald-400" : ""}`} />
              <span className="text-[10px] font-mono leading-none truncate max-w-[62px]">
                Settings
              </span>
            </button>
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
    </div>
  );
}
