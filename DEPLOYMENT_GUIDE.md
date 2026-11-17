# Deployment Guide — StockFlow v3.0

O guia de implantação e de demonstração da v3.0 está em [`deploy/README.md`](deploy/README.md). Este arquivo só resume e aponta.

## Demonstração (Docker Compose)

Pré-requisitos: Docker, `openssl` e um shell bash (no Windows, Git Bash).

```
./deploy/subir.sh      # gera deploy/.env e o certificado local, constrói e sobe tudo
./deploy/derrubar.sh   # derruba os serviços e mantém os dados
./deploy/fumaca.sh     # teste de fumaça contra a demonstração de pé
./deploy/verificar.sh  # invariante de saldo e contagens no banco da demonstração
```

- Abra `https://localhost:8443` (certificado autoassinado: aceite a exceção). A porta 8080 só redireciona para o HTTPS.
- Projeto Compose `stockflow-demo`, volume próprio (`VOLUME_DO_BANCO` em `deploy/.env`, padrão `stockflow_demo_pgdata`); não toca no banco de desenvolvimento.
- A API e o banco não publicam porta; o Nginx é a única entrada.
- Segredos (`POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `JWT_SECRET`) são gerados aleatoriamente em `deploy/.env` (fora do git). Há um `deploy/.env.example`.
- Credenciais de demonstração e o que há nos dados: [`deploy/README.md`](deploy/README.md). Roteiro de apresentação: [`docs/ROTEIRO_APRESENTACAO.md`](docs/ROTEIRO_APRESENTACAO.md).

## Desenvolvimento

Veja a seção "Rodar em desenvolvimento" do [`README.md`](README.md): banco de desenvolvimento pelo `docker-compose.yml` da raiz (porta 5433 em `127.0.0.1`), `npm run dev` no `backend/` e no `frontend/`.

## Imagens

- `backend/Dockerfile`: multiestágio em `node:22.20.0-bookworm-slim`, `npm ci --ignore-scripts`, usuário não root e `HEALTHCHECK` em `/health`.
- `frontend/Dockerfile`: build do Vite em `node:22.20.0-bookworm-slim` e `nginx:1.28.0-alpine` servindo os estáticos.
- Banco: `postgres:16.10`. Todas as imagens têm versão fixa.

## O que este guia não afirma

Não há implantação em produção real descrita nem testada aqui. O certificado da demonstração é autoassinado e os dados são de exemplo. Para um ambiente real seria preciso, no mínimo, um certificado emitido por uma autoridade confiável, segredos próprios, política de backup do banco e a revisão do agendador em uma única réplica.

## Divergência registrada

O guia anterior descrevia o protótipo (Node 18, MySQL 8.4, `/api/v1`, variáveis `ALLOWED_ORIGINS` e `JWT_EXPIRES_IN`). Nada disso existe na v3.
