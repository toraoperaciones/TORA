import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInvoice,
  FacturapiError,
  type FacturapiInvoice,
} from "@/lib/facturapi/client";

/**
 * Orquestador de timbrado (Sprint 6). Reglas:
 * - El período se auto-detecta: día 1–5 → mes anterior; día 6+ → mes actual.
 * - La factura guarda snapshot del emisor (RFC/razón social) para el PDF.
 * - El cliente jamás ve estos datos en la UI; solo el PDF timbrado (SAT).
 */

const IVA_TASA = 0.16;
const CLAVE_PROD_SERV = "90121500"; // servicios de agencias de viajes
const CLAVE_UNIDAD = "E48"; // unidad de servicio

/** Día 1–5 → mes anterior; día 6+ → mes actual. */
export function detectBillingPeriod(now = new Date()): string {
  const day = now.getUTCDate();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (day <= 5 ? 1 : 0), 1)
  );
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface EmitResult {
  ok: boolean;
  invoiceId?: string;
  facturapiInvoiceId?: string;
  uuid?: string;
  error?: string;
}

/**
 * Emite el CFDI del período para un tenant usando su emisora asignada.
 * Idempotente por (tenant, período): si ya existe con facturapi_invoice_id,
 * no re-emite.
 */
export async function emitTenantInvoice(
  tenantId: string,
  periodOverride?: string
): Promise<EmitResult> {
  const admin = createAdminClient();
  const period = periodOverride ?? detectBillingPeriod();
  const from = `${period}-01`;
  const [year, month] = from.split("-").map(Number);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const to = `${next.y}-${String(next.m).padStart(2, "0")}-01`;

  // 1. Idempotencia: ¿ya timbrada?
  const { data: existing } = await admin
    .from("invoices")
    .select("id, facturapi_invoice_id, status")
    .eq("tenant_id", tenantId)
    .eq("period", period)
    .maybeSingle();
  if (existing?.facturapi_invoice_id) {
    return {
      ok: true,
      invoiceId: existing.id,
      facturapi_invoice_id: undefined,
      facturapiInvoiceId: existing.facturapi_invoice_id,
    } as EmitResult;
  }

  // 2. Tenant + emisora (asigna si falta).
  const { data: tenantRow, error: tenantError } = await admin
    .from("tenants")
    .select(
      `id, rfc, razon_social, regimen_fiscal, issuer_company_id,
       issuer:issuer_companies (id, rfc, razon_social, regimen_fiscal,
         codigo_postal, facturapi_organization_id, facturapi_environment)`
    )
    .eq("id", tenantId)
    .single();
  if (tenantError || !tenantRow) {
    return { ok: false, error: tenantError?.message ?? "Tenant no encontrado" };
  }
  const tenant = tenantRow as unknown as {
    id: string;
    rfc: string | null;
    razon_social: string | null;
    regimen_fiscal: string | null;
    issuer_company_id: string | null;
    issuer: {
      id: string;
      rfc: string;
      razon_social: string;
      regimen_fiscal: string;
      codigo_postal: string;
      facturapi_organization_id: string | null;
      facturapi_environment: string | null;
    } | null;
  };

  let issuerCompanyId = tenant.issuer_company_id;
  if (!issuerCompanyId) {
    const { data: assigned, error: assignError } = await admin.rpc(
      "assign_issuer_to_tenant",
      { p_tenant_id: tenantId }
    );
    if (assignError || !assigned) {
      return {
        ok: false,
        error: assignError?.message ?? "No se pudo asignar emisora",
      };
    }
    issuerCompanyId = assigned as string;
    // Releer la emisora recién asignada.
    const { data: issuer } = await admin
      .from("issuer_companies")
      .select("*")
      .eq("id", issuerCompanyId)
      .single();
    if (!issuer) return { ok: false, error: "Emisora asignada no encontrada" };
    tenant.issuer = issuer as typeof tenant.issuer;
  }

  const issuer = tenant.issuer;
  if (!issuer?.facturapi_organization_id) {
    return {
      ok: false,
      error:
        "La emisora no tiene organización Facturapi (sube el CSD primero).",
    };
  }

  // 3. Trips del período + montos (misma regla que el export manual).
  const { data: trips, error: tripsError } = await admin
    .from("trips")
    .select(
      `id, destination, departure_date,
       options:trip_options (final_price, is_selected)`
    )
    .eq("tenant_id", tenantId)
    .gte("departure_date", from)
    .lt("departure_date", to)
    .order("departure_date");
  if (tripsError) return { ok: false, error: tripsError.message };

  const detail = (trips ?? []).map((trip) => {
    const options = (trip.options ?? []) as Array<{
      final_price: number | null;
      is_selected: boolean | null;
    }>;
    const selected = options.find((o) => o.is_selected) ?? options[0];
    return {
      id: trip.id,
      destination: trip.destination,
      final_price: Number(selected?.final_price ?? 0),
    };
  });
  const subtotal =
    Math.round(detail.reduce((acc, t) => acc + t.final_price, 0) * 100) / 100;
  if (subtotal <= 0) {
    return { ok: false, error: `Sin viajes facturables en ${period}.` };
  }
  const iva = Math.round(subtotal * IVA_TASA * 100) / 100;

  // 4. Emisión vía Facturapi (CFDI 4.0, una partida, IVA 16%).
  let invoice: FacturapiInvoice;
  try {
    invoice = await createInvoice(issuer.facturapi_organization_id, {
      customer: {
        legal_name: tenant.razon_social ?? "",
        tax_id: tenant.rfc,
        tax_system: tenant.regimen_fiscal ?? "601",
        address: { zip: "06600" }, // CP del receptor; TODO: capturarlo por tenant
        address_zip_missing: undefined,
      } as never,
      items: [
        {
          quantity: 1,
          product: {
            description: `Servicios de gestión de viajes - ${period}`,
            product_key: CLAVE_PROD_SERV,
            unit_key: CLAVE_UNIDAD,
            price: subtotal,
            tax_included: false,
            taxes: [{ type: "IVA", rate: IVA_TASA }],
          },
        },
      ],
      use: "G03",
      payment_form: "03",
      payment_method: "PUE",
    });
  } catch (err) {
    const message =
      err instanceof FacturapiError
        ? `Facturapi: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Error desconocido al emitir";
    await admin.from("notifications").insert({
      user_id: null,
      title: "Error de timbrado",
      body: `Tenant ${tenantId} período ${period}: ${message}`.slice(0, 500),
    });
    return { ok: false, error: message };
  }

  // 5. Registro local con snapshot del emisor.
  const { data: inserted, error: insertError } = await admin
    .from("invoices")
    .upsert(
      {
        tenant_id: tenantId,
        period,
        subtotal,
        iva,
        total: Math.round((subtotal + iva) * 100) / 100,
        status: "issued",
        issuer_company_id: issuer.id,
        facturapi_invoice_id: invoice.id,
        emisor_rfc: issuer.rfc,
        emisor_razon_social: issuer.razon_social,
        uso_cfdi: "G03",
        forma_pago: "03",
        metodo_pago: "PUE",
      },
      { onConflict: "tenant_id,period" }
    )
    .select("id")
    .single();
  if (insertError) return { ok: false, error: insertError.message };

  return {
    ok: true,
    invoiceId: inserted.id,
    facturapiInvoiceId: invoice.id,
    uuid: invoice.uuid,
  };
}
