import { createClient } from "@/lib/supabase/server";

import type { Role } from "@/lib/auth/roles";

export interface ClientContext {
  userId: string;
  role: Role;
  fullName: string;
  email: string;
  /** null para staff TORA (no tienen tenant propio). */
  tenantId: string | null;
}

/**
 * Contexto del usuario autenticado para páginas de servidor.
 * El layout de portal ya garantiza sesión + status active; aquí solo
 * se recuperan los datos necesarios para las queries de negocio.
 */
export async function getClientContext(): Promise<ClientContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email, tenant_id")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    role: (profile?.role ?? "CLIENT_ADMIN") as Role,
    fullName: profile?.full_name ?? "",
    email: profile?.email ?? "",
    tenantId: profile?.tenant_id ?? null,
  };
}
