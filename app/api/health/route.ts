import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check v2 (Sprint 5): ping real a la base (latencia) + tenants
 * activos. 200 si la DB responde, 503 si no — consumible por UptimeRobot.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    // El health es anónimo: con el cliente server (anon) la RLS ocultaría
    // todo y el conteo siempre daría 0. El cliente admin solo expone un
    // número, nunca datos.
    const { count: activeTenants, error: dbError } = await createAdminClient()
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const latencyMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: !dbError,
        service: "tora",
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            ok: !dbError,
            latency_ms: latencyMs,
            error: dbError?.message ?? null,
          },
          tenants: { active: activeTenants ?? 0 },
        },
      },
      { status: dbError ? 503 : 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: "tora",
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            ok: false,
            latency_ms: Date.now() - startedAt,
            error: err instanceof Error ? err.message : "unknown",
          },
          tenants: { active: 0 },
        },
      },
      { status: 503 }
    );
  }
}
