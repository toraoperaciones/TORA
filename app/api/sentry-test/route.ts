import { NextResponse } from "next/server";

import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/** Ruta temporal para verificar la entrega de eventos a Sentry. Se elimina tras validar. */
export async function GET() {
  const eventId = Sentry.captureException(new Error("test-sentry"));
  await Sentry.flush(5000);
  return NextResponse.json({ ok: true, eventId });
}
