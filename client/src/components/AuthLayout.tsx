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
  Coins,
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

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
  { icon: Coins, label: "Basis Improvement", path: "/basis" },
  { icon: ShieldAlert, label: "Risk Analysis", path: "/risk" },
  { icon: Lightbulb, label: "Suggestions", path: "/suggestions" },
  { icon: Rocket, label: "Career Optimiser", path: "/career" },
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
      <div className="flex items-center justify-center min-h-screen app-dot-grid">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full bg-[#111113] border border-white/10 rounded-xl shadow-[0_0_30px_rgba(212,255,0,0.08)]">
          <Logo size={44} />
          <h1 className="text-xl font-bold tracking-tight text-center text-white mt-2">
            Preparing your workspace…
          </h1>
          <p className="text-xs font-mono text-muted-foreground text-center max-w-sm">
            The terminal is initializing market feeds. This takes a brief moment.
          </p>
          <Button
            onClick={() => refresh()}
<<<<<<< HEAD
            size="lg"
            className="w-full bg-primary text-black font-mono font-bold uppercase tracking-wider hover:bg-primary/90 shadow-[0_0_15px_rgba(212,255,0,0.2)]"
=======
            size="default"
            className="w-full bg-emerald-500 text-black font-mono font-semibold uppercase tracking-wider hover:bg-emerald-400"
<<<<<<< HEAD
>>>>>>> parent of 04ecc8d (14)
=======
>>>>>>> parent of 04ecc8d (14)
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
    <div className="min-h-screen flex bg-[#0a0a0b] text-[#f0f0f2] antialiased overflow-x-hidden">
      {/* ── DESKTOP SIDEBAR (Hardware Accelerated, Smooth Transitions) ── */}
      {!isMobile && (
        <>
          {/* Static Spacer when pinned to push main content smoothly */}
          <div
            className="hidden md:block shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: isPinned ? "240px" : "68px" }}
          />

          {/* Floating / Anchored Sidebar Container */}
          <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`fixed inset-y-0 left-0 z-40 hidden md:flex flex-col bg-[#0e0e11] border-r border-white/[0.08] transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] select-none ${
              isExpanded
                ? "w-[240px] shadow-[12px_0_35px_-4px_rgba(0,0,0,0.7),0_0_25px_rgba(212,255,0,0.06)]"
                : "w-[68px] shadow-[4px_0_20px_rgba(0,0,0,0.4)]"
            }`}
          >
            {/* Header / Logo - Click to toggle sidebar pin */}
            <div className="h-16 shrink-0 flex items-center px-2.5 border-b border-white/[0.06] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPinned(prev => !prev)}
                className="flex items-center w-full h-11 px-1 rounded-lg hover:bg-white/[0.05] active:scale-[0.98] transition-all cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-primary text-left"
                title={isPinned ? "Sidebar pinned. Click logo to unpin (Ctrl+B)" : "Click logo to pin sidebar open (Ctrl+B)"}
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              >
                <div className="w-[44px] h-full flex items-center justify-center shrink-0">
                  <Logo size={34} showText={false} isPinned={isPinned} />
                </div>

                {/* Sliding/Fading Text Label */}
                <div
                  className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-1.5 ml-1 ${
                    isExpanded
                      ? "opacity-100 translate-x-0 max-w-[160px] pointer-events-auto"
                      : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                  }`}
                >
<<<<<<< HEAD
                  <span className="font-display font-extrabold tracking-tight text-sm text-white uppercase tracking-wider">
                    NetWorth<span className="text-primary font-mono">.io</span>
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded transition-all ${
                      isPinned
                        ? "text-black bg-primary border border-primary font-black shadow-[0_0_10px_rgba(212,255,0,0.4)]"
                        : "text-primary bg-primary/10 border border-primary/30 shadow-[0_0_8px_rgba(212,255,0,0.15)] group-hover:bg-primary/20"
                    }`}
                  >
                    {isPinned ? "PINNED" : "PRO"}
=======
                  <span className="font-semibold tracking-tight text-sm text-white">
                    NetWorth<span className="text-emerald-400 font-medium">.io</span>
<<<<<<< HEAD
>>>>>>> parent of 04ecc8d (14)
=======
>>>>>>> parent of 04ecc8d (14)
                  </span>
                </div>
              </button>
            </div>

            {/* Navigation Menu Links */}
            <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none">
              {visibleMenuItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`relative w-full h-11 rounded-lg flex items-center transition-all duration-150 group cursor-pointer ${
                      isActive
                        ? "bg-white/[0.08] text-white font-medium shadow-[inset_0_0_15px_rgba(212,255,0,0.06)] border border-primary/25"
                        : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Active Accent Bar */}
                    {isActive && (
<<<<<<< HEAD
<<<<<<< HEAD
                      <span className="absolute left-0 inset-y-2 w-1 rounded-r bg-primary shadow-[0_0_8px_#d4ff00]" />
=======
                      <span className="absolute left-0 inset-y-2 w-0.5 rounded-r bg-emerald-400" />
>>>>>>> parent of 04ecc8d (14)
=======
                      <span className="absolute left-0 inset-y-2 w-0.5 rounded-r bg-emerald-400" />
>>>>>>> parent of 04ecc8d (14)
                    )}

                    {/* Fixed Icon Container (Anchored at exact same location always) */}
                    <div className="w-[50px] h-full flex items-center justify-center shrink-0">
                      <item.icon
                        className={`h-4 w-4 transition-transform duration-150 group-hover:scale-110 ${
                          isActive
<<<<<<< HEAD
<<<<<<< HEAD
                            ? "text-primary drop-shadow-[0_0_8px_rgba(212,255,0,0.4)]"
=======
                            ? "text-emerald-400"
>>>>>>> parent of 04ecc8d (14)
=======
                            ? "text-emerald-400"
>>>>>>> parent of 04ecc8d (14)
                            : "opacity-75 group-hover:opacity-100"
                        }`}
                      />
                    </div>

                    {/* Sliding/Fading Text Label */}
                    <div
                      className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center ${
                        isExpanded
                          ? "opacity-100 translate-x-0 max-w-[160px] pointer-events-auto"
                          : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                      }`}
                    >
                      <span className="text-xs font-mono tracking-tight leading-none truncate">
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Footer / User Profile */}
            <div className="shrink-0 p-2.5 border-t border-white/[0.06] bg-[#0c0c0e]/80">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-12 rounded-lg flex items-center hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer px-1 group"
                  >
                    {/* Fixed Avatar */}
                    <div className="w-[46px] h-full flex items-center justify-center shrink-0">
                      <Avatar className="h-8 w-8 border border-white/10 group-hover:border-primary/40 transition-colors">
                        {user?.avatar ? (
                          <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
                        ) : null}
                        <AvatarFallback className="text-xs font-mono font-bold bg-white/10 text-white group-hover:text-primary">
                          {user?.name?.charAt(0).toUpperCase() || "N"}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* User Metadata */}
                    <div
                      className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] flex-1 text-left ${
                        isExpanded
                          ? "opacity-100 translate-x-0 max-w-[150px] pointer-events-auto ml-1"
                          : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                      }`}
                    >
                      <div className="text-[9px] font-mono text-muted-foreground/70 uppercase leading-none mb-0.5">
                        Workspace
                      </div>
                      <div className="text-xs font-mono text-white/90 truncate leading-tight">
                        {user?.email || user?.name || "trader@networth.io"}
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52 bg-[#111113] border-white/10 text-white shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                  <div className="px-2.5 py-2 border-b border-white/10 font-mono text-xs">
                    <div className="text-muted-foreground text-[10px] uppercase">Signed in as</div>
                    <div className="font-semibold text-white truncate">{user?.name || "Workspace User"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
                  </div>
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs font-mono mt-1"
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
          <header className="fixed top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-3 bg-[#0c0c0e]/95 border-b border-white/[0.08] backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(212,255,0,0.06)]"
                aria-label="Open Navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Logo size={28} showText={true} />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-primary font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                {activeMenuItem?.label ?? "Dashboard"}
              </span>
            </div>
          </header>

          {/* Backdrop Overlay */}
          {mobileOpen && (
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity"
            />
          )}

          {/* Slide-out Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[270px] bg-[#0e0e11] border-r border-white/10 flex flex-col transition-transform duration-250 ease-out shadow-[10px_0_30px_rgba(0,0,0,0.9)] ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.08]">
              <Logo size={32} showText={true} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

<<<<<<< HEAD
            <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
=======
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
>>>>>>> parent of 04ecc8d (14)
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
                    className={`w-full h-11 rounded-lg flex items-center px-3 gap-3 transition-colors cursor-pointer ${
                      isActive
<<<<<<< HEAD
<<<<<<< HEAD
                        ? "bg-primary/15 text-primary font-bold border border-primary/30 shadow-[0_0_12px_rgba(212,255,0,0.15)]"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
=======
=======
>>>>>>> parent of 04ecc8d (14)
                        ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "text-zinc-300 hover:text-white hover:bg-white/5 active:bg-white/10"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
<<<<<<< HEAD
>>>>>>> parent of 04ecc8d (14)
=======
>>>>>>> parent of 04ecc8d (14)
                    <span className="text-xs font-mono">{item.label}</span>
                  </button>
                );
              })}
            </nav>

<<<<<<< HEAD
            <div className="p-3 border-t border-white/10">
=======
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
>>>>>>> parent of 04ecc8d (14)
              <button
                type="button"
                onClick={logout}
                className="w-full h-10 rounded-lg flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-mono border border-destructive/20 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
<<<<<<< HEAD
=======

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
>>>>>>> parent of 04ecc8d (14)
        </>
      )}

      {/* ── MAIN VIEWPORT ── */}
      <main className={`flex-1 min-w-0 transition-all ${isMobile ? "pt-14" : ""}`}>
        <div key={location.pathname} className="page-fade">
          {children}
        </div>
      </main>
    </div>
  );
}
