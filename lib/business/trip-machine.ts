/**
 * Máquina de estados del ciclo de vida de un trip — única fuente de verdad.
 *
 * Consumers: statusLabel (labels ES) y TRIP_MILESTONES (los 5 hitos que ve
 * el cliente en el riel del viaje). Las transiciones entre estados las
 * aplican las RPCs en Postgres; los guards de las server actions de OPS
 * viven en app/(ops)/ops/trips/actions.ts.
 */
type TripStatus =
  | "pending_quote"
  | "options_sent"
  | "awaiting_selection"
  | "awaiting_payment"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "refunded";

const STATUS_LABELS: Record<TripStatus, string> = {
  pending_quote: "En cotización",
  options_sent: "Opciones enviadas",
  awaiting_selection: "Selecciona una opción",
  awaiting_payment: "Pendiente de pago",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

/** Label en español para un status arbitrario; desconocidos → el valor crudo. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TripStatus] ?? status;
}

/**
 * Hitos del ciclo de vida que ve el cliente, en orden — consumidos por el
 * riel del viaje (components/trips/trip-rail.tsx). No duplicar: el riel
 * deriva su estado actual de esta secuencia.
 */
export const TRIP_MILESTONES = [
  { status: "pending_quote", label: "Solicitud", hint: "Operaciones está cotizando tu viaje." },
  { status: "options_sent", label: "Opciones", hint: "Recibiste opciones; compara y elige." },
  { status: "awaiting_selection", label: "Selección", hint: "Elige la opción que prefieras." },
  { status: "awaiting_payment", label: "Pago", hint: "Fondea tu billetera o espera tu crédito." },
  { status: "confirmed", label: "Viaje", hint: "Reservado. Los vouchers llegan por correo." },
] as const;
