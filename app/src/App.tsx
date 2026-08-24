import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import AuthLayout from "@/components/AuthLayout";
import { AuthLayoutSkeleton } from "@/components/AuthLayoutSkeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy-load pages so each route ships as its own chunk.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Basis = lazy(() => import("./pages/Basis"));
const Risk = lazy(() => import("./pages/Risk"));
const Settings = lazy(() => import("./pages/Settings"));
const Users = lazy(() => import("./pages/Users"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const Career = lazy(() => import("./pages/Career"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Protected({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthLayout>{children}</AuthLayout>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<AuthLayoutSkeleton />}>
        <Routes>
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/portfolio"
            element={
              <Protected>
                <Portfolio />
              </Protected>
            }
          />
          <Route
            path="/basis"
            element={
              <Protected>
                <Basis />
              </Protected>
            }
          />
          <Route
            path="/risk"
            element={
              <Protected>
                <Risk />
              </Protected>
            }
          />
          <Route
            path="/suggestions"
            element={
              <Protected>
                <Suggestions />
              </Protected>
            }
          />
          <Route
            path="/career"
            element={
              <Protected>
                <Career />
              </Protected>
            }
          />
          <Route
            path="/settings"
            element={
              <Protected>
                <Settings />
              </Protected>
            }
          />
          <Route
            path="/users"
            element={
              <Protected>
                <Users />
              </Protected>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" />
    </>
  );
}
