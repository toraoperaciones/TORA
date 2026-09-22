import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MfaChallengeForm } from "./mfa-challenge-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verificación en dos pasos · TORA" };

/**
 * Challenge MFA del login (ruta intermedia protegida por middleware).
 * Llega aquí solo quien tiene sesión de password + mfa_enabled sin AAL2.
 * Si ya está en AAL2, entra directo al portal.
 */
export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ya verificado (AAL2) → portal.
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-8">
      <MfaChallengeForm />
    </div>
  );
}
