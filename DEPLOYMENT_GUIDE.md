# Deployment Guide — StockFlow

## Pré-requisitos

- Node.js 18+.
- npm.
- MySQL 8.4.
- Acesso ao repositório.
- Variáveis de ambiente configuradas.

## Instalação

```bash
git clone https://github.com/ghcodev/stock-flow.git
cd stock-flow
npm install
cd stockflow-api && npm install
cd ../stockflow-frontend && npm install
```

## Banco

Executar:

```bash
mysql -u root -p < database/setup.sql
```

Observação importante:

`database/setup.sql` não cria a tabela `inventario`. Se o módulo de inventário for usado, o deploy precisa incluir uma migração que crie essa tabela antes de aplicar `database/feature_inventory_sap_permissions.sql`.

## Variáveis `.env`

### API

Arquivo: `stockflow-api/.env`.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=sua_senha
DB_NAME=stockflow
JWT_SECRET=troque-por-uma-string-aleatoria-de-64-chars-minimo
JWT_EXPIRES_IN=8h
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=production
```

Campos obrigatórios na inicialização da API:

- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- configuração de banco por `DB_HOST`/`DB_USER`/`DB_NAME` ou variáveis equivalentes verificadas em `app.js`

### Frontend

Arquivo: `stockflow-frontend/.env`.

```env
VITE_API_URL=http://localhost:3000/api/v1
```

Em produção, use a URL pública da API.

## Execução Local

API:

```bash
cd stockflow-api
npm run dev
```

Frontend:

```bash
cd stockflow-frontend
npm run dev
```

Ambos:

```bash
npm run dev
```

## Build

Frontend:

```bash
cd stockflow-frontend
npm run build
```

Saída: `stockflow-frontend/dist`.

API:

```bash
cd stockflow-api
npm start
```

## Produção

Checklist:

- Definir `NODE_ENV=production`.
- Definir `JWT_SECRET` forte.
- Definir `ALLOWED_ORIGINS` com os domínios permitidos do frontend.
- Definir `VITE_API_URL` antes do build do frontend.
- Garantir MySQL disponível e com schema aplicado.
- Servir `dist/` por servidor estático ou CDN.
- Executar API por process manager ou serviço.
- Proteger `.env`.
- Validar `/api/v1/health`.
- Validar `/api/docs` se a documentação Swagger deve ficar exposta.

## Troubleshooting

### API encerra ao iniciar

Verifique:

- `JWT_SECRET`.
- `ALLOWED_ORIGINS`.
- `DB_HOST`, `DB_USER`, `DB_NAME`.
- MySQL acessível.

### Frontend recebe erro de CORS

Verifique:

- `ALLOWED_ORIGINS` na API.
- URL real do frontend.
- Protocolo `http`/`https`.

### Frontend chama API errada

Verifique:

- `VITE_API_URL`.
- Rebuild do frontend após mudar `.env`.

### Tela de inventário falha

Verifique:

- Existência da tabela `inventario`.
- Aplicação de migração compatível.
- Rotas `/inventario` e `/inventarios`.

### Login falha mesmo com senha correta

Verifique:

- Usuário ativo.
- Hash de senha no banco.
- `JWT_SECRET`.
- Rate limit temporário por muitas tentativas.

### `npm audit` acusa `xlsx`

O frontend possui vulnerabilidade alta em `xlsx` sem correção disponível pelo `npm audit`. Avalie substituição, restrição de arquivos confiáveis e validação de entrada.
