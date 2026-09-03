import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center justify-between sm:justify-start gap-2.5 rounded-lg bg-amber-500/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-zinc-950 shadow-xl border border-amber-400">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-zinc-950 animate-pulse shrink-0" />
        <span>Offline Mode — Cached data is being used.</span>
      </div>
    </div>
  );
};
