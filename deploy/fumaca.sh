#!/bin/bash
cd "$(dirname "$0")"
HTTPS_PORTA=$(grep '^HTTPS_PORTA=' .env | cut -d= -f2)
HTTP_PORTA=$(grep '^HTTP_PORTA=' .env | cut -d= -f2)
DEMO_URL="https://localhost:${HTTPS_PORTA}" DEMO_HTTP_URL="http://localhost:${HTTP_PORTA}" NODE_EXTRA_CA_CERTS="$(pwd)/certs/demo.crt" node fumaca.mjs
