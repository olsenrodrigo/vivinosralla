# Tasks — Base Única de Clientes e Painel de Indicadores

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/339a48f0-1edd-4261-9a93-51e71c2c9ad9/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration da ficha da cliente, custo no item e eventos LGPD | VIVI-71 | REQ-2.1, REQ-3.1, REQ-4.3 | 2h | — |
| 2 | Implementar resolução única de cliente por CPF e telefone | VIVI-72 | REQ-1.1 … REQ-1.7 | 3h | VIVI-71 |
| 3 | Implementar ficha 360 com histórico omnichannel e aniversariantes | VIVI-73 | REQ-2.1 … REQ-2.7 | 2h | VIVI-72 |
| 4 | Implementar exportação e anonimização de dados da cliente | VIVI-74 | REQ-3.1 … REQ-3.7 | 1h | VIVI-73 |
| 5 | Implementar consultas agregadas de vendas, margem, ABC e giro | VIVI-75 | REQ-4.1 … REQ-4.7, REQ-5.1 … REQ-5.6 | 3h | VIVI-71 |
| 6 | Implementar painel de indicadores com filtros de período e canal | VIVI-76 | REQ-4.1, REQ-4.2, REQ-5.1, REQ-5.2 | 1h | VIVI-75 |
| | **Total** | | | **12h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-72 |
| REQ-1.2 | VIVI-72 |
| REQ-1.3 | VIVI-72 |
| REQ-1.4 | VIVI-72 |
| REQ-1.5 | VIVI-72 |
| REQ-1.6 | VIVI-72 |
| REQ-1.7 | VIVI-72 |
| REQ-2.1 | VIVI-71, VIVI-73 |
| REQ-2.2 | VIVI-73 |
| REQ-2.3 | VIVI-73 |
| REQ-2.4 | VIVI-73 |
| REQ-2.5 | VIVI-73 |
| REQ-2.6 | VIVI-73 |
| REQ-2.7 | VIVI-73 |
| REQ-3.1 | VIVI-71, VIVI-74 |
| REQ-3.2 | VIVI-74 |
| REQ-3.3 | VIVI-74 |
| REQ-3.4 | VIVI-74 |
| REQ-3.5 | VIVI-74 |
| REQ-3.6 | VIVI-74 |
| REQ-3.7 | VIVI-74 |
| REQ-4.1 | VIVI-75, VIVI-76 |
| REQ-4.2 | VIVI-75, VIVI-76 |
| REQ-4.3 | VIVI-71, VIVI-75 |
| REQ-4.4 | VIVI-75 |
| REQ-4.5 | VIVI-75 |
| REQ-4.6 | VIVI-75 |
| REQ-4.7 | VIVI-75 |
| REQ-5.1 | VIVI-75, VIVI-76 |
| REQ-5.2 | VIVI-75, VIVI-76 |
| REQ-5.3 | VIVI-75 |
| REQ-5.4 | VIVI-75 |
| REQ-5.5 | VIVI-75 |
| REQ-5.6 | VIVI-75 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
