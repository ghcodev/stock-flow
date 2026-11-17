# Arquitetura do StockFlow v3.0

> Este documento descreve a v3.0. O protótipo anterior (React 18, Express 4, MySQL, pastas `stockflow-api` e `stockflow-frontend`) não é descrito aqui. Veja o [`README.md`](README.md) para subir o sistema.

## Visão geral

```
navegador ── HTTPS ──> Nginx ──(/api/, sem o prefixo)──> API (Node + Express) ──> PostgreSQL 16
                        └── arquivos estáticos do frontend (React, Vite)
```

Na demonstração (`deploy/docker-compose.yml`) são três contêineres na mesma rede interna: `postgres`, `api` e `web` (Nginx). Só o Nginx publica portas (8443 HTTPS e 8080 para o redirecionamento). Em desenvolvimento não há Nginx: o Vite serve o frontend em `localhost:5173` e repassa `/api` para a API em `localhost:3000`, removendo o prefixo.

## Frontend (`frontend/`)

- React 19, TypeScript estrito, Vite 8 e React Router 7. Nenhuma biblioteca de UI, gráficos, formulários, estado, datas ou requisições: o cliente da API usa `fetch` nativo.
- Cada tela é uma rota; com exceção do Dashboard e do login, as telas são carregadas sob demanda (`import()` dinâmico do Vite), cada uma dentro de uma barreira de erros.
- Padrões centrais: carga de dados em que só a última consulta vale; envio único em toda escrita; listas com cursor do servidor e janela de 300 itens renderizados; decimais como texto e `BigInt` para somar, subtrair e comparar saldos; datas de análise exibidas em UTC.
- Gráficos em SVG puro; a cena 3D do login é CSS puro. Detalhes e limites em [`frontend/README.md`](frontend/README.md).

## API (`backend/`)

- Node 22, Express 5, Prisma 7 com o adaptador `pg`. Camadas: rotas, validadores (`express-validator`), controladores, serviços e acesso ao banco.
- Toda rota, exceto `GET /health` e `POST /auth/login`, exige JWT (HS256, 8 horas); rotas de administrador usam um middleware de perfil. O backend é a autoridade das permissões.
- Escritas em transação: o lote é travado (`FOR UPDATE`), o saldo é conferido e a movimentação é gravada com `saldo_anterior` e `saldo_posterior`. A sessão do banco recebe `app.user_id` e `app.ip` para que as triggers registrem o autor.
- Agendador: marca lotes com validade vencida como `vencido` (ligado por `AGENDADOR_ATIVO=true`, em uma única réplica).
- Encerramento limpo em `SIGTERM`/`SIGINT` (fecha o servidor, desconecta o banco).
- Contratos e decisões: [`backend/README.md`](backend/README.md); rotas: [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md).

## Banco de dados (`database/postgres/init`)

- `01_esquema.sql`: tabelas `produto`, `localizacao`, `usuario`, `lote`, `identificacao`, `movimentacao` e `auditoria_log`, com `CHECK` de saldo não negativo, validade, transferência e quantidade; chaves estrangeiras com `RESTRICT`.
- `02_triggers.sql`: auditoria de `lote`, `movimentacao` (inserção e mudança de status) e `usuario`, sem gravar `senha_hash`; e o bloqueio de saída de lote vencido, expirado ou bloqueado.
- `03_roles.sh`: papel `stockflow_app` com privilégios mínimos. Ele só insere em `movimentacao` e `auditoria_log` e só atualiza o status da movimentação; não altera nem apaga a auditoria.
- `04_indices.sql`: índices de auditoria (por usuário, por tabela) e de movimentação por data.
- `05_hoje_operacional.sql`: função `hoje_operacional()` (dia de `America/Sao_Paulo`) e o trigger de bloqueio de saída usando-a. É a única fonte do "hoje" das regras de validade, usada pelo trigger e pela API; as janelas do dashboard começam e terminam à meia-noite de São Paulo.
- Dados de demonstração: `deploy/demo/seed_demo.sql` (só no Compose da demonstração; nunca no banco de desenvolvimento).

## Fluxos principais

- **Entrada, saída, transferência:** o cliente envia a operação; o serviço trava o lote, valida regras (lote ativo, saldo suficiente, destino diferente) e grava a movimentação e o novo saldo na mesma transação.
- **Ajuste (administrador):** o cliente envia o saldo que estava na tela; se o saldo mudou desde então a API responde `409 SALDO_DESATUALIZADO` e nada é gravado.
- **Inventário rotativo:** a contagem nasce *pendente* e não altera o saldo; o administrador finaliza (a divergência é somada ao saldo atual e gera um ajuste) ou cancela.
- **Auditoria:** as triggers gravam valor anterior e novo, autor e IP; a aplicação só lê.
- **Alertas:** vencimento em até 30 dias, estoque abaixo do mínimo e exportação CSV de vencimentos (administrador).

## Decisões e limites

- Saldos em `NUMERIC(12,3)` trafegam como texto; o servidor não usa ponto flutuante para saldo.
- A configuração de proxy confiável da API (`trust proxy 1`) pressupõe exatamente um proxy na frente, que sobrescreve `X-Forwarded-For`; o Nginx da demonstração faz isso.
- A conexão com leitor serial (Web Serial) existe no frontend e nunca foi testada com hardware real.
- A arquitetura foi exercitada na demonstração em Docker; não há implantação em um ambiente de produção real descrita ou testada neste repositório.
