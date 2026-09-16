import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ROLE_TO_PORTAL, type Portal, type Role } from "./roles";

/**
 * Guard común de portales. Valida sesión + perfil activo + portal correcto.
 * TORA_ADMIN entra a todos los portales.
 * redirect() lanza NEXT_REDIRECT, así que el retorno siempre es un perfil válido.
 */
export async function guardPortal(expected: Portal): Promise<{
  role: Role;
  fullName: string;
  email: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/pending");

  const role = profile.role as Role;
  if (role !== "TORA_ADMIN" && ROLE_TO_PORTAL[role] !== expected) {
    redirect("/");
  }

  return {
    role,
    fullName: profile.full_name ?? "",
    email: profile.email,
  };
}
