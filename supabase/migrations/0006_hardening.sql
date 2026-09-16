-- ============================================================
-- TORA - 0006_hardening.sql
-- Remediacion de los security advisors de Supabase:
--  1. set_updated_at con search_path mutable -> fix: fijarlo.
--  2. RPCs de negocio ejecutables por anon -> fix: revoke EXECUTE
--     a anon. La app solo las invoca como authenticated y la
--     autorizacion fina vive dentro de cada funcion.
-- Los helpers (get_user_role, get_user_tenant_id, is_tora_staff,
-- handle_new_user) NO se revocan: las policies RLS los ejecutan
-- tambien para anon (evaluacion de policies sin sesion) y
-- revocarlos romperia el login y las reglas del portal.
-- IDEMPOTENTE. No modifica 0001-0005.
-- ============================================================

-- 1. search_path fijo para set_updated_at (mismo cuerpo, security definer).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Revocar EXECUTE a anon en las RPCs de negocio.
--    authenticated conserva el grant de las migraciones originales.
revoke execute on function public.select_trip_option(uuid, uuid) from anon;
revoke execute on function public.replace_trip_options(uuid, jsonb, boolean) from anon;
revoke execute on function public.approve_deposit(uuid) from anon;
revoke execute on function public.reject_deposit(uuid, text) from anon;
revoke execute on function public.approve_credit_for_trip(uuid, numeric) from anon;
revoke execute on function public.suspend_tenant(uuid) from anon;
revoke execute on function public.activate_user(uuid, uuid, text) from anon;
revoke execute on function public.update_user_role(uuid, uuid, text) from anon;
revoke execute on function public.toggle_user_status(uuid, text) from anon;
revoke execute on function public.toggle_tenant_status(uuid, text) from anon;
revoke execute on function public.create_tenant(text, text, text, text, numeric, int, numeric, numeric, numeric, numeric, text) from anon;
revoke execute on function public.invite_user(text, text, uuid, text, text) from anon;

-- Fin: 2 fixes de advisors (search_path + anon EXECUTE). El warning de
-- leaked password protection se resuelve en el Dashboard de Auth.
