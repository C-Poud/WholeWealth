import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import AuthLayout from "@/components/AuthLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Basis = lazy(() => import("./pages/Basis"));
const Risk = lazy(() => import("./pages/Risk"));
const Settings = lazy(() => import("./pages/Settings"));
const Users = lazy(() => import("./pages/Users"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const Career = lazy(() => import("./pages/Career"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0c0c0e]">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthLayout>
        <Suspense fallback={<LoadingFallback />}>
          {children}
        </Suspense>
      </AuthLayout>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/portfolio" element={<Protected><Portfolio /></Protected>} />
        <Route path="/basis" element={<Protected><Basis /></Protected>} />
        <Route path="/risk" element={<Protected><Risk /></Protected>} />
        <Route path="/suggestions" element={<Protected><Suggestions /></Protected>} />
        <Route path="/career" element={<Protected><Career /></Protected>} />
        <Route path="/watchlist" element={<Protected><Watchlist /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/users" element={<Protected><Users /></Protected>} />
        <Route path="/login" element={<Suspense fallback={<LoadingFallback />}><Login /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
}

