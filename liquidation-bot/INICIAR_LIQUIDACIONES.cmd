@echo off
setlocal
cd /d "%~dp0"
title Liquidation Bot - Binance (panel en http://127.0.0.1:8080)

echo ==============================================
echo   LIQUIDATION BOT - arrancando...
echo ==============================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creando entorno Python (solo la primera vez, tarda ~1 min)...
  py -3.12 -m venv .venv || py -m venv .venv
)

echo [2/3] Verificando dependencias...
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt

if not exist ".env" copy ".env.example" ".env" >nul

echo [3/3] Abriendo el panel en el navegador en 5 segundos...
echo       (si no abre solo, entra a http://127.0.0.1:8080)
echo.
echo   Para DETENER el bot: cierra esta ventana o presiona Ctrl+C
echo.
start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://127.0.0.1:8080"

".venv\Scripts\python.exe" main.py

echo.
echo El bot se detuvo. Presiona una tecla para cerrar esta ventana.
pause >nul
endlocal
