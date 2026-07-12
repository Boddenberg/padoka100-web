# Planos de acesso no app

## Objetivo

O app usa o contrato de usuario autenticado para orientar navegacao e mensagens de upgrade, mas nao toma decisoes finais de seguranca. A autorizacao definitiva fica no backend.

Cada usuario autenticado pode receber:

- `plano`: `basico`, `analitico`, `ia` ou `admin`;
- `capacidades`: lista de permissoes liberadas pelo backend.

## Estrategia no frontend

O helper `src/lib/access.ts` centraliza:

- `hasAccess(user, capability)`: consulta se o usuario tem a capacidade;
- `planLabel(user)`: formata o plano exibido no perfil;
- `upgradeMessage(capability)`: mensagem amigavel para funcionalidade fora do plano.
- `featurePlanName(capability)`: nome do plano que libera a funcionalidade (ex.: "Analitico").

As telas devem usar capacidades, nao nomes de plano, porque o backend pode mudar a composicao dos planos sem exigir mudanca em cada tela.

## Features controladas

| Feature | Capacidade |
| --- | --- |
| Aba Resumo | `relatorios.avancados` |
| Lista de compras | `compras.usar` |
| Custeio assistido por produto | `custos.assistente` |
| Analise com IA no resumo | `ia.analitica` |
| Agente de IA na venda | `ia.operacional` |

## Decisoes

- O app esconde a aba Resumo quando o plano nao permite relatorios avancados.
- Entradas de features bloqueadas mostram uma mensagem de plano necessario, mantendo o usuario dentro do fluxo.
- Rotas diretas de features pagas exibem `LockedFeatureScreen`.
- O perfil mostra o plano recebido do backend para reduzir duvida de suporte.
- O app nao tenta inferir permissao por `papel`, porque dono da padaria nao e admin da plataforma.

## Manutencao

Para uma nova feature paga:

1. Confirme a capacidade criada no backend.
2. Adicione o plano em `FEATURE_PLAN`, para a mensagem e o CTA "Conhecer o Plano X".
3. Use `hasAccess(user, "capacidade")` no ponto de entrada da feature.
4. Proteja a rota direta com `LockedFeatureScreen` quando a tela puder ser aberta por link.
