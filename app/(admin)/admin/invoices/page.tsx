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
        <h1 className="font-display text-h2 text-navy">Facturas</h1>
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
                  : "border-border-subtle bg-offwhite text-graphite hover:border-navy/30"
              }`}
            >
              {period}
            </a>
          ))}
          {params.period && (
            <a href="/admin/invoices" className="text-caption text-graphite underline">
              limpiar
            </a>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-body-s text-graphite">Aún no hay facturas emitidas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-offwhite">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Periodo</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Cliente</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Subtotal</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">IVA</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Total</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">CFDI UUID</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Estado</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Archivos</TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">Cambiar estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-display text-body-s font-semibold text-navy">
                    {invoice.period}
                  </TableCell>
                  <TableCell className="text-body-s text-navy">{invoice.tenants?.[0]?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-body-s text-graphite">
                    {formatMXN(invoice.subtotal)}
                  </TableCell>
                  <TableCell className="tabular-nums text-body-s text-graphite">
                    {formatMXN(invoice.iva)}
                  </TableCell>
                  <TableCell className="tabular-nums text-body-s font-semibold text-navy">
                    {formatMXN(invoice.total)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-caption text-graphite">
                    {invoice.cfdi_uuid ?? "—"}
                  </TableCell>
                  <TableCell>                      <Badge
                        className={
                          invoice.status === "cancelled"
                            ? "border-transparent bg-graphite/5 text-graphite/70"
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
                          className="text-navy underline"
                        >
                          PDF
                        </a>
                      ) : null}
                      {invoice.xml_url ? (
                        <a
                          href={`/api/receipts/signed-url?path=${encodeURIComponent(invoice.xml_url)}&bucket=invoices`}
                          className="text-navy underline"
                        >
                          XML
                        </a>
                      ) : null}
                      {!invoice.pdf_url && !invoice.xml_url && <span className="text-graphite">—</span>}
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
