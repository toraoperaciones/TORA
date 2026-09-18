import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input TORA — pozo bg-navy-active, focus con borde que gana presencia
 * (no color). Errores: offwhite + bold + AlertCircle (nunca rojo).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-border-default bg-navy-active px-3 py-1 text-body-m text-text-primary transition-colors duration-150",
        "placeholder:text-text-muted",
        "focus:border-border-emphasis focus:outline-none focus:ring-2 focus:ring-layer-3",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-border-emphasis",
        "file:h-7 file:border-0 file:bg-transparent file:text-body-s file:font-medium",
        className
      )}
      {...props}
    />
  );
}

export { Input };
