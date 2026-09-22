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
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "border-border bg-transparent text-muted-foreground",
  issued: "border-border bg-transparent text-foreground font-semibold",
  paid: "border-transparent bg-primary text-foreground",
  cancelled: "border-border bg-transparent text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  cancelled: "Cancelada",
};

export const metadata: Metadata = pageMetadata("Facturas");

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
        <h1 className="text-2xl font-semibold text-foreground">Facturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CFDI mensual consolidado de tu empresa.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {invoices.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
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
                    <span className="font-semibold text-foreground">
                      {invoice.period}
                    </span>
                    {invoice.cfdi_uuid && (
                      <p className="font-mono text-xs text-muted-foreground/70">
                        CFDI {invoice.cfdi_uuid.slice(0, 8)}…
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground/75">
                    {formatMXN(Number(invoice.subtotal))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground/75">
                    {formatMXN(Number(invoice.iva))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
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
                    <div className="flex items-center justify-end gap-3 text-sm">
                      <a
                        href={`/invoices/${invoice.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/75"
                      >
                        PDF
                      </a>
                      {invoice.xml_url ? (
                        <a
                          href={invoice.xml_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/75"
                        >
                          XML
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">XML —</span>
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
