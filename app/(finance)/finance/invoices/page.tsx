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
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-border bg-transparent text-foreground/75",
  issued: "border-border bg-transparent text-foreground font-semibold",
  paid: "border-transparent bg-primary text-foreground",
  cancelled: "border-border bg-transparent text-foreground/75",
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

export const metadata: Metadata = pageMetadata("Facturas");

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
        <span className="mx-2 h-5 w-px bg-border" aria-hidden />
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

      <div className="rounded-lg border border-border bg-card p-6">
        {invoices.length === 0 ? (
          <p className="text-body-s text-foreground/75">Aún no hay facturas emitidas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                  Periodo
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Subtotal
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  IVA
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Total
                </TableHead>
                <TableHead className="text-caption uppercase tracking-wider text-foreground/75">
                  Estado
                </TableHead>
                <TableHead className="text-right text-caption uppercase tracking-wider text-foreground/75">
                  Descargas
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-border">
                  <TableCell className="text-body-s font-semibold text-foreground">
                    {invoice.period}
                    {invoice.cfdi_uuid && (
                      <p className="text-caption font-normal text-foreground/75">
                        CFDI {invoice.cfdi_uuid.slice(0, 8)}…
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-body-s text-foreground">
                    {invoice.tenants?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {formatMXN(Number(invoice.subtotal))}
                  </TableCell>
                  <TableCell className="text-right text-body-s tabular-nums text-foreground">
                    {formatMXN(Number(invoice.iva))}
                  </TableCell>
                  <TableCell className="text-right text-body-s font-semibold tabular-nums text-foreground">
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
                          className="font-semibold text-foreground underline underline-offset-4"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-caption text-foreground/75">PDF —</span>
                      )}
                      {invoice.xml_url ? (
                        <a
                          href={invoice.xml_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground underline underline-offset-4"
                        >
                          XML
                        </a>
                      ) : (
                        <span className="text-caption text-foreground/75">XML —</span>
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
