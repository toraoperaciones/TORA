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
  draft: "border-border-default bg-transparent text-graphite",
  issued: "border-border-default bg-transparent text-navy font-semibold",
  paid: "border-transparent bg-forest text-offwhite",
  cancelled: "border-border-default bg-transparent text-graphite",
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
    <div className="flex flex-col gap-8">
      <h1>Facturas</h1>

      <div className="rounded-lg border border-border-subtle bg-surface p-6">
        {invoices.length === 0 ? (
          <p className="text-body-s text-graphite">Aún no hay facturas emitidas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Periodo
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Subtotal
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  IVA
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Total
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Estado
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-graphite">
                  Descargas
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-border-subtle">
                  <TableCell className="text-body-s font-semibold text-navy">
                    {invoice.period}
                    {invoice.cfdi_uuid && (
                      <p className="text-caption font-normal text-graphite">
                        CFDI {invoice.cfdi_uuid.slice(0, 8)}…
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-navy">
                    {formatMXN(Number(invoice.subtotal))}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-navy">
                    {formatMXN(Number(invoice.iva))}
                  </TableCell>
                  <TableCell className="text-right text-body-s font-semibold tabular-nums text-navy">
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
                    <div className="flex justify-end gap-2 text-body-s">
                      {invoice.pdf_url ? (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-navy underline underline-offset-4"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-caption text-graphite">PDF —</span>
                      )}
                      {invoice.xml_url ? (
                        <a
                          href={invoice.xml_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-navy underline underline-offset-4"
                        >
                          XML
                        </a>
                      ) : (
                        <span className="text-caption text-graphite">XML —</span>
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
