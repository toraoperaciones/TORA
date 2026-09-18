import { Info } from "lucide-react";
import type { Metadata } from "next";

import { DepositRow, type DepositRowData } from "@/components/finance/deposit-row";
import { EmptyWallet } from "@/components/illustrations/illustrations";
import { MoneyHero } from "@/components/ui/money-hero";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { cdmxDayStartIso } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { formatMXN } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("Depósitos");

export default async function FinanceDepositsPage() {
  const supabase = await createClient();

  const today = cdmxDayStartIso();

  const [pending, validatedToday] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select(
        `id, amount, reference, receipt_url, created_at, status,
         tenants:tenant_id (id, name, rfc),
         creator:created_by (full_name, email)`
      )
      .eq("type", "deposit")
      .eq("status", "pending")
      .order("created_at", { ascending: true }), // FIFO
    supabase
      .from("wallet_transactions")
      .select("id, amount, validated_at, tenants:tenant_id (name)")
      .eq("type", "deposit")
      .eq("status", "completed")
      .gte("validated_at", today)
      .order("validated_at", { ascending: false })
      .limit(10),
  ]);

  const deposits = (pending.data ?? []) as unknown as DepositRowData[];
  const validated = (validatedToday.data ?? []) as unknown as Array<{
    id: string;
    amount: string;
    validated_at: string;
    tenants: { name: string } | null;
  }>;

  const pendingTotal = deposits.reduce(
    (acc, d) => acc + Number(d.amount),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 text-text-primary">
          Validar depósitos SPEI
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-body-s text-text-tertiary">
          <Info className="h-3.5 w-3.5" aria-hidden />
          Al aprobar un depósito, los viajes pendientes de pago del cliente se
          re-evalúan automáticamente.
        </p>
      </div>

      {/* Nivel 1 — HERO: total pendiente de validar. */}
      <MoneyHero
        label="Pendiente de validar"
        amount={pendingTotal}
        scale="l"
        animated={false}
      >
        <p className="mt-2 text-body-s text-text-secondary">
          {deposits.length === 0
            ? "Nada en cola — todo validado."
            : `${deposits.length} depósito${deposits.length === 1 ? "" : "s"} en cola · FIFO`}
        </p>
      </MoneyHero>

      <div className="rounded-lg border border-border-subtle bg-navy-lift">
        {deposits.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <EmptyWallet className="h-28 w-28" />
            <p className="text-body-s text-text-tertiary">
              No hay depósitos pendientes de validación. Buen trabajo.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Subió</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Antigüedad</TableHead>
                <TableHead className="text-right">Comprobante</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.map((deposit) => (
                <DepositRow key={deposit.id} deposit={deposit} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Nivel 3 — contexto: validados hoy. */}
      {validated.length > 0 ? (
        <section aria-label="Validados hoy" className="flex flex-col gap-3">
          <h2 className="text-caption uppercase tracking-wider text-text-tertiary">
            Validados hoy
          </h2>
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-navy-lift px-5">
            {validated.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-body-s text-text-primary">
                  {v.tenants?.name ?? "—"}
                </span>
                <span className="text-caption text-text-tertiary">
                  {new Date(v.validated_at).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Mexico_City",
                  })}
                </span>
                <span className="font-mono text-body-s font-semibold tabular-nums text-forest">
                  +{formatMXN(Number(v.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
