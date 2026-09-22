/**
 * Constantes y tipos del modelo de pago — client-safe (cero imports de
 * servidor). Las funciones de negocio viven en payment-methods.ts.
 */

export type PaymentMethod = "cash" | "prepaid" | "credit";

/** Etiqueta ES del método de pago (badges y cards). */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Contado",
  prepaid: "Prepago",
  credit: "Crédito",
};

/** Referencia SPEI de un trip: primeros 8 chars del id. */
export function speiReference(tripId: string): string {
  return tripId.slice(0, 8);
}
