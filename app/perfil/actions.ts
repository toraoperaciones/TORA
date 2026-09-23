"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Preferencias propias de WhatsApp (opt-in LFPDPPP). La RPC security definer
 * es el único dueño: la RLS no permite UPDATE self (y no debe, evitaría
 * escalación de role/status) y la RPC valida teléfono + estado activo.
 */
export async function updateWhatsAppPreferencesAction(
  phone: string | null,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (enabled && (!phone || phone.trim().length < 8)) {
    return { ok: false, error: "Captura tu teléfono para activar las notificaciones" };
  }

  const { error } = await supabase.rpc("update_whatsapp_prefs", {
    p_phone: phone,
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/perfil");
  return { ok: true };
}
