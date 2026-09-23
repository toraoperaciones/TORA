# Auditoría TORA — Operabilidad FE/BE/DB (2026-09-23)

Método: sweep Playwright headless de 45 rutas (público + 5 roles)
(`tests/audit/sweep.py`, evidencia en `/tmp/tora-audit/sweep.json` + `shots/`),
lectura de código por ruta, checks de BD vía REST (service role) y revisión de
las 26 migraciones. Tiempos medidos en dev server (primer hit incluye
compilación; producción es más rápida).

## Lo que YA está bien (verificado, no asumido)

- **Accesibilidad de base**: 0 botones sin aria-label, 0 badges vacíos,
  0 imágenes sin alt en las 45 rutas.
- **0 console errors** en 43/45 rutas (la excepción era un bug real, ya fixeado).
- **Nav híbrida correcta** por rol (plana ≤4 items, agrupada en ADMIN 9 items),
  labels completos, sin truncamiento (lib/navigation.ts).
- **Sidebar**: ⌘B + persistencia por cookie (primitiva shadcn, verificada).
- **Empty states con ilustración + copy** en la mayoría de rutas cliente/staff.
- **DB**: 35+ índices en hot paths, RLS en todas las tablas de negocio,
  0 trips huérfanos, 0 datos con salida pasada viva.
- **Dashboard cliente**: saldo hero + gasto del mes + próximos viajes +
  actividad reciente + CTA "Solicitar viaje" (header y flotante móvil) = 0 clics.
- Skeletons por portal ya existen (app/(admin|ops|finance)/loading.tsx + 6 de cliente).
- table.tsx ya aplica `tabular-nums` a celdas; `formatMXN`/`formatDate` es-MX.

## Tabla de problemas (ruta/área | problema | severidad | evidencia)

| # | Área | Problema | Sev. | Evidencia |
|---|------|----------|------|-----------|
| 1 | FE `/admin/pipeline` | Card `<button>` con 2 `<Button>` anidados → HTML inválido, **2 errores de hidratación** en consola | Alta | sweep.json, pipeline-board.tsx:100 |
| 2 | BE/DB | `wallet_transactions.pending` + `related_trip_id not null` con **residuo E2E en producción**: trip "E2E Cash 0119835" (awaiting_payment) con 2 tx pending $5,000 — contamina saldo/estado de cuenta si el tenant lo mirara | Alta | REST service-role (query en sesión) |
| 3 | DB | `trips.departure_date` filtrado/ordenado en dashboard cliente, OPS trips y finance — **sin índice** | Media | migraciones (grep `departure_date` → solo FKs) |
| 4 | UX tablas | Búsqueda/`q` solo en `/admin/users`; tenants (grid con query en memoria, sin persistir), ops/inbox, ops/trips (filtros sin texto), finance/deposits, finance/invoices **sin búsqueda** | Media | grep por página |
| 5 | UX global | Toasts `position` default: se pierden en 3s y top-right solapa la campana | Media | app/layout.tsx:58 |
| 6 | A11y/WARN | `metadataBase` no definido → warning en cada arranque/SSR | Baja | dev log |
| 7 | BE | `approve_deposit` rechaza sin causa persistida cuando el wallet no puede acreditar (solo error al ops) — no documenta estado | Baja | lectura actions |
| 8 | UX cliente | Crédito: disponible en texto pero **sin barra de uso ni vencimiento próximo con días restantes**; cash: **CLABE no visible** en dashboard (hay que ir a wallet/factura) | Media | dashboard/page.tsx:169-200 |
| 9 | UX | Empty states de staff sin CTA accionable (inbox/deposits/users dicen "No hay X. Buen trabajo." sin acción o con copy que no enseña el paso siguiente) | Baja | páginas |
| 10 | UX | Filtros de ops/trips y users **no persisten bien en URL al limpiar** (pill de filtros activos sin link "limpiar") | Baja | trips-filters |
| 11 | Perf | Primer hit 5-10s en dev (compilación); producción debe validar <2s LCP en rutas staff | Info | sweep.json |
| 12 | UX | Command palette existe (⌘K) pero **sin ayuda de atajos** (`?`) ni foco de búsqueda con `/` | Baja | command-palette.tsx |

## Top quick wins (≤30 min, alto impacto)

1. **Fix hidratación pipeline** — div role=button + teclado (hecho en Fase 2).
2. **Limpieza de residuo E2E** con validación de estado (hecho, ver abajo).
3. **Índice 0027** en `trips.departure_date` (IF NOT EXISTS).
4. **Toasts persistentes** (duration Infinity) + posición bottom-right.
5. **metadataBase** en root layout (mata el warning).
6. **Búsqueda por `q`** en tenants/deposits/invoices reutilizando el patrón de
   users (GET form → URL compartible, RLS-safe).
7. **Barra de crédito + vencimiento + CLABE** en dashboard cliente.
8. **Empty staff con CTA** (inbox → ver todo; deposits → ver dashboard).

## Pendientes honestos (fuera de este sprint)

- LCP en producción (medible solo post-deploy; el sweep de Fase 3 lo re-corre).
- Re-renders de client components: sin evidencia de problema real; React DevTools
  profiling queda para el siguiente ciclo (no instalar nada nuevo).
- `notifications` 26/26 sin leer: la UI ya tiene campana con contador; el
  mark-as-read por navegación es decisión de producto.
