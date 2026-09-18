"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

/**
 * Donut recharts — gasto por categoría. Rampa monocromática --chart-1..5
 * del preset (opacidad creciente = profundidad sin cromatismo).
 * Centro: total del mes, provisto por el consumer.
 */

export interface DonutSlice {
  label: string;
  value: number;
}

const LABELS: Record<string, string> = {
  flight: "Vuelos",
  hotel: "Hoteles",
  car: "Autos",
  stand: "Stands",
  mixed: "Mixto",
};

interface SpendDonutProps {
  slices: DonutSlice[];
  centerLabel: string;
  className?: string;
}

export function SpendDonut({ slices, centerLabel, className }: SpendDonutProps) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const data = slices.map((s) => ({ name: LABELS[s.label] ?? s.label, value: s.value }));
  const ramp = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative h-[90px] w-[90px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={27}
              outerRadius={42}
              paddingAngle={2}
              strokeWidth={0}
              aria-hidden
            >
              {data.map((_, i) => (
                <Cell key={i} fill={ramp[i % ramp.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-caption font-semibold tabular-nums text-foreground/75">
          {centerLabel}
        </span>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center gap-2.5 text-body-s text-foreground/75"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ramp[i % ramp.length] }}
            />
            <span className="flex-1 truncate">{LABELS[s.label] ?? s.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
