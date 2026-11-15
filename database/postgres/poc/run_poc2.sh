#!/bin/bash
cd "$(dirname "$0")/../../.."

PSQL="${PSQL:-docker compose exec -T postgres psql}"
ADMIN="${POSTGRES_USER:-stockflow_admin}"
DB="${POSTGRES_DB:-stockflow}"
POC="database/postgres/poc"
LOG_A="$(mktemp)"
LOG_B="$(mktemp)"
FALHAS=0

verificar() {
  if [ "$2" = "$3" ]; then
    echo "OK: $1"
  else
    echo "FALHA: $1 (esperado '$3', obtido '$2')"
    FALHAS=$((FALHAS + 1))
  fi
}

$PSQL -v ON_ERROR_STOP=1 -U "$ADMIN" -d "$DB" -q < "$POC/00_dados_poc.sql" || exit 1
echo "== PoC 2: duas saídas simultâneas de 50 unidades no lote L-002 (saldo 70) =="
$PSQL -U stockflow_app -d "$DB" -q -v ON_ERROR_STOP=1 -v ip=10.0.0.1 < "$POC/poc2_saida.sql" > "$LOG_A" 2>&1 &
PID_A=$!
$PSQL -U stockflow_app -d "$DB" -q -v ON_ERROR_STOP=1 -v ip=10.0.0.2 < "$POC/poc2_saida.sql" > "$LOG_B" 2>&1 &
PID_B=$!
RC_A=0
RC_B=0
wait $PID_A || RC_A=$?
wait $PID_B || RC_B=$?
echo "-- Sessão A (código $RC_A)"; cat "$LOG_A"
echo "-- Sessão B (código $RC_B)"; cat "$LOG_B"

CONCLUIDAS=0
RECUSADAS=0
for par in "$RC_A:$LOG_A" "$RC_B:$LOG_B"; do
  RC="${par%%:*}"
  LOG="${par#*:}"
  if [ "$RC" -eq 0 ] && grep -q "Saída concluída" "$LOG"; then CONCLUIDAS=$((CONCLUIDAS + 1)); fi
  if [ "$RC" -ne 0 ] && grep -q "Saldo insuficiente" "$LOG"; then RECUSADAS=$((RECUSADAS + 1)); fi
done
rm -f "$LOG_A" "$LOG_B"

SALDO=$($PSQL -U "$ADMIN" -d "$DB" -At -c "SELECT quantidade::numeric FROM lote WHERE numero_lote = 'L-002';" | tr -d '\r')
SAIDAS=$($PSQL -U "$ADMIN" -d "$DB" -At -c "SELECT count(*) FROM movimentacao m JOIN lote l ON l.id_lote = m.id_lote WHERE l.numero_lote = 'L-002' AND m.tipo_movimentacao = 'saida' AND m.status_movimentacao = 'concluida';" | tr -d '\r')

echo "== Verificações =="
verificar "uma sessão concluiu a saída" "$CONCLUIDAS" "1"
verificar "uma sessão foi recusada por saldo insuficiente" "$RECUSADAS" "1"
verificar "saldo final do lote L-002" "$SALDO" "20.000"
verificar "saídas confirmadas no lote L-002" "$SAIDAS" "1"

if [ "$FALHAS" -ne 0 ]; then
  echo "PoC 2: FALHOU ($FALHAS verificação(ões))"
  exit 1
fi
echo "PoC 2: OK"
