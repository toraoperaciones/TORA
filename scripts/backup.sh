#!/usr/bin/env bash
set -euo pipefail

# TORA — Backup manual de Supabase
# Uso: pnpm backup
# Requiere: pg_dump (local) + DATABASE_URL en .env.local

BACKUP_DIR="${HOME}/Desktop/TORA BACKUPS"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="tora-backup-$TIMESTAMP.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "→ Generando backup en $FILEPATH"

if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump no está instalado en esta Mac."
  echo ""
  echo "Alternativas:"
  echo "1. Instalar PostgreSQL local: https://postgresapp.com (gratis, 5 min, macOS)"
  echo "2. Supabase Dashboard → Database → Backups (requiere plan Pro, \$25/mes)"
  echo "3. Management API de Supabase (requiere SUPABASE_ACCESS_TOKEN)"
  echo ""
  echo "Detalle de las tres opciones en docs/OPERATIONS.md."
  exit 1
fi

# Cargar credenciales del proyecto
set -a
source .env.local
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL no está en .env.local"
  echo ""
  echo "Agrégala copiando la Connection String (URI, pooler) de:"
  echo "  Supabase Dashboard → Project Settings → Database → Connection String"
  echo ""
  echo "Formato:"
  echo "  DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
  exit 1
fi

pg_dump "$DATABASE_URL" --no-owner --no-privileges --clean --if-exists | gzip > "$FILEPATH"

SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "✅ Backup completado: $FILEPATH ($SIZE)"
echo ""
echo "Restaurar (BORRA y reemplaza toda la base — solo emergencias):"
echo "  gunzip -c '$FILEPATH' | psql \"\$DATABASE_URL\""
