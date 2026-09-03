import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Terminal,
  Layers,
} from "lucide-react";

interface InstallAPKModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InstallAPKModal: React.FC<InstallAPKModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"direct" | "apk" | "ios">(
    isIOS ? "ios" : "direct"
  );

  const currentUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pwaBuilderUrl = `https://www.pwabuilder.com/?url=${encodeURIComponent(currentUrl)}`;

  const handleCopyUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-[#0e0e12] border-zinc-800 text-zinc-100">
        {/* Header Visual Banner */}
        <div className="relative p-5 pb-4 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 overflow-hidden">
              <img
                src="/pwa-192x192.png"
                alt="WholeWealth Logo"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo.svg";
                }}
              />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                WholeWealth Mobile App
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Android & iOS
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Install as a standalone native-grade app or export an Android APK.
              </DialogDescription>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 mt-4 rounded-lg bg-black/40 border border-white/5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={`py-1.5 px-2 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 ${
                activeTab === "direct"
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>1-Tap App</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("apk")}
              className={`py-1.5 px-2 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 ${
                activeTab === "apk"
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Build .APK</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={`py-1.5 px-2 rounded-md transition-all font-medium flex items-center justify-center gap-1.5 ${
                activeTab === "ios"
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Apple iOS</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Direct Android 1-Tap Install (WebAPK) */}
        {activeTab === "direct" && (
          <div className="p-5 space-y-4">
            <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Instant Android WebAPK Installation</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                When installed on Android, Chrome automatically builds and provisions a real system-level{" "}
                <strong className="text-white">WebAPK</strong> onto your phone. You get a home screen icon, standalone fullscreen view, and local offline storage without needing to sideload files.
              </p>
            </div>

            {isInstalled ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold text-white">App is Already Installed!</div>
                  <div className="text-emerald-300/80 text-[11px]">
                    WholeWealth is running in standalone mode on your device.
                  </div>
                </div>
              </div>
            ) : isInstallable ? (
              <Button
                onClick={handleInstallClick}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm py-2.5 shadow-lg shadow-emerald-500/20"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Install WholeWealth App Now
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={handleInstallClick}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm py-2.5 shadow-lg shadow-emerald-500/20"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Prompt Android Install
                </Button>
                <p className="text-[11px] text-zinc-400 text-center font-mono leading-relaxed">
                  Tip: On Chrome for Android, tap <strong className="text-zinc-200">⋮ (Menu)</strong> &gt;{" "}
                  <strong className="text-emerald-400">"Install app"</strong> or{" "}
                  <strong className="text-emerald-400">"Add to Home screen"</strong> to generate your WebAPK.
                </p>
              </div>
            )}

            {/* Feature Checklist */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06] text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fullscreen Standalone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fast Service Worker</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Home Screen Launcher</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encrypted Storage</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Export Standalone APK (.apk file) */}
        {activeTab === "apk" && (
          <div className="p-5 space-y-4">
            <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Sideloadable Android .APK</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Need a standalone <code className="px-1 py-0.5 rounded bg-zinc-800 text-emerald-400 font-mono text-[11px]">.apk</code> or{" "}
                <code className="px-1 py-0.5 rounded bg-zinc-800 text-emerald-400 font-mono text-[11px]">.aab</code> package file to distribute, sideload, or publish to Google Play?
              </p>
            </div>

            {/* 1-Click PWABuilder APK Generator */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Method 1: Instant APK via PWABuilder (1-Click)</span>
              </div>
              <p className="text-xs text-zinc-400">
                Microsoft PWABuilder reads WholeWealth's verified manifest and packages it into a signed Android APK in seconds.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  asChild
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-2"
                >
                  <a href={pwaBuilderUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Generate .APK on PWABuilder
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="border-zinc-700 bg-zinc-900 text-zinc-200 text-xs hover:bg-zinc-800 px-3"
                  title="Copy App URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Command line Bubblewrap */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1.5">
              <div className="text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>Method 2: Local CLI Build via Google Bubblewrap</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 bg-black/60 p-2 rounded border border-white/5 select-all overflow-x-auto">
                npx @bubblewrap/cli build
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Project includes pre-configured twa-manifest.json and PWA manifest assets ready for Android compilation.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Apple iOS */}
        {activeTab === "ios" && (
          <div className="p-5 space-y-4">
            <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Install on Apple iPhone / iPad</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                iOS uses Safari's native Add to Home Screen engine to run WholeWealth without Safari navigation bars.
              </p>
            </div>

            <ol className="space-y-3 text-xs text-zinc-300 font-sans list-none p-0">
              <li className="flex items-start gap-3 p-2.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Open this page in <strong className="text-white">Safari</strong> on your iPhone or iPad.
                </span>
              </li>
              <li className="flex items-start gap-3 p-2.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Tap the <strong className="text-white">Share button</strong> (the square icon with the arrow pointing up in the bottom toolbar).
                </span>
              </li>
              <li className="flex items-start gap-3 p-2.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Scroll down and tap <strong className="text-emerald-400">"Add to Home Screen"</strong>, then tap <strong className="text-white">Add</strong> in the top right.
                </span>
              </li>
            </ol>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-950/60 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>PWA &amp; WebAPK Compliant</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-mono text-zinc-400 hover:text-white h-7 px-2.5"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
