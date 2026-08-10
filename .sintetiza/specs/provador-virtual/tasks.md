# Tasks — Provador Virtual

**Module no Plane:** https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/cc181dbe-9a67-4b31-8dd1-b0e712f79374/ · (a criar) · **Spec:** ./requirements.md · **Design:** ./design.md

A coluna Plane fica vazia até as tasks serem criadas no Plane; a Cobertura referencia o `#` da
task e passa a citar o `VIVI-NNN` quando ele existir.

| # | Task | Plane | Atende | Est. | Depende de |
|---|---|---|---|---|---|
| 1 | Criar migration do provador (fotos, provas, colunas de settings e galeria) | VIVI-111 | REQ-1.3, REQ-2.1, REQ-2.3, REQ-6.1 | 2h | — |
| 2 | Generalizar `ImageProvider` e implementar adaptador Higgsfield com mock | VIVI-112 | REQ-2.5, REQ-2.10, REQ-6.10 | 4h | — |
| 3 | Implementar upload com consentimento, saneamento (sharp/EXIF) e bloqueio do static | VIVI-113 | REQ-1.3 … REQ-1.8, REQ-3.7, REQ-6.12 | 4h | 1 |
| 4 | Implementar fila de provas: seleção da foto da peça, webhook idempotente, polling, falhas e watermark | VIVI-114 | REQ-2.1 … REQ-2.4, REQ-2.6 … REQ-2.9, REQ-3.4, REQ-4.1, REQ-4.2, REQ-4.4, REQ-4.6, REQ-5.7, REQ-6.6, REQ-6.8 | 5h | 1, 2, 3 |
| 5 | Implementar rotas de status, resultado e exclusão com ownership por sessão | VIVI-115 | REQ-3.1, REQ-3.5, REQ-3.6, REQ-3.7, REQ-6.4, REQ-6.5, REQ-6.7 | 3h | 4 |
| 6 | Implementar limites por IP, cota de sessão, teto mensal e kill-switch | VIVI-116 | REQ-5.1 … REQ-5.6 | 2h | 4 |
| 7 | Implementar expurgo automático de fotos e resultados e higiene de logs | VIVI-117 | REQ-6.1 … REQ-6.3, REQ-6.5, REQ-6.9 | 2h | 3, 4 |
| 8 | Implementar UI do provador na PDP: modal de consentimento, espera, resultado rotulado, troca de cor e exclusão | VIVI-118 | REQ-1.1, REQ-1.2, REQ-3.2, REQ-3.3, REQ-3.8, REQ-4.3, REQ-4.4, REQ-4.5, REQ-5.5, REQ-6.4 | 5h | 5, 6 |
| 9 | Atualizar a política de privacidade com a seção do provador virtual | VIVI-119 | REQ-6.11 | 1h | — |
| | **Total** | | | **28h** | |

Notas de execução:

- Task 1: número da migration é **a próxima livre** no momento da implementação (o repo está em
  `013`; specs irmãs citam `021` e `012`, desatualizadas — ver nota de colisão no `design.md`).
  Schema espelhado em `shared/schema.ts` na mesma task.
- Task 3 é o **primeiro uso real de `sharp` no repo** (declarado, nunca importado): a evidência de
  pronto inclui `npm run build` + boot com um upload real, não só `npm run check`.
- Task 4 usa `HIGGSFIELD_MOCK_SCENARIO` para evidenciar os caminhos tristes sem gastar crédito.
- Tasks 2 e 9 não dependem de nada e podem rodar em paralelo com a 1.

## Cobertura

| Critério | Task |
|---|---|
| REQ-1.1 | 8 |
| REQ-1.2 | 8 |
| REQ-1.3 | 1, 3 |
| REQ-1.4 | 3 |
| REQ-1.5 | 3 |
| REQ-1.6 | 3 |
| REQ-1.7 | 3 |
| REQ-1.8 | 3 |
| REQ-2.1 | 1, 4 |
| REQ-2.2 | 4 |
| REQ-2.3 | 1, 4 |
| REQ-2.4 | 4 |
| REQ-2.5 | 2 |
| REQ-2.6 | 4 |
| REQ-2.7 | 4 |
| REQ-2.8 | 4 |
| REQ-2.9 | 4 |
| REQ-2.10 | 2 |
| REQ-3.1 | 5 |
| REQ-3.2 | 8 |
| REQ-3.3 | 8 |
| REQ-3.4 | 4 |
| REQ-3.5 | 5 |
| REQ-3.6 | 5 |
| REQ-3.7 | 3, 5 |
| REQ-3.8 | 8 |
| REQ-4.1 | 4 |
| REQ-4.2 | 4 |
| REQ-4.3 | 8 |
| REQ-4.4 | 4, 8 |
| REQ-4.5 | 8 |
| REQ-4.6 | 4 |
| REQ-5.1 | 6 |
| REQ-5.2 | 6 |
| REQ-5.3 | 6 |
| REQ-5.4 | 6 |
| REQ-5.5 | 6, 8 |
| REQ-5.6 | 6 |
| REQ-5.7 | 4 |
| REQ-6.1 | 1, 7 |
| REQ-6.2 | 7 |
| REQ-6.3 | 7 |
| REQ-6.4 | 5, 8 |
| REQ-6.5 | 5, 7 |
| REQ-6.6 | 4 |
| REQ-6.7 | 5 |
| REQ-6.8 | 4 |
| REQ-6.9 | 7 |
| REQ-6.10 | 2 |
| REQ-6.11 | 9 |
| REQ-6.12 | 3 |

_Todo critério de requirements.md aparece nesta tabela. Sem exceção._
