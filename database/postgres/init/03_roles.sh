#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -v dbname="$POSTGRES_DB" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
CREATE ROLE stockflow_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"dbname" TO stockflow_app;
GRANT USAGE ON SCHEMA public TO stockflow_app;
GRANT SELECT, INSERT, UPDATE ON produto, localizacao, usuario, lote, identificacao TO stockflow_app;
GRANT SELECT, INSERT ON movimentacao, auditoria_log TO stockflow_app;
EOSQL
