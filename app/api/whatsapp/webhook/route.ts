import { NextResponse } from "next/server";

/**
 * Webhook de eventos WAHA (WHATSAPP_HOOK_EVENTS: message.any, session.status).
 * Fase 3 solo registra: Fase 2 agregará respuestas automáticas si el negocio
 * lo pide. Nunca lanza: WAHA reintenta y podría duplicar eventos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { event?: string; session?: string };
    console.log("[WAHA webhook]", { event: body.event, session: body.session });
  } catch {
    // Cuerpo ilegible: responder 200 para no ciclar los reintentos de WAHA.
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "tora-whatsapp-webhook" });
}
