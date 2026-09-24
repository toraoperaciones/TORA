import { BulkInvoiceDialog } from "@/components/finance/bulk-invoice-dialog";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { detectBillingPeriod } from "@/lib/business/cfdi";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMXN } from "@/lib/utils";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Costo por timbre (MXN) — actualizar cuando se contrate el plan de Facturapi.
const FACTURAPI_COST_PER_STAMP_MXN = 3.5;

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

const INVOICE_FULL_SELECT = `
  id, period, subtotal, iva, total, status, cfdi_uuid, pdf_url, xml_url,
  facturapi_invoice_id, tenant_id,
  tenants (name), issuer_companies (internal_name)`;

const INVOICE_BASE_SELECT = `
  id, period, subtotal, iva, total, status, cfdi_uuid, pdf_url, xml_url,
  tenant_id, tenants (name)`;

interface SearchParams {
  status?: string;
  tenant?: string;
  q?: string;
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
  facturapi_invoice_id?: string | null;
  tenant_id: string;
  tenants: { name: string } | null;
  issuer_companies?: { internal_name: string } | null;
}

export const metadata: Metadata = pageMetadata("Facturas");

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const period = detectBillingPeriod();
  const supabase = await createClient();

  // Estado guardado: las columnas de emisora llegan con 0025. Si aún no
  // están (42703 undefined_column), se usa el select base sin KPIs de emisor.
  let setupPending = false;

  const primary = await supabase
    .from("invoices")
    .select(INVOICE_FULL_SELECT)
    .gte("period", period.slice(0, 4) + "-01")
    .order("period", { ascending: false })
    .order("created_at", { ascending: false });

  let allInvoices = (primary.data ?? []) as unknown as InvoiceRow[];
  if (primary.error) {
    setupPending = true;
    const fallback = await supabase
      .from("invoices")
      .select(INVOICE_BASE_SELECT)
      .order("period", { ascending: false })
      .order("created_at", { ascending: false });
    allInvoices = (fallback.data ?? []) as unknown as InvoiceRow[];
  }

  let filteredQuery = supabase
    .from("invoices")
    .select(INVOICE_FULL_SELECT)
    .order("period", { ascending: false })
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") filteredQuery = filteredQuery.eq("status", statusFilter);
  if (params.tenant) filteredQuery = filteredQuery.eq("tenant_id", params.tenant);

  const filteredPrimary = await filteredQuery;
  let invoicesBeforeSearch = (filteredPrimary.data ?? []) as unknown as InvoiceRow[];
  if (filteredPrimary.error) {
    let fallbackQuery = supabase
      .from("invoices")
      .select(INVOICE_BASE_SELECT)
      .order("period", { ascending: false })
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") fallbackQuery = fallbackQuery.eq("status", statusFilter);
    if (params.tenant) fallbackQuery = fallbackQuery.eq("tenant_id", params.tenant);
    const fallbackResult = await fallbackQuery;
    invoicesBeforeSearch = (fallbackResult.data ?? []) as unknown as InvoiceRow[];
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");

  // Búsqueda compartible por URL: cliente, periodo o UUID de CFDI.
  const invoices = invoicesBeforeSearch.filter(
    (inv) =>
      !q ||
      inv.tenants?.name?.toLowerCase().includes(q) ||
      inv.period.toLowerCase().includes(q) ||
      inv.cfdi_uuid?.toLowerCase().includes(q)
  );

  // ── KPIs del período ──
  const periodInvoices = allInvoices.filter(
    (i) => i.period === period && i.status !== "cancelled"
  );
  const stamps = periodInvoices.filter((i) => i.facturapi_invoice_id).length;
  const issuedCount = periodInvoices.filter((i) =>
    ["issued", "paid"].includes(i.status)
  ).length;
  const stampCost = stamps * FACTURAPI_COST_PER_STAMP_MXN;
  const byIssuer = new Map<string, number>();
  for (const invoice of periodInvoices) {
    const key = invoice.issuer_companies?.internal_name ?? "Sin asignar";
    byIssuer.set(key, (byIssuer.get(key) ?? 0) + 1);
  }

  // ── Candidatos para facturación masiva (viajes del período por tenant) ──
  let candidates: Array<{ id: string; name: string; trips: number; amount: number }> = [];
  if (!setupPending) {
    const from = `${period}-01`;
    const [year, month] = from.split("-").map(Number);
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    const to = `${next.y}-${String(next.m).padStart(2, "0")}-01`;

    const { data: periodTrips } = await supabase
      .from("trips")
      .select(
        `id, tenant_id, tenants (name),
         options:trip_options (final_price, is_selected)`
      )
      .gte("departure_date", from)
      .lt("departure_date", to);

    const acc = new Map<string, { name: string; trips: number; amount: number }>();
    for (const trip of periodTrips ?? []) {
      const row = trip as unknown as {
        tenant_id: string;
        tenants: { name: string } | null;
        options: Array<{ final_price: number | null; is_selected: boolean | null }> | null;
      };
      const options = row.options ?? [];
      const selected = options.find((o) => o.is_selected) ?? options[0];
      const price = Number(selected?.final_price ?? 0);
      const entry = acc.get(row.tenant_id) ?? {
        name: row.tenants?.name ?? "Cliente",
        trips: 0,
        amount: 0,
      };
      entry.trips += 1;
      entry.amount += price;
      acc.set(row.tenant_id, entry);
    }
    candidates = Array.from(acc.entries())
      .map(([id, v]) => ({ id, ...v, amount: Math.round(v.amount * 100) / 100 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Facturas</h1>
        {!setupPending && <BulkInvoiceDialog period={period} candidates={candidates} />}
      </div>

      {setupPending ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Timbrado automático en configuración
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-foreground/75">
            La migración{" "}
            <code className="font-mono text-xs">0025_issuer_companies</code> no
            está aplicada aún: los KPIs de emisor y la facturación automática
            aparecen al aplicarla. El export JSON manual sigue disponible en{" "}
            <Link
              href="/admin/invoices"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Admin → Facturas
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: `CFDIs emitidos · ${period}`,
              value: String(issuedCount),
              hint: `${periodInvoices.length} factura(s) del período`,
            },
            {
              label: "Timbres consumidos",
              value: String(stamps),
              hint: "via Facturapi (test)",
            },
            {
              label: "Costo estimado Facturapi",
              value: formatMXN(stampCost),
              hint: `${FACTURAPI_COST_PER_STAMP_MXN} MXN por timbre`,
            },
            {
              label: "Distribución por empresa",
              value:
                byIssuer.size === 0
                  ? "—"
                  : `${byIssuer.size} emisora${byIssuer.size === 1 ? "" : "s"}`,
              hint:
                Array.from(byIssuer.entries())
                  .map(([name, n]) => `${name}: ${n}`)
                  .join(" · ") || "Sin facturas del período",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-border bg-card px-5 py-4"
            >
              <p className="text-xs uppercase tracking-wider text-foreground/60">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {kpi.value}
              </p>
              <p className="mt-1 truncate text-xs text-foreground/60" title={kpi.hint}>
                {kpi.hint}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action="/finance/invoices" className="mr-2 flex max-w-md gap-2">
          <input type="hidden" name="status" value={statusFilter} />
          {params.tenant && <input type="hidden" name="tenant" value={params.tenant} />}
          <Input
            name="q"
            placeholder="Buscar cliente, periodo o UUID"
            defaultValue={params.q ?? ""}
            aria-label="Buscar facturas"
          />
          <Button type="submit" variant="outline" className="font-semibold">
            Buscar
          </Button>
        </form>
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            asChild
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            className="font-semibold"
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
          className="font-semibold"
        >
          <Link href={`/finance/invoices?status=${statusFilter}`}>
            Todos los clientes
          </Link>
        </Button>
        {(tenants ?? []).map((tenant) => (
          <Button
            key={tenant.id}
            asChild
            variant={params.tenant === tenant.id ? "default" : "outline"}
            size="sm"
            className="font-semibold"
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
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-foreground/75">
              {q || params.tenant || statusFilter !== "all"
                ? "Ninguna factura coincide con el filtro actual."
                : "Aún no hay facturas emitidas. Usa «Facturar todo el mes» cuando cierres el período."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Periodo
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Cliente
                </TableHead>
                {!setupPending && (
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                    Empresa asignada
                  </TableHead>
                )}
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Subtotal
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  IVA
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Total
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-foreground/75">
                  Estado
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">
                  Descargas
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-border">
                  <TableCell className="text-sm font-semibold text-foreground">
                    {invoice.period}
                    {invoice.cfdi_uuid && (
                      <p className="text-xs font-normal text-foreground/75">
                        CFDI {invoice.cfdi_uuid.slice(0, 8)}…
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {invoice.tenants?.name ?? "—"}
                  </TableCell>
                  {!setupPending && (
                    <TableCell className="text-sm text-foreground/75">
                      {invoice.issuer_companies?.internal_name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right text-sm tabular-nums text-foreground">
                    {formatMXN(Number(invoice.subtotal))}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-foreground">
                    {formatMXN(Number(invoice.iva))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
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
                    <div className="flex justify-end gap-2 text-sm">
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
                        <span className="text-xs text-foreground/75">PDF —</span>
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
                        <span className="text-xs text-foreground/75">XML —</span>
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
