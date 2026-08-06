# WhiteLabel Loja Virtual

Plataforma de e-commerce completa integrada ao whitelabel, com painel administrativo, gestão de produtos, pedidos e pagamentos.

---

## Estrutura de diretórios

```
whitelabellojavirtual/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx              ← Site original + seção "Loja" no final
│   │   ├── store/
│   │   │   ├── StorePage.tsx     ← Loja completa (/loja)
│   │   │   ├── ProductDetailPage.tsx  ← Produto individual
│   │   │   ├── CartPage.tsx      ← Carrinho
│   │   │   ├── CheckoutPage.tsx  ← Checkout 4 etapas
│   │   │   └── OrderConfirmationPage.tsx ← Confirmação de pedido
│   │   └── admin/
│   │       ├── LoginPage.tsx     ← Login admin (/admin/login)
│   │       ├── AdminLayout.tsx   ← Layout sidebar admin
│   │       ├── Dashboard.tsx     ← Dashboard (/admin)
│   │       ├── Products.tsx      ← Lista produtos (/admin/produtos)
│   │       ├── ProductForm.tsx   ← Criar/editar produto
│   │       ├── Orders.tsx        ← Pedidos (/admin/pedidos)
│   │       ├── OrderDetail.tsx   ← Detalhe do pedido
│   │       ├── Customers.tsx     ← Clientes (/admin/clientes)
│   │       ├── Import.tsx        ← Importar CSV/XLSX (/admin/importar)
│   │       ├── Coupons.tsx       ← Cupons (/admin/cupons)
│   │       └── Settings.tsx      ← Configurações (/admin/configuracoes)
│   └── context/
│       ├── CartContext.tsx       ← Estado global do carrinho
│       └── AdminAuthContext.tsx  ← Autenticação do admin (JWT)
├── server/
│   ├── routes.ts                 ← Todas as rotas API
│   ├── storage.ts                ← Camada de dados (Drizzle)
│   ├── auth.ts                   ← JWT + bcrypt
│   ├── payment.ts                ← Integração MercadoPago
│   └── notify.ts                 ← E-mail + WhatsApp
├── shared/
│   └── schema.ts                 ← Schema completo (15 tabelas)
├── uploads/
│   ├── products/                 ← Fotos dos produtos (upload local)
│   └── imports/                  ← Arquivos CSV/XLSX temporários
└── migrations/
    └── 001_store_tables.sql      ← SQL para criar as tabelas
```

---

## URLs

| URL | Descrição |
|-----|-----------|
| `/` | Site principal (whitelabel médico) |
| `/loja` | Loja virtual completa |
| `/loja/produto/:slug` | Página do produto |
| `/loja/carrinho` | Carrinho de compras |
| `/loja/checkout` | Finalização da compra |
| `/loja/pedido/:numero` | Confirmação e acompanhamento do pedido |
| `/admin/login` | Login do painel administrativo |
| `/admin` | Dashboard admin |
| `/admin/produtos` | Gestão de produtos |
| `/admin/pedidos` | Gestão de pedidos |
| `/admin/clientes` | Clientes cadastrados |
| `/admin/cupons` | Cupons de desconto |
| `/admin/importar` | Importação em massa |
| `/admin/configuracoes` | Configurações da loja |

---

## Primeiro acesso ao Admin

1. Acesse `/admin/login`
2. Clique em **"Primeiro acesso"**
3. Preencha nome, e-mail e senha
4. Será criado o usuário administrador

---

## Formato da Planilha de Importação

Baixe o modelo em: **Admin → Importar → Baixar modelo (.xlsx)**

### Colunas obrigatórias

| Coluna | Exemplo | Notas |
|--------|---------|-------|
| `Handle` | `camiseta-azul` | Slug único, sem espaços |
| `Title` | `Camiseta Azul` | Nome do produto |
| `Price` | `79.90` | Ponto como decimal |

### Colunas opcionais

| Coluna | Exemplo |
|--------|---------|
| `Description (HTML)` | `<p>Descrição...</p>` |
| `Vendor` | `Nike` |
| `Brand` | `Nike` |
| `Type` | `Camisetas` |
| `Tags` | `verão,promoção` |
| `Status` | `active` / `draft` |
| `Published` | `true` / `false` |
| `SKU` | `CAM-AZL-M` |
| `Barcode` | `7891234567890` |
| `Compare At Price` | `99.90` |
| `Cost Per Item` | `25.00` |
| `Weight (g)` | `300` |
| `Inventory Quantity` | `50` |
| `Option1 Name` | `Tamanho` |
| `Option1 Value` | `M` |
| `Option2 Name` | `Cor` |
| `Option2 Value` | `Azul` |
| `Image 1 URL` | `https://cdn.../foto.jpg` |
| `Image 1 Alt` | `Camiseta azul M` |
| `SEO Title` | `Camiseta Azul | Loja` |
| `SEO Description` | `Compre camiseta...` |

### Produtos com variantes (múltiplas linhas)

```csv
Handle,Title,Price,Option1 Name,Option1 Value,SKU,Inventory Quantity
camiseta,Camiseta Algodão,79.90,Tamanho,P,CAM-P,10
camiseta,,79.90,Tamanho,M,CAM-M,15
camiseta,,79.90,Tamanho,G,CAM-G,8
```

A primeira linha com o Handle carrega título/descrição; as linhas seguintes com o mesmo Handle criam variantes adicionais.

---

## Diretório de fotos para importação

Para importação via URL de imagem, você tem duas opções:

1. **URL externa**: Use links públicos (ex: `https://seusite.com/foto.jpg`)
2. **Upload local**: Faça upload via formulário do produto no admin

Fotos enviadas pelo admin ficam em: `uploads/products/`

---

## Banco de dados

Execute a migration para criar as tabelas:

```bash
# Opção 1: SQL direto
psql $DATABASE_URL < migrations/001_store_tables.sql

# Opção 2: Drizzle (se DATABASE_URL configurado no .env)
npm run db:push
```

---

## Variáveis de ambiente (.env)

```env
# Banco de dados
DATABASE_URL=postgresql://user:pass@host:5432/db

# SMTP (e-mails transacionais)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sua@conta.com
SMTP_PASS=sua-senha-app

# E-mail destino do formulário de contato
CONTACT_EMAIL=contato@seusite.com

# MercadoPago (opcional — configurável pelo admin)
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxx

# JWT
JWT_SECRET=minha-chave-secreta-forte
```

---

## Pagamentos — MercadoPago

Aceita: **PIX** (aprovação instantânea), **Boleto** (3 dias), **Cartão de crédito** (até 12x).

Configure o Access Token em: Admin → Configurações → Pagamento.

**Webhook**: Configure no painel do MercadoPago:
```
URL: https://seudominio.com/api/webhooks/mercadopago
Eventos: payment
```

---

## Fluxo de pedido

```
PENDING_PAYMENT → (pagamento aprovado) → CONFIRMED
CONFIRMED → (admin prepara) → PROCESSING
PROCESSING → (envio) → SHIPPED
SHIPPED → (entrega) → DELIVERED
```

Ao atualizar para **SHIPPED** com código de rastreio, o cliente recebe e-mail automático.
