-- ============================================================
-- TORA - 0007_revoke_public.sql
-- Las funciones en Postgres nacen con EXECUTE granted a PUBLIC.
-- 0006 revoco a anon pero PUBLIC seguia concediendo acceso
-- (anon es miembro de PUBLIC), por eso el advisor persistia.
-- Fix: revoke a PUBLIC. authenticated conserva los grants
-- explicitos de 0001-0005. Los helpers se quedan en PUBLIC
-- (las policies RLS los evaluan tambien para anon).
-- IDEMPOTENTE.
-- ============================================================

revoke execute on function public.select_trip_option(uuid, uuid) from public;
revoke execute on function public.replace_trip_options(uuid, jsonb, boolean) from public;
revoke execute on function public.approve_deposit(uuid) from public;
revoke execute on function public.reject_deposit(uuid, text) from public;
revoke execute on function public.approve_credit_for_trip(uuid, numeric) from public;
revoke execute on function public.suspend_tenant(uuid) from public;
revoke execute on function public.activate_user(uuid, uuid, text) from public;
revoke execute on function public.update_user_role(uuid, uuid, text) from public;
revoke execute on function public.toggle_user_status(uuid, text) from public;
revoke execute on function public.toggle_tenant_status(uuid, text) from public;
revoke execute on function public.create_tenant(text, text, text, text, numeric, int, numeric, numeric, numeric, numeric, text) from public;
revoke execute on function public.invite_user(text, text, uuid, text, text) from public;

-- Trigger function: nadie la invoca via REST; los triggers no
-- requieren EXECUTE para dispararse.
revoke execute on function public.set_updated_at() from public;
