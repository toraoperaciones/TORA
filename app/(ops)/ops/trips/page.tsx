import Link from "next/link";

import { TripsFilters } from "@/components/ops/trips-filters";
import { StatusBadge } from "@/components/trips/status-badge";
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

const ACTIVE_STATUSES = [
  "awaiting_selection",
  "awaiting_payment",
  "confirmed",
  "completed",
];

const SERVICE_LABEL: Record<string, string> = {
  flight: "Vuelo",
  hotel: "Hotel",
  car: "Auto",
  stand: "Stand",
  mixed: "Mixto",
};

const PAGE_SIZE = 20;

interface SearchParams {
  status?: string;
  tenant?: string;
  from?: string;
  to?: string;
  page?: string;
}

interface OpsTrip {
  id: string;
  origin: string;
  destination: string;
  departure_date: string;
  status: string;
  service_type: string;
  urgency: string;
  tenants: { id: string; name: string } | null;
  requester: { full_name: string | null } | null;
}

export default async function OpsTripsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const supabase = await createClient();

  let query = supabase
    .from("trips")
    .select(
      `id, origin, destination, departure_date, status, service_type, urgency,
       tenants:tenant_id (id, name),
       requester:requester_id (full_name)`,
      { count: "exact" }
    )
    .in("status", ACTIVE_STATUSES)
    .order("departure_date", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.status && params.status !== "all") {
    query = query.in("status", params.status.split(",").filter((s) => ACTIVE_STATUSES.includes(s)));
  }
  if (params.tenant) query = query.eq("tenant_id", params.tenant);
  if (params.from) query = query.gte("departure_date", params.from);
  if (params.to) query = query.lte("departure_date", params.to);

  const { data, count } = await query;

  const trips = (data ?? []) as unknown as OpsTrip[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  function buildPageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (params.status) sp.set("status", params.status);
    if (params.tenant) sp.set("tenant", params.tenant);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    sp.set("page", String(targetPage));
    return `/ops/trips?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1>Viajes activos</h1>

      <TripsFilters tenants={tenants ?? []} />

      <div className="rounded-lg border border-border-subtle bg-surface p-6">
        {trips.length === 0 ? (
          <p className="text-body-s text-graphite">
            No hay viajes con esos filtros.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border-subtle hover:bg-transparent">
                  <TableHead className="text-caption uppercase tracking-wider text-graphite">
                    Cliente
                  </TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-graphite">
                    Destino
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
                    Estado
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
                      <p className="text-caption font-normal text-graphite">
                        {trip.requester?.full_name ?? ""}
                      </p>
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
                    <TableCell>
                      <StatusBadge status={trip.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="font-display font-semibold">
                        <Link href={`/ops/trips/${trip.id}/quote`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-caption text-graphite">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <a href={buildPageHref(page - 1)}>Anterior</a>
                  </Button>
                )}
                {page < totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <a href={buildPageHref(page + 1)}>Siguiente</a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
