-- ============================================================
-- TORA — 0005_admin.sql
-- Pipeline comercial + RPCs de gestión (Portal ADMIN).
-- Requiere 0001_init.sql. IDEMPOTENTE.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Tabla: pipeline_leads (CRM básico pre-tenant)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.pipeline_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage text not null default 'lead'
    check (stage in ('lead','demo','pilot','client')),
  estimated_monthly_spend numeric(12,2) default 0,
  notes text,
  last_contact_at timestamptz,
  converted_tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pipeline_stage_idx on public.pipeline_leads(stage);
create index if not exists pipeline_updated_idx on public.pipeline_leads(updated_at desc);

drop trigger if exists set_updated_at_pipeline on public.pipeline_leads;
create trigger set_updated_at_pipeline before update on public.pipeline_leads
  for each row execute function public.set_updated_at();

alter table public.pipeline_leads enable row level security;

drop policy if exists pipeline_admin_all on public.pipeline_leads;
create policy pipeline_admin_all on public.pipeline_leads for all
  using (public.get_user_role() = 'TORA_ADMIN')
  with check (public.get_user_role() = 'TORA_ADMIN');

-- ─────────────────────────────────────────────────────────────
-- Bucket privado: invoices (PDF/XML de CFDI mensuales)
-- SELECT: staff TORA o el tenant dueño; INSERT: TORA_ADMIN/FINANCE.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists invoices_storage_select on storage.objects;
create policy invoices_storage_select on storage.objects for select
  using (
    bucket_id = 'invoices'
    and (
      public.is_tora_staff()
      or (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    )
  );

drop policy if exists invoices_storage_insert on storage.objects;
create policy invoices_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'invoices'
    and public.get_user_role() in ('TORA_ADMIN','TORA_FINANCE')
  );

