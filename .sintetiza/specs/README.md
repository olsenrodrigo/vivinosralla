# Specs — Vivi Nosralla

Especificações executáveis do projeto, no padrão SDD Sintetiza (`~/.claude/sintetiza/sdd.md`).

**Projeto no Plane:** VIVI · `3244eb33-5e26-463d-ab0e-90807c6150ea`
**Origem:** `Propostas/VIVINOSRALLA/pre-projeto-viviane-nosralla.md` + `Proposta_VivianeNosralla_Sintetiza.html`

## Epics

**Projeto no Plane:** [Vivi Nosralla · VIVI](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/issues/) · 68 work items · 179h

| # | Epic | Slug | Blocos da proposta | Tasks | Horas | Plane | Depende de |
|---|---|---|---|---|---|---|---|
| 1 | [Loja Virtual com Conceito de Marca](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/c32665d9-7816-48d2-aeac-f00cd7c2f9ac/) | `loja-virtual-marca` | A1, A2, A4 | 8 | 24h | VIVI-1, VIVI-39, VIVI-40, VIVI-41, VIVI-42, VIVI-43, VIVI-44, VIVI-45 | VIVI-53 |
| 2 | [Checkout, Pagamentos e Frete](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/f154a922-b30b-4aad-a11c-89b31c36c875/) | `checkout-pagamentos-frete` | A3, B8 | 7 | 16h | VIVI-46…52 | VIVI-46 · VIVI-53 |
| 3 | [Catálogo e Estoque Unificado](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/07450499-2306-4418-b938-4f65a7528e00/) | `catalogo-estoque-unificado` | B1, B2 | 6 | 18h | VIVI-53…58 | — |
| 4 | [Operação de Loja — PDV e Etiquetas](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/6c99ed33-37aa-4945-873f-8af73a70ac80/) | `pdv-etiquetas` | B3, B9 | 7 | 17h | VIVI-59…65 | VIVI-56 · VIVI-72 |
| 5 | [Consignado com Controle de Retorno](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/e312905b-f3a9-49b6-a961-0250e5c7807c/) | `consignado` | B4 | 5 | 10h | VIVI-66…70 | VIVI-56 · VIVI-72 · VIVI-47 |
| 6 | [Base Única de Clientes e Indicadores](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/339a48f0-1edd-4261-9a93-51e71c2c9ad9/) | `clientes-indicadores` | B5, B11 | 6 | 12h | VIVI-71…76 | VIVI-56 |
| 7 | [Financeiro, Caixa e Conciliação](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/edb1abab-656e-40f3-a291-65402f91ff27/) | `financeiro-conciliacao` | B6, B7 | 7 | 22h | VIVI-77…83 | VIVI-47 · VIVI-51 |
| 8 | [Cupom Fiscal NFC-e](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/4d6cd943-a3b2-400b-85a9-28ba7f247a2f/) | `fiscal-nfce` | B10 | 5 | 12h | VIVI-84…88 | VIVI-60 |
| 9 | [Assistente de Vendas com CRM](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/3448a6a7-6c90-4a37-80a2-2731da1b3d1f/) | `ia-assistente-vendas` | C1 | 6 | 16h | VIVI-89…94 | VIVI-56 · VIVI-47 · VIVI-72 |
| 10 | [Estúdio Visual IA](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/e4980ff5-6478-48f7-953e-4fb94c53878c/) | `ia-estudio-visual` | C2 | 5 | 12h | VIVI-95…99 | VIVI-54 |
| 11 | [Implantação e Go-Live](https://app.plane.so/sintetizaai/projects/3244eb33-5e26-463d-ab0e-90807c6150ea/modules/17c02843-e5fa-4045-803d-43e306ef8cc8/) | `implantacao-golive` | D1–D4 | 6 | 20h | VIVI-100…105 | todos |
| | **Total** | | | **68** | **179h** | | |

## Convenções deste projeto

- **Deploy single-tenant.** Cada loja whitelabel roda em uma instância própria, com banco próprio.
  Não existe `organization_id`. O equivalente ao isolamento multi-tenant do harness (regra #8) aqui é
  **isolamento por titular do dado**: cliente só acessa o próprio pedido/carrinho, e toda rota de
  backoffice exige sessão administrativa. Todo epic que toca dado de cliente tem critérios explícitos
  de IDOR, autorização, validação de borda e LGPD.
- **Estoque é um saldo único.** Loja física e loja virtual consultam e baixam a mesma linha.
  Qualquer feature que movimente peça registra em `stock_movements`.
- Os artefatos desta pasta são commitados no repositório. O Plane continua sendo a fonte de verdade
  de estado, responsável e horas.
