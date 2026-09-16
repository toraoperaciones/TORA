import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/trips/[id]/select
 * Selección de opción de viaje por CLIENT_ADMIN.
 *
 * Deliberadamente DELGADO: la lógica crítica (validaciones de estado,
 * marcado de opciones, charge, balance, booking) vive en la RPC
 * `select_trip_option` (security definer, transaccional). NUNCA usar
 * el cliente admin (service role) aquí.
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

  const { data, error } = await supabase.rpc("select_trip_option", {
    p_trip_id: tripId,
    p_option_id: body.option_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
