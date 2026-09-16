-- ============================================================
-- TORA — 0004_credit_lines.sql
-- Líneas de crédito + RPCs de validación SPEI y crédito (FINANCE).
-- Requiere 0001_init.sql. IDEMPOTENTE.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Tabla: credit_lines (1 línea activa por tenant — unique parcial)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.credit_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  approved_limit numeric(12,2) not null check (approved_limit >= 0),
  used_amount numeric(12,2) not null default 0 check (used_amount >= 0),
  interest_rate numeric(5,4) not null default 0.025,
  status text not null default 'active'
    check (status in ('active','suspended','closed')),
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_lines_tenant_idx on public.credit_lines(tenant_id);
create unique index if not exists credit_lines_tenant_unique
  on public.credit_lines(tenant_id) where status = 'active';

drop trigger if exists set_updated_at_credit_lines on public.credit_lines;
create trigger set_updated_at_credit_lines before update on public.credit_lines
  for each row execute function public.set_updated_at();

alter table public.credit_lines enable row level security;

drop policy if exists credit_lines_select on public.credit_lines;
create policy credit_lines_select on public.credit_lines for select
  using (tenant_id = public.get_user_tenant_id() or public.is_tora_staff());

drop policy if exists credit_lines_finance_all on public.credit_lines;
create policy credit_lines_finance_all on public.credit_lines for all
  using (public.get_user_role() in ('TORA_FINANCE','TORA_ADMIN'))
  with check (public.get_user_role() in ('TORA_FINANCE','TORA_ADMIN'));

-- ============================================================
-- RPC: approve_deposit
-- Marca un depósito como completed y re-evalúa trips en
-- awaiting_payment del tenant. TODO en una transacción (Flujo B).
-- ============================================================
create or replace function public.approve_deposit(p_transaction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_tx record;
  v_trip record;
  v_charge record;
  v_balance numeric;
  v_confirmed int := 0;
  v_confirmation text;
  v_booking_id uuid;
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden aprobar depósitos';
  end if;

  select * into v_tx from public.wallet_transactions where id = p_transaction_id;
  if v_tx is null then raise exception 'Transacción no encontrada'; end if;
  if v_tx.type != 'deposit' then raise exception 'No es un depósito'; end if;
  if v_tx.status != 'pending' then raise exception 'Ya fue procesado'; end if;

  -- 1. Marcar como completado.
  update public.wallet_transactions
  set status = 'completed',
      validated_by = auth.uid(),
      validated_at = now()
  where id = p_transaction_id;

  -- 2. Re-evaluar trips en awaiting_payment del tenant (FIFO).
  for v_trip in
    select * from public.trips
    where tenant_id = v_tx.tenant_id and status = 'awaiting_payment'
    order by created_at asc
  loop
    select * into v_charge
    from public.wallet_transactions
    where tenant_id = v_tx.tenant_id
      and type = 'charge'
      and status = 'pending'
      and reference = 'TRIP-' || substr(v_trip.id::text, 1, 8)
    order by created_at desc
    limit 1;

    if v_charge is null then
      continue;
    end if;

    -- Balance actual = depósitos + reembolsos - cargos (todos completed).
    select coalesce(sum(
      case
        when type = 'deposit' and status = 'completed' then amount
        when type = 'refund'  and status = 'completed' then amount
        when type = 'charge'  and status = 'completed' then -amount
        else 0
      end
    ), 0) into v_balance
    from public.wallet_transactions
    where tenant_id = v_tx.tenant_id;

    if v_balance >= v_charge.amount then
      update public.wallet_transactions
      set status = 'completed' where id = v_charge.id;

      v_confirmation := 'TORA-' || upper(substr(md5(random()::text), 1, 8));
      insert into public.bookings (
        trip_id, option_id, confirmation_number, status
      ) values (
        v_trip.id,
        (select id from public.trip_options where trip_id = v_trip.id and is_selected = true limit 1),
        v_confirmation,
        'confirmed'
      ) returning id into v_booking_id;

      update public.trips set status = 'confirmed' where id = v_trip.id;
      v_confirmed := v_confirmed + 1;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'transaction_id', p_transaction_id,
    'confirmed_trips', v_confirmed
  );
end;
$$;

grant execute on function public.approve_deposit(uuid) to authenticated;

