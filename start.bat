@echo off
title StockFlow

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   StockFlow - Iniciando o sistema...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo Iniciando backend...
start "StockFlow Backend" cmd /k "cd stockflow-api && npm run dev"

echo Aguardando backend (5s)...
timeout /t 5 /nobreak > nul

echo Iniciando frontend...
start "StockFlow Frontend" cmd /k "cd stockflow-frontend && npm run dev"

echo Aguardando frontend (8s)...
timeout /t 8 /nobreak > nul

echo Abrindo navegador...
start http://localhost:5173/login

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   StockFlow rodando!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000/api/v1
echo   Login:    admin@stockflow.com
echo   Senha:    Admin@1234
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pause
