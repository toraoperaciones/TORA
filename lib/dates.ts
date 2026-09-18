/**
 * "Hoy" en zona CDMX — dueño único del límite del día.
 * México City abolió el horario de verano (2022): offset fijo -06:00 por ley,
 * por lo que el cálculo es estable sin librería de zonas.
 */
export function cdmxDayStartIso(): string {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
  return `${today}T00:00:00-06:00`;
}
