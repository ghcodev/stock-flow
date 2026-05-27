# Auditoria — StockFlow
**Data:** 2026-05-27

---

## 1. Documentação

| Artefato | Status |
|----------|--------|
| `README.md` | Criado |
| `ARCHITECTURE.md` | Criado |
| `stockflow-api/.env.example` | Criado |
| Endpoints documentados abaixo | Concluído |

### Endpoints da API (`/api/v1`)

#### Auth — `/auth`
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/login` | Público | Login. Body: `{email, senha}`. Retorna `{token, usuario}` |
| POST | `/auth/logout` | JWT | Invalida o token na blacklist |
| PATCH | `/auth/senha` | JWT | Altera senha. Body: `{senha_atual, nova_senha}` |

#### Produtos — `/produtos` (JWT obrigatório)
| Método | Rota | Admin | Descrição |
|--------|------|-------|-----------|
| GET | `/produtos` | Não | Lista com paginação. Query: `busca`, `categoria`, `page`, `limit` |
| GET | `/produtos/:id` | Não | Produto por ID com estoque_atual agregado |
| POST | `/produtos` | Não | Cria produto. Body: `{nome, categoria, unidade_medida, descricao?, estoque_minimo?}` |
| PUT | `/produtos/:id` | Não | Atualiza produto |
| PATCH | `/produtos/:id/inativar` | Sim | Inativa produto (soft delete) |

#### Lotes — `/lotes` (JWT obrigatório)
| Método | Rota | Admin | Descrição |
|--------|------|-------|-----------|
| GET | `/lotes` | Não | Lista com paginação. Query: `status`, `produto`, `page`, `limit` |
| GET | `/lotes/:id` | Não | Lote por ID com identificação vinculada |
| GET | `/lotes/:id/timeline` | Não | Histórico de movimentações do lote |
| GET | `/lotes/vencendo` | Não | Lotes vencendo em 30 dias |
| GET | `/lotes/abaixo-minimo` | Não | Produtos com estoque abaixo do mínimo |
| POST | `/lotes` | Não | Cria lote. Body: `{numero_lote, id_produto, id_localizacao, quantidade?, data_fabricacao?, data_validade?}` |
| PUT | `/lotes/:id` | Não | Atualiza lote |
| PATCH | `/lotes/:id/bloquear` | Sim | Bloqueia lote. Body: `{motivo}` (mín. 5 chars) |
| PATCH | `/lotes/:id/desbloquear` | Sim | Desbloqueia lote |

#### Movimentações — `/movimentacoes` (JWT obrigatório)
| Método | Rota | Admin | Descrição |
|--------|------|-------|-----------|
| GET | `/movimentacoes` | Não | Lista com paginação. Query: `tipo`, `lote`, `usuario`, `page`, `limit` |
| POST | `/movimentacoes/entrada` | Não | Registra entrada. Body: `{id_lote, quantidade, id_localizacao_destino?, observacao?}` |
| POST | `/movimentacoes/saida` | Não | Registra saída. Body: `{id_lote, quantidade, observacao?}` |
| POST | `/movimentacoes/transferencia` | Não | Transfere lote. Body: `{id_lote, id_localizacao_destino, motivo_movimentacao}` (motivo mín. 10 chars) |
| POST | `/movimentacoes/ajuste` | Sim | Ajusta quantidade. Body: `{id_lote, nova_quantidade, justificativa}` (justificativa mín. 10 chars) |
| POST | `/movimentacoes/inventario` | Não | Verifica divergências. Body: `{contagens: [{id_lote, quantidade_contada}]}` |

#### Localizações — `/localizacoes` (JWT obrigatório)
| Método | Rota | Admin | Descrição |
|--------|------|-------|-----------|
| GET | `/localizacoes` | Não | Lista todas as localizações |
| GET | `/localizacoes/:id/lotes` | Não | Lotes de uma localização |
| POST | `/localizacoes` | Sim | Cria localização. Body: `{corredor, nivel, posicao, descricao?}` |

#### Usuários — `/usuarios` (JWT obrigatório)
| Método | Rota | Admin | Descrição |
|--------|------|-------|-----------|
| GET | `/usuarios/perfil` | Não | Perfil do usuário autenticado |
| GET | `/usuarios` | Sim | Lista todos os usuários |
| GET | `/usuarios/:id` | Sim | Usuário por ID |
| POST | `/usuarios` | Sim | Cria usuário. Body: `{nome, email, senha, perfil?}` |
| PUT | `/usuarios/:id` | Sim | Atualiza usuário |
| PATCH | `/usuarios/:id/inativar` | Sim | Inativa usuário |

#### Dashboard — `/dashboard` (JWT obrigatório)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/dashboard/kpis` | KPIs: total produtos, lotes vencendo, bloqueados, movimentações hoje |
| GET | `/dashboard/movimentacoes` | Volume dos últimos 30 dias agrupado por dia e tipo |
| GET | `/dashboard/alertas` | Alertas: vencendo, abaixo do mínimo, bloqueados (máx 10 cada) |

