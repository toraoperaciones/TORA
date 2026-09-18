import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptySearch } from "@/components/illustrations/illustrations";

/**
 * 404 dentro del portal (A7): el shell/sidebar sobrevive; copy literal.
 */
export default function PortalNotFound() {
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
