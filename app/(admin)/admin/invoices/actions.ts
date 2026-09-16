"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

interface Ok {
  ok: true;
}
interface Err {
  ok: false;
  error: string;
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
