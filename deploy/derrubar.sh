#!/bin/bash
set -e
cd "$(dirname "$0")"
docker compose -p stockflow-demo down
echo "Serviços parados. O volume stockflow_demo_pgdata foi mantido."
