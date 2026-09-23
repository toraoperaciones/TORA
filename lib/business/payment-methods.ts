import { createClient } from "@/lib/supabase/server";

import { speiReference, type PaymentMethod } from "./payment-method";

/**
 * Modelo de pago (Sprint 1): cash + prepaid. credit queda sembrado en
 * schema pero su lógica se activa en Sprint 2.
 *
 * - prepaid: lo maneja íntegramente la RPC select_trip_option (NO tocar).
 * - cash: esta librería crea el charge pending y produce instrucciones SPEI.
 * - credit: activado en Sprint 2 — valida cupo, confirma y suma el cache.
 */

export type { PaymentMethod };
export { PAYMENT_METHOD_LABEL, speiReference } from "./payment-method";

export interface SpeiInstructions {
  clabe: string;
  beneficiary: string;
  amount: number;
  reference: string;
}

export interface ProcessChargeResult {
  ok: boolean;
  method: PaymentMethod;
  tripStatus: "awaiting_payment" | "confirmed";
  chargeId?: string;
  error?: string;
  shortfall?: number;
  speiInstructions?: SpeiInstructions;
}

/**
 * Procesa el cargo de un trip tras seleccionar opción — SOLO cash.
 * prepaid lo maneja la RPC select_trip_option; credit es Sprint 2.
 */
