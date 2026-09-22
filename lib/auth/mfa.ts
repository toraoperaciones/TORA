import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers de MFA TOTP (Supabase Auth). El flag de producto vive en
 * public.users.mfa_enabled y SOLO se escribe vía RPC set_mfa_flag,
 * que verifica contra auth.mfa_factors que exista un factor verificado.
 */

export type MfaFactor = {
  id: string;
  totp: { qr_code?: string | null; secret?: string | null };
};

/** El usuario tiene al menos un factor TOTP verificado (lado servidor). */
export async function hasVerifiedFactor(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  if (data) {
    return data.totp.some((f) => f.status === "verified");
  }
  return false;
}

/** Lee mfa_enabled de la fila propia en public.users. */
export async function mfaFlagFromProfile(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: profile } = await supabase
    .from("users")
    .select("mfa_enabled")
    .eq("id", data.user.id)
    .single();
  return profile?.mfa_enabled ?? false;
}

/** AAL2 = hay una sesión reforzada por un segundo factor verificado. */
export async function sessionIsAal2(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

/** Inscribe un factor TOTP y devuelve QR + secret para la app autenticadora. */
export async function enrollTotp(supabase: SupabaseClient): Promise<MfaFactor> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "TORA",
  });
  if (error || !data) throw new Error(error?.message ?? "No se pudo iniciar la inscripción");
  return data as unknown as MfaFactor;
}

/** Verifica el código de 6 dígitos durante la inscripción. */
export async function verifyEnrollment(
  supabase: SupabaseClient,
  factorId: string,
  code: string
): Promise<boolean> {
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: (await supabase.auth.mfa.challenge({ factorId })).data?.id ?? "",
    code,
  });
  return !error;
}

/** Challenge+verify del login (sesión ya iniciada con password). */
export async function verifyLoginChallenge(
  supabase: SupabaseClient,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified");
  if (!totp) return { ok: false, error: "No hay factor activo" };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeError || !challenge) return { ok: false, error: "No se pudo iniciar la verificación" };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { ok: false, error: "Código incorrecto. Intenta de nuevo." };
  return { ok: true };
}
