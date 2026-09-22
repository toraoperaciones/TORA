-- ============================================================
-- TORA — 0016_tenant_audit_log.sql
-- Auditoría de cambios sensibles del tenant (método de pago,
-- CLABE SPEI, beneficiario). Solo TORA_ADMIN lee e inserta.
-- IDEMPOTENTE.
-- ============================================================
create table if not exists public.tenant_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  changed_by uuid references public.users(id),
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index if not exists tenant_audit_log_tenant_idx
  on public.tenant_audit_log(tenant_id, changed_at desc);

alter table public.tenant_audit_log enable row level security;

drop policy if exists tenant_audit_log_admin_select on public.tenant_audit_log;
create policy tenant_audit_log_admin_select on public.tenant_audit_log
  for select using (public.get_user_role() = 'TORA_ADMIN');

drop policy if exists tenant_audit_log_admin_insert on public.tenant_audit_log
;
create policy tenant_audit_log_admin_insert on public.tenant_audit_log
  for insert with check (public.get_user_role() = 'TORA_ADMIN');
