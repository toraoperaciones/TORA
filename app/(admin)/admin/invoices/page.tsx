import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceUploadDialog } from "@/components/admin/invoice-upload-dialog";
import { InvoiceStatusSelect } from "@/components/admin/invoice-status-select";
import { formatMXN } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";


export const metadata: Metadata = pageMetadata("Facturas");

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tenant?: string; status?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const [invoicesResult, tenantsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `id, tenant_id, period, subtotal, iva, total, status, cfdi_uuid, pdf_url, xml_url,
         tenants (name)`
      )
      .order("period", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name").eq("status", "active").order("name"),
  ]);

  const invoices = invoicesResult.data ?? [];
  const tenants = tenantsResult.data ?? [];

  const filtered = invoices.filter((invoice) => {
    if (params.period && invoice.period !== params.period) return false;
    if (params.tenant && invoice.tenant_id !== params.tenant) return false;
    if (params.status && invoice.status !== params.status) return false;
    return true;
  });

  const periods = Array.from(new Set(invoices.map((i) => i.period))).sort().reverse();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-text-primary">Facturas</h1>
        <InvoiceUploadDialog tenants={tenants} />
      </div>

      {periods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((period) => (
            <a
              key={period}
              href={`/admin/invoices${params.period === period ? "" : `?period=${period}`}`}
              className={`rounded-md border px-3 py-1.5 text-caption font-display font-semibold ${
                params.period === period
                  ? "border-transparent bg-navy text-offwhite"
                  : "border-border-subtle bg-navy-lift text-text-secondary hover:border-border-emphasis"
              }`}
            >
              {period}
            </a>
          ))}
          {params.period && (
            <a href="/admin/invoices" className="text-caption text-text-secondary underline">
              limpiar
            </a>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-body-s text-text-secondary">Aún no hay facturas emitidas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-navy-lift">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Periodo</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Cliente</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Subtotal</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">IVA</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Total</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">CFDI UUID</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Estado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Archivos</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-text-secondary">Cambiar estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-display text-body-s font-semibold text-text-primary">
                    {invoice.period}
                  </TableCell>
                  <TableCell className="text-body-s text-text-primary">{invoice.tenants?.[0]?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-body-s text-text-secondary">
                    {formatMXN(invoice.subtotal)}
                  </TableCell>
                  <TableCell className="tabular-nums text-body-s text-text-secondary">
                    {formatMXN(invoice.iva)}
                  </TableCell>
                  <TableCell className="tabular-nums text-body-s font-semibold text-text-primary">
                    {formatMXN(invoice.total)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-caption text-text-secondary">
                    {invoice.cfdi_uuid ?? "—"}
                  </TableCell>
                  <TableCell>                      <Badge
                        className={
                          invoice.status === "cancelled"
                            ? "border-transparent bg-layer-2 text-text-secondary"
                            : invoice.status === "paid"
                              ? "border-transparent bg-forest/10 text-forest"
                              : undefined
                        }
                      >
                        {invoice.status === "paid"
                          ? "Pagada"
                          : invoice.status === "issued"
                            ? "Emitida"
                            : invoice.status === "draft"
                              ? "Borrador"
                              : "Cancelada"}
                      </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-caption font-display font-semibold">
                      {invoice.pdf_url ? (
                        <a
                          href={`/api/receipts/signed-url?path=${encodeURIComponent(invoice.pdf_url)}&bucket=invoices`}
                          className="text-text-primary underline"
                        >
                          PDF
                        </a>
                      ) : null}
                      {invoice.xml_url ? (
                        <a
                          href={`/api/receipts/signed-url?path=${encodeURIComponent(invoice.xml_url)}&bucket=invoices`}
                          className="text-text-primary underline"
                        >
                          XML
                        </a>
                      ) : null}
                      {!invoice.pdf_url && !invoice.xml_url && <span className="text-text-secondary">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusSelect invoiceId={invoice.id} status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
