# Padoka 100 Mobile

App React Native com Expo para iOS e Android. A aplicacao abre direto no modo venda e integra com o backend FastAPI publicado no Railway.

## Stack

- Expo + React Native + TypeScript
- Expo Router
- TanStack Query
- SecureStore para API key
- AsyncStorage para preferencia de ambiente
- expo-image-picker para fotos de produtos
- expo-audio para vendas por voz
- EAS Build para empacotar Android e iOS

## Rodar no Expo Go

```bash
npm install
npx expo install --fix
npm run start
```

Depois escaneie o QR Code com o Expo Go no iOS ou Android.

## Backend

O app usa por padrao:

- Producao: `https://padoka100-production.up.railway.app`
- Local: `http://localhost:8000`

No celular fisico, `localhost` aponta para o proprio aparelho. Para testar backend local, altere `expo.extra.apiLocalUrl` em `app.json` para o IP da maquina na rede, por exemplo:

```json
"apiLocalUrl": "http://192.168.0.10:8000"
```

A API key deve ser salva na aba **Ajustes**. Ela fica no SecureStore do dispositivo.

## Funcionalidades

- Abrir dia de venda com producao por produto
- Editar producao do dia
- Listar produtos ativos e registrar venda manual pelo carrinho
- Listar e cancelar vendas do dia
- Fechar dia
- Criar produtos, locais e versoes de preco
- Fotografar produto e enviar multipart
- Consultar resumo por periodo e historico recente
- Interpretar venda por texto
- Gravar audio com `expo-audio`, transcrever e confirmar venda por IA

## Builds

Preview Android APK:

```bash
eas build -p android --profile preview
```

Preview iOS:

```bash
eas build -p ios --profile preview
```

Producao:

```bash
eas build -p android --profile production
eas build -p ios --profile production
```

Para iOS, e necessario Apple Developer Account. Para envio as lojas, use `eas submit`.

### Primeiro build: rode no terminal, em modo interativo

O primeiro build de cada plataforma **precisa ser executado do seu terminal** (`eas build -p ios ...` / `eas build -p android ...`), porque o EAS pergunta interativamente se pode gerar as credenciais (certificado de distribuicao da Apple, keystore do Android) e as salva nos servidores do Expo.

Builds disparados de forma nao-interativa (dashboard do EAS, integracao com GitHub, CI) falham com `Distribution Certificate is not validated for non-interactive builds` enquanto as credenciais nao existirem. Depois do primeiro build interativo, os proximos podem ser disparados de qualquer lugar.

Passo a passo para o iOS:

```bash
npm install -g eas-cli
eas login
eas build -p ios --profile production   # responda "yes" para gerar as credenciais
```



TODO's:

# README — Front-end do App da Padaria

## 1. Visão geral do projeto

Este projeto é o front-end de um aplicativo para apoiar a rotina de uma pequena padaria familiar.

O objetivo do app é ajudar no controle diário de vendas, produção, catálogo de produtos, resumo financeiro, histórico de movimentações, perfil de usuário e, futuramente, análises com inteligência artificial.

O público principal são pessoas que precisam de uma experiência simples, direta e sem linguagem técnica. O app precisa ser fácil de usar mesmo para quem não tem familiaridade com tecnologia.

---

## 2. Objetivo do front-end

O front-end deve entregar uma experiência bonita, moderna, simples e confiável.

Ele precisa permitir que o usuário consiga:

- abrir e acompanhar o dia de venda;
- visualizar somente os produtos disponíveis para vender naquele dia;
- registrar vendas;
- visualizar produtos esgotados quando eles participaram do dia;
- consultar o catálogo completo;
- acompanhar faturamento por período;
- visualizar gráficos de vendas;
- consultar histórico de movimentações em linguagem humana;
- clicar em datas no calendário para ver o resumo de um dia;
- corrigir dias já fechados de forma controlada;
- acessar o perfil do usuário;
- fazer login;
- alterar senha;
- pedir análises com inteligência artificial;
- futuramente cadastrar receitas e custos dos produtos com ajuda da IA.

---

## 3. Telas principais

O app deve ter como telas principais:

