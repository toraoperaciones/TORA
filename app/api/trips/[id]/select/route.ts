import { NextResponse } from "next/server";

import { processTripCharge } from "@/lib/business/payment-methods";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/trips/[id]/select
 * Selección de opción de viaje por CLIENT_ADMIN, diferenciada por método
 * de pago:
 *
 * - prepaid: la lógica crítica vive en la RPC `select_trip_option`
 *   (security definer, transaccional). NUNCA usar service-role aquí.
 * - cash: `processTripCharge` crea el charge pendiente y produce
 *   instrucciones SPEI; el trip queda pending_payment hasta que FINANCE
 *   apruebe el depósito vinculado (approve_deposit v2).
 * - credit: Sprint 2 — se rechaza con 400.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  let body: { option_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!body.option_id) {
    return NextResponse.json({ error: "option_id requerido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificación de rol en el borde (la RPC vuelve a validar en Postgres).
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "CLIENT_ADMIN") {
    return NextResponse.json(
      { error: "Solo CLIENT_ADMIN puede seleccionar opciones" },
      { status: 403 }
    );
  }

  // Método del trip: snapshot al crear; si es anterior al modelo, el del tenant.
  const { data: trip } = await supabase
    .from("trips")
    .select("payment_method_snapshot, tenants(payment_method)")
    .eq("id", tripId)
    .single();
  if (!trip) {
    return NextResponse.json({ error: "Trip no encontrado" }, { status: 404 });
  }
  const tenantRow = Array.isArray(trip.tenants) ? trip.tenants[0] : trip.tenants;
  const method: "cash" | "prepaid" | "credit" =
    (trip.payment_method_snapshot as "cash" | "prepaid" | "credit" | null) ??
    (tenantRow?.payment_method as "cash" | "prepaid" | "credit" | undefined) ??
    "prepaid";

  if (method === "credit") {
    return NextResponse.json(
      { error: "Crédito disponible en Sprint 2" },
      { status: 400 }
    );
  }

  if (method === "cash") {
    const result = await processTripCharge(tripId, body.option_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  const { data, error } = await supabase.rpc("select_trip_option", {
    p_trip_id: tripId,
    p_option_id: body.option_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
