# Tasks — Catálogo e Estoque Unificado

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/07450499-2306-4418-b938-4f65a7528e00/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration de ficha de moda, fornecedores e movimentações | VIVI-53 | REQ-1.3, REQ-3.2, REQ-3.5 | 3h | — |
| 2 | Estender cadastro de produto com custo, markup, NCM e composição | VIVI-54 | REQ-1.1 … REQ-1.7 | 3h | VIVI-53 |
| 3 | Implementar geração de grade com SKU e código de barras EAN-13 | VIVI-55 | REQ-2.1 … REQ-2.6 | 3h | VIVI-53 |
| 4 | Implementar serviço de movimentação com saldo único e trava de linha | VIVI-56 | REQ-3.1 … REQ-3.7 | 4h | VIVI-53 |
| 5 | Implementar entrada de mercadoria por remessa do fornecedor | VIVI-57 | REQ-4.1 … REQ-4.5 | 3h | VIVI-56 |
| 6 | Implementar inventário, ajuste e alertas de ruptura e peça parada | VIVI-58 | REQ-5.1 … REQ-5.5, REQ-6.1 … REQ-6.5 | 2h | VIVI-56 |
| | **Total** | | | **18h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-54 |
| REQ-1.2 | VIVI-54 |
| REQ-1.3 | VIVI-53, VIVI-54 |
| REQ-1.4 | VIVI-54 |
| REQ-1.5 | VIVI-54 |
| REQ-1.6 | VIVI-54 |
| REQ-1.7 | VIVI-54 |
| REQ-2.1 | VIVI-55 |
| REQ-2.2 | VIVI-55 |
| REQ-2.3 | VIVI-55 |
| REQ-2.4 | VIVI-55 |
| REQ-2.5 | VIVI-55 |
| REQ-2.6 | VIVI-55 |
| REQ-3.1 | VIVI-56 |
| REQ-3.2 | VIVI-53, VIVI-56 |
| REQ-3.3 | VIVI-56 |
| REQ-3.4 | VIVI-56 |
| REQ-3.5 | VIVI-53, VIVI-56 |
| REQ-3.6 | VIVI-56 |
| REQ-3.7 | VIVI-56 |
| REQ-4.1 | VIVI-57 |
| REQ-4.2 | VIVI-57 |
| REQ-4.3 | VIVI-57 |
| REQ-4.4 | VIVI-57 |
| REQ-4.5 | VIVI-57 |
| REQ-5.1 | VIVI-58 |
| REQ-5.2 | VIVI-58 |
| REQ-5.3 | VIVI-58 |
| REQ-5.4 | VIVI-58 |
| REQ-5.5 | VIVI-58 |
| REQ-6.1 | VIVI-58 |
| REQ-6.2 | VIVI-58 |
| REQ-6.3 | VIVI-58 |
| REQ-6.4 | VIVI-58 |
| REQ-6.5 | VIVI-58 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