- Venda
- Catálogo
- Resumo
- Perfil

A tela de Ajustes deve deixar de ser o foco do app. O menu Ajustes deve ser substituído por Perfil.

Menu inferior esperado:

```txt
Venda
Catálogo
Resumo
Perfil
```

---

## 4. Tela Venda

### 4.1 Ordem das informações

Na tela inicial de venda, o cumprimento precisa aparecer no topo, antes do título da tela.

Hoje está errado quando aparece algo como:

```txt
Dia aberto
Bom dia
Venda
```

A ordem desejada é:

```txt
Bom dia!
Venda
```

O cumprimento deve mudar de acordo com a hora do dia:

```txt
Bom dia!
Boa tarde!
Boa noite!
```

Depois disso, aparecem as informações da venda do dia, como status, data, faturamento do dia, itens vendidos e ações principais.

---

### 4.2 Produtos exibidos na aba Venda

A aba Venda não deve ser um catálogo.

Ela deve mostrar somente os produtos que fazem parte da venda do dia.

Se o dia foi aberto com:

```txt
20 Pães de Queijo
20 Pães de Soja
```

A tela deve mostrar somente:

```txt
Pão de Queijo
Pão de Soja
```

Ela não deve mostrar produtos cadastrados que não entraram na venda do dia, por exemplo:

```txt
Pão de Calabresa - 0
Pão Sovado - 0
Trança de Calabresa - 0
```

Esses produtos podem existir no catálogo, mas não devem aparecer na venda se não foram colocados para vender hoje.

---

### 4.3 Produtos esgotados

Produto com zero unidades só deve aparecer na aba Venda se ele participou da venda do dia.

Exemplo:

```txt
Pão de Queijo começou o dia com 20 unidades.
Foram vendidas as 20 unidades.
Agora ele está com 0.
```

Nesse caso, ele deve continuar aparecendo como:

```txt
Pão de Queijo
Esgotado
```

Regra desejada:

```txt
Se entrou na venda do dia, aparece.
Se entrou e esgotou, continua aparecendo.
Se nunca entrou na venda do dia, não aparece.
```

---

## 5. Tela Catálogo

A tela de Catálogo deve exibir todos os produtos cadastrados no sistema.

Ela é diferente da tela Venda.

- Catálogo: todos os produtos existentes.
- Venda: somente produtos colocados para vender naquele dia.

Essa separação precisa estar clara na interface.

---

## 6. Tela Resumo

### 6.1 Ordem da tela

A tela de Resumo deve seguir esta ordem:

```txt
1. Faturamento do período
2. Período selecionado
3. Gráfico de vendas
4. Análise com IA
5. Histórico
```

O faturamento do período precisa ser a primeira informação da tela.

O período precisa aparecer antes do gráfico.

O gráfico deve representar o período selecionado.

---

### 6.2 Faturamento do período

O faturamento do período deve ser o destaque principal da tela.

Exemplo:

```txt
Faturamento do período
R$ 650,00
```

Essa informação deve aparecer antes do filtro de período e antes do gráfico.

---

### 6.3 Período

O período selecionado deve vir logo após o faturamento.

O usuário precisa entender claramente se está olhando:

- hoje;
- semana;
- mês;
- período personalizado;
- uma data específica;
- um intervalo específico.

---

### 6.4 Gráfico de vendas

No gráfico de barras, os valores precisam ficar próximos da barra correspondente.

Problema atual:

- quando um dia vende R$ 40 e outro vende R$ 650, os dois números aparecem flutuando na mesma altura;
- o R$ 40 fica longe da barrinha pequena;
- visualmente parece feio e desconectado.

Comportamento desejado:

```txt
R$ 40 deve ficar logo acima da barra pequena.
R$ 650 deve ficar logo acima da barra alta.
```

Cada número deve acompanhar a altura da própria barra.

---

## 7. Calendário e seleção de datas

O calendário da tela Resumo não deve permitir navegar para datas futuras.

Regra:

```txt
Pode selecionar o mês atual e meses anteriores.
Não pode selecionar meses futuros.
Não pode selecionar dias futuros dentro do mês atual.
```

