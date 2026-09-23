import { ApproveCreditButton } from "@/components/finance/approve-credit-button";
import { CreditApprovalBanner } from "@/components/finance/credit-approval-banner";
import { KpiCard } from "@/components/finance/kpi-card";
import { SettleCreditDialog } from "@/components/finance/settle-credit-dialog";
import { SuspendTenantButton } from "@/components/finance/suspend-tenant-button";
import { CreditLineDialog } from "@/components/finance/credit-line-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculateInterest,
  daysOutstanding,
  type PendingCharge,
} from "@/lib/business/credit";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMXN } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

interface TenantRow {
  id: string;
  name: string;
  rfc: string | null;
  payment_method: string;
  credit_limit: string | number;
  credit_used: string | number;
  credit_days: number;
  status: string;
}

interface CreditTripRow {
  id: string;
  destination: string;
  credit_due_date: string | null;
  status: string;
  tenants: { name: string } | null;
  trip_options: Array<{ final_price: string | number; is_selected: boolean }> | null;
}

interface CreditLineRow {
  id: string;
  tenant_id: string;
  approved_limit: string | number;
  used_amount: string | number;
  interest_rate: string | number;
  status: string;
}

interface ChargeRow extends PendingCharge {
  tenant_id: string;
  reference: string | null;
}

interface AwaitingTripRow {
  id: string;
  destination: string;
  tenant_id: string;
  charge_amount: number;
  selected_option_id: string | null;
}

export const metadata: Metadata = pageMetadata("Crédito");

