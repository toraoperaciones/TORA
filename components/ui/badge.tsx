import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Badge TORA — sin rojo. neutral/warning = opacidad + peso;
 * success = forest (solo estados con dinero confirmado).
 * Los Badges montados en la app usan los presets de status-badge.
 */
const BADGE_STYLES = {
  neutral: "bg-layer-3 text-text-secondary border border-border-subtle",
  success: "bg-forest/10 text-forest border border-forest/20",
  warning: "bg-layer-2 text-text-primary font-semibold border border-border-default",
  muted: "bg-layer-1 text-text-tertiary border border-transparent",
  outline: "bg-transparent text-text-secondary border border-border-default",
  secondary: "bg-layer-3 text-text-secondary border border-border-subtle",
} as const;

type BadgeTone = keyof typeof BADGE_STYLES;

function Badge({
  className,
  variant = "neutral",
  dot = false,
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeTone; dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap",
        BADGE_STYLES[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {props.children}
    </span>
  );
}

export { Badge, type BadgeTone };
