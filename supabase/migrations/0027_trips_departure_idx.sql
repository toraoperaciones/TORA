-- ============================================================
-- 0027 — Auditoría de operabilidad: índice de salida de viajes
--
-- departure_date se filtra (gte today) y ordena (asc) en el dashboard
-- cliente, /ops/trips y próximos viajes; sin índice cae en seq scan.
-- ============================================================

create index if not exists idx_trips_departure_date
  on public.trips(departure_date);
