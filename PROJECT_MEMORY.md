# PROJECT_MEMORY.md — StockFlow

> Documento de memória permanente do projeto. Atualizado em: 2026-05-29.
> Objetivo: qualquer IA (ou desenvolvedor) consegue entender o projeto inteiro sem ler o código.

---

## 1. Resumo Executivo

**StockFlow** é um sistema web de gerenciamento de estoque industrial voltado para empresas que trabalham com produtos rastreáveis por lotes (alimentos, farmacêuticos, insumos com validade). O sistema oferece controle completo do ciclo de vida dos produtos: entrada, saída, transferência entre localizações, ajuste de estoque, inventário cíclico, rastreabilidade e auditoria imutável.

- **Versão atual:** 1.3.0
- **Idioma:** Português (Brasil)
- **Perfis de usuário:** Administrador e Operador
- **Status:** Produção local (MVP completo, sem testes automatizados)
- **Instância de referência:** `http://localhost:3000` (API) + `http://localhost:5173` (Frontend)

---

## 2. Visão Geral

### Problema que resolve
Empresas com estoque físico precisam rastrear produtos por lote, controlar vencimentos, registrar cada movimentação com responsável identificado e manter trilha de auditoria imutável para conformidade regulatória. Planilhas Excel não oferecem controle em tempo real nem auditoria automática.

### Solução
Sistema full-stack com:
- Dashboard com KPIs em tempo real
- Controle de lotes com validade, localização e status
- Movimentações transacionais (entrada/saída/transferência/ajuste/inventário)
- Alertas automáticos de vencimento e estoque mínimo
- Mapa visual do armazém
- Rastreabilidade completa por lote (QR Code / RFID)
- Auditoria imutável a nível de banco de dados (triggers) + aplicação

---

## 3. Arquitetura

### Visão macro

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 18 + Vite)           localhost:5173            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ AuthContext  │  │ ToastContext │  │    React Router v6   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 17 Pages + Layout.jsx (sidebar + topbar + breadcrumb)   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  axios.js — interceptors JWT + 401 redirect              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/JSON  (hardcoded: localhost:3000)
┌──────────────────────────▼──────────────────────────────────────┐
│  BACKEND (Express.js)                 localhost:3000            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  app.js → cors → json → routes → controllers           │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Middleware stack: authMiddleware → adminMiddleware → handler   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐   │
│  │  auth.js      │  │  admin.js     │  │  audit.js        │   │
│  │  JWT + BL     │  │  perfil check │  │  logAudit()      │   │
│  └───────────────┘  └───────────────┘  └──────────────────┘   │
│  10 route files → 9 controller files → mysql2 (pool: 10)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ mysql2 (SQL puro, sem ORM no runtime)
┌──────────────────────────▼──────────────────────────────────────┐
│  BANCO DE DADOS (MySQL 8.4)           localhost:3306            │
│  Database: stockflow  Charset: UTF8MB4                         │
│  7 tabelas + 3 triggers de auditoria automática                │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de uma requisição autenticada

```
Request
  → cors (whitelist localhost:5173)
  → express.json()
  → authMiddleware (verifica JWT, checa blacklist em memória, popula req.user)
  → [adminMiddleware se rota restrita]
  → Controller (SQL puro com mysql2)
  → logAudit() (insere em auditoria_log)
  → Response JSON
```

### Padrão transacional

Todas as operações de movimentação seguem:
```
getConnection() → beginTransaction() → INSERT movimentacao → UPDATE lote.quantidade → COMMIT / ROLLBACK
```

---

