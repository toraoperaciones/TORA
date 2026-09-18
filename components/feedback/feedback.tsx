"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptySearch } from "@/components/illustrations/illustrations";

/**
 * Feedback compartido (error boundaries y 404) — copia literal A7, sin rojo.
 * Un solo componente; los entry points de raíz y portales solo re-exportan.
 * Dentro de un portal, el sidebar sobrevive: el fallo queda confinado al
 * segmento de página.
 */

export function PortalErrorView({
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

export function PortalNotFoundView() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-border-subtle bg-navy-lift px-6 py-14 text-center">
      <EmptySearch className="h-32 w-32" />
      <div>
        <h2 className="font-display text-h3 font-semibold text-text-primary">
          Esta página no existe o cambió de dirección.
        </h2>
        <p className="mt-2 text-body-s text-text-secondary">
          Verifica el enlace o vuelve al inicio.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
