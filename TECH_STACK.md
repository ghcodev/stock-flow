# Tech Stack — StockFlow

## Frontend

| Tecnologia | Função |
|---|---|
| React 18 | Construção da interface SPA |
| Vite | Dev server e build de produção |
| React Router DOM | Rotas client-side e guards |
| Axios | Cliente HTTP para API |
| Tailwind CSS | Base utilitária disponível no projeto |
| CSS Tokens | Design system próprio em `src/styles/tokens.css` |
| Lucide React | Ícones |
| Recharts | Dependência instalada; uso deve ser verificado por tela |
| html2canvas | Suporte a exportação/captura |
| jsPDF | Exportação PDF |
| xlsx | Exportação/importação de planilhas; possui vulnerabilidade alta sem fix pelo npm audit |

## Backend

| Tecnologia | Função |
|---|---|
| Node.js | Runtime |
| Express 4 | Framework HTTP |
| mysql2/promise | Driver MySQL com promises e pool |
| jsonwebtoken | Geração e validação de JWT |
| bcrypt | Verificação/hash de senha |
| dotenv | Variáveis de ambiente |
| cors | Controle de origem permitida |
| helmet | Headers de segurança |
| express-validator | Validação de payload |
| express-rate-limit | Rate limit do login |
| express-async-errors | Captura de erros async |
| swagger-jsdoc | Geração de especificação Swagger |
| swagger-ui-express | UI de documentação em `/api/docs` |
| nodemon | Hot reload em desenvolvimento |

## Banco

| Tecnologia | Função |
|---|---|
| MySQL 8.4 | Banco relacional |
| InnoDB | Engine transacional |
| Triggers | Auditoria automática |
| Constraints | Integridade de quantidade, chaves e enums |
| SQL direto | Controle explícito de consultas e transações |
| PostgreSQL 16 | Banco das provas de conceito do 4º período (Docker Compose), alvo da migração |

## Ferramentas

- npm para dependências e scripts.
- Git para versionamento.
- Swagger UI para exploração da API.
- Scripts SQL versionados em `database/`.

## Build

Frontend:

```bash
cd stockflow-frontend
npm run build
```

Backend:

```bash
cd stockflow-api
npm start
```

Raiz:

```bash
npm run dev
```

## Deploy

Modelo esperado:

- Frontend gerado em `stockflow-frontend/dist`.
- API Node executando com `.env` configurado.
- MySQL acessível pela API.
- `ALLOWED_ORIGINS` configurado para CORS.
- `VITE_API_URL` configurado no build do frontend.

## Observações Técnicas

- A API exige `JWT_SECRET` e configuração de banco ao iniciar.
- `src/config/database.js` usa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` e `DB_NAME`.
- O schema principal precisa ser revisado para incluir `inventario` se o módulo continuar ativo.
