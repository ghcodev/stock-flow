# Tech Stack — StockFlow v3.0

Versões exatas conforme `package.json` e os `Dockerfile`. Dependências fixadas sem intervalo (`npm install --save-exact`).

## Frontend (`frontend/`)

| Tecnologia | Versão | Função |
| --- | --- | --- |
| React e React DOM | 19.3.1 | Interface SPA |
| React Router | 7.18.5 | Rotas, proteção por perfil e carga de telas sob demanda |
| TypeScript | 5.9.3 | Tipagem estrita |
| Vite e `@vitejs/plugin-react` | 8.3.8 e 6.3.0 | Servidor de desenvolvimento (proxy `/api`) e build |

Não há biblioteca de UI, de gráficos, de formulários, de estado, de datas nem de requisições: o cliente da API usa `fetch` nativo, os gráficos são SVG puro, a cena 3D do login é CSS puro, o estilo é CSS próprio com tokens (`src/estilos/tokens.css`) e os decimais usam `BigInt`. Os testes usam o `node:test` do Node, sobre a lógica pura em `.ts`.

## Backend (`backend/`)

| Tecnologia | Versão | Função |
| --- | --- | --- |
| Node.js | 22 (imagem `22.20.0`) | Execução; o código TypeScript roda com remoção de tipos nativa em desenvolvimento e é compilado com `tsc` para a imagem |
| Express | 5.3.0 | API HTTP |
| Prisma e `@prisma/adapter-pg` | 7.10.1 | Acesso ao PostgreSQL (consultas e SQL parametrizado) |
| express-validator | 7.3.2 | Validação de entrada |
| express-rate-limit | 8.7.4 | Limite de tentativas de login e de troca de senha |
| bcrypt | 6.0.0 | Hash de senha, custo 12 |
| jose | 6.2.17 | JWT HS256 |
| TypeScript | 5.9.3 | Tipagem e build |

## Banco de dados

PostgreSQL 16 (`postgres:16.10` na demonstração). Esquema, triggers, papéis e índices em `database/postgres/init`.

## Infraestrutura da demonstração (`deploy/`)

| Item | Versão |
| --- | --- |
| Docker Compose | arquivo `deploy/docker-compose.yml`, projeto `stockflow-demo` |
| Nginx | `nginx:1.28.0-alpine` |
| Imagem base do build | `node:22.20.0-bookworm-slim` |
| PostgreSQL | `postgres:16.10` |

Scripts em bash (`subir.sh`, `derrubar.sh`, `fumaca.sh`, `verificar.sh`); o teste de fumaça usa `fetch` nativo do Node.

## Testes

- Backend: `node --test`, 307 testes, contra o banco de desenvolvimento.
- Frontend: `node --test`, 240 testes de lógica pura. Componentes e CSS não têm teste automatizado; são conferidos no navegador.

## Divergência registrada

O documento anterior listava o protótipo: React 18, Axios, Tailwind CSS, Express 4, MySQL, Swagger, Helmet e CORS. Nada disso faz parte da v3.
