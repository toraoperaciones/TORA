import {
  NewIncidentDialog,
  ResolveIncidentDialog,
} from "@/components/ops/incident-dialog";
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

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  flight_delay: "Retraso de vuelo",
  flight_cancelled: "Vuelo cancelado",
  hotel_issue: "Problema de hotel",
  car_issue: "Problema de auto",
  billing_issue: "Facturación",
  other: "Otro",
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: "border-transparent bg-card text-foreground",
  high: "border-transparent bg-accent text-foreground",
  medium: "border-transparent bg-[rgba(74,74,74,0.1)] text-foreground/75",
  low: "border-transparent bg-[rgba(74,74,74,0.05)] text-foreground/75",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const STATUS_TABS = [
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resueltos" },
  { value: "all", label: "Todos" },
];

interface SearchParams {
  status?: string;
}

interface IncidentRow {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  created_at: string;
  trip_id: string;
  trips: {
    destination: string;
    tenants: { name: string } | null;
  } | null;
}

export const metadata: Metadata = pageMetadata("Incidentes");

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status: statusFilter = "open" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("incidents")
    .select(
      `id, type, severity, description, status, created_at, trip_id,
       trips (destination, tenants (name))`
    )
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") query = query.eq("status", statusFilter);

  const { data } = await query;
  const incidents = (data ?? []) as unknown as IncidentRow[];

  const openCount =
    statusFilter === "open"
      ? incidents.length
      : (((
          await supabase
            .from("incidents")
            .select("id", { count: "exact", head: true })
            .eq("status", "open")
        ).count) ?? 0);

  // Trips activos para el dialog de nuevo incidente.
  const { data: activeTrips } = await supabase
    .from("trips")
    .select("id, destination, origin, departure_date")
    .in("status", ["pending_quote", "options_sent", "awaiting_selection", "awaiting_payment", "confirmed"])
    .order("departure_date", { ascending: true })
    .limit(50);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Incidentes</h1>
          <p className="mt-1 text-sm text-foreground/75">
            {openCount} abiert{openCount === 1 ? "o" : "os"}
          </p>
        </div>
        <NewIncidentDialog
          activeTrips={(activeTrips ?? []).map((t) => ({
            id: t.id,
            label: `${t.destination} — sale ${t.departure_date}`,
          }))}
        />
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            asChild
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            className="font-semibold"
          >
            <a href={`/ops/incidents?status=${tab.value}`}>{tab.label}</a>
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {incidents.length === 0 ? (
          <p className="text-sm text-foreground/75">No hay incidentes abiertos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Severidad
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Tipo
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Trip
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Descripción
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Estado
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Creado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id} className="border-border">
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent whitespace-nowrap font-medium",
                        SEVERITY_CLASS[incident.severity]
                      )}
                    >
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {INCIDENT_TYPE_LABEL[incident.type] ?? incident.type}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {incident.trips?.destination ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {incident.trips?.tenants?.name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm text-foreground/75">
                    {incident.description}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {STATUS_LABEL[incident.status] ?? incident.status}
                  </TableCell>
                  <TableCell className="text-xs text-foreground/75">
                    {new Date(incident.created_at).toLocaleDateString("es-MX")}
                  </TableCell>
                  <TableCell className="text-right">
                    {incident.status === "open" || incident.status === "in_progress" ? (
                      <ResolveIncidentDialog incidentId={incident.id} />
                    ) : (
                      <span className="text-xs text-foreground/75">—</span>
                    )}
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
