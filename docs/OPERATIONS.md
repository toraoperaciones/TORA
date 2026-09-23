# Operaciones TORA

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
