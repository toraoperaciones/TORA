import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";
import { es } from "date-fns/locale";
import Link from "next/link";

import { SpendDonut } from "@/components/charts/spend-donut";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  EmptyTrips,
  EmptyWallet,
} from "@/components/illustrations/illustrations";
import { Stagger, StaggerItem } from "@/components/layout/stagger";
import { StatusBadge } from "@/components/trips/status-badge";
import { MoneyHero } from "@/components/ui/money-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientContext } from "@/lib/auth/tenant";
import { statusLabel } from "@/lib/business/trip-machine";
import {
  getBalance,
  getMonthlySpend,
  getSpendByCategory,
  getSpendSeries,
} from "@/lib/business/wallet";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { formatMXN } from "@/lib/utils";

const TX_TYPE_LABEL: Record<string, string> = {
  deposit: "Depósito",
  charge: "Cargo",
  refund: "Reembolso",
  credit_payment: "Pago de crédito",
};

/** Hora actual en Mexico_City para el saludo. */
function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      hour12: false,
    })
  );
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Nombre de pila (primera palabra del full_name). */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "";
}

export const metadata = pageMetadata("Inicio");

export default async function DashboardPage() {
  const ctx = await getClientContext();
  const tenantId = ctx.tenantId;
  const supabase = await createClient();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  const [balance, monthlySpend, spendSeries, categories, upcoming, recentTxs] =
    await Promise.all([
      tenantId ? getBalance(tenantId) : Promise.resolve(0),
      tenantId ? getMonthlySpend(tenantId) : Promise.resolve(0),
      tenantId ? getSpendSeries(tenantId, 14) : Promise.resolve([]),
      tenantId ? getSpendByCategory(tenantId) : Promise.resolve([]),
      tenantId
        ? supabase
            .from("trips")
            .select("id, destination, departure_date, status")
            .eq("tenant_id", tenantId)
            .gte("departure_date", today)
            .order("departure_date", { ascending: true })
            .limit(3)
        : Promise.resolve({ data: [] }),
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

  const seriesPoints = spendSeries.map((p) => p.amount);
  const name = firstName(ctx.fullName);

  return (
    <div className="flex flex-col gap-8">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 text-text-primary">
            {greeting()}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-1 text-body-s text-text-tertiary">
            Esto es lo que está pasando en TORA.
          </p>
        </div>
        {ctx.role === "CLIENT_ADMIN" && (
          <Button asChild>
            <Link href="/trips/new">Solicitar viaje</Link>
          </Button>
        )}
      </div>

      {/* Nivel 1 — HERO: el saldo domina la pantalla. */}
      <Stagger className="grid gap-4 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <MoneyHero
            label="Saldo disponible"
            amount={balance}
            scale="xl"
            sparkline={seriesPoints}
            className="h-full"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Gasto del mes"
            value={monthlySpend}
            isMoney
            sparkline={seriesPoints}
            className="h-full"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard label="Próximos viajes" value={upcomingTrips.length} className="h-full" />
        </StaggerItem>
        <StaggerItem className="lg:col-span-2">
          {upcomingTrips.length > 0 ? (
            <div
              data-metric
              className="flex h-full flex-col justify-between gap-4 rounded-lg border border-border-subtle bg-navy-lift p-6 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-caption uppercase tracking-wider text-text-tertiary">
                  Tu próximo viaje
                </p>
                <p className="mt-2 font-display text-h3 font-semibold text-text-primary">
                  {upcomingTrips[0].destination} ·{" "}
                  <span className="font-mono text-body-l text-text-secondary">
                    {upcomingTrips[0].departure_date}
                  </span>
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/trips/${upcomingTrips[0].id}`}>
                  Ver detalles
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <KpiCard
              label="Próximo viaje"
              value={0}
              className="h-full"
            />
          )}
        </StaggerItem>
      </Stagger>

      {/* Categorías + Próximos viajes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-h4">Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <EmptyWallet className="h-24 w-24" />
                <p className="max-w-[38ch] text-body-s text-text-tertiary">
                  Sin actividad este mes. Los gastos aparecerán aquí cuando
                  confirmes tu primer viaje.
                </p>
              </div>
            ) : (
              <SpendDonut
                slices={categories.map((c) => ({
                  label: c.serviceType,
                  value: c.total,
                }))}
                centerLabel={formatMXN(monthlySpend)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-h4">Próximos viajes</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTrips.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <EmptyTrips className="h-24 w-24" />
                <p className="text-body-s text-text-tertiary">
                  Aún no tienes viajes programados.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {upcomingTrips.map((trip) => (
                  <li
                    key={trip.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-body-s font-semibold text-text-primary underline-offset-4 hover:underline"
                      >
                        {trip.destination}
                      </Link>
                      <p className="font-mono text-caption text-text-tertiary">
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
      </div>

      {/* CTA flotante — un solo botón primario siempre visible. */}
      {ctx.role === "CLIENT_ADMIN" && (
        <Button
          asChild
          size="lg"
          className="fixed bottom-6 right-6 z-40 shadow-modal sm:hidden"
        >
          <Link href="/trips/new">Solicitar viaje</Link>
        </Button>
      )}

      {/* Actividad reciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-h4">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <EmptyWallet className="h-24 w-24" />
              <p className="text-body-s text-text-tertiary">
                Aún no hay actividad en tu billetera.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {transactions.map((tx) => {
                const isCredit = tx.type === "deposit" || tx.type === "refund";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-body-s text-text-primary">
                        <span className="font-semibold">
                          {TX_TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                        <span className="ml-2 text-text-tertiary">
                          {statusLabel(tx.status)}
                        </span>
                      </p>
                      <p className="text-caption text-text-muted">
                        {formatDistanceToNow(new Date(tx.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    <span className="font-mono text-body-s font-semibold tabular-nums text-text-primary">
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
  );
}
