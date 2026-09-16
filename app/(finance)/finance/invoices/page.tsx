import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMXN } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
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

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borrador" },
  { value: "issued", label: "Emitidas" },
  { value: "paid", label: "Pagadas" },
];

interface SearchParams {
  status?: string;
  tenant?: string;
}

interface InvoiceRow {
  id: string;
  period: string;
  subtotal: string;
  iva: string;
  total: string;
  status: string;
  cfdi_uuid: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  tenant_id: string;
  tenants: { name: string; rfc: string | null } | null;
}

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(
      `id, period, subtotal, iva, total, status, cfdi_uuid, pdf_url, xml_url,
       tenant_id, tenants (name, rfc)`
    )
    .order("period", { ascending: false })
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (params.tenant) query = query.eq("tenant_id", params.tenant);

  const { data } = await query;
  const invoices = (data ?? []) as unknown as InvoiceRow[];

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <h1>Facturas</h1>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            asChild
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            className="font-display font-semibold"
          >
            <Link
              href={`/finance/invoices?status=${tab.value}${params.tenant ? `&tenant=${params.tenant}` : ""}`}
            >
              {tab.label}
            </Link>
          </Button>
        ))}
        <span className="mx-2 h-5 w-px bg-border-subtle" aria-hidden />
        <Button
          asChild
          variant={!params.tenant ? "default" : "outline"}
          size="sm"
          className="font-display font-semibold"
        >
          <Link
            href={`/finance/invoices?status=${statusFilter}`}
          >
            Todos los clientes
          </Link>
        </Button>
        {(tenants ?? []).map((tenant) => (
          <Button
            key={tenant.id}
            asChild
            variant={params.tenant === tenant.id ? "default" : "outline"}
            size="sm"
            className="font-display font-semibold"
          >
            <Link
              href={`/finance/invoices?status=${statusFilter}&tenant=${tenant.id}`}
            >
              {tenant.name}
            </Link>
          </Button>
        ))}
      </div>

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
                <TableHead className="text-caption uppercase tracking-wider text-graphite">
                  Cliente
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
                  <TableCell className="text-body-s text-navy">
                    {invoice.tenants?.name ?? "—"}
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
                        STATUS_CLASS[invoice.status]
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
