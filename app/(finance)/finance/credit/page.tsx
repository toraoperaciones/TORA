import { ApproveCreditButton } from "@/components/finance/approve-credit-button";
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

interface TenantRow {
  id: string;
  name: string;
  rfc: string | null;
  credit_limit: string | number;
  credit_days: number;
  status: string;
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

export default async function FinanceCreditPage() {
  const supabase = await createClient();

  const [tenantsRes, linesRes, chargesRes, awaitingTripsRes, tripChargesRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, rfc, credit_limit, credit_days, status")
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

  return (
    <div className="flex flex-col gap-8">
      <h1>Líneas de crédito</h1>

      {awaitingTrips.length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface p-6">
          <h2 className="font-display text-h4 text-navy">
            Solicitudes de crédito pendientes
          </h2>
          <p className="mt-1 text-body-s text-graphite">
            Trips con opción seleccionada cuyo saldo no cubre. Aprobar crédito
            confirma la reserva y deja el cargo a 30 días.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {awaitingTrips.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-offwhite/50 px-4 py-3"
              >
                <div>
                  <p className="text-body-s font-semibold text-navy">
                    {tenantNames.get(t.tenant_id) ?? t.tenant_id} → {t.destination}
                  </p>
                  <p className="text-caption text-graphite tabular-nums">
                    Cargo pendiente: {formatMXN(t.charge_amount)}
                  </p>
                </div>
                <ApproveCreditButton
                  tripId={t.id}
                  tenantName={tenantNames.get(t.tenant_id) ?? t.tenant_id}
                  destination={t.destination}
                  chargeAmount={t.charge_amount}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert>
        <AlertDescription>
          El crédito es a 30 días sin interés. Después: 2.5% mensual (31-60 días),
          3.5% mensual (61-90 días), suspensión (90+).
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border-subtle bg-surface p-6">
        {tenants.length === 0 ? (
          <p className="text-body-s text-graphite">Sin clientes registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Cliente
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Límite aprobado
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Utilizado
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Disponible
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Interés acumulado
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Estado
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
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
                  <TableRow key={tenant.id} className="border-border-subtle align-top">
                    <TableCell className="text-body-s font-semibold text-navy">
                      {tenant.name}
                      <p className="text-caption font-normal text-graphite">
                        RFC {tenant.rfc ?? "—"} · crédito {tenant.credit_days}d
                      </p>
                      {/* Movimientos expandibles: charges pending_payment */}
                      {tenantCharges.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-caption font-normal text-graphite hover:underline">
                            Ver movimientos ({tenantCharges.length})
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1 border-l border-border-subtle pl-3">
                            {tenantCharges.map((charge) => (
                              <li
                                key={charge.id}
                                className="flex items-center justify-between gap-3 text-caption text-navy"
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
                    <TableCell className="text-right text-body-s tabular-nums text-navy">
                      {line ? formatMXN(limit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-body-s tabular-nums text-navy">
                      {used > 0 ? formatMXN(used) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-body-s tabular-nums text-navy">
                      {line ? formatMXN(Math.max(0, limit - used)) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-body-s tabular-nums",
                        interest > 0 ? "font-semibold text-navy" : "text-graphite"
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
                            ? "border-transparent bg-forest text-offwhite"
                            : "border-border-default bg-transparent text-graphite"
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
