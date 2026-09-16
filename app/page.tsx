import { redirect } from "next/navigation";

import { homeForRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Root: envía a cada usuario a su portal; invitados a /login;
 * cuentas sin activar a /pending.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/pending");

  redirect(homeForRole(profile.role as Role));
}
