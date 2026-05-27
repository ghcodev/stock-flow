#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Arte Trigo — Iniciando o sistema..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar MySQL
echo "Verificando MySQL..."
if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
  echo "MySQL nao esta rodando. Iniciando..."
  if command -v brew &>/dev/null; then
    brew services start mysql
  fi
  if command -v systemctl &>/dev/null; then
    sudo systemctl start mysql
  fi
  sleep 3
fi
echo "MySQL OK"

# Liberar portas
echo "Liberando portas..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1
echo "Portas liberadas"

# Iniciar backend
echo "Iniciando backend..."
cd stockflow-api
npm run dev &
BACKEND_PID=$!
cd ..

# Aguardar backend
echo "Aguardando backend..."
for i in {1..15}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Backend rodando em http://localhost:3000"
    break
  fi
  sleep 1
done

# Iniciar frontend
echo "Iniciando frontend..."
cd stockflow-frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Aguardar frontend
echo "Aguardando frontend..."
for i in {1..20}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "Frontend rodando em http://localhost:5173"
    break
  fi
  sleep 1
done

sleep 2

# Abrir navegador
echo "Abrindo navegador..."
if command -v open &>/dev/null; then
  open "http://localhost:5173/login"
fi
if command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:5173/login"
fi
if command -v cmd.exe &>/dev/null; then
  cmd.exe /c start "http://localhost:5173/login"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Arte Trigo esta rodando!"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000/api/v1"
echo ""
echo "  Login: carlos.matos@artetrigo.com.br"
echo "  Senha: Admin@1234"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Pressione Ctrl+C para encerrar tudo."
echo ""

trap "echo 'Encerrando...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
