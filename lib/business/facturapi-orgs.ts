import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lógica de empresas emisoras (Sprint 6). El cliente NUNCA ve el emisor:
 * estas funciones solo se usan en portales ADMIN/FINANCE.
 */

export interface IssuerSummary {
  id: string;
  internal_name: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal: string;
  facturapi_environment: string | null;
  facturapi_organization_id: string | null;
  csd_uploaded_at: string | null;
  sat_monthly_limit: number;
  active: boolean;
  tenants_count: number;
}

/** Lista emisoras con conteo de tenants asignados (para UI admin/finance). */
export async function listIssuers(): Promise<IssuerSummary[]> {
  const admin = createAdminClient();

  const { data: issuers, error } = await admin
    .from("issuer_companies")
    .select("*")
    .order("created_at");
  if (error) {
    // Preservar el código PostgREST (42P01/PGRST205) para estados guardados.
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }

  const { count } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .not("issuer_company_id", "is", null);

  // Conteo por emisora en una sola query (el conteo global solo valida RLS).
  const { data: tenants } = await admin
    .from("tenants")
    .select("issuer_company_id")
    .not("issuer_company_id", "is", null);

  const byIssuer = new Map<string, number>();
  for (const t of tenants ?? []) {
    const key = (t as { issuer_company_id: string }).issuer_company_id;
    byIssuer.set(key, (byIssuer.get(key) ?? 0) + 1);
  }
  void count; // el total global no se usa; el detalle por emisora es el útil

  return (issuers ?? []).map((issuer) => ({
    id: issuer.id,
    internal_name: issuer.internal_name,
    rfc: issuer.rfc,
    razon_social: issuer.razon_social,
    regimen_fiscal: issuer.regimen_fiscal,
    codigo_postal: issuer.codigo_postal,
    facturapi_environment: issuer.facturapi_environment,
    facturapi_organization_id: issuer.facturapi_organization_id,
    csd_uploaded_at: issuer.csd_uploaded_at,
    sat_monthly_limit: issuer.sat_monthly_limit ?? 2000,
    active: issuer.active,
    tenants_count: byIssuer.get(issuer.id) ?? 0,
  }));
}

/**
 * Asigna el tenant a la emisora con menor carga (idempotente). Delega la
 * atomicidad a la RPC `assign_issuer_to_tenant` (security definer).
 */
export async function assignIssuerToTenant(tenantId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("assign_issuer_to_tenant", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface IssuerMonthUsage {
  invoices: number;
  sat_limit: number;
  pct_used: number;
}

/** Timbres consumidos en el mes por emisora vs límite SAT (2000 default). */
export async function issuerMonthlyUsage(
  issuerId: string,
  period: string
): Promise<IssuerMonthUsage> {
  const admin = createAdminClient();
  const from = `${period}-01`;
  const [year, month] = from.split("-").map(Number);
  const next =
    month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const to = `${next.y}-${String(next.m).padStart(2, "0")}-01`;

  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("issuer_company_id", issuerId)
    .not("facturapi_invoice_id", "is", null)
    .gte("created_at", `${from}T00:00:00`)
    .lt("created_at", `${to}T00:00:00`);

  const { data: issuer } = await admin
    .from("issuer_companies")
    .select("sat_monthly_limit")
    .eq("id", issuerId)
    .single();

  const satLimit = issuer?.sat_monthly_limit ?? 2000;
  return {
    invoices: count ?? 0,
    sat_limit: satLimit,
    pct_used: satLimit > 0 ? Math.round(((count ?? 0) / satLimit) * 100) : 0,
  };
}
