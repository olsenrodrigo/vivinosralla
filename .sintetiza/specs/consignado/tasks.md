# Tasks — Consignado com Controle de Retorno

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/e312905b-f3a9-49b6-a961-0250e5c7807c/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration de consignações, itens e recebimentos | VIVI-66 | REQ-1.1, REQ-3.5, REQ-4.5 | 1h | — |
| 2 | Implementar saída condicional com baixa de estoque e validação | VIVI-67 | REQ-1.1 … REQ-1.7 | 3h | VIVI-66 |
| 3 | Implementar romaneio em PDF e envio por WhatsApp | VIVI-68 | REQ-2.1 … REQ-2.5 | 2h | VIVI-67 |
| 4 | Implementar retorno com conferência e conversão em venda | VIVI-69 | REQ-3.1 … REQ-3.8 | 3h | VIVI-67 |
| 5 | Implementar cobrança do saldo e painel de consignados | VIVI-70 | REQ-4.1 … REQ-4.5, REQ-5.1 … REQ-5.6 | 1h | VIVI-69 |
| | **Total** | | | **10h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-66, VIVI-67 |
| REQ-1.2 | VIVI-67 |
| REQ-1.3 | VIVI-67 |
| REQ-1.4 | VIVI-67 |
| REQ-1.5 | VIVI-67 |
| REQ-1.6 | VIVI-67 |
| REQ-1.7 | VIVI-67 |
| REQ-2.1 | VIVI-68 |
| REQ-2.2 | VIVI-68 |
| REQ-2.3 | VIVI-68 |
| REQ-2.4 | VIVI-68 |
| REQ-2.5 | VIVI-68 |
| REQ-3.1 | VIVI-69 |
| REQ-3.2 | VIVI-69 |
| REQ-3.3 | VIVI-69 |
| REQ-3.4 | VIVI-69 |
| REQ-3.5 | VIVI-66, VIVI-69 |
| REQ-3.6 | VIVI-69 |
| REQ-3.7 | VIVI-69 |
| REQ-3.8 | VIVI-69 |
| REQ-4.1 | VIVI-70 |
| REQ-4.2 | VIVI-70 |
| REQ-4.3 | VIVI-70 |
| REQ-4.4 | VIVI-70 |
| REQ-4.5 | VIVI-66, VIVI-70 |
| REQ-5.1 | VIVI-70 |
| REQ-5.2 | VIVI-70 |
| REQ-5.3 | VIVI-70 |
| REQ-5.4 | VIVI-70 |
| REQ-5.5 | VIVI-70 |
| REQ-5.6 | VIVI-70 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
