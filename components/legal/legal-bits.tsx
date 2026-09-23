import type { ReactNode } from "react";

/**
 * Banner obligatorio en páginas legales: el texto es una plantilla y debe
 * ser revisada por un abogado antes de uso comercial (requisito del CEO).
 */
export function LegalTemplateBanner(): ReactNode {
  return (
    <div
      role="note"
      className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground"
    >
      <span className="font-semibold">
        Este texto es una plantilla. Consultar con abogado antes de uso comercial.
      </span>
    </div>
  );
}

/** Fecha de última actualización dinámica, formato es-MX. */
export function LegalUpdatedAt(): ReactNode {
  return (
    <p className="border-t border-border pt-4 text-xs text-foreground/60">
      Última actualización:{" "}
      {new Date().toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
      .
    </p>
  );
}
