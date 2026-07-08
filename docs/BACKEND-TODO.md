# Backend — status da integração

Atualizado em 2026-07-08, depois da primeira leva de endpoints do backend.

## ✅ Pronto no backend e já integrado no app

| Recurso | Endpoint | Como o app usa |
|---|---|---|
| Início do dia com virada automática | `POST /api/v1/dias-de-venda/iniciar-hoje` | Botão "Abrir dia": se vier `acao: "decidir_sobras"`, o app mostra a decisão de sobras (stepper por produto) e chama de novo com `decisoes_sobra` |
| Correção retroativa | `POST /api/v1/dias-de-venda/{id}/correcoes` | Fluxo de "Corrigir informações" traduz o antes/depois para `producoes`, `itens_venda` (redução a partir das vendas mais recentes) e `vendas_adicionadas` |
| Confirmação IA sem erro HTTP | `POST /api/v1/ia/interacoes/{id}/confirmar` | `sucesso: false` mantém o sheet aberto com a mensagem amigável |
| Validação de datas futuras no período | `GET /api/v1/relatorios/periodo` | Calendário do app já bloqueava; agora o servidor também |
| Produto com preço flat | `POST /api/v1/produtos` | Cadastro envia `preco_venda`/`preco_custo`/`vigente_desde` direto |
| Linha do tempo nova | `GET /api/v1/historico/linha-do-tempo` | App lê `tipo` (caixa alta), `dataHora` e `dados`, mantendo os campos antigos como reserva |
| Resumo por data | `GET /api/v1/relatorios/dias/por-data/{data}/resumo` | Disponível no client (`api.relatorios.dayByDate`) |
| Produtos do dia | `GET /api/v1/relatorios/dias/{id}/produtos-venda` | Disponível no client (`api.relatorios.dayProducts`); a aba Venda hoje calcula o mesmo filtro localmente — dá para migrar quando quiser |

## ⏳ Ainda falta no backend

### 1. Autenticação (`/api/v1/auth/*`)

Login, logout, `me`, alterar senha e alterar e-mail — contratos detalhados em
`src/lib/api.ts`. O app já tem tela de login, sessão persistida, Bearer token e
tratamento de 401. **Quando pronto:** virar `AUTH_REQUIRED = true` em
`src/constants/auth.ts`.

### 2. Análise de vendas com IA (período)

`POST /api/v1/ia/analises` com `{ data_inicio, data_fim, contexto? }`
devolvendo `{ resumo, principais_achados[], mais_venderam[], mais_sobraram[],
sugestoes[], pontos_atencao[] }`. O card na tela Resumo já está pronto.
(O `interpretar-comando` genérico existe, mas análise de período estruturada não.)

### 3. Perfil do usuário no servidor

`GET/PATCH /api/v1/perfil` + foto. Hoje os dados do Perfil ficam só no
aparelho (`src/lib/profile.ts`).

### 4. Encoding/acentos na origem

O app corrige na exibição, mas vale garantir UTF-8 de ponta a ponta e corrigir
registros antigos (ex.: `Tran?a`).

### 5. Futuro — custo dos produtos com IA (README §15)

Receitas/insumos, interpretação de texto/áudio/foto de nota com confirmação
antes de salvar. Sem UI no app ainda.

## Observações de contrato (para conferir do lado do backend)

- **Correções**: o app envia `usuario_id` com o usuário logado ou `"app"`
  enquanto não há auth. Formato de `vendas_adicionadas` assumido como
  `[{ itens: [{ produto_id, quantidade }] }]` — confirmar se aceita campos
  extras como `observacoes`.
- **Resumo do dia**: o guia cita `sobra aproveitada` e `disponivel` no resumo;
  o app ainda não exibe esses campos porque os nomes exatos do JSON não foram
  confirmados. Mandando os nomes dos campos, é rápido mostrar.
- **iniciar-hoje**: o app não envia `observacoes` nesse endpoint (não está no
  guia). Se aceitar, dá para devolver o campo de observações na abertura do dia.
