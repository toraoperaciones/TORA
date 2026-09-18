import { StatusBadge } from "@/components/trips/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBalance } from "@/lib/business/wallet";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMXN } from "@/lib/utils";

interface TenantRow {
  id: string;
  name: string;
  rfc: string | null;
  status: string;
}

interface TripLite {
  id: string;
  destination: string;
  departure_date: string;
  status: string;
}

interface TxLite {
  id: string;
  amount: string;
  type: string;
  status: string;
  created_at: string;
}

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: "Depósito",
  charge: "Cargo",
  refund: "Reembolso",
  credit_payment: "Pago de crédito",
};

export default async function OpsClientsPage() {
  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, rfc, status")
    .order("name");

  const rows = (tenants ?? []) as TenantRow[];

  const tenantsWithStats = await Promise.all(
    rows.map(async (tenant) => {
      const [balance, activeTrips, lastTrip, lastTxs] = await Promise.all([
        getBalance(tenant.id),
        supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .in("status", ["awaiting_selection", "awaiting_payment", "confirmed"]),
        supabase
          .from("trips")
          .select("id, destination, departure_date, status")
          .eq("tenant_id", tenant.id)
          .order("departure_date", { ascending: false })
          .limit(1),
        supabase
          .from("wallet_transactions")
          .select("id, amount, type, status, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const lastTrips = await supabase
        .from("trips")
        .select("id, destination, departure_date, status")
        .eq("tenant_id", tenant.id)
        .order("departure_date", { ascending: false })
        .limit(3);

      return {
        ...tenant,
        balance,
        activeTripsCount: activeTrips.count ?? 0,
        lastTrip: (lastTrip.data?.[0] ?? null) as TripLite | null,
        recentTrips: (lastTrips.data ?? []) as TripLite[],
        recentTxs: (lastTxs.data ?? []) as TxLite[],
      };
    })
  );

  return (
    <div className="flex flex-col gap-8">
      <h1>Clientes</h1>

      <div className="rounded-lg border border-border-subtle bg-navy-lift p-6">
        <Table>
          <TableHeader>
            <TableRow className="border-border-subtle hover:bg-transparent">
              <TableHead className="text-caption uppercase tracking-wider text-text-secondary">
                Nombre
              </TableHead>
              <TableHead className="text-caption uppercase tracking-wider text-text-secondary">
                RFC
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-text-secondary">
                Saldo
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-text-secondary">
                Viajes activos
              </TableHead>
              <TableHead className="text-caption uppercase tracking-wider text-text-secondary">
                Último viaje
              </TableHead>
              <TableHead className="text-caption uppercase tracking-wider text-text-secondary">
                Estado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantsWithStats.map((tenant) => (
              <TableRow key={tenant.id} className="border-border-subtle align-top">
                <TableCell className="text-body-s font-semibold text-text-primary">
                  {tenant.name}
                  {/* Detalle expandible nativo: últimos trips + transacciones */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-caption font-normal text-text-secondary hover:underline">
                      Ver actividad reciente
                    </summary>
                    <div className="mt-2 grid gap-4 border-l border-border-subtle pl-3 lg:grid-cols-2">
                      <div>
                        <p className="text-caption uppercase tracking-wider text-text-secondary">
                          Últimos viajes
                        </p>
                        {tenant.recentTrips.length === 0 ? (
                          <p className="text-caption text-text-secondary">Sin viajes.</p>
                        ) : (
                          <ul className="mt-1 flex flex-col gap-1">
                            {tenant.recentTrips.map((trip) => (
                              <li
                                key={trip.id}
                                className="flex items-center justify-between gap-2 text-caption text-text-primary"
                              >
                                <span>
                                  {trip.destination} · {trip.departure_date}
                                </span>
                                <StatusBadge status={trip.status} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="text-caption uppercase tracking-wider text-text-secondary">
                          Últimas transacciones
                        </p>
                        {tenant.recentTxs.length === 0 ? (
                          <p className="text-caption text-text-secondary">Sin movimientos.</p>
                        ) : (
                          <ul className="mt-1 flex flex-col gap-1">
                            {tenant.recentTxs.map((tx) => (
                              <li
                                key={tx.id}
                                className="flex items-center justify-between gap-2 text-caption text-text-primary"
                              >
                                <span>
                                  {TX_TYPE_LABEL[tx.type] ?? tx.type} ·{" "}
                                  {new Date(tx.created_at).toLocaleDateString("es-MX")}
                                </span>
                                <span className="tabular-nums">
                                  {formatMXN(Number(tx.amount))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
                </TableCell>
                <TableCell className="text-body-s tabular-nums text-text-secondary">
                  {tenant.rfc ?? "—"}
                </TableCell>
                <TableCell className="text-right text-body-s font-semibold tabular-nums text-text-primary">
                  {formatMXN(tenant.balance)}
                </TableCell>
                <TableCell className="text-right text-body-s tabular-nums text-text-primary">
                  {tenant.activeTripsCount}
                </TableCell>
                <TableCell className="text-body-s text-text-primary">
                  {tenant.lastTrip
                    ? `${tenant.lastTrip.destination} · ${tenant.lastTrip.departure_date}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "whitespace-nowrap font-medium",
                      tenant.status === "active"
                        ? "border-border-default bg-layer-2 text-text-primary"
                        : "border-border-default bg-transparent text-text-secondary"
                    )}
                  >
                    {tenant.status === "active" ? "Activo" : tenant.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
