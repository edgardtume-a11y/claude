@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JEAN_FLOW - Arreglar el reloj de Windows (un clic)
echo ============================================================
echo  ARREGLAR EL RELOJ DE WINDOWS - JEAN_FLOW 555
echo.
echo  Tu reloj quedo desviado despues del reinicio y por eso
echo  JEAN_FLOW se niega a capturar (los datos necesitan hora
echo  exacta). Esto lo pone en hora usando la herramienta que
echo  ya viene dentro del propio programa.
echo.
echo  Que va a pasar:
echo   1. Windows te pedira permiso una sola vez (ventana azul).
echo      Dale SI. Es solo para poner la hora.
echo   2. El equipo se conecta a los servidores de hora publicos
echo      y espera a que el reloj quede dentro de 50 ms.
echo   3. Puede tardar entre 1 y 8 minutos. NO cierres la ventana.
echo.
echo  Se guarda un respaldo de tu configuracion anterior en
echo  C:\ProgramData\JEAN_FLOW\time-sync (es reversible).
echo ============================================================
echo.
set "PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='=='+'CARGA'+'=='; $i=$t.IndexOf($m); if($i -lt 0){Write-Host 'FALLO interno: no encontre el bloque de trabajo.'; exit 9}; $p=Join-Path $env:TEMP 'jf_arreglar_reloj.ps1'; [IO.File]::WriteAllText($p,$t.Substring($i+$m.Length)); & $p"
echo.
echo ------------------------------------------------------------
echo  Si arriba dice LISTO: abre INICIAR.cmd, opcion 3, Enter,
echo  y NO uses la laptop durante la corrida.
echo  Si dice NO QUEDO: sube al chat el archivo RELOJ_*.txt
echo  que quedo en tu Escritorio.
echo ------------------------------------------------------------
pause
exit /b 0
rem ==CARGA==
# jf_arreglar_reloj.ps1 - pone el reloj de Windows en hora usando la
# herramienta oficial que viaja dentro del paquete JEAN_FLOW
# (Start-W32TimeRepair.ps1 -> Configure-W32Time.ps1, perfil PublicInternet).
# El motor JEAN_FLOW NUNCA se eleva: aqui solo se eleva w32tm/W32Time.

$ErrorActionPreference = 'Stop'

function Linea([string]$t) { Write-Host $t }

function Texto($valor) {
  if ($null -eq $valor) { return '' }
  return [string]$valor
}

$lineas = New-Object System.Collections.Generic.List[string]
$escritorio = [Environment]::GetFolderPath('Desktop')
if ($env:JF_TEST_DESKTOP) { $escritorio = $env:JF_TEST_DESKTOP }
$marca = Get-Date -Format 'yyyyMMdd_HHmmss'
$evidencia = Join-Path $escritorio ('RELOJ_' + $marca + '.txt')