## 4. Tecnologias

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | ≥18 | Runtime |
| Express.js | ^4.19.2 | Framework HTTP |
| mysql2 | ^3.10.0 | Driver MySQL (SQL puro, pool de 10 conexões) |
| jsonwebtoken | ^9.0.2 | Autenticação JWT (8h de expiração) |
| bcrypt | ^5.1.1 | Hash de senhas |
| express-validator | ^7.2.0 | Validação de inputs |
| express-async-errors | ^3.1.1 | Captura erros assíncronos automaticamente |
| swagger-jsdoc + swagger-ui-express | — | Documentação da API em `/api/docs` |
| dotenv | ^16.4.5 | Variáveis de ambiente |
| nodemon | ^3.1.4 | Hot reload em dev |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | ^18.3.1 | UI Framework |
| Vite | ^5.3.1 | Build tool |
| React Router DOM | ^6.24.0 | Roteamento SPA |
| Axios | ^1.7.2 | HTTP client |
| Lucide React | ^0.395.0 | Ícones SVG |
| Tailwind CSS | ^3.4.4 | Utilitários CSS (uso mínimo) |
| IBM Plex Sans/Mono | — | Tipografia (Google Fonts) |

> **IMPORTANTE:** Gráficos usam SVG puro (`<svg>` no JSX), **não** bibliotecas como Recharts ou Chart.js. Esta é uma regra crítica do projeto.

### Banco de Dados
| Item | Valor |
|---|---|
| SGBD | MySQL 8.4 |
| Database | `stockflow` |
| Charset | UTF8MB4 (suporta emojis e caracteres especiais) |
| Setup | `database/setup.sql` (script único, não usa migrations) |
| ORM | Prisma 7.8 (instalado na raiz, mas **não usado em runtime** — somente para tipagem via `generated/prisma/`) |

---

## 5. Estrutura de Pastas

```
STOCK FLOW/
├── database/
│   └── setup.sql              # Schema completo + dados de seed + triggers
├── docs/
│   └── MANUAL_USUARIO.md      # Manual do usuário (PT-BR)
├── generated/
│   └── prisma/                # Tipos TypeScript gerados (não usado em runtime)
├── prisma/
│   └── schema.prisma          # Schema Prisma (referência de tipos, não usado em runtime)
├── stockflow-api/             # BACKEND
│   └── src/
│       ├── app.js             # Entry point: CORS, JSON, rotas, error handler
│       ├── config/
│       │   ├── database.js    # Pool MySQL (limit: 10)
│       │   └── swagger.js     # Config do Swagger
│       ├── middleware/
│       │   ├── auth.js        # JWT verify + blacklist em memória
│       │   ├── admin.js       # Checa perfil === 'administrador'
│       │   └── audit.js       # logAudit() — grava em auditoria_log
│       ├── routes/            # 10 arquivos *.routes.js
│       └── controllers/       # 9 arquivos *.controller.js
├── stockflow-frontend/        # FRONTEND
│   └── src/
│       ├── api/
│       │   └── axios.js       # Instância axios + interceptors
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── ToastContext.jsx
│       ├── components/
│       │   └── Layout.jsx     # Shell: sidebar + topbar + breadcrumb
│       ├── pages/             # 17 páginas JSX
│       ├── styles/
│       │   ├── tokens.css     # ~120 variáveis CSS (cores, sombras, espaçamento)
│       │   └── app.css        # ~400 linhas de CSS componentizado
│       ├── App.jsx            # Router + guards PrivateRoute/AdminRoute
│       └── main.jsx           # Entry point React
├── uploads/                   # Diretório para uploads (vazio)
├── CLAUDE.md                  # Regras obrigatórias para IA
├── ARCHITECTURE.md            # Decisões técnicas detalhadas
├── AUDIT.md                   # Contexto do sistema de auditoria
├── README.md                  # Setup e módulos
└── PROJECT_MEMORY.md          # Este arquivo
```

---

## 6. Banco de Dados

### Tabelas e Relacionamentos

```
produto ──< lote >── localizacao
              │
              └──< movimentacao >── localizacao (origem)
              │                └─── localizacao (destino)
              │
              └──── identificacao (1:1)

usuario ──< movimentacao
        ──< auditoria_log
```

### Detalhamento das Tabelas