#### Auditoria — `/auditoria` (JWT + Admin)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/auditoria` | Lista logs com paginação. Query: `operacao`, `tabela`, `usuario`, `page`, `limit` |
| GET | `/auditoria/lote/:id` | Logs relacionados a um lote |
| GET | `/auditoria/usuario/:id` | Logs de um usuário (máx 200) |

#### Identificações — `/identificacoes` (JWT obrigatório)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/identificacoes/:codigo` | Busca lote pelo código QR/RFID |
| POST | `/identificacoes` | Cria identificação. Body: `{tipo, codigo, id_lote}` |

---

## 2. Bugs encontrados

### BUG-01 — Endpoint `/inventarios` inexistente (CRÍTICO)
- **Arquivo:** `stockflow-frontend/src/pages/Inventario.jsx` linhas 36 e 55
- **Descrição:** A página chama `GET /inventarios` e `POST /inventarios`, mas nenhuma rota `/api/v1/inventarios` existe na API. O endpoint correto de inventário está em `POST /movimentacoes/inventario` e tem contrato diferente.
- **Impacto:** Página Inventário Rotativo completamente quebrada em produção.
- **Sugestão:** Implementar controller/routes de inventários na API com tabela dedicada, ou adaptar a página para usar `POST /movimentacoes/inventario`.
- **Status:** PENDENTE

### BUG-02 — Ajuste com `Math.abs(diff) || 1` gravava quantidade errada
- **Arquivo:** `stockflow-api/src/controllers/movimentacoes.controller.js` linha 150
- **Descrição:** Quando `nova_quantidade === quantidade_atual` (diff = 0), `Math.abs(0) || 1` resulta em `1`, gravando uma movimentação com quantidade `1` no histórico mesmo sem mudança real.
- **Status:** CORRIGIDO — adicionada validação `if (diff === 0) return 422`; `|| 1` removido.

### BUG-03 — LIMIT/OFFSET por interpolação de string
- **Arquivos:** `controllers/produtos.controller.js:17`, `lotes.controller.js:19`, `movimentacoes.controller.js:24`, `auditoria.controller.js:16`
- **Descrição:** `LIMIT ${Number(limit)} OFFSET ${offset}` monta SQL por concatenação. O `Number()` converte strings inválidas para `NaN`, o que causaria erro SQL em vez de injeção — mitigado, mas não parameterizado.
- **Sugestão:** Validar `page` e `limit` com `parseInt()` e faixa mínima/máxima antes de usar.
- **Status:** PENDENTE (risco baixo, mitigado pelo cast)

### BUG-04 — Blacklist de logout não persiste entre restarts
- **Arquivo:** `stockflow-api/src/middleware/auth.js` linha 3
- **Descrição:** `const blacklist = new Set()` é in-memory. Reiniciar o servidor invalida todos os logouts realizados; tokens logados-out voltam a ser aceitos.
- **Sugestão:** Persistir blacklist em Redis ou tabela `tokens_revogados` com índice na coluna `jti`.
- **Status:** PENDENTE

### BUG-05 — Busca por lote em auditoria pode retornar falsos positivos
- **Arquivo:** `stockflow-api/src/controllers/auditoria.controller.js` linhas 28-30
- **Descrição:** Query `LIKE '%lote:1%'` em campos de texto livre pode retornar registros de lotes `10`, `11`, `100`. O campo `valor_novo` é texto livre não estruturado.
- **Sugestão:** Usar delimitador no logAudit (`lote:1,`) ou armazenar audit em JSON estruturado.
- **Status:** PENDENTE

---

## 3. Segurança

### SEC-01 — `err.message` exposto em respostas de erro (ALTA)
- **Arquivo:** `stockflow-api/src/app.js` linha 32
- **Código:** `res.status(500).json({ error: 'Erro interno do servidor', detalhe: err.message })`
- **Descrição:** Mensagens internas de erro (queries SQL, nomes de tabelas, etc.) chegam ao cliente.
- **Sugestão:** Remover `detalhe` em produção: `...(process.env.NODE_ENV !== 'production' && { detalhe: err.message })`
- **Status:** PENDENTE

