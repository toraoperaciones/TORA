import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
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
    <div className="flex flex-col gap-8">
      <div>
        <h1>Bandeja de cotización</h1>
        <p className="mt-1 text-body-s text-graphite">
          {trips.length} solicitud{trips.length === 1 ? "" : "es"} pendiente
          {trips.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            asChild
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            className="font-display font-semibold"
          >
            <Link href={`/ops/inbox?filter=${tab.value}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface p-6">
        {trips.length === 0 ? (
          <p className="text-body-s text-graphite">
            No hay solicitudes pendientes. Buen trabajo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Cliente
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Solicitante
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Ruta
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Salida
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Servicio
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Urgencia
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  En bandeja
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.id} className="border-border-subtle">
                  <TableCell className="text-body-s font-semibold text-navy">
                    {trip.tenants?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-body-s text-navy">
                    {trip.requester?.full_name ?? trip.requester?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-body-s text-navy">
                    {trip.origin} → {trip.destination}
                  </TableCell>
                  <TableCell className="text-body-s tabular-nums text-navy">
                    {trip.departure_date}
                  </TableCell>
                  <TableCell className="text-body-s text-navy">
                    {SERVICE_LABEL[trip.service_type] ?? trip.service_type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap font-medium",
                        trip.urgency === "urgent"
                          ? "border-transparent bg-[rgba(46,125,91,0.1)] text-forest"
                          : "border-border-default bg-transparent text-navy"
                      )}
                    >
                      {trip.urgency === "urgent" ? "Urgente" : "Normal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-caption text-graphite">
                    {timeAgo(trip.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" className="font-display font-semibold">
                      <Link href={`/ops/trips/${trip.id}/quote`}>Cotizar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
