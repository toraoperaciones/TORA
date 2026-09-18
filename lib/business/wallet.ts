import { cdmxDateStartIso, cdmxMonthStartIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Cálculos de billetera (server-only).
 * Regla de negocio (fuente de verdad):
 *   balance = SUM(deposit, completed) - SUM(charge, completed) + SUM(refund, completed)
 * Los montos llegan como string desde PostgREST (numeric); se normalizan a number.
 */

interface CompletedTx {
  type: string;
  amount: string;
}

async function fetchCompleted(tenantId: string): Promise<CompletedTx[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("type, amount")
    .eq("tenant_id", tenantId)
    .eq("status", "completed");

  if (error) throw new Error(`[getBalance] ${error.message}`);
  return (data ?? []) as CompletedTx[];
}

export async function getBalance(tenantId: string): Promise<number> {
  const rows = await fetchCompleted(tenantId);
  return rows.reduce((acc, row) => {
    const amount = Number(row.amount);
    if (row.type === "deposit" || row.type === "refund") return acc + amount;
    if (row.type === "charge") return acc - amount;
    return acc;
  }, 0);
}

/**
 * Suma de charges completados del mes calendario actual,
 * medido en America/Mexico_City (UTC-6, sin DST desde 2022).
 */
export async function getMonthlySpend(tenantId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("type", "charge")
    .eq("status", "completed")
    .gte("created_at", cdmxMonthStartIso());

  if (error) throw new Error(`[getMonthlySpend] ${error.message}`);
  return (data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
}

export interface WalletSeriesPoint {
  date: string; // YYYY-MM-DD (MX)
  amount: number;
}

/**
 * Serie diaria de charges completados (últimos N días, MX).
 * Para sparklines — fechas contiguas con 0 en días sin actividad.
 */
export async function getSpendSeries(
  tenantId: string,
  days = 14
): Promise<WalletSeriesPoint[]> {
  const supabase = await createClient();

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  const todayMX = new Date();
  const start = new Date(todayMX);
  start.setDate(start.getDate() - (days - 1));
  const seriesStart = cdmxDateStartIso(start);

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount, created_at")
    .eq("tenant_id", tenantId)
    .eq("type", "charge")
    .eq("status", "completed")
    .gte("created_at", seriesStart);

  if (error) throw new Error(`[getSpendSeries] ${error.message}`);

  const byDay = new Map<string, number>();
  for (const row of data ?? []) {
    const day = new Date(row.created_at as string).toLocaleDateString("en-CA", {
      timeZone: "America/Mexico_City",
    });
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.amount));
  }

  const points: WalletSeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = fmt(d);
    points.push({ date, amount: byDay.get(date) ?? 0 });
  }
  return points;
}

export interface SpendCategory {
  serviceType: string; // flight | hotel | car | stand | mixed
  total: number;
}

/**
 * Gasto del mes por categoría — datos REALES derivados de la BD:
 * charges (completed) del mes unidos a trips por la referencia
 * `TRIP-<id8>` que select_trip_options escribe en wallet_transactions.
 * Sin datos → lista vacía (el dashboard muestra empty state honesto).
 */
export async function getSpendByCategory(
  tenantId: string
): Promise<SpendCategory[]> {
  const supabase = await createClient();

  const [chargesRes, tripsRes] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("amount, reference")
      .eq("tenant_id", tenantId)
      .eq("type", "charge")
      .eq("status", "completed")
      .gte("created_at", cdmxMonthStartIso()),
    supabase.from("trips").select("id, service_type"),
  ]);

  if (chargesRes.error)
    throw new Error(`[getSpendByCategory] ${chargesRes.error.message}`);

  const serviceById = new Map<string, string>();
  for (const trip of tripsRes.data ?? []) {
    serviceById.set((trip as { id: string }).id.slice(0, 8), (trip as { service_type: string }).service_type);
  }

  const totals = new Map<string, number>();
  for (const charge of (chargesRes.data ?? []) as Array<{
    amount: string;
    reference: string | null;
  }>) {
    const ref = charge.reference ?? "";
    const tripId8 = ref.startsWith("TRIP-") ? ref.slice(5) : "";
    const serviceType =
      (tripId8 && serviceById.get(tripId8)) || "mixed";
    totals.set(serviceType, (totals.get(serviceType) ?? 0) + Number(charge.amount));
  }

  return [...totals.entries()]
    .map(([serviceType, total]) => ({ serviceType, total }))
    .sort((a, b) => b.total - a.total);
}
