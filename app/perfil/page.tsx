import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { createClient } from "@/lib/supabase/server";

import { ProfileMfaCard } from "./profile-mfa-card";

export const metadata = { title: "Mi perfil · TORA" };

/**
 * Perfil del usuario (cualquier rol). Server Component: lee el estado MFA
 * real del auth (factor verificado) y el flag de producto en public.users.
 */
export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: factors }] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, email, role, mfa_enabled, mfa_enabled_at")
      .eq("id", user.id)
      .single(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (!profile) redirect("/pending");

  const verifiedTotp = factors?.totp.find((f) => f.status === "verified");

  return (
    <PortalShell
      role={profile.role}
      fullName={profile.full_name ?? ""}
      email={profile.email}
    >
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-foreground">Mi perfil</h1>
        <ProfileMfaCard
          email={profile.email}
          flagEnabled={profile.mfa_enabled ?? false}
          hasVerifiedFactor={Boolean(verifiedTotp)}
          enabledAt={profile.mfa_enabled_at}
        />
      </div>
    </PortalShell>
  );
}
