import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import AuthLayout from "@/components/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Basis from "./pages/Basis";
import Risk from "./pages/Risk";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthLayout>{children}</AuthLayout>
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
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/users" element={<Protected><Users /></Protected>} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
}
