import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenantFormDialog } from "@/components/admin/tenant-form-dialog";
import { TenantStatusMenu } from "@/components/admin/tenant-status-menu";
import { formatMXN } from "@/lib/utils";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      `id, name, rfc, razon_social, credit_limit, credit_days,
       markup_flights, markup_hotels, markup_cars, markup_stands,
       status, notes, created_at,
       credit_lines (approved_limit, used_amount, status)`
    )
    .order("created_at", { ascending: false });

  const rows = tenants ?? [];
  const activeCount = rows.filter((tenant) => tenant.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-navy">Tenants</h1>
        <TenantFormDialog />
      </div>

      <p className="text-body-s text-graphite">
        {activeCount} activos / {rows.length} totales
      </p>

      {rows.length === 0 ? (
        <p className="text-body-s text-graphite">No hay tenants aún. Crea el primero.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-offwhite">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Nombre</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">RFC</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Línea de crédito</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Crédito usado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Estado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Creado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tenant) => {
                const activeLine = tenant.credit_lines?.find((line) => line.status === "active");
                return (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="font-display font-semibold text-navy hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-body-s text-graphite">{tenant.rfc ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-body-s text-navy">
                      {activeLine ? formatMXN(activeLine.approved_limit) : formatMXN(tenant.credit_limit)}
                    </TableCell>
                    <TableCell className="tabular-nums text-body-s text-navy">
                      {formatMXN(activeLine?.used_amount ?? 0)}
                    </TableCell>
                    <TableCell>
                      {tenant.status === "active" ? (
                        <Badge className="border-transparent bg-forest/10 text-forest">Activo</Badge>
                      ) : tenant.status === "suspended" ? (
                        <Badge className="border-transparent bg-graphite/10 text-graphite">
                          <AlertCircle className="mr-1 h-3 w-3" /> Suspendido
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-transparent bg-graphite/5 text-graphite/70">Archivado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-body-s text-graphite">
                      {format(new Date(tenant.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild className="font-display font-semibold">
                          <Link href={`/admin/tenants/${tenant.id}`}>Ver</Link>
                        </Button>
                        <TenantStatusMenu tenantId={tenant.id} status={tenant.status} />
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
