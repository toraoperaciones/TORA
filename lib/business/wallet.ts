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

  const todayMX = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
  const [year, month] = todayMX.split("-");
  const monthStartISO = `${year}-${month}-01T00:00:00-06:00`;

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("type", "charge")
    .eq("status", "completed")
    .gte("created_at", monthStartISO);

  if (error) throw new Error(`[getMonthlySpend] ${error.message}`);
  return (data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
}
