"use server";

import { revalidatePath } from "next/cache";

import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const OPS_ROLES: Role[] = ["TORA_OPS", "TORA_ADMIN"];

interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireOpsRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "No autenticado" as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !OPS_ROLES.includes(profile.role as Role)) {
    return { supabase, error: "No autorizado" as const };
  }
  return { supabase, error: null };
}

/**
 * Override de emergencia: confirma el booking sin validar pago.
 * El flujo normal lo resuelve la RPC select_trip_option (Fase 4) o
 * la re-evaluación de FINANCE (Fase 6).
 */
export async function confirmBookingAction(tripId: string): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireOpsRole();
  if (authErr) return { ok: false, error: authErr };

  const { data: trip } = await supabase
    .from("trips")
    .select("id, status")
    .eq("id", tripId)
    .single();
  if (trip?.status !== "awaiting_payment") {
    return { ok: false, error: "El trip no está en espera de pago" };
  }

  const { data: option } = await supabase
    .from("trip_options")
    .select("id")
    .eq("trip_id", tripId)
    .eq("is_selected", true)
    .maybeSingle();
  if (!option) return { ok: false, error: "No hay opción seleccionada" };

  const confirmation = `TORA-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const { error: bookErr } = await supabase.from("bookings").insert({
    trip_id: tripId,
    option_id: option.id,
    confirmation_number: confirmation,
    status: "confirmed",
  });
  if (bookErr) return { ok: false, error: bookErr.message };

  const { error: updErr } = await supabase
    .from("trips")
    .update({ status: "confirmed" })
    .eq("id", tripId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/ops/trips/${tripId}/quote`);
  revalidatePath("/ops/trips");
  revalidatePath("/ops/inbox");
  return { ok: true };
}

export async function completeTripAction(tripId: string): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireOpsRole();
  if (authErr) return { ok: false, error: authErr };

  const { data: trip } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .single();
  if (trip?.status !== "confirmed") {
    return { ok: false, error: "El trip no está confirmado" };
  }

  const { error } = await supabase
    .from("trips")
    .update({ status: "completed" })
    .eq("id", tripId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ops/trips/${tripId}/quote`);
  revalidatePath("/ops/trips");
  return { ok: true };
}

export async function reopenQuoteAction(tripId: string): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireOpsRole();
  if (authErr) return { ok: false, error: authErr };

  const { data: trip } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .single();
  if (trip?.status !== "awaiting_selection") {
    return { ok: false, error: "Solo se puede reabrir en espera de selección" };
  }

  const { error } = await supabase
    .from("trips")
    .update({ status: "options_sent" })
    .eq("id", tripId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ops/trips/${tripId}/quote`);
  revalidatePath("/ops/trips");
  revalidatePath("/ops/inbox");
  return { ok: true };
}

// ── Incidentes ────────────────────────────────────────────────

const INCIDENT_TYPES = [
  "flight_delay",
  "flight_cancelled",
  "hotel_issue",
  "car_issue",
  "billing_issue",
  "other",
] as const;

const INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export async function createIncidentAction(input: {
  tripId: string;
  type: string;
  severity: string;
  description: string;
}): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireOpsRole();
  if (authErr) return { ok: false, error: authErr };

  if (!INCIDENT_TYPES.includes(input.type as (typeof INCIDENT_TYPES)[number])) {
    return { ok: false, error: "Tipo de incidente inválido" };
  }
  if (
    !INCIDENT_SEVERITIES.includes(
      input.severity as (typeof INCIDENT_SEVERITIES)[number]
    )
  ) {
    return { ok: false, error: "Severidad inválida" };
  }
  if (input.description.trim().length < 5) {
    return { ok: false, error: "Describe el incidente (mín. 5 caracteres)" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("incidents").insert({
    trip_id: input.tripId,
    type: input.type,
    severity: input.severity,
    description: input.description.trim(),
    status: "open",
    reported_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ops/incidents");
  return { ok: true };
}

export async function resolveIncidentAction(input: {
  incidentId: string;
  resolutionNotes: string;
}): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireOpsRole();
  if (authErr) return { ok: false, error: authErr };

  if (input.resolutionNotes.trim().length < 5) {
    return { ok: false, error: "Describe la resolución (mín. 5 caracteres)" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("incidents")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
      resolution_notes: input.resolutionNotes.trim(),
    })
    .eq("id", input.incidentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ops/incidents");
  return { ok: true };
}
