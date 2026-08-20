FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# API_URL so precisa existir em runtime (server-side) - nao ha nenhuma
# variavel NEXT_PUBLIC_* usada, entao o build nao depende de secret nenhum.
RUN npm run build

# output: "standalone" (next.config.ts) - copia so o server.js + node_modules
# minimo necessario pra rodar, nao a arvore de dev completa.
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
