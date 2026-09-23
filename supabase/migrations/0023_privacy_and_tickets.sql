-- ============================================================
-- 0023 — Sprint 4: soporte formal (support_tickets) + versión
-- del consentimiento legal. Los timestamps accepted_*_at ya
-- existen desde 0009: no se duplican.
-- ============================================================

-- Versión del consentimiento legal (para re-aceptación futura).
alter table public.users
  add column if not exists accepted_version text default '1.0';

-- ── Tickets de soporte ─────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  subject text not null,
  description text not null,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  assigned_to uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets(status, priority, created_at desc);

create index if not exists support_tickets_tenant_idx
  on public.support_tickets(tenant_id);

drop trigger if exists set_updated_at_support_tickets on public.support_tickets;
create trigger set_updated_at_support_tickets
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

-- El autor ve sus tickets; el tenant completo los ve (portal compartido);
-- el staff de TORA ve todo.
drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own"
  on public.support_tickets for select
  using (
    user_id = auth.uid()
    or tenant_id = public.get_user_tenant_id()
    or public.is_tora_staff()
  );

-- Crear requiere sesión: el ticket queda a nombre del usuario autenticado
-- (el trigger no aplica: es insert directo con user_id del propio uid).
drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own"
  on public.support_tickets for insert
  with check (user_id = auth.uid() or public.is_tora_staff());

-- Solo el staff actualiza estado/prioridad/asignación/resolución.
drop policy if exists "support_tickets_update_staff" on public.support_tickets;
create policy "support_tickets_update_staff"
  on public.support_tickets for update
  using (public.is_tora_staff())
  with check (public.is_tora_staff());