#### `usuario`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| nome | VARCHAR(100) | NOT NULL |
| email | VARCHAR(150) | UNIQUE, NOT NULL |
| senha_hash | VARCHAR(255) | bcrypt |
| perfil | ENUM('administrador', 'operador') | DEFAULT 'operador' |
| ativo | TINYINT(1) | DEFAULT 1 |
| criado_em | DATETIME | DEFAULT NOW() |

**Seed:** `admin@stockflow.com` / `Admin@1234` (perfil: administrador)

#### `produto`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| nome | VARCHAR(150) | NOT NULL |
| categoria | VARCHAR(100) | |
| descricao | TEXT | |
| unidade_medida | VARCHAR(20) | kg, L, un, etc. |
| estoque_minimo | DECIMAL(10,2) | DEFAULT 0 |
| ativo | TINYINT(1) | DEFAULT 1 |
| criado_em, atualizado_em | DATETIME | |

#### `localizacao`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| corredor | VARCHAR(10) | Código do corredor (A, B, C…) |
| nivel | VARCHAR(10) | Nível da prateleira (1, 2, 3…) |
| posicao | VARCHAR(10) | Posição na prateleira |
| descricao | VARCHAR(200) | |
| criado_em | DATETIME | |

#### `lote`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| numero_lote | VARCHAR(100) | UNIQUE, NOT NULL |
| data_fabricacao | DATE | |
| data_validade | DATE | |
| quantidade | DECIMAL(10,2) | CHECK (quantidade >= 0) |
| id_produto | INT FK → produto.id | |
| id_localizacao | INT FK → localizacao.id | |
| status_lote | ENUM | ativo, vencido, bloqueado, quarentena, finalizado |
| data_bloqueio | DATETIME | NULL se não bloqueado |
| motivo_bloqueio | TEXT | NULL se não bloqueado |

#### `movimentacao`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| tipo | ENUM | entrada, saida, transferencia, ajuste, inventario |
| data_movimentacao | DATETIME | DEFAULT NOW() |
| quantidade | DECIMAL(10,2) | CHECK (quantidade > 0) |
| id_lote | INT FK → lote.id | |
| id_usuario | INT FK → usuario.id | |
| id_localizacao_origem | INT FK → localizacao.id | NULL para entradas |
| id_localizacao_destino | INT FK → localizacao.id | NULL para saídas |
| motivo_movimentacao | VARCHAR(200) | |
| observacao | TEXT | |
| status | ENUM | pendente, concluida, cancelada |

#### `identificacao`
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| tipo | ENUM | 'QR Code', 'RFID' |
| codigo | VARCHAR(255) | UNIQUE |
| id_lote | INT FK → lote.id | UNIQUE (1:1 com lote) |
| criado_em | DATETIME | |

#### `auditoria_log` — IMUTÁVEL
| Coluna | Tipo | Notas |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| tabela_afetada | VARCHAR(100) | |
| operacao | ENUM | INSERT, UPDATE, DELETE, LOGIN, AJUSTE, BLOQUEIO |
| valor_anterior | JSON | Estado antes da operação |
| valor_novo | JSON | Estado após a operação |
| id_usuario | INT FK → usuario.id | NULL para operações automáticas |
| data_hora | DATETIME | DEFAULT NOW() |
| ip_usuario | VARCHAR(45) | IPv4/IPv6 |

**REGRA CRÍTICA:** Esta tabela é somente leitura na aplicação. Nunca fazer UPDATE ou DELETE nela.

### Triggers MySQL

| Trigger | Evento | Registra |
|---|---|---|
| `trg_audit_movimentacao_insert` | AFTER INSERT em movimentacao | Tipo, lote, quantidade, usuário |
| `trg_audit_lote_update` | AFTER UPDATE em lote | Mudança de quantidade ou status |
| `trg_audit_usuario_insert` | AFTER INSERT em usuario | Criação de novo usuário |

---

## 7. Módulos / Páginas

