@echo off
REM Registra el servidor de terminal en Claude Code (Windows).
setlocal
set "AQUI=%~dp0"
set "SERVIDOR=%AQUI%servidor_terminal_mcp.js"
set "NOMBRE=terminal-local"

echo == Comprobando requisitos ==
where node >nul 2>&1 || (echo ERROR: no encuentro node en el PATH. & pause & exit /b 1)
where claude >nul 2>&1 || (echo ERROR: no encuentro claude en el PATH. & pause & exit /b 1)
if not exist "%SERVIDOR%" (echo ERROR: no encuentro "%SERVIDOR%" & pause & exit /b 1)

echo == Registrando en Claude Code ==
call claude mcp remove %NOMBRE% --scope user >nul 2>&1
call claude mcp add %NOMBRE% --scope user -- node "%SERVIDOR%"

echo.
call claude mcp list
echo.
echo Listo. Abre Claude Code con "claude" y comprueba con /mcp.
pause
