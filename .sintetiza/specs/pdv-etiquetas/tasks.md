# Tasks — Operação de Loja: PDV e Etiquetas

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/6c99ed33-37aa-4945-873f-8af73a70ac80/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration de venda PDV, pagamentos, devoluções e créditos | VIVI-59 | REQ-2.1, REQ-5.1, REQ-7.1 | 3h | — |
| 2 | Implementar tela de venda rápida com leitura de código de barras | VIVI-60 | REQ-1.1 … REQ-1.6 | 4h | VIVI-59 |
| 3 | Implementar pagamentos múltiplos, troco e desconto com alçada | VIVI-61 | REQ-2.1 … REQ-2.6, REQ-3.1 … REQ-3.5 | 3h | VIVI-60 |
| 4 | Implementar comissão da vendedora e apuração por período | VIVI-62 | REQ-4.1 … REQ-4.5, REQ-7.1 … REQ-7.5 | 2h | VIVI-61 |
| 5 | Implementar troca e devolução com crédito à cliente | VIVI-63 | REQ-5.1 … REQ-5.6 | 2h | VIVI-61 |
| 6 | Criar gerador de etiqueta ZPL para a Zebra GC420t | VIVI-64 | REQ-6.1, REQ-6.2, REQ-6.4, REQ-6.6, REQ-6.7 | 2h | VIVI-59 |
| 7 | Implementar impressão em lote via Zebra Browser Print | VIVI-65 | REQ-6.3, REQ-6.5 | 1h | VIVI-64 |
| | **Total** | | | **17h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-60 |
| REQ-1.2 | VIVI-60 |
| REQ-1.3 | VIVI-60 |
| REQ-1.4 | VIVI-60 |
| REQ-1.5 | VIVI-60 |
| REQ-1.6 | VIVI-60 |
| REQ-2.1 | VIVI-59, VIVI-61 |
| REQ-2.2 | VIVI-61 |
| REQ-2.3 | VIVI-61 |
| REQ-2.4 | VIVI-61 |
| REQ-2.5 | VIVI-61 |
| REQ-2.6 | VIVI-61 |
| REQ-3.1 | VIVI-61 |
| REQ-3.2 | VIVI-61 |
| REQ-3.3 | VIVI-61 |
| REQ-3.4 | VIVI-61 |
| REQ-3.5 | VIVI-61 |
| REQ-4.1 | VIVI-62 |
| REQ-4.2 | VIVI-62 |
| REQ-4.3 | VIVI-62, VIVI-63 |
| REQ-4.4 | VIVI-62 |
| REQ-4.5 | VIVI-62 |
| REQ-5.1 | VIVI-59, VIVI-63 |
| REQ-5.2 | VIVI-63 |
| REQ-5.3 | VIVI-63 |
| REQ-5.4 | VIVI-63 |
| REQ-5.5 | VIVI-63 |
| REQ-5.6 | VIVI-63 |
| REQ-6.1 | VIVI-64 |
| REQ-6.2 | VIVI-64 |
| REQ-6.3 | VIVI-65 |
| REQ-6.4 | VIVI-64 |
| REQ-6.5 | VIVI-65 |
| REQ-6.6 | VIVI-64 |
| REQ-6.7 | VIVI-64 |
| REQ-7.1 | VIVI-59, VIVI-62 |
| REQ-7.2 | VIVI-62 |
| REQ-7.3 | VIVI-62 |
| REQ-7.4 | VIVI-62 |
| REQ-7.5 | VIVI-62 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
