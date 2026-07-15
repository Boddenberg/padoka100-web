FROM node:22.23.1-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:web

FROM node:22.23.1-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/start.mjs ./scripts/start.mjs
COPY --from=build /app/scripts/serve-web.mjs ./scripts/serve-web.mjs

EXPOSE 4173

CMD ["node", "scripts/serve-web.mjs"]