export async function processTripCharge(
  tripId: string,
  optionId: string,
): Promise<ProcessChargeResult> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, tenant_id, status, payment_method_snapshot, tenants(payment_method, credit_days)")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) {
    return { ok: false, method: "cash", tripStatus: "awaiting_payment", error: "Trip no encontrado" };
  }
  if (!["options_sent", "awaiting_selection"].includes(trip.status)) {
    return {
      ok: false,
      method: "cash",
      tripStatus: "awaiting_payment",
      error: `Estado de trip inválido: ${trip.status}`,
    };
  }

  // El snapshot manda; si el trip es anterior al modelo, el método vigente
  // es el del tenant.
  const tenantRow = Array.isArray(trip.tenants) ? trip.tenants[0] : trip.tenants;
  const method: PaymentMethod =
    (trip.payment_method_snapshot as PaymentMethod | null) ??
    (tenantRow?.payment_method as PaymentMethod | undefined) ??
    "prepaid";
  if (method === "prepaid") {
    return {
      ok: false,
      method,
      tripStatus: "awaiting_payment",
      error: "prepaid debe manejarse vía RPC select_trip_option",
    };
  }

  const { data: option, error: optionError } = await supabase
    .from("trip_options")
    .select("final_price")
    .eq("id", optionId)
    .eq("trip_id", tripId)
    .single();
  if (optionError || !option) {
    return { ok: false, method, tripStatus: "awaiting_payment", error: "Opción no válida" };
  }

  // ── CREDIT: valida cupo ANTES de crear el charge; confirma el trip con
  // fecha de vencimiento y suma al cache credit_used (RPC atómica).
  if (method === "credit") {
    const price = Number(option.final_price);
    const available = await calculateAvailableCredit(trip.tenant_id);
    if (available < price) {
      return {
        ok: false,
        method,
        tripStatus: "awaiting_payment",
        error: `Crédito insuficiente. Disponible: $${available.toFixed(2)}. Este viaje cuesta: $${price.toFixed(2)}. Contacta a TORA para ampliar tu línea.`,
        shortfall: price - available,
      };
    }

    // Espejo de select_trip_option: marcar la opción elegida.
    const { error: selectError } = await supabase
      .from("trip_options")
      .update({ is_selected: true })
      .eq("id", optionId);
    if (selectError) {
      return { ok: false, method, tripStatus: "awaiting_payment", error: selectError.message };
    }

    const { data: charge, error: chargeError } = await supabase
      .from("wallet_transactions")
      .insert({
        tenant_id: trip.tenant_id,
        amount: price,
        type: "charge",
        status: "pending",
        reference: `CREDIT-${speiReference(tripId)}`,
        related_trip_id: tripId,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .select("id")
      .single();
    if (chargeError || !charge) {
      return {
        ok: false,
        method,
        tripStatus: "awaiting_payment",
        error: chargeError?.message ?? "No se pudo crear el cargo",
      };
    }

    // Vencimiento = hoy (CDMX) + credit_days. Con new Date().toISOString()
    // el límite del día sería UTC y vencería un día antes/depués según hora.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Number(tenantRow?.credit_days ?? 30));
    const dueDateCdmx = dueDate.toLocaleDateString("en-CA", {
      timeZone: "America/Mexico_City",
    });
    const { error: updateError } = await supabase
      .from("trips")
      .update({
        status: "confirmed",
        credit_due_date: dueDateCdmx,
        payment_method_snapshot: "credit",
      })
      .eq("id", tripId);
    if (updateError) {
      return { ok: false, method, tripStatus: "awaiting_payment", error: updateError.message };
    }

    // Cache credit_used: el selector es CLIENT_ADMIN, pero la RPC solo
    // acepta staff. El insert del charge (RLS) ya valida su identidad; el
    // cache se ajusta con service-role vía el entorno server de la app.
    const { error: incError } = await supabase.rpc("increment_credit_used", {
      p_tenant_id: trip.tenant_id,
      p_amount: price,
    });
    if (incError) {
      return { ok: false, method, tripStatus: "confirmed", error: incError.message };
    }

    return { ok: true, method: "credit", tripStatus: "confirmed", chargeId: charge.id };
  }

  // Marcar la opción elegida (espejo de lo que hace select_trip_option en
  // prepaid): approve_deposit v2 crea el booking con is_selected = true.
  const { error: selectError } = await supabase
    .from("trip_options")
    .update({ is_selected: true })
    .eq("id", optionId);
  if (selectError) {
    return { ok: false, method, tripStatus: "awaiting_payment", error: selectError.message };
  }

  // Charge pendiente vinculado al trip (el depósito que lo cubra lo
  // completará approve_deposit v2 vía related_trip_id).
  const { data: charge, error: chargeError } = await supabase
    .from("wallet_transactions")
    .insert({
      tenant_id: trip.tenant_id,
      amount: option.final_price,
      type: "charge",
      status: "pending",
      reference: "PENDING_SPEI",
      related_trip_id: tripId,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();
  if (chargeError || !charge) {
    return { ok: false, method, tripStatus: "awaiting_payment", error: chargeError?.message ?? "No se pudo crear el cargo" };
  }

  const { error: updateError } = await supabase
    .from("trips")
    .update({ status: "awaiting_payment", payment_method_snapshot: "cash" })
    .eq("id", tripId);
  if (updateError) {
    return { ok: false, method, tripStatus: "awaiting_payment", error: updateError.message };
  }

  const instructions = await getSpeiInstructions(tripId);
  return {
    ok: true,
    method: "cash",
    tripStatus: "awaiting_payment",
    chargeId: charge.id,
    speiInstructions: instructions ?? undefined,
  };
}

interface SelectedOptionRow {
  final_price: number | null;
}

/**
 * Crédito disponible REAL (no el cache tenants.credit_used):
 * credit_limit - suma de opciones seleccionadas de trips a crédito
 * aún no pagados. El precio vive en trip_options.final_price.
 */
export async function calculateAvailableCredit(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("credit_limit")
    .eq("id", tenantId)
    .single();
  if (!tenant) return 0;

  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("payment_method_snapshot", "credit")
    .is("paid_at", null)
    .in("status", ["confirmed", "awaiting_payment"]);

  const tripIds = (trips ?? []).map((t) => t.id);
  if (tripIds.length === 0) return Number(tenant.credit_limit);

  const { data: options } = await supabase
    .from("trip_options")
    .select("final_price")
    .eq("is_selected", true)
    .in("trip_id", tripIds);

  const used = ((options ?? []) as SelectedOptionRow[]).reduce(
    (acc, o) => acc + Number(o.final_price ?? 0),
    0,
  );
  return Number(tenant.credit_limit) - used;
}

/** Balance de billetera: depósitos + reembolsos - cargos (completed). */
export async function calculateWalletBalance(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("amount, type, status")
    .eq("tenant_id", tenantId)
    .eq("status", "completed");
  if (error) return 0;

  return (data ?? []).reduce((acc, tx) => {
    if (tx.type === "deposit" || tx.type === "refund") return acc + Number(tx.amount);
    if (tx.type === "charge") return acc - Number(tx.amount);
    return acc;
  }, 0);
}

/**
 * Instrucciones SPEI para un trip en cash con pago pendiente.
 * null si el trip no califica o al tenant le falta configurar CLABE.
 */
export async function getSpeiInstructions(
  tripId: string,
): Promise<SpeiInstructions | null> {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, tenant_id, status, payment_method_snapshot")
    .eq("id", tripId)
    .single();
  if (!trip || trip.status !== "awaiting_payment" || trip.payment_method_snapshot !== "cash") {
    return null;
  }

  const { data: charge } = await supabase
    .from("wallet_transactions")
    .select("amount")
    .eq("related_trip_id", tripId)
    .eq("type", "charge")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!charge) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("spei_clabe, spei_beneficiary")
    .eq("id", trip.tenant_id)
    .single();
  if (!tenant?.spei_clabe) return null;

  return {
    clabe: tenant.spei_clabe,
    beneficiary: tenant.spei_beneficiary ?? "TORA SA de CV",
    amount: Number(charge.amount),
    reference: speiReference(tripId),
  };
}
