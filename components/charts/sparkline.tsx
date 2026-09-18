"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

/**
 * Sparkline recharts — micro-tendencia dentro de las KPI cards.
 * `tone="money"` traza con primary (solo métricas de dinero); el resto
 * hereda el color del contenedor.
 */
export function Sparkline({
  points,
  tone = "inherit",
  className,
}: {
  points: number[];
  tone?: "money" | "inherit";
  className?: string;
}) {
  const data = points.map((y, i) => ({ x: i, y }));
  const stroke = tone === "money" ? "var(--primary)" : "currentColor";

  return (
    <div
      className={cn("h-10 w-full", className)}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.5}
            fill={stroke}
            fillOpacity={0.1}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
