"use client";

import { RiWifiOffLine } from "@remixicon/react";
import { useEffect, useState } from "react";

/**
 * Banner fijo de pérdida de conectividad. Escucha online/offline del
 * navegador; se oculta solo al reconectar (la app reintenta con TanStack).
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      data-testid="offline-banner"
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
    >
      <RiWifiOffLine className="h-4 w-4" aria-hidden />
      Sin conexión a internet. Revisa tu red.
    </div>
  );
}