### SEC-02 — Sem rate limiting no endpoint de login (ALTA)
- **Arquivo:** `stockflow-api/src/routes/auth.routes.js`
- **Descrição:** Nenhuma proteção contra brute force no `POST /auth/login`.
- **Sugestão:** Adicionar `express-rate-limit` com máx. 10 tentativas / 15 min por IP.
- **Status:** PENDENTE

### SEC-03 — JWT armazenado em localStorage (MÉDIA)
- **Arquivo:** `stockflow-frontend/src/api/axios.js` + `src/context/AuthContext.jsx`
- **Descrição:** Token em `localStorage` é acessível por qualquer script da página (XSS).
- **Sugestão:** Migrar para `httpOnly` cookie via `Set-Cookie` no backend (requer CORS credentials).
- **Status:** PENDENTE

### SEC-04 — `baseURL` hardcoded no frontend (MÉDIA)
- **Arquivo:** `stockflow-frontend/src/api/axios.js` linha 3
- **Código:** `baseURL: 'http://localhost:3000/api/v1'`
- **Descrição:** Não funciona em staging/produção sem rebuild. Credenciais de ambiente ficam no código.
- **Sugestão:** Usar variável Vite: `baseURL: import.meta.env.VITE_API_URL`; criar `stockflow-frontend/.env.example`.
- **Status:** PENDENTE

### SEC-05 — `.env` no `.gitignore` da API (OK)
- **Arquivo:** `stockflow-api/.gitignore`
- **Status:** OK — `.env` está ignorado. `.env.example` criado nesta auditoria.

### SEC-06 — Sem dados sensíveis hardcoded no código-fonte
- Nenhum token, senha ou chave de API encontrado em arquivos `.js` ou `.jsx` do projeto.
- **Status:** OK

### SEC-07 — Stack trace não exposto ao cliente
- `app.js:31` usa `console.error` (server-side). Apenas `err.message` vai ao cliente (ver SEC-01).
- **Status:** PARCIAL — `err.message` ainda vaza (ver SEC-01)

---

## 4. Organização

### ORG-01 — Prisma abandonado na raiz do projeto
- **Local:** `/prisma.config.ts`, `/prisma/`, `/generated/`, `package.json` raiz
- **Descrição:** Estrutura Prisma montada na raiz, mas a API em `stockflow-api/` usa `mysql2` direto. Prisma não é utilizado em nenhum controller.
- **Sugestão:** Remover `prisma.config.ts`, `/prisma/`, `/generated/` e as dependências Prisma do `package.json` raiz para eliminar confusão.
- **Status:** PENDENTE (excluído do git pelo `.gitignore` raiz — não é urgente)

### ORG-02 — Pasta `uploads/` na raiz
- **Local:** `/uploads/`
- **Descrição:** Pasta de uploads está na raiz do projeto em vez de dentro de `stockflow-api/`.
- **Status:** Excluída do git; baixo impacto. PENDENTE para organização.

### ORG-03 — Nenhum arquivo temporário ou de teste encontrado
- **Status:** OK

### ORG-04 — Nomenclatura de middleware inconsistente com rotas
- `routes/` usa sufixo `.routes.js`; `controllers/` usa `.controller.js`; `middleware/` usa nomes simples (`auth.js`, `admin.js`, `audit.js`)
- **Status:** PENDENTE (impacto cosmético)

---

## 5. Melhorias recomendadas (por prioridade)

| # | Prioridade | Item | Esforço |
|---|-----------|------|---------|
| 1 | CRÍTICA | BUG-01: Implementar endpoint `/inventarios` na API | Alto |
| 2 | ALTA | SEC-01: Não expor `err.message` em produção | Baixo |
| 3 | ALTA | SEC-02: Rate limiting no login | Baixo |
| 4 | ALTA | BUG-04: Persistir blacklist de tokens | Médio |
| 5 | MÉDIA | SEC-04: `baseURL` via variável de ambiente Vite | Baixo |
| 6 | MÉDIA | SEC-03: Migrar JWT para httpOnly cookie | Alto |
| 7 | MÉDIA | BUG-03: Validar `page`/`limit` explicitamente | Baixo |
| 8 | BAIXA | BUG-05: Estruturar campos de auditoria | Médio |
| 9 | BAIXA | ORG-01: Remover Prisma não utilizado da raiz | Baixo |
| 10 | BAIXA | Adicionar testes automatizados (nenhum existe) | Alto |
