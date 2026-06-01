# Documentation Audit Report — StockFlow

Data: 2026-05-31.

## Objetivo

Auditar a documentação do projeto StockFlow, sincronizar documentos com o estado real do código e registrar lacunas sem inventar funcionalidades, tabelas, APIs ou regras de negócio.

## Arquivos Encontrados

Documentação existente antes da atualização:

- `README.md`
- `ARCHITECTURE.md`
- `PROJECT_MEMORY.md`
- `AUDIT.md`
- `CLAUDE.md`
- `SECURITY.md`
- `docs/MANUAL_USUARIO.md`
- `.claude/skills/frontend-design/SKILL.md`
- `.claude/skills/frontend-audit/SKILL.md`

## Arquivos Criados

- `PRODUCT_VISION.md`
- `BUSINESS_RULES.md`
- `DATABASE_DOCUMENTATION.md`
- `API_DOCUMENTATION.md`
- `MODULES.md`
- `TECH_STACK.md`
- `DEPLOYMENT_GUIDE.md`
- `USER_MANUAL.md`
- `PRESENTATION.md`
- `DOCUMENTATION_AUDIT_REPORT.md`

## Arquivos Atualizados

- `README.md`
- `ARCHITECTURE.md`
- `PROJECT_MEMORY.md`
- `AUDIT.md`
- `CLAUDE.md`
- `docs/MANUAL_USUARIO.md`
- `.claude/skills/frontend-design/SKILL.md`
- `.claude/skills/frontend-audit/SKILL.md`

## Arquivos Obsoletos ou Redundantes

Nenhum arquivo foi removido por obsolescência.

Observação:

- `docs/MANUAL_USUARIO.md` foi mantido por compatibilidade e passou a apontar para `USER_MANUAL.md`, evitando duplicação extensa de manual.

## Cobertura da Documentação

| Área | Documento |
|---|---|
| Visão geral e setup | `README.md` |
| Arquitetura | `ARCHITECTURE.md` |
| Memória do projeto | `PROJECT_MEMORY.md` |
| Auditoria técnica | `AUDIT.md` |
| Visão executiva | `PRODUCT_VISION.md` |
| Regras de negócio | `BUSINESS_RULES.md` |
| Banco de dados | `DATABASE_DOCUMENTATION.md` |
| API | `API_DOCUMENTATION.md` |
| Módulos | `MODULES.md` |
| Stack técnica | `TECH_STACK.md` |
| Deploy | `DEPLOYMENT_GUIDE.md` |
| Manual de usuário | `USER_MANUAL.md` |
| Apresentação acadêmica | `PRESENTATION.md` |
| Regras para assistentes | `CLAUDE.md` |
| Skills frontend | `.claude/skills/frontend-design/`, `.claude/skills/frontend-audit/` |

## Fontes Usadas na Auditoria

- Estrutura do repositório por `rg --files`.
- Rotas em `stockflow-api/src/app.js` e `stockflow-api/src/routes`.
- Controllers em `stockflow-api/src/controllers`.
- Configuração de banco em `stockflow-api/src/config/database.js`.
- Schema SQL em `database/setup.sql`.
- Scripts complementares em `database/`.
- Rotas SPA em `stockflow-frontend/src/App.jsx`.
- Chamadas HTTP em `stockflow-frontend/src`.
- Dependências em `package.json` da raiz, API e frontend.
- Skills locais em `.claude/skills`.

## Pendências Encontradas

### Banco de dados

- `database/setup.sql` não cria a tabela `inventario`.
- O backend e o frontend dependem da tabela `inventario`.
- `database/feature_inventory_sap_permissions.sql` tenta alterar `inventario`, assumindo que ela já existe.

### Segurança/dependências

- `stockflow-frontend` possui vulnerabilidade alta em `xlsx` sem correção disponível via `npm audit`.
- Token JWT é armazenado em `localStorage`.
- Blacklist de JWT é in-memory.

### Qualidade

- Não há testes automatizados identificados.
- Há duas superfícies de API para inventário: `/inventarios` e `/inventario`, com contratos diferentes.
- Algumas validações usam `validate`, outras usam `validationResult` diretamente.

## Recomendações

1. Criar uma migração ou atualizar `database/setup.sql` para incluir a tabela `inventario` se o módulo permanecer ativo.
2. Revisar a dependência `xlsx` e limitar exposição a arquivos não confiáveis até substituição/mitigação.
3. Adicionar testes de API para movimentações, lotes, autenticação e inventário.
4. Unificar ou documentar oficialmente a diferença entre `/inventarios` e `/inventario`.
5. Persistir blacklist de JWT em Redis ou banco se houver múltiplas instâncias.
6. Manter `USER_MANUAL.md` como manual canônico e `docs/MANUAL_USUARIO.md` como ponte de compatibilidade.

## Validações Executadas

- `npm run build` em `stockflow-frontend`: aprovado.
- `npm audit --audit-level=moderate` na raiz: sem vulnerabilidades.
- `npm audit --audit-level=moderate` em `stockflow-api`: sem vulnerabilidades.
- `npm audit --audit-level=moderate` em `stockflow-frontend`: 1 vulnerabilidade alta em `xlsx`.

## Escopo Não Alterado

- Nenhum código de frontend foi alterado.
- Nenhum código de backend foi alterado.
- Nenhum SQL foi alterado.
- Nenhuma dependência foi instalada, removida ou atualizada.
- Nenhum commit foi criado.
- Nenhum push foi executado.
