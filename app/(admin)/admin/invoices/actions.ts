"use server";

import { revalidatePath } from "next/cache";

import { buildInvoiceExport } from "@/lib/business/invoice-export";
import { createClient } from "@/lib/supabase/server";

interface Ok {
  ok: true;
}
interface Err {
  ok: false;
  error: string;
}

/**
 * Export JSON para timbrado manual (el contador lo sube al PAC).
 * Solo TORA_ADMIN / TORA_FINANCE; buildInvoiceExport lanza con mensaje
 * claro si faltan datos fiscales del tenant.
 */
export async function exportInvoiceJsonAction(
  tenantId: string,
  period: string
): Promise<{ ok: true; json: string } | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["TORA_ADMIN", "TORA_FINANCE"].includes(profile.role)) {
    return { ok: false, error: "No autorizado" };
  }

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { ok: false, error: "Período inválido (formato YYYY-MM)" };
  }

  try {
    const payload = await buildInvoiceExport(tenantId, period);
    return { ok: true, json: JSON.stringify(payload, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function createInvoiceAction(input: {
  tenantId: string;
  period: string;
  subtotal: number;
  iva: number;
  total: number;
  cfdiUuid: string | null;
  pdfPath: string | null;
  xmlPath: string | null;
}): Promise<Ok | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.from("invoices").insert({
    tenant_id: input.tenantId,
    period: input.period,
    subtotal: input.subtotal,
    iva: input.iva,
    total: input.total,
    cfdi_uuid: input.cfdiUuid,
    pdf_url: input.pdfPath,
    xml_url: input.xmlPath,
    status: "issued",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/invoices");
  revalidatePath("/finance/invoices");
  return { ok: true };
}

export async function updateInvoiceStatusAction(
  invoiceId: string,
  newStatus: "draft" | "issued" | "paid" | "cancelled"
): Promise<Ok | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase
    .from("invoices")
    .update({ status: newStatus })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/invoices");
  revalidatePath("/finance/invoices");
  return { ok: true };
}