### Layout Geral — `Layout.jsx`
Shell com sidebar colapsável (224px ↔ 60px), topbar com busca, toggle de tema (claro/escuro) e menu do usuário. Breadcrumb automático por rota.

**Sidebar — 4 seções:**
- **Operação:** Dashboard, Produtos, Lotes, Mapa do Armazém
- **Movimentações:** Entrada, Saída, Transferência, Histórico
- **Análise:** Rastreabilidade, Alertas de Vencimento, Relatórios, Inventário
- **Administração:** Usuários, Auditoria, Ajuste de Estoque (visíveis apenas para administradores)

---

### Páginas Detalhadas

| # | Página | Arquivo | Perfil | Rota |
|---|---|---|---|---|
| 1 | Login | `Login.jsx` | Público | `/login` |
| 2 | Dashboard | `Dashboard.jsx` | Todos | `/` |
| 3 | Produtos | `Produtos.jsx` | Todos | `/produtos` |
| 4 | Lotes | `Lotes.jsx` | Todos | `/lotes` |
| 5 | Mapa do Armazém | `MapaArmazem.jsx` | Todos | `/mapa-armazem` |
| 6 | Entrada | `Entrada.jsx` | Todos | `/entrada` |
| 7 | Saída | `Saida.jsx` | Todos | `/saida` |
| 8 | Transferência | `Transferencia.jsx` | Todos | `/transferencia` |
| 9 | Histórico | `Historico.jsx` | Todos | `/historico` |
| 10 | Rastreabilidade | `Rastreabilidade.jsx` | Todos | `/rastreabilidade` |
| 11 | Alertas de Vencimento | `AlertasVencimento.jsx` | Todos | `/alertas-vencimento` |
| 12 | Relatórios | `Relatorios.jsx` | Todos | `/relatorios` |
| 13 | Inventário | `Inventario.jsx` | Todos | `/inventario` |
| 14 | Auditoria | `Auditoria.jsx` | Admin | `/auditoria` |
| 15 | Usuários | `Usuarios.jsx` | Admin | `/usuarios` |
| 16 | Perfil | `Perfil.jsx` | Todos | `/perfil` |
| 17 | Ajuste de Estoque | `AjusteEstoque.jsx` | Admin | `/ajuste-estoque` |

#### Dashboard — crítico, proteção máxima
- KPIs: total de lotes ativos, produtos cadastrados, movimentações do dia, alertas de vencimento
- Gráfico de movimentações dos últimos 30 dias (**SVG puro**)
- Lista de alertas recentes
- Dados via `GET /api/v1/dashboard/kpis` + `GET /api/v1/dashboard/movimentacoes` + `GET /api/v1/dashboard/alertas`

#### Mapa do Armazém — crítico, proteção máxima
- Grid visual das localizações do armazém
- Exibe ocupação e status de cada posição
- **SVG puro** — sem bibliotecas de visualização

#### Entrada de Estoque
- Cria lote novo (com número, validade, fabricação, localização)
- Registra movimentação tipo `entrada`
- Valida produto ativo, localização existente

#### Saída de Estoque
- Busca lote por código ou número
- Valida quantidade disponível (não pode ficar negativa)
- Rejeita lotes com status `bloqueado` ou `vencido`

#### Transferência
- Move lote de localização origem para destino
- Atualiza `lote.id_localizacao`
- Registra movimentação tipo `transferencia` com origem e destino

#### Rastreabilidade
- Busca por número de lote ou código QR/RFID
- Exibe timeline completa: onde esteve, quem moveu, quando

#### Inventário
- Contagem cíclica: informa quantidade real, sistema registra diferença
- Gera movimentação tipo `inventario`

#### Ajuste de Estoque (Admin)
- Permite corrições manuais com justificativa
- Gera movimentação tipo `ajuste`
- Dupla confirmação obrigatória antes de salvar

#### Auditoria (Admin)
- Lista registros de `auditoria_log` com filtros
- Somente leitura — nunca permite edição

---

