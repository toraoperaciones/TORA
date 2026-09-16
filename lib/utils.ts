import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases condicionales y resuelve conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "symbol",
});

/**
 * Formatea un monto como moneda MXN para `es-MX`.
 * Los contenedores deben aplicar `tabular-nums` (regla del design system).
 *
 * @example formatMXN(1234.5) // "$1,234.50"
 */
export function formatMXN(amount: number): string {
  return mxnFormatter.format(amount);
}

const DATE_TZ = "America/Mexico_City";

/**
 * Formatea una fecha en español con timezone fija `America/Mexico_City`,
 * independiente del timezone del navegador (importante en servidor/cliente
 * para evitar hydration mismatch).
 *
 * @example formatDate(new Date()) // "16 de septiembre de 2026"
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DATE_TZ,
  }
): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-MX", options).format(value);
}
