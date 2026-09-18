import Link from "next/link";
import { redirect } from "next/navigation";

import { PrintTrigger } from "@/components/layout/print-trigger";
import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatMXN } from "@/lib/utils";

export const metadata = { title: "TORA — Factura" };

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const [{ id }, { auto }, ctx, supabase] = await Promise.all([
    params,
    searchParams,
    getClientContext(),
    createClient(),
  ]);

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `id, period, subtotal, iva, total, status, cfdi_uuid, pdf_url, xml_url, created_at,
       tenants:tenant_id (id, name, rfc, razon_social)`
    )
    .eq("id", id)
    .single();

  if (!invoice) redirect("/invoices");

  const tenant = invoice.tenants as unknown as {
    id: string;
    name: string;
    rfc: string | null;
    razon_social: string | null;
  } | null;

  // El cliente solo ve sus facturas; staff TORA puede ver cualquiera con RLS.
  if (!ctx.tenantId || tenant?.id !== ctx.tenantId) {
    const isStaff =
      ctx.role === "TORA_ADMIN" ||
      ctx.role === "TORA_FINANCE" ||
      ctx.role === "TORA_OPS";
    if (!isStaff) redirect("/invoices");
  }

  const conceptos = [
    { label: "Servicios de viajes corporativos del período", amount: Number(invoice.subtotal) },
  ];

  return (
    <div className="min-h-screen bg-navy-deep py-10 print:bg-white print:py-0">
      <PrintTrigger auto={auto === "1"} />

      <div className="mx-auto w-[210mm] max-w-full bg-white px-[20mm] py-[20mm] text-navy shadow-modal print:shadow-none">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b-2 border-navy pb-6">
          <div>
            <p className="font-display text-2xl font-bold uppercase tracking-[0.14em]">
              TORA
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-graphite">
              Infraestructura de viajes corporativos
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-h3 font-semibold">Factura</p>
            <p className="mt-1 font-mono text-sm">Período {invoice.period}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-graphite">
              {invoice.status === "paid"
                ? "Pagada"
                : invoice.status === "issued"
                  ? "Emitida"
                  : invoice.status === "cancelled"
                    ? "Cancelada"
                    : "Borrador"}
            </p>
          </div>
        </div>

        {/* Datos del receptor */}
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
              Receptor
            </p>
            <p className="mt-1 font-display text-body-m font-semibold">
              {tenant?.razon_social ?? tenant?.name ?? "—"}
            </p>
            <p className="font-mono text-caption text-graphite">
              RFC {tenant?.rfc ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
              Fecha de emisión
            </p>
            <p className="mt-1 font-mono text-body-s">
              {new Date(invoice.created_at).toLocaleDateString("es-MX")}
            </p>
          </div>
        </div>

        {/* Conceptos */}
        <table className="mt-8 w-full text-body-s">
          <thead>
            <tr className="border-b border-navy/20 text-left text-[10px] uppercase tracking-wider text-graphite">
              <th className="pb-2 font-semibold">Concepto</th>
              <th className="pb-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {conceptos.map((c) => (
              <tr key={c.label} className="border-b border-navy/10">
                <td className="py-3">{c.label}</td>
                <td className="py-3 text-right font-mono tabular-nums">
                  {formatMXN(c.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-6 flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-1 text-body-s text-graphite">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">
                {formatMXN(Number(invoice.subtotal))}
              </span>
            </div>
            <div className="flex justify-between py-1 text-body-s text-graphite">
              <span>IVA (16%)</span>
              <span className="font-mono tabular-nums">
                {formatMXN(Number(invoice.iva))}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-navy pt-2 font-display text-body-m font-bold">
              <span>Total</span>
              <span className="font-mono tabular-nums">
                {formatMXN(Number(invoice.total))}
              </span>
            </div>
          </div>
        </div>

        {/* Pie CFDI */}
        <div className="mt-10 border-t border-navy/20 pt-4">
          {invoice.cfdi_uuid ? (
            <p className="font-mono text-[10px] text-graphite">
              CFDI UUID: {invoice.cfdi_uuid}
            </p>
          ) : (
            <p className="text-[10px] text-graphite">
              CFDI pendiente de timbrado.
            </p>
          )}
          <p className="mt-1 text-[10px] text-graphite">
            Este documento es una representación impresa. El CFDI original está
            adjunto.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-6 w-[210mm] max-w-full text-center print:hidden">
        <Link
          href="/invoices"
          className="text-caption text-text-tertiary underline underline-offset-4 hover:text-text-secondary"
        >
          Volver a facturas
        </Link>
      </div>
    </div>
  );
}
