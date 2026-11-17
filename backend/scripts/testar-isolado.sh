#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
export MSYS_NO_PATHCONV=1

IMAGEM="postgres:16.10"
NOME="stockflow-teste-$(date +%s)-$RANDOM"
RAIZ="$(cd .. && { pwd -W 2>/dev/null || pwd; })"
INICIO=$(date +%s)

limpar() {
  docker rm -f -v "$NOME" >/dev/null 2>&1
}
FILHO=0
encerrar() {
  [ "$FILHO" -ne 0 ] && kill -TERM "$FILHO" 2>/dev/null
  exit 130
}
trap limpar EXIT
trap encerrar INT TERM HUP

rodar() {
  "$@" &
  FILHO=$!
  wait "$FILHO"
  local codigo=$?
  FILHO=0
  return "$codigo"
}

aleatorio() {
  openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$1"
}

export POSTGRES_USER=stockflow_teste
export POSTGRES_DB=stockflow_teste
export POSTGRES_PASSWORD
export APP_DB_PASSWORD
POSTGRES_PASSWORD=$(aleatorio 32)
APP_DB_PASSWORD=$(aleatorio 32)
JWT_SECRET=$(aleatorio 64)

echo "Subindo PostgreSQL descartável ($IMAGEM)"
docker run -d --rm --name "$NOME" \
  -e POSTGRES_USER -e POSTGRES_DB -e POSTGRES_PASSWORD -e APP_DB_PASSWORD \
  --tmpfs /var/lib/postgresql/data \
  -p 127.0.0.1::5432 "$IMAGEM" >/dev/null || exit 1

pronto=0
for _ in $(seq 1 60); do
  if docker exec "$NOME" pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q 2>/dev/null; then
    pronto=1
    break
  fi
  sleep 1
done
if [ "$pronto" -ne 1 ]; then
  echo "O banco descartável não ficou pronto a tempo" >&2
  exit 1
fi

docker cp "$RAIZ/database/postgres/init" "$NOME:/base" >/dev/null || exit 1
docker cp "$RAIZ/database/postgres/seed_dev.sql" "$NOME:/seed_dev.sql" >/dev/null || exit 1

echo "Aplicando database/postgres/init e o seed de desenvolvimento"
docker exec -e POSTGRES_USER -e POSTGRES_DB -e APP_DB_PASSWORD "$NOME" bash -c '
  set -e
  for arquivo in /base/*; do
    case "$arquivo" in
      *.sql) psql -v ON_ERROR_STOP=1 -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$arquivo" >/dev/null ;;
      *.sh) bash "$arquivo" >/dev/null ;;
    esac
  done
  psql -v ON_ERROR_STOP=1 -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /seed_dev.sql >/dev/null
' || { echo "Falha ao preparar o banco descartável" >&2; exit 1; }

PORTA=$(docker port "$NOME" 5432/tcp | head -1)
PORTA="${PORTA##*:}"
export DATABASE_URL="postgresql://stockflow_app:${APP_DB_PASSWORD}@127.0.0.1:${PORTA}/${POSTGRES_DB}"
export JWT_SECRET
export PORT=0
export AGENDADOR_ATIVO=false
export STOCKFLOW_TESTE_ISOLADO=1

echo "Banco descartável pronto em 127.0.0.1:${PORTA}; rodando a suíte"
ARQUIVOS=()
while IFS= read -r arquivo; do
  ARQUIVOS+=("$arquivo")
done < <(find tests -name '*.test.ts' ! -name 'usuarios.ultimo-admin.test.ts' | sort)

rodar node --test "${ARQUIVOS[@]}"
RESULTADO=$?

if [ "$RESULTADO" -eq 0 ]; then
  echo "Rodando sozinho o caso que depende do estado global de administradores"
  rodar node --test tests/usuarios.ultimo-admin.test.ts
  RESULTADO=$?
fi

echo "Duração: $(( $(date +%s) - INICIO )) s; o banco descartável será removido"
exit "$RESULTADO"