export default async function FinanceCreditPage() {
  const supabase = await createClient();

  const [tenantsRes, linesRes, chargesRes, awaitingTripsRes, tripChargesRes, creditTripsRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, rfc, payment_method, credit_limit, credit_used, credit_days, status")
      .order("name"),
    supabase.from("credit_lines").select("*").order("created_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("id, tenant_id, amount, created_at, validated_at, reference")
      .eq("type", "charge")
      .eq("status", "pending_payment"),
    supabase
      .from("trips")
      .select(
        `id, destination, tenant_id,
         trip_options ( id, final_price, is_selected )`
      )
      .eq("status", "awaiting_payment"),
    supabase
      .from("wallet_transactions")
      .select("id, tenant_id, amount, reference")
      .eq("type", "charge")
      .eq("status", "pending")
      .like("reference", "TRIP-%"),
    // Sprint 2: cartera a crédito viva (sin pagar), vencimientos primero.
    supabase
      .from("trips")
      .select(
        `id, destination, credit_due_date, status,
         tenants:tenant_id (name),
         trip_options (final_price, is_selected)`
      )
      .eq("payment_method_snapshot", "credit")
      .is("paid_at", null)
      .in("status", ["confirmed", "pending_payment", "suspended"])
      .order("credit_due_date", { ascending: true, nullsFirst: false }),
  ]);

  const tenants = (tenantsRes.data ?? []) as TenantRow[];
  const creditLines = (linesRes.data ?? []) as CreditLineRow[];
  const charges = (chargesRes.data ?? []) as ChargeRow[];
  const tripCharges = ((tripChargesRes.data ?? []) as Array<{
    id: string;
    tenant_id: string;
    amount: number;
    reference: string | null;
  }>);

  // Trips en awaiting_payment con cargo pendiente (wallet_transactions no
  // tiene FK a trips; el vínculo es la referencia TRIP-<id8> que crea
  // select_trip_option). Candidatos del Flujo C cuando el saldo no cubre.
  const awaitingTrips = ((awaitingTripsRes.data ?? []) as Array<{
    id: string;
    destination: string;
    tenant_id: string;
    trip_options: Array<{ id: string; final_price: number; is_selected: boolean }> | null;
  }>)
    .map((t): AwaitingTripRow | null => {
      const ref = `TRIP-${t.id.slice(0, 8)}`;
      const pendingCharge = tripCharges.find(
        (w) => w.reference === ref && w.tenant_id === t.tenant_id
      );
      const selected = (t.trip_options ?? []).find((o) => o.is_selected) ?? null;
      return pendingCharge && selected
        ? {
            id: t.id,
            destination: t.destination,
            tenant_id: t.tenant_id,
            charge_amount: Number(pendingCharge.amount),
            selected_option_id: selected.id,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const interestByTenant = new Map<string, number>();
  for (const charge of charges) {
    interestByTenant.set(
      charge.tenant_id,
      (interestByTenant.get(charge.tenant_id) ?? 0) + calculateInterest(charge)
    );
  }

  const tenantNames = new Map(tenants.map((t) => [t.id, t.name]));

  // ── Sprint 2: KPIs del modelo credit (tenants.payment_method = 'credit').
  const creditTenants = tenants.filter((t) => t.payment_method === "credit");
  const totalLimit = creditTenants.reduce((acc, t) => acc + Number(t.credit_limit), 0);
  const totalUsed = creditTenants.reduce(
    (acc, t) => acc + Math.min(Number(t.credit_used), Number(t.credit_limit)),
    0
  );

  const creditTrips = ((creditTripsRes.data ?? []) as unknown as CreditTripRow[])
    .map((t) => ({
      id: t.id,
      tenantName: t.tenants?.name ?? "—",
      destination: t.destination,
      dueDate: t.credit_due_date,
      status: t.status,
      amount:
        (t.trip_options ?? []).find((o) => o.is_selected)?.final_price ?? null,
    }))
    .filter((t) => t.amount !== null);

  const todayMs = Date.now();
  const daysUntil = (date: string | null) =>
    date
      ? Math.round(
          (new Date(`${date}T12:00:00Z`).getTime() - todayMs) / 86_400_000
        )
      : null;

  return (
    <div className="flex flex-col gap-8">
      <h1>Líneas de crédito</h1>

      {creditTenants.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Crédito otorgado"
            value={formatMXN(Math.round(totalLimit * 100) / 100)}
          />
          <KpiCard
            label="Crédito utilizado"
            value={formatMXN(Math.round(totalUsed * 100) / 100)}
          />
          <KpiCard
            label="Disponible"
            value={formatMXN(Math.round((totalLimit - totalUsed) * 100) / 100)}
            emphasis={totalLimit - totalUsed <= 0 ? "warning" : "default"}
          />
        </div>
      )}

      <CreditApprovalBanner />

      {awaitingTrips.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Solicitudes de crédito pendientes
          </h2>
          <p className="mt-1 text-sm text-foreground/75">
            Trips con opción seleccionada cuyo saldo no cubre. Aprobar crédito
            confirma la reserva y deja el cargo a 30 días.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {awaitingTrips.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tenantNames.get(t.tenant_id) ?? t.tenant_id} → {t.destination}
                  </p>
                  <p className="text-xs text-foreground/75 tabular-nums">
                    Cargo pendiente: {formatMXN(t.charge_amount)}
                  </p>
                </div>
        <ApproveCreditButton
          tripId={t.id}
          destination={t.destination}
          chargeAmount={t.charge_amount}
        />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sprint 2 — cartera a crédito por vencer/vencida, con liquidación. */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Cartera a crédito</h2>
        <p className="mt-1 text-sm text-foreground/75">
          Trips confirmados sin pagar, por fecha de vencimiento. Al liquidar,
          baja el crédito usado del cliente y su factura interna queda pagada.
        </p>
        {creditTrips.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/75">
            Sin cartera activa a crédito.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Destino
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Vence
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Días
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Monto
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Estado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditTrips.map((t) => {
                const days = daysUntil(t.dueDate);
                const overdue = days !== null && days < 0;
                const daysOverdue = overdue ? Math.abs(days ?? 0) : 0;
                return (
                  <TableRow key={t.id} className="border-border">
                    <TableCell className="text-sm font-semibold text-foreground">
                      {t.tenantName}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {t.destination}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">
                      {t.dueDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <span
                        className={cn(
                          overdue
                            ? "font-semibold text-destructive"
                            : days !== null && days <= 2
                              ? "font-bold text-foreground"
                              : days !== null && days <= 7
                                ? "font-semibold text-foreground"
                                : "text-foreground/75"
                        )}
                      >
                        {days === null ? "—" : overdue ? `${Math.abs(days)}d vencido` : `${days}d`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatMXN(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      {t.status === "suspended" ? (
                        <Badge className="border-transparent bg-card font-medium text-destructive">
                          Suspendido
                        </Badge>
                      ) : overdue ? (
                        <Badge className="border-transparent bg-card font-medium text-destructive">
                          Urgente
                        </Badge>
                      ) : (
                        <span className="text-xs text-foreground/75">Vigente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <SettleCreditDialog
                        tripId={t.id}
                        tenantName={t.tenantName}
                        destination={t.destination}
                        amount={Number(t.amount)}
                        dueDate={t.dueDate ?? "—"}
                        daysOverdue={daysOverdue}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Alert>
        <AlertDescription>
          El crédito es a 30 días sin interés. Después: 2.5% mensual (31-60 días),
          3.5% mensual (61-90 días), suspensión (90+).
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border bg-card p-6">
        {tenants.length === 0 ? (
          <p className="text-sm text-foreground/75">Sin clientes registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Límite aprobado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Utilizado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Disponible
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Interés acumulado
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Estado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const line = creditLines.find(
                  (l) => l.tenant_id === tenant.id && l.status === "active"
                );
                const tenantCharges = charges.filter(
                  (c) => c.tenant_id === tenant.id
                );
                const used = tenantCharges.reduce(
                  (acc, c) => acc + Number(c.amount),
                  0
                );
                const limit = line ? Number(line.approved_limit) : 0;
                const interest = interestByTenant.get(tenant.id) ?? 0;
                const oldestDays = tenantCharges.reduce(
                  (max, c) => Math.max(max, daysOutstanding(c)),
                  0
                );

                return (
                  <TableRow key={tenant.id} className="border-border align-top">
                    <TableCell className="text-sm font-semibold text-foreground">
                      {tenant.name}
                      <p className="text-xs font-normal text-foreground/75">
                        RFC {tenant.rfc ?? "—"} · crédito {tenant.credit_days}d
                      </p>
                      {/* Movimientos expandibles: charges pending_payment */}
                      {tenantCharges.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-normal text-foreground/75 hover:underline">
                            Ver movimientos ({tenantCharges.length})
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
                            {tenantCharges.map((charge) => (
                              <li
                                key={charge.id}
                                className="flex items-center justify-between gap-3 text-xs text-foreground"
                              >
                                <span>
                                  {charge.reference ?? charge.id.slice(0, 8)} ·{" "}
                                  {daysOutstanding(charge)}d
                                </span>
                                <span className="tabular-nums">
                                  {formatMXN(Number(charge.amount))} +{" "}
                                  {formatMXN(calculateInterest(charge))} interés
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-foreground">
                      {line ? formatMXN(limit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-foreground">
                      {used > 0 ? formatMXN(used) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-foreground">
                      {line ? formatMXN(Math.max(0, limit - used)) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm tabular-nums",
                        interest > 0 ? "font-semibold text-foreground" : "text-foreground/75"
                      )}
                    >
                      {formatMXN(interest)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap font-medium",
                          tenant.status === "active"
                            ? "border-transparent bg-primary text-foreground"
                            : "border-border bg-transparent text-foreground/75"
                        )}
                      >
                        {tenant.status === "active" ? "Activo" : tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <CreditLineDialog
                          tenant={{ id: tenant.id, name: tenant.name }}
                          currentLimit={line ? Number(line.approved_limit) : null}
                          currentRate={
                            line ? Number(line.interest_rate) : null
                          }
                        />
                        {oldestDays > 90 && tenant.status === "active" && (
                          <SuspendTenantButton
                            tenantId={tenant.id}
                            tenantName={tenant.name}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
