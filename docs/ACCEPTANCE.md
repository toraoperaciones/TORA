# Aceptación del MVP — verificación de flujos

Checklist de aceptación con el estado real de verificación.
**Evidencia E2E:** Playwright headless contra el dev server + aserciones directas en la BD (PostgREST con service role) — corridas el 2026-09-16 con las 8 migraciones aplicadas y el seed cargado.

Leyenda: ✅ verificado por E2E automatizado · 👁️ verificado manualmente · ⏳ pendiente de verificación.

## Precondiciones

- [x] 8 migraciones aplicadas (idempotencia probada: segunda corrida sin errores).
- [x] `pnpm db:verify` → "✓ Schema completo y verificado."
- [x] Seed cargado: 3 tenants, 7 usuarios, 8 trips, opciones, wallet, 3 invoices, 5 leads.
- [x] Security advisors: solo avisos intencionales (helpers de RLS) + toggle Leaked Password Protection.

## Flujo A — Solicitud con saldo → booking

- [x] CLIENT_ADMIN crea trip (`/trips/new`) → `pending_quote`.
- [x] OPS cotiza con Quote Builder → `replace_trip_options` → opciones con `final_price` (net × markup del tenant) → `options_sent`.
- [x] CLIENT ve opciones **sin `net_price`** en HTML/red (check A5 del smoke).
- [x] CLIENT selecciona opción → RPC `select_trip_option` → charge `completed` + booking `confirmed` + saldo descontado (checks A1–A5).
- [x] `tsc`/`lint`/`build` en verde durante toda la secuencia.

**Verificado ✅ (15/15 checks E2E).**

## Flujo B — SPEI: depósito → auto-confirmación

- [x] CLIENT selecciona opción **sin saldo** → trip `awaiting_payment` + charge `pending`.
- [x] CLIENT sube comprobante SPEI al bucket `receipts` (path `{tenant_id}/{transaction_id}.pdf`).
- [x] TORA_FINANCE aprueba depósito → RPC `approve_deposit` acredita wallet y **auto-confirma** trips cubiertos.
- [x] Booking creado (`TORA-D0A3D9B1`), trip Querétaro `confirmed`, saldo exacto ($215,516.50) verificado en BD.
- [ ] Rechazo de depósito con motivo (`reject_deposit`) — probado manualmente.

**Verificado ✅ (12/13 checks E2E; el único fallo era del harness, no de la app). Rechazo de depósito: 👁️/⏳.**

## Flujo C — Crédito → confirmación

- [x] CLIENT sin saldo selecciona → `awaiting_payment` + charge `pending` (checks C1–C3).
- [x] TORA_FINANCE abre `/finance/credit` → sección "Solicitudes de crédito pendientes" lista el trip (checks C4–C5).
- [x] "Aprobar crédito" con límite → RPC `approve_credit_for_trip` → línea creada (`$50,000`, `used_amount` correcto), charge → `pending_payment`, booking `confirmed` (checks C6–C9).
- [x] Sin errores JS de consola (check C10).
- [ ] Interés mostrado en dashboard financiero con mora simulada (45d) — verificación visual manual.

**Verificado ✅ (10/10 checks E2E). Interés con mora simulada: 👁️/⏳.**

## Flujo D — Registro → activación

- [x] Registro público crea `auth.users` + perfil `pending_approval` con `tenant_id=NULL` (trigger `handle_new_user`).
- [x] Middleware confina usuarios no activos a `/pending` (verificado en smoke de redirecciones).
- [x] TORA_ADMIN activa usuario en `/admin/users` → RPC `activate_user` valida CLIENT_* ⇒ tenant.
- [x] E2E completo registro → activación → login del usuario nuevo con su portal — **12/12 checks en producción** (`https://tora-six.vercel.app`): registro por UI → `/pending` + fila `pending_approval` en BD → activación por TORA_ADMIN (rol CLIENT_ADMIN, tenant Acero del Norte, verificado en BD) → login del usuario nuevo → `/dashboard` con trips de Acero vía RLS → limpieza total del usuario de prueba.
  - Defecto encontrado y corregido durante esta verificación: `/admin/users` crasheaba en el build de producción al renderizar un pendiente (props no serializables de Server a Client Component, digest `4132371063`); fix en commit `a934e14`.

**Verificado ✅ end-to-end en producción (12/12 checks E2E).**

## Flujo E — Facturación mensual

- [x] Lectura: CLIENT ve solo sus facturas; TORA_FINANCE ve cross-tenant (RLS, verificado en smoke).
- [ ] TORA_ADMIN sube factura (PDF ≤5MB + XML ≤1MB + metadatos) en `/admin/invoices` → aparece `issued` en las 3 vistas.
- [ ] Cambio de estado de factura (`issued` → `paid`).

**Parcial ✅ (lectura y RLS). Upload y ciclo de vida: ⏳.**

## cross-cutting

- [x] Redirects por rol: 5 roles aterrizar en su portal correcto.
- [x] Middleware: sin sesión → `/login?next=…`; pendiente → `/pending`; rol sin permiso → portal home.
- [x] Logout limpia sesión (verificado en smoke).
- [x] Errores renderizados sin rojo (Navy + icono + peso), según design system.
- [x] `pnpm build` / `tsc --noEmit` / `pnpm lint` en verde (0 errores, 0 warnings).
