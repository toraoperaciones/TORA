"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Crea un ticket de soporte a nombre del usuario autenticado.
 * La RLS (0023) permite insert solo con user_id = auth.uid().
 */
export async function createSupportTicketAction(input: {
  subject: string;
  description: string;
  priority: "normal" | "high" | "urgent";
}): Promise<{ ok: boolean; ticketId?: string; error?: string }> {
  const subject = input.subject.trim();
  const description = input.description.trim();

  if (subject.length < 5 || subject.length > 100) {
    return { ok: false, error: "El asunto debe tener entre 5 y 100 caracteres" };
  }
  if (description.length < 20 || description.length > 2000) {
    return {
      ok: false,
      error: "La descripción debe tener entre 20 y 2000 caracteres",
    };
  }
  if (!["normal", "high", "urgent"].includes(input.priority)) {
    return { ok: false, error: "Prioridad inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      tenant_id: profile?.tenant_id ?? null,
      subject,
      description,
      priority: input.priority,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/soporte");
  return { ok: true, ticketId: data.id };
}

/** Solo staff: marcar resuelto con notas (RLS lo restringe en BD también). */
export async function resolveSupportTicketAction(
  ticketId: string,
  resolutionNotes: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["TORA_ADMIN", "TORA_OPS", "TORA_FINANCE"].includes(profile.role)) {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes: resolutionNotes.trim() || null,
    })
    .eq("id", ticketId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/soporte");
  revalidatePath("/admin/support");
  return { ok: true };
}
