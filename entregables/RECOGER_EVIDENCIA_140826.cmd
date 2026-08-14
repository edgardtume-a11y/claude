@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JEAN_FLOW - Recoger evidencia carpeta 140826 (un clic)
echo ============================================================
echo  RECOGER EVIDENCIA - CARPETA 140826 - JEAN_FLOW 555 v2.3.8
echo.
echo  Este recogedor mira SOLO esta instalacion:
echo    C:\JF\140826\1\JEAN_FLOW_555_META_QUANT_v2.3.8 ^(1^)\555
echo  y elige el run MAS RECIENTE de su carpeta runs.
echo.
echo  Sigo estas reglas:
echo   - SOLO leo y copio: no toco, no muevo, no borro nada.
echo   - Excluyo los CSV gigantes de datos y todo mayor de 100 MB.
echo   - Dejo UN solo ZIP en tu Escritorio, listo para subir al chat.
echo.
echo  AVISO: usa esto cuando NINGUNA captura este corriendo.
echo ============================================================
echo.
set "PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='=='+'CARGA'+'=='; $i=$t.IndexOf($m); if($i -lt 0){Write-Host 'FALLO interno: no encontre el bloque de trabajo.'; exit 9}; $p=Join-Path $env:TEMP 'jf_recoger_140826.ps1'; [IO.File]::WriteAllText($p,$t.Substring($i+$m.Length)); & $p"
echo.
echo ------------------------------------------------------------
echo  Si arriba dice LISTO: el ZIP quedo en tu Escritorio.
echo  Sube ESE archivo al chat de Claude y ya.
echo  Si dice ERROR: toma captura de esta ventana para Claude.
echo ------------------------------------------------------------
pause
exit /b 0
rem ==CARGA==
# jf_recoger_140826.ps1 - recoge la evidencia del run mas reciente de la
# instalacion en C:\JF\140826\1\JEAN_FLOW_555_META_QUANT_v2.3.8 (1)\555.
# SOLO lee y copia: jamas modifica, renombra ni borra nada.

$ErrorActionPreference = 'Stop'

function Linea([string]$t) { Write-Host $t }

$script:limite = 100MB
$script:extensiones = @('.json', '.jsonl', '.txt', '.log', '.md')

