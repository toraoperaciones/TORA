"use server";

import { revalidatePath } from "next/cache";

import { emitTenantInvoice } from "@/lib/business/cfdi";
import { createClient } from "@/lib/supabase/server";

export interface TenantInvoiceResult {
  tenantId: string;
  tenantName: string;
  ok: boolean;
  facturapiInvoiceId?: string;
  uuid?: string;
  error?: string;
}

async function requireFinanceRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "No autenticado";
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "TORA_FINANCE" && profile?.role !== "TORA_ADMIN") {
    return "Solo TORA_FINANCE o TORA_ADMIN";
  }
  return null;
}

/**
 * Emite el CFDI del período para UN tenant. El dialog de facturación masiva
 * lo llama en secuencia para mostrar progreso real y reintentar fallidos.
 * Idempotente: no re-emite si el período ya está timbrado.
 */
export async function invoiceTenantAction(input: {
  tenantId: string;
  tenantName: string;
  period?: string;
}): Promise<TenantInvoiceResult> {
  const authError = await requireFinanceRole();
  if (authError) {
    return { tenantId: input.tenantId, tenantName: input.tenantName, ok: false, error: authError };
  }

  const result = await emitTenantInvoice(input.tenantId, input.period);
  revalidatePath("/finance/invoices");
  revalidatePath("/admin/invoices");

  return {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    ok: result.ok,
    facturapiInvoiceId: result.facturapiInvoiceId,
    uuid: result.uuid,
    error: result.error,
  };
}
