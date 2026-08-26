import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen app-pattern-bg flex items-center justify-center p-4">
      <div className="panel-box p-8 max-w-md w-full text-center space-y-6 bg-[#13151b] border border-white/[0.08] shadow-xl">
        <div className="flex justify-center">
          <Logo size={40} showText={false} />
        </div>
        <div className="space-y-2">
          <div className="font-mono text-4xl font-bold text-white tracking-tight">404</div>
          <h1 className="text-base font-semibold text-zinc-200">Page Not Found</h1>
          <p className="text-xs text-zinc-400 font-sans max-w-xs mx-auto">
            The requested terminal screen does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-semibold h-10">
            <Link to="/" className="flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
