import { MoneyHero } from "@/components/ui/money-hero";
import { ReceiptUpload } from "@/components/wallet/receipt-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatMXN } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: "Depósito",
  charge: "Cargo",
  refund: "Reembolso",
  credit_payment: "Pago de crédito",
};

const TX_STATUS_CLASS: Record<string, string> = {
  pending: "border-border bg-transparent text-foreground",
  completed: "border-transparent bg-primary text-foreground",
  rejected: "border-border bg-transparent text-foreground/75",
  pending_payment: "border-transparent bg-muted text-foreground",
};

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
  trip?: string;
}

export const metadata: Metadata = pageMetadata("Billetera");

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { page: pageParam, trip: tripParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const ctx = await getClientContext();
  const tenantId = ctx.tenantId;
  const supabase = await createClient();

  if (!tenantId) {
    return (
      <div className="flex flex-col gap-8">
        <h1>Billetera</h1>
        <p className="text-sm text-foreground/75">
          Tu usuario no tiene tenant asignado.
        </p>
      </div>
    );
  }

  const [balance, txs, pendingCashTrips] = await Promise.all([
    import("@/lib/business/wallet").then((m) => m.getBalance(tenantId)),
    supabase
      .from("wallet_transactions")
      .select("id, amount, type, reference, status, receipt_url, created_at", {
        count: "exact",
      })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    // Trips cash que esperan SPEI (el comprobante puede vincularse a uno).
    supabase
      .from("trips")
      .select("id, destination, departure_date")
      .eq("tenant_id", tenantId)
      .eq("status", "awaiting_payment")
      .eq("payment_method_snapshot", "cash")
      .order("created_at", { ascending: false }),
  ]);

  const transactions = (txs.data ?? []) as Array<{
    id: string;
    amount: string;
    type: string;
    reference: string | null;
    status: string;
    receipt_url: string | null;
    created_at: string;
  }>;
  const totalCount = txs.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const cashTrips = (pendingCashTrips.data ?? []) as Array<{
    id: string;
    destination: string;
    departure_date: string;
  }>;

  return (
    <div className="flex flex-col gap-8">
      <h1>Billetera</h1>

      <MoneyHero label="Saldo actual" amount={balance} scale="m" />

      {ctx.role === "CLIENT_ADMIN" && (
        <ReceiptUpload
          tenantId={tenantId}
          cashTrips={cashTrips.map((t) => ({
            id: t.id,
            label: `${t.destination} · sale ${t.departure_date}`,
          }))}
          preselectedTripId={tripParam ?? null}
        />
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        {transactions.length === 0 ? (
          <p className="text-sm text-foreground/75">
            Aún no hay transacciones registradas.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Fecha
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Tipo
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Referencia
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Estado
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                    Monto
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                    Comprobante
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-border">
                    <TableCell className="text-sm text-foreground">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {TX_TYPE_LABEL[tx.type] ?? tx.type}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-foreground/75">
                      {tx.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("whitespace-nowrap font-medium", TX_STATUS_CLASS[tx.status])}
                      >
                        {tx.status === "completed"
                          ? "Completado"
                          : tx.status === "pending"
                            ? "Pendiente"
                            : tx.status === "rejected"
                              ? "Rechazado"
                              : "Por pagar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatMXN(Number(tx.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {tx.receipt_url ? (
                        <ViewReceiptButton path={tx.receipt_url} />
                      ) : (
                        <span className="text-xs text-foreground/75">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-foreground/75">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/wallet?page=${page - 1}`}>Anterior</a>
                  </Button>
                )}
                {page < totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/wallet?page=${page + 1}`}>Siguiente</a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * El comprobante vive en bucket privado: se abre vía signed URL de 1 hora.
 * Client Component mínimo para no traer interactividad extra al server page.
 */
function ViewReceiptButton({ path }: { path: string }) {
  return (
    <form action="/api/receipts/signed-url" method="POST">
      <input type="hidden" name="path" value={path} />
      <Button type="submit" variant="outline" size="sm" className="font-semibold">
        Ver comprobante
      </Button>
    </form>
  );
}
