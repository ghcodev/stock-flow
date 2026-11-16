# StockFlow v3.0 — Frontend

SPA em React 19 + TypeScript (strict) + Vite 8 + React Router 7. Sem biblioteca de UI, de gráficos, de formulários, de estado, de datas nem de requisições: o cliente da API usa `fetch` nativo e os gráficos são SVG puro.

## Requisitos

Node 22.18 ou superior (o mesmo do backend). Dependências com versão exata (`npm install --save-exact`).

## Rodar em desenvolvimento

```
npm install
npm run dev
```

O Vite sobe em `http://localhost:5173`. O cliente chama sempre `/api/...`; o proxy do Vite repassa para a API local removendo o prefixo `/api` (por exemplo `/api/health` vira `GET /health`). O alvo padrão é `http://127.0.0.1:3000`; para outro, defina `API_ALVO` antes de subir o Vite. O prefixo existe só na borda: o backend não muda e não precisa de CORS, porque navegador e API ficam na mesma origem. Em produção o Nginx faz o mesmo papel do proxy (Etapa 4).

## Scripts

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: `tsc --noEmit` e `vite build` (saída em `dist/`).
- `npm run typecheck`: só a checagem de tipos.
- `npm test`: `node:test` sobre a lógica pura em `.ts` (cliente da API, sessão, permissões). Componentes e CSS não têm teste automatizado: são conferidos no navegador e pelo roteiro da auditoria de frontend.

## Regras do projeto

- Nenhuma cor literal fora de `src/estilos/tokens.css` (exceção: `public/favicon.svg`, que não enxerga variáveis CSS).
- Token JWT só em `sessionStorage`; nunca em log.
- Toda tela é protegida por padrão; o menu e as rotas seguem os perfis, mas o backend é a autoridade.
- Sem `dangerouslySetInnerHTML` com dado da API, sem `any`, sem `console.log`.
