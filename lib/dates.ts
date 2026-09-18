/**
 * Límites de fecha en zona CDMX — dueño único. Todos devuelven el ISO
 * completo con offset: los filtros `.gte()` los consumen tal cual, SIN
 * concatenar offset.
 *
 * México City abolió el horario de verano (2022): offset fijo -06:00 por ley,
 * por lo que el cálculo es estable sin librería de zonas.
 */
export function cdmxDateStartIso(date: Date = new Date()): string {
  const day = date.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  return `${day}T00:00:00-06:00`;
}

/** Inicio del día de hoy en CDMX. */
export function cdmxDayStartIso(): string {
  return cdmxDateStartIso();
}

/** Inicio del mes actual en CDMX. */
export function cdmxMonthStartIso(): string {
  const [year, month] = cdmxDayStartIso().slice(0, 10).split("-");
  return `${year}-${month}-01T00:00:00-06:00`;
}
