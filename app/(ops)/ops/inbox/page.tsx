import { ArrowRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyInvoices } from "@/components/illustrations/illustrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cdmxDayStartIso } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("Bandeja");

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

/** Card de solicitud — reutilizada por el hero y por la lista. */
function TripCard({
  trip,
  hero,
  urgent,
}: {
  trip: InboxTrip;
  hero?: boolean;
  urgent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card transition-colors duration-150 hover:border-border sm:flex-row sm:items-center",
        hero ? "p-6" : "p-5",
        urgent ? "border-primary/40" : "border-border"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-display font-semibold text-foreground",
              hero ? "text-h3" : "text-body-m"
            )}
          >
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
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1.5 text-foreground/75",
            hero ? "text-body-m" : "text-body-s"
          )}
        >
          {trip.origin}
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
          {trip.destination}
          <span className="text-muted-foreground/70">
            · {trip.passengers} pax
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {timeAgo(trip.created_at)} · sale{" "}
          <span className="font-mono">{trip.departure_date}</span> ·{" "}
          {trip.requester?.full_name ?? trip.requester?.email ?? "—"}
        </p>
      </div>
      <Button
        asChild
        size={hero ? "default" : "sm"}
        className={hero ? "sm:ml-auto" : undefined}
      >
        <Link href={`/ops/trips/${trip.id}/quote`}>Cotizar</Link>
      </Button>
    </div>
  );
}

export default async function OpsInboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await createClient();
  const dayStart = cdmxDayStartIso();

  const [queue, quotedToday, confirmedToday] = await Promise.all([
    supabase
      .from("trips")
      .select(
        `id, origin, destination, departure_date, passengers, service_type,
         urgency, created_at,
         tenants:tenant_id (name),
         requester:requester_id (full_name, email)`
      )
      .eq("status", "pending_quote")
      .order("created_at", { ascending: true }),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .in("status", ["options_sent", "awaiting_selection"])
      .gte("created_at", dayStart),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("created_at", dayStart),
  ]);

  let trips = (queue.data ?? []) as unknown as InboxTrip[];

  if (filter === "urgent" || filter === "normal") {
    trips = trips.filter((t) => t.urgency === filter);
  }

  // Urgentes primero, luego por antigüedad.
  trips = [...trips].sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "urgent" ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const [hero, ...rest] = trips;
  const urgentCount = trips.filter((t) => t.urgency === "urgent").length;
  const metrics = [
    { label: "Pendientes", value: trips.length },
    { label: "Cotizados hoy", value: quotedToday.count ?? 0 },
    { label: "Confirmados hoy", value: confirmedToday.count ?? 0 },
  ];

  const tabs = [
    { value: "all", label: "Todas" },
    { value: "urgent", label: `Urgentes${urgentCount > 0 ? ` (${urgentCount})` : ""}` },
    { value: "normal", label: "Normales" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 text-foreground">
          Bandeja de cotización
        </h1>
        <p className="mt-1 text-body-s text-muted-foreground">
          {trips.length} solicitud{trips.length === 1 ? "" : "es"} pendiente
          {trips.length === 1 ? "" : "s"}
          {urgentCount > 0
            ? ` · ${urgentCount} urgente${urgentCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      {/* Métricas del día (spec A4): los tres números que definen el turno. */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            data-metric
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-caption uppercase tracking-wider text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-1 font-display text-h2 tabular-nums text-foreground">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/50 p-1 sm:w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/ops/inbox?filter=${tab.value}`}
            aria-current={filter === tab.value ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-md px-3 text-body-s transition-colors",
              filter === tab.value
                ? "bg-accent font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-14 text-center">
          <EmptyInvoices className="h-28 w-28" />
          <p className="text-body-s text-muted-foreground">
            No hay solicitudes pendientes. Buen trabajo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Nivel 1 — la solicitud más antigua (o urgente) domina la pantalla. */}
          <TripCard trip={hero} hero urgent={hero.urgency === "urgent"} />
          {/* Niveles 2-3 — el resto en cards compactas. */}
          {rest.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
