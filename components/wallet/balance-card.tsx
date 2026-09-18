"use client";

import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn, formatMXN } from "@/lib/utils";

import { Sparkline } from "@/components/charts/sparkline";

/**
 * KPI de dinero (saldo, SPEI, crédito). Forest + glow: dinero en juego.
 * El número cuenta de 0 al valor real (600ms, respeta reduced-motion).
 * `hero` activa el tratamiento display-xl del dashboard (jerarquía nivel 1).
 */
export function BalanceCard({
  balance,
  label = "Saldo disponible",
  sparkline,
  hero = false,
  className,
}: {
  balance: number;
  label?: string;
  sparkline?: number[];
  hero?: boolean;
  className?: string;
}) {
  const animated = useCountUp(balance);

  return (
    <div
      data-money
      className={cn(
        "rounded-lg border border-forest/20 bg-navy-lift shadow-glow",
        hero ? "p-8" : "p-6",
        className
      )}
    >
      <p className="text-caption uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display tabular-nums text-text-primary",
          hero
            ? "text-display-xl"
            : "text-display-m"
        )}
      >
        {formatMXN(animated)}
      </p>
      {sparkline && sparkline.length >= 2 ? (
        <div className={cn("text-forest", hero ? "mt-5" : "mt-3")}>
          <Sparkline points={sparkline} tone="money" width={hero ? 120 : 60} height={hero ? 32 : 24} />
        </div>
      ) : null}
    </div>
  );
}
