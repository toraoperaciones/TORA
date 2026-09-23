/**
 * Reglas de auto-priorización del CEO (Sprint 5): la severidad NO es
 * manual — se deriva del tipo y detalles del incidente. Dueño único de
 * la regla: el dialog la muestra en vivo y la action la aplica en BD.
 * Módulo isomórfico (sin server-only): calculateSeverity es una función
 * pura sin secretos, usada tanto en cliente como en server.
 */
export type IncidentType =
  | "flight_cancelled"
  | "flight_delay"
  | "hotel_issue"
  | "car_issue"
  | "billing_issue"
  | "other";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface IncidentInput {
  type: IncidentType;
  delayHours?: number; // solo flight_delay
  checkInDenied?: boolean; // solo hotel_issue
}

export function calculateSeverity(input: IncidentInput): IncidentSeverity {
  switch (input.type) {
    case "flight_cancelled":
      return "critical";
    case "flight_delay":
      return (input.delayHours ?? 0) > 2 ? "high" : "medium";
    case "hotel_issue":
      return input.checkInDenied ? "high" : "medium";
    case "car_issue":
      return "medium";
    case "billing_issue":
      return "low";
    case "other":
      return "low";
    default:
      return "low";
  }
}

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const SEVERITY_ORDER_SQL = `
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END
`.trim();
