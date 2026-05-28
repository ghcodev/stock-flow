# StockFlow

Sistema web de controle de estoque com rastreabilidade por lote, gestão de localizações físicas e auditoria completa de operações.

## Repositório

[![GitHub](https://img.shields.io/badge/GitHub-StockFlow-1F3864?style=for-the-badge&logo=github)](https://github.com/ghcodev/stock-flow)

**Clone o projeto:**
```bash
git clone https://github.com/ghcodev/stock-flow.git
cd stock-flow
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express 4 |
| Banco de dados | MySQL 8.4 |
| Autenticação | JWT (jsonwebtoken) |
| Queries | mysql2/promise (SQL direto, sem ORM) |

## Pré-requisitos

- Node.js 18+
- MySQL 8.4 rodando na porta 3306

## Instalação

### 1. Banco de dados

```bash
mysql -u root -p < database/setup.sql
```

O script cria o banco `stockflow`, todas as tabelas, triggers de auditoria e o usuário administrador padrão.

### 2. API (backend)

```bash
cd stockflow-api
npm install
cp .env.example .env      # edite com suas credenciais reais
npm run dev               # inicia na porta 3000
```

### 3. Frontend

```bash
cd stockflow-frontend
npm install
npm run dev               # inicia na porta 5173
```

Acesse: **http://localhost:5173**

## Credenciais padrão

| Campo | Valor |
|-------|-------|
| Email | `admin@stockflow.com` |
| Senha | `Admin@1234` |

## Scripts

### API (`stockflow-api/`)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev com nodemon (hot reload) |
| `npm start` | Produção |

### Frontend (`stockflow-frontend/`)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server na porta 5173 |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Preview do build |

## Módulos

| Módulo | Rota | Perfil mínimo |
|--------|------|---------------|
| Dashboard | `/dashboard` | Operador |
| Produtos | `/produtos` | Operador |
| Lotes | `/lotes` | Operador |
| Mapa do Armazém | `/mapa` | Operador |
| Entrada de estoque | `/entrada` | Operador |
| Saída de estoque | `/saida` | Operador |
| Transferência | `/transferencia` | Operador |
| Histórico | `/historico` | Operador |
| Rastreabilidade | `/rastreabilidade` | Operador |
| Alertas de vencimento | `/alertas` | Operador |
| Relatórios | `/relatorios` | Operador |
| Inventário rotativo | `/inventario` | Operador |
| Ajuste de estoque | `/ajuste` | Administrador |
| Auditoria | `/auditoria` | Administrador |
| Usuários | `/usuarios` | Administrador |
| Perfil | `/perfil` | Operador |

## Estrutura do projeto

```
STOCK FLOW/
├── database/
│   └── setup.sql                   # Schema + seed + triggers MySQL
├── stockflow-api/                  # Backend Express
│   ├── .env.example
│   ├── src/
│   │   ├── app.js                  # Entry point
│   │   ├── config/database.js      # Pool MySQL
│   │   ├── middleware/             # auth, admin, audit
│   │   ├── routes/                 # Definição de endpoints
│   │   └── controllers/            # Lógica de negócio
│   └── package.json
└── stockflow-frontend/             # Frontend React + Vite
    ├── src/
    │   ├── api/axios.js            # Cliente HTTP + interceptors
    │   ├── context/                # Auth e Toast
    │   ├── components/Layout.jsx   # Shell da aplicação
    │   └── pages/                  # Uma página por módulo
    └── package.json
```

## Variáveis de ambiente (API)

Veja `stockflow-api/.env.example` para a lista completa.
