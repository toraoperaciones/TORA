import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/business/trip-machine";
import { cn } from "@/lib/utils";

/**
 * Badge de estado de trip.
 * Solo 3 variantes del sistema: neutral (borde), muted (gris), success (forest
 * exclusivo para estados de éxito/confirmación). Nunca rojo para cancelado.
 */
const STATUS_VARIANT: Record<string, { className: string }> = {
  pending_quote: { className: "border-border-default bg-transparent text-navy" },
  options_sent: { className: "border-border-default bg-transparent text-navy" },
  awaiting_selection: { className: "border-border-default bg-surface text-navy font-semibold" },
  awaiting_payment: { className: "border-transparent bg-[rgba(26,43,74,0.08)] text-navy" },
  confirmed: { className: "border-transparent bg-forest text-offwhite" },
  completed: { className: "border-transparent bg-[rgba(26,43,74,0.08)] text-navy" },
  cancelled: { className: "border-border-default bg-transparent text-graphite" },
  refunded: { className: "border-border-default bg-transparent text-graphite" },
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? {
    className: "border-border-default bg-transparent text-navy",
  };
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap font-medium", variant.className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
