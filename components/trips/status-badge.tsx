import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/components/ui/badge";
import { statusLabel } from "@/lib/business/trip-machine";
import { cn } from "@/lib/utils";

/**
 * Badge de estado de trip — tokens del sistema, sin colores hardcodeados.
 * success (forest) exclusivo para confirmed: estado con dinero liquidado.
 * Nunca rojo para cancelado.
 */
const STATUS_VARIANT: Record<string, { tone: BadgeTone; className?: string }> = {
  pending_quote: { tone: "outline" },
  options_sent: { tone: "outline" },
  awaiting_selection: {
    tone: "warning",
    className: "bg-layer-3",
  },
  awaiting_payment: { tone: "muted" },
  confirmed: {
    tone: "success",
    className: "border-transparent bg-forest text-offwhite",
  },
  completed: { tone: "muted" },
  cancelled: {
    tone: "outline",
    className: "text-text-tertiary",
  },
  refunded: {
    tone: "outline",
    className: "text-text-tertiary",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? { tone: "outline" as BadgeTone };
  return (
    <Badge
      variant={variant.tone}
      className={cn("whitespace-nowrap font-medium", variant.className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
