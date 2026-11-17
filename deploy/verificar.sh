#!/bin/bash
cd "$(dirname "$0")"
set -a
. ./.env
set +a
docker compose -p stockflow-demo exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X < demo/verificar_invariantes.sql
