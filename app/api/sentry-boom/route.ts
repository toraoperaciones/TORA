import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Ruta temporal: lanza un error real para verificar onRequestError → Sentry. Se elimina tras validar. */
export async function GET() {
  throw new Error("test-sentry-boom");
  return NextResponse.json({ ok: false });
}
