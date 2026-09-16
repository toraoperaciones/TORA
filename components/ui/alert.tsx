import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Alert informativo del design system: Navy sobre surface, sin rojo.
 * Solo variante default — los errores usan toast + peso tipográfico.
 */
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-body-s [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg]:text-navy",
  {
    variants: {
      variant: {
        default: "border-border-subtle bg-surface text-navy",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("mb-1 font-semibold leading-none", className)} {...props} />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-graphite", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
