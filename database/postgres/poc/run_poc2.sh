#!/bin/bash
set -e
cd "$(dirname "$0")/../../.."

PSQL="${PSQL:-docker compose exec -T postgres psql}"
ADMIN="${POSTGRES_USER:-stockflow_admin}"
DB="${POSTGRES_DB:-stockflow}"
POC="database/postgres/poc"
LOG_A="$(mktemp)"
LOG_B="$(mktemp)"

$PSQL -U "$ADMIN" -d "$DB" -q < "$POC/00_dados_poc.sql"
echo "== PoC 2: duas saídas simultâneas de 50 unidades no lote L-002 (saldo 70) =="
$PSQL -U stockflow_app -d "$DB" -q -v ip=10.0.0.1 < "$POC/poc2_saida.sql" > "$LOG_A" 2>&1 &
$PSQL -U stockflow_app -d "$DB" -q -v ip=10.0.0.2 < "$POC/poc2_saida.sql" > "$LOG_B" 2>&1 &
wait || true
echo "-- Sessão A"; cat "$LOG_A"
echo "-- Sessão B"; cat "$LOG_B"
rm -f "$LOG_A" "$LOG_B"
$PSQL -U "$ADMIN" -d "$DB" -c "SELECT numero_lote, quantidade FROM lote WHERE numero_lote = 'L-002';"
