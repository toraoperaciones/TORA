import Link from "next/link";

import { StatusBadge } from "@/components/trips/status-badge";
import { BalanceCard } from "@/components/wallet/balance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/lib/business/trip-machine";
import { getBalance, getMonthlySpend } from "@/lib/business/wallet";
import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/utils";

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: "Depósito",
  charge: "Cargo",
  refund: "Reembolso",
  credit_payment: "Pago de crédito",
};

/** Hoy en America/Mexico_City como YYYY-MM-DD (columna date). */
function todayMX(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

export default async function DashboardPage() {
  const ctx = await getClientContext();
  const tenantId = ctx.tenantId;
  const supabase = await createClient();

  const today = todayMX();

  const [balance, monthlySpend, upcoming, recentTxs] = await Promise.all([
    tenantId ? getBalance(tenantId) : Promise.resolve(0),
    tenantId ? getMonthlySpend(tenantId) : Promise.resolve(0),
    tenantId
      ? supabase
          .from("trips")
          .select("id, destination, departure_date, status", { count: "exact" })
          .eq("tenant_id", tenantId)
          .gte("departure_date", today)
          .order("departure_date", { ascending: true })
          .limit(3)
      : Promise.resolve({ data: [], count: 0 }),
    tenantId
      ? supabase
          .from("wallet_transactions")
          .select("id, amount, type, status, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const upcomingTrips = (upcoming.data ?? []) as Array<{
    id: string;
    destination: string;
    departure_date: string;
    status: string;
  }>;
  const transactions = (recentTxs.data ?? []) as Array<{
    id: string;
    amount: string;
    type: string;
    status: string;
    created_at: string;
  }>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1>Inicio</h1>
        {ctx.role === "CLIENT_ADMIN" && (
          <Button asChild className="font-display font-semibold">
            <Link href="/trips/new">Solicitar viaje</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard balance={balance} />
        <div className="rounded-lg border border-border-subtle bg-surface p-6">
          <p className="text-caption uppercase tracking-wider text-graphite">
            Gasto del mes
          </p>
          <p className="mt-2 font-display text-display-m tabular-nums text-navy">
            {formatMXN(monthlySpend)}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface p-6">
          <p className="text-caption uppercase tracking-wider text-graphite">
            Próximos viajes
          </p>
          <p className="mt-2 font-display text-display-m tabular-nums text-navy">
            {upcoming.count ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border-subtle bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-h4 text-navy">
              Próximos viajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTrips.length === 0 ? (
              <p className="text-body-s text-graphite">
                Aún no tienes viajes programados.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {upcomingTrips.map((trip) => (
                  <li key={trip.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-body-s font-semibold text-navy underline-offset-4 hover:underline"
                      >
                        {trip.destination}
                      </Link>
                      <p className="text-caption text-graphite">
                        Sale el {trip.departure_date}
                      </p>
                    </div>
                    <StatusBadge status={trip.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border-subtle bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-h4 text-navy">
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-body-s text-graphite">Aún no hay actividad.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || tx.type === "refund";
                  return (
                    <li key={tx.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-body-s font-semibold text-navy">
                          {TX_TYPE_LABEL[tx.type] ?? tx.type}
                          <span className="ml-2 font-normal text-graphite">
                            {statusLabel(tx.status) === tx.status
                              ? tx.status
                              : statusLabel(tx.status)}
                          </span>
                        </p>
                        <p className="text-caption text-graphite">
                          {new Date(tx.created_at).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                      <span className="text-body-s font-semibold tabular-nums text-navy">
                        {isCredit ? "+" : "−"}
                        {formatMXN(Number(tx.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