try {
  # ---- 1) Localizar la herramienta dentro de cualquier instalacion
  $raiz = 'C:\JF'
  if ($env:JF_TEST_JF) { $raiz = $env:JF_TEST_JF }
  if (-not (Test-Path -LiteralPath $raiz)) {
    throw ('No existe la carpeta ' + $raiz + '. Instala JEAN_FLOW primero.')
  }
  Linea ('Buscando la herramienta de reloj dentro de ' + $raiz + ' ...')
  $hallados = @(
    Get-ChildItem -LiteralPath $raiz -Recurse -Depth 10 -Force `
      -Filter 'Start-W32TimeRepair.ps1' -ErrorAction SilentlyContinue |
      Where-Object { -not $_.PSIsContainer }
  )
  if ($hallados.Count -eq 0) {
    throw ('No encontre Start-W32TimeRepair.ps1 bajo ' + $raiz + '. Revisa que la instalacion este completa.')
  }
  $ordenados = @(
    $hallados |
      Sort-Object `
        @{ Expression = { if ($_.FullName -like '*2.3.9*') { 0 } else { 1 } } }, `
        @{ Expression = { $_.LastWriteTime }; Descending = $true }
  )
  $reparador = $ordenados[0]
  $carpeta = $reparador.Directory.FullName
  $chequeador = Join-Path $carpeta 'Test-ClockSync.ps1'
  if (-not (Test-Path -LiteralPath $chequeador)) {
    throw ('Falta Test-ClockSync.ps1 junto a ' + $reparador.FullName)
  }
  Linea ('Herramienta encontrada: ' + $reparador.FullName)
  $lineas.Add('ARREGLAR RELOJ - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  $lineas.Add('Herramienta: ' + $reparador.FullName)
  $lineas.Add('Instalaciones con herramienta: ' + $hallados.Count)

  $ps5 = ''
  if ($env:JF_TEST_PS5) {
    $ps5 = $env:JF_TEST_PS5
  } else {
    $ps5 = Join-Path ([Environment]::SystemDirectory) 'WindowsPowerShell\v1.0\powershell.exe'
  }

  # ---- 2) Reparacion (pide UAC una sola vez)
  Linea ''
  Linea '>>> AHORA Windows te va a pedir permiso: dale SI. <<<'
  Linea '    (es solo para poner la hora; no cambia nada mas)'
  Linea ''
  Linea 'Reparando y esperando a que el reloj se ajuste...'
  $salida = @(
    & $ps5 -NoProfile -ExecutionPolicy Bypass -File $reparador.FullName `
      -Profile PublicInternet 2>&1
  )
  $codigo = $LASTEXITCODE
  $lineas.Add('')
  $lineas.Add('--- SALIDA DE LA REPARACION (codigo ' + $codigo + ') ---')
  foreach ($l in $salida) { $lineas.Add((Texto $l)) }

  $codigoError = ''
  $mensaje = ''
  try {
    $json = ($salida -join [Environment]::NewLine) | ConvertFrom-Json
    $codigoError = Texto $json.error_code
    $mensaje = Texto $json.message
  } catch {
    $codigoError = 'SIN_JSON'
  }
  Linea ('Reparacion: codigo ' + $codigo + ' ' + $codigoError)
  if ($mensaje) { Linea ('  ' + $mensaje) }

  if ($codigoError -eq 'UAC_CANCELLED') {
    $lineas.Add('')
    $lineas.Add('El usuario cancelo el permiso de Windows.')
    Set-Content -LiteralPath $evidencia -Value $lineas -Encoding UTF8
    Linea ''
    Linea 'NO QUEDO: cancelaste el permiso de Windows.'
    Linea 'Vuelve a dar doble clic a este archivo y esta vez pulsa SI.'
    Linea ''
    return
  }

  # ---- 3) Comprobar con el MISMO examen que usa JEAN_FLOW
  Linea ''
  Linea 'Comprobando el reloj con el mismo examen que usa JEAN_FLOW...'
  $ok = $false
  $desfase = ''
  $ultimoError = ''
  $intentos = 6
  for ($i = 1; $i -le $intentos; $i++) {
    $chequeo = @(
      & $ps5 -NoProfile -ExecutionPolicy Bypass -File $chequeador `
        -Samples 20 -WarnMs 50 2>&1
    )
    $codigoChequeo = $LASTEXITCODE
    $lineas.Add('')
    $lineas.Add('--- CHEQUEO ' + $i + ' (codigo ' + $codigoChequeo + ') ---')
    foreach ($l in $chequeo) { $lineas.Add((Texto $l)) }
    $desfase = ''
    $ultimoError = ''
    try {
      $j = ($chequeo -join [Environment]::NewLine) | ConvertFrom-Json
      $desfase = Texto $j.abs_phase_offset_ms
      $ultimoError = Texto $j.error_code
    } catch {
      $ultimoError = 'SIN_JSON'
    }
    if ($codigoChequeo -eq 0) {
      $ok = $true
      Linea ('  Chequeo ' + $i + ': OK, desfase ' + $desfase + ' ms (limite 50).')
      break
    }
    $detalle = $ultimoError
    if ($desfase) { $detalle = 'desfase ' + $desfase + ' ms (limite 50)' }
    Linea ('  Chequeo ' + $i + ' de ' + $intentos + ': todavia no (' + $detalle + ').')
    if ($i -lt $intentos) {
      Linea '    Windows sigue ajustando. Espero 40 segundos y reviso otra vez...'
      Start-Sleep -Seconds 40
    }
  }

  $lineas.Add('')
  $lineas.Add('RESULTADO FINAL: ' + $(if ($ok) { 'RELOJ EN HORA' } else { 'RELOJ TODAVIA FUERA DE RANGO' }))
  Set-Content -LiteralPath $evidencia -Value $lineas -Encoding UTF8

  Linea ''
  if ($ok) {
    Linea '============================================================'
    Linea (' LISTO: tu reloj quedo en hora (desfase ' + $desfase + ' ms, limite 50).')
    Linea ''
    Linea ' AHORA:'
    Linea '   1. Abre la carpeta 555 y doble clic a INICIAR.cmd'
    Linea '   2. Escribe 3 y Enter. Enter otra vez en el simbolo.'
    Linea '   3. Deja la laptop enchufada y NO la uses ~3 horas.'
    Linea '      (lo mas facil: dejala corriendo de noche)'
    Linea '============================================================'
  } else {
    $ayuda = @{
      'DOMAIN_POLICY' = 'Tu Windows esta administrado por politicas y no deja tocar la hora.'
      'EXTERNAL_TIME_SERVICE' = 'Hay otro programa de hora instalado peleando con Windows.'
      'SERVICE_NOT_REGISTERED' = 'El servicio Hora de Windows no existe en este equipo.'
      'CONVERGENCE_TIMEOUT' = 'Windows no logro conectar con los servidores de hora (revisa tu internet).'
      'CONVERGENCE_VALIDATION_FAILED' = 'Windows conecto pero el reloj sigue desviado; suele arreglarse esperando unos minutos mas.'
      'OFFSET_OUT_OF_RANGE' = 'El reloj sigue desviado mas de 50 ms; espera 10 minutos con internet y repite.'
      'NO_VALID_SOURCE' = 'Windows aun no tiene un servidor de hora activo; revisa tu internet y repite.'
    }
    $clave = $ultimoError
    if (-not $clave) { $clave = $codigoError }
    Linea '============================================================'
    Linea (' NO QUEDO todavia. Motivo: ' + $clave)
    if ($ayuda.ContainsKey($clave)) { Linea (' ' + $ayuda[$clave]) }
    Linea ''
    Linea ' QUE HACER:'
    Linea '   1. Revisa que tengas internet (abre YouTube).'
    Linea '   2. Espera 10 minutos y vuelve a dar doble clic aqui.'
    Linea '   3. Si vuelve a fallar, sube al chat este archivo:'
    Linea ('      ' + $evidencia)
    Linea '============================================================'
  }
  try { Start-Process explorer.exe ('/select,"' + $evidencia + '"') } catch { }
} catch {
  $lineas.Add('')
  $lineas.Add('ERROR: ' + $_.Exception.Message)
  try { Set-Content -LiteralPath $evidencia -Value $lineas -Encoding UTF8 } catch { }
  Linea ''
  Linea ('ERROR: ' + $_.Exception.Message)
  Linea 'No se cambio nada. Sube al chat una captura de esta ventana.'
}
Linea ''
