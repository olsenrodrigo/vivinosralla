#!/bin/bash
# Run migrations against the configured DATABASE_URL
# chmod +x setup/migrate.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [ -f "$APP_DIR/.env" ]; then
  export $(grep -v '^#' "$APP_DIR/.env" | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL não definida. Configure o .env primeiro."
  exit 1
fi

echo "Executando migrações..."
for migration in "$APP_DIR/migrations/"*.sql; do
  echo "  → $migration"
  psql "$DATABASE_URL" < "$migration"
done
echo "✓ Migrações concluídas."
