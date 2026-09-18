import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Logo TORA — assets oficiales PNG (con canal alfa) en /public/brand/.
 * - theme="light": trazo blanco para fondos oscuros (brightness(0) invert).
 * - theme="dark": PNG negro tal cual, para fondos claros e impresos.
 * Cuando lleguen los SVG oficiales: reemplazar src en BRAND_ASSETS.
 */

export type LogoVariant = "lockup" | "symbol";
export type LogoTheme = "light" | "dark";
export type LogoSize = "sm" | "md" | "lg" | "xl";

const SYMBOL_PX: Record<LogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 64,
};

const WORDMARK_TEXT: Record<LogoSize, string> = {
  sm: "text-body-s",
  md: "text-body-m",
  lg: "text-h4",
  xl: "text-h2",
};

const BRAND_ASSETS = {
  symbol: "/brand/tora-simbolo-negro.png",
  lockup: "/brand/tora-lockup-negro.png",
} as const;

export function Logo({
  variant = "lockup",
  theme = "dark",
  size = "md",
  withWordmark = true,
  className,
}: {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  withWordmark?: boolean;
  className?: string;
}) {
  const px = SYMBOL_PX[size];
  // Aspecto del asset: 1537×1023 ≈ 3:2
  const lockupWidth = Math.round(px * 1.5);

  return (
    <span
      className={cn(
        "inline-flex items-center",
        variant === "lockup" && size !== "sm" && "gap-2",
        className
      )}
    >
      <Image
        src={BRAND_ASSETS[variant]}
        alt="TORA"
        width={variant === "lockup" ? lockupWidth : px}
        height={px}
        priority
        className={cn(
          "shrink-0",
          theme === "light" && "brightness-0 invert"
        )}
      />
      {variant === "symbol" && withWordmark && (
        <span
          className={cn(
            "font-display font-bold uppercase tracking-[0.14em] leading-none",
            WORDMARK_TEXT[size],
            theme === "light" ? "text-foreground" : "text-foreground"
          )}
        >
          TORA
        </span>
      )}
    </span>
  );
}
