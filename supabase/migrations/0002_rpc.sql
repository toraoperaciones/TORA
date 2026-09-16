-- ============================================================
-- TORA — 0002_rpc.sql
-- RPC de selección de opción de viaje (Portal CLIENT).
-- Requiere 0001_init.sql aplicado. IDEMPOTENTE.
--
-- ¿Por qué una RPC security definer?
--   1. La lógica crítica vive en un solo lugar (Postgres).
--   2. Es transaccional por defecto (sin race conditions entre
--      el UPDATE de trip y el INSERT del charge).
--   3. El CLIENT_ADMIN nunca toca trip_options directamente
--      (no puede tocar net_price ni forzar is_selected).
-- ============================================================

create or replace function public.select_trip_option(p_trip_id uuid, p_option_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role text;
  v_trip record;
  v_option record;
  v_balance numeric;
  v_charge_id uuid;
  v_booking_id uuid;
  v_confirmation text;
begin
  -- 1. Autorización: solo CLIENT_ADMIN activo puede seleccionar.
  v_tenant_id := public.get_user_tenant_id();
  v_role := public.get_user_role();
  if v_role != 'CLIENT_ADMIN' then
    raise exception 'Solo CLIENT_ADMIN puede seleccionar opciones';
  end if;
  if v_tenant_id is null then
    raise exception 'Usuario sin tenant asignado';
  end if;

  -- 2. Cargar trip y validar pertenencia + estado.
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then
    raise exception 'Trip no encontrado';
  end if;
  if v_trip.tenant_id != v_tenant_id then
    raise exception 'No autorizado';
  end if;
  if v_trip.status not in ('options_sent','awaiting_selection') then
    raise exception 'Estado de trip inválido: %', v_trip.status;
  end if;

  -- 3. Cargar opción y validar que pertenezca al trip.
  select * into v_option from public.trip_options
    where id = p_option_id and trip_id = p_trip_id;
  if not found then
    raise exception 'Opción no válida';
  end if;

  -- 4. Marcar la opción elegida (y desmarcar las demás).
  update public.trip_options set is_selected = false where trip_id = p_trip_id;
  update public.trip_options set is_selected = true where id = p_option_id;

  -- 5. Crear charge pendiente por el final_price (con markup ya embebido).
  insert into public.wallet_transactions (
    tenant_id, amount, type, reference, status, created_by
  ) values (
    v_tenant_id, v_option.final_price, 'charge',
    'TRIP-' || substr(p_trip_id::text, 1, 8),
    'pending', auth.uid()
  ) returning id into v_charge_id;

  -- 6. Trip pasa a awaiting_payment (esperando fondos).
  update public.trips set status = 'awaiting_payment' where id = p_trip_id;

  -- 7. Balance = depósitos completados + reembolsos completados - cargos completados.
  select coalesce(sum(
    case
      when type = 'deposit' and status = 'completed' then amount
      when type = 'refund'  and status = 'completed' then amount
      when type = 'charge'  and status = 'completed' then -amount
      else 0
    end
  ), 0) into v_balance
  from public.wallet_transactions
  where tenant_id = v_tenant_id;

  -- 8. Si el saldo alcanza: cobrar, crear booking y confirmar.
  if v_balance >= v_option.final_price then
    update public.wallet_transactions set status = 'completed' where id = v_charge_id;
    v_confirmation := 'TORA-' || upper(substr(md5(random()::text), 1, 8));
    insert into public.bookings (
      trip_id, option_id, confirmation_number, status
    ) values (
      p_trip_id, p_option_id, v_confirmation, 'confirmed'
    ) returning id into v_booking_id;
    update public.trips set status = 'confirmed' where id = p_trip_id;
    return json_build_object(
      'ok', true, 'status', 'confirmed',
      'charge_id', v_charge_id, 'booking_id', v_booking_id,
      'confirmation', v_confirmation, 'balance_after', v_balance - v_option.final_price
    );
  else
    -- No alcanza: queda awaiting_payment a la espera de depósito o crédito (Fase 6).
    return json_build_object(
      'ok', true, 'status', 'awaiting_payment',
      'charge_id', v_charge_id, 'balance', v_balance,
      'shortfall', v_option.final_price - v_balance
    );
  end if;
end;
$$;

grant execute on function public.select_trip_option(uuid, uuid) to authenticated;
