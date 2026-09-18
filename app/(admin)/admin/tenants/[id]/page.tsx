import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/business/wallet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteUserDialog } from "@/components/admin/invite-user-dialog";
import { statusLabel } from "@/lib/business/trip-machine";
import { StatusBadge } from "@/components/trips/status-badge";
import { formatDate, formatMXN } from "@/lib/utils";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: tenant },
    { data: users },
    { count: tripsCount },
    { data: recentTrips },
    { data: creditLine },
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", id).single(),
    supabase
      .from("users")
      .select("id, full_name, email, role, status")
      .eq("tenant_id", id)
      .order("created_at"),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    supabase
      .from("trips")
      .select("id, destination, departure_date, status")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("credit_lines").select("*").eq("tenant_id", id).eq("status", "active").maybeSingle(),
  ]);

  if (!tenant) notFound();

  const balance = await getBalance(id);
  const activeUsers = (users ?? []).filter((user) => user.status === "active").length;
  const creditAvailable = creditLine
    ? creditLine.approved_limit - creditLine.used_amount
    : tenant.credit_limit;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-caption text-text-secondary">
        <Link href="/admin/tenants" className="hover:underline">
          Tenants
        </Link>{" "}
        → <span className="text-text-primary">{tenant.name}</span>
      </div>

      <h1 className="font-display text-h2 text-text-primary">{tenant.name}</h1>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <p className="text-body-s text-text-secondary">
            RFC: <span className="text-text-primary">{tenant.rfc ?? "—"}</span>
          </p>
          <p className="text-body-s text-text-secondary">
            Razón social: <span className="text-text-primary">{tenant.razon_social ?? "—"}</span>
          </p>
          <p className="text-body-s text-text-secondary">
            Régimen fiscal: <span className="text-text-primary">{tenant.regimen_fiscal ?? "—"}</span>
          </p>
          <p className="text-body-s text-text-secondary">
            Estado:{" "}
            {tenant.status === "active" ? (
              <Badge className="border-border-default bg-layer-2 text-text-primary">Activo</Badge>
            ) : (
              <Badge className="border-transparent bg-layer-3 text-text-secondary">
                <AlertCircle className="mr-1 h-3 w-3" /> {tenant.status}
              </Badge>
            )}
          </p>
          {tenant.notes && (
            <p className="text-body-s text-text-secondary sm:col-span-2">Notas: {tenant.notes}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-caption uppercase tracking-wider text-text-secondary">Saldo</p>
            <p className="mt-2 font-display text-h3 tabular-nums text-text-primary">{formatMXN(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-caption uppercase tracking-wider text-text-secondary">Viajes totales</p>
            <p className="mt-2 font-display text-h3 tabular-nums text-text-primary">{tripsCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-caption uppercase tracking-wider text-text-secondary">Usuarios activos</p>
            <p className="mt-2 font-display text-h3 tabular-nums text-text-primary">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-caption uppercase tracking-wider text-text-secondary">Crédito disponible</p>
            <p className="mt-2 font-display text-h3 tabular-nums text-text-primary">
              {formatMXN(creditAvailable)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-h4 text-text-primary">Configuración de markups</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Vuelos", value: tenant.markup_flights },
            { label: "Hoteles", value: tenant.markup_hotels },
            { label: "Autos", value: tenant.markup_cars },
            { label: "Stands", value: tenant.markup_stands },
          ].map((markup) => (
            <p key={markup.label} className="text-body-s text-text-secondary">
              {markup.label}:{" "}
              <span className="tabular-nums font-semibold text-text-primary">
                {(markup.value * 100).toFixed(1)}%
              </span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-h4 text-text-primary">Usuarios</CardTitle>
          <InviteUserDialog tenant={{ id: tenant.id, name: tenant.name }} />
        </CardHeader>
        <CardContent>
          {(users ?? []).length === 0 ? (
            <p className="text-body-s text-text-secondary">Sin usuarios.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Nombre</TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Email</TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Rol</TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-body-s text-text-primary">{user.full_name ?? "—"}</TableCell>
                    <TableCell className="text-body-s text-text-secondary">{user.email}</TableCell>
                    <TableCell className="text-body-s text-text-primary">{user.role}</TableCell>
                    <TableCell>
                      {user.status === "active" ? (
                        <Badge className="border-border-default bg-layer-2 text-text-primary">Activo</Badge>
                      ) : user.status === "pending_approval" ? (
                        <Badge variant="secondary" className="text-text-secondary">Pendiente</Badge>
                      ) : (
                        <Badge className="border-transparent bg-layer-3 text-text-secondary">
                          <AlertCircle className="mr-1 h-3 w-3" /> Suspendido
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-h4 text-text-primary">Últimos viajes</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentTrips ?? []).length === 0 ? (
            <p className="text-body-s text-text-secondary">Aún no hay viajes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Destino</TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Salida</TableHead>
                  <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentTrips ?? []).map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="text-body-s text-text-primary">{trip.destination}</TableCell>
                    <TableCell className="text-body-s text-text-secondary">
                      {formatDate(trip.departure_date)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={statusLabel(trip.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
