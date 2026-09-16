export type ServiceType = "flight" | "hotel" | "car" | "stand" | "mixed";

export interface TenantMarkups {
  markup_flights: number;
  markup_hotels: number;
  markup_cars: number;
  markup_stands: number;
}

/** Markup genérico para trips `mixed` (promedio de servicios). */
export const MIXED_FALLBACK_MARKUP = 0.08;

/** Margen mínimo saludable (%) — debajo se considera probable error de captura. */
export const MIN_HEALTHY_MARGIN_PCT = 3;

export function markupFor(tenant: TenantMarkups, service: ServiceType): number {
  switch (service) {
    case "flight":
      return Number(tenant.markup_flights);
    case "hotel":
      return Number(tenant.markup_hotels);
    case "car":
      return Number(tenant.markup_cars);
    case "stand":
      return Number(tenant.markup_stands);
    case "mixed":
      return MIXED_FALLBACK_MARKUP;
  }
}

/** final_price = net_price * (1 + markup), redondeado a 2 decimales. */
export function calculateFinalPrice(netPrice: number, markup: number): number {
  return Math.round(netPrice * (1 + markup) * 100) / 100;
}

/** Margen como porcentaje del precio neto. */
export function marginPercent(netPrice: number, finalPrice: number): number {
  if (netPrice <= 0) return 0;
  return ((finalPrice - netPrice) / netPrice) * 100;
}

/** true si el margen ≥ 3% (warning del Quote Builder por debajo). */
export function isMarginHealthy(netPrice: number, finalPrice: number): boolean {
  return marginPercent(netPrice, finalPrice) >= MIN_HEALTHY_MARGIN_PCT;
}
