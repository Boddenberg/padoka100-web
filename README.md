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

Sera pedido o login da sua conta Apple Developer (assinatura de USD 99/ano obrigatoria para builds de iOS).

> Para testar no **Expo Go** nao precisa de build nenhum: `npm run start` e escanear o QR code ja basta.
