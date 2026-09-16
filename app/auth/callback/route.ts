import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Intercambia el `code` de Supabase Auth (magic links, OAuth, confirmación
 * de email) por una sesión de cookies. `next` permite redirigir al destino
 * original tras el intercambio.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` debe ser una ruta interna para evitar open redirects.
  const rawNext = searchParams.get("next") ?? "/pending";
  const next = rawNext.startsWith("/") ? rawNext : "/pending";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
