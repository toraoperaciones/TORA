-- ============================================================
-- 0009 — Legal (LFPDPPP) + bandera de cambio de password
-- ============================================================

-- Consentimientos LFPDPPP: timestamps de aceptación de Términos y Aviso.
alter table public.users
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists accepted_privacy_at timestamptz;

-- Bandera de rotación: los usuarios del seed deben cambiar su password en el
-- primer login. Vive en public.users (legible por el propio dueño) — el flujo
-- de cambio la apaga al terminar.
alter table public.users
  add column if not exists must_change_password boolean not null default false;

-- ============================================================
-- RPC: aceptar términos y aviso de privacidad (self-service).
-- El usuario solo puede marcar SUS propios consentimientos.
-- Idempotente: conserva el primer timestamp de aceptación.
-- ============================================================
create or replace function public.accept_legal_terms()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  update public.users
  set accepted_terms_at = coalesce(accepted_terms_at, now()),
      accepted_privacy_at = coalesce(accepted_privacy_at, now())
  where id = v_uid;
end;
$$;

grant execute on function public.accept_legal_terms() to authenticated;
revoke execute on function public.accept_legal_terms() from anon, public;
