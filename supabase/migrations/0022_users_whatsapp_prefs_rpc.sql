-- ============================================================
-- 0022 — Auto-actualización de preferencias WhatsApp (RPC)
-- La RLS de users (0001) no permite UPDATE self, y no se abre:
-- un update self sin restricción de columnas permitiría escalar
-- role/tenant_id/status. RPC security definer que SOLO toca las
-- columnas de preferencias (patrón RPC de la casa).
-- ============================================================

create or replace function public.update_whatsapp_prefs(
  p_phone text,
  p_enabled boolean
)
returns json
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

  -- Solo usuarios activos con fila existente.
  if not exists (
    select 1 from public.users where id = v_uid and status = 'active'
  ) then
    raise exception 'Usuario no activo';
  end if;

  -- Opt-in requiere teléfono capturado.
  if p_enabled and (p_phone is null or length(trim(p_phone)) < 8) then
    raise exception 'Teléfono requerido para activar WhatsApp';
  end if;

  -- Opt-out conserva el timestamp de consentimiento (evidencia LFPDPPP).
  update public.users
  set phone = nullif(trim(coalesce(p_phone, '')), ''),
      whatsapp_enabled = p_enabled,
      whatsapp_opt_in_at = case when p_enabled then now() else whatsapp_opt_in_at end
  where id = v_uid;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.update_whatsapp_prefs(text, boolean) to authenticated;
