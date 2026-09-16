import { NextResponse } from "next/server";

import { getClientContext } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = ["receipts", "invoices"] as const;
const STAFF_ROLES = ["TORA_OPS", "TORA_ADMIN", "TORA_FINANCE"];

/**
 * Genera una signed URL (1h) para un archivo privado.
 * Autorización (defensa en profundidad; el bucket RLS valida igual en PostgREST):
 *  - Staff TORA: cualquier path de `receipts`/`invoices`.
 *  - Cliente: solo paths bajo su carpeta `{tenant_id}/`.
 */
async function buildSignedResponse(path: string, bucket: string) {
  if (!path || !ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
    return NextResponse.json({ error: "path o bucket inválido" }, { status: 400 });
  }

  const ctx = await getClientContext();
  const isStaff = STAFF_ROLES.includes(ctx.role);
  const ownsPath = Boolean(ctx.tenantId) && path.startsWith(`${ctx.tenantId}/`);
  if (!isStaff && !ownsPath) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo generar el enlace" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(data.signedUrl, { status: 303 });
}

/** GET /api/receipts/signed-url?path=...&bucket=receipts — usado por links de facturas. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return buildSignedResponse(
    searchParams.get("path") ?? "",
    searchParams.get("bucket") ?? "receipts"
  );
}

/** POST (form action) — usado por "Ver comprobante" en /wallet. */
export async function POST(request: Request) {
  const form = await request.formData();
  return buildSignedResponse(
    String(form.get("path") ?? ""),
    String(form.get("bucket") ?? "receipts")
  );
}
