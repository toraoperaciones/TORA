import { RiErrorWarningLine } from "@remixicon/react";
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
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Tenant");

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
      <div className="text-xs text-foreground/75">
        <Link href="/admin/tenants" className="hover:underline">
          Tenants
        </Link>{" "}
        → <span className="text-foreground">{tenant.name}</span>
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{tenant.name}</h1>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <p className="text-sm text-foreground/75">
            RFC: <span className="text-foreground">{tenant.rfc ?? "—"}</span>
          </p>
          <p className="text-sm text-foreground/75">
            Razón social: <span className="text-foreground">{tenant.razon_social ?? "—"}</span>
          </p>
          <p className="text-sm text-foreground/75">
            Régimen fiscal: <span className="text-foreground">{tenant.regimen_fiscal ?? "—"}</span>
          </p>
          <p className="text-sm text-foreground/75">
            Estado:{" "}
            {tenant.status === "active" ? (
              <Badge className="border-border bg-muted/70 text-foreground">Activo</Badge>
            ) : (
              <Badge className="border-transparent bg-muted text-foreground/75">
                <RiErrorWarningLine className="mr-1 h-3 w-3" /> {tenant.status}
              </Badge>
            )}
          </p>
          {tenant.notes && (
            <p className="text-sm text-foreground/75 sm:col-span-2">Notas: {tenant.notes}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-foreground/75">Saldo</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{formatMXN(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-foreground/75">Viajes totales</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{tripsCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-foreground/75">Usuarios activos</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-foreground/75">Crédito disponible</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
              {formatMXN(creditAvailable)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Configuración de markups</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Vuelos", value: tenant.markup_flights },
            { label: "Hoteles", value: tenant.markup_hotels },
            { label: "Autos", value: tenant.markup_cars },
            { label: "Stands", value: tenant.markup_stands },
          ].map((markup) => (
            <p key={markup.label} className="text-sm text-foreground/75">
              {markup.label}:{" "}
              <span className="tabular-nums font-semibold text-foreground">
                {(markup.value * 100).toFixed(1)}%
              </span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Usuarios</CardTitle>
          <InviteUserDialog tenant={{ id: tenant.id, name: tenant.name }} />
        </CardHeader>
        <CardContent>
          {(users ?? []).length === 0 ? (
            <p className="text-sm text-foreground/75">Sin usuarios.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Nombre</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Email</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Rol</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-sm text-foreground">{user.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-foreground/75">{user.email}</TableCell>
                    <TableCell className="text-sm text-foreground">{user.role}</TableCell>
                    <TableCell>
                      {user.status === "active" ? (
                        <Badge className="border-border bg-muted/70 text-foreground">Activo</Badge>
                      ) : user.status === "pending_approval" ? (
                        <Badge variant="secondary" className="text-foreground/75">Pendiente</Badge>
                      ) : (
                        <Badge className="border-transparent bg-muted text-foreground/75">
                          <RiErrorWarningLine className="mr-1 h-3 w-3" /> Suspendido
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
          <CardTitle className="text-lg font-semibold text-foreground">Últimos viajes</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentTrips ?? []).length === 0 ? (
            <p className="text-sm text-foreground/75">Aún no hay viajes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Destino</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Salida</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentTrips ?? []).map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="text-sm text-foreground">{trip.destination}</TableCell>
                    <TableCell className="text-sm text-foreground/75">
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
