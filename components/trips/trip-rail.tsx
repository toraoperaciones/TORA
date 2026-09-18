import { cn } from "@/lib/utils";

/**
 * Riel del viaje — la firma visual de TORA. Traduce la máquina de estados
 * real (lib/business/trip-machine.ts) a una secuencia de 5 hitos:
 * Solicitud → Opciones → Selección → Pago → Viaje.
 *
 * Server Component: cero JS, cero motion — la estructura ES la información.
 * El nodo "Viaje" lleva forest solo cuando el dinero ya se liquidó
 * (confirmed/completed) — regla de marca: verde = dinero en juego.
 * cancelled/refunded rompen el riel y vuelven al mensaje honesto.
 */

interface Step {
  label: string;
  hint: string;
}

const STEPS: Step[] = [
  { label: "Solicitud", hint: "Operaciones está cotizando tu viaje." },
  { label: "Opciones", hint: "Recibiste opciones; compara y elige." },
  { label: "Selección", hint: "Elige la opción que prefieras." },
  { label: "Pago", hint: "Fondea tu billetera o espera tu crédito." },
  { label: "Viaje", hint: "Reservado. Los vouchers llegan por correo." },
];

/** Estado de máquina → índice del hito alcanzado. */
const STATUS_STEP: Record<string, number> = {
  pending_quote: 0,
  options_sent: 1,
  awaiting_selection: 2,
  awaiting_payment: 3,
  confirmed: 4,
  completed: 4,
};

/** La única pareja de estados donde el dinero ya se liquidó. */
const SETTLED = new Set(["confirmed", "completed"]);

export function TripRail({
  status,
  departureDate,
}: {
  status: string;
  departureDate: string;
}) {
  const current = STATUS_STEP[status];

  // Estados terminales fuera del flujo: el riel no aplica; mensaje directo.
  if (current === undefined) {
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
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const isViaje = i === STEPS.length - 1;
        // Forest solo en el hito final con dinero liquidado.
        const money = isViaje && settled;
        return (
          <li
            key={step.label}
            className={cn("relative flex gap-3 pb-5", i === STEPS.length - 1 && "pb-0")}
          >
            {i < STEPS.length - 1 && (
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
                {step.label}
                {active && (
                  <span className="ml-2 font-mono text-caption text-text-tertiary">
                    {isViaje ? departureDate : "en curso"}
                  </span>
                )}
              </p>
              {active && (
                <p className="mt-0.5 text-caption text-text-secondary">{step.hint}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
