@echo off
rem KALI publico pelo Cloudflare Tunnel (gratis, sem cartao). O PC precisa ficar ligado.
rem 1) liga o servidor do KALI   2) abre o tunel e mostra o link https://....trycloudflare.com
chcp 65001 >nul
cd /d "%~dp0.."

set "CF=cloudflared"
where cloudflared >nul 2>nul || set "CF=%USERPROFILE%\Programas\cloudflared\cloudflared.exe"
if not exist "%CF%" if not "%CF%"=="cloudflared" (
  echo Nao achei o cloudflared. Baixe em:
  echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo e salve como %USERPROFILE%\Programas\cloudflared\cloudflared.exe
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install --omit=dev
)

echo Ligando o servidor do KALI na porta 3333...
set NODE_ENV=production
set PORT=3333
start "KALI servidor" /min cmd /c "node server.js > kali-servidor.log 2>&1"
timeout /t 3 /nobreak >nul

echo.
echo Abrindo o tunel. Procure a linha com https://....trycloudflare.com - esse e o link do KALI.
echo (Fechar esta janela desliga o link. O link muda toda vez que voce liga.)
echo.
"%CF%" tunnel --url http://localhost:3333
