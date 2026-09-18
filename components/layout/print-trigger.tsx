"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

/**
 * Botón de impresión para la vista imprimible de facturas.
 * Con `auto`, dispara window.print() al cargar (enlace ?auto=1).
 */
export function PrintTrigger({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 flex h-11 items-center gap-2 rounded-md bg-card px-5 font-display text-body-s font-semibold text-foreground shadow-xl transition-colors hover:bg-accent print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir / Guardar PDF
    </button>
  );
}
