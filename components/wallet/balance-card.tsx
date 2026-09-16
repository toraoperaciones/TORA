import { formatMXN } from "@/lib/utils";

/**
 * KPI de saldo reutilizado en /dashboard y /wallet.
 * Todo monto monetario usa tabular-nums (regla del design system).
 */
export function BalanceCard({
  balance,
  label = "Saldo disponible",
}: {
  balance: number;
  label?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6">
      <p className="text-caption uppercase tracking-wider text-graphite">
        {label}
      </p>
      <p className="mt-2 font-display text-display-m tabular-nums text-navy">
        {formatMXN(balance)}
      </p>
    </div>
  );
}