## 8. Fluxos Principais

### Fluxo de Autenticação

```
1. Usuário POST /api/v1/auth/login (email + senha)
2. Backend busca usuário por email
3. bcrypt.compare(senha, senha_hash)
4. Gera JWT com payload {id, email, perfil, nome}, expira em 8h
5. logAudit(tabela: 'usuario', operacao: 'LOGIN')
6. Frontend armazena token + user em localStorage
7. Axios injeta 'Authorization: Bearer <token>' em toda requisição
8. authMiddleware valida assinatura + checa blacklist em memória
9. Logout: POST /api/v1/auth/logout → token vai para blacklist Set()
```

**Limitação:** Blacklist é in-memory. Reiniciar o servidor invalida todos os logouts feitos antes.

### Fluxo de Entrada de Estoque

```
1. Operador preenche: produto, número do lote, validade, fabricação, quantidade, localização
2. POST /api/v1/movimentacoes/entrada
3. Controller: getConnection() → beginTransaction()
4. INSERT INTO lote (novo lote) OU valida lote existente
5. INSERT INTO movimentacao (tipo: 'entrada')
6. UPDATE lote SET quantidade = quantidade + :qtd WHERE id = :id
7. COMMIT
8. logAudit() na aplicação
9. Trigger trg_audit_movimentacao_insert dispara no banco
```

### Fluxo de Saída

```
1. POST /api/v1/movimentacoes/saida
2. Busca lote, valida status (não pode ser bloqueado/vencido)
3. Valida quantidade: lote.quantidade >= quantidade_solicitada
4. beginTransaction()
5. INSERT INTO movimentacao (tipo: 'saida')
6. UPDATE lote SET quantidade = quantidade - :qtd
7. Se quantidade = 0: UPDATE lote SET status_lote = 'finalizado'
8. COMMIT / ROLLBACK
```

### Fluxo de Bloqueio de Lote (Admin)

```
1. PATCH /api/v1/lotes/:id/bloquear
2. adminMiddleware → verifica perfil
3. UPDATE lote SET status_lote='bloqueado', data_bloqueio=NOW(), motivo_bloqueio=:motivo
4. logAudit(operacao: 'BLOQUEIO')
5. Trigger trg_audit_lote_update dispara
```

---

## 9. Endpoints da API

**Base URL:** `http://localhost:3000/api/v1`
**Swagger UI:** `http://localhost:3000/api/docs`

### Auth — `/api/v1/auth`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| POST | `/login` | Não | Não | Login, retorna JWT |
| GET | `/perfil` | Sim | Não | Dados do usuário logado |
| POST | `/logout` | Sim | Não | Invalida token (blacklist) |
| PATCH | `/senha` | Sim | Não | Altera própria senha |

### Produtos — `/api/v1/produtos`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | Não | Lista produtos ativos |
| GET | `/:id` | Sim | Não | Detalhe de produto |
| POST | `/` | Sim | Não | Cria produto |
| PUT | `/:id` | Sim | Não | Atualiza produto |
| PATCH | `/:id/inativar` | Sim | Não | Inativa produto (soft delete) |

### Lotes — `/api/v1/lotes`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | Não | Lista lotes com filtros |
| GET | `/vencendo` | Sim | Não | Lotes próximos ao vencimento |
| GET | `/abaixo-minimo` | Sim | Não | Lotes abaixo do estoque mínimo |
| GET | `/:id` | Sim | Não | Detalhe de lote |
| GET | `/:id/timeline` | Sim | Não | Histórico completo do lote |
| POST | `/` | Sim | Não | Cria lote |
| PUT | `/:id` | Sim | Não | Atualiza lote |
| PATCH | `/:id/bloquear` | Sim | **Sim** | Bloqueia lote |
| PATCH | `/:id/desbloquear` | Sim | **Sim** | Desbloqueia lote |

