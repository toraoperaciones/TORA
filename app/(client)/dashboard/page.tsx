import { formatDistanceToNow } from "date-fns";
import { RiArrowRightLine, RiBankCardLine, RiWalletLine } from "@remixicon/react";
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
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/business/payment-methods";
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

  const [
    tenantRow,
    balance,
    monthlySpend,
    spendSeries,
    categories,
    upcoming,
    recentTxs,
  ] = await Promise.all([
    tenantId
      ? supabase
          .from("tenants")
          .select("payment_method, credit_limit, credit_used")
          .eq("id", tenantId)
          .single()
      : Promise.resolve({ data: null }),
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

  const tenantData =
    (tenantRow.data as
      | { payment_method?: PaymentMethod; credit_limit?: string | number; credit_used?: string | number }
      | null) ?? null;
  const paymentMethod: PaymentMethod = tenantData?.payment_method ?? "prepaid";

  // Sprint 2 — cupo de crédito real para la card de método.
  const creditLimit = Number(tenantData?.credit_limit ?? 0);
  const creditUsed = Number(tenantData?.credit_used ?? 0);
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const creditUsage = creditLimit > 0 ? creditUsed / creditLimit : 0;

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

  const methodIcon =
    paymentMethod === "cash" ? (
      <RiBankCardLine className="h-4 w-4 text-muted-foreground" aria-hidden />
    ) : paymentMethod === "prepaid" ? (
      <RiWalletLine className="h-4 w-4 text-muted-foreground" aria-hidden />
    ) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {greeting()}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
              className="flex h-full flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Tu próximo viaje
                </p>
                <p className="mt-2 text-xl font-semibold font-semibold text-foreground">
                  {upcomingTrips[0].destination} ·{" "}
                  <span className="font-mono text-lg text-foreground/75">
                    {upcomingTrips[0].departure_date}
                  </span>
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/trips/${upcomingTrips[0].id}`}>
                  Ver detalles
                  <RiArrowRightLine className="h-4 w-4" aria-hidden />
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
        <StaggerItem className="lg:col-span-3">
          {tenantId && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                {methodIcon}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Método de pago
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {PAYMENT_METHOD_LABEL[paymentMethod]}
                    {paymentMethod === "prepaid" &&
                      ` · Saldo disponible: ${formatMXN(balance)} MXN`}
                    {paymentMethod === "cash" &&
                      " · Cada viaje requiere SPEI previo."}
                    {paymentMethod === "credit" &&
                      ` · Disponible: ${formatMXN(creditAvailable)} de ${formatMXN(creditLimit)}.`}
                  </p>
                </div>
              </div>
              {paymentMethod === "credit" &&
                (creditUsage >= 1 ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold text-destructive">
                    Sin crédito disponible. Contacta a TORA.
                  </p>
                ) : creditUsage > 0.8 ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground">
                    Estás cerca del límite de tu línea.
                  </p>
                ) : null)}
            </div>
          )}
        </StaggerItem>
      </Stagger>

      {/* Categorías + Próximos viajes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <EmptyWallet className="h-24 w-24" />
                <p className="max-w-[38ch] text-sm text-muted-foreground">
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
            <CardTitle className="text-lg font-semibold">Próximos viajes</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTrips.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <EmptyTrips className="h-24 w-24" />
                <p className="text-sm text-muted-foreground">
                  Aún no tienes viajes programados.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {upcomingTrips.map((trip) => (
                  <li
                    key={trip.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        {trip.destination}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
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
          className="fixed bottom-6 right-6 z-40 shadow-2xl sm:hidden"
        >
          <Link href="/trips/new">Solicitar viaje</Link>
        </Button>
      )}

      {/* Actividad reciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <EmptyWallet className="h-24 w-24" />
              <p className="text-sm text-muted-foreground">
                Aún no hay actividad en tu billetera.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {transactions.map((tx) => {
                const isCredit = tx.type === "deposit" || tx.type === "refund";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          {TX_TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {statusLabel(tx.status)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(tx.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
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
