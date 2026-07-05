# Padoka 100 Web

Frontend PWA mobile-first para a Padoka 100. A aplicacao abre direto no **Modo Venda** e integra com o backend FastAPI publicado no Railway.

## Stack

- Vite + React + TypeScript
- React Router
- TanStack Query
- React Hook Form + Zod
- Tailwind CSS
- lucide-react
- vite-plugin-pwa

## Como rodar

```bash
npm install
npm run dev
```

O Vite exibira a URL local, normalmente `http://localhost:5173`.

## Variaveis de ambiente

Copie `.env.example` para `.env` se quiser sobrescrever os padroes:

```bash
VITE_API_LOCAL_URL=http://localhost:8000
VITE_API_PROD_URL=https://padoka100-production.up.railway.app
VITE_API_PROD_PROXY=true
VITE_DEFAULT_API_ENV=production
```

`VITE_API_KEY` e opcional para desenvolvimento. Ele nao e segredo em app web, porque qualquer `VITE_*` pode ser exposto no bundle do navegador. Em producao, use a tela **Configuracao** para salvar a API key localmente no navegador.

## Backend

- Local: `http://localhost:8000`
- Producao Railway: `https://padoka100-production.up.railway.app`
- Health: `GET /health`
- Endpoints versionados: `/api/v1`

Em producao, os requests para `/api/v1` enviam `X-API-Key` quando existe chave salva na tela **Configuracao** ou em `VITE_API_KEY`.

## Fluxos entregues

- Configurar ambiente Local/Railway e testar `/health`
- Listar produtos ativos no Modo Venda
- Buscar dia de venda atual
- Abrir dia de venda com producao por produto
- Registrar venda manual pelo carrinho
- Listar/cancelar vendas do dia
- Ver resumo do dia e resumo por periodo
- CRUD basico de produtos e locais
- Criar versoes de preco e enviar foto do produto via multipart
- Consultar historico por filtros
- Interpretar venda por texto e preparar gravacao por `MediaRecorder`

## Build

```bash
npm run build
```

## Deploy no Railway

O Railway precisa receber o projeto completo no GitHub, incluindo `package.json`, `package-lock.json`, `src/`, `public/` e os arquivos de configuracao. Se o build log mostrar apenas `README.md`, o deploy esta usando um commit antigo ou um root directory errado.

O comando de producao e:

```bash
npm run start
```

Ele serve a pasta `dist` gerada por `npm run build` e usa automaticamente a porta definida em `PORT`.

O deploy usa a deteccao Node padrao do Railpack: instala com `npm ci`, roda `npm run build` e inicia com `npm run start`.

Quando `VITE_API_PROD_PROXY=true`, o frontend chama o backend de producao por rotas same-origin:

- `GET /health`
- `/api/v1/*`

No desenvolvimento local, o Vite encaminha essas rotas para `VITE_API_PROD_URL`. Em producao, `scripts/serve.mjs` faz o mesmo proxy. Isso evita problemas de CORS e mantem o frontend chamando o backend Railway pelo proprio dominio do frontend.

## Plano mobile com Capacitor

Depois que a web app estiver estavel:

```bash
npm i @capacitor/core @capacitor/cli
npx cap init "Padoka 100" "br.com.padoka100.app" --web-dir=dist
npm i @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Para iOS, e necessario macOS com Xcode.
