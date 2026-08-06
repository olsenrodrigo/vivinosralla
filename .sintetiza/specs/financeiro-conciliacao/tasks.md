# Tasks — Financeiro, Caixa e Conciliação Bancária

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/edb1abab-656e-40f3-a291-65402f91ff27/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration de plano de contas, lançamentos, caixa e extratos | VIVI-77 | REQ-1.1, REQ-2.3, REQ-3.1, REQ-5.1, REQ-6.7 | 3h | — |
| 2 | Implementar contas a pagar com parcelamento e recorrência | VIVI-78 | REQ-1.1 … REQ-1.8 | 3h | VIVI-77 |
| 3 | Implementar contas a receber com baixa automática por webhook | VIVI-79 | REQ-2.1 … REQ-2.8 | 3h | VIVI-77 |
| 4 | Implementar controle de caixa com sangria, suprimento e fechamento | VIVI-80 | REQ-3.1 … REQ-3.8 | 3h | VIVI-77 |
| 5 | Implementar fluxo de caixa projetado com alerta de ruptura | VIVI-81 | REQ-4.1 … REQ-4.6 | 2h | VIVI-78, VIVI-79 |
| 6 | Implementar importador de extrato OFX e CSV do C6 e do Bradesco | VIVI-82 | REQ-5.1 … REQ-5.8 | 4h | VIVI-77 |
| 7 | Implementar conciliação automática e tela de divergências | VIVI-83 | REQ-6.1 … REQ-6.8 | 4h | VIVI-79, VIVI-82 |
| | **Total** | | | **22h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-77, VIVI-78 |
| REQ-1.2 | VIVI-78 |
| REQ-1.3 | VIVI-78 |
| REQ-1.4 | VIVI-78 |
| REQ-1.5 | VIVI-78 |
| REQ-1.6 | VIVI-78 |
| REQ-1.7 | VIVI-78 |
| REQ-1.8 | VIVI-78 |
| REQ-2.1 | VIVI-79 |
| REQ-2.2 | VIVI-79 |
| REQ-2.3 | VIVI-77, VIVI-79 |
| REQ-2.4 | VIVI-79 |
| REQ-2.5 | VIVI-79 |
| REQ-2.6 | VIVI-79 |
| REQ-2.7 | VIVI-79 |
| REQ-2.8 | VIVI-79 |
| REQ-3.1 | VIVI-77, VIVI-80 |
| REQ-3.2 | VIVI-80 |
| REQ-3.3 | VIVI-80 |
| REQ-3.4 | VIVI-80 |
| REQ-3.5 | VIVI-80 |
| REQ-3.6 | VIVI-80 |
| REQ-3.7 | VIVI-80 |
| REQ-3.8 | VIVI-80 |
| REQ-4.1 | VIVI-81 |
| REQ-4.2 | VIVI-81 |
| REQ-4.3 | VIVI-81 |
| REQ-4.4 | VIVI-81 |
| REQ-4.5 | VIVI-81 |
| REQ-4.6 | VIVI-81 |
| REQ-5.1 | VIVI-77, VIVI-82 |
| REQ-5.2 | VIVI-82 |
| REQ-5.3 | VIVI-82 |
| REQ-5.4 | VIVI-82 |
| REQ-5.5 | VIVI-82 |
| REQ-5.6 | VIVI-82 |
| REQ-5.7 | VIVI-82 |
| REQ-5.8 | VIVI-82 |
| REQ-6.1 | VIVI-83 |
| REQ-6.2 | VIVI-83 |
| REQ-6.3 | VIVI-83 |
| REQ-6.4 | VIVI-83 |
| REQ-6.5 | VIVI-83 |
| REQ-6.6 | VIVI-83 |
| REQ-6.7 | VIVI-77, VIVI-83 |
| REQ-6.8 | VIVI-83 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
