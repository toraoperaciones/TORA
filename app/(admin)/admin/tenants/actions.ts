"use server";

import { revalidatePath } from "next/cache";

import { assignIssuerToTenant } from "@/lib/business/facturapi-orgs";
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
  const tenantId = (data as { tenant_id?: string })?.tenant_id;

  // Sprint 6: asignación FIJA a una emisora (menor carga). Si el catálogo
  // aún no existe (migración 0025 pendiente), la asignación ocurre al facturar.
  if (tenantId) {
    try {
      await assignIssuerToTenant(tenantId);
    } catch {
      // No bloquea el alta del tenant por una emisora faltante.
    }
  }

  revalidatePath("/admin/tenants");
  return { ok: true, tenant_id: tenantId };
}

export interface UpdateTenantInput {
  tenant_id: string;
  payment_method: "cash" | "prepaid" | "credit";
  spei_clabe: string | null;
  spei_beneficiary: string | null;
  credit_limit: number;
  credit_days: number;
}

/**
 * Edita método de pago + datos SPEI de un tenant (RLS: solo TORA_ADMIN
 * tiene UPDATE en tenants). Cada campo cambiado queda en tenant_audit_log.
 */
export async function updateTenantAction(input: UpdateTenantInput): Promise<Ok | Err> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current } = await supabase
    .from("tenants")
    .select("payment_method, spei_clabe, spei_beneficiary, credit_limit, credit_days")
    .eq("id", input.tenant_id)
    .single();
  if (!current) return { ok: false, error: "Tenant no encontrado" };

  const { error } = await supabase
    .from("tenants")
    .update({
      payment_method: input.payment_method,
      spei_clabe: input.spei_clabe,
      spei_beneficiary: input.spei_beneficiary,
      credit_limit: input.credit_limit,
      credit_days: input.credit_days,
    })
    .eq("id", input.tenant_id);
  if (error) return { ok: false, error: error.message };

  const changes: Array<{ field: string; old_value: string | null; new_value: string | null }> = [];
  if (current.payment_method !== input.payment_method) {
    changes.push({
      field: "payment_method",
      old_value: current.payment_method,
      new_value: input.payment_method,
    });
  }
  if ((current.spei_clabe ?? null) !== (input.spei_clabe ?? null)) {
    changes.push({
      field: "spei_clabe",
      old_value: current.spei_clabe,
      new_value: input.spei_clabe,
    });
  }
  if ((current.spei_beneficiary ?? null) !== (input.spei_beneficiary ?? null)) {
    changes.push({
      field: "spei_beneficiary",
      old_value: current.spei_beneficiary,
      new_value: input.spei_beneficiary,
    });
  }
  if (Number(current.credit_limit) !== input.credit_limit) {
    changes.push({
      field: "credit_limit",
      old_value: String(current.credit_limit),
      new_value: String(input.credit_limit),
    });
  }
  if (Number(current.credit_days) !== input.credit_days) {
    changes.push({
      field: "credit_days",
      old_value: String(current.credit_days),
      new_value: String(input.credit_days),
    });
  }

  if (changes.length > 0) {
    const { error: logError } = await supabase.from("tenant_audit_log").insert(
      changes.map((c) => ({
        tenant_id: input.tenant_id,
        changed_by: user?.id ?? null,
        field: c.field,
        old_value: c.old_value,
        new_value: c.new_value,
      }))
    );
    if (logError) return { ok: false, error: `Cambio aplicado pero sin log: ${logError.message}` };
  }

  revalidatePath("/admin/tenants");
  return { ok: true };
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
