# Arquitetura — StockFlow

## Visão geral

```
[Browser]
    ↕ HTTP/JSON
[Frontend — Vite/React  :5173]
    ↕ HTTP/JSON + JWT
[API — Express          :3000]
    ↕ mysql2/promise
[MySQL 8.4              :3306]
```

---

## Backend (`stockflow-api/`)

### Estrutura de pastas

```
src/
├── app.js                  # Bootstrap: Express, CORS, rotas, error handler global
├── config/
│   └── database.js         # Pool de conexões mysql2 (connectionLimit: 10)
├── middleware/
│   ├── auth.js             # authMiddleware: verifica JWT + blacklist; addToBlacklist()
│   ├── admin.js            # adminMiddleware: rejeita se perfil !== 'administrador'
│   └── audit.js            # logAudit(): INSERT em auditoria_log
├── routes/
│   └── *.routes.js         # Mapeamento de endpoints + validações express-validator
└── controllers/
    └── *.controller.js     # Lógica de negócio + queries SQL
```

### Fluxo de uma requisição autenticada

```
Request
  → authMiddleware          (valida JWT, popula req.user)
  → [adminMiddleware]       (rotas restritas a administrador)
  → express-validator       (valida body/query/params)
  → controller              (query SQL com transação se necessário)
  → logAudit()              (registra operação em auditoria_log)
  → Response JSON
```

### Autenticação e autorização

- **JWT** com expiração configurável (`JWT_EXPIRES_IN`, padrão `8h`)
- Token transmitido via header `Authorization: Bearer <token>`
- **Blacklist in-memory** (`Set`) para logout imediato — não persiste entre restarts do servidor
- Dois perfis: `administrador` e `operador`
- Endpoints admin exigem `adminMiddleware` além do `authMiddleware`

### Transações SQL

Operações que afetam múltiplas tabelas usam transação explícita:

| Operação | Tabelas modificadas |
|----------|-------------------|
| Entrada | `movimentacao` + `lote.quantidade` |
| Saída | `movimentacao` + `lote.quantidade` |
| Transferência | `movimentacao` + `lote.id_localizacao` |
| Ajuste | `movimentacao` + `lote.quantidade` |

Padrão: `getConnection()` → `beginTransaction()` → queries → `commit()` / `rollback()` → `release()`.

### Auditoria

Dois mecanismos complementares:

1. **Application-level**: `logAudit()` chamado explicitamente nos controllers após cada escrita
2. **Database-level**: triggers MySQL (`trg_audit_*`) registram mudanças automaticamente

| Trigger | Evento | O que registra |
|---------|--------|---------------|
| `trg_audit_movimentacao_insert` | INSERT movimentacao | tipo, quantidade, lote |
| `trg_audit_lote_update` | UPDATE lote | quantidade e status anterior/novo |
| `trg_audit_usuario_insert` | INSERT usuario | email e perfil |

### Validação de input

- `express-validator` em todas as rotas com body/params
- `validationResult()` checado no início de cada controller
- Retorna o primeiro erro com status 400

### Tratamento de erros

- `express-async-errors` captura automaticamente exceções em handlers `async`
- Error handler global em `app.js` responde com status 500
- Erros de negócio retornam 4xx com campo `error` e `timestamp`

---

## Frontend (`stockflow-frontend/`)

### Estrutura de pastas

```
src/
├── api/
│   └── axios.js            # Instância axios: baseURL, interceptor de auth, redirect 401
├── context/
│   ├── AuthContext.jsx     # Estado global: user, login(), logout() + localStorage
│   └── ToastContext.jsx    # Notificações toast globais
├── components/
│   └── Layout.jsx          # Shell: sidebar, header, breadcrumb
└── pages/
    └── *.jsx               # Uma página por módulo (16 páginas)
```

### Gerenciamento de estado

- Estado de autenticação via React Context (`AuthContext`)
- Sem biblioteca de estado externo (sem Redux/Zustand)
- Dados de formulário gerenciados localmente via `useState`

### Autenticação no cliente

```
Login bem-sucedido
  → token salvo em localStorage('stockflow_token')
  → user salvo em localStorage('stockflow_user')
  → AuthContext.user populado

Qualquer request
  → interceptor axios injeta header Authorization

Resposta 401
  → interceptor limpa localStorage
  → redireciona para /login
```

### Roteamento e guards

- `react-router-dom` v6 com declaração de rotas em `App.jsx`
- `PrivateRoute`: exige `user !== null`
- `AdminRoute`: exige `user.isAdmin === true`
- Rotas desconhecidas redirecionam para `/dashboard`

---

## Banco de dados

### Diagrama de entidades (simplificado)

```
produto ──< lote >── localizacao
             │
             └──< movimentacao >── usuario
             │
             └── identificacao

auditoria_log ──> usuario (nullable)
```

### Regras de negócio no banco

- `lote.quantidade` nunca pode ser negativo (CHECK constraint)
- Saída valida `quantidade > lote.quantidade` no controller
- Status de lote: `ativo | vencido | bloqueado | quarentena | finalizado`
- Lotes bloqueados não permitem saída nem transferência (validado no controller)

---

## Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| mysql2 direto (sem ORM) | Queries complexas com múltiplos JOINs; controle total sobre SQL |
| express-async-errors | Elimina try/catch repetitivo em todos os handlers async |
| Pool de conexões (limit 10) | Reutilização; adequado para carga de ambiente único |
| Blacklist JWT in-memory | Simples; suficiente para uso interno — não escala para múltiplos processos |
| localStorage para token | Simplicidade de implementação; risco de XSS aceitável em ambiente interno |
| Vite sem variáveis de ambiente | baseURL hardcoded em `axios.js` — limitação para deploy multi-ambiente |

---

## Limitações conhecidas

1. **Blacklist de logout não persiste**: reiniciar a API invalida todos os logouts
2. **baseURL hardcoded**: `axios.js` aponta sempre para `localhost:3000`
3. **Sem testes automatizados**: nenhuma cobertura de unit/integration tests
4. **Rate limiting ausente**: endpoint de login suscetível a brute force
5. **Endpoint `/inventarios` inexistente**: página `Inventario.jsx` chama rota que não existe na API
