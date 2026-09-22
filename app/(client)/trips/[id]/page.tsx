import { notFound } from "next/navigation";

import { OptionCard, type TripOptionPublic } from "@/components/trips/option-card";
import { StatusBadge } from "@/components/trips/status-badge";
import { TripRail } from "@/components/trips/trip-rail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientContext } from "@/lib/auth/tenant";
import { getSpeiInstructions } from "@/lib/business/payment-methods";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { formatMXN } from "@/lib/utils";

const SERVICE_LABEL: Record<string, string> = {
  flight: "Vuelo",
  hotel: "Hotel",
  car: "Auto",
  stand: "Stand",
  mixed: "Mixto",
};

const SELECTABLE_STATUSES = ["options_sent", "awaiting_selection"];

export const metadata: Metadata = pageMetadata("Viaje");

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getClientContext();
  const supabase = await createClient();

  // RLS ya filtra por tenant; si el trip no es del tenant → 0 filas → 404.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, destination, origin, departure_date, return_date, passengers, service_type, urgency, reason, status, notes, paid_at"
    )
    .eq("id", id)
    .single();

  if (!trip) notFound();

  const isCashPending = trip.status === "awaiting_payment";
  const spei = isCashPending ? await getSpeiInstructions(id) : null;

  // ⚠️ REGLA DE ORO: columnas explícitas. net_price NUNCA se selecciona,
  // por lo que jamás viaja en el RSC payload al navegador.
  const { data: options } = await supabase
    .from("trip_options")
    .select("id, provider, final_price, details, is_selected, expires_at")
    .eq("trip_id", id)
    .order("final_price", { ascending: true });

  const tripOptions = (options ?? []) as TripOptionPublic[];
  const canSelect =
    ctx.role === "CLIENT_ADMIN" && SELECTABLE_STATUSES.includes(trip.status);

  const details: Array<[string, string]> = [
    ["Origen", trip.origin],
    ["Salida", trip.departure_date],
    ["Regreso", trip.return_date ?? "—"],
    ["Pasajeros", String(trip.passengers)],
    ["Servicio", SERVICE_LABEL[trip.service_type] ?? trip.service_type],
    ["Urgencia", trip.urgency === "urgent" ? "Urgente" : "Normal"],
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{trip.destination}</h1>
        <StatusBadge status={trip.status} />
      </div>

      {/* Instrucciones SPEI — solo cash en awaiting_payment. */}
      {isCashPending && (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Esperando pago — transferencia SPEI
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {spei ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/75">
                      CLABE
                    </dt>
                    <dd className="font-mono text-sm font-medium tabular-nums text-foreground">
                      {spei.clabe}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/75">
                      Beneficiario
                    </dt>
                    <dd className="text-sm font-medium text-foreground">
                      {spei.beneficiary}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/75">
                      Monto
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMXN(spei.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/75">
                      Referencia
                    </dt>
                    <dd className="font-mono text-sm font-medium tabular-nums text-foreground">
                      {spei.reference}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm text-foreground/75">
                  Al subir tu comprobante, Finanzas lo valida y el viaje se
                  confirma automáticamente.
                </p>
                {ctx.role === "CLIENT_ADMIN" && (
                  <a
                    href={`/wallet?trip=${trip.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Subir comprobante
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground/75">
                El pago está pendiente. TORA está configurando los datos de
                transferencia — contacta a tu ejecutivo para continuar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmación cash: pago liquidado. */}
      {trip.status === "confirmed" && trip.paid_at && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-foreground">
            Pago confirmado. Viaje listo.
          </p>
          <span className="text-xs text-muted-foreground">
            {new Date(trip.paid_at).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "America/Mexico_City",
            })}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wider text-foreground/75">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {trip.reason && (
              <p className="mt-4 border-t border-border pt-4 text-sm text-foreground/75">
                {trip.reason}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Estado del viaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TripRail
              status={trip.status}
              departureDate={trip.departure_date}
            />
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Opciones</h2>

        {tripOptions.length === 0 ? (
          <p className="text-sm text-foreground/75">
            Operaciones está cotizando tu viaje. Te avisaremos cuando haya opciones.
          </p>
        ) : (
          tripOptions.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              canSelect={canSelect}
              tripId={trip.id}
            />
          ))
        )}
      </section>
    </div>
  );
}
