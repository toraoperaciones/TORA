-- ============================================================
-- 0026 — Sprint 6b: datos bancarios por empresa emisora
--
-- El CLABE/beneficiario es DE LA EMISORA (cada razón social cobra en su
-- propia cuenta). La info es SOLO para TORA_ADMIN/TORA_FINANCE — la RLS
-- de 0025 ya lo garantiza — y jamás se muestra al cliente.
-- ============================================================

alter table public.issuer_companies
  add column if not exists spei_clabe text,
  add column if not exists spei_beneficiary text;
