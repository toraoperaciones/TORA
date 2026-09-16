import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepositRow, type DepositRowData } from "@/components/finance/deposit-row";
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
    <div className="flex flex-col gap-8">
      <h1>Validar depósitos SPEI</h1>

      <Alert>
        <AlertDescription>
          Los depósitos se validan manualmente. Al aprobar uno, se re-evalúan
          automáticamente los viajes pendientes de pago del cliente.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border-subtle bg-surface p-6">
        {deposits.length === 0 ? (
          <p className="text-body-s text-graphite">
            No hay depósitos pendientes de validación. Buen trabajo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Cliente
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Subió
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Referencia
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Monto
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Antigüedad
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Comprobante
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Acciones
                </TableHead>
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
