-- ============================================================
-- TORA - 0008_revoke_set_updated_at.sql
-- Supabase otorga EXECUTE explicito a anon/authenticated/service_role
-- al crear cada funcion (no solo via PUBLIC). 0007 revoco PUBLIC pero
-- el grant explicito de anon persistia para set_updated_at.
-- Trigger function: nadie debe llamarla via REST; los triggers no
-- requieren EXECUTE.
-- IDEMPOTENTE.
-- ============================================================

revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;
