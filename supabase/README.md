# TORA — Supabase

Proyecto: **PLATAFORMA TORA** (`igvtpqlababywxxaqugp`, región `us-west-1`).

## Aplicar la migración

1. Abre el **SQL Editor** del dashboard de Supabase.
2. Copia el contenido completo de `supabase/migrations/0001_init.sql`, pégalo y
   ejecuta (**Run**).
3. **Verificación de idempotencia:** ejecútalo una segunda vez — debe pasar sin
   errores (todo usa `if not exists` / `or replace` / `drop … if exists`).

La migración crea:

- 7 tablas: `tenants`, `users`, `trips`, `trip_options`, `bookings`,
  `wallet_transactions`, `invoices` (todas con RLS activado).
- Helpers RLS: `get_user_role()`, `get_user_tenant_id()`, `is_tora_staff()`.
- Trigger `set_updated_at` en las 7 tablas.
- Trigger `on_auth_user_created` en `auth.users` (provisiona `public.users`
  con `status='pending_approval'`).
- Bucket privado `storage.receipts` con políticas por tenant
  (path: `{tenant_id}/{uuid}-{filename}`).

## Cargar datos demo

```bash
pnpm seed
```

Requiere `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. Imprime las 7 credenciales (password
`Tora2025!`).

## Probar RLS manualmente

Después del seed, corre el bloque comentado al final de `0001_init.sql`
("PRUEBAS MANUALES DE RLS") en el SQL Editor. Resumen:

```sql
set local role authenticated;
set local request.jwt.claims = json_build_object(
  'sub', (select id from public.users where email = 'admin@aceronorte.mx')
)::text;

select id, name from public.tenants;                        -- 1 fila (Acero)
select id, destination from public.trips;                   -- solo trips de Acero
select id, name from public.tenants where name like 'Viajes%'; -- 0 filas

set local request.jwt.claims = json_build_object(
  'sub', (select id from public.users where email = 'admin@tora.mx')
)::text;
select id, name from public.tenants;                        -- 3 filas

reset role;
```

## Verificaciones post-seed

```sql
select count(*) from tenants;                       -- 3
select role, email from public.users order by role; -- 7 filas
select status, count(*) from trips group by status; -- ≥ 5 estados distintos
```

## Clientes de Supabase (app)

| Archivo | Uso | Clave |
|---|---|---|
| `lib/supabase/client.ts` | Client Components | anon (RLS aplica) |
| `lib/supabase/server.ts` | RSC / Server Actions / Route Handlers | anon (RLS aplica) |
| `lib/supabase/middleware.ts` | Refresh de sesión (se monta en Fase 3) | anon (RLS aplica) |
| `lib/supabase/admin.ts` | Scripts y server actions de confianza | service role (**bypasea RLS**) |

⚠️ `lib/supabase/admin.ts` **nunca** debe importarse desde código cliente.
