import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMXN } from "@/lib/utils";

export interface TenantRow {
  id: string;
  name: string;
  rfc: string | null;
  credit_limit: number | string;
  status: string;
  credit_lines?:
    | Array<{ approved_limit: number | string; used_amount: number | string; status: string }>
    | null;
}

/** Iniciales para el círculo del card (máx 2 caracteres). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function TenantCard({ tenant }: { tenant: TenantRow }) {
  const activeLine = tenant.credit_lines?.find((l) => l.status === "active");
  const line = activeLine
    ? Number(activeLine.approved_limit)
    : Number(tenant.credit_limit);
  const used = Number(activeLine?.used_amount ?? 0);

  return (
    <div className="flex flex-col rounded-lg border border-border-subtle bg-navy-lift p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-default">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-layer-3 font-display text-body-s font-semibold text-text-secondary"
        >
          {initials(tenant.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/tenants/${tenant.id}`}
            className="block truncate font-display text-body-m font-semibold text-text-primary hover:underline"
          >
            {tenant.name}
          </Link>
          <p className="truncate font-mono text-caption text-text-tertiary">
            {tenant.rfc ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-overline uppercase tracking-wider text-text-muted">
            Línea
          </p>
          <p className="mt-1 font-display text-body-m font-semibold tabular-nums text-text-primary">
            {formatMXN(line)}
          </p>
        </div>
        <div>
          <p className="text-overline uppercase tracking-wider text-text-muted">
            Crédito usado
          </p>
          <p className="mt-1 font-display text-body-m font-semibold tabular-nums text-text-primary">
            {formatMXN(used)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-hairline pt-4">
        {tenant.status === "active" ? (
          <Badge variant="success" dot>
            Activo
          </Badge>
        ) : tenant.status === "suspended" ? (
          <Badge variant="warning">
            <AlertCircle className="h-3 w-3" aria-hidden /> Suspendido
          </Badge>
        ) : (
          <Badge variant="muted">Archivado</Badge>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/tenants/${tenant.id}`}>Ver</Link>
        </Button>
      </div>
    </div>
  );
}
