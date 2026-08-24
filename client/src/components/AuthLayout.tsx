import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Briefcase,
  Coins,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  PanelLeft,
  Rocket,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";

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

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 380;

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { isLoading, user, refresh } = useAuth();
  const providers = trpc.auth.providers.useQuery(undefined, {
    staleTime: 60_000,
  });
  const googleEnabled = providers.data?.google ?? false;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Preparing your workspace…
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            The app is starting up. This usually takes a few seconds — the page
            will continue automatically.
          </p>
          <Button onClick={() => refresh()} size="lg" className="w-full">
            Retry now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <AuthLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </AuthLayoutContent>
    </SidebarProvider>
  );
}

type AuthLayoutContentProps = {
  children: ReactNode;
  setSidebarWidth: (width: number) => void;
};

function AuthLayoutContent({
  children,
  setSidebarWidth,
}: AuthLayoutContentProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, setOpen, toggleSidebar, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const visibleMenuItems =
    user?.role === "admin" ? [...menuItems, adminMenuItem] : menuItems;
  const activeMenuItem = visibleMenuItems.find(item => item.path === location.pathname);
  const isMobile = useIsMobile();

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (!isPinned && isCollapsed) {
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    if (!isPinned) {
      hoverTimerRef.current = setTimeout(() => {
        setOpen(false);
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isCollapsed) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing && !isCollapsed) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, isCollapsed, setSidebarWidth]);

  return (
    <>
      <div
        className="relative"
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Sidebar
          collapsible="icon"
          className="border-r border-white/[0.06] transition-[width] duration-100 ease-out shadow-[0_0_25px_rgba(212,255,0,0.03)]"
        >
          <SidebarHeader className="h-16 justify-center border-b border-white/[0.06] px-2.5">
            <div className="flex items-center gap-2.5 px-1.5 transition-all w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <button
                onClick={() => {
                  const nextPinned = !isPinned;
                  setIsPinned(nextPinned);
                  if (nextPinned) {
                    setOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
                className={`h-9 w-9 flex items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 cursor-pointer ${
                  isPinned
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_rgba(212,255,0,0.2)]"
                    : "hover:bg-white/[0.06] text-muted-foreground hover:text-white"
                }`}
                aria-label="Toggle navigation pin"
                title={isPinned ? "Sidebar Pinned Open (Click to unpin)" : "Auto Expand Active (Click to pin open)"}
              >
                <PanelLeft className="h-4 w-4 transition-colors" />
              </button>
              <div
                className="flex items-center gap-2 min-w-0 overflow-hidden transition-all duration-100 ease-out max-w-[160px] opacity-100 translate-x-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-translate-x-2"
              >
                <span className="font-display font-bold tracking-tight text-sm text-white uppercase whitespace-nowrap">
                  NetWorth.io
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 text-primary bg-primary/10 border border-primary/20 rounded font-semibold shadow-[0_0_10px_rgba(212,255,0,0.15)]">
                  PRO
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-3">
            <SidebarMenu className="px-2 py-1 space-y-1 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:items-center">
              {visibleMenuItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                        navigate(item.path);
                      }}
                      tooltip={item.label}
                      className={`h-10 nav-menu-btn text-xs font-medium rounded transition-all duration-100 flex items-center ${
                        isActive
                          ? "bg-white/[0.08] text-white font-semibold border-l-2 border-primary shadow-[inset_0_0_12px_rgba(212,255,0,0.08)]"
                          : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-primary opacity-100 drop-shadow-[0_0_6px_rgba(212,255,0,0.4)]" : "opacity-75 group-hover:opacity-100"}`}
                      />
                      <span className="whitespace-nowrap overflow-hidden transition-all duration-100 ease-out text-xs font-medium max-w-[160px] opacity-100 translate-x-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-translate-x-2">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/[0.06] group-data-[collapsible=icon]:p-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-white/[0.05] transition-colors w-full text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer">
                  <Avatar className="h-8 w-8 border border-white/10 shrink-0 transition-all duration-100 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7">
                    {user?.avatar ? (
                      <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="text-xs font-mono font-bold bg-white/10 text-white">
                      {user?.name?.charAt(0).toUpperCase() || "N"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden transition-all duration-100 ease-out max-w-[160px] opacity-100 translate-x-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-translate-x-2">
                    <div className="meta-label text-[0.58rem] block text-muted-foreground/70 leading-none mb-0.5 whitespace-nowrap">
                      Workspace
                    </div>
                    <p className="text-xs font-mono text-white/90 truncate leading-tight whitespace-nowrap">
                      {user?.email || user?.name || "trader@networth.io"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#111113] border-white/10">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs font-mono"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <header className="flex border-b border-white/[0.08] h-14 items-center justify-between bg-[#0a0a0b]/95 px-3.5 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-md bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center cursor-pointer" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display font-bold tracking-tight text-sm text-white uppercase shrink-0">
                  NetWorth.io
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">/</span>
                <span className="text-xs font-mono text-primary font-semibold truncate max-w-[130px]">
                  {activeMenuItem?.label ?? "Dashboard"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border border-white/10 shrink-0">
                {user?.avatar ? (
                  <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
                ) : null}
                <AvatarFallback className="text-[10px] font-mono font-bold bg-white/10 text-white">
                  {user?.name?.charAt(0).toUpperCase() || "N"}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
        )}
        <main className="flex-1 min-w-0">
          <div key={location.pathname} className="page-fade">
            {children}
          </div>
        </main>
      </SidebarInset>
    </>
  );
}
