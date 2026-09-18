import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/trips/status-badge";
import { QuoteBuilder } from "@/components/trips/quote-builder";
import {
  CompleteTripButton,
  ConfirmBookingButton,
  ReopenQuoteButton,
} from "@/components/ops/trip-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceType } from "@/lib/business/markup";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const QUOTABLE_STATUSES = ["pending_quote", "options_sent", "awaiting_selection"];

const SERVICE_LABEL: Record<string, string> = {
  flight: "Vuelo",
  hotel: "Hotel",
  car: "Auto",
  stand: "Stand",
  mixed: "Mixto",
};

export const metadata: Metadata = pageMetadata("Cotizar");

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select(
      `id, origin, destination, departure_date, return_date, passengers,
       service_type, urgency, reason, status, requester_id,
       tenants:tenant_id (name, markup_flights, markup_hotels, markup_cars, markup_stands),
       requester:requester_id (full_name, email)`
    )
    .eq("id", id)
    .single();

  if (!trip) redirect("/ops/trips");
  if (!QUOTABLE_STATUSES.includes(trip.status)) redirect("/ops/trips");

  // OPS SÍ ve net_price (asimetría intencional del modelo de negocio).
  const { data: options } = await supabase
    .from("trip_options")
    .select("id, provider, net_price, final_price, details, expires_at")
    .eq("trip_id", id)
    .order("final_price", { ascending: true });

  const tenant = Array.isArray(trip.tenants) ? trip.tenants[0] : trip.tenants;
  const requester = Array.isArray(trip.requester) ? trip.requester[0] : trip.requester;

  const markups = {
    markup_flights: Number(tenant?.markup_flights ?? 0.06),
    markup_hotels: Number(tenant?.markup_hotels ?? 0.1),
    markup_cars: Number(tenant?.markup_cars ?? 0.12),
    markup_stands: Number(tenant?.markup_stands ?? 0.3),
  };

  const { data: booking } = await supabase
    .from("bookings")
    .select("confirmation_number, supplier_reference, status")
    .eq("trip_id", id)
    .maybeSingle();

  const details: Array<[string, string]> = [
    ["Cliente", tenant?.name ?? "—"],
    ["Solicitante", requester?.full_name ?? requester?.email ?? "—"],
    ["Ruta", `${trip.origin} → ${trip.destination}`],
    ["Salida", trip.departure_date],
    ["Regreso", trip.return_date ?? "—"],
    ["Pasajeros", String(trip.passengers)],
    ["Servicio", SERVICE_LABEL[trip.service_type] ?? trip.service_type],
    ["Urgencia", trip.urgency === "urgent" ? "Urgente" : "Normal"],
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-caption uppercase tracking-wider text-text-secondary">
          <Link href="/ops/inbox" className="hover:underline">
            Bandeja
          </Link>{" "}
          → Cotizar
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1>Cotizar viaje</h1>
          <StatusBadge status={trip.status} />
        </div>
      </div>

      <Card className="border-border-subtle bg-navy-lift shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-h4 text-text-primary">
            Resumen del viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption uppercase tracking-wider text-text-secondary">
                  {label}
                </dt>
                <dd className="text-body-s font-medium tabular-nums text-text-primary">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {trip.reason && (
            <p className="mt-4 border-t border-border-subtle pt-4 text-body-s text-text-secondary">
              {trip.reason}
            </p>
          )}
        </CardContent>
      </Card>

      <QuoteBuilder
        tripId={trip.id}
        serviceType={trip.service_type as ServiceType}
        markups={markups}
        existingOptions={(options ?? []).map((o) => ({
          id: o.id,
          provider: o.provider,
          net_price: Number(o.net_price),
          final_price: Number(o.final_price),
          details: (o.details as Record<string, unknown> | null) ?? null,
          expires_at: o.expires_at,
        }))}
        tripStatus={trip.status}
        requesterId={trip.requester_id}
      />

      {trip.status === "awaiting_payment" && (
        <Card className="border-border-subtle bg-navy-lift shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-h4 text-text-primary">
              Pago pendiente
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body-s text-text-secondary">
              El cliente ya seleccionó una opción. Esperando confirmación de pago
              (automática si el saldo alcanza, o cuando Finanzas apruebe el
              depósito).
            </p>
            <div>
              <ConfirmBookingButton tripId={trip.id} />
            </div>
          </CardContent>
        </Card>
      )}

      {trip.status === "confirmed" && (
        <Card className="border-border-subtle bg-navy-lift shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-h4 text-text-primary">
              Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-caption uppercase tracking-wider text-text-secondary">
                Confirmación
              </span>
              <span className="text-body-s font-semibold tabular-nums text-text-primary">
                {booking?.confirmation_number ?? "—"}
              </span>
              {booking?.supplier_reference && (
                <span className="text-caption text-text-secondary">
                  Ref. proveedor: {booking.supplier_reference}
                </span>
              )}
            </div>
            <CompleteTripButton tripId={trip.id} />
          </CardContent>
        </Card>
      )}

      {trip.status === "awaiting_selection" && (
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-navy-lift p-6">
          <p className="text-body-s text-text-secondary">
            El cliente está viendo estas opciones. Puedes reabrir la cotización
            para editarlas.
          </p>
          <ReopenQuoteButton tripId={trip.id} />
        </div>
      )}
    </div>
  );
}
