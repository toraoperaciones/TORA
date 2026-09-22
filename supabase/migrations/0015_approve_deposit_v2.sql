-- ============================================================
-- TORA — 0015_approve_deposit_v2.sql
-- approve_deposit v2: distingue depósitos vinculados a un trip
-- (cash, vía wallet_transactions.related_trip_id) del fondeo
-- general de billetera (prepaid, barrido FIFO existente).
-- Firma sin cambios: approve_deposit(uuid) -> json.
-- IDEMPOTENTE (create or replace).
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
  v_trip_ids uuid[];
begin
  v_role := public.get_user_role();
  if v_role not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden aprobar depósitos';
  end if;

  select * into v_tx from public.wallet_transactions where id = p_transaction_id;
  if v_tx is null then raise exception 'Transacción no encontrada'; end if;
  if v_tx.type != 'deposit' then raise exception 'No es un depósito'; end if;
  if v_tx.status != 'pending' then raise exception 'Ya fue procesado'; end if;

  -- 1. Marcar depósito como completado.
  update public.wallet_transactions
  set status = 'completed',
      validated_by = auth.uid(),
      validated_at = now()
  where id = p_transaction_id;

  -- 2. Determinar qué trips confirmar.
  if v_tx.related_trip_id is not null then
    -- Caso A: depósito vinculado a un trip específico (cash).
    v_trip_ids := array[v_tx.related_trip_id];
  else
    -- Caso B: fondeo general → todos los awaiting_payment del tenant (FIFO).
    select array_agg(id) into v_trip_ids
    from public.trips
    where tenant_id = v_tx.tenant_id
      and status = 'awaiting_payment';
  end if;

  if v_trip_ids is null then
    return json_build_object('ok', true, 'transaction_id', p_transaction_id, 'confirmed_trips', 0);
  end if;

  -- 3. Iterar trips y confirmar los que el saldo alcance.
  for v_trip in
    select * from public.trips
    where id = any(v_trip_ids)
    order by created_at asc
  loop
    -- Buscar el charge pendiente del trip. Tres formas de encontrarlo:
    --  a) related_trip_id (nuevo, cash)
    --  b) reference 'TRIP-<8 chars>' (convención de select_trip_option)
    --  c) reference 'PENDING_SPEI' (cash insertado desde la app)
    select * into v_charge
    from public.wallet_transactions
    where tenant_id = v_tx.tenant_id
      and type = 'charge'
      and status = 'pending'
      and (
        related_trip_id = v_trip.id
        or reference = 'TRIP-' || substr(v_trip.id::text, 1, 8)
        or reference = 'PENDING_SPEI'
      )
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
      -- Cobrar.
      update public.wallet_transactions
      set status = 'completed'
      where id = v_charge.id;

      -- Booking con la opción seleccionada del trip.
      v_confirmation := 'TORA-' || upper(substr(md5(random()::text), 1, 8));
      insert into public.bookings (
        trip_id, option_id, confirmation_number, status
      )
      select v_trip.id, t_option.id, v_confirmation, 'confirmed'
      from public.trip_options t_option
      where t_option.trip_id = v_trip.id and t_option.is_selected = true
      limit 1;

      update public.trips
      set status = 'confirmed', paid_at = now()
      where id = v_trip.id;

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
