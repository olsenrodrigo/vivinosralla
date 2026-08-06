#!/bin/bash
# Run as root: sudo bash setup/install.sh
# After install, run: bash setup/setup.sh
set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Whitelabel Loja Virtual — Setup do Servidor${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Check root
[ "$EUID" -ne 0 ] && error "Execute como root: sudo bash install.sh"

# Update system
info "Atualizando pacotes do sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# Install Node.js 20 LTS
info "Instalando Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  success "Node.js $(node --version) instalado"
else
  success "Node.js já instalado: $(node --version)"
fi

# Install PostgreSQL 16
info "Instalando PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  success "PostgreSQL instalado e iniciado"
else
  success "PostgreSQL já instalado"
fi

# Install Nginx
info "Instalando Nginx..."
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
  systemctl enable nginx
  success "Nginx instalado"
else
  success "Nginx já instalado"
fi

# Install PM2
info "Instalando PM2 (gerenciador de processos)..."
npm install -g pm2 -q
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER 2>/dev/null || true
success "PM2 instalado"

# Install certbot for HTTPS
info "Instalando Certbot (HTTPS)..."
apt-get install -y certbot python3-certbot-nginx -qq
success "Certbot instalado"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Dependências instaladas com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "\nPróximo passo: execute ${YELLOW}bash setup/setup.sh${NC}\n"
