#!/bin/bash
set -e
cd "$(dirname "$0")/../../.."

PSQL="${PSQL:-docker compose exec -T postgres psql}"
ADMIN="${POSTGRES_USER:-stockflow_admin}"
DB="${POSTGRES_DB:-stockflow}"
POC="database/postgres/poc"

$PSQL -U "$ADMIN" -d "$DB" -q < "$POC/00_dados_poc.sql"
echo "== PoC 1: auditoria =="
$PSQL -U stockflow_app -d "$DB" < "$POC/poc1_auditoria.sql"
echo "== PoC 1: permissões e restrições =="
$PSQL -U stockflow_app -d "$DB" < "$POC/poc1_permissoes_restricoes.sql"
