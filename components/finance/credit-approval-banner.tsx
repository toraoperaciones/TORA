"use client";

import { useEffect, useState } from "react";

import { AnimatedCheck } from "@/components/ui/animated-check";

/**
 * Confirmación de crédito que sobrevive al router.refresh() de la cola:
 * vive en posición estable de la página (fuera del <li> que se remonta).
 * El botón de aprobar la convoca con un evento; el check permanece hasta
 * la navegación — misma durabilidad que SPEI y selección.
 */
export function CreditApprovalBanner() {
  const [approved, setApproved] = useState<string | null>(null);

  useEffect(() => {
    function onApproved(event: Event) {
      const detail = (event as CustomEvent<{ destination?: string }>).detail;
      setApproved(detail?.destination ?? "");
    }
    window.addEventListener("tora:credit-approved", onApproved);
    return () => window.removeEventListener("tora:credit-approved", onApproved);
  }, []);

  if (approved === null) return null;

  return (
    <div
      data-credit-approved
      className="flex items-center gap-3 rounded-lg border border-forest/20 bg-navy-lift p-4"
    >
      <AnimatedCheck />
      <p className="text-body-s font-semibold text-text-primary">
        Crédito aprobado{approved ? ` — ${approved}` : ""}. Reserva confirmada.
      </p>
    </div>
  );
}
