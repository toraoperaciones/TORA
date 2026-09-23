# Operaciones TORA — Runbook diario

## Rutina diaria del equipo TORA

### Mañana (9:00 CDMX)

**OPS:**
1. Abrir `/ops/inbox`.
2. Revisar trips `pending_quote` (más antiguos primero; el SLA es 4 h hábiles).
3. Cotizar cada uno con 2–3 opciones y enviar al cliente.

**FINANCE:**
1. Abrir `/finance/deposits`.
2. Validar depósitos pendientes FIFO (SLA 1 h hábil).
3. Aprobar o rechazar con motivo; los trips vinculados se auto-confirman.

### Durante el día

**OPS:**
- Bandeja `/ops/incidents`: atender `critical` primero (SLA 1 h), luego `high` (4 h) — la bandeja ya viene ordenada por severidad.
- Cotizar solicitudes nuevas en cuanto entren.

**FINANCE:**
- `/finance/credit`: vencimientos próximos (3 días) y `credit_used / credit_limit < 80%`.
- Contactar por WhatsApp a clientes con pago por vencer.

### Cierre del día

**OPS:**
- Cero solicitudes `pending_quote` con más de 4 horas.

**FINANCE:**
- Revisar `notifications`: ninguna alerta de mora o depósito sin atender.

## Runbook: validar depósito SPEI

1. Login `finanzas@tora.mx` → `/finance/deposits`.
2. Para cada depósito pendiente:
   - "Ver comprobante" abre el PDF firmado (nueva pestaña).
   - Verificar: monto coincide, referencia SPEI válida, comprobante de las últimas 48 h.
   - Coincide → **Aprobar**. No coincide → **Rechazar** con motivo claro.
3. Al aprobar, el wallet se acredita y los trips `awaiting_payment` cubiertos se confirman solos.

**Nunca aprobar:** comprobantes ilegibles, montos que no coinciden, fechas > 48 h (pedir nuevo), sin referencia.

## Runbook: aprobar crédito

1. Login `finanzas@tora.mx` → `/finance/credit`.
2. Revisar tenants `payment_method = 'credit'`:
   - `credit_used / credit_limit < 80%`
   - Ningún trip con `credit_due_date` vencido
3. Ampliar línea: validar solvencia con el cliente y editar en `/admin/tenants` (queda en `tenant_audit_log`).

**Nunca aprobar crédito:** a tenants con mora activa, sin historial (primer viaje siempre prepaid), o con la línea agotada.

## Runbook: suspender tenant moroso

**Cuándo:** crédito vencido > 90 días.

1. Login `admin@tora.mx` → `/admin/tenants`.
2. Cambiar `status = 'suspended'` (bloquea nuevos trips y usuarios del tenant).
3. Notificar al cliente por WhatsApp.
4. Al pagar: registrar el pago en `/finance/credit`, reactivar en `/admin/tenants` y notificar.

## Runbook: emitir factura mensual

**Día 1:** verificar trips del mes anterior `completed` → generar factura interna en `/admin/invoices`.

**Día 5:** "Descargar JSON para timbrado" (tenant + período) → enviar al contador → recibir PDF + XML + UUID.

**Día 10:** subir PDF + XML + UUID en `/admin/invoices` y marcar emitida. El cliente la ve en `/invoices`.

Detalle completo: [`docs/CFDI.md`](CFDI.md).

## Runbook: qué hacer si Supabase está caído

1. Verificar https://status.supabase.com.
2. Si hay incidencia confirmada: avisar a clientes por WhatsApp; anotar hora de inicio.
3. Al recuperarse: verificar `/api/health` (debe dar `ok: true`), verificar el último backup y reconciliar movimientos de dinero del período contra `wallet_transactions`.
4. Si hubo pérdida de datos: restaurar (sección Backup) con confirmación del fundador.

## Monitoreo

