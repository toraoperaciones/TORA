import { AlertCircle } from "lucide-react";

import { KpiCard } from "@/components/finance/kpi-card";
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
import { getBalance } from "@/lib/business/wallet";
import { cdmxMonthStartIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const sum = (rows: Array<{ amount: string | number } | null> | null | undefined) =>
  (rows ?? []).reduce((acc, row) => acc + Number(row?.amount ?? 0), 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface PendingChargeRow extends PendingCharge {
  tenant_id: string;
  reference: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  credit_limit: string | number;
  status: string;
}

interface CreditLineRow {
  tenant_id: string;
  approved_limit: string | number;
  used_amount: string | number;
  status: string;
}

export const metadata: Metadata = pageMetadata("Dashboard");

export default async function FinanceDashboardPage() {
  const supabase = await createClient();

  const monthStart = cdmxMonthStartIso();

  const [tenantsRes, depositsRes, chargesRes, optionsRes, linesRes, pendingRes] =
    await Promise.all([
      supabase.from("tenants").select("id, name, credit_limit, status").order("name"),
      supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("type", "deposit")
        .eq("status", "completed")
        .gte("created_at", monthStart),
      supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("type", "charge")
        .eq("status", "completed")
        .gte("created_at", monthStart),
      supabase
        .from("trip_options")
        .select("net_price, final_price")
        .eq("is_selected", true)
        .gte("created_at", monthStart),
      supabase.from("credit_lines").select("*").eq("status", "active"),
      supabase
        .from("wallet_transactions")
        .select("id, tenant_id, amount, created_at, validated_at, reference")
        .eq("type", "charge")
        .eq("status", "pending_payment"),
    ]);

  const tenants = (tenantsRes.data ?? []) as TenantRow[];
  const creditLines = (linesRes.data ?? []) as CreditLineRow[];
  const pendingCharges = (pendingRes.data ?? []) as PendingChargeRow[];

  // Saldos por tenant en paralelo.
  const balances = await Promise.all(
    tenants.map(async (tenant) => ({
      tenantId: tenant.id,
      balance: await getBalance(tenant.id),
    }))
  );
  const balanceByTenant = new Map(balances.map((b) => [b.tenantId, b.balance]));

  const totalDeposits = sum(depositsRes.data);
  const totalCharges = sum(chargesRes.data);
  const grossMargin = (optionsRes.data ?? []).reduce(
    (acc, o) => acc + (Number(o.final_price) - Number(o.net_price)),
    0
  );
  const creditGranted = creditLines.reduce(
    (acc, l) => acc + Number(l.approved_limit),
    0
  );
  const creditUsed = creditLines.reduce((acc, l) => acc + Number(l.used_amount), 0);
  const accruedInterest = round2(
    pendingCharges.reduce((acc, c) => acc + calculateInterest(c), 0)
  );
  const aggregateBalance = tenants.reduce(
    (acc, t) => acc + (balanceByTenant.get(t.id) ?? 0),
    0
  );

  const overdueCharges = pendingCharges
    .map((charge) => ({ charge, days: daysOutstanding(charge) }))
    .filter(({ days }) => days > 30)
    .sort((a, b) => b.days - a.days);

  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-col gap-8">
      <h1>Dashboard financiero</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saldo agregado" value={formatMXN(round2(aggregateBalance))} />
        <KpiCard label="Depósitos del mes" value={formatMXN(round2(totalDeposits))} />
        <KpiCard label="Cargos del mes" value={formatMXN(round2(totalCharges))} />
        <KpiCard
          label="Margen bruto del mes"
          value={formatMXN(round2(grossMargin))}
          emphasis="positive"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Crédito total otorgado" value={formatMXN(round2(creditGranted))} />
        <KpiCard label="Crédito utilizado" value={formatMXN(round2(creditUsed))} />
        <KpiCard
          label="Interés acumulado pendiente"
          value={formatMXN(accruedInterest)}
          emphasis={accruedInterest > 0 ? "warning" : "default"}
          hint="Display only — no se cobra automáticamente"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-h4 text-foreground">Saldos por cliente</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                Cliente
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                Saldo
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                Línea de crédito
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                Crédito usado
              </TableHead>
              <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                Disponible
              </TableHead>
              <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                Mora
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => {
              const balance = balanceByTenant.get(tenant.id) ?? 0;
              const line = creditLines.find((l) => l.tenant_id === tenant.id);
              const tenantCharges = pendingCharges.filter(
                (c) => c.tenant_id === tenant.id
              );
              const oldestDays = tenantCharges.reduce(
                (max, c) => Math.max(max, daysOutstanding(c)),
                0
              );
              const usedByCharges = round2(
                tenantCharges.reduce((acc, c) => acc + Number(c.amount), 0)
              );

              return (
                <TableRow key={tenant.id} className="border-border">
                  <TableCell className="text-body-s font-semibold text-foreground">
                    {tenant.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 text-body-s tabular-nums ${
                        balance < 0 ? "font-semibold text-foreground" : "text-foreground"
                      }`}
                    >
                      {balance < 0 && (
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {balance < 0 ? "−" : ""}
                      {formatMXN(Math.abs(balance))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {line ? formatMXN(Number(line.approved_limit)) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {line || usedByCharges > 0 ? formatMXN(usedByCharges) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {line
                      ? formatMXN(Number(line.approved_limit) - usedByCharges)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {oldestDays > 90 ? (
                      <Badge className="border-transparent bg-card font-medium text-foreground">
                        <AlertCircle className="mr-1 h-3 w-3" aria-hidden />
                        Suspender · {oldestDays}d
                      </Badge>
                    ) : oldestDays > 30 ? (
                      <span className="inline-flex items-center gap-1 text-caption font-semibold text-foreground">
                        <AlertCircle className="h-3 w-3" aria-hidden />
                        {oldestDays}d
                      </span>
                    ) : (
                      <span className="text-caption text-foreground/75">
                        {oldestDays > 0 ? `${oldestDays}d` : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-h4 text-foreground">Cartera vencida</h2>
        {overdueCharges.length === 0 ? (
          <p className="text-body-s text-foreground/75">Sin cartera vencida.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                  Cargo
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Monto
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Días
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Interés acumulado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueCharges.map(({ charge, days }) => (
                <TableRow key={charge.id} className="border-border">
                  <TableCell className="text-body-s font-semibold text-foreground">
                    {tenantName.get(charge.tenant_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-caption tabular-nums text-foreground/75">
                    {charge.reference ?? charge.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right text-body-s font-semibold tabular-nums text-foreground">
                    {formatMXN(Number(charge.amount))}
                  </TableCell>
                  <TableCell className="text-right text-body-s font-semibold tabular-nums text-foreground">
                    {days}d
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {formatMXN(calculateInterest(charge))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
