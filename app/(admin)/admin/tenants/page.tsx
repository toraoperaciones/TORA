import { format } from "date-fns";

import { TenantsGrid } from "@/components/admin/tenants-grid";
import { EmptySearch } from "@/components/illustrations/illustrations";
import { TenantFormDialog } from "@/components/admin/tenant-form-dialog";
import { createClient } from "@/lib/supabase/server";

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

  const rows = (tenants ?? []) as NonNullable<
    Awaited<ReturnType<typeof loadTenants>>
  >;

  const activeCount = rows.filter((t) => t.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-text-primary">Tenants</h1>
          <p className="mt-1 text-body-s text-text-tertiary">
            {activeCount} activos · {rows.length} totales
          </p>
        </div>
        <TenantFormDialog />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-navy-lift py-14 text-center">
          <EmptySearch className="h-28 w-28" />
          <p className="text-body-s text-text-tertiary">
            No hay tenants aún. Crea el primero.
          </p>
        </div>
      ) : (
        <TenantsGrid tenants={rows} />
      )}
    </div>
  );
}

/** Tipado del select (solo para inferir la fila; la query real está arriba). */
async function loadTenants() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select(
      `id, name, rfc, razon_social, credit_limit, credit_days,
       markup_flights, markup_hotels, markup_cars, markup_stands,
       status, notes, created_at,
       credit_lines (approved_limit, used_amount, status)`
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}
