#!/bin/bash
set -e
cd "$(dirname "$0")"

aleatorio() {
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"
}

if [ ! -f .env ]; then
  echo "Gerando .env de demonstração com segredos aleatórios"
  {
    echo "POSTGRES_DB=stockflow_demo"
    echo "POSTGRES_USER=stockflow_demo"
    echo "POSTGRES_PASSWORD=$(aleatorio 32)"
    echo "APP_DB_PASSWORD=$(aleatorio 32)"
    echo "JWT_SECRET=$(aleatorio 64)"
    echo "HTTP_PORTA=8080"
    echo "HTTPS_PORTA=8443"
    echo "PUBLICAR_EM=127.0.0.1"
  } > .env
fi

if [ ! -f certs/demo.crt ] || [ ! -f certs/demo.key ]; then
  echo "Gerando certificado autoassinado local"
  mkdir -p certs
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 90 \
    -keyout certs/demo.key -out certs/demo.crt \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  chmod 600 certs/demo.key
fi

docker compose -p stockflow-demo up -d --build

HTTPS_PORTA=$(grep '^HTTPS_PORTA=' .env | cut -d= -f2)
echo "Aguardando os serviços ficarem saudáveis"
for i in $(seq 1 90); do
  ok=$(docker compose -p stockflow-demo ps --format '{{.Service}} {{.Health}}' | grep -c ' healthy' || true)
  if [ "$ok" -ge 3 ]; then
    echo "Pronto: https://localhost:${HTTPS_PORTA}"
    exit 0
  fi
  sleep 3
done
echo "Os serviços não ficaram saudáveis a tempo. Veja: docker compose -p stockflow-demo logs"
exit 1
