import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/business/trip-machine";
import { cn } from "@/lib/utils";

/**
 * Badge de estado de trip — lenguaje monocromático del preset:
 * `default` (sólido) exclusivo para confirmed: estado con dinero liquidado.
 * Nunca rojo para cancelado; destructive es solo para errores críticos.
 */
type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_VARIANT: Record<string, { variant: BadgeVariant; className?: string }> = {
  pending_quote: { variant: "outline" },
  options_sent: { variant: "outline" },
  awaiting_selection: { variant: "muted" },
  awaiting_payment: { variant: "secondary" },
  confirmed: { variant: "default" },
  completed: { variant: "muted" },
  cancelled: {
    variant: "outline",
    className: "text-muted-foreground",
  },
  refunded: {
    variant: "outline",
    className: "text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const match = STATUS_VARIANT[status] ?? { variant: "outline" as BadgeVariant };
  return (
    <Badge
      variant={match.variant}
      className={cn("whitespace-nowrap font-medium", match.className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
