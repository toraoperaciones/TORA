-- ============================================================
-- TORA — 0001_init.sql
-- Schema multi-tenant + RLS + helpers + triggers + storage.
-- IDEMPOTENTE: puede correrse múltiples veces sin error.
--
-- Orden de dependencias:
--   tenants → users → trips → trip_options → bookings
--                     → wallet_transactions / invoices
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. TABLA: tenants
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rfc text,
  razon_social text,
  regimen_fiscal text,
  credit_limit numeric(12,2) not null default 0,
  credit_days int not null default 30,
  markup_flights numeric(5,4) not null default 0.06,
  markup_hotels numeric(5,4) not null default 0.10,
  markup_cars numeric(5,4) not null default 0.12,
  markup_stands numeric(5,4) not null default 0.30,
  status text not null default 'active'
    check (status in ('active','suspended','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: users
-- ─────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  role text not null
    check (role in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE')),
  email text not null,
  full_name text,
  phone text,
  status text not null default 'active'
    check (status in ('active','pending_approval','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_tenant_id on public.users(tenant_id);
create index if not exists idx_users_role on public.users(role);

-- ─────────────────────────────────────────────────────────────
-- 3. TABLA: trips
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'pending_quote'
    check (status in (
      'pending_quote','options_sent','awaiting_selection','awaiting_payment',
      'confirmed','completed','cancelled','refunded'
    )),
  origin text not null,
  destination text not null,
  departure_date date not null,
  return_date date,
  passengers int not null default 1 check (passengers > 0),
  service_type text not null
    check (service_type in ('flight','hotel','car','stand','mixed')),
  reason text,
  urgency text not null default 'normal'
    check (urgency in ('normal','urgent')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trips_tenant_id on public.trips(tenant_id);
create index if not exists idx_trips_status on public.trips(status);
create index if not exists idx_trips_urgency_created on public.trips(urgency, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. TABLA: trip_options
-- ─────────────────────────────────────────────────────────────
-- CONTIENE net_price (precio proveedor). El cliente NUNCA debe verlo:
-- la policy SELECT de cliente filtra columnas vía views/RPC en fases
-- posteriores; aquí el acceso de escritura es exclusivo de staff TORA.
create table if not exists public.trip_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  provider text not null,
  net_price numeric(12,2) not null check (net_price >= 0),
  final_price numeric(12,2) not null check (final_price >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  details jsonb,
  is_selected boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_options_trip_id on public.trip_options(trip_id);

-- ─────────────────────────────────────────────────────────────
-- 5. TABLA: bookings
-- ─────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  option_id uuid not null references public.trip_options(id) on delete restrict,
  confirmation_number text,
  supplier_reference text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_trip_id on public.bookings(trip_id);

-- ─────────────────────────────────────────────────────────────
-- 6. TABLA: wallet_transactions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  type text not null
    check (type in ('deposit','charge','refund','credit_payment')),
  reference text,
  receipt_url text,
  status text not null default 'pending'
    check (status in ('pending','completed','rejected','pending_payment')),
  created_by uuid references public.users(id) on delete set null,
  validated_by uuid references public.users(id) on delete set null,
  validated_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wallet_tenant_id on public.wallet_transactions(tenant_id);
create index if not exists idx_wallet_status on public.wallet_transactions(status);
create index if not exists idx_wallet_type_status on public.wallet_transactions(type, status);

-- ─────────────────────────────────────────────────────────────
-- 7. TABLA: invoices
-- ─────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  subtotal numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  cfdi_uuid text,
  pdf_url text,
  xml_url text,
  status text not null default 'draft'
    check (status in ('draft','issued','paid','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period)
);

create index if not exists idx_invoices_tenant_id on public.invoices(tenant_id);
create index if not exists idx_invoices_period on public.invoices(period);

-- ─────────────────────────────────────────────────────────────
-- 8. HELPERS RLS (security definer, STABLE — cacheables por query)
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.users where id = auth.uid();
$$;

create or replace function public.is_tora_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('TORA_OPS','TORA_ADMIN','TORA_FINANCE')
     from public.users where id = auth.uid()), false);
$$;

/*
 * NOTA: NO se revoca EXECUTE sobre estos helpers. Las políticas RLS los
 * invocan con los privilegios del usuario que consulta; quitar el grant
 * por defecto (PUBLIC) rompería la evaluación para `authenticated`.
 * Son STABLE + security definer y solo filtran por auth.uid(), sin leaks.
 */

-- ─────────────────────────────────────────────────────────────
-- 9. TRIGGER: set_updated_at (loop idempotente sobre todas las tablas)
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants','users','trips','trip_options','bookings',
    'wallet_transactions','invoices'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at
         before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 10. TRIGGER: handle_new_user (provisiona fila en public.users)
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, role, email, full_name, status)
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'role'
        in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE')
      then new.raw_user_meta_data->>'role'
      else 'CLIENT_ADMIN'
    end,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    'pending_approval'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 11. RLS — habilitar en las 7 tablas
-- ─────────────────────────────────────────────────────────────
alter table public.tenants             enable row level security;
alter table public.users               enable row level security;
alter table public.trips               enable row level security;
alter table public.trip_options        enable row level security;
alter table public.bookings            enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.invoices            enable row level security;

-- Limpieza idempotente: recrear todas las policies en cada corrida.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'tenants','users','trips','trip_options','bookings',
        'wallet_transactions','invoices'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- ── tenants ──────────────────────────────────────────────────
create policy "tenants_select_own_or_staff"
  on public.tenants for select
  using (id = get_user_tenant_id() or is_tora_staff());

create policy "tenants_all_admin"
  on public.tenants for all
  using (get_user_role() = 'TORA_ADMIN')
  with check (get_user_role() = 'TORA_ADMIN');

-- ── users ────────────────────────────────────────────────────
create policy "users_select_self_or_tenant_or_staff"
  on public.users for select
  using (
    id = auth.uid()
    or tenant_id = get_user_tenant_id()
    or is_tora_staff()
  );

create policy "users_all_admin"
  on public.users for all
  using (get_user_role() = 'TORA_ADMIN')
  with check (get_user_role() = 'TORA_ADMIN');

-- ── trips ────────────────────────────────────────────────────
create policy "trips_select_tenant_or_staff"
  on public.trips for select
  using (tenant_id = get_user_tenant_id() or is_tora_staff());

create policy "trips_insert_client_requester_or_ops"
  on public.trips for insert
  with check (
    (
      get_user_role() = 'CLIENT_ADMIN'
      and tenant_id = get_user_tenant_id()
      and requester_id = auth.uid()
    )
    or get_user_role() in ('TORA_OPS','TORA_ADMIN')
  );

create policy "trips_update_ops_or_client_admin"
  on public.trips for update
  using (
    get_user_role() in ('TORA_OPS','TORA_ADMIN')
    or (
      get_user_role() = 'CLIENT_ADMIN'
      and tenant_id = get_user_tenant_id()
    )
  )
  with check (
    get_user_role() in ('TORA_OPS','TORA_ADMIN')
    or (
      get_user_role() = 'CLIENT_ADMIN'
      and tenant_id = get_user_tenant_id()
    )
  );

-- ── trip_options ─────────────────────────────────────────────
-- IMPORTANTE: el CLIENT_ADMIN no tiene UPDATE directo aquí.
-- La selección de opción se hará vía RPC en Fase 4 para blindar net_price.
create policy "trip_options_select_via_trip"
  on public.trip_options for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id
        and (t.tenant_id = get_user_tenant_id() or is_tora_staff())
    )
  );

create policy "trip_options_all_ops_admin"
  on public.trip_options for all
  using (get_user_role() in ('TORA_OPS','TORA_ADMIN'))
  with check (get_user_role() in ('TORA_OPS','TORA_ADMIN'));

-- ── bookings ─────────────────────────────────────────────────
create policy "bookings_select_via_trip"
  on public.bookings for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id
        and (t.tenant_id = get_user_tenant_id() or is_tora_staff())
    )
  );

create policy "bookings_all_ops_admin"
  on public.bookings for all
  using (get_user_role() in ('TORA_OPS','TORA_ADMIN'))
  with check (get_user_role() in ('TORA_OPS','TORA_ADMIN'));

-- ── wallet_transactions ──────────────────────────────────────
create policy "wallet_select_tenant_or_staff"
  on public.wallet_transactions for select
  using (tenant_id = get_user_tenant_id() or is_tora_staff());

-- El cliente solo reporta depósitos pendientes con su propio created_by.
create policy "wallet_insert_client_deposit"
  on public.wallet_transactions for insert
  with check (
    (
      get_user_role() = 'CLIENT_ADMIN'
      and tenant_id = get_user_tenant_id()
      and type = 'deposit'
      and status = 'pending'
      and created_by = auth.uid()
    )
    or get_user_role() in ('TORA_OPS','TORA_ADMIN','TORA_FINANCE')
  );

create policy "wallet_update_finance_admin"
  on public.wallet_transactions for update
  using (get_user_role() in ('TORA_FINANCE','TORA_ADMIN'))
  with check (get_user_role() in ('TORA_FINANCE','TORA_ADMIN'));

-- ── invoices ─────────────────────────────────────────────────
create policy "invoices_select_tenant_or_staff"
  on public.invoices for select
  using (tenant_id = get_user_tenant_id() or is_tora_staff());

create policy "invoices_all_finance_admin"
  on public.invoices for all
  using (get_user_role() in ('TORA_FINANCE','TORA_ADMIN'))
  with check (get_user_role() in ('TORA_FINANCE','TORA_ADMIN'));

-- ─────────────────────────────────────────────────────────────
-- 12. STORAGE — bucket privado `receipts` (comprobantes SPEI)
-- Path esperado: {tenant_id}/{uuid}-{filename}
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_read_tenant_or_staff" on storage.objects;
drop policy if exists "receipts_insert_client_admin"  on storage.objects;

create policy "receipts_read_tenant_or_staff"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (
      is_tora_staff()
      or (storage.foldername(name))[1] = get_user_tenant_id()::text
    )
  );

create policy "receipts_insert_client_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and get_user_role() = 'CLIENT_ADMIN'
    and (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- ============================================================
-- PRUEBAS MANUALES DE RLS
-- Correr en el SQL Editor de Supabase DESPUÉS del seed
-- ============================================================

-- Simular CLIENT_ADMIN del tenant Acero del Norte:
-- set local role authenticated;
-- set local request.jwt.claims = json_build_object(
--   'sub', (select id from public.users where email = 'admin@aceronorte.mx')
-- )::text;
--
-- -- Debe devolver 1 fila (su propio tenant)
-- select id, name from public.tenants;
--
-- -- Debe devolver solo trips de Acero
-- select id, destination from public.trips;
--
-- -- Debe devolver 0 filas (no ve VCM)
-- select id, name from public.tenants where name like 'Viajes%';
--
-- Simular TORA_ADMIN:
-- set local request.jwt.claims = json_build_object(
--   'sub', (select id from public.users where email = 'admin@tora.mx')
-- )::text;
--
-- -- Debe devolver 3 tenants
-- select id, name from public.tenants;
--
-- reset role;
