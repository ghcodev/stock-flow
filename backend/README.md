# StockFlow v3.0 — Backend

Node 22.18+ (type stripping nativo no desenvolvimento), Express 5, Prisma 7, PostgreSQL 16.

## Instalar

```
cd backend
npm ci
cp .env.example .env
```

Preencha `.env`: `DATABASE_URL` (role `stockflow_app`, porta 5433 do Docker), `JWT_SECRET` (mínimo 32 caracteres, aleatório) e, se quiser, `PORT` e `JWT_EXPIRES_IN`. A aplicação recusa subir sem `DATABASE_URL` ou `JWT_SECRET`.

O banco sobe com `docker compose up -d` na raiz. O esquema é o de `database/postgres/init`; o Prisma não cria migrations.

## Gerar o cliente Prisma

```
npm run generate
```

O cliente vai para `src/generated/prisma`, ignorado pelo git. `npm run build` já o gera.

## Esquema e banco

O esquema do banco é definido só em `database/postgres/init`. CHECKs, triggers, permissões da role e o `ON DELETE RESTRICT` ficam apenas no SQL; o Prisma não os gerencia. Não use `prisma db push` nem migrations do Prisma.

`prisma/schema.prisma` vem de `npm run db:pull`. O pull recoloca três comentários `///` (modelos `lote`, `movimentacao` e `produto`, sobre CHECKs). Depois de cada pull, remova-os: `sed -i '/^\/\/\/ /d' prisma/schema.prisma`.

## Rodar

```
npm run dev
npm run build && npm start
npm run typecheck
```

## Testar

```
npm test
```

Usa `node:test` contra o PostgreSQL do Docker, com o app em porta efêmera. Os testes não dependem do seed nem alteram dados.
