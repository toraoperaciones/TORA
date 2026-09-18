"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary por segmento de portal (A7): el sidebar sobrevive y el
 * usuario conserva la navegación. Copy literal, sin rojo.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-border-subtle bg-navy-lift px-6 py-14 text-center">
      <AlertCircle className="h-7 w-7 text-text-tertiary" aria-hidden />
      <div>
        <h2 className="font-display text-h3 font-semibold text-text-primary">
          Algo no salió como esperábamos.
        </h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-body-s text-text-secondary">
          El error quedó registrado. Reintenta; si persiste, contacta a
          soporte con el código de referencia.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-caption text-text-muted">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
      <Button onClick={reset} variant="secondary">
        Reintentar
      </Button>
    </div>
  );
}
