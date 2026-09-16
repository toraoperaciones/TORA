/**
 * TORA Design System — tokens de color como constantes TypeScript.
 * Fuente de verdad paralela a `app/globals.css` (@theme), para contextos
 * que no pueden leer CSS: charts, SVG inline, canvas, emails, etc.
 *
 * IMPORTANTE: mantener en sync con el bloque @theme de globals.css.
 * No añadir colores fuera del design system.
 */

export const colors = {
  navy: "#1A2B4A",
  navyHover: "#152340",
  navyActive: "#0F1A33",
  offwhite: "#F5F5F0",
  graphite: "#4A4A4A",
  forest: "#2E7D5B",
  forestHover: "#266A4D",
  surface: "#FFFFFF",
} as const;

/** Bordes y texto con opacidad, expresados en rgba para canvas/SVG. */
export const alphaColors = {
  borderSubtle: "rgba(26, 43, 74, 0.08)",
  borderDefault: "rgba(26, 43, 74, 0.16)",
  textMuted: "rgba(74, 74, 74, 0.6)",
} as const;

/** Paleta para charts: primario, secundario, éxito y neutros del sistema. */
export const chartPalette = {
  primary: colors.navy,
  primaryHover: colors.navyHover,
  secondary: colors.graphite,
  success: colors.forest,
  successHover: colors.forestHover,
  surface: colors.surface,
  canvas: colors.offwhite,
  grid: alphaColors.borderSubtle,
  axisText: colors.graphite,
} as const;

/** Radios y sombras del sistema (para CSS-in-JS puntual, emails, PDFs). */
export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
} as const;

export const shadows = {
  xs: "0 1px 2px rgb(26 43 74 / 0.04)",
  sm: "0 2px 4px rgb(26 43 74 / 0.06)",
  md: "0 4px 12px rgb(26 43 74 / 0.08)",
  lg: "0 12px 32px rgb(26 43 74 / 0.10)",
  xl: "0 24px 64px rgb(26 43 74 / 0.12)",
} as const;

export type ToraColorToken = keyof typeof colors;
