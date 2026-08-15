@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JEAN_FLOW - Certificacion completa con BTCUSDT (un clic)
echo ============================================================
echo  CERTIFICACION COMPLETA CON BTCUSDT - JEAN_FLOW 555
echo.
echo  Este archivo arranca la certificacion (10 + 30 + 120 min)
echo  con el simbolo BTCUSDT ya elegido. No tienes que escribir
echo  NADA: ni el modo, ni el simbolo. Cero dedazos.
echo.
echo  ANTES DE SEGUIR:
echo   - Laptop ENCHUFADA a la corriente.
echo   - Cierra lo que puedas (navegador, YouTube, Excel).
echo   - Cuando arranque: NO uses la laptop ~3 horas.
echo   - NO hagas clic dentro de esta ventana negra
echo     (seleccionar texto CONGELA la captura).
echo   - Lo mas facil: arrancalo y vete a dormir.
echo ============================================================
echo.
set "JF_RUTA=%TEMP%\jf_ruta_iniciar.txt"
if exist "%JF_RUTA%" del "%JF_RUTA%" >nul 2>&1
set "PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='=='+'CARGA'+'=='; $i=$t.IndexOf($m); if($i -lt 0){Write-Host 'FALLO interno: no encontre el bloque de trabajo.'; exit 9}; $p=Join-Path $env:TEMP 'jf_elegir_instalacion.ps1'; [IO.File]::WriteAllText($p,$t.Substring($i+$m.Length)); & $p"
if not exist "%JF_RUTA%" (
  echo.
  echo No se pudo elegir la instalacion. Nada fue iniciado.
  echo Toma captura de esta ventana y enviala a Claude.
  pause
  exit /b 1
)
set "JF_INICIAR="
for /f "usebackq delims=" %%R in ("%JF_RUTA%") do set "JF_INICIAR=%%R"
del "%JF_RUTA%" >nul 2>&1
if not defined JF_INICIAR (
  echo.
  echo No se pudo elegir la instalacion. Nada fue iniciado.
  pause
  exit /b 1
)
echo.
echo Arrancando: "%JF_INICIAR%"
echo Modo: 3 (certificacion completa)   Simbolo: BTCUSDT
echo.
echo A partir de AQUI: manos fuera de la laptop.
echo.
call "%JF_INICIAR%" --mode full --symbol BTCUSDT
set "JF_EXIT=%ERRORLEVEL%"
echo.
echo ------------------------------------------------------------
echo  Termino con codigo %JF_EXIT%.
echo  SIGUIENTE PASO: doble clic a RECOGER_EVIDENCIA_TODO.cmd
echo  y sube al chat el ZIP que quede en tu Escritorio.
echo ------------------------------------------------------------
pause
exit /b %JF_EXIT%
rem ==CARGA==
# jf_elegir_instalacion.ps1 - elige la instalacion de JEAN_FLOW con el motor
# mas nuevo bajo C:\JF y escribe la ruta de su INICIAR.cmd en
# %TEMP%\jf_ruta_iniciar.txt. NO inicia nada ni modifica nada.

$ErrorActionPreference = 'Stop'

function Linea([string]$t) { Write-Host $t }

try {
  $raiz = 'C:\JF'
  if ($env:JF_TEST_JF) { $raiz = $env:JF_TEST_JF }
  if (-not (Test-Path -LiteralPath $raiz)) {
    throw ('No existe la carpeta ' + $raiz + '. Instala JEAN_FLOW primero.')
  }
  Linea ('Buscando instalaciones de JEAN_FLOW bajo ' + $raiz + ' ...')
  $candidatos = @(
    Get-ChildItem -LiteralPath $raiz -Recurse -Depth 8 -Force `
      -Filter 'INICIAR.cmd' -ErrorAction SilentlyContinue |
      Where-Object {
        (-not $_.PSIsContainer) -and
        (Test-Path -LiteralPath (Join-Path $_.DirectoryName 'jean_flow_launcher.py')) -and
        (Test-Path -LiteralPath (Join-Path $_.DirectoryName 'binance_phase1_collector'))
      }
  )
  if ($candidatos.Count -eq 0) {
    throw ('No encontre ninguna instalacion completa de JEAN_FLOW bajo ' + $raiz + '.')
  }

  $conVersion = @()
  foreach ($c in $candidatos) {
    $version = [version]'0.0'
    try {
      $texto = [IO.File]::ReadAllText($c.FullName)
      $m = [regex]::Match($texto, 'title\s+JEAN_FLOW\s+([0-9]+(?:\.[0-9]+)+)')
      if ($m.Success) { $version = [version]$m.Groups[1].Value }
    } catch { }
    $conVersion += [pscustomobject]@{
      ruta = $c.FullName
      version = $version
      fecha = $c.LastWriteTime
    }
  }
  $ordenados = @(
    $conVersion | Sort-Object `
      @{ Expression = { $_.version }; Descending = $true }, `
      @{ Expression = { $_.fecha }; Descending = $true }
  )
  $elegida = $ordenados[0]

  Linea ('Instalaciones encontradas: ' + $conVersion.Count)
  foreach ($c in $ordenados) {
    $marca = '   '
    if ($c.ruta -eq $elegida.ruta) { $marca = ' > ' }
    Linea ($marca + 'v' + $c.version.ToString() + '  ' + $c.ruta)
  }
  if ($elegida.version -lt [version]'2.3.9') {
    Linea ''
    Linea 'AVISO: el motor mas nuevo que encontre es anterior a 2.3.9.'
    Linea 'La certificacion puede fallar por el pico de arranque.'
  }
  Linea ''
  Linea ('Elegida: ' + $elegida.ruta)

  # La ruta se escribe en UTF-8 SIN BOM: el .cmd corre con chcp 65001 y un
  # BOM le llegaria pegado al primer caracter de la ruta.
  if (-not (Test-Path -LiteralPath $env:TEMP)) {
    New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
  }
  $destino = Join-Path $env:TEMP 'jf_ruta_iniciar.txt'
  [IO.File]::WriteAllText($destino, $elegida.ruta, (New-Object Text.UTF8Encoding($false)))
} catch {
  Linea ''
  Linea ('ERROR: ' + $_.Exception.Message)
  Linea 'No se inicio nada.'
}
