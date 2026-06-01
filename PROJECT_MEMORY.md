# Memória do Projeto StockFlow

Atualizado em: 2026-05-31.

Este documento resume o estado real do projeto para continuidade por desenvolvedores ou assistentes de IA. Para detalhes completos, consulte os documentos especializados na raiz.

## Resumo Executivo

StockFlow é um WMS web para controle de estoque com foco em produtos rastreáveis por lote. O sistema cobre cadastro de produtos, lotes, localizações, movimentações, inventário, rastreabilidade, alertas, auditoria, usuários e integração SAP por JSON.

## Stack Atual

| Área | Stack |
|---|---|
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS, CSS tokens |
| Backend | Node.js, Express 4, JWT, Helmet, CORS, express-validator, express-rate-limit |
| Banco | MySQL 8.4 com SQL direto via `mysql2/promise` |
| Docs API | Swagger UI |

## Estrutura

```text
database/              Scripts SQL
docs/                  Manual existente em português
stockflow-api/         API Express
stockflow-frontend/    SPA React
.claude/skills/        Skills locais de frontend
```

## Módulos Funcionais

- Login e autenticação.
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

## Rotas SPA

Definidas em `stockflow-frontend/src/App.jsx`.

- `/login`
- `/dashboard`
- `/produtos`
- `/lotes`
- `/lotes/novo`
- `/mapa`
- `/entrada`
- `/saida`
- `/transferencia`
- `/movimentacoes`
- `/movimentacoes/entrada`
- `/movimentacoes/saida`
- `/movimentacoes/transferencia`
- `/historico`
- `/rastreabilidade`
- `/alertas`
- `/alertas-vencimento`
- `/relatorios`
- `/inventario`
- `/perfil`
- `/auditoria`
- `/usuarios`
- `/ajuste`
- `/sap`

## API

Base local padrão: `http://localhost:3000/api/v1`.

Grupos de rotas:

- `/auth`
- `/produtos`
- `/lotes`
- `/movimentacoes`
- `/localizacoes`
- `/usuarios`
- `/identificacoes`
- `/auditoria`
- `/dashboard`
- `/inventarios`
- `/inventario`
- `/sap`

Swagger UI: `http://localhost:3000/api/docs`.

## Banco

`database/setup.sql` cria as tabelas:

- `localizacao`
- `produto`
- `usuario`
- `lote`
- `movimentacao`
- `identificacao`
- `auditoria_log`

E cria triggers de auditoria em movimentação, lote e usuário.

Importante: o código atual usa a tabela `inventario`, mas ela não é criada pelo `setup.sql`. O script `feature_inventory_sap_permissions.sql` assume que `inventario` já existe. Essa inconsistência é uma pendência real do projeto.

## Autenticação e Autorização

- Login em `POST /auth/login`.
- Body usa `identifier` e `senha`.
- `identifier` aceita e-mail ou código numérico de usuário.
- Login usa `loginLimiter`.
- JWT é salvo no `localStorage`.
- `authMiddleware` valida token, blacklist e usuário ativo no banco.
- `adminMiddleware` protege rotas administrativas.
- `checkPermission` combina perfil administrador, permissões JSON e permissões padrão de operador.

## Regras de Negócio Relevantes

- Produto pode ser inativado.
- Lote tem número único.
- Lote pode estar `ativo`, `vencido`, `bloqueado`, `quarentena` ou `finalizado`.
- Saída não permite quantidade maior que estoque disponível.
- Saída e transferência bloqueiam lote `bloqueado` ou `vencido`.
- Ajuste exige administrador e justificativa.
- Identificação permite um QR Code ou RFID por lote.
- Auditoria é registrada por aplicação e triggers.

## Documentos Canônicos

- `README.md`: visão geral e execução.
- `ARCHITECTURE.md`: arquitetura e fluxos.
- `PRODUCT_VISION.md`: visão de produto.
- `BUSINESS_RULES.md`: regras reais.
- `DATABASE_DOCUMENTATION.md`: schema real.
- `API_DOCUMENTATION.md`: endpoints reais.
- `MODULES.md`: módulos.
- `TECH_STACK.md`: tecnologias.
- `DEPLOYMENT_GUIDE.md`: instalação/deploy.
- `USER_MANUAL.md`: manual operacional.
- `PRESENTATION.md`: roteiro acadêmico.
- `DOCUMENTATION_AUDIT_REPORT.md`: auditoria documental.

## Validação Técnica Mais Recente

- `npm run build` no frontend: aprovado.
- `npm audit` na raiz: sem vulnerabilidades.
- `npm audit` na API: sem vulnerabilidades.
- `npm audit` no frontend: vulnerabilidade alta em `xlsx`, sem fix disponível.

## Pendências Técnicas

- Criar/migrar a tabela `inventario` no schema principal.
- Revisar ou mitigar `xlsx`.
- Adicionar testes automatizados.
- Persistir blacklist JWT para execução multi-instância.
- Padronizar contratos de inventário entre `/inventarios` e `/inventario`.
