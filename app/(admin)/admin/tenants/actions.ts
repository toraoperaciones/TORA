"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

interface Ok {
  ok: true;
  tenant_id?: string;
}
interface Err {
  ok: false;
  error: string;
}

export interface CreateTenantInput {
  name: string;
  rfc: string | null;
  razon_social: string | null;
  regimen_fiscal: string | null;
  credit_limit: number;
  credit_days: number;
  markup_flights: number;
  markup_hotels: number;
  markup_cars: number;
  markup_stands: number;
  notes: string | null;
}

export async function createTenantAction(input: CreateTenantInput): Promise<Ok | Err> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tenant", {
    p_name: input.name,
    p_rfc: input.rfc,
    p_razon_social: input.razon_social,
    p_regimen_fiscal: input.regimen_fiscal,
    p_credit_limit: input.credit_limit,
    p_credit_days: input.credit_days,
    p_markup_flights: input.markup_flights,
    p_markup_hotels: input.markup_hotels,
    p_markup_cars: input.markup_cars,
    p_markup_stands: input.markup_stands,
    p_notes: input.notes,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tenants");
  return { ok: true, tenant_id: (data as { tenant_id?: string })?.tenant_id };
}

export async function toggleTenantStatusAction(
  tenantId: string,
  newStatus: "active" | "suspended" | "archived"
): Promise<Ok | Err> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_tenant_status", {
    p_tenant_id: tenantId,
    p_new_status: newStatus,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tenants");
  revalidatePath("/finance/credit");
  return { ok: true };
}