- **UptimeRobot** sondea `/api/health` y `/login` cada 5 min (configuración: sección Health de este runbook, abajo).
- **Sentry** recibe errores client y server; revisar issues nuevos cada mañana.

## SLA interno

| Operación | Compromiso |
|---|---|
| Trips cotizados | 4 h hábiles |
| Incidentes critical | 1 h |
| Incidentes high | 4 h |
| Depósitos SPEI | 1 h hábil |
| Tickets de soporte | 4 h hábiles |

Compromisos formales hacia el cliente: [`docs/SLA.md`](SLA.md).

## Health

`GET /api/health` responde:

```json
{
  "ok": true,
  "service": "tora",
  "timestamp": "2026-09-23T15:04:05.000Z",
  "checks": {
    "database": { "ok": true, "latency_ms": 23, "error": null },
    "tenants": { "active": 3 }
  }
}
```

- `200` con `ok: true` cuando la base responde; `503` si falla.
- **UptimeRobot** (configuración manual del CEO, cuenta gratis en uptimerobot.com):
  - Monitor 1: HTTPS — "TORA Health" — `https://tora-eta.vercel.app/api/health` — cada 5 min.
  - Monitor 2: HTTPS — "TORA Login" — `https://tora-eta.vercel.app/login` — cada 5 min.
  - Alert contact: email del equipo.

## Backup y restore

### Opción 1 — Backup diario automático (recomendado a mediano plazo)

Supabase Pro incluye backups diarios automáticos (retención de 7 días) y PITR
según el plan. Para activarlo: **Project Settings → Database → Backups**
(requiere plan Pro, $25/mes).

### Opción 2 — Backup manual con `pg_dump` (gratis)

```bash
pnpm backup
```

Genera `~/Desktop/TORA BACKUPS/tora-backup-YYYYMMDD-HHMMSS.sql.gz`.

**Requisitos:**

1. `pg_dump` instalado en la Mac (viene con PostgreSQL; la vía más simple en
   macOS es [Postgres.app](https://postgresapp.com), gratis, 5 minutos).
2. `DATABASE_URL` en `.env.local` — copiarla de
   **Project Settings → Database → Connection String → URI** (usar el pooler):

```
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

El script detecta si falta cualquiera de los dos y da instrucciones exactas
en lugar de fallar en silencio.

### Opción 3 — Management API (sin instalar nada)

Si no se quiere instalar PostgreSQL local, el backup puede ejecutarse con la
Management API de Supabase (requiere un `SUPABASE_ACCESS_TOKEN` personal,
generable en supabase.com/dashboard/account/tokens). El flujo:

1. `GET https://api.supabase.com/v1/projects/{ref}/database/backups` para
   listar backups gestionados.
2. Alternativa sin token: pedir al soporte de Supabase un dump puntual.

> Estado actual (Sprint 4): la Mac del equipo no tiene `pg_dump`, así que el
> backup manual queda **pendiente de instalar Postgres.app o del plan Pro**.
> El script ya está listo y verificado (`pnpm backup` guía el proceso).

### Restaurar backup

```bash
gunzip -c "$HOME/Desktop/TORA BACKUPS/tora-backup-YYYYMMDD-HHMMSS.sql.gz" | psql "$DATABASE_URL"
```

**⚠️ ADVERTENCIA:** esto borra y reemplaza TODA la base (`--clean --if-exists`).
Solo usar en emergencia reales, y nunca contra producción sin confirmar el
`DATABASE_URL` dos veces.

### Restaurar a punto en el tiempo (PITR)

Requiere Supabase Pro. Dashboard → Database → Backups → Point in Time.

## Qué incluye el dump

Esquema completo (tablas, RPCs, triggers, RLS) + datos. **No incluye**:

- Storage (bucket `receipts`: los comprobantes SPEI). Copia manual si se
  necesita: Supabase Dashboard → Storage.
- Logs de Auth y configuración del proyecto (Auth URLs, providers).
