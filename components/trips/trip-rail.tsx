import { TRIP_MILESTONES } from "@/lib/business/trip-machine";
import { cn } from "@/lib/utils";

/**
 * Riel del viaje — la firma visual de TORA. Consume los hitos de la máquina
 * de estados real (lib/business/trip-machine.ts): Solicitud → Opciones →
 * Selección → Pago → Viaje. Server Component: cero JS, cero motion.
 *
 * El nodo "Viaje" lleva forest solo cuando el dinero ya se liquidó
 * (confirmed/completed) — regla de marca: verde = dinero en juego.
 * cancelled/refunded rompen el riel y vuelven al mensaje honesto.
 */

/** La única pareja de estados donde el dinero ya se liquidó. */
const SETTLED = new Set(["confirmed", "completed"]);

export function TripRail({
  status,
  departureDate,
}: {
  status: string;
  departureDate: string;
}) {
  const current = TRIP_MILESTONES.findIndex((m) => m.status === status);

  // Estados terminales fuera del flujo: el riel no aplica; mensaje directo.
  if (current === -1) {
    return (
      <p className="text-body-s text-text-secondary">
        {status === "cancelled"
          ? "Este viaje se canceló. Si necesitas algo similar, solicita uno nuevo."
          : "El cargo de este viaje fue reembolsado a tu billetera."}
      </p>
    );
  }

  const settled = SETTLED.has(status);

  return (
    <ol className="flex flex-col">
      {TRIP_MILESTONES.map((milestone, i) => {
        const done = i < current;
        const active = i === current;
        const isViaje = i === TRIP_MILESTONES.length - 1;
        // Forest solo en el hito final con dinero liquidado.
        const money = isViaje && settled;
        return (
          <li
            key={milestone.status}
            className={cn("relative flex gap-3 pb-5", isViaje && "pb-0")}
          >
            {i < TRIP_MILESTONES.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[5px] top-4 h-full w-px",
                  done || active ? "bg-layer-5" : "bg-border-subtle"
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border",
                done && "border-offwhite bg-offwhite",
                active && "border-offwhite ring-2 ring-offwhite/30",
                !done && !active && "border-border-strong bg-transparent",
                money && "border-forest bg-forest ring-2 ring-forest/25"
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-body-s font-medium",
                  (done || active) && "text-text-primary",
                  !done && !active && "text-text-tertiary",
                  money && "text-forest"
                )}
              >
                {milestone.label}
                {active && (
                  <span className="ml-2 font-mono text-caption text-text-tertiary">
                    {isViaje ? departureDate : "en curso"}
                  </span>
                )}
              </p>
              {active && (
                <p className="mt-0.5 text-caption text-text-secondary">{milestone.hint}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
