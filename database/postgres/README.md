# Banco PostgreSQL 16 (4º período)

Ambiente usado nas provas de conceito da migração do StockFlow para PostgreSQL. O protótipo atual (API e frontend) continua usando MySQL 8.4.

## Subir o ambiente

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Na primeira subida, o contêiner executa os scripts de `init/` em ordem: esquema físico, triggers e usuário da aplicação (`stockflow_app`), que tem `SELECT` e `INSERT` nas tabelas `movimentacao` e `auditoria_log` e, em `movimentacao`, `UPDATE` somente na coluna `status_movimentacao`. Não há `UPDATE` nem `DELETE` em `auditoria_log`. O banco fica acessível em `localhost:5433`.

Para recriar o banco do zero:

```bash
docker compose down -v
docker compose up -d
```

## PoC 1 – Trigger de auditoria

```bash
./database/postgres/poc/run_poc1.sh
```

Resultado esperado:

- a saída de 30 unidades do lote L-001 gera dois registros em `auditoria_log` (lote de 100 para 70 e a movimentação), com o usuário e o IP definidos por `set_config`;
- após o `COMMIT`, `app.user_id` volta vazio;
- o JSONB dos registros de `usuario` não contém `senha_hash`;
- `UPDATE` e `DELETE` em `auditoria_log` com `stockflow_app` retornam `permission denied`;
- o banco recusa saída de lote bloqueado, saída de lote ativo com validade expirada, transferência com origem igual ao destino e saída com quantidade zero, e aceita inventário com contagem zero.

## PoC 2 – Concorrência nas saídas

```bash
./database/postgres/poc/run_poc2.sh
```

Duas sessões pedem ao mesmo tempo 50 unidades do lote L-002, que tem saldo 70. Resultado esperado: uma sessão conclui a saída (70 para 20) e a outra espera a trava de `SELECT ... FOR UPDATE`, lê o saldo atualizado e é recusada com "Saldo insuficiente". O saldo final é 20.

## Ajustes da Etapa 1 (v3.0)

- Índices GIN de `auditoria_log` (`valor_anterior`, `valor_novo`) usam `jsonb_path_ops`; filtros em campos internos usam o operador `@>`.
- Novos índices B-tree: `idx_auditoria_data_hora` em `auditoria_log(data_hora)` e `idx_movimentacao_lote_data` em `movimentacao(id_lote, data_movimentacao)`. O esquema passa a ter 7 tabelas, 7 tipos ENUM, 16 índices, 2 funções e 4 triggers.
- `fn_bloquear_saida` também recusa saída de lote com `data_validade` anterior a `current_date`, mesmo com status `ativo`.
- `stockflow_app` recebe `GRANT UPDATE (status_movimentacao) ON movimentacao`, para cancelar movimentações e controlar contagens pendentes de inventário. Nenhuma outra coluna de `movimentacao` é atualizável.
- A PoC 1 ganhou o caso de saída de lote ativo com validade expirada, que o banco recusa com "Saída não permitida para lote vencido, com validade expirada ou bloqueado".
