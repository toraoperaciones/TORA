-- ============================================================
-- 0018 — Modelo credit: interés de mora + cron diario
-- (numeración: 0017 ya existe del Sprint 1 — RLS trip_options)
-- ============================================================

-- wallet_transactions: nuevo type 'interest' (mora de crédito).
-- El CHECK original es inline en 0001 y Postgres lo llamó
-- wallet_transactions_type_check.
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (type in (
    'deposit','charge','refund','credit_payment','interest'
  ));

-- invoices: liquidación de factura interna (settle_credit_trip las marca).
alter table public.invoices
  add column if not exists type text not null default 'fiscal'
    check (type in ('internal','fiscal')),
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text;

create index if not exists idx_invoices_internal_unpaid
  on public.invoices(tenant_id, period)
  where type = 'internal' and is_paid = false;

-- Índice del barrido de mora (apply_credit_mora).
create index if not exists idx_trips_credit_overdue
  on public.trips(credit_due_date)
  where payment_method_snapshot = 'credit'
    and paid_at is null
    and status in ('confirmed','pending_payment');

-- Extensiones: cron de mora + HTTP (pg_net, para notificaciones futuras).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- apply_credit_mora — barrido day-after-due:
--   día 31+: interés diario 2.5%/30 sobre el final_price (1 tx/día/trip)
--   día 91+: trip → suspended
-- ============================================================
create or replace function public.apply_credit_mora()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip record;
  v_interest_amount numeric;
  v_days_overdue int;
  v_processed int := 0;
  v_suspended int := 0;
begin
  for v_trip in
    select tr.id, tr.tenant_id, tr.credit_due_date, tr.status
    from public.trips tr
    where tr.payment_method_snapshot = 'credit'
      and tr.paid_at is null
      and tr.status in ('confirmed','pending_payment')
      and tr.credit_due_date < current_date
  loop
    v_days_overdue := current_date - v_trip.credit_due_date;

    -- Interés diario: 2.5% mensual / 30 = 0.0833% diario. Empieza el día 31.
    if v_days_overdue > 30 then
      if not exists (
        select 1 from public.wallet_transactions
        where related_trip_id = v_trip.id
          and type = 'interest'
          and date_trunc('day', created_at) = date_trunc('day', now())
      ) then
        select o.final_price * 0.000833 into v_interest_amount
        from public.trip_options o
        where o.trip_id = v_trip.id and o.is_selected = true
        limit 1;

        if v_interest_amount is not null then
          insert into public.wallet_transactions (
            tenant_id, amount, type, status, reference, related_trip_id
          ) values (
            v_trip.tenant_id, v_interest_amount, 'interest', 'completed',
            'INTEREST-' || substr(v_trip.id::text, 1, 8),
            v_trip.id
          );
          v_processed := v_processed + 1;
        end if;
      end if;
    end if;

    -- Mora > 90 días: suspender el trip.
    if v_days_overdue > 90 and v_trip.status != 'suspended' then
      update public.trips
      set status = 'suspended'
      where id = v_trip.id;
      v_suspended := v_suspended + 1;
    end if;
  end loop;

  return json_build_object(
    'ok', true, 'processed', v_processed, 'suspended', v_suspended
  );
end;
$$;

-- Cron diario 03:00 CDMX = 09:00 UTC.
select cron.unschedule('apply-credit-mora')
where exists (select 1 from cron.job where jobname = 'apply-credit-mora');

select cron.schedule(
  'apply-credit-mora',
  '0 9 * * *',
  $$ select public.apply_credit_mora(); $$
);
