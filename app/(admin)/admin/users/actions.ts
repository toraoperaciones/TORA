"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

interface Ok {
  ok: true;
}
interface Err {
  ok: false;
  error: string;
}

export async function activateUserAction(
  userId: string,
  tenantId: string | null,
  role: string
): Promise<Ok | Err> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_user", {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_role: role,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/admin/tenants");
  return { ok: true };
}

export async function updateUserAction(
  userId: string,
  tenantId: string | null,
  role: string
): Promise<Ok | Err> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_user_role", {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_role: role,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserStatusAction(
  userId: string,
  newStatus: "active" | "suspended"
): Promise<Ok | Err> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_user_status", {
    p_user_id: userId,
    p_new_status: newStatus,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Invita un usuario: auth.users + fila activa con tenant/rol (RPC). */
export async function inviteUserAction(input: {
  email: string;
  fullName: string;
  tenantId: string | null;
  role: string;
  password: string;
}): Promise<Ok | Err> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_user", {
    p_email: input.email,
    p_full_name: input.fullName,
    p_tenant_id: input.tenantId,
    p_role: input.role,
    p_password: input.password,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/admin/tenants");
  return { ok: true };
}
