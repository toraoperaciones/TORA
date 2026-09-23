"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/whatsapp/notify";
import { templates } from "@/lib/whatsapp/templates";

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

  // Notificación al creador del depósito (in-app + WhatsApp si opt-in).
  const { data: deposit } = await supabase
    .from("wallet_transactions")
    .select("tenant_id, amount, created_by, users:created_by (full_name)")
    .eq("id", transactionId)
    .single();
  if (deposit?.created_by) {
    const creator = Array.isArray(deposit.users) ? deposit.users[0] : deposit.users;
    await notifyUser({
      userId: deposit.created_by,
      type: "deposit_validated",
      payload: { deposit_id: transactionId, amount: Number(deposit.amount) },
      whatsappText: templates.depositValidated({
        fullName: creator?.full_name ?? "",
        amount: Number(deposit.amount).toFixed(2),
      }),
    });
  }

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

/**
 * Sprint 2: liquidar un trip a crédito (RPC atómica settle_credit_trip:
 * credit_payment + charge→completed + credit_used baja + factura interna pagada).
 */
export async function settleCreditTripAction(
  tripId: string,
  paymentReference: string
): Promise<ActionOk | ActionError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (paymentReference.trim().length < 4) {
    return { ok: false, error: "La referencia de pago es obligatoria (mín. 4 caracteres)" };
  }

  const { error } = await supabase.rpc("settle_credit_trip", {
    p_trip_id: tripId,
    p_payment_reference: paymentReference.trim(),
  });
  if (error) return { ok: false, error: error.message };

  // Notificación al solicitante del trip (in-app + WhatsApp si opt-in).
  const { data: trip } = await supabase
    .from("trips")
    .select(
      `destination, credit_due_date, requester_id,
       requester:requester_id (full_name)`
    )
    .eq("id", tripId)
    .single();
  if (trip) {
    const requester = Array.isArray(trip.requester) ? trip.requester[0] : trip.requester;
    await notifyUser({
      userId: trip.requester_id,
      type: "credit_settled",
      payload: { trip_id: tripId, reference: paymentReference.trim() },
      whatsappText: templates.creditApproved({
        fullName: requester?.full_name ?? "",
        destination: trip.destination,
        dueDate: trip.credit_due_date ?? "—",
      }),
    });
  }

  revalidatePath("/finance/credit");
  revalidatePath("/finance/dashboard");
  revalidatePath("/dashboard");
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