### Movimentações — `/api/v1/movimentacoes`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | Não | Lista movimentações com filtros |
| POST | `/entrada` | Sim | Não | Registra entrada |
| POST | `/saida` | Sim | Não | Registra saída |
| POST | `/transferencia` | Sim | Não | Registra transferência |
| POST | `/ajuste` | Sim | **Sim** | Ajuste manual de estoque |
| POST | `/inventario` | Sim | Não | Contagem de inventário |

### Usuários — `/api/v1/usuarios`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/perfil` | Sim | Não | Perfil do usuário logado |
| GET | `/` | Sim | **Sim** | Lista todos os usuários |
| GET | `/:id` | Sim | **Sim** | Detalhe de usuário |
| POST | `/` | Sim | **Sim** | Cria usuário |
| PUT | `/:id` | Sim | **Sim** | Atualiza usuário |
| PATCH | `/:id/inativar` | Sim | **Sim** | Inativa usuário |

### Auditoria — `/api/v1/auditoria`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | **Sim** | Lista logs de auditoria |
| GET | `/lote/:id` | Sim | **Sim** | Auditoria por lote |
| GET | `/usuario/:id` | Sim | **Sim** | Auditoria por usuário |

### Localizações — `/api/v1/localizacoes`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | Não | Lista localizações |
| GET | `/:id/lotes` | Sim | Não | Lotes em uma localização |
| POST | `/` | Sim | **Sim** | Cria localização |

### Identificações — `/api/v1/identificacoes`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/:codigo` | Sim | Não | Busca lote por QR/RFID |
| POST | `/` | Sim | Não | Vincula código a lote |

### Dashboard — `/api/v1/dashboard`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/kpis` | Sim | Não | Totais e alertas |
| GET | `/movimentacoes` | Sim | Não | Movimentações últimos 30 dias |
| GET | `/alertas` | Sim | Não | Alertas de vencimento e estoque |

### Inventários — `/api/v1/inventarios`
| Método | Endpoint | Auth | Admin | Descrição |
|---|---|---|---|---|
| GET | `/` | Sim | Não | Lista inventários |
| POST | `/` | Sim | Não | Registra contagem |

### Utilitários
| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| GET | `/api/v1/health` | Não | Health check do servidor |
| GET | `/api/docs` | Não | Swagger UI interativo |

---

## 10. Componentes Compartilhados

### `Layout.jsx` — Shell principal
- Sidebar com 4 seções de navegação, colapsável (224px ↔ 60px)
- Seções admin visíveis apenas se `user.perfil === 'administrador'`
- Topbar: search, theme toggle (`data-theme="dark"` no `<html>`), avatar + dropdown
- Breadcrumb automático por pathname

### `AuthContext.jsx`
- Estado: `{ user, token, isAuthenticated, loading }`
- `login(email, senha)` → chama API, salva no localStorage
- `logout()` → chama API, limpa localStorage, redireciona para `/login`
- Token e user persistem via localStorage (sem cookie, sem sessão server-side)

### `ToastContext.jsx`
- `showToast(mensagem, tipo)` → tipos: `success`, `error`, `warning`, `info`
- Toast stack posicionado bottom-right
- Auto-dismiss após alguns segundos

### `axios.js` — Cliente HTTP
```javascript
// baseURL: 'http://localhost:3000/api/v1'  ← HARDCODED
// Request interceptor: adiciona Authorization: Bearer <token> do localStorage
// Response interceptor: se 401 → limpa localStorage + redireciona /login
```

### Guards de rota em `App.jsx`
- `<PrivateRoute>` — redireciona para `/login` se não autenticado
- `<AdminRoute>` — redireciona para `/` se não for administrador

---

## 11. Design System

### Tokens CSS — `src/styles/tokens.css`

