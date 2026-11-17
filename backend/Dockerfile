FROM node:22.20.0-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS construcao
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS producao
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22.20.0-bookworm-slim AS final
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=producao /app/node_modules ./node_modules
COPY --from=construcao /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
