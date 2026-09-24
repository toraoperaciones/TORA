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
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

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
  q?: string;
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

export const metadata: Metadata = pageMetadata("Viajes");

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

  // Búsqueda server-side: PostgREST no OR-e ilike con joins — filtramos en JS
  // sobre la página ya paginada por rango (volumen bajo: 20/page).
  const q = (params.q ?? "").trim().toLowerCase();
  const tripsRaw = (data ?? []) as unknown as OpsTrip[];
  const trips = q
    ? tripsRaw.filter(
        (t) =>
          t.destination?.toLowerCase().includes(q) ||
          t.requester?.full_name?.toLowerCase().includes(q)
      )
    : tripsRaw;
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

      <div className="rounded-lg border border-border bg-card p-6">
        {trips.length === 0 ? (
          <p className="text-sm text-foreground/75">
            No hay viajes con esos filtros.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Cliente
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Destino
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Salida
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Servicio
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Urgencia
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Estado
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                    Acción
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id} className="border-border">
                    <TableCell className="text-sm font-semibold text-foreground">
                      {trip.tenants?.name ?? "—"}
                      <p className="text-xs font-normal text-foreground/75">
                        {trip.requester?.full_name ?? ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {trip.origin} → {trip.destination}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">
                      {trip.departure_date}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {SERVICE_LABEL[trip.service_type] ?? trip.service_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap font-medium",
                          trip.urgency === "urgent"
                            ? "border-border bg-muted/70 text-foreground font-semibold"
                            : "border-border bg-transparent text-foreground"
                        )}
                      >
                        {trip.urgency === "urgent" ? "Urgente" : "Normal"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={trip.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="font-semibold">
                        <Link href={`/ops/trips/${trip.id}/quote`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-foreground/75">
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
