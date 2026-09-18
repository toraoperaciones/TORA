import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Button TORA — "el estándar silencioso".
 * primary = CTA que invierte con el tema; danger NO es rojo:
 * es borde + bold, el lenguaje de advertencia del sistema.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-display font-semibold whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-cta text-cta-foreground hover:bg-cta/90 active:bg-cta/80",
        primary:
          "bg-cta text-cta-foreground hover:bg-cta/90 active:bg-cta/80",
        secondary:
          "bg-transparent border border-border-default text-text-primary hover:bg-layer-2",
        outline:
          "bg-transparent border border-border-default text-text-primary hover:bg-layer-2 active:bg-layer-3",
        ghost:
          "text-text-secondary hover:bg-layer-2 hover:text-text-primary",
        success:
          "bg-forest text-offwhite hover:bg-forest-hover shadow-glow",
        danger:
          "bg-transparent border border-border-emphasis text-text-primary font-semibold hover:bg-layer-2",
        link: "text-text-primary underline underline-offset-4 hover:text-text-secondary",
      },
      size: {
        default: "h-10 px-4 text-body-m has-[>svg]:px-3",
        sm: "h-8 px-3 text-body-s has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-body-l has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
