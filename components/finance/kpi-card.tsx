import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "default" | "positive" | "warning";
}

/**
 * KPI del dashboard financiero.
 * positive SOLO para métricas de éxito/margen; warning mantiene Navy
 * con icono (nunca rojo).
 */
export function KpiCard({ label, value, hint, emphasis = "default" }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-caption uppercase tracking-wider text-foreground/75">{label}</p>
      <p
        className={cn(
          "mt-2 flex items-center gap-1.5 font-display text-h2 tabular-nums",
          emphasis === "positive" ? "text-primary" : "text-foreground",
          emphasis === "warning" && "font-semibold"
        )}
      >
        {emphasis === "warning" && (
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {value}
      </p>
      {hint && <p className="mt-1 text-caption text-foreground/75">{hint}</p>}
    </div>
  );
}