#### Paleta de Cores
| Token | Valor | Uso |
|---|---|---|
| `--color-brand-navy` | `#1F3864` | Sidebar, headers |
| `--color-brand-blue` | `#2E75B6` | Botões primários, links |
| `--color-brand-light` | `#bfdbfe` | Hover states, backgrounds |
| `--color-success` | `#16a34a` | Status ativo, entradas |
| `--color-danger` | `#dc2626` | Erros, saídas, exclusões |
| `--color-warning` | `#f59e0b` | Alertas, vencimento próximo |
| `--color-info` | `#0284c7` | Informações, badges |
| `--color-admin` | `#7c3aed` | Badge de administrador |
| Sidebar bg | `#0f1f3d` | Background da sidebar |

#### Tipografia
- **Display:** IBM Plex Sans (weights: 300, 400, 500, 600, 700)
- **Mono:** IBM Plex Mono (códigos de lote, IDs)
- Fonte importada via Google Fonts

#### Componentes CSS — `src/styles/app.css`
| Componente | Classe | Variantes |
|---|---|---|
| Botão | `.btn` | `.btn-primary`, `.btn-outline`, `.btn-danger`, `.btn-success`, `.btn-sm`, `.btn-lg` |
| Card | `.card`, `.card-header`, `.card-body` | — |
| Tabela | `.table` | Linhas alternadas, hover |
| Badge | `.badge` | `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`, `.badge-admin` |
| Input | `.form-control`, `.form-select` | — |
| Modal | `.modal-overlay`, `.modal` | — |
| Toast | `.toast-container`, `.toast` | `.toast-success`, `.toast-error` |

#### Tema Escuro
- Toggle via `document.documentElement.dataset.theme = 'dark'`
- CSS variables sobrescritas em `[data-theme="dark"]`
- Preferência salva em localStorage como `theme`

---

## 12. Regras de Negócio

### Lotes
- Quantidade nunca pode ser negativa (CHECK constraint no banco)
- Lote `bloqueado` não aceita saída nem transferência
- Lote `vencido` não aceita saída nem transferência
- Quando `quantidade = 0` após saída → status muda para `finalizado`
- Cada lote tem no máximo um código de identificação (QR ou RFID)
- Número de lote deve ser único no sistema

### Movimentações
- Toda movimentação é registrada com usuário identificado
- Quantidade da movimentação deve ser > 0 (CHECK constraint)
- Saída não pode exceder a quantidade disponível no lote
- Transferência mantém a quantidade, apenas altera localização
- Ajuste de estoque requer justificativa e perfil administrador
- Inventário registra diferença entre contagem real e sistema

### Usuários
- Email único no sistema
- Senha hasheada com bcrypt antes de salvar
- Usuário inativado não consegue mais autenticar (ativo = 0)
- Apenas administrador pode criar/editar/inativar outros usuários

### Alertas
- Vencimento próximo: padrão de X dias antes da data_validade (configurado na query do dashboard)
- Estoque abaixo do mínimo: `lote.quantidade < produto.estoque_minimo`

### Auditoria
- Toda operação crítica gera registro em `auditoria_log`
- Dupla cobertura: trigger no banco + `logAudit()` na aplicação
- Registros de auditoria são imutáveis — sem UPDATE/DELETE
- Login de usuário também é auditado

### Autenticação
- JWT expira em 8h
- Logout invalida token via blacklist em memória (não persiste entre restarts)
- Senha deve ser validada com `express-validator` antes de processar

---

## 13. Problemas Conhecidos

| # | Problema | Impacto | Status |
|---|---|---|---|
| 1 | **Blacklist JWT em memória** — reiniciar servidor invalida todos os logouts | Segurança: usuário deslogado volta a ter token válido após restart | Limitação conhecida (ver ARCHITECTURE.md) |
| 2 | **baseURL hardcoded** — `axios.js` aponta para `localhost:3000` | Quebra em staging/produção sem ajuste manual | Limitação conhecida |
| 3 | **Sem testes automatizados** | Regressões só detectadas manualmente | Roadmap |
| 4 | **Sem rate limiting** no endpoint de login | Vulnerável a brute force | Roadmap |
| 5 | **Inventario.jsx chama endpoint inexistente** | Tela de inventário pode apresentar erro | Bug a investigar |
| 6 | **Prisma instalado mas não usado em runtime** | Dependência pesada sem uso real (só tipos) | Pode ser removido se não for usado |
| 7 | **Token armazenado em localStorage** | Vulnerável a XSS (padrão mais seguro seria httpOnly cookie) | Decisão arquitetural consciente |
| 8 | **Sem paginação robusta** em algumas listagens | Performance em produção com muitos registros | Roadmap |

