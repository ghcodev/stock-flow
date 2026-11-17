#!/bin/bash
set -e

for arquivo in /base/*.sql; do
  echo "Aplicando $arquivo"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$arquivo"
done

bash /base/03_roles.sh

echo "Carregando os dados de demonstração"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /demo/seed_demo.sql
