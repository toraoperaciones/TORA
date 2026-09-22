-- ============================================================
-- TORA — 0014_payment_methods.sql
-- Sprint 1: modelo de 3 métodos de pago.
--   cash:    cliente transfiere SPEI antes de emitir
--   prepaid: cliente fondea billetera, cada reserva debita
--   credit:  cliente reserva a crédito, paga fin de mes (Sprint 2)
-- IDEMPOTENTE (todo IF NOT EXISTS / DO-guards).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- tenants: método de pago + cache de crédito usado + datos SPEI
-- ─────────────────────────────────────────────────────────────
alter table public.tenants
  add column if not exists payment_method text not null default 'prepaid',
  add column if not exists credit_used numeric(12,2) not null default 0,
  add column if not exists spei_clabe text,
  add column if not exists spei_beneficiary text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenants_payment_method_check'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_payment_method_check
      check (payment_method in ('cash','prepaid','credit'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- trips: snapshot del método al crear + fechas de pago/crédito
-- ─────────────────────────────────────────────────────────────
alter table public.trips
  add column if not exists payment_method_snapshot text,
  add column if not exists credit_due_date date,
  add column if not exists paid_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trips_payment_method_snapshot_check'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_payment_method_snapshot_check
      check (payment_method_snapshot in ('cash','prepaid','credit'));
  end if;
end $$;

-- 'suspended' entra al ciclo de vida del trip.
-- El CHECK original es inline en 0001 y Postgres lo llamó trips_status_check.
alter table public.trips
  drop constraint if exists trips_status_check;
alter table public.trips
  add constraint trips_status_check check (status in (
    'pending_quote','options_sent','awaiting_selection','awaiting_payment',
    'confirmed','completed','cancelled','refunded','suspended'
  ));

-- ─────────────────────────────────────────────────────────────
-- wallet_transactions: trazabilidad a trip y factura
-- ─────────────────────────────────────────────────────────────
alter table public.wallet_transactions
  add column if not exists related_trip_id uuid
    references public.trips(id) on delete set null,
  add column if not exists related_invoice_id uuid
    references public.invoices(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- invoices: fecha de vencimiento para mora (Sprint 2)
-- ─────────────────────────────────────────────────────────────
alter table public.invoices
  add column if not exists due_date date;

-- ─────────────────────────────────────────────────────────────
-- RLS: el charge de cash lo inserta el CLIENT_ADMIN al seleccionar
-- opción (flujo sin service-role). Restricciones: propio tenant,
-- charge pending, created_by = sí mismo.
-- ─────────────────────────────────────────────────────────────
drop policy if exists wallet_insert_client_charge on public.wallet_transactions;
create policy wallet_insert_client_charge
  on public.wallet_transactions for insert
  with check (
    get_user_role() = 'CLIENT_ADMIN'
    and tenant_id = get_user_tenant_id()
    and type = 'charge'
    and status = 'pending'
    and created_by = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- Índices para queries frecuentes
-- ─────────────────────────────────────────────────────────────
-- Crédito pendiente de un tenant (fuente de calculateAvailableCredit).
-- Nota: el spec pedía status in ('confirmed','pending_payment') pero el
-- estado real del trip es 'awaiting_payment'; se ancla además a paid_at
-- is null que es la condición real de "aún no pagado".
create index if not exists idx_trips_credit_pending
  on public.trips(tenant_id, payment_method_snapshot, status)
  where paid_at is null and status in ('confirmed','awaiting_payment');

create index if not exists idx_wallet_tx_related_trip
  on public.wallet_transactions(related_trip_id)
  where related_trip_id is not null;

-- Mora: invoices.is_paid aún no existe en el esquema (el sprint de
-- facturas no aterrizó columnas en BD); el refinado del índice con
-- is_paid = false va con esa migración en su momento.
create index if not exists idx_invoices_due_date
  on public.invoices(due_date)
  where due_date is not null;

-- ─────────────────────────────────────────────────────────────
-- Backfill idempotente
-- ─────────────────────────────────────────────────────────────
update public.tenants
set payment_method = 'prepaid'
where payment_method is null;

-- Los trips existentes heredan el método de su tenant.
update public.trips t
set payment_method_snapshot = tn.payment_method
from public.tenants tn
where t.tenant_id = tn.id
  and t.payment_method_snapshot is null;
