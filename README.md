# StockFlow v3.0

Gestão de estoque com rastreabilidade por lote para a Arte Trigo: lotes, localizações físicas, movimentações transacionais, inventário rotativo, alertas de vencimento e auditoria de operações.

Projeto Integrador · UniEVANGÉLICA · 2026.

## Sumário

- [Subir a demonstração](#subir-a-demonstração)
- [Arquitetura](#arquitetura)
- [Perfis e permissões](#perfis-e-permissões)
- [Decisões de projeto](#decisões-de-projeto)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Rodar em desenvolvimento](#rodar-em-desenvolvimento)
- [Testes e verificações](#testes-e-verificações)
- [Documentação](#documentação)
- [Divergências conhecidas](#divergências-conhecidas)
- [Equipe](#equipe)

## Subir a demonstração

Pré-requisitos: Docker, `openssl` e um shell bash (no Windows, Git Bash).

```
./deploy/subir.sh      # gera deploy/.env e o certificado local, constrói e sobe tudo
./deploy/derrubar.sh   # derruba os serviços e mantém os dados
```

Depois de subir, abra `https://localhost:8443` (o certificado é autoassinado: aceite a exceção). A porta 8080 só redireciona para o HTTPS. A API e o banco não publicam porta.

Credenciais de demonstração (dados de exemplo, não são segredos reais):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `carlos.matos@stockflow.demo` | `Admin@Demo2026` |
| Operador | `joao.almeida@stockflow.demo` | `Operador@Demo2026` |

Detalhes, lista completa de usuários, o que há nos dados e as verificações estão em [`deploy/README.md`](deploy/README.md). O passo a passo de apresentação de 10 minutos está em [`docs/ROTEIRO_APRESENTACAO.md`](docs/ROTEIRO_APRESENTACAO.md).

## Arquitetura

```
navegador ── HTTPS ──> Nginx ──(/api/, sem o prefixo)──> API (Node + Express) ──> PostgreSQL 16
                        └── arquivos estáticos do frontend (React, Vite)
```

- **Frontend** (`frontend/`): React 19, TypeScript estrito, Vite 8 e React Router 7. Sem biblioteca de UI, de gráficos, de formulários, de estado ou de datas; os gráficos são SVG puro e a cena 3D do login é CSS puro.
- **API** (`backend/`): Node 22, Express 5, Prisma 7 com o adaptador `pg`, JWT (HS256, 8 h), validação com `express-validator`, limite de tentativas no login. Regras de negócio e transações no servidor; saldos em `NUMERIC` tratados como texto.
- **Banco** (`database/postgres/init`): esquema, triggers de auditoria e de bloqueio de saída, papel de aplicação com privilégios mínimos (a aplicação não altera nem apaga a auditoria) e índices.
- **Nginx** (`deploy/nginx`): SPA com `try_files`, proxy `/api/` removendo o prefixo, `X-Forwarded-For` sobrescrito com o endereço real, TLS, HTTP redirecionando para HTTPS, CSP restrita (`default-src 'self'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, gzip e cache longo só para `/assets` com hash.
- **Compose da demonstração** (`deploy/docker-compose.yml`): projeto `stockflow-demo`, volume próprio, TZ `America/Sao_Paulo`, agendador de vencimento ligado em uma única réplica.

## Perfis e permissões

| Área | Operador | Administrador |
| --- | --- | --- |
| Dashboard, Produtos, Lotes, Mapa, Histórico, Rastreabilidade, Vencimentos | sim | sim |
| Entrada, saída, transferência, registrar contagem de inventário | sim | sim |
| Finalizar e cancelar contagem de inventário | não | sim |
| Ajuste de estoque | não | sim |
| Usuários | não | sim |
| Auditoria | não | sim |
| Exportar alertas de vencimento (CSV) | não | sim |
| Meu Perfil (dados e troca da própria senha) | sim | sim |

O backend é a autoridade: o menu, as rotas e os botões do frontend só espelham essas regras.

## Decisões de projeto

- **Decimais como texto.** Quantidades e saldos nunca passam por `parseFloat` em conta de saldo; o frontend usa `BigInt` para somar, subtrair e comparar.
- **Datas.** Dias são datas puras; data e hora das telas de análise aparecem em UTC e rotuladas; a janela de 30 dias do gráfico vem de `data_referencia`, o `current_date` do banco.
- **Escritas nunca são repetidas sozinhas.** Envio único, resposta desconhecida manda conferir o histórico, conflito de saldo recarrega e pede nova confirmação.
- **Listas grandes.** Auditoria, Histórico e Rastreabilidade usam cursor do servidor, e a tela renderiza no máximo 300 itens.
- **Leitor de código.** O leitor que digita como teclado é detectado pela velocidade das teclas; a conexão serial (Web Serial) só existe em Chromium e em HTTPS ou `localhost`.
- **Auditoria imutável.** As triggers registram o autor (`app.user_id`) e o IP de cada operação; o papel da aplicação não tem permissão para alterar a tabela de log.
- **Segurança.** Token só em `sessionStorage`; nenhum HTML vindo da API é renderizado como HTML; CSP restrita; `X-Forwarded-For` do cliente nunca é repassado.

## Estrutura do repositório

```
backend/            API (Node, Express, Prisma), testes e README técnico
frontend/           Aplicação React, testes e README técnico
database/postgres/  Esquema, triggers, papéis e índices (init) e README do banco de desenvolvimento
deploy/             Compose da demonstração, Nginx, dados de demonstração, scripts
docs/               Especificação v3.0 (PDF), manual do usuário e roteiro de apresentação
stockflow-api/ stockflow-frontend/ database/*.sql   protótipo anterior (não faz parte da v3)
```

## Rodar em desenvolvimento

Banco de desenvolvimento (Compose da raiz, volume `pgdata`, porta 5433 só em `127.0.0.1`): veja [`database/postgres/README.md`](database/postgres/README.md). Depois:

```
cd backend  && npm install && npm run dev      # API em http://localhost:3000
cd frontend && npm install && npm run dev      # http://localhost:5173, proxy /api para a API
```

O frontend chama sempre `/api/...`; o proxy do Vite remove o prefixo, como o Nginx faz na demonstração. Variáveis da API: `DATABASE_URL`, `JWT_SECRET` (mínimo de 32 caracteres), `PORT` e `AGENDADOR_ATIVO` (veja `backend/README.md`).

## Testes e verificações

```
cd backend  && npm test        # 307 testes, contra o banco de desenvolvimento
cd frontend && npm test        # 240 testes de lógica pura
./deploy/fumaca.sh             # teste de fumaça contra a demonstração de pé
./deploy/verificar.sh          # invariante de saldo e contagens no banco da demonstração
```

Os testes do backend criam e alteram dados no banco de desenvolvimento (com prefixos próprios); não rode contra um banco com dados que precisem ser preservados.

## Documentação

- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md): rotas, perfis e convenções da API v3.
- [`backend/README.md`](backend/README.md): contratos detalhados e decisões da API.
- [`frontend/README.md`](frontend/README.md): estrutura, decisões, limites e testes do frontend.
- [`deploy/README.md`](deploy/README.md): demonstração em Docker.
- [`docs/ROTEIRO_APRESENTACAO.md`](docs/ROTEIRO_APRESENTACAO.md): roteiro de 10 minutos.
- [`docs/StockFlow_Especificacao_v3.0.pdf`](docs/StockFlow_Especificacao_v3.0.pdf): especificação.

## Divergências conhecidas

- `ARCHITECTURE.md`, `DEPLOYMENT_GUIDE.md`, `SECURITY.md`, `TECH_STACK.md`, `USER_MANUAL.md`, `AUDIT.md` e `PROJECT_MEMORY.md` descrevem o protótipo anterior (React 18, Express 4, MySQL) e **não foram atualizados para a v3**. Valem a especificação v3.0, este README, `API_DOCUMENTATION.md` e os READMEs de `backend/`, `frontend/` e `deploy/`.
- Gráfico de saldo por categoria do Dashboard, em kg: produtos em kg entram direto; unidades de contagem (`un`, `cx`, `rolo`, `pct`) são multiplicadas por `peso_unitario_kg`; litros, outras unidades e produtos de contagem sem peso ficam de fora, e o painel mostra quantos lotes ficaram de fora.
- O certificado da demonstração é autoassinado; em produção real deve ser substituído por um emitido por uma autoridade confiável.

## Equipe

| | Integrante |
|---|---|
| 👤 | Gustavo |
| 👤 | Pedro |
| 👤 | Rayk |
| 👤 | Vinicius |

Projeto Integrador · UniEVANGÉLICA · 2026

---

<div align="center">

© 2026 Arte Trigo · StockFlow · Todos os direitos reservados

</div>
