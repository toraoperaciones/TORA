# TORA

Infraestructura de viajes corporativos para el mercado mexicano. Plataforma B2B
multi-tenant: las empresas gestionan vuelos, hoteles, autos y stands de ferias
desde un solo panel, con billetera pre-fondeada vía SPEI y CFDI consolidado
mensual.

## Stack

- **Next.js 15** (App Router, TypeScript, RSC por defecto)
- **Tailwind CSS v4** (tokens en `@theme`, `app/globals.css`)
- **shadcn/ui** + **Lucide React**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **TanStack Query**, **react-hook-form**, **zod**
- **pnpm**

## Instalación

```bash
pnpm install
cp .env.local.example .env.local   # llenar con credenciales de Supabase
```

## Base de datos

1. Abrir el **SQL Editor** de Supabase y pegar el contenido completo de
   `supabase/migrations/0001_init.sql`. Ejecutar. (Es idempotente: puede
   correrse dos veces para verificar.)
2. Cargar datos demo:

```bash
pnpm seed   # tsx scripts/seed.ts — 3 tenants, 7 usuarios, 8 trips, credenciales impresas
```

Credenciales demo (password `Tora2025!`): `admin@tora.mx` (TORA_ADMIN),
`ops@tora.mx` (TORA_OPS), `finanzas@tora.mx` (TORA_FINANCE),
`admin@aceronorte.mx` / `finanzas@aceronorte.mx` (Acero del Norte),
`admin@vcm.mx` / `finanzas@vcm.mx` (Viajes Corporativos MX).

## Desarrollo

```bash
pnpm dev       # http://localhost:3000
pnpm build     # build de producción + typecheck
pnpm lint      # eslint
```

## Fases del MVP

- **Fase 1** ✅ Scaffold + design system (tokens, fuentes, layout raíz, logo).
- **Fase 2** ✅ Capa de persistencia (migración SQL + RLS, clientes Supabase, seed).
- **Fase 3** ✅ Auth + middleware + layout shell (login/register/pending, sidebar por rol, 4 portales).
- **Fase 4** ✅ Portal CLIENT (dashboard, billetera SPEI, trips, selección de opciones vía RPC, facturas).
- **Fase 5** ✅ Portal OPS (bandeja, quote builder con markup, gestión de viajes, incidentes, clientes).
- **Fase 6** ✅ Portal FINANCE (validación SPEI con auto-confirmación, dashboard financiero, líneas de crédito, facturas).
- **Fase 7** ✅ Portal ADMIN (tenants + detalle, usuarios con activación de pendientes vía RPC `activate_user`, pipeline Kanban drag-free, subida manual de facturas al bucket `invoices`).

## Cómo aplicar la migración 0005 (ADMIN)

Copia el contenido de `supabase/migrations/0005_admin.sql` en el SQL Editor de Supabase → Run. Es idempotente: se puede correr 2 veces sin errores. Crea la tabla `pipeline_leads`, el bucket privado `invoices` y las RPCs `activate_user`, `update_user_role`, `toggle_user_status`, `toggle_tenant_status`, `create_tenant`, `invite_user`, `suspend_tenant`.
