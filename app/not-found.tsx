import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptySearch } from "@/components/illustrations/illustrations";

/**
 * 404 (A7): copy literal + ilustración lineal EmptySearch. Cero culpa.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-navy-deep px-6 text-center">
      <EmptySearch className="h-32 w-32" />
      <div>
        <h1 className="font-display text-h2 font-semibold text-text-primary">
          Esta página no existe o cambió de dirección.
        </h1>
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
