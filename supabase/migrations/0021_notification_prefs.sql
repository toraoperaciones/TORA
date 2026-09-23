-- ============================================================
-- 0021 — Sprint 3: preferencias de notificación por WhatsApp
-- WhatsApp es opt-in explícito: default apagado, timestamp de
-- consentimiento LFPDPPP al activar.
-- ============================================================

alter table public.users
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;

create index if not exists users_whatsapp_enabled_idx
  on public.users(whatsapp_enabled)
  where whatsapp_enabled = true;

-- Helper: ¿el usuario tiene WhatsApp activo (y teléfono capturado)?
create or replace function public.has_whatsapp_enabled(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select whatsapp_enabled and phone is not null
     from public.users
     where id = p_user_id
       and status = 'active'),
    false
  );
$$;

grant execute on function public.has_whatsapp_enabled(uuid) to authenticated;