function Recolectar([string]$origen, [string]$destinoBase, $inc, $omi, $lineas, [string]$etiqueta) {
  $todos = @(Get-ChildItem -LiteralPath $origen -File -Recurse -Force)
  $lineas.Add('')
  $lineas.Add('--- ' + $etiqueta + ' : ' + $origen)
  foreach ($f in $todos) {
    $rel = $f.FullName.Substring($origen.Length).TrimStart('\', '/')
    $lineas.Add(('{0,15:N0} bytes  {1}  {2}' -f $f.Length, $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $rel))
    $esDatos = ($f.Extension.ToLowerInvariant() -eq '.csv')
    $esInforme = ($script:extensiones -contains $f.Extension.ToLowerInvariant())
    if ($esInforme -and (-not $esDatos) -and ($f.Length -le $script:limite)) {
      $destino = Join-Path $destinoBase $rel
      $dirDest = Split-Path -Parent $destino
      if (-not (Test-Path -LiteralPath $dirDest)) {
        New-Item -ItemType Directory -Path $dirDest -Force | Out-Null
      }
      Copy-Item -LiteralPath $f.FullName -Destination $destino
      $inc.Add($etiqueta + '\' + $rel)
    } else {
      $omi.Add($etiqueta + '\' + $rel + '  (' + [math]::Round($f.Length / 1MB, 1) + ' MB)')
    }
  }
}

try {
  Linea ''
  # ---- 1) La instalacion objetivo (fija, la que pidio Jean)
  $ruta555 = 'C:\JF\140826\1\JEAN_FLOW_555_META_QUANT_v2.3.8 (1)\555'
  if ($env:JF_TEST_555) { $ruta555 = $env:JF_TEST_555 }
  $runsDir = Join-Path $ruta555 'binance_phase1_collector\runs'
  if ($env:JF_TEST_555) { $runsDir = Join-Path (Join-Path $ruta555 'binance_phase1_collector') 'runs' }
  Linea ('Instalacion objetivo: ' + $ruta555)
  if (-not (Test-Path -LiteralPath $ruta555)) {
    throw ('No existe la carpeta ' + $ruta555 + ' . Revisa que la ruta sea exactamente esa.')
  }
  if (-not (Test-Path -LiteralPath $runsDir)) {
    throw ('Esa instalacion no tiene carpeta runs todavia (no se ha corrido INICIAR alli). Buscada: ' + $runsDir)
  }

  # ---- 2) Elegir el RUN PRINCIPAL mas reciente (y su preflight de contexto)
  $hijos = @(Get-ChildItem -LiteralPath $runsDir -Directory -ErrorAction SilentlyContinue)
  $mains = @($hijos | Where-Object { $_.Name -match '^[0-9]{8}T[0-9]' } | Sort-Object Name)
  $pfs   = @($hijos | Where-Object { $_.Name -like 'preflight_*' } | Sort-Object Name)
  Linea ('Runs principales encontrados: ' + $mains.Count + '  |  preflights: ' + $pfs.Count)
  $pfUltimo = $null
  if ($mains.Count -gt 0) {
    $run = $mains[$mains.Count - 1]
    if ($pfs.Count -gt 0) { $pfUltimo = $pfs[$pfs.Count - 1] }
  } elseif ($pfs.Count -gt 0) {
    $run = $pfs[$pfs.Count - 1]
    Linea 'AVISO: no hay runs principales; recojo el preflight mas reciente.'
  } else {
    throw 'La carpeta runs existe pero esta vacia: no hay nada que recoger.'
  }
  Linea ''
  Linea ('Run elegido: ' + $run.Name)

  $cierre1 = Join-Path $run.FullName 'RESULT.json'
  $cierre2 = Join-Path $run.FullName 'CAPTURA_COMPLETA_AUDITADA.json'
  if (-not ((Test-Path -LiteralPath $cierre1) -or (Test-Path -LiteralPath $cierre2))) {
    Linea 'AVISO: este run parece EN CURSO o incompleto (sin RESULT.json ni'
    Linea 'CAPTURA_COMPLETA_AUDITADA.json todavia). Igual recojo lo que haya.'
  }

  # ---- 3) Copiar informes (run principal + preflight de contexto)
  $temp = Join-Path $env:TEMP ('jf_evidencia_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $temp | Out-Null
  $inc = New-Object System.Collections.Generic.List[string]
  $omi = New-Object System.Collections.Generic.List[string]
  $lineas = New-Object System.Collections.Generic.List[string]
  $lineas.Add('INVENTARIO (solo lectura; originales intactos)')
  $lineas.Add('Listado : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  $lineas.Add('Instalacion objetivo: ' + $ruta555)
  $lineas.Add('Carpeta runs        : ' + $runsDir)

  Recolectar $run.FullName $temp $inc $omi $lineas 'RUN'
  if ($pfUltimo) {
    $destinoPf = Join-Path $temp ('_preflight_contexto\' + $pfUltimo.Name)
    Recolectar $pfUltimo.FullName $destinoPf $inc $omi $lineas 'PREFLIGHT'
  }
  if ($inc.Count -eq 0) { throw 'No encontre informes que recoger.' }

  $lineas.Add('')
  $lineas.Add('Incluidos en el ZIP : ' + $inc.Count)
  $lineas.Add('Quedan solo en disco: ' + $omi.Count + ' (datos grandes u otros)')
  foreach ($o in $omi) { $lineas.Add('  NO INCLUIDO: ' + $o) }
  Set-Content -LiteralPath (Join-Path $temp 'LISTADO_COMPLETO.txt') -Value $lineas -Encoding UTF8

  # ---- 4) Comprimir al Escritorio y senalar el ZIP
  $escritorio = [Environment]::GetFolderPath('Desktop')
  if ($env:JF_TEST_DESKTOP) { $escritorio = $env:JF_TEST_DESKTOP }
  $zip = Join-Path $escritorio ('EVIDENCIA_PARA_CLAUDE_140826_' + $run.Name + '.zip')
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zip
  Remove-Item -LiteralPath $temp -Recurse -Force
  $mbZip = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
  Linea ''
  Linea ('LISTO: ' + $zip)
  Linea ('Tamano: ' + $mbZip + ' MB  |  Informes: ' + $inc.Count + '  |  Excluidos: ' + $omi.Count)
  Linea 'Tus archivos originales NO fueron tocados: solo se copiaron.'
  Linea 'SIGUIENTE PASO: sube ese ZIP al chat de Claude.'
  try { Start-Process explorer.exe ('/select,"' + $zip + '"') } catch { }
} catch {
  Linea ''
  Linea ('ERROR: ' + $_.Exception.Message)
  Linea 'Nada fue modificado. Toma captura de esta ventana y enviala a Claude.'
}
Linea ''
