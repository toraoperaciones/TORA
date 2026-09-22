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
        <h1 className="text-2xl font-semibold text-foreground">Facturas</h1>
        <InvoiceUploadDialog tenants={tenants} />
      </div>

      {periods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((period) => (
            <a
              key={period}
              href={`/admin/invoices${params.period === period ? "" : `?period=${period}`}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                params.period === period
                  ? "border-transparent bg-card text-foreground"
                  : "border-border bg-card text-foreground/75 hover:border-foreground/30"
              }`}
            >
              {period}
            </a>
          ))}
          {params.period && (
            <a href="/admin/invoices" className="text-xs text-foreground/75 underline">
              limpiar
            </a>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground/75">Aún no hay facturas emitidas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Periodo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Subtotal</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">IVA</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Total</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">CFDI UUID</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Estado</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Archivos</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Cambiar estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="text-sm font-semibold text-foreground">
                    {invoice.period}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{invoice.tenants?.[0]?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-sm text-foreground/75">
                    {formatMXN(invoice.subtotal)}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-foreground/75">
                    {formatMXN(invoice.iva)}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm font-semibold text-foreground">
                    {formatMXN(invoice.total)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-foreground/75">
                    {invoice.cfdi_uuid ?? "—"}
                  </TableCell>
                  <TableCell>                      <Badge
                        className={
                          invoice.status === "cancelled"
                            ? "border-transparent bg-muted/70 text-foreground/75"
                            : invoice.status === "paid"
                              ? "border-transparent bg-primary/10 text-primary"
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
                    <div className="flex gap-1 text-xs font-semibold">
                      {invoice.pdf_url ? (
                        <a
                          href={`/api/receipts/signed-url?path=${encodeURIComponent(invoice.pdf_url)}&bucket=invoices`}
                          className="text-foreground underline"
                        >
                          PDF
                        </a>
                      ) : null}
                      {invoice.xml_url ? (
                        <a
                          href={`/api/receipts/signed-url?path=${encodeURIComponent(invoice.xml_url)}&bucket=invoices`}
                          className="text-foreground underline"
                        >
                          XML
                        </a>
                      ) : null}
                      {!invoice.pdf_url && !invoice.xml_url && <span className="text-foreground/75">—</span>}
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