Exemplo:

Se hoje é 08/07/2026:

```txt
Pode selecionar: 08/07/2026 e datas anteriores.
Pode navegar para: junho, maio, abril etc.
Não pode selecionar: 09/07/2026 em diante.
Não pode navegar para: agosto, setembro ou qualquer mês futuro.
Não pode navegar para: julho de 2027.
```

O bloqueio deve ser visual no front-end, mas também precisa existir validação no back-end.

---

## 8. Consulta de dias fechados pelo calendário

Na tela Resumo, quando o usuário clicar em uma data do calendário, deve abrir um resumo daquele dia.

Esse detalhe pode ser uma nova tela, modal, bottom sheet ou outra solução visual adequada.

O resumo do dia deve mostrar:

- data;
- status do dia;
- faturamento total;
- itens vendidos;
- produtos produzidos;
- produtos vendidos;
- produtos que sobraram;
- produtos esgotados;
- histórico daquele dia;
- correções feitas depois do fechamento, se existirem.

Exemplo:

```txt
Resumo do dia 04/07/2026

Status: Fechado
Faturamento: R$ 40,00
Itens vendidos: 4
Produtos com sobra: 2
Produtos esgotados: 0
```

Lista de produtos:

```txt
Pão de Queijo
Produzido: 20
Vendido: 4
Sobrou: 16
Faturamento: R$ 40,00
```

---

## 9. Correção de dias já fechados

O usuário precisa conseguir corrigir um dia já fechado.

Hoje, quando o dia está aberto, é fácil vender, produzir mais, ajustar e deletar. Depois que o dia fecha, se algo estiver errado, fica errado.

O app precisa permitir correção retroativa com controle.

### 9.1 Entrada no modo de edição

No resumo de um dia fechado, deve existir uma ação como:

```txt
Editar dia
Corrigir informações
Ajustar venda do dia
```

Ao entrar nesse modo, o app deve avisar:

```txt
Você está editando um dia já fechado.
As alterações podem mudar o faturamento, o histórico, os gráficos e as análises.
Deseja continuar?
```

Botões:

```txt
Continuar edição
Cancelar
```

---

### 9.2 O que pode ser corrigido

O app deve permitir corrigir:

- quantidade produzida;
- quantidade vendida;
- quantidade que sobrou;
- produto lançado errado;
- venda que faltou lançar;
- venda lançada por engano;
- produto que deveria ter entrado no dia;
- produto que não deveria ter entrado no dia;
- preço usado em alguma venda, se necessário.

---

### 9.3 Confirmação antes de salvar

Antes de salvar alterações em um dia fechado, o app deve mostrar um resumo do que será alterado.

Exemplo:

```txt
Resumo das alterações

Pão de Queijo
Vendido: 4 → 5
Faturamento: R$ 40,00 → R$ 50,00

Novo faturamento do dia:
R$ 50,00

Deseja salvar essas alterações?
```

Botões:

```txt
Salvar correções
Cancelar
```

---

### 9.4 Visual diferente para edição retroativa

O usuário precisa saber claramente que está editando um dia fechado, e não o dia atual.

Exemplos de labels:

```txt
Dia fechado
Editando dia fechado
Correção retroativa
```

---

## 10. Histórico

O histórico não deve mostrar logs técnicos ou nomes internos do back-end.

Não deve aparecer algo como:

```txt
dia_D_venda_aberto
produto_D_adicionado
venda_D_cancelada
```

Deve aparecer em linguagem humana:

```txt
Dia aberto
Venda realizada
Produto adicionado
Produto esgotado
Dia fechado
Correção realizada
```

A ideia é que o histórico pareça uma linha do tempo da padaria, não um log técnico.

---

## 11. Correção de acentos e nomes

Nomes de produtos precisam aparecer corretamente.

Problemas atuais:

```txt
Tran?a de calabresa
Pao sovado
Pao de queijo
```

Devem aparecer como:

```txt
Trança de Calabresa
Pão Sovado
Pão de Queijo
```

O front-end não deve exibir slug, código interno ou nome técnico como nome do produto.

---

## 12. Tela Perfil

