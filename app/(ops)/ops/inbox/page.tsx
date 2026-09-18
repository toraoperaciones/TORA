import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

import { EmptyInvoices } from "@/components/illustrations/illustrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

interface SearchParams {
  filter?: string;
}

/** "hace 2h" / "hace 3d" — relativo simple para la bandeja. */
function timeAgo(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `hace ${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

const SERVICE_LABEL: Record<string, string> = {
  flight: "Vuelo",
  hotel: "Hotel",
  car: "Auto",
  stand: "Stand",
  mixed: "Mixto",
};

interface InboxTrip {
  id: string;
  origin: string;
  destination: string;
  departure_date: string;
  passengers: number;
  service_type: string;
  urgency: string;
  created_at: string;
  tenants: { name: string } | null;
  requester: { full_name: string | null; email: string } | null;
}

export default async function OpsInboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("trips")
    .select(
      `id, origin, destination, departure_date, passengers, service_type,
       urgency, created_at,
       tenants:tenant_id (name),
       requester:requester_id (full_name, email)`
    )
    .eq("status", "pending_quote")
    .order("created_at", { ascending: true });

  let trips = (data ?? []) as unknown as InboxTrip[];

  if (filter === "urgent" || filter === "normal") {
    trips = trips.filter((t) => t.urgency === filter);
  }

  // Urgentes primero, luego por antigüedad.
  trips = [...trips].sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "urgent" ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const tabs = [
    { value: "all", label: "Todas" },
    { value: "urgent", label: "Urgentes" },
    { value: "normal", label: "Normales" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 text-text-primary">
          Bandeja de cotización
        </h1>
        <p className="mt-1 text-body-s text-text-tertiary">
          {trips.length} solicitud{trips.length === 1 ? "" : "es"} pendiente
          {trips.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border-subtle bg-layer-1 p-1 sm:w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/ops/inbox?filter=${tab.value}`}
            aria-current={filter === tab.value ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-md px-3 text-body-s transition-colors",
              filter === tab.value
                ? "bg-layer-4 font-semibold text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-navy-lift py-14 text-center">
          <EmptyInvoices className="h-28 w-28" />
          <p className="text-body-s text-text-tertiary">
            No hay solicitudes pendientes. Buen trabajo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-navy-lift p-5 transition-colors duration-150 hover:border-border-default sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-body-m font-semibold text-text-primary">
                    {trip.tenants?.name ?? "—"}
                  </span>
                  {trip.urgency === "urgent" ? (
                    <Badge variant="warning">Urgente</Badge>
                  ) : (
                    <Badge variant="muted">Normal</Badge>
                  )}
                  <Badge variant="muted">
                    {SERVICE_LABEL[trip.service_type] ?? trip.service_type}
                  </Badge>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-body-s text-text-secondary">
                  {trip.origin}
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted" aria-hidden />
                  {trip.destination}
                  <span className="text-text-muted">
                    · {trip.passengers} pax
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-caption text-text-tertiary">
                  <Clock className="h-3 w-3" aria-hidden />
                  {timeAgo(trip.created_at)} · sale{" "}
                  <span className="font-mono">{trip.departure_date}</span> ·{" "}
                  {trip.requester?.full_name ?? trip.requester?.email ?? "—"}
                </p>
              </div>
              <Button asChild size="sm" className="sm:ml-auto">
                <Link href={`/ops/trips/${trip.id}/quote`}>Cotizar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
