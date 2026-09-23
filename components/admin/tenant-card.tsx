import { RiErrorWarningLine } from "@remixicon/react";
import Link from "next/link";

import { EditTenantDialog } from "@/components/admin/edit-tenant-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/business/payment-method";
import { formatMXN } from "@/lib/utils";

export interface TenantRow {
  id: string;
  name: string;
  rfc: string | null;
  credit_limit: number | string;
  credit_used?: number | string;
  credit_days?: number;
  status: string;
  payment_method?: PaymentMethod | null;
  spei_clabe?: string | null;
  spei_beneficiary?: string | null;
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
  // Sprint 2: en tenants a crédito el uso real vive en tenants.credit_used.
  const used =
    tenant.payment_method === "credit"
      ? Number(tenant.credit_used ?? 0)
      : Number(activeLine?.used_amount ?? 0);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground/75"
        >
          {initials(tenant.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/tenants/${tenant.id}`}
            className="block truncate text-base font-semibold text-foreground hover:underline"
          >
            {tenant.name}
          </Link>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {tenant.rfc ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Línea
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
            {formatMXN(line)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Crédito usado
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
            {formatMXN(used)}
          </p>
          {tenant.payment_method === "credit" && (
            <p className="text-xs text-muted-foreground">a {tenant.credit_days ?? 30} días</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {tenant.status === "active" ? (
            <Badge variant="outline">Activo</Badge>
          ) : tenant.status === "suspended" ? (
            <Badge variant="warning">
              <RiErrorWarningLine className="h-3 w-3" aria-hidden /> Suspendido
            </Badge>
          ) : (
            <Badge variant="muted">Archivado</Badge>
          )}
          {tenant.payment_method && (
            <Badge variant="muted" className="whitespace-nowrap">
              {PAYMENT_METHOD_LABEL[tenant.payment_method as PaymentMethod] ??
                tenant.payment_method}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EditTenantDialog
            tenantId={tenant.id}
            tenantName={tenant.name}
            paymentMethod={(tenant.payment_method as PaymentMethod) ?? "prepaid"}
            speiClabe={tenant.spei_clabe ?? null}
            speiBeneficiary={tenant.spei_beneficiary ?? null}
            creditLimit={Number(tenant.credit_limit ?? 0)}
            creditDays={tenant.credit_days ?? 30}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/tenants/${tenant.id}`}>Ver</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
