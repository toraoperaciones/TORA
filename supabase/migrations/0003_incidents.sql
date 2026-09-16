-- ============================================================
-- TORA — 0003_incidents.sql
-- Incidentes + Notificaciones + RPC de cotización (Portal OPS).
-- Requiere 0001_init.sql. IDEMPOTENTE.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Tabla: incidents
-- ─────────────────────────────────────────────────────────────
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reported_by uuid references public.users(id) on delete set null,
  type text not null check (type in (
    'flight_delay', 'flight_cancelled', 'hotel_issue',
    'car_issue', 'billing_issue', 'other'
  )),
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  description text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_trip_idx     on public.incidents(trip_id);
create index if not exists incidents_status_idx   on public.incidents(status);
create index if not exists incidents_severity_idx on public.incidents(severity, status);

drop trigger if exists set_updated_at_incidents on public.incidents;
create trigger set_updated_at_incidents before update on public.incidents
  for each row execute function public.set_updated_at();

alter table public.incidents enable row level security;

drop policy if exists incidents_staff_all on public.incidents;
create policy incidents_staff_all on public.incidents for all
  using (public.get_user_role() in ('TORA_OPS','TORA_ADMIN'))
  with check (public.get_user_role() in ('TORA_OPS','TORA_ADMIN'));

drop policy if exists incidents_client_select on public.incidents;
create policy incidents_client_select on public.incidents for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = incidents.trip_id
        and t.tenant_id = public.get_user_tenant_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Tabla: notifications (mock de emails — rastro auditable)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select
  using (user_id = auth.uid() or public.is_tora_staff());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (public.is_tora_staff());

-- ─────────────────────────────────────────────────────────────
-- RPC: replace_trip_options
-- Permite a OPS reemplazar todas las opciones de un trip de forma
-- transaccional. El markup ya viene calculado desde la app; la RPC
-- valida rol, estado y cardinalidad (1-4 opciones).
-- Las opciones con is_selected = true se preservan (edge case de
-- re-apertura de cotización).
-- ─────────────────────────────────────────────────────────────
create or replace function public.replace_trip_options(
  p_trip_id uuid,
  p_options jsonb,
  p_send_to_client boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_trip record;
  v_opt jsonb;
  v_count int := 0;
  v_next_status text;
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_OPS','TORA_ADMIN') then
    raise exception 'Solo OPS o ADMIN pueden cotizar';
  end if;

  select * into v_trip from public.trips where id = p_trip_id;
  if not found then
    raise exception 'Trip no encontrado';
  end if;
  if v_trip.status not in ('pending_quote','options_sent','awaiting_selection') then
    raise exception 'Estado inválido para cotizar: %', v_trip.status;
  end if;

  if jsonb_array_length(p_options) < 1 or jsonb_array_length(p_options) > 4 then
    raise exception 'Debe haber entre 1 y 4 opciones';
  end if;

  -- Eliminar opciones previas NO seleccionadas.
  delete from public.trip_options where trip_id = p_trip_id and is_selected = false;

  -- Insertar nuevas.
  for v_opt in select * from jsonb_array_elements(p_options)
  loop
    insert into public.trip_options (
      trip_id, provider, net_price, final_price, details, expires_at
    ) values (
      p_trip_id,
      v_opt->>'provider',
      (v_opt->>'net_price')::numeric,
      (v_opt->>'final_price')::numeric,
      nullif(v_opt->'details', 'null'::jsonb),
      nullif(v_opt->>'expires_at', '')::timestamptz
    );
    v_count := v_count + 1;
  end loop;

  v_next_status := case
    when p_send_to_client then 'awaiting_selection'
    else 'options_sent'
  end;
  update public.trips set status = v_next_status where id = p_trip_id;

  return json_build_object(
    'ok', true, 'options_count', v_count, 'trip_status', v_next_status
  );
end;
$$;

grant execute on function public.replace_trip_options(uuid, jsonb, boolean) to authenticated;
