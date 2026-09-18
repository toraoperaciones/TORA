"use client";

import { cn } from "@/lib/utils";

/**
 * Donut TORA — SVG puro con stroke-dasharray. Categorías diferenciadas
 * por opacidad de navy (profundidad sin cromatismo); forest solo para
 * "mixed"/otros cuando hay dinero en juego. Centro: total del mes.
 */

export interface DonutSlice {
  label: string;
  value: number;
}

const COLORS = [
  "rgb(245 245 240 / 0.85)",
  "rgb(245 245 240 / 0.55)",
  "rgb(245 245 240 / 0.32)",
  "rgb(245 245 240 / 0.18)",
];

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
  const R = 34;
  const C = 2 * Math.PI * R;

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * C;
    const el = (
      <circle
        key={s.label}
        cx="45"
        cy="45"
        r={R}
        fill="none"
        stroke={COLORS[i % COLORS.length]}
        strokeWidth={10}
        strokeDasharray={`${Math.max(dash - 1.5, 0.5)} ${C - Math.max(dash - 1.5, 0.5)}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 45 45)"
        strokeLinecap="butt"
      />
    );
    offset += dash;
    return el;
  });

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative h-[90px] w-[90px] shrink-0">
        <svg width={90} height={90} viewBox="0 0 90 90" aria-hidden>
          <circle
            cx="45"
            cy="45"
            r={R}
            fill="none"
            stroke="var(--color-layer-2)"
            strokeWidth={10}
          />
          {arcs}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-caption font-semibold tabular-nums text-text-secondary">
          {centerLabel}
        </span>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center gap-2.5 text-body-s text-text-secondary"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 truncate">{LABELS[s.label] ?? s.label}</span>
            <span className="tabular-nums text-text-tertiary">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
