@echo off
setlocal
title Discordex

cd /d "%~dp0"

echo.
echo ========================================
echo   Discordex - Ambiente de desenvolvimento
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  echo Reinstale o Node.js ou corrija o PATH.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [AVISO] .env.local nao encontrado.
  echo Copie .env.example para .env.local e configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
  echo.
)

if not exist "node_modules" (
  echo Dependencias nao encontradas. Instalando...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
  echo.
)

echo Iniciando Discordex...
echo Abra o endereco exibido pelo Vite no navegador.
echo.

call npm.cmd run dev

if errorlevel 1 (
  echo.
  echo [ERRO] O servidor de desenvolvimento foi encerrado com erro.
  pause
  exit /b 1
)

endlocal