-- ============================================================
-- RPC: reject_deposit
-- ============================================================
create or replace function public.reject_deposit(
  p_transaction_id uuid,
  p_reason text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden rechazar depósitos';
  end if;

  update public.wallet_transactions
  set status = 'rejected',
      validated_by = auth.uid(),
      validated_at = now(),
      rejection_reason = p_reason
  where id = p_transaction_id and type = 'deposit' and status = 'pending';

  if not found then
    raise exception 'Transacción no encontrada o ya procesada';
  end if;

  return json_build_object('ok', true, 'transaction_id', p_transaction_id);
end;
$$;

grant execute on function public.reject_deposit(uuid, text) to authenticated;

-- ============================================================
-- RPC: approve_credit_for_trip
-- Crea/actualiza la línea de crédito, valida cupo, marca el charge
-- como pending_payment, confirma trip y crea booking (Flujo C).
-- ============================================================
create or replace function public.approve_credit_for_trip(
  p_trip_id uuid,
  p_new_limit numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_trip record;
  v_charge record;
  v_line record;
  v_credit_used numeric;
  v_credit_available numeric;
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden aprobar crédito';
  end if;

  select * into v_trip from public.trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip no encontrado'; end if;
  if v_trip.status != 'awaiting_payment' then
    raise exception 'El trip no está en awaiting_payment';
  end if;

  select * into v_charge
  from public.wallet_transactions
  where tenant_id = v_trip.tenant_id
    and type = 'charge'
    and status = 'pending'
    and reference = 'TRIP-' || substr(p_trip_id::text, 1, 8)
  order by created_at desc
  limit 1;

  if v_charge is null then
    raise exception 'No hay cargo pendiente para este trip';
  end if;

  select * into v_line from public.credit_lines
  where tenant_id = v_trip.tenant_id and status = 'active';

  if v_line is null then
    if p_new_limit is null or p_new_limit < v_charge.amount then
      raise exception 'Se requiere p_new_limit >= amount del cargo';
    end if;
    insert into public.credit_lines (
      tenant_id, approved_limit, approved_by, approved_at
    ) values (
      v_trip.tenant_id, p_new_limit, auth.uid(), now()
    ) returning * into v_line;
  elsif p_new_limit is not null then
    update public.credit_lines
    set approved_limit = p_new_limit, approved_by = auth.uid(), approved_at = now()
    where id = v_line.id;
  end if;

  select coalesce(sum(amount), 0) into v_credit_used
  from public.wallet_transactions
  where tenant_id = v_trip.tenant_id and type = 'charge' and status = 'pending_payment';

  v_credit_available := v_line.approved_limit - v_credit_used;

  if v_credit_available < v_charge.amount then
    raise exception 'Cupo insuficiente: disponible %, requerido %',
      v_credit_available, v_charge.amount;
  end if;

  update public.wallet_transactions
  set status = 'pending_payment', validated_by = auth.uid(), validated_at = now()
  where id = v_charge.id;

  insert into public.bookings (
    trip_id, option_id, confirmation_number, status
  ) values (
    p_trip_id,
    (select id from public.trip_options where trip_id = p_trip_id and is_selected = true limit 1),
    'TORA-' || upper(substr(md5(random()::text), 1, 8)),
    'confirmed'
  );

  update public.trips set status = 'confirmed' where id = p_trip_id;

  update public.credit_lines
  set used_amount = v_credit_used + v_charge.amount
  where id = v_line.id;

  return json_build_object(
    'ok', true,
    'credit_line_id', v_line.id,
    'credit_used', v_credit_used + v_charge.amount,
    'credit_available', v_line.approved_limit - (v_credit_used + v_charge.amount)
  );
end;
$$;

grant execute on function public.approve_credit_for_trip(uuid, numeric) to authenticated;

-- ============================================================
-- RPC: suspend_tenant
-- Suspensión MANUAL (mora 90+): marca tenant y su línea activa
-- como suspended. Existe como RPC porque la RLS de tenants solo
-- permite UPDATE a TORA_ADMIN.
-- ============================================================
create or replace function public.suspend_tenant(p_tenant_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden suspender clientes';
  end if;

  update public.tenants set status = 'suspended' where id = p_tenant_id;
  if not found then
    raise exception 'Tenant no encontrado';
  end if;

  update public.credit_lines
  set status = 'suspended'
  where tenant_id = p_tenant_id and status = 'active';

  return json_build_object('ok', true, 'tenant_id', p_tenant_id);
end;
$$;

grant execute on function public.suspend_tenant(uuid) to authenticated;
