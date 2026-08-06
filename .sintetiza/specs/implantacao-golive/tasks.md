# Tasks — Implantação e Go-Live

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/17c02843-e5fa-4045-803d-43e306ef8cc8/ · **Spec:** ./requirements.md · **Design:** ./design.md

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Provisionar produção e homologação com domínio, SSL e restart | VIVI-100 | REQ-1.1 … REQ-1.7 | 2h | — |
| 2 | Configurar backup diário externo com restauração testada | VIVI-101 | REQ-2.1 … REQ-2.5 | 1h | VIVI-100 |
| 3 | Estender o importador e migrar produtos, variações e estoque | VIVI-102 | REQ-3.1, REQ-3.2, REQ-3.4, REQ-3.5, REQ-3.7 … REQ-3.9 | 3h | VIVI-100 |
| 4 | Migrar a base de clientes com deduplicação e base legal | VIVI-103 | REQ-3.3, REQ-3.6 | 2h | VIVI-102 |
| 5 | Executar o roteiro de verificação ponta a ponta com evidências | VIVI-104 | REQ-4.1 … REQ-4.6 | 7h | VIVI-102, VIVI-103 |
| 6 | Publicar o manual de operação e treinar a equipe | VIVI-105 | REQ-5.1 … REQ-5.5 | 5h | VIVI-104 |
| | **Total** | | | **20h** | |

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | VIVI-100 |
| REQ-1.2 | VIVI-100 |
| REQ-1.3 | VIVI-100 |
| REQ-1.4 | VIVI-100 |
| REQ-1.5 | VIVI-100 |
| REQ-1.6 | VIVI-100 |
| REQ-1.7 | VIVI-100 |
| REQ-2.1 | VIVI-101 |
| REQ-2.2 | VIVI-101 |
| REQ-2.3 | VIVI-101 |
| REQ-2.4 | VIVI-101 |
| REQ-2.5 | VIVI-101 |
| REQ-3.1 | VIVI-102 |
| REQ-3.2 | VIVI-102 |
| REQ-3.3 | VIVI-103 |
| REQ-3.4 | VIVI-102 |
| REQ-3.5 | VIVI-102 |
| REQ-3.6 | VIVI-103 |
| REQ-3.7 | VIVI-102 |
| REQ-3.8 | VIVI-102 |
| REQ-3.9 | VIVI-102 |
| REQ-4.1 | VIVI-104 |
| REQ-4.2 | VIVI-104 |
| REQ-4.3 | VIVI-104 |
| REQ-4.4 | VIVI-104 |
| REQ-4.5 | VIVI-104 |
| REQ-4.6 | VIVI-104 |
| REQ-5.1 | VIVI-105 |
| REQ-5.2 | VIVI-105 |
| REQ-5.3 | VIVI-105 |
| REQ-5.4 | VIVI-105 |
| REQ-5.5 | VIVI-105 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
