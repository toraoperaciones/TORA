-- ============================================================
-- 0025 — Sprint 6: empresas emisoras (multi-organización Facturapi)
--
-- Modelo: TORA factura con 4 razones sociales (mismo dueño). Cada tenant
-- se asigna FIJO a una emisora (rotación por menor carga). El cliente
-- jamás ve el emisor en la UI; el PDF CFDI sí lo lleva (requisito SAT).
-- ============================================================

-- ── Catálogo de emisoras ──
create table if not exists public.issuer_companies (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null,
  rfc text not null unique,
  razon_social text not null,
  regimen_fiscal text not null,
  codigo_postal text not null,
  facturapi_organization_id text,
  facturapi_environment text default 'test'
    check (facturapi_environment in ('test', 'live')),
  csd_uploaded_at timestamptz,
  -- CSD cifrado en reposo (AES-256-GCM; llave en ENCRYPTION_KEY).
  csd_cer_encrypted text,
  csd_key_encrypted text,
  csd_password_encrypted text,
  sat_monthly_limit int default 2000,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── tenants: asignación fija a emisora ──
alter table public.tenants
  add column if not exists issuer_company_id uuid references public.issuer_companies(id),
  add column if not exists issuer_assigned_at timestamptz;

-- ── invoices: qué emisora emitió + metadatos Facturapi ──
alter table public.invoices
  add column if not exists issuer_company_id uuid references public.issuer_companies(id),
  add column if not exists facturapi_invoice_id text,
  add column if not exists emisor_rfc text,
  add column if not exists emisor_razon_social text,
  add column if not exists uso_cfdi text default 'G03',
  add column if not exists forma_pago text default '03',
  add column if not exists metodo_pago text default 'PUE';

-- ── índices ──
create index if not exists tenants_issuer_idx on public.tenants(issuer_company_id);
create index if not exists invoices_issuer_idx on public.invoices(issuer_company_id);
create index if not exists invoices_facturapi_id_idx on public.invoices(facturapi_invoice_id)
  where facturapi_invoice_id is not null;

-- ── RLS: solo staff TORA conoce las emisoras; escritura solo ADMIN ──
alter table public.issuer_companies enable row level security;

drop policy if exists issuer_companies_admin_all on public.issuer_companies;
create policy issuer_companies_admin_all on public.issuer_companies
  for all using (public.get_user_role() = 'TORA_ADMIN')
  with check (public.get_user_role() = 'TORA_ADMIN');

drop policy if exists issuer_companies_finance_read on public.issuer_companies;
create policy issuer_companies_finance_read on public.issuer_companies
  for select using (public.get_user_role() in ('TORA_ADMIN', 'TORA_FINANCE'));

-- ── updated_at ──
drop trigger if exists set_updated_at_issuer_companies on public.issuer_companies;
create trigger set_updated_at_issuer_companies
  before update on public.issuer_companies
  for each row execute function public.set_updated_at();

-- ── RPC: asignación rotativa (menor carga; idempotente) ──
create or replace function public.assign_issuer_to_tenant(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issuer_id uuid;
begin
  select issuer_company_id into v_issuer_id from public.tenants where id = p_tenant_id;
  if v_issuer_id is not null then return v_issuer_id; end if;

  select ic.id into v_issuer_id
  from public.issuer_companies ic
  left join public.tenants t on t.issuer_company_id = ic.id
  where ic.active = true
  group by ic.id
  order by count(t.id) asc, ic.created_at asc
  limit 1;

  if v_issuer_id is null then
    raise exception 'No hay empresas emisoras activas';
  end if;

  update public.tenants
  set issuer_company_id = v_issuer_id, issuer_assigned_at = now()
  where id = p_tenant_id;

  return v_issuer_id;
end;
$$;

grant execute on function public.assign_issuer_to_tenant(uuid) to authenticated;
