# Backend — status da integração

Atualizado em 2026-07-08, depois das levas de auth, perfil, análise IA e custos.

## ⚠️ IMPORTANTE: produção (Railway) está atrás do localhost

O app (Expo Go) aponta por padrão para `https://padoka100-production.up.railway.app`.
Em 2026-07-08 esse servidor **só tem o conjunto antigo** de endpoints. Faltam em
produção (dão 404): `auth/*`, `perfil/*`, `ia/analises/*`, `ia/dados-estruturados`,
`custos/*`, `dias-de-venda/iniciar-hoje`, `dias-de-venda/{id}/correcoes`,
`relatorios/dias/por-data` e `produtos-venda`.

**Consequência:** criar conta / login / análise IA / correção retroativa só
funcionam apontando para um servidor com o backend novo (o localhost do dev, via
Perfil → Conexão → Local + IP da máquina), ou **depois de publicar o backend novo
no Railway**. O app agora degrada com elegância: abrir o dia cai no endpoint
clássico, e as telas mostram recado amigável em vez de "not found".

👉 **Ação principal do backend: fazer deploy da versão nova no Railway.**

## ✅ Pronto no backend e já integrado no app

| Recurso | Endpoint | Como o app usa |
|---|---|---|
| Registro (1º vira dono) | `POST /api/v1/auth/registrar` | Aba "Criar conta" na tela de login (nome, telefone, e-mail, senha) |
| Login | `POST /api/v1/auth/login` | Login por e-mail/senha; guarda `access_token` e busca o perfil |
| Perfil | `GET/PATCH /api/v1/perfil/me` | Tela Perfil sincroniza nome, telefone, nascimento e e-mail quando logado |
| Trocar senha | `POST /api/v1/auth/trocar-senha` | Sheet "Alterar senha" (`senha_atual` + `nova_senha`) |
| Logout | `POST /api/v1/auth/logout` | Botão "Sair da conta" |
| Análise padrão | `POST /api/v1/ia/analises/padrao` | Card de IA no Resumo, sem pergunta (Bearer + dono) |
| Análise específica | `POST /api/v1/ia/analises/especifica` | Card de IA quando a pessoa digita uma pergunta |
| Início do dia | `POST /api/v1/dias-de-venda/iniciar-hoje` | Abrir dia com decisão de sobras |
| Correção retroativa | `POST /api/v1/dias-de-venda/{id}/correcoes` | Fluxo "Corrigir informações" |
| Confirmação IA | `POST /api/v1/ia/interacoes/{id}/confirmar` | Trata `sucesso: false` sem fechar o sheet |
| Produto flat | `POST /api/v1/produtos` | Cadastro com `preco_venda`/`preco_custo`/`vigente_desde` |
| Linha do tempo | `GET /api/v1/historico/linha-do-tempo` | Lê `tipo`/`dataHora`/`dados` |
| Resumo por data | `GET /api/v1/relatorios/dias/por-data/{data}/resumo` | No client (`api.relatorios.dayByDate`) |
| Produtos do dia | `GET /api/v1/relatorios/dias/{id}/produtos-venda` | No client (`api.relatorios.dayProducts`) |

O login agora é **obrigatorio** (`AUTH_REQUIRED = true` em `src/constants/auth.ts`).
O app usa Supabase Auth para obter a sessao e envia `Authorization: Bearer` para
o backend. O backend ainda aceita `X-API-Key` como compatibilidade operacional.

## 🟡 Client pronto, UI ainda não construída

| Recurso | Endpoints | Situação |
|---|---|---|
| Custos, insumos e receitas | `/api/v1/custos/*` (`api.custos.*`) | Métodos no client prontos. Falta a experiência guiada de custos (README §15): cadastro de insumos/receitas, custos adicionais e cálculo por produto. É a próxima grande tela. |
| Dados estruturados p/ IA | `GET /api/v1/ia/dados-estruturados/periodo` (`api.ia.structuredData`) | No client; sem uso direto na UI ainda. |
| Gestão de usuários (dono) | `GET /auth/usuarios`, `PATCH /auth/usuarios/{id}/papel` | Sem UI. Falta tela de gestão de papéis. |

## ✅ Pendências que foram resolvidas nesta leva

- **Resposta da análise IA**: formato confirmado. O app renderiza `resumo` +
  seções `principais_achados`/`mais_venderam`/`mais_sobraram`/`sugestoes`/
  `pontos_atencao`, tratando itens em objeto (`produto`, `quantidade_vendida`,
  `quantidade_sobra`, `faturamento`) como linhas legíveis, e cai para `analise`
  (texto) se preciso.
- **Alterar e-mail**: confirmado via `PATCH /perfil/me { email }` (409 se em uso).
- **Foto de perfil**: integrado o `POST /perfil/me/foto` — ao escolher a foto
  no Perfil estando logado, o app sobe o arquivo e usa a `foto_url` retornada.
- **Resumo do dia**: nomes exatos confirmados. O app exibe `total_sobra_aproveitada`
  ("Aproveitou X do dia anterior"), `total_disponivel`, usa o flag `esgotado`
  e `participou_da_venda` para a aba Venda, e `itens_vendidos`/`faturamento_total`
  como reserva.

## ⏳ Ainda pendente

- **Refresh token**: ainda não existe (limite conhecido). O app trata 401
  derrubando a sessão e pedindo login de novo. Ok assim por enquanto.
- **Tela de custos** (README §15): client pronto (`api.custos.*`), UI a construir.
- **Gestão de usuários/papéis** (dono): endpoints prontos, sem UI.
- **Foto de nota fiscal + OCR** para custos: ainda não existe no backend.

## 🔜 Futuro (README §15)

- Foto de nota fiscal + OCR para custos (limite conhecido: ainda não existe).
- Experiência guiada por IA/áudio para montar receitas e custos.
