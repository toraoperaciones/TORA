"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/encryption";
import {
  createOrganization,
  uploadCertificate,
} from "@/lib/facturapi/client";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" as const };
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "TORA_ADMIN") {
    return { error: "Solo TORA_ADMIN" as const };
  }
  return { admin: createAdminClient() };
}

export interface CreateIssuerInput {
  internal_name: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal: string;
  sat_monthly_limit: number;
}

/**
 * Alta de emisora: crea la organización en Facturapi (modo test salvo que
 * se indique live) y guarda solo el organization_id — jamás la API key.
 */
export async function createIssuerAction(
  input: CreateIssuerInput
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const rfc = input.rfc.trim().toUpperCase();
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    return { ok: false, error: "RFC inválido" };
  }

  let orgId: string | null = null;
  try {
    const org = await createOrganization({
      legal_name: input.razon_social.trim(),
      tax_id: rfc,
      zip: input.codigo_postal.trim(),
    });
    orgId = org.id;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear organización",
    };
  }

  const { error } = await auth.admin.from("issuer_companies").insert({
    internal_name: input.internal_name.trim(),
    rfc,
    razon_social: input.razon_social.trim(),
    regimen_fiscal: input.regimen_fiscal.trim(),
    codigo_postal: input.codigo_postal.trim(),
    facturapi_organization_id: orgId,
    facturapi_environment: "test",
    sat_monthly_limit: input.sat_monthly_limit,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/issuers");
  return { ok: true };
}

export interface UploadCsdInput {
  issuerId: string;
  cer_b64: string;
  key_b64: string;
  password: string;
}

/**
 * Subida de CSD: se envía a Facturapi (que lo valida contra SAT) y se
 * guarda cifrado local (AES-256-GCM) para re-emisión si Facturapi lo
 * pidiera de nuevo. El password NUNCA se loguea ni se retorna.
 */
export async function uploadCsdAction(
  input: UploadCsdInput
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const { data: issuer } = await auth.admin
    .from("issuer_companies")
    .select("id, razon_social, rfc, codigo_postal, facturapi_organization_id")
    .eq("id", input.issuerId)
    .single();
  if (!issuer) return { ok: false, error: "Emisora no encontrada" };

  let orgId = issuer.facturapi_organization_id as string | null;
  if (!orgId) {
    try {
      const org = await createOrganization({
        legal_name: issuer.razon_social,
        tax_id: issuer.rfc,
        zip: issuer.codigo_postal,
      });
      orgId = org.id;
      await auth.admin
        .from("issuer_companies")
        .update({ facturapi_organization_id: orgId })
        .eq("id", issuer.id);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Error al crear organización",
      };
    }
  }

  try {
    await uploadCertificate(orgId, {
      cer_b64: input.cer_b64,
      key_b64: input.key_b64,
      password: input.password,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Facturapi rechazó el CSD",
    };
  }

  // Cifrado en reposo. Si el descifrado falla, es un problema de llave —
  // se detecta aquí y no al facturar.
  const encrypted = {
    csd_cer_encrypted: encryptSecret(input.cer_b64),
    csd_key_encrypted: encryptSecret(input.key_b64),
    csd_password_encrypted: encryptSecret(input.password),
  };
  decryptSecret(encrypted.csd_password_encrypted); // sanity check

  const { error } = await auth.admin
    .from("issuer_companies")
    .update({ ...encrypted, csd_uploaded_at: new Date().toISOString() })
    .eq("id", issuer.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/issuers");
  return { ok: true };
}
