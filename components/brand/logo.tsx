// TODO: Reemplazar por /brand/tora-symbol.svg cuando esté disponible
// (ver "Notas de implementación" al final del archivo).

import { cn } from "@/lib/utils";

type LogoVariant = "primary" | "inverse" | "mono";
type LogoSize = "sm" | "md" | "lg" | "xl";

const SYMBOL_PX: Record<LogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 64,
};

/** Tamaño del wordmark siguiendo la escala tipográfica del sistema. */
const WORDMARK_TEXT: Record<LogoSize, string> = {
  sm: "text-body-s",
  md: "text-body-m",
  lg: "text-h4",
  xl: "text-h2",
};

const WORDMARK_COLOR: Record<LogoVariant, string> = {
  primary: "text-navy",
  inverse: "text-offwhite",
  // El brand book define `mono` como negro sobre blanco (uso impreso/PDF).
  // Es la única excepción permitida a la regla "el negro del sistema es Navy".
  mono: "text-black",
};

/**
 * Símbolo TORA — 4 curvas paralelas (pistas de aterrizaje / movimiento).
 * SVG inline aproximado mientras llegan los vectoriales oficiales.
 */
export function ToraSymbol({
  size = "md",
  variant = "primary",
  className,
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
}) {
  const px = SYMBOL_PX[size];
  const stroke =
    variant === "inverse" ? "var(--color-offwhite)" : "var(--color-navy)";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="TORA"
      className={cn("shrink-0", className)}
    >
      {/* 4 curvas paralelas que insinúan una T en movimiento */}
      <path
        d="M6 8c7 0 14 0 20 0"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path
        d="M9 14c5.5 0 11 0 16 0"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path
        d="M9 20c5 0 10 0 15 0"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path
        d="M9 26c4.5 0 9 0 13.5 0"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  withSymbol?: boolean;
  withWordmark?: boolean;
  className?: string;
}

/**
 * Lockup oficial de marca: símbolo + wordmark.
 * El wordmark respeta el brand book: Space Grotesk, uppercase,
 * tracking 0.14em, bold. La variante `mono` es negra por definición
 * del brand book (impresos); en UI usar `primary` o `inverse`.
 */
export function Logo({
  variant = "primary",
  size = "md",
  withSymbol = true,
  withWordmark = true,
  className,
}: LogoProps) {
  if (!withSymbol && !withWordmark) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center",
        size === "sm" ? "gap-1.5" : "gap-2",
        className
      )}
    >
      {withSymbol && <ToraSymbol size={size} variant={variant} />}
      {withWordmark && (
        <span
          className={cn(
            "font-display font-bold uppercase tracking-[0.14em] leading-none",
            WORDMARK_TEXT[size],
            WORDMARK_COLOR[variant]
          )}
        >
          TORA
        </span>
      )}
    </span>
  );
}

/*
 * Notas de implementación
 * ───────────────────────
 * Cuando el símbolo vectorial oficial esté en /public/brand/tora-symbol.svg,
 * sustituir el <svg> dentro de ToraSymbol por:
 *
 *   <Image src={`/brand/tora-symbol-${variant}.svg`} width={px} height={px} alt="TORA" />
 *
 * El resto del lockup (wordmark, espaciados, variantes) no cambia:
 * ToraSymbol es la única pieza que encapsula el arte del símbolo.
 */
