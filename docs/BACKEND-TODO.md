# Backend — o que falta implementar

O front-end já está pronto e espera estes recursos. Os contratos abaixo foram
definidos no app (`src/lib/api.ts` e `src/types/api.ts`); implementando igual,
nada precisa mudar no front. Enquanto os endpoints não existem, o app mostra
mensagens de "recurso em construção" em vez de quebrar.

## 1. Autenticação (`/api/v1/auth/*`)

O app já tem tela de login, sessão persistida, Bearer token em toda chamada,
logout, troca de senha/e-mail e tratamento de 401 (sessão expirada derruba a
sessão local). Falta o servidor:

| Endpoint | Método | Request | Response |
|---|---|---|---|
| `/api/v1/auth/login` | POST | `{ usuario, senha }` | `{ token, usuario: { id, usuario, email?, nome? } }` |
| `/api/v1/auth/logout` | POST | — | 204 |
| `/api/v1/auth/me` | GET | (Bearer) | `UsuarioPerfil` |
| `/api/v1/auth/alterar-senha` | POST | `{ senha_atual, senha_nova }` | 204 |
| `/api/v1/auth/alterar-email` | POST | `{ email, senha }` | `UsuarioPerfil` |

- O token vai no header `Authorization: Bearer <token>` em todas as rotas `/api/v1/*`.
- Erros esperados: `401/403` para credencial inválida (o app traduz para
  "Usuário ou senha inválidos").
- **Quando estiver pronto:** mudar `AUTH_REQUIRED` para `true` em
  `src/constants/auth.ts`. Com isso o app passa a exigir login antes de
  qualquer tela (a proteção de rotas já está implementada).

## 2. Correção retroativa de dia fechado

Fluxo completo já existe no app (aviso → edição → resumo das alterações →
salvar). Falta o endpoint:

- `PATCH /api/v1/dias-de-venda/{dia_id}/correcao`
- Request:

```json
{
  "motivo": "venda que faltou lançar",
  "itens": [
    { "produto_id": "uuid", "quantidade_produzida": 20, "quantidade_vendida": 5 }
  ]
}
```

- Response: `ResumoDoDia` atualizado (mesmo formato de
  `GET /api/v1/relatorios/dias/{id}/resumo`).
- Regras esperadas no servidor:
  - aceitar correção só em dia fechado (dia aberto já tem os fluxos normais);
  - recalcular faturamento/lucro/sobra do dia;
  - registrar evento na linha do tempo (ex.: `correcao_realizada`) com o motivo
    e o antes/depois — o app já mostra "Correção realizada" no histórico;
  - permitir produto que não estava no dia (o app envia produto novo com as
    quantidades) e zerar produto lançado errado (quantidades 0).

## 3. Análise de vendas com IA

Card pronto na tela Resumo (análise padrão do período + contexto opcional).
Falta o endpoint:

- `POST /api/v1/ia/analises`
- Request: `{ "data_inicio": "2026-07-01", "data_fim": "2026-07-08", "contexto": "ignore os pudins" }`
  (`contexto` pode vir `null`)
- Response (todas as listas são opcionais; o app só renderiza o que vier):

```json
{
  "resumo": "texto curto da análise",
  "principais_achados": ["..."],
  "mais_venderam": ["Pão de Queijo (32 un.)"],
  "mais_sobraram": ["Pão Sovado (10 un.)"],
  "sugestoes": ["..."],
  "pontos_atencao": ["..."],
  "modelo_usado": "gpt-..."
}
```

## 4. Validação de datas futuras

O calendário do app já bloqueia datas/meses futuros, mas o README pede a mesma
validação no servidor:

- `POST /api/v1/dias-de-venda`: rejeitar `data_venda` futura;
- `GET /api/v1/relatorios/periodo`: rejeitar (ou truncar) `data_fim` futura;
- correção retroativa: rejeitar datas futuras.

## 5. Nomes de produto com acento no banco

O app corrige na exibição ("pao sovado" → "Pão Sovado", "Tran?a" → "Trança"),
mas o dado na origem continua errado. Vale:

- garantir encoding UTF-8 de ponta a ponta (o "Tran?a" indica perda de encoding
  em algum ponto da cadeia);
- corrigir os registros existentes (`produtos.nome`);
- nunca devolver slug/código interno como nome de exibição.

## 6. Eventos da linha do tempo mais descritivos (opcional)

O app humaniza `tipo_evento` técnico (ex.: `dia_D_venda_aberto` → "Dia
aberto"). Ajudaria o servidor mandar `tipo_evento` estável e documentado
(ex.: `dia_aberto`, `venda_registrada`, `venda_cancelada`, `producao_registrada`,
`produto_esgotado`, `dia_fechado`, `correcao_realizada`) e `detalhes` com
`nome_produto` e `quantidade` quando fizer sentido.

## 7. Perfil do usuário no servidor (hoje é local)

Foto, nome, nascimento, telefone e e-mail do Perfil ficam salvos só no
aparelho (`AsyncStorage`). Quando houver auth, criar:

- `GET/PATCH /api/v1/perfil` (dados pessoais);
- upload da foto de perfil (pode reaproveitar o fluxo de mídia existente).

O front passa a sincronizar trocando a implementação de `src/lib/profile.ts`.

## 8. Futuro — custo dos produtos com IA (README §15)

Ainda sem UI no app (funcionalidade futura). Vai precisar de:

- endpoints de receitas/insumos e custos por produto;
- interpretação por IA de texto/áudio/foto de nota fiscal com pergunta de
  volta quando faltar dado (a IA não pode inventar valores);
- confirmação antes de salvar (mesmo padrão dos comandos de venda atuais).

---

## Resumo rápido (ordem sugerida de implementação)

1. **Correção de encoding/acentos** (5) — barato e melhora tudo.
2. **Validação de datas futuras** (4) — barato.
3. **Correção retroativa** (2) — o fluxo do app já está pronto esperando.
4. **Análise IA** (3) — o card já está pronto esperando.
5. **Auth** (1) — depois vire `AUTH_REQUIRED = true`.
6. **Perfil no servidor** (7).
7. **Custos com IA** (8) — próximo grande passo do produto.
