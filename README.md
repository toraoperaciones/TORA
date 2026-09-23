# TORA

Plataforma **multi-tenant B2B** de gestión de viajes corporativos para el mercado mexicano. El cliente pre-fondea una billetera (SPEI), OPS cotiza, TESORERÍA valida depósitos y otorga crédito, y ADMIN administra clientes, usuarios y facturación — todo con aislamiento por tenant vía Row Level Security.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router), React 19, Server Components por defecto |
| Lenguaje | TypeScript (strict) |
| Estilos | Tailwind CSS v4 + shadcn/ui (design system propio: Chalk White / Navy Ink) |
| Backend | Supabase — Postgres + RLS, Auth (email/password), Storage |
| Mutaciones | RPCs transaccionales en Postgres (`security definer`) |
| Estado cliente | TanStack Query |
| Formularios | React Hook Form + Zod |
| Fechas | date-fns + date-fns-tz (`America/Mexico_City`) |
| Infra | Vercel |

## Roles

| Rol | Portal | Qué hace |
|---|---|---|
| `CLIENT_ADMIN` | `/dashboard` | Solicita viajes, selecciona cotizaciones, administra wallet |
| `CLIENT_FINANCE` | `/dashboard` | Ve wallet y facturas de su empresa, sube comprobantes SPEI |
| `TORA_OPS` | `/ops/inbox` | Cotiza (Quote Builder), gestiona trips e incidentes |
| `TORA_FINANCE` | `/finance/deposits` | Valida depósitos, administra líneas de crédito, facturas |
| `TORA_ADMIN` | `/admin/tenants` | Tenants, activación de usuarios, pipeline comercial, facturación |

## Setup local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local   # y llenar las credenciales de Supabase
pnpm env:check               # verifica que las 4 obligatorias estén

# 3. Aplicar migraciones (idempotentes, en orden 0001→0008)
pnpm db:migrate              # vía Management API, o manual con docs/MIGRATION.md

# 4. Verificar el schema
pnpm db:verify

# 5. Poblar datos de demo (3 tenants, 7 usuarios, trips, wallet, facturas, leads)
pnpm seed                    # todos los usuarios usan la contraseña Tora2025!

# 6. Arrancar
pnpm dev                     # http://localhost:3000
```

Scripts útiles: `pnpm build` · `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm db:migrate -- --force` (re-ejecuta migraciones para probar idempotencia).

Documentación: [Arquitectura](docs/ARCHITECTURE.md) · [Migraciones](docs/MIGRATION.md) · [Deploy](docs/DEPLOY.md) · [Aceptación](docs/ACCEPTANCE.md) · [Operaciones](docs/OPERATIONS.md) · [Incidentes](docs/INCIDENTS.md) · [SLA](docs/SLA.md) · [CFDI](docs/CFDI.md) · [WhatsApp](docs/WHATSAPP.md)

## Deploy

Guía completa en [`docs/DEPLOY.md`](docs/DEPLOY.md): push a GitHub, import en Vercel con las 6 variables de entorno, actualización de Auth URLs, smoke test post-deploy, rollback y logs.

## Estructura del proyecto

```
├── app/
│   ├── (auth)/            # login · register · pending
│   ├── (client)/          # portal CLIENT: dashboard, trips, wallet, invoices
│   ├── (ops)/             # portal OPS: inbox, Quote Builder, incidents, clients
│   ├── (finance)/         # portal FINANCE: deposits, dashboard, credit, invoices
│   ├── (admin)/           # portal ADMIN: tenants, users, pipeline, invoices
│   ├── api/               # route handlers (signed URLs, selección de trip)
│   └── auth/callback/     # intercambio de código de Supabase Auth
├── components/
│   ├── admin/ finance/ ops/ trips/ wallet/   # por dominio
│   ├── brand/             # logo y símbolo (assets en public/brand/)
│   ├── layout/            # sidebar por rol + portal shell
│   └── ui/                # shadcn/ui normalizados
├── lib/
│   ├── auth/              # roles, guards, contexto de tenant
│   ├── business/          # lógica pura: markup, crédito, wallet, máquina de trips
│   └── supabase/          # clients (server / browser / admin / middleware)
├── supabase/migrations/   # 0001→0008 (schema, RPCs, incidentes, crédito, admin, hardening)
├── scripts/               # seed, env:check, db:migrate, db:verify
└── docs/                  # ARCHITECTURE · MIGRATION · DEPLOY · ACCEPTANCE · brand/
```

## Estado del producto (roadmap cerrado)

| Sprint | Alcance | Estado |
|---|---|---|
| 1 | Modelo de pago **cash + prepaid** | ✅ Cerrado |
| 2 | Modelo de pago **credit** (liquidación + cron de mora) | ✅ Cerrado |
| 3 | Notificaciones **WhatsApp** (WAHA + in-app híbrida) | ✅ Cerrado (QR pendiente del chip +1) |
| 4 | **Compliance** LFPDPPP + facturación manual + soporte + backup | ✅ Cerrado |
| 5 | **Robustez**: Sentry, error boundaries, resiliencia de red, runbooks | ✅ Cerrado |

Producción: **https://tora-eta.vercel.app** · Health: [`/api/health`](https://tora-eta.vercel.app/api/health)

## Flujos end-to-end

Los 4 flujos de negocio + facturación, con su estado de verificación: [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md).

- **A — Saldo:** solicitud → cotización → selección → cobro de wallet → booking confirmado.
- **B — SPEI:** selección sin saldo → comprobante → validación de TESORERÍA → auto-confirmación.
- **C — Crédito:** selección sin saldo → aprobación de línea → cargo a 30 días → booking confirmado.
- **D — Registro → activación:** registro público → `pending_approval` → alta manual de TORA_ADMIN.

## Roadmap — Fase 2

- Integraciones reales: Google OAuth, notificaciones (email/push), conciliación bancaria automática.
- Cobro automático de interés de mora (hoy es cálculo de referencia, no cobro).
- Conversión de lead → tenant en una sola transacción (`converted_tenant_id` ya existe).
- Drag-and-drop en el pipeline (dnd-kit) y polling en `/pending` para refresco de activación.
- Suite E2E permanente en CI (los 3 flujos de negocio ya probados con Playwright headless).
- SVG oficial de marca con transparencia y canal alfa para la variante `inverse`.
