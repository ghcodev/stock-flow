#!/bin/bash
cd "$(dirname "$0")" || exit 1
set -a
. ./.env
set +a
docker compose -p stockflow-demo exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X < demo/verificar_invariantes.sql
exit $?
