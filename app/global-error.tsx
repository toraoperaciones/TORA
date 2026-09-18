"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Última frontera de captura: errores que escapan a root layout.
 * Reporta a Sentry y ofrece recarga completa (los boundary de portal
 * ya manejan los errores de render con la UI del preset).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
            textAlign: "center",
            padding: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            TORA no pudo cargar.
          </h1>
          <p style={{ color: "#666", maxWidth: "46ch", margin: 0 }}>
            Ocurrió un error inesperado. El fallo quedó registrado. Recarga la
            página; si persiste, contacta a soporte.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#999" }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <Button onClick={reset}>Reintentar</Button>
        </div>
      </body>
    </html>
  );
}
