/**
 * Cálculos de crédito (display only — el interés nunca se cobra
 * automáticamente en el MVP; solo se muestra en el portal FINANCE).
 */

export interface CreditLine {
  id: string;
  tenant_id: string;
  approved_limit: number;
  used_amount: number;
  interest_rate: number;
  status: "active" | "suspended" | "closed";
}

export interface PendingCharge {
  id: string;
  amount: number;
  created_at: string;
  validated_at: string | null;
}

export function creditAvailable(line: CreditLine | null): number {
  if (!line) return 0;
  return Number(line.approved_limit) - Number(line.used_amount);
}

/** Días transcurridos desde la validación (o creación) del charge. */
export function daysOutstanding(charge: PendingCharge): number {
  const since = charge.validated_at ?? charge.created_at;
  const diffMs = Date.now() - new Date(since).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

/**
 * Interés por mora (display only):
 *   days <= 30      → 0
 *   31 <= days <= 60 → amount * 0.025 * ((days - 30) / 30)
 *   days > 60        → amount * 0.035 * ((days - 60) / 30) + amount * 0.025
 */
export function calculateInterest(charge: PendingCharge): number {
  const days = daysOutstanding(charge);
  const amount = Number(charge.amount);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (days <= 30) return 0;

  if (days <= 60) {
    return round2(amount * 0.025 * ((days - 30) / 30));
  }

  return round2(amount * 0.035 * ((days - 60) / 30) + amount * 0.025);
}

export function totalInterest(charges: PendingCharge[]): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return round2(charges.reduce((acc, charge) => acc + calculateInterest(charge), 0));
}
