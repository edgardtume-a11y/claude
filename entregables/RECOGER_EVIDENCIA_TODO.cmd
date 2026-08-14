@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JEAN_FLOW - Recoger evidencia de TODAS las instalaciones (un clic)
echo ============================================================
echo  RECOGER EVIDENCIA - TODAS LAS INSTALACIONES - JEAN_FLOW 555
echo.
echo  Este recogedor busca TODAS las instalaciones de JEAN_FLOW
echo  dentro de C:\JF (incluidas subcarpetas y 555_anterior_*),
echo  y de CADA una toma su run MAS RECIENTE.
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
"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='=='+'CARGA'+'=='; $i=$t.IndexOf($m); if($i -lt 0){Write-Host 'FALLO interno: no encontre el bloque de trabajo.'; exit 9}; $p=Join-Path $env:TEMP 'jf_recoger_todo.ps1'; [IO.File]::WriteAllText($p,$t.Substring($i+$m.Length)); & $p"
echo.
echo ------------------------------------------------------------
echo  Si arriba dice LISTO: el ZIP quedo en tu Escritorio.
echo  Sube ESE archivo al chat de Claude y ya.
echo  Si dice ERROR: toma captura de esta ventana para Claude.
echo ------------------------------------------------------------
pause
exit /b 0
rem ==CARGA==
# jf_recoger_todo.ps1 - busca TODAS las instalaciones de JEAN_FLOW bajo
# C:\JF (a cualquier profundidad razonable, incluidas 555_anterior_*) y de
# cada una recoge los informes de su run MAS RECIENTE.
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
  # ---- 1) Buscar TODAS las carpetas runs bajo C:\JF
  $raiz = 'C:\JF'
  if ($env:JF_TEST_JF) { $raiz = $env:JF_TEST_JF }
  Linea ('Buscando instalaciones bajo: ' + $raiz)
  if (-not (Test-Path -LiteralPath $raiz)) {
    throw ('No existe la carpeta ' + $raiz + ' en este equipo.')
  }
  $runsDirs = @(Get-ChildItem -LiteralPath $raiz -Directory -Recurse -Depth 8 -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq 'runs' -and (Split-Path -Leaf (Split-Path -Parent $_.FullName)) -eq 'binance_phase1_collector' })
  Linea ('Instalaciones con carpeta runs encontradas: ' + $runsDirs.Count)
  if ($runsDirs.Count -eq 0) {
    throw 'No encontre ninguna carpeta runs de JEAN_FLOW bajo C:\JF. Aun no se ha corrido INICIAR en este disco.'
  }

  # ---- 2) De cada instalacion, elegir su run principal mas reciente
  $temp = Join-Path $env:TEMP ('jf_evidencia_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $temp | Out-Null
  $inc = New-Object System.Collections.Generic.List[string]
  $omi = New-Object System.Collections.Generic.List[string]
  $lineas = New-Object System.Collections.Generic.List[string]
  $resumen = New-Object System.Collections.Generic.List[string]
  $lineas.Add('INVENTARIO (solo lectura; originales intactos)')
  $lineas.Add('Listado : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  $lineas.Add('Raiz buscada: ' + $raiz)
  $numero = 0
  $ultimoNombre = ''
  foreach ($runsDir in ($runsDirs | Sort-Object FullName)) {
    $numero = $numero + 1
    $instal = Split-Path -Parent (Split-Path -Parent $runsDir.FullName)
    $etiqueta = ('INSTALACION_' + $numero)
    $lineas.Add('')
    $lineas.Add('=== ' + $etiqueta + ' = ' + $instal)
    $hijos = @(Get-ChildItem -LiteralPath $runsDir.FullName -Directory -ErrorAction SilentlyContinue)
    $mains = @($hijos | Where-Object { $_.Name -match '^[0-9]{8}T[0-9]' } | Sort-Object Name)
    $pfs   = @($hijos | Where-Object { $_.Name -like 'preflight_*' } | Sort-Object Name)
    $run = $null
    $pfUltimo = $null
    if ($mains.Count -gt 0) {
      $run = $mains[$mains.Count - 1]
      if ($pfs.Count -gt 0) { $pfUltimo = $pfs[$pfs.Count - 1] }
    } elseif ($pfs.Count -gt 0) {
      $run = $pfs[$pfs.Count - 1]
    }
    if (-not $run) {
      $resumen.Add($etiqueta + ': runs vacia en ' + $instal)
      $lineas.Add('    (carpeta runs vacia)')
      continue
    }
    $resumen.Add($etiqueta + ': run ' + $run.Name + '  (' + $instal + ')')
    if ($run.Name -gt $ultimoNombre) { $ultimoNombre = $run.Name }
    $destinoRun = Join-Path $temp ($etiqueta + '\' + $run.Name)
    Recolectar $run.FullName $destinoRun $inc $omi $lineas ($etiqueta + '\' + $run.Name)
    if ($pfUltimo) {
      $destinoPf = Join-Path $temp ($etiqueta + '\_preflight_contexto\' + $pfUltimo.Name)
      Recolectar $pfUltimo.FullName $destinoPf $inc $omi $lineas ($etiqueta + '\_preflight')
    }
  }
  if ($inc.Count -eq 0) { throw 'No encontre informes que recoger en ninguna instalacion.' }

  Linea ''
  foreach ($r in $resumen) { Linea ('  ' + $r) }
  $lineas.Add('')
  $lineas.Add('RESUMEN DE INSTALACIONES:')
  foreach ($r in $resumen) { $lineas.Add('  ' + $r) }
  $lineas.Add('')
  $lineas.Add('Incluidos en el ZIP : ' + $inc.Count)
  $lineas.Add('Quedan solo en disco: ' + $omi.Count + ' (datos grandes u otros)')
  foreach ($o in $omi) { $lineas.Add('  NO INCLUIDO: ' + $o) }
  Set-Content -LiteralPath (Join-Path $temp 'LISTADO_COMPLETO.txt') -Value $lineas -Encoding UTF8

  # ---- 3) Comprimir al Escritorio y senalar el ZIP
  $escritorio = [Environment]::GetFolderPath('Desktop')
  if ($env:JF_TEST_DESKTOP) { $escritorio = $env:JF_TEST_DESKTOP }
  $marca = Get-Date -Format 'yyyyMMdd_HHmmss'
  $zip = Join-Path $escritorio ('EVIDENCIA_PARA_CLAUDE_TODO_' + $marca + '.zip')
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zip
  Remove-Item -LiteralPath $temp -Recurse -Force
  $mbZip = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
  Linea ''
  Linea ('LISTO: ' + $zip)
  Linea ('Tamano: ' + $mbZip + ' MB  |  Informes: ' + $inc.Count + '  |  Excluidos: ' + $omi.Count)
  if ($ultimoNombre) { Linea ('Run mas reciente de todo el disco: ' + $ultimoNombre) }
  Linea 'Tus archivos originales NO fueron tocados: solo se copiaron.'
  Linea 'SIGUIENTE PASO: sube ese ZIP al chat de Claude.'
  try { Start-Process explorer.exe ('/select,"' + $zip + '"') } catch { }
} catch {
  Linea ''
  Linea ('ERROR: ' + $_.Exception.Message)
  Linea 'Nada fue modificado. Toma captura de esta ventana y enviala a Claude.'
}
Linea ''
