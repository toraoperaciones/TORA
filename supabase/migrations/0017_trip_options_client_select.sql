-- Sprint 1: el CLIENT_ADMIN marca is_selected al elegir opción en flujo cash
-- (en prepaid lo hace select_trip_option vía security definer).
-- Sin esta política, el UPDATE del cliente pasa silencioso (0 filas) y
-- approve_deposit no encuentra la opción seleccionada → trip sin booking.

drop policy if exists trip_options_update_client_select on public.trip_options;
create policy trip_options_update_client_select
  on public.trip_options for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = public.trip_options.trip_id
        and t.tenant_id = public.get_user_tenant_id()
        and t.status in ('options_sent', 'awaiting_selection')
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = public.trip_options.trip_id
        and t.tenant_id = public.get_user_tenant_id()
        and t.status in ('options_sent', 'awaiting_selection')
    )
  );
