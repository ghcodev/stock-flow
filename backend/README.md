# StockFlow v3.0 — Backend

Node 22.18+ (type stripping nativo no desenvolvimento), Express 5, Prisma 7, PostgreSQL 16.

## Instalar

```
cd backend
npm ci
cp .env.example .env
```

Preencha `.env`: `DATABASE_URL` (role `stockflow_app`, porta 5433 do Docker), `JWT_SECRET` (mínimo 32 caracteres, aleatório) e, se quiser, `PORT`. O token JWT dura sempre 8 h (fixo no código). A aplicação recusa subir sem `DATABASE_URL` ou `JWT_SECRET`.

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
npm run typecheck
npm run build
npm run start:local
```

- `npm run dev`: desenvolvimento, lê o `.env` (`--env-file`) e recarrega ao salvar.
- `npm run start:local`: roda o build (`dist/`) lendo o `.env`.
- `npm start`: produção. Não lê `.env`; as variáveis (`DATABASE_URL`, `JWT_SECRET`, `PORT`) vêm do ambiente, em produção do Docker Compose.

## Testar

```
npm test
```

Usa `node:test` contra o PostgreSQL do Docker, com o app em porta efêmera. Os testes não dependem do seed.

Atenção: a suíte escreve no banco. Cada execução completa persiste usuários de teste (e-mail único, `@teste.local`, deixados inativos), produtos (deixados inativos), localizações, lotes, etiquetas, movimentações de entrada dos saldos iniciais e as linhas de `auditoria_log` geradas pelos triggers. Nada é apagado, porque a role da aplicação não tem DELETE, então esses dados se acumulam a cada execução. Rode a suíte só contra banco de desenvolvimento ou de teste, nunca contra produção.

## Histórico de movimentações

`GET /movimentacoes` aceita os filtros `de`, `ate`, `tipo`, `id_lote` e `id_usuario`.

Formatos aceitos em `de` e `ate`, e somente estes:

- `AAAA-MM-DD`: dia inteiro em UTC. Em `de` vale desde 00:00:00 UTC; em `ate` inclui o dia todo (limite exclusivo às 00:00:00 UTC do dia seguinte).
- `AAAA-MM-DDThh:mm[:ss[.fff]]` com `Z` ou deslocamento `+hh:mm` / `-hh:mm`. Em `de` o instante é incluído; em `ate` também (limite exclusivo 1 ms depois).

Outros formatos (semana ISO, dia do ano, `20261115`, horário sem fuso, `+hhmm`) respondem 400. A interpretação não depende do fuso do processo. `de` não pode ser posterior a `ate`.