-- ============================================================
-- RPC: activate_user — activa un usuario pending_approval
-- Coherencia: CLIENT_* requiere tenant; TORA_* no.
-- ============================================================
create or replace function public.activate_user(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede activar usuarios';
  end if;

  if p_role not in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE') then
    raise exception 'Rol inválido: %', p_role;
  end if;

  if p_role like 'CLIENT_%' and p_tenant_id is null then
    raise exception 'Los roles CLIENT requieren un tenant_id';
  end if;

  update public.users
  set tenant_id = p_tenant_id,
      role = p_role,
      status = 'active'
  where id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  return json_build_object('ok', true, 'user_id', p_user_id, 'role', p_role);
end;
$$;

grant execute on function public.activate_user(uuid, uuid, text) to authenticated;

-- ============================================================
-- RPC: update_user_role — cambia rol/tenant de un usuario activo
-- ============================================================
create or replace function public.update_user_role(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede modificar usuarios';
  end if;

  if p_role not in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE') then
    raise exception 'Rol inválido: %', p_role;
  end if;

  if p_role like 'CLIENT_%' and p_tenant_id is null then
    raise exception 'Los roles CLIENT requieren un tenant_id';
  end if;

  update public.users
  set tenant_id = p_tenant_id,
      role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  return json_build_object('ok', true, 'user_id', p_user_id);
end;
$$;

grant execute on function public.update_user_role(uuid, uuid, text) to authenticated;

-- ============================================================
-- RPC: toggle_user_status
-- ============================================================
create or replace function public.toggle_user_status(
  p_user_id uuid,
  p_new_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede modificar el estado';
  end if;

  if p_new_status not in ('active','suspended','pending_approval') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.users set status = p_new_status where id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;

  return json_build_object('ok', true, 'status', p_new_status);
end;
$$;

grant execute on function public.toggle_user_status(uuid, text) to authenticated;

-- ============================================================
-- RPC: toggle_tenant_status
-- ============================================================
create or replace function public.toggle_tenant_status(
  p_tenant_id uuid,
  p_new_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede modificar tenants';
  end if;

  if p_new_status not in ('active','suspended','archived') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.tenants set status = p_new_status where id = p_tenant_id;
  if not found then raise exception 'Tenant no encontrado'; end if;

  return json_build_object('ok', true, 'status', p_new_status);
end;
$$;

grant execute on function public.toggle_tenant_status(uuid, text) to authenticated;

-- ============================================================
-- RPC: create_tenant — con anti-duplicado por RFC
-- ============================================================
create or replace function public.create_tenant(
  p_name text,
  p_rfc text,
  p_razon_social text,
  p_regimen_fiscal text,
  p_credit_limit numeric,
  p_credit_days int,
  p_markup_flights numeric,
  p_markup_hotels numeric,
  p_markup_cars numeric,
  p_markup_stands numeric,
  p_notes text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
  v_tenant_id uuid;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede crear tenants';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Nombre requerido (mínimo 2 caracteres)';
  end if;

  if p_rfc is not null and length(trim(p_rfc)) > 0
     and exists (select 1 from public.tenants where rfc = trim(p_rfc)) then
    raise exception 'Ya existe un tenant con ese RFC';
  end if;

  insert into public.tenants (
    name, rfc, razon_social, regimen_fiscal,
    credit_limit, credit_days,
    markup_flights, markup_hotels, markup_cars, markup_stands,
    notes
  ) values (
    trim(p_name),
    nullif(trim(p_rfc), ''),
    nullif(trim(p_razon_social), ''),
    nullif(trim(p_regimen_fiscal), ''),
    coalesce(p_credit_limit, 0),
    coalesce(p_credit_days, 30),
    coalesce(p_markup_flights, 0.06),
    coalesce(p_markup_hotels, 0.10),
    coalesce(p_markup_cars, 0.12),
    coalesce(p_markup_stands, 0.30),
    nullif(trim(p_notes), '')
  ) returning id into v_tenant_id;

  return json_build_object('ok', true, 'tenant_id', v_tenant_id);
end;
$$;

grant execute on function public.create_tenant(
  text, text, text, text, numeric, int, numeric, numeric, numeric, numeric, text
) to authenticated;

-- ============================================================
-- RPC: invite_user
-- Crea un usuario en auth.users (con trigger handle_new_user) y
-- activa su fila en public.users con tenant/rol asignados.
-- Nota: crear usuarios de auth NO es posible vía el cliente normal
-- (signUp cambiaría la sesión del admin) ni debe usar el service
-- role desde la app, por eso va como RPC security definer con
-- crypt() para el hash — el patrón estándar de Supabase.
-- ============================================================
create or replace function public.invite_user(
  p_email text,
  p_full_name text,
  p_tenant_id uuid,
  p_role text,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
  v_auth_id uuid;
  v_clean_email text;
begin
  v_admin_role := public.get_user_role();
  if v_admin_role != 'TORA_ADMIN' then
    raise exception 'Solo TORA_ADMIN puede invitar usuarios';
  end if;

  v_clean_email := lower(trim(p_email));
  if v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  if p_role not in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE') then
    raise exception 'Rol inválido: %', p_role;
  end if;
  if p_role like 'CLIENT_%' and p_tenant_id is null then
    raise exception 'Los roles CLIENT requieren un tenant_id';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'La contraseña temporal debe tener al menos 8 caracteres';
  end if;

  if exists (select 1 from auth.users where email = v_clean_email) then
    raise exception 'Ya existe un usuario con ese email';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_clean_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'full_name', nullif(trim(p_full_name), '')),
    now(), now(), '', '', '', ''
  ) returning id into v_auth_id;

  -- El trigger handle_new_user ya creó la fila en public.users;
  -- el admin pre-asignó tenant/rol, así que queda activa de inmediato.
  update public.users
  set tenant_id = p_tenant_id,
      role = p_role,
      status = 'active'
  where id = v_auth_id;

  return json_build_object('ok', true, 'user_id', v_auth_id);
end;
$$;

grant execute on function public.invite_user(text, text, uuid, text, text) to authenticated;

-- ============================================================
-- RPC: suspend_tenant — YA DEFINIDA en 0004_credit_lines.sql
-- (misma firma y cuerpo). No se redefine aquí para evitar duplicado;
-- las migraciones se aplican en orden, así que al llegar a 0005
-- la función ya existe.
-- ============================================================
