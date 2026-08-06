# Tasks — Checkout, Pagamentos e Frete

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/f154a922-b30b-4aad-a11c-89b31c36c875/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration de reservas, eventos de gateway e links de cobrança | VIVI-46 | REQ-4.1, REQ-5.2, REQ-6.1, REQ-7.1 | 2h | — |
| 2 | Configurar Asaas como gateway padrão e implementar cobrança avulsa | VIVI-47 | REQ-1.1 … REQ-1.6, REQ-6.1 … REQ-6.5 | 3h | VIVI-46 |
| 3 | Implementar reserva de estoque com expiração e liberação | VIVI-48 | REQ-4.1 … REQ-4.6 | 3h | VIVI-46 |
| 4 | Implementar desconto de PIX e parcelamento calculados no servidor | VIVI-49 | REQ-2.1 … REQ-2.6 | 2h | VIVI-47 |
| 5 | Implementar cotação de frete, frete grátis e retirada na loja | VIVI-50 | REQ-3.1 … REQ-3.6 | 3h | VIVI-46 |
| 6 | Tornar o webhook do Asaas autenticado e idempotente | VIVI-51 | REQ-5.1 … REQ-5.7 | 2h | VIVI-47, VIVI-48 |
| 7 | Proteger a consulta de pedido da cliente com token de acesso | VIVI-52 | REQ-7.1 … REQ-7.3 | 1h | VIVI-46 |
| | **Total** | | | **16h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-47 |
| REQ-1.2 | VIVI-47 |
| REQ-1.3 | VIVI-47 |
| REQ-1.4 | VIVI-47 |
| REQ-1.5 | VIVI-47 |
| REQ-1.6 | VIVI-47 |
| REQ-2.1 | VIVI-49 |
| REQ-2.2 | VIVI-49 |
| REQ-2.3 | VIVI-49 |
| REQ-2.4 | VIVI-49 |
| REQ-2.5 | VIVI-49 |
| REQ-2.6 | VIVI-49 |
| REQ-3.1 | VIVI-50 |
| REQ-3.2 | VIVI-50 |
| REQ-3.3 | VIVI-50 |
| REQ-3.4 | VIVI-50 |
| REQ-3.5 | VIVI-50 |
| REQ-3.6 | VIVI-50 |
| REQ-4.1 | VIVI-46, VIVI-48 |
| REQ-4.2 | VIVI-48 |
| REQ-4.3 | VIVI-48 |
| REQ-4.4 | VIVI-48 |
| REQ-4.5 | VIVI-48 |
| REQ-4.6 | VIVI-48 |
| REQ-5.1 | VIVI-51 |
| REQ-5.2 | VIVI-46, VIVI-51 |
| REQ-5.3 | VIVI-51 |
| REQ-5.4 | VIVI-51 |
| REQ-5.5 | VIVI-51 |
| REQ-5.6 | VIVI-51 |
| REQ-5.7 | VIVI-51 |
| REQ-6.1 | VIVI-46, VIVI-47 |
| REQ-6.2 | VIVI-47 |
| REQ-6.3 | VIVI-47 |
| REQ-6.4 | VIVI-47 |
| REQ-6.5 | VIVI-47 |
| REQ-7.1 | VIVI-46, VIVI-52 |
| REQ-7.2 | VIVI-52 |
| REQ-7.3 | VIVI-52 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
