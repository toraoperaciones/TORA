import { Info } from "lucide-react";

import { DepositRow, type DepositRowData } from "@/components/finance/deposit-row";
import { EmptyWallet } from "@/components/illustrations/illustrations";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export default async function FinanceDepositsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("wallet_transactions")
    .select(
      `id, amount, reference, receipt_url, created_at, status,
       tenants:tenant_id (id, name, rfc),
       creator:created_by (full_name, email)`
    )
    .eq("type", "deposit")
    .eq("status", "pending")
    .order("created_at", { ascending: true }); // FIFO

  const deposits = (data ?? []) as unknown as DepositRowData[];

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
    </div>
  );
}
