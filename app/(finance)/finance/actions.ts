"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

interface ActionOk {
  ok: true;
}
interface ActionError {
  ok: false;
  error: string;
}

/**
 * Flujo B: aprueba el depósito (RPC security definer, transaccional)
 * y re-evalúa los trips en awaiting_payment del tenant.
 */
export async function approveDepositAction(
  transactionId: string
): Promise<{ ok: true; confirmed_trips: number } | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("approve_deposit", {
    p_transaction_id: transactionId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/deposits");
  revalidatePath("/finance/dashboard");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");

  return {
    ok: true,
    confirmed_trips: (data as { confirmed_trips?: number })?.confirmed_trips ?? 0,
  };
}

export async function rejectDepositAction(
  transactionId: string,
  reason: string
): Promise<ActionOk | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (reason.trim().length < 5) {
    return { ok: false, error: "Describe el motivo del rechazo (mín. 5 caracteres)" };
  }

  const { error } = await supabase.rpc("reject_deposit", {
    p_transaction_id: transactionId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/deposits");
  return { ok: true };
}

/** Flujo C: aprobar crédito para cubrir el charge pendiente de un trip. */
export async function approveCreditForTripAction(
  tripId: string,
  newLimit: number | null
): Promise<ActionOk | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("approve_credit_for_trip", {
    p_trip_id: tripId,
    p_new_limit: newLimit,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/credit");
  revalidatePath("/finance/dashboard");
  return { ok: true };
}

export async function upsertCreditLineAction(
  tenantId: string,
  limit: number,
  interestRate: number
): Promise<ActionOk | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (!(limit > 0)) {
    return { ok: false, error: "El límite debe ser mayor a 0" };
  }
  if (interestRate < 0 || interestRate > 1) {
    return { ok: false, error: "La tasa debe estar entre 0 y 1 (ej. 0.025)" };
  }

  const { data: existing } = await supabase
    .from("credit_lines")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("credit_lines")
      .update({
        approved_limit: limit,
        interest_rate: interestRate,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("credit_lines").insert({
      tenant_id: tenantId,
      approved_limit: limit,
      interest_rate: interestRate,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/finance/credit");
  revalidatePath("/finance/dashboard");
  return { ok: true };
}

/** Suspensión manual por mora 90+ (la RPC también suspende la línea activa). */
export async function suspendTenantAction(
  tenantId: string
): Promise<ActionOk | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("suspend_tenant", {
    p_tenant_id: tenantId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/credit");
  revalidatePath("/finance/dashboard");
  return { ok: true };
}
