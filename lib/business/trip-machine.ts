export type TripStatus =
  | "pending_quote"
  | "options_sent"
  | "awaiting_selection"
  | "awaiting_payment"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "refunded";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  pending_quote: "En cotización",
  options_sent: "Opciones enviadas",
  awaiting_selection: "Selecciona una opción",
  awaiting_payment: "Pendiente de pago",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

/** Transiciones válidas del ciclo de vida de un trip. */
const TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  pending_quote: ["options_sent", "cancelled"],
  options_sent: ["awaiting_selection", "cancelled"],
  awaiting_selection: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled", "refunded"],
  confirmed: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Label en español para un status arbitrario; desconocidos → el valor crudo. */
export function statusLabel(status: string): string {
  return TRIP_STATUS_LABEL[status as TripStatus] ?? status;
}

/**
 * Transiciones disponibles para OPS desde el portal de operaciones.
 * pending_quote    → guardar borrador (options_sent) o enviar directo.
 * options_sent     → enviar al cliente o regresar a cotización.
 * awaiting_selection → reabrir cotización.
 */
export const OPS_TRANSITIONS: Record<string, string[]> = {
  pending_quote: ["options_sent", "awaiting_selection"],
  options_sent: ["awaiting_selection", "pending_quote"],
  awaiting_selection: ["options_sent"],
};

export function canOpsTransition(from: string, to: string): boolean {
  return OPS_TRANSITIONS[from]?.includes(to) ?? false;
}
