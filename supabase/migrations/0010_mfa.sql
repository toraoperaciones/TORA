-- ============================================================
-- 0010 — MFA TOTP (opcional, cualquier rol)
-- ============================================================
-- Supabase Auth guarda los factores en auth.mfa_factors (gestionado por
-- el propio auth); aquí solo vive la bandera de producto que controla
-- si el login exige el challenge TOTP. RLS de public.users ya restringe
-- updates a dueño/admin; el flag se escribe vía RPC security-definer
-- (accept_mfa_state) para que el cliente nunca envie colúmnas crudas.

alter table public.users
  add column if not exists mfa_enabled boolean not null default false,
  add column if not exists mfa_enabled_at timestamptz;

create index if not exists users_mfa_idx on public.users(mfa_enabled)
  where mfa_enabled = true;

-- Única vía de escritura del flag desde el cliente: el caller autenticado
-- marca su propia cuenta, leyendo la verdad (auth.mfa_factors) del servidor.
create or replace function public.set_mfa_flag(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  has_verified_factor boolean;
begin
  if caller is null then
    raise exception 'no autenticado';
  end if;

  if enabled then
    select exists (
      select 1 from auth.mfa_factors
      where user_id = caller and status = 'verified'
    ) into has_verified_factor;

    if not has_verified_factor then
      raise exception 'no hay factor TOTP verificado';
    end if;
  end if;

  update public.users
     set mfa_enabled = enabled,
         mfa_enabled_at = case when enabled then now() else null end
   where id = caller;
end;
$$;

grant execute on function public.set_mfa_flag(boolean) to authenticated;

-- El admin puede ver el flag de cualquiera (lectura); los select ya lo cubren.