---

## 14. Variáveis de Ambiente

### Backend — `stockflow-api/.env`
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Stockflow@2026
DB_NAME=stockflow
JWT_SECRET=<secret longo e aleatório>
JWT_EXPIRES_IN=8h
PORT=3000
```

### Root — `.env` (Prisma)
```env
DATABASE_URL="mysql://root:Stockflow@2026@localhost:3306/stockflow"
```

### Frontend
Sem arquivo `.env` — configuração embutida em `src/api/axios.js`.

---

## 15. Scripts de Execução

```bash
# Instalar todas as dependências
npm install                    # raiz
cd stockflow-api && npm install
cd stockflow-frontend && npm install

# Executar banco de dados
mysql -u root -p < database/setup.sql

# Iniciar backend
cd stockflow-api && npm run dev    # porta 3000

# Iniciar frontend
cd stockflow-frontend && npm run dev   # porta 5173

# Iniciar ambos simultaneamente (da raiz)
npm run dev

# Build de produção (frontend)
cd stockflow-frontend && npm run build
```

---

## 16. Roadmap

### Pendências / Bugs
- [ ] Investigar e corrigir erro na tela de Inventário (endpoint não encontrado)
- [ ] Adicionar rate limiting no endpoint de login
- [ ] Substituir blacklist JWT em memória por Redis ou banco

### Melhorias Planejadas
- [ ] Testes automatizados (Jest + Supertest para API)
- [ ] Variável de ambiente para a baseURL do frontend
- [ ] Paginação server-side em listagens grandes
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Sistema de notificações por email (alertas de vencimento)
- [ ] QR Code generator integrado (gerar código ao criar lote)
- [ ] Multi-armazém (suporte a múltiplas unidades físicas)
- [ ] Dashboard com filtros por período personalizável

### Possível Remoção
- Prisma (se confirmado que não será usado em runtime, remover para reduzir peso)

---

## 17. Regras Obrigatórias para IA (resumo do CLAUDE.md)

> Estas regras têm prioridade máxima e nunca devem ser ignoradas.

1. **Git:** Fazer backup commit antes de qualquer tarefa. Nunca commitar sem confirmação do usuário. Nunca fazer reset, rebase ou force push.

2. **Arquivos visuais (Dashboard, Mapa, Layout, Pages, Components):** Proteção total. Alterações cirúrgicas apenas. Mostrar diff antes de salvar. Pedir confirmação explícita.

3. **Fluxo de trabalho:** Explicar o que vai fazer ANTES de fazer. Listar arquivos afetados. Aguardar "pode seguir".

4. **Banco de dados:** Nunca rodar SQL sem confirmação. Nunca deletar dados ou tabelas. Backup antes de alterar schema.

5. **Proibido sem permissão explícita:** Deletar arquivos, renomear arquivos/pastas, instalar/remover dependências, alterar variáveis de ambiente, refatorar código funcionando.

6. **Críticos com dupla confirmação:** Lotes, estoque, rastreabilidade.

7. **Imutável:** `auditoria_log` — nunca alterar.

8. **Gráficos:** SVG puro — nunca substituir por bibliotecas externas.

9. **Segurança:** Toda rota nova precisa de autenticação. Nunca expor stack trace. Nunca logar senhas/tokens.

---

*Documento gerado automaticamente a partir da exploração completa do código-fonte em 2026-05-29.*
*Para atualizar: re-executar a exploração e sobrescrever este arquivo.*
