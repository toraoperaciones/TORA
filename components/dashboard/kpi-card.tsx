"use client";

import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn, formatMXN } from "@/lib/utils";

import { Sparkline } from "@/components/charts/sparkline";

/**
 * KPI genérico (gasto del mes, próximos viajes). Sin acento forest:
 * solo el saldo y el dinero liquidado lo llevan.
 */
export function KpiCard({
  label,
  value,
  sparkline,
  isMoney = false,
  className,
}: {
  label: string;
  value: number;
  sparkline?: number[];
  isMoney?: boolean;
  className?: string;
}) {
  const animated = useCountUp(value);

  return (
    <div
      data-metric
      className={cn(
        "rounded-lg border border-border-subtle bg-navy-lift p-6",
        className
      )}
    >
      <p className="text-caption uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 font-display text-display-m tabular-nums text-text-primary">
        {isMoney ? formatMXN(animated) : Math.round(animated).toString()}
      </p>
      {sparkline && sparkline.length >= 2 ? (
        <div className="mt-3 text-text-secondary">
          <Sparkline points={sparkline} tone={isMoney ? "money" : "navy"} />
        </div>
      ) : null}
    </div>
  );
}
