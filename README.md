# StockFlow

StockFlow é um sistema web WMS (Warehouse Management System) para gestão de estoque com controle por lote, localizações físicas, movimentações transacionais, rastreabilidade por QR Code/RFID e auditoria operacional.

O projeto é composto por uma SPA React, uma API Node.js/Express e banco MySQL. A implementação atual usa SQL direto via `mysql2/promise`, autenticação JWT, permissões por perfil/permissão customizada e design system próprio no frontend.

## Objetivo

Centralizar a operação de estoque de uma empresa com produtos rastreáveis, reduzindo dependência de planilhas e oferecendo:

- Visibilidade de estoque por produto, lote e localização.
- Registro de entradas, saídas, transferências, ajustes e inventário.
- Alertas de validade, bloqueios e estoque abaixo do mínimo.
- Rastreabilidade por lote e identificação por QR Code/RFID.
- Auditoria em aplicação e banco de dados.
- Interface operacional para rotinas de armazém.

## Principais Funcionalidades

- Dashboard com KPIs, movimentações, alertas, ocupação por corredor, curva ABC, rupturas e saúde do estoque.
- Cadastro e manutenção de produtos.
- Cadastro, bloqueio, desbloqueio e acompanhamento de lotes.
- Entrada, saída, transferência e ajuste de estoque.
- Inventário rotativo por corredor.
- Mapa do armazém baseado em localizações cadastradas.
- Rastreabilidade por lote e timeline de movimentações.
- Identificação por QR Code ou RFID.
- Relatórios operacionais com exportação no frontend.
- Gestão de usuários, perfis e permissões customizadas.
- Integração SAP para importação de produtos por JSON.
- Auditoria administrativa.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS, CSS tokens |
| Backend | Node.js, Express 4, JWT, Helmet, CORS, express-validator, express-rate-limit |
| Banco | MySQL 8.4, InnoDB, triggers, constraints, SQL direto |
| Documentação API | Swagger UI em `/api/docs` |
| Relatórios/exportação | `xlsx`, `jspdf`, `html2canvas` no frontend |

## Estrutura do Projeto

```text
STOCK FLOW/
├── database/
│   ├── setup.sql
│   ├── triggers.sql
│   ├── fix_auditoria.sql
│   ├── fix_missing_data.sql
│   ├── seed_artetrigo.sql
│   └── feature_inventory_sap_permissions.sql
├── docs/
│   └── MANUAL_USUARIO.md
├── stockflow-api/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── middlewares/
│       └── routes/
├── stockflow-frontend/
│   ├── .env.example
│   ├── package.json
│   ├── design-reference/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       └── styles/
├── ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── AUDIT.md
├── CLAUDE.md
├── DEPLOYMENT_GUIDE.md
├── PROJECT_MEMORY.md
├── SECURITY.md
├── TECH_STACK.md
└── USER_MANUAL.md
```

## Pré-requisitos

- Node.js 18 ou superior.
- MySQL 8.4.
- npm.
- Banco `stockflow` criado pelo script `database/setup.sql`.

## Instalação

```bash
git clone https://github.com/ghcodev/stock-flow.git
cd stock-flow

npm install
cd stockflow-api && npm install
cd ../stockflow-frontend && npm install
```

## Banco de Dados

Execute o script principal:

```bash
mysql -u root -p < database/setup.sql
```

O script principal cria as tabelas base: `localizacao`, `produto`, `usuario`, `lote`, `movimentacao`, `identificacao` e `auditoria_log`, além de triggers de auditoria e dados de seed.

Observação real do projeto: existem rotas e telas de inventário que dependem da tabela `inventario`, mas `database/setup.sql` não cria essa tabela. O arquivo `database/feature_inventory_sap_permissions.sql` altera `inventario`, `usuario` e `produto`, assumindo que a tabela `inventario` já exista.

## Variáveis de Ambiente

API (`stockflow-api/.env`):

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
NODE_ENV=development
```

Frontend (`stockflow-frontend/.env`):

```env
VITE_API_URL=http://localhost:3000/api/v1
```

## Execução Local

Backend:

```bash
cd stockflow-api
npm run dev
```

Frontend:

```bash
cd stockflow-frontend
npm run dev
```

Execução conjunta pela raiz:

```bash
npm run dev
```

URLs padrão:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- Health check: `http://localhost:3000/api/v1/health`

## Build

Frontend:

```bash
cd stockflow-frontend
npm run build
```

Preview:

```bash
npm run preview
```

API em modo produção:

```bash
cd stockflow-api
npm start
```

## Telas Principais

- Login.
- Dashboard.
- Produtos.
- Lotes.
- Mapa do Armazém.
- Entrada.
- Saída.
- Transferência.
- Histórico.
- Rastreabilidade.
- Alertas de vencimento.
- Relatórios.
- Inventário.
- Ajuste de estoque.
- Auditoria.
- Usuários.
- Perfil.
- Integração SAP.

## Roadmap Resumido

- Corrigir a divergência entre rotas de inventário e schema principal.
- Adicionar testes automatizados de API e frontend.
- Revisar dependência `xlsx`, que possui vulnerabilidade alta sem correção disponível no `npm audit`.
- Persistir blacklist de JWT em armazenamento compartilhado se houver múltiplas instâncias da API.
- Evoluir deploy com variáveis por ambiente e pipeline de CI.

## Documentação

- `ARCHITECTURE.md` — Arquitetura técnica do sistema
- `API_DOCUMENTATION.md` — Endpoints e contratos da API
- `TECH_STACK.md` — Stack tecnológica utilizada
- `DEPLOYMENT_GUIDE.md` — Guia de instalação e deploy
- `USER_MANUAL.md` — Manual do usuário
- `SECURITY.md` — Política de segurança
- `AUDIT.md` — Registro de bugs e auditoria
- `CLAUDE.md` — Instruções para o agente de desenvolvimento
