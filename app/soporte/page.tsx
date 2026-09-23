import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Soporte");

export default function SoportePage() {
  return (
    <div className="flex max-w-[65ch] flex-col gap-6">
      <h1>Soporte</h1>
      <p className="text-sm text-foreground/75">
        Tu ejecutivo de TORA responde en horario laboral (L-V, 9:00–18:00
        CDMX). Escríbenos y te damos seguimiento el mismo día.
      </p>
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-foreground">
          Correo:{" "}
          <a
            href="mailto:ops@tora.mx"
            className="font-semibold underline underline-offset-4"
          >
            ops@tora.mx
          </a>
        </p>
        <p className="mt-2 text-sm text-foreground/75">
          Incluye el destino del viaje y tu empresa para agilizar la respuesta.
        </p>
      </div>
    </div>
  );
}
