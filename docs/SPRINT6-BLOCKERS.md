# Sprint 6 — Bloqueos de credenciales (documento de referencia)

**Fecha:** 2026-09-23 · **Estado:** Sprint 6 bloqueado en BD y Facturapi hasta nuevo aviso.

## Lo que está hecho y en producción (commit `0c87fc0`)

- `0025_issuer_companies.sql` + `0026_issuer_bank_accounts.sql` — **escritas, no aplicadas**.
- `lib/crypto/encryption.ts` — AES-256-GCM. `ENCRYPTION_KEY` generada, en `.env.local` (64 chars) **y en Vercel producción**. Roundtrip 3/3 + tamper rejection probados en runtime Next (ruta temporal eliminada).
- `lib/facturapi/client.ts` — cliente v2 fetch-nativo (organizaciones, CSD, CFDI 4.0, PDF, cancelación).
- `lib/business/facturapi-orgs.ts` + `lib/business/cfdi.ts` — asignación rotativa, uso SAT, emisión idempotente, período día 1–5 → mes anterior.
- `/admin/issuers` + `/finance/invoices` (KPIs, columna emisora, "Facturar todo el mes" con progreso y reintentos) — degradan a "Configuración pendiente" sin migración (sin 500s).
- Bloque F auditado: portal cliente sin mención de emisor/RFC/razón social (0 matches en UI y templates WhatsApp).

## Bloqueo 1 — `SUPABASE_ACCESS_TOKEN` (bloquea Bloque A y D)

`.env.local`: línea `SUPABASE_ACCESS_TOKEN=` **vacía** (len 0). Vercel: la variable
**no existe** en ningún entorno (`vercel env ls --scope tora12` — solo aparecen
`ENCRYPTION_KEY` y `SENTRY_DSN` de las nuevas). `pnpm db:migrate` falla:
*"Faltan NEXT_PUBLIC_SUPABASE_PROJECT_ID o SUPABASE_ACCESS_TOKEN"*.

**Cómo desbloquear:** supabase.com/dashboard/account/tokens → Generate new token →
pegarlo en `.env.local` (`SUPABASE_ACCESS_TOKEN=sbp_…`) → avisar "token listo".
Opcionalmente subirlo a Vercel como Secret (no es necesario para runtime).

## Bloqueo 2 — `FACTURAPI_API_KEY` (bloquea Bloque C y facturación real)

`.env.local`: línea `FACTURAPI_API_KEY=` **vacía** (len 0). Vercel: no existe.
Ping a `/v2/organizations` → `401 user_key_invalid`.

**Cómo desbloquear:** dashboard.facturapi.io → API keys (modo **test**) → pegar en
`.env.local` (`FACTURAPI_API_KEY=sk_test_…`) → avisar "api key lista".

## Al desbloquearse, ejecutar en orden

1. `pnpm db:migrate` ×2 (aplica 0025+0026 y valida idempotencia).
2. Verificar `issuer_companies` vía REST (`PGRST205` debe desaparecer).
3. Insertar las 4 empresas emisoras (service role) + `ensureOrganization` por cada una en sandbox.
4. Ping Facturapi `/v2/organizations` → 200 con 4 orgs.
5. Re-capturar screenshots reales de `/admin/issuers` y `/finance/invoices`.
6. E2E `facturapi-4empresas.py` + regresión completa + deploy + smoke.

## Verificaciones de hoy (solo lectura)

- `.env.local` completa examinada por longitud de línea: **ningún otro secreto está vacío** (solo las 2 llaves de arriba).
- `.env.local` git-ignorado (verificado en sprints anteriores); `git status` limpio salvo los archivos del sprint.
