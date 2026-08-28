@echo off
rem =====================================================================
rem Lanzador de PUENTE_DOS_IAS.ps1  (v4)
rem Los dos archivos tienen que estar en la MISMA carpeta.
rem
rem   ARRANCAR_PUENTE.cmd            -> bucle normal, cada 10 min, SI envia
rem   ARRANCAR_PUENTE.cmd LISTAR     -> solo dice que ventanas hay
rem   ARRANCAR_PUENTE.cmd CALIBRAR   -> le ensenas donde esta cada caja
rem   ARRANCAR_PUENTE.cmd PRUEBA     -> escribe y verifica, NO envia
rem
rem ORDEN RECOMENDADO LA PRIMERA VEZ:  LISTAR -> CALIBRAR -> PRUEBA -> normal
rem
rem ESTA VENTANA NO SE CIERRA SOLA.
rem =====================================================================

title PUENTE DOS IAS
cd /d "%~dp0"

set "PS1=%~dp0PUENTE_DOS_IAS.ps1"
set "MODO="
if /I "%~1"=="LISTAR"   set "MODO=-Listar"
if /I "%~1"=="CALIBRAR" set "MODO=-Calibrar"
if /I "%~1"=="PRUEBA"   set "MODO=-Prueba"

echo.
echo  Carpeta : %~dp0
if defined MODO (echo  Modo    : %MODO%) else (echo  Modo    : bucle normal ^(SI envia^))
echo.

if not exist "%PS1%" (
    echo  ERROR: no encuentro PUENTE_DOS_IAS.ps1 en esta carpeta.
    echo  Los dos archivos tienen que estar juntos.
    echo.
    goto FIN
)

rem Windows bloquea los ficheros descargados; esto lo desmarca.
powershell.exe -NoProfile -Command "try { Unblock-File -Path '%PS1%' -ErrorAction SilentlyContinue } catch { }" >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Sta -File "%PS1%" %MODO%
set "RC=%ERRORLEVEL%"

echo.
echo  ---------------------------------------------
echo   PowerShell termino con codigo: %RC%
if "%RC%"=="9009" echo   9009 = no se encontro powershell.exe en el PATH.
echo  ---------------------------------------------

:FIN
echo.
pause
