# Aplicar migraciones — TORA

Guía para llevar la base de datos de Supabase del proyecto (`PLATAFORMA TORA`, `igvtpqlababywxxaqugp`) de cero al schema completo del MVP.

## Orden de migraciones

| # | Archivo | Contenido |
|---|---------|-----------|
| 1 | `supabase/migrations/0001_init.sql` | 7 tablas base, 5 helpers SQL, trigger `on_auth_user_created`, RLS (18 policies), bucket `receipts` |
| 2 | `supabase/migrations/0002_rpc.sql` | RPC `select_trip_option` (selección de opción del cliente, cobro de wallet, booking) |
| 3 | `supabase/migrations/0003_incidents.sql` | Tablas `incidents` + `notifications`, RPC `replace_trip_options` |
| 4 | `supabase/migrations/0004_credit_lines.sql` | Tabla `credit_lines` (unique parcial por tenant activo), RPCs `approve_deposit`, `reject_deposit`, `approve_credit_for_trip`, `suspend_tenant` |
| 5 | `supabase/migrations/0005_admin.sql` | Tabla `pipeline_leads`, bucket `invoices`, RPCs `activate_user`, `update_user_role`, `toggle_user_status`, `toggle_tenant_status`, `create_tenant`, `invite_user` |

**El orden importa:** `0002`–`0008` dependen de tablas y helpers de `0001` (`get_user_role()`, `set_updated_at()`, etc.). Nunca apliques una sin las anteriores.

| # | Archivo | Contenido |
|---|---------|-----------|
| 6 | `supabase/migrations/0006_hardening.sql` | Hardening de security advisors: `search_path` fijo en `set_updated_at`, revoke `EXECUTE` a `anon` en RPCs de negocio |
| 7 | `supabase/migrations/0007_revoke_public.sql` | Revoke `EXECUTE` a `public` (rol PUBLIC) en RPCs de negocio — los grants explícitos de `authenticated` se conservan |
| 8 | `supabase/migrations/0008_revoke_set_updated_at.sql` | Revoke `EXECUTE` a `public`/`anon`/`authenticated` en `set_updated_at` (solo la invocan triggers) |

## Camino A — Automatizado (recomendado)

Requiere `SUPABASE_ACCESS_TOKEN` en `.env.local` (ya configurado). El script aplica las pendientes en orden y las registra en `supabase_migrations.schema_migrations`.

```bash
pnpm env:check        # 1. Verifica las 4 variables + token (sin imprimir valores)
pnpm db:migrate       # 2. Aplica 0001→0005 (las ya aplicadas se saltan)
pnpm db:migrate -- --force   # 3. (Opcional) re-ejecuta todas: valida idempotencia
pnpm db:verify        # 4. Verifica el schema completo (tablas, buckets, policies…)
pnpm seed             # 5. Datos demo (3 tenants, 7 usuarios, trips, wallet, facturas, leads)
```

## Camino B — Manual (SQL Editor de Supabase)

Si no quieres usar el token, hazlo a mano en ~10 minutos:

1. Abre el [SQL Editor del proyecto](https://supabase.com/dashboard/project/igvtpqlababywxxaqugp/sql/new).
2. Abre `supabase/migrations/0001_init.sql` en tu editor local, copia **todo** el contenido y pégalo en el SQL Editor. Presiona **Run**.
   - Resultado esperado: `Success. No rows returned` (o similar).
3. Repite con `0002_rpc.sql` … `0008_revoke_set_updated_at.sql`, **en ese orden**.
4. **Prueba de idempotencia (opcional pero recomendado):** pega y corre cada archivo una segunda vez. Todos deben pasar sin errores (usan `if not exists` / `or replace` / `drop … if exists`).
5. Verifica y siembra:

```bash
pnpm db:verify   # schema completo
pnpm seed        # datos demo
```

> Nota: si aplicaste manualmente, `supabase_migrations.schema_migrations` quedará sin registros; `pnpm db:migrate` intentaría re-aplicar. No pasa nada (todo es idempotente), pero si quieres trazabilidad completa, usa el Camino A o registra las versiones a mano.

## Verificación post-migración

`pnpm db:verify` imprime una tabla ✅/❌ con: 11 tablas, buckets `receipts`/`invoices`, trigger `on_auth_user_created`, ≥25 policies RLS. Las RPCs se ejercitan de facto al correr el seed (PostgREST no expone catálogos de funciones). **Exit code 1 si falta algo** — no corras el seed con verificaciones en rojo.

## Si una migración falla

1. **Copia el error completo.** La Management API y el SQL Editor devuelven el número de línea y la descripción exacta (ej. `column "x" does not exist at statement 45`).
2. **Identifica la sentencia.** El error menciona el `statement N`; cuenta los `;` desde el inicio del archivo para localizarla.
3. **Falló a mitad de archivo:** las migraciones no son transaccionales entre sentencias en el SQL Editor — puede haber objetos creados antes del fallo. Eso es seguro: al corregir y re-aplicar, los `if not exists` / `or replace` / `drop … if exists` absorben lo ya creado.
4. **Revisa dependencias:** ¿aplicaste las anteriores en orden? ¿existe el helper que la policy usa (`get_user_role()` vive en 0001)?
5. **Pega el error al agente** (Freebuff) antes de seguir con la siguiente migración.
6. **Última instancia (proyecto de demo, sin datos):** `drop schema public cascade; create schema public;` en el SQL Editor y re-aplica desde 0001. No lo hagas si ya hay datos que te importen.

## Credenciales y seguridad

- Las llaves viven solo en `.env.local` (gitignored — verificado).
- `SUPABASE_ACCESS_TOKEN` tiene alcance a tu cuenta completa de Supabase: no lo compartas, no lo pegues en chats, y revoca/rota cuando termine el proyecto si quieres (Dashboard → Account → Access Tokens).
- Ningún script imprime valores de llaves; solo nombres y estados.
