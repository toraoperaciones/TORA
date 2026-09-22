import { TenantsGrid } from "@/components/admin/tenants-grid";
import type { TenantRow } from "@/components/admin/tenant-card";
import { EmptySearch } from "@/components/illustrations/illustrations";
import { TenantFormDialog } from "@/components/admin/tenant-form-dialog";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Tenants");

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      `id, name, rfc, razon_social, credit_limit, credit_days,
       markup_flights, markup_hotels, markup_cars, markup_stands,
       status, notes, created_at, payment_method, spei_clabe, spei_beneficiary,
       credit_lines (approved_limit, used_amount, status)`
    )
    .order("created_at", { ascending: false });

  const rows = (tenants ?? []) as TenantRow[];

  const activeCount = rows.filter((t) => t.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} activos · {rows.length} totales
          </p>
        </div>
        <TenantFormDialog />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-14 text-center">
          <EmptySearch className="h-28 w-28" />
          <p className="text-sm text-muted-foreground">
            No hay tenants aún. Crea el primero.
          </p>
        </div>
      ) : (
        <TenantsGrid tenants={rows} />
      )}
    </div>
  );
}
