"use client";

import { useCountUp } from "@/lib/hooks/use-count-up";
import { cn, formatMXN } from "@/lib/utils";

import { Sparkline } from "@/components/charts/sparkline";

/**
 * MoneyHero — dueño único del patrón "dinero en juego": borde forest,
 * glow y cifra display. Tres escalas explícitas (sin booleanos):
 * - "m": card compacta (billetera)            → display-m, p-6
 * - "l": hero de sección (deposits FINANCE)   → display-l, p-8
 * - "xl": hero de página (dashboard CLIENT)   → display-xl, p-8
 * `animated` cuenta de 0 al valor al montar (600ms, respeta reduced-motion);
 * en server pages puros pásala en false para cifra estática.
 */
export function MoneyHero({
  label,
  amount,
  scale,
  sparkline,
  animated = true,
  className,
  children,
}: {
  label: string;
  amount: number;
  scale: "m" | "l" | "xl";
  sparkline?: number[];
  animated?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const shown = useCountUp(animated ? amount : 0);
  const value = animated ? shown : amount;

  return (
    <div
      data-money
      className={cn(
        "rounded-lg border border-primary/20 bg-card shadow-lg shadow-ring/25",
        scale === "m" ? "p-6" : "p-8",
        className
      )}
    >
      <p className="text-caption uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display tabular-nums text-foreground",
          scale === "m" && "text-display-m",
          scale === "l" && "text-display-l",
          scale === "xl" && "text-display-xl"
        )}
      >
        {formatMXN(value)}
      </p>
      {sparkline && sparkline.length >= 2 ? (
        <div
          className={cn(
            "text-primary",
            scale === "m" ? "mt-3" : "mt-5",
            scale === "m" ? "h-6" : "h-8"
          )}
        >
          <Sparkline points={sparkline} tone="money" />
        </div>
      ) : null}
      {children}
    </div>
  );
}
