import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMXN } from "@/lib/utils";

const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "border-border-default bg-transparent text-text-tertiary",
  issued: "border-border-default bg-transparent text-text-primary font-semibold",
  paid: "border-transparent bg-forest text-offwhite",
  cancelled: "border-border-default bg-transparent text-text-tertiary",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  cancelled: "Cancelada",
};

export default async function InvoicesPage() {
  const ctx = await getClientContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoices")
    .select("id, period, subtotal, iva, total, status, pdf_url, xml_url, cfdi_uuid")
    .eq("tenant_id", ctx.tenantId ?? "")
    .order("period", { ascending: false });

  const invoices = (data ?? []) as Array<{
    id: string;
    period: string;
    subtotal: string;
    iva: string;
    total: string;
    status: string;
    pdf_url: string | null;
    xml_url: string | null;
    cfdi_uuid: string | null;
  }>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 text-text-primary">Facturas</h1>
        <p className="mt-1 text-body-s text-text-tertiary">
          CFDI mensual consolidado de tu empresa.
        </p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-navy-lift">
        {invoices.length === 0 ? (
          <p className="py-10 text-center text-body-s text-text-tertiary">
            Aún no hay facturas emitidas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Descargas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <span className="font-display font-semibold text-text-primary">
                      {invoice.period}
                    </span>
                    {invoice.cfdi_uuid && (
                      <p className="font-mono text-caption text-text-muted">
                        CFDI {invoice.cfdi_uuid.slice(0, 8)}…
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-text-secondary">
                    {formatMXN(Number(invoice.subtotal))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-text-secondary">
                    {formatMXN(Number(invoice.iva))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums text-text-primary">
                    {formatMXN(Number(invoice.total))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap font-medium",
                        INVOICE_STATUS_CLASS[invoice.status]
                      )}
                    >
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3 text-body-s">
                      <a
                        href={`/invoices/${invoice.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-text-primary underline underline-offset-4 hover:text-text-secondary"
                      >
                        PDF
                      </a>
                      {invoice.xml_url ? (
                        <a
                          href={invoice.xml_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-text-primary underline underline-offset-4 hover:text-text-secondary"
                        >
                          XML
                        </a>
                      ) : (
                        <span className="text-caption text-text-muted">XML —</span>
                      )}
                    </div>
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
