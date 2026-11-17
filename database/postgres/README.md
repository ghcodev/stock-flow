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

As verificações são automáticas: cada condição esperada vira uma assertion (resultado ou SQLSTATE) e o script termina com código diferente de zero se alguma falhar. Em caso de sucesso, imprime `PoC 1: OK`.

O que é verificado:

- a saída de 30 unidades do lote L-001 gera dois registros em `auditoria_log` (lote de 100 para 70 e a movimentação), com o usuário e o IP definidos por `set_config`;
- a mudança de `status_movimentacao` para `cancelada` gera um registro `UPDATE` em `auditoria_log` com status anterior e novo, usuário e IP;
- após o `COMMIT`, `app.user_id` volta vazio;
- o JSONB dos registros de `usuario` não contém `senha_hash`;
- `UPDATE` e `DELETE` em `auditoria_log` com `stockflow_app` retornam `permission denied` (SQLSTATE 42501), assim como `UPDATE` de `quantidade` e `DELETE` em `movimentacao`;
- o banco recusa saída de lote bloqueado, saída de lote ativo com validade expirada, transferência com origem igual ao destino e saída com quantidade zero (SQLSTATE P0001 para a trigger e 23514 para os CHECKs), e aceita inventário com contagem zero.

## PoC 2 – Concorrência nas saídas

```bash
./database/postgres/poc/run_poc2.sh
```

Duas sessões pedem ao mesmo tempo 50 unidades do lote L-002, que tem saldo 70. Verificações automáticas, com código de saída diferente de zero em caso de falha e `PoC 2: OK` em caso de sucesso: exatamente uma sessão conclui a saída (70 para 20) e a outra espera a trava de `SELECT ... FOR UPDATE`, lê o saldo atualizado e é recusada com "Saldo insuficiente". O saldo final é 20 e há exatamente uma saída concluída no lote.

## Ajustes da Etapa 1 (v3.0)

- Índices GIN de `auditoria_log` (`valor_anterior`, `valor_novo`) usam `jsonb_path_ops`; filtros em campos internos usam o operador `@>`.
- Novos índices B-tree: `idx_auditoria_data_hora` em `auditoria_log(data_hora)` e `idx_movimentacao_lote_data` em `movimentacao(id_lote, data_movimentacao)`. O esquema passa a ter 7 tabelas, 7 tipos ENUM, 16 índices, 2 funções e 4 triggers.
- `fn_bloquear_saida` também recusa saída de lote com `data_validade` anterior ao dia operacional, mesmo com status `ativo`. O dia vem de `hoje_operacional()` (dia de `America/Sao_Paulo`, `init/05_hoje_operacional.sql`), não do `current_date` da sessão.
- `stockflow_app` recebe `GRANT UPDATE (status_movimentacao) ON movimentacao`, para cancelar movimentações e controlar contagens pendentes de inventário. Nenhuma outra coluna de `movimentacao` é atualizável.
- `trg_auditoria_movimentacao` passou a ser `AFTER INSERT OR UPDATE OF status_movimentacao`: cancelar ou concluir uma movimentação fica na auditoria com autor, IP, valor anterior e novo. A permissão continua restrita à coluna.
- `movimentacao.id_lote` declara `ON DELETE RESTRICT` (RNF03), como `id_usuario`.
- `.gitattributes` fixa fim de linha LF em `database/postgres/**/*.sh`, `database/postgres/**/*.sql` e `docker-compose.yml`, para os scripts rodarem no contêiner mesmo com `core.autocrlf=true`.
- As PoCs 1 e 2 viraram verificações automáticas (ver acima). As funções auxiliares ficam em `poc/poc_funcoes.sql`.
- A PoC 1 ganhou o caso de saída de lote ativo com validade expirada, que o banco recusa com "Saída não permitida para lote vencido, com validade expirada ou bloqueado".

## Dados de desenvolvimento

`seed_dev.sql` fica fora de `init/` e não roda sozinho. Depois de subir o banco:

```bash
docker compose exec -T postgres psql -U stockflow_admin -d stockflow < database/postgres/seed_dev.sql
```

O script pode ser repetido sem duplicar dados. Cria 2 usuários, 6 localizações, 5 produtos e 7 lotes (ativos, um vencendo em menos de 30 dias, um vencido, um bloqueado e um abaixo do estoque mínimo), com uma movimentação de entrada por lote para o saldo bater com o histórico. As PoCs apagam todas as tabelas; rode o seed de novo depois delas.

Credenciais de desenvolvimento (hash bcrypt com custo 12; não usar fora do ambiente local):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@stockflow.dev | Admin@Dev2026 |
| Operador | operador@stockflow.dev | Operador@Dev2026 |
