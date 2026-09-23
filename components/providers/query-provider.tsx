"use client";

import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * Proveedor global de TanStack Query.
 * Config conservadora para un MVP financiero: datos frescos por 30s,
 * sin refetch agresivo al cambiar de ventana y un solo retry.
 * El onlineManager sincroniza el estado de red del navegador: al volver
 * la conexión, las queries activas se refetchean solas.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      function handleOnline() {
        setOnline(true);
      }
      function handleOffline() {
        setOnline(false);
      }
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
