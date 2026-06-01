# Auditoria Técnica do StockFlow

Data da revisão documental: 2026-05-31.

Este arquivo resume achados técnicos reais observados no projeto. Não substitui `DOCUMENTATION_AUDIT_REPORT.md`, que trata da cobertura documental.

## Escopo Auditado

- Estrutura do repositório.
- Frontend React/Vite.
- Backend Express.
- Scripts SQL em `database/`.
- Rotas reais da API.
- Documentação existente.
- Build e auditoria npm.

## Estado Geral

| Área | Estado |
|---|---|
| Frontend | Build passa com `npm run build` |
| Backend | Estrutura Express consistente, sem script de teste automatizado |
| Banco | Schema principal funcional para tabelas base, mas incompleto para inventário |
| Documentação | Existente, porém parcialmente defasada antes desta revisão |
| Segurança | Usa JWT, Helmet, CORS, rate limit no login e permissões |
| Testes | Não há testes automatizados identificados |

## Achados Críticos

### AUD-01: Schema principal não cria `inventario`

O código atual possui:

- `stockflow-api/src/routes/inventario.routes.js`
- `stockflow-api/src/routes/inventarios.routes.js`
- chamadas frontend para `/inventario` e `/inventarios`
- script `database/feature_inventory_sap_permissions.sql` com `ALTER TABLE inventario`

Mas `database/setup.sql` não contém `CREATE TABLE inventario`.

Impacto:

- Ambiente novo criado apenas com `database/setup.sql` não suporta integralmente a tela de inventário nem relatórios de inventário.

Status:

- Pendente em código/banco.
- Documentado em `DATABASE_DOCUMENTATION.md`.

### AUD-02: Dependência `xlsx` com vulnerabilidade alta

`npm audit --audit-level=moderate` em `stockflow-frontend` reporta:

- Prototype Pollution em SheetJS.
- ReDoS em SheetJS.
- Sem correção disponível pelo `npm audit`.

Impacto:

- Risco em fluxos que processam arquivos/planilhas.

Status:

- Pendente. Requer avaliação de substituição, isolamento ou mitigação operacional.

## Segurança

### Itens positivos

- `helmet` habilitado.
- CORS limitado por `FRONTEND_URL`.
- Login usa `loginLimiter`.
- JWT exigido nas rotas privadas.
- Admin middleware em rotas administrativas.
- Permissões por perfil e permissões JSON customizadas.
- Handler global não expõe `err.message` em produção; o detalhe só é retornado quando `NODE_ENV === 'development'`.

### Limitações

- Blacklist de logout é in-memory.
- Token é armazenado em `localStorage` no frontend.
- Auditoria usa campos textuais/JSON em `auditoria_log`, o que limita consultas estruturadas.

## Backend

### Rotas reais

A API monta os seguintes grupos:

- `/api/v1/auth`
- `/api/v1/produtos`
- `/api/v1/lotes`
- `/api/v1/movimentacoes`
- `/api/v1/localizacoes`
- `/api/v1/usuarios`
- `/api/v1/identificacoes`
- `/api/v1/auditoria`
- `/api/v1/dashboard`
- `/api/v1/inventarios`
- `/api/v1/inventario`
- `/api/v1/sap`
- `/api/v1/health`
- `/api/docs`

Detalhamento completo em `API_DOCUMENTATION.md`.

### Observações

- Há validações com `express-validator`, mas nem todas as rotas usam o middleware `validate`; algumas fazem `validationResult` diretamente no controller/route.
- `adminMiddleware` ainda existe e é usado junto de `checkPermission`.
- A autorização padrão para operadores está em `DEFAULT_OPERATOR_PERMISSIONS`.

## Frontend

### Telas identificadas

- `Login.jsx`
- `Dashboard.jsx`
- `Produtos.jsx`
- `Lotes.jsx`
- `MapaArmazem.jsx`
- `Entrada.jsx`
- `Saida.jsx`
- `Transferencia.jsx`
- `Historico.jsx`
- `Rastreabilidade.jsx`
- `AlertasVencimento.jsx`
- `Relatorios.jsx`
- `Inventario.jsx`
- `Auditoria.jsx`
- `Usuarios.jsx`
- `Perfil.jsx`
- `AjusteEstoque.jsx`
- `IntegracaoSAP.jsx`

### Build

`npm run build` em `stockflow-frontend` executou com sucesso.

### Observações

- O frontend usa `VITE_API_URL`, com fallback para `http://localhost:3000/api/v1`.
- A interface tem design system próprio via CSS tokens.
- `Dashboard.jsx` é uma tela extensa e concentra várias chamadas analíticas.

## Banco de Dados

Tabelas do `setup.sql`:

- `localizacao`
- `produto`
- `usuario`
- `lote`
- `movimentacao`
- `identificacao`
- `auditoria_log`

Triggers do `setup.sql`:

- `trg_audit_movimentacao_insert`
- `trg_audit_lote_update`
- `trg_audit_usuario_insert`

Documentação detalhada em `DATABASE_DOCUMENTATION.md`.

## Pendências Recomendadas

| Prioridade | Item |
|---|---|
| Alta | Criar/migrar tabela `inventario` no schema principal ou remover dependência se o módulo for descontinuado |
| Alta | Revisar uso de `xlsx` e alternativas ou mitigação |
| Média | Persistir blacklist JWT fora da memória |
| Média | Adicionar testes automatizados de API e frontend |
| Média | Padronizar validação de rotas com `validate` |
| Baixa | Estruturar melhor metadados de auditoria para consultas por entidade |

## Comandos Executados na Auditoria Documental

- `rg --files`
- `git status --short`
- leitura de `README.md`, `ARCHITECTURE.md`, `PROJECT_MEMORY.md`, `AUDIT.md`, `CLAUDE.md`
- leitura de rotas, controllers e SQL
- `npm run build` no frontend
- `npm audit --audit-level=moderate` na raiz, API e frontend
