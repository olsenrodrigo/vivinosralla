#!/bin/bash
# Interactive application configuration script
# Run after install.sh: bash setup/setup.sh
# chmod +x setup/setup.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
step()    { echo -e "\n${CYAN}▶ $1${NC}"; }
ask()     { echo -ne "${YELLOW}$1${NC} "; }

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Whitelabel Loja Virtual — Configuração Interativa${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# ─── 1. Database setup ────────────────────────────────────────────────────────
step "Configuração do banco de dados"
ask "Nome do banco de dados [loja_virtual]: "
read DB_NAME; DB_NAME=${DB_NAME:-loja_virtual}
ask "Usuário do PostgreSQL [loja_user]: "
read DB_USER; DB_USER=${DB_USER:-loja_user}
ask "Senha do banco de dados: "
read -s DB_PASS; echo ""

info "Criando banco e usuário PostgreSQL..."
sudo -u postgres psql <<EOF 2>/dev/null || warn "Usuário/banco já existem — continuando..."
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF
success "Banco configurado: $DB_NAME"

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# ─── 2. App settings ──────────────────────────────────────────────────────────
step "Configurações da aplicação"
ask "Porta da aplicação [3000]: "
read PORT; PORT=${PORT:-3000}
JWT_SECRET=$(openssl rand -base64 48 | tr -d '=/+' | head -c 64)
success "JWT_SECRET gerado automaticamente (64 chars)"

# ─── 3. SMTP ──────────────────────────────────────────────────────────────────
step "Configuração de e-mail SMTP (necessário para MFA)"
echo -e "${YELLOW}Dica: Para Gmail, use uma Senha de App (myaccount.google.com > Segurança > Senhas de app)${NC}"
ask "Servidor SMTP [smtp.gmail.com]: "
read SMTP_HOST; SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
ask "Porta SMTP [587]: "
read SMTP_PORT; SMTP_PORT=${SMTP_PORT:-587}
ask "Usuário SMTP (e-mail): "
read SMTP_USER
ask "Senha SMTP: "
read -s SMTP_PASS; echo ""
ask "E-mail de contato para formulários: "
read CONTACT_EMAIL

# ─── 4. Generate .env ────────────────────────────────────────────────────────
step "Gerando arquivo .env"
cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
PORT=$PORT
NODE_ENV=production
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
CONTACT_EMAIL=${CONTACT_EMAIL:-contato@seusite.com.br}
EOF
success ".env criado em $APP_DIR/.env"

# ─── 5. Install dependencies ─────────────────────────────────────────────────
step "Instalando dependências Node.js"
cd "$APP_DIR"
npm install --omit=dev
success "Dependências instaladas"

# ─── 6. Run migrations ───────────────────────────────────────────────────────
step "Executando migrações do banco de dados"
bash "$SCRIPT_DIR/migrate.sh"

# ─── 7. Build app ────────────────────────────────────────────────────────────
step "Compilando a aplicação"
npm run build
success "Build concluído em dist/"

# ─── 8. PM2 ──────────────────────────────────────────────────────────────────
step "Configurando PM2 para manter app em execução"
pm2 delete whitelabel-loja 2>/dev/null || true
pm2 start "$APP_DIR/dist/index.cjs" --name whitelabel-loja --env production
pm2 save
success "Aplicação iniciada com PM2 (nome: whitelabel-loja)"

# ─── 9. Nginx ────────────────────────────────────────────────────────────────
step "Configurando Nginx como proxy reverso"
ask "Domínio do site (ex: loja.seusite.com.br) [localhost]: "
read DOMAIN; DOMAIN=${DOMAIN:-localhost}

cat > /etc/nginx/sites-available/whitelabel-loja <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads {
        alias $APP_DIR/uploads;
        expires 1d;
        add_header Cache-Control "public";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/whitelabel-loja /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
success "Nginx configurado para $DOMAIN"

if [ "$DOMAIN" != "localhost" ]; then
  ask "Configurar HTTPS com Let's Encrypt? (s/n): "
  read HTTPS_CHOICE
  if [[ "$HTTPS_CHOICE" == "s" || "$HTTPS_CHOICE" == "S" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SMTP_USER" || warn "HTTPS falhou — configure manualmente"
  fi
fi

echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Setup concluído com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "  🌐 Acesse: ${CYAN}http://$DOMAIN${NC}"
echo -e "  🔐 Admin:  ${CYAN}http://$DOMAIN/admin${NC}"
echo -e "  📋 Logs:   ${YELLOW}pm2 logs whitelabel-loja${NC}"
echo -e "  🔄 Status: ${YELLOW}pm2 status${NC}"
echo -e ""
echo -e "  ${YELLOW}⚠️  Primeiro acesso: vá para /admin e clique em 'Primeiro Acesso'${NC}\n"
