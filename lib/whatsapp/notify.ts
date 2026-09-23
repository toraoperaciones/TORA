import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { sendWhatsAppMessage } from "./client";

/**
 * Notificación híbrida: WhatsApp si el usuario dio opt-in + respaldo in-app
 * SIEMPRE (tabla notifications). Nunca lanza: los hooks viven en flujos de
 * dinero y una notificación no puede romperlos.
 */
export async function notifyUser(params: {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  /** Texto de WhatsApp; cadena vacía = solo in-app. */
  whatsappText: string;
}): Promise<void> {
  const admin = createAdminClient();

  // Respaldo in-app primero: garantizado aunque WAHA no exista.
  const { error: notifErr } = await admin
    .from("notifications")
    .insert({ user_id: params.userId, type: params.type, payload: params.payload });
  if (notifErr) {
    console.error("[notify] insert notifications:", notifErr.message);
  }

  try {
    const { data: enabled } = await admin.rpc("has_whatsapp_enabled", {
      p_user_id: params.userId,
    });

    if (!enabled) return;

    const { data: user } = await admin
      .from("users")
      .select("phone")
      .eq("id", params.userId)
      .single();
    if (!user?.phone) return;

    if (!params.whatsappText) return;

    const result = await sendWhatsAppMessage(user.phone, params.whatsappText);
    if (!result.ok) {
      console.error(`[notify] WhatsApp no enviado (${result.reason ?? result.error})`);
    }
  } catch (err) {
    console.error("[notify] WhatsApp:", err instanceof Error ? err.message : err);
  }
}