A tela Perfil substitui a tela Ajustes.

Ela deve ser simples, bonita e fácil de entender.

Campos desejados:

- foto;
- nome;
- data de nascimento;
- telefone;
- e-mail.

Área de conta e segurança:

- usuário;
- e-mail de acesso;
- senha;
- alterar senha;
- alterar e-mail;
- sair da conta.

Agora essa parte deve ser considerada funcionalidade real do projeto, não apenas visual.

---

## 13. Autenticação no front-end

O front-end deve ter fluxo real de autenticação.

Funcionalidades esperadas:

- tela de login;
- login com usuário/e-mail e senha;
- sessão autenticada;
- proteção de rotas;
- logout;
- tela ou fluxo para troca de senha;
- feedback de erro de login;
- feedback de senha inválida;
- carregamento durante autenticação;
- tratamento de sessão expirada.

A experiência precisa ser simples e segura.

---

## 14. Análise com Inteligência Artificial

A análise com IA deve ficar na tela Resumo.

O usuário deve ter um botão como:

```txt
Solicitar análise
Gerar análise
Analisar vendas
```

Deve existir uma análise padrão baseada no período selecionado.

Também deve existir um campo opcional para contexto específico.

Exemplos de pedidos:

```txt
Analise somente abril.
Ignore os pudins.
Veja só o pão de calabresa.
Quero saber o que mais sobrou.
Quero entender o que devo produzir menos.
```

O front-end deve permitir enviar esse contexto e renderizar a resposta de forma bonita.

A resposta da IA não deve aparecer como um bloco cru gigante. Ela pode ser organizada em seções, como:

- resumo da análise;
- principais achados;
- produtos que mais venderam;
- produtos que mais sobraram;
- sugestões;
- pontos de atenção.

---

## 15. Cálculo de custo dos produtos

Esta será uma funcionalidade futura importante e complexa.

O objetivo é ajudar o usuário a descobrir quanto custa produzir cada produto.

O usuário pode não saber calcular o custo sozinho. Então o app precisa oferecer uma experiência guiada, possivelmente com IA.

### 15.1 Formas de entrada

O usuário deve poder informar dados por:

- texto;
- áudio;
- foto de nota fiscal ou recibo;
- formulário simples;
- correções posteriores por voz ou botão.

### 15.2 Experiência guiada

A IA deve ajudar perguntando o que falta.

Exemplo:

```txt
Usuário:
Comprei 1 kg de farinha por 5 reais e usei 800 gramas no pão sovado.

IA:
Entendi. Essa receita rendeu quantos pães sovados?
```

A IA não pode inventar valores.

Se faltar informação, deve perguntar.

### 15.3 Dados que devem entrar no custo

A interface deve permitir informar:

- ingredientes principais;
- ingredientes pequenos, como sal e temperos;
- gás;
- energia;
- água;
- embalagem;
- transporte;
- gasolina;
- frete;
- taxa de entrega;
- rendimento da receita.

### 15.4 Confirmação

Antes de salvar qualquer custo, o app deve mostrar o que entendeu.

Exemplo:

```txt
Entendi que para fazer Pão Sovado você usa:

- 800 g de farinha
- 300 ml de leite
- 2 ovos
- 20 g de fermento
- 10 g de sal

A receita rende 10 unidades.

Está correto?
```

O usuário pode responder:

```txt
Sim
Corrigir
Cancelar
```

### 15.5 Correção por voz

O usuário precisa conseguir corrigir informações naturalmente.

Exemplo:

```txt
Usei 1 kg de farinha.
Na verdade, foram 800 gramas.
```

O app precisa refletir essa correção e confirmar antes de salvar.

---

## 16. Refatoração completa da arquitetura do front-end

O front-end precisa passar por uma revisão completa de arquitetura.

O projeto foi evoluindo por pedidos para IA, sem uma especificação inicial forte. Por isso, pode haver arquivos grandes, responsabilidades misturadas e código difícil de manter.

A revisão deve observar:

