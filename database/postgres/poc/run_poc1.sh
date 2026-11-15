#!/bin/bash
set -e
cd "$(dirname "$0")/../../.."

PSQL="${PSQL:-docker compose exec -T postgres psql}"
ADMIN="${POSTGRES_USER:-stockflow_admin}"
DB="${POSTGRES_DB:-stockflow}"
POC="database/postgres/poc"

$PSQL -v ON_ERROR_STOP=1 -U "$ADMIN" -d "$DB" -q < "$POC/00_dados_poc.sql"
echo "== PoC 1: auditoria =="
cat "$POC/poc_funcoes.sql" "$POC/poc1_auditoria.sql" | $PSQL -v ON_ERROR_STOP=1 -U stockflow_app -d "$DB" -q
echo "== PoC 1: permissões e restrições =="
cat "$POC/poc_funcoes.sql" "$POC/poc1_permissoes_restricoes.sql" | $PSQL -v ON_ERROR_STOP=1 -U stockflow_app -d "$DB" -q
echo "PoC 1: OK"
