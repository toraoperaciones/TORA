import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActivationDialog } from "@/components/admin/user-activation-dialog";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { UserStatusButtons } from "@/components/admin/user-status-buttons";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const ROLES = ["CLIENT_ADMIN", "CLIENT_FINANCE", "TORA_OPS", "TORA_FINANCE", "TORA_ADMIN"] as const;

export const metadata: Metadata = pageMetadata("Usuarios");

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    role?: string;
    tenant?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";
  const role = params.role ?? "all";
  const tenantFilter = params.tenant ?? "all";
  const q = (params.q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const [usersResult, tenantsResult] = await Promise.all([
    supabase
      .from("users")
      .select(
        `id, email, full_name, phone, role, status, tenant_id, created_at,
         tenants (id, name)`
      )
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name").eq("status", "active").order("name"),
  ]);

  const users = usersResult.data ?? [];
  const tenants = tenantsResult.data ?? [];

  const filtered = users.filter((user) => {
    if (status !== "all" && user.status !== status) return false;
    if (role !== "all" && user.role !== role) return false;
    if (tenantFilter === "internal" && user.tenant_id !== null) return false;
    if (tenantFilter !== "all" && tenantFilter !== "internal" && user.tenant_id !== tenantFilter)
      return false;
    if (q) {
      const haystack = `${user.full_name ?? ""} ${user.email}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const pendingCount = users.filter((u) => u.status === "pending_approval").length;

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label + href}
      href={href}
      className={`rounded-md border px-3 py-1.5 text-caption font-display font-semibold transition-colors ${
        active
          ? "border-transparent bg-navy text-offwhite"
          : "border-border-subtle bg-navy-lift text-text-secondary hover:border-border-emphasis"
      }`}
    >
      {label}
    </Link>
  );

  const qs = (overrides: Record<string, string>) => {
    const next = new URLSearchParams({ status, role, tenant: tenantFilter, ...(q ? { q } : {}) });
    Object.entries(overrides).forEach(([k, v]) => {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    });
    return `/admin/users?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h2 text-text-primary">Usuarios</h1>

      {pendingCount > 0 && status !== "pending_approval" && (
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-navy-lift p-4">
          <p className="text-body-s font-semibold text-text-primary">
            {pendingCount} {pendingCount === 1 ? "usuario pendiente" : "usuarios pendientes"} de
            activación.
          </p>
          <Button asChild className="font-display font-semibold">
            <Link href={qs({ status: "pending_approval" })}>Ir a pendientes</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {chip("Todos", qs({ status: "all" }), status === "all")}
          {chip("Activos", qs({ status: "active" }), status === "active")}
          {chip("Pendientes", qs({ status: "pending_approval" }), status === "pending_approval")}
          {chip("Suspendidos", qs({ status: "suspended" }), status === "suspended")}
        </div>
        <div className="flex flex-wrap gap-2">
          {chip("Todos los roles", qs({ role: "all" }), role === "all")}
          {ROLES.map((r) => chip(r, qs({ role: r }), role === r))}
        </div>
        <div className="flex flex-wrap gap-2">
          {chip("Todos los tenants", qs({ tenant: "all" }), tenantFilter === "all")}
          {chip("TORA interno", qs({ tenant: "internal" }), tenantFilter === "internal")}
          {tenants.map((tenant) =>
            chip(tenant.name, qs({ tenant: tenant.id }), tenantFilter === tenant.id)
          )}
        </div>
        <form action="/admin/users" className="flex max-w-md gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="tenant" value={tenantFilter} />
          <Input name="q" placeholder="Buscar por nombre o email" defaultValue={params.q ?? ""} />
          <Button type="submit" variant="outline" className="font-display font-semibold">
            Buscar
          </Button>
        </form>
      </div>

      {filtered.length === 0 ? (
        <p className="text-body-s text-text-secondary">No hay usuarios que coincidan con los filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-navy-lift">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Nombre</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Email</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Rol</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Tenant</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Estado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Creado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const isPending = user.status === "pending_approval";
                return (
                  <TableRow
                    key={user.id}
                    className={isPending ? "border-l-2 border-l-navy" : undefined}
                  >
                    <TableCell className="text-body-s text-text-primary">{user.full_name ?? "—"}</TableCell>
                    <TableCell className="text-body-s text-text-secondary">{user.email}</TableCell>
                    <TableCell className="text-body-s text-text-primary">{user.role}</TableCell>
                    <TableCell className="text-body-s text-text-secondary">
                      {user.tenants?.[0]?.name ?? "TORA interno"}
                    </TableCell>
                    <TableCell>
                      {user.status === "active" ? (
                        <Badge variant="muted">Activo</Badge>
                      ) : isPending ? (
                        <Badge variant="secondary" className="text-text-secondary">Pendiente</Badge>
                      ) : (
                        <Badge className="border-transparent bg-layer-3 text-text-secondary">
                          <AlertCircle className="mr-1 h-3 w-3" /> Suspendido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-body-s text-text-secondary">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {isPending ? (
                          <UserActivationDialog
                            user={{ id: user.id, email: user.email, full_name: user.full_name }}
                            tenants={tenants}
                            trigger={
                              <Button size="sm">Activar</Button>
                            }
                          />
                        ) : (
                          <>
                            <UserEditDialog
                              user={{
                                id: user.id,
                                email: user.email,
                                full_name: user.full_name,
                                role: user.role,
                                tenant_id: user.tenant_id,
                                status: user.status,
                              }}
                              tenants={tenants}
                            />
                            <UserStatusButtons
                              userId={user.id}
                              status={user.status}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
