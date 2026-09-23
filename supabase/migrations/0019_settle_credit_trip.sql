-- ============================================================
-- 0019 — Liquidación de crédito + cache atómico de credit_used
-- ============================================================

-- increment_credit_used: cache credit_used sin carreras (gana el ÚLTIMO
-- valor del disponible, no el primero).
create or replace function public.increment_credit_used(
  p_tenant_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- NULL-safe: una sesión sin JWT devuelve NULL y `not in` NO rechazaría.
  if coalesce(public.get_user_role(), '') not in ('TORA_OPS','TORA_ADMIN','TORA_FINANCE') then
    raise exception 'Sin permisos';
  end if;

  update public.tenants
  set credit_used = credit_used + p_amount
  where id = p_tenant_id;
end;
$$;

grant execute on function public.increment_credit_used(uuid, numeric) to authenticated;

-- settle_credit_trip: marca el pago de un trip a crédito.
--   1. credit_payment (completed) trazando el trip
--   2. charge original CREDIT-xxxx → completed
--   3. credit_used = greatest(0, used - precio)
--   4. trip.paid_at = now()
--   5. factura interna del mes de vencimiento → pagada
create or replace function public.settle_credit_trip(
  p_trip_id uuid,
  p_payment_reference text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_trip record;
  v_price numeric;
  v_invoice_id uuid;
begin
  v_role := public.get_user_role();
  -- NULL-safe: sin JWT el rol es NULL y `not in` evalúa desconocido (no rechaza).
  if coalesce(v_role, '') not in ('TORA_FINANCE','TORA_ADMIN') then
    raise exception 'Solo FINANCE o ADMIN pueden liquidar crédito';
  end if;

  select * into v_trip from public.trips where id = p_trip_id;
  if v_trip is null then raise exception 'Trip no encontrado'; end if;
  if v_trip.payment_method_snapshot != 'credit' then
    raise exception 'El trip no es a crédito';
  end if;
  if v_trip.paid_at is not null then
    raise exception 'El trip ya está pagado';
  end if;

  select o.final_price into v_price
  from public.trip_options o
  where o.trip_id = p_trip_id and o.is_selected = true
  limit 1;
  if v_price is null then
    raise exception 'El trip no tiene opción seleccionada';
  end if;

  -- 1. credit_payment trazado al trip.
  insert into public.wallet_transactions (
    tenant_id, amount, type, status, reference, related_trip_id,
    created_by, validated_by, validated_at
  ) values (
    v_trip.tenant_id, v_price, 'credit_payment', 'completed',
    p_payment_reference, p_trip_id,
    auth.uid(), auth.uid(), now()
  );

  -- 2. El charge original queda completed (trazabilidad).
  update public.wallet_transactions
  set status = 'completed',
      validated_by = auth.uid(),
      validated_at = now()
  where tenant_id = v_trip.tenant_id
    and type = 'charge'
    and related_trip_id = p_trip_id
    and status in ('pending','pending_payment');

  -- 3. Cache de crédito usado baja (nunca negativo).
  update public.tenants
  set credit_used = greatest(0, credit_used - v_price)
  where id = v_trip.tenant_id;

  -- 4. Trip pagado.
  update public.trips
  set paid_at = now()
  where id = p_trip_id;

  -- 5. Factura interna del mes de vencimiento → pagada.
  select id into v_invoice_id
  from public.invoices
  where tenant_id = v_trip.tenant_id
    and type = 'internal'
    and is_paid = false
    and period = to_char(v_trip.credit_due_date, 'YYYY-MM')
  limit 1;

  if v_invoice_id is not null then
    update public.invoices
    set is_paid = true, paid_at = now(), payment_reference = p_payment_reference
    where id = v_invoice_id;
  end if;

  return json_build_object(
    'ok', true,
    'trip_id', p_trip_id,
    'payment_reference', p_payment_reference
  );
end;
$$;

grant execute on function public.settle_credit_trip(uuid, text) to authenticated;