- organização de pastas;
- separação de telas;
- separação de componentes;
- hooks;
- services;
- chamadas de API;
- estado global ou local;
- tipagens;
- regras de negócio;
- arquivos muito grandes;
- componentes com responsabilidade demais;
- reaproveitamento visual;
- padrões de layout;
- padrões de nomes;
- tratamento de erro;
- loading states;
- empty states;
- estados de produto esgotado;
- estados de dia aberto ou fechado;
- estados de edição retroativa;
- autenticação;
- proteção de rotas;
- integração futura com IA.

O objetivo é transformar o front-end em um projeto limpo, previsível e fácil de evoluir.

---

## 17. Sugestão de arquitetura desejada

A arquitetura final pode seguir uma organização semelhante a:

```txt
src/
  app/
  screens/
    Venda/
    Catalogo/
    Resumo/
    Perfil/
    Auth/
  components/
    ui/
    venda/
    resumo/
    catalogo/
    perfil/
  services/
    api/
    auth/
    vendas/
    produtos/
    ia/
  hooks/
  contexts/
  types/
  utils/
  constants/
```

Essa estrutura pode ser adaptada ao framework atual do projeto.

A ideia principal é separar:

- tela;
- componente visual;
- regra de apresentação;
- chamada de API;
- tipagem;
- utilitários.

---

## 18. Tecnologias

Tecnologias reais do projeto:

```txt
Framework: Expo SDK 57 (React Native 0.86, React 19)
Linguagem: TypeScript (strict)
Gerenciador de pacotes: npm
Biblioteca de navegação: expo-router (tabs + stack, rotas em app/)
Biblioteca de gráficos: componente próprio (src/components/resumo/period-chart.tsx)
Gerenciamento de estado: TanStack React Query (dados do servidor) + estado local do React; sessão em Context (src/contexts/auth.tsx)
Cliente HTTP: fetch com wrapper próprio (src/lib/api.ts: X-API-Key, Bearer token, erros tipados)
Autenticação: /api/v1/auth/* (registrar/login/logout/trocar-senha) + /perfil/me; token Bearer em expo-secure-store; login opcional (AUTH_REQUIRED em src/constants/auth.ts) pois só perfil, análise IA e custos exigem sessão de dono
Ambiente de build: EAS (eas.json, canais preview/production via expo-updates)
```

Organização atual das pastas (adaptação da estrutura sugerida na seção 17):

```txt
app/            rotas do expo-router (tabs: index=Venda, catalogo, resumo, perfil; login)
src/
  screens/      uma tela por arquivo (SalesScreen, CatalogScreen, SummaryScreen, ProfileScreen, LoginScreen)
  components/   ui.tsx (base), agent.tsx, calendar.tsx e componentes por área (resumo/)
  contexts/     auth.tsx (sessão e proteção de rotas)
  lib/          api.ts, settings.ts, session.ts, profile.ts, format.ts, theme.ts
  utils/        dates.ts, events.ts (histórico humano), text.ts (nomes), greeting.ts, media.ts
  constants/    auth.ts (AUTH_REQUIRED)
  types/        api.ts (tipos da API)
```

O que ainda depende do backend está listado em [docs/BACKEND-TODO.md](docs/BACKEND-TODO.md).

---

## 19. Panorama futuro do front-end

O front-end deve evoluir para ser mais do que uma tela de venda.

Ele deve ser uma interface simples para apoiar decisões da padaria.

No futuro, o app deve ajudar a responder:

- quanto vendemos hoje?
- o que mais vendeu no mês?
- o que mais sobrou?
- o que devemos produzir menos?
- o que devemos produzir mais?
- qual produto vale mais a pena?
- quanto custa produzir cada produto?
- qual produto dá mais lucro?
- existe padrão por dia da semana?

---

## 20. Tarefa atual  --- INICIAR AQUI

A tarefa atual é documentar o projeto.

Antes de implementar novas funcionalidades, o front-end precisa ter este README como referência.

Não implementar agora sem antes alinhar o plano geral, a arquitetura e as regras de negócio.


Sera pedido o login da sua conta Apple Developer (assinatura de USD 99/ano obrigatoria para builds de iOS).

> Para testar no **Expo Go** nao precisa de build nenhum: `npm run start` e escanear o QR code ja basta.
