import Link from "next/link";

import { StatusBadge } from "@/components/trips/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const SERVICE_LABEL: Record<string, string> = {
  flight: "Vuelo",
  hotel: "Hotel",
  car: "Auto",
  stand: "Stand",
  mixed: "Mixto",
};

const PAGE_SIZE = 20;

interface SearchParams {
  page?: string;
}

export const metadata: Metadata = pageMetadata("Mis viajes");

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const ctx = await getClientContext();
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("trips")
    .select(
      "id, destination, origin, departure_date, return_date, service_type, status",
      { count: "exact" }
    )
    .eq("tenant_id", ctx.tenantId ?? "")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const trips = (data ?? []) as Array<{
    id: string;
    destination: string;
    origin: string;
    departure_date: string;
    return_date: string | null;
    service_type: string;
    status: string;
  }>;
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1>Mis viajes</h1>
        {ctx.role === "CLIENT_ADMIN" && (
          <Button asChild className="font-semibold">
            <Link href="/trips/new">Solicitar viaje</Link>
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {trips.length === 0 ? (
          <p className="text-sm text-foreground/75">
            Aún no tienes viajes. Solicita el primero en 3 clics.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Destino
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Fechas
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Servicio
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Estado
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id} className="border-border">
                    <TableCell>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        {trip.destination}
                      </Link>
                      <p className="text-xs text-foreground/75">Desde {trip.origin}</p>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">
                      {trip.departure_date}
                      {trip.return_date ? ` → ${trip.return_date}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {SERVICE_LABEL[trip.service_type] ?? trip.service_type}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={trip.status} />
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
                    <a href={`/trips?page=${page - 1}`}>Anterior</a>
                  </Button>
                )}
                {page < totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/trips?page=${page + 1}`}>Siguiente</a>
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
