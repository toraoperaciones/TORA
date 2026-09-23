-- ============================================================
-- 0020 — gate de increment_credit_used: el CLIENT_ADMIN del propio
-- tenant puede sumar a su cache de crédito (la selección de opción
-- la ejecuta el cliente, no staff; el INSERT del charge ya validó
-- su identidad por RLS).
-- ============================================================

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
  -- NULL-safe: sin JWT el rol es NULL y `not in` no rechazaría.
  if coalesce(public.get_user_role(), '') in ('TORA_OPS','TORA_ADMIN','TORA_FINANCE') then
    null; -- staff: cualquier tenant
  elsif coalesce(public.get_user_role(), '') = 'CLIENT_ADMIN' then
    if not exists (
      select 1 from public.users
      where id = auth.uid()
        and tenant_id = p_tenant_id
        and role = 'CLIENT_ADMIN'
        and status = 'active'
    ) then
      raise exception 'Sin permisos';
    end if;
  else
    raise exception 'Sin permisos';
  end if;

  update public.tenants
  set credit_used = credit_used + p_amount
  where id = p_tenant_id;
end;
$$;

grant execute on function public.increment_credit_used(uuid, numeric) to authenticated;
