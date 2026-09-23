-- ============================================================
-- 0024 — Sprint 4: el trigger handle_new_user sincroniza los
-- timestamps de aceptación legal que el register manda en
-- user_metadata (evidencia LFPDPPP desde el alta).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id, role, email, full_name, status,
    accepted_terms_at, accepted_privacy_at
  )
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'role'
        in ('CLIENT_ADMIN','CLIENT_FINANCE','TORA_OPS','TORA_ADMIN','TORA_FINANCE')
      then new.raw_user_meta_data->>'role'
      else 'CLIENT_ADMIN'
    end,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    'pending_approval',
    (new.raw_user_meta_data->>'accepted_terms_at')::timestamptz,
    (new.raw_user_meta_data->>'accepted_privacy_at')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
