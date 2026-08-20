# Build context = raiz do projeto (nao backend/) - @copperline/idp-client e
# uma dependencia "file:../idp-client" (nao publicada em registry ainda),
# entao a imagem precisa dos dois diretorios lado a lado, no mesmo layout
# relativo do repositorio (ver package.json do backend). O npm instala essa
# dependencia como SYMLINK relativo (ex: node_modules/@copperline/idp-client
# -> ../../../idp-client) - por isso o runtime tambem usa /workspace/backend
# como WORKDIR (mesma profundidade do build), com idp-client copiado no
# mesmo lugar relativo, senao o symlink fica pendurado (dangling).

FROM node:24-slim AS deps
WORKDIR /workspace
COPY idp-client ./idp-client
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /workspace/backend
RUN npm ci

FROM deps AS build
COPY backend ./
RUN npx prisma generate
RUN npm run build

FROM node:24-slim AS prod-deps
WORKDIR /workspace
COPY idp-client ./idp-client
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /workspace/backend
RUN npm ci --omit=dev

FROM node:24-slim AS runtime
WORKDIR /workspace/backend
ENV NODE_ENV=production
# node:24-slim (Debian) nao vem com openssl - prisma migrate deploy (rodado
# no entrypoint) avisa "failed to detect libssl" sem isso.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps /workspace/idp-client ../idp-client
COPY --from=prod-deps /workspace/backend/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
COPY --from=build /workspace/backend/generated ./generated
COPY backend/package.json ./package.json
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]
