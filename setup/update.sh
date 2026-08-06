#!/bin/bash
# Pull latest code and restart the app
# chmod +x setup/update.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "Atualizando Whitelabel Loja Virtual..."

cd "$APP_DIR"
git pull origin main
npm install --omit=dev
bash "$SCRIPT_DIR/migrate.sh"
npm run build
pm2 restart whitelabel-loja
echo "✓ Atualização concluída!"
pm2 status
