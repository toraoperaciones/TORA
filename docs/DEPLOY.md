# Deploy a Vercel

## Pre-requisitos

- Repo en GitHub (remoto `origin` configurado).
- Cuenta en Vercel (plan Hobby o Pro).
- Proyecto Supabase (`PLATAFORMA TORA` — `igvtpqlababywxxaqugp`) con las 8 migraciones aplicadas.
  Verificar en local: `pnpm db:verify` → debe terminar en "✓ Schema completo y verificado."
- Seed ejecutado si quieres datos de demo: `pnpm seed` (usuarios con password `Tora2025!`).

## Paso 1 — Push a GitHub

```bash
git remote add origin git@github.com:<org>/tora.git   # solo la primera vez
git push -u origin main
```

## Paso 2 — Importar en Vercel

1. Vercel Dashboard → **Add New… → Project** → selecciona el repo `tora`.
2. Framework Preset: **Next.js** (autodetectado). No toques Build/Output.
3. En **Environment Variables**, agrega (todos los environments: Production, Preview, Development):

| Variable | Valor | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://igvtpqlababywxxaqugp.supabase.co` | Obligatoria |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon key del proyecto)* | Obligatoria |
| `SUPABASE_SERVICE_ROLE_KEY` | *(service role key del proyecto)* | Obligatoria — solo se usa en scripts/seed y firmas de storage |
| `NEXT_PUBLIC_SUPABASE_PROJECT_ID` | `igvtpqlababywxxaqugp` | Obligatoria |
| `NEXT_PUBLIC_APP_URL` | *(vacío por ahora)* | Se llena con la URL final de Vercel en el Paso 3 |
| `NEXT_PUBLIC_TZ` | `America/Mexico_City` | Timezone del negocio |

   Ojo: `SUPABASE_ACCESS_TOKEN` **no** va a Vercel — es solo para `pnpm db:migrate` desde local.
4. **Deploy**. La primera build debe terminar en verde (verifica el log: `pnpm build` local ya pasa limpio).

## Paso 3 — Actualizar Supabase Auth URLs

Con la URL de Vercel (ej. `https://tora.vercel.app` o la de production domain):

1. Supabase Dashboard → **Authentication → URL Configuration**.
2. **Site URL:** `https://<tu-dominio-vercel>` .
3. **Redirect URLs** — agrega:
   - `https://<tu-dominio-vercel>/auth/callback`
   - `https://<tu-dominio-vercel>/login`
   - `https://<tu-dominio-vercel>/pending`
4. De vuelta en Vercel, pon `NEXT_PUBLIC_APP_URL=https://<tu-dominio-vercel>` y haz **Redeploy** para que el valor público quede horneado.

## Paso 4 — Configurar Leaked Password Protection

Supabase Dashboard → **Authentication → Policies (Sign In / Providers)** → activa
**"Protect against leaked passwords"** (chequeo contra HaveIBeenPwned).
Es el único security advisor restante que requiere toggle manual; ya está ejecutado
por el dueño del proyecto. Con esto, contraseñas comprometidas se rechazan en
registro y cambio de contraseña.

## Paso 5 — Smoke test post-deploy

- [ ] Login con cada uno de los 7 usuarios del seed (`admin@tora.mx`, `ops@tora.mx`, `finanzas@tora.mx`, `admin@aceronorte.mx`, `finanzas@aceronorte.mx`, `admin@vcm.mx`, `finanzas@vcm.mx` — password `Tora2025!`).
- [ ] Verificar redirects por rol: cada usuario aterriza en su portal (`/dashboard`, `/ops/inbox`, `/finance/deposits`, `/admin/tenants`).
- [ ] Probar los 3 flujos de negocio (A saldo, B SPEI, C crédito) — guion completo en `docs/ACCEPTANCE.md`.
- [ ] Verificar que el bucket `receipts` funciona: subir comprobante en `/wallet` y validarlo desde `/finance/deposits`.
- [ ] Verificar que el bucket `invoices` funciona: subir factura en `/admin/invoices` y leerla desde `/invoices` (CLIENT) y `/finance/invoices`.

## Rollback

1. Vercel Dashboard → **Deployments** → elige el último deploy verde → menú **⋯ → Promote to Production** (revert instantáneo, sin rebuild).
2. Si el problema es de datos/BD (migración): las migraciones son idempotentes pero **no reversibles automáticamente** — no hay down-migrations. Recupera con Supabase Dashboard → **Database → Backups** (Point-in-Time Recovery según plan) o restaura solo datos con un re-seed: `pnpm seed` (limpia y repuebla).
3. Si el problema es de Auth (URLs mal configuradas): vuelve a `https://<previo>` en Site URL/Redirect URLs — efecto inmediato.

## Logs

- **Vercel:** Dashboard → tu proyecto → **Deployments → (último) → Runtime Logs**; para streaming en vivo: `vercel logs <deployment-url>`.
- **Supabase Postgres:** Dashboard → **Logs → Postgres logs** (errores SQL, RLS denegados, timeouts).
- **Supabase Auth:** Dashboard → **Logs → Auth logs** (logins fallidos, rate limits, redirects rechazados).
- **Supabase Storage:** Dashboard → **Logs → Storage logs** (uploads/signed URLs denegados).
