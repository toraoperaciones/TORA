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

export type LeadStage = "lead" | "demo" | "pilot" | "client";

export async function createLeadAction(input: {
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  estimatedMonthlySpend: number;
  notes: string | null;
  stage: LeadStage;
}): Promise<Ok | Err> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();
  if (profile?.role !== "TORA_ADMIN") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase.from("pipeline_leads").insert({
    company_name: input.companyName.trim(),
    contact_name: input.contactName?.trim() || null,
    contact_email: input.contactEmail?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    estimated_monthly_spend: input.estimatedMonthlySpend,
    notes: input.notes?.trim() || null,
    stage: input.stage,
    last_contact_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true };
}

export async function updateLeadAction(input: {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  estimatedMonthlySpend: number;
  notes: string | null;
  stage: LeadStage;
}): Promise<Ok | Err> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();
  if (profile?.role !== "TORA_ADMIN") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("pipeline_leads")
    .update({
      company_name: input.companyName.trim(),
      contact_name: input.contactName?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      estimated_monthly_spend: input.estimatedMonthlySpend,
      notes: input.notes?.trim() || null,
      stage: input.stage,
      last_contact_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true };
}

/** Mueve el lead entre columnas (botones ←/→, sin drag & drop). */
export async function moveLeadAction(
  id: string,
  nextStage: LeadStage
): Promise<Ok | Err> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();
  if (profile?.role !== "TORA_ADMIN") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("pipeline_leads")
    .update({ stage: nextStage, last_contact_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true };
}

export async function deleteLeadAction(id: string): Promise<Ok | Err> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();
  if (profile?.role !== "TORA_ADMIN") {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase.from("pipeline_leads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true };
}
