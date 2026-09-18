"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary raíz (A7): copy literal, sin rojo, icono AlertCircle.
 * Ofrece la única acción honesta: reintentar.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle técnico va a la consola, no a la cara del usuario.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-navy-deep px-6 text-center">
      <AlertCircle className="h-8 w-8 text-text-tertiary" aria-hidden />
      <div>
        <h1 className="font-display text-h2 font-semibold text-text-primary">
          Algo no salió como esperábamos.
        </h1>
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
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
