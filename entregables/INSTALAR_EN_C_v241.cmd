@echo off
rem ============================================================
rem  JEAN_FLOW 555 META_QUANT - INSTALADOR OFICIAL v2.4.1
rem  Doble clic NORMAL. NO usar "Ejecutar como administrador".
rem  Coloque este archivo JUNTO al ZIP:
rem    JEAN_FLOW_555_META_QUANT_v2.4.1.zip
rem  Que hace: verifica el sello SHA-256 del ZIP, aparta la
rem  instalacion previa como 555_anterior_<fecha> (no borra nada),
rem  extrae, verifica los 144 archivos uno a uno contra el
rem  manifiesto y deja la instalacion oficial en C:\JF\555.
rem ============================================================
setlocal
title INSTALAR JEAN_FLOW v2.4.1
set "JF_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l=[IO.File]::ReadAllLines($env:JF_SELF);$i=[Array]::IndexOf($l,'rem ==CARGA==');$p=$l[($i+1)..($l.Length-1)] | ForEach-Object { $_ -replace '^rem( |$)','' };$t=Join-Path ([IO.Path]::GetTempPath()) 'jf_instalar_v241.ps1';[IO.File]::WriteAllLines($t,$p);powershell -NoProfile -ExecutionPolicy Bypass -File $t;exit $LASTEXITCODE"
echo.
if errorlevel 1 (
  echo RESULTADO: FALLO - lea los mensajes de arriba y comparta la foto en el chat.
) else (
  echo RESULTADO: INSTALACION CORRECTA.
)
echo.
pause
endlocal
exit /b
rem ==CARGA==
rem $ErrorActionPreference = 'Stop'
rem $VERSION = '2.4.1'
rem $ZIP_NAME = 'JEAN_FLOW_555_META_QUANT_v2.4.1.zip'
rem $ZIP_SHA = 'd378f07653dcfd5e21b88df821ea14753709a4ba3f16f99069fbd23d3380f6ab'
rem $MANIFEST_SHA = 'ca6156075b45bccd6f237d37c789675d1115b82821479b6df478c5470a704d20'
rem $MANIFEST_FILES = 144
rem
rem function Fallo([string]$code, [string]$msg) {
rem   Write-Host ''
rem   Write-Host ('[FALLO] ' + $code)
rem   Write-Host $msg
rem   exit 1
rem }
rem
rem try {
rem   $JF = 'C:\JF'
rem   if ($env:JF_TEST_ROOT) { $JF = $env:JF_TEST_ROOT }
rem
rem   if (-not $env:JF_TEST_ROOT) {
rem     try {
rem       $id = [Security.Principal.WindowsIdentity]::GetCurrent()
rem       $pr = New-Object Security.Principal.WindowsPrincipal($id)
rem       if ($pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
rem         Fallo 'CONSOLA_ELEVADA' 'Cierre esta ventana y vuelva a abrir el instalador con doble clic NORMAL (sin "Ejecutar como administrador").'
rem       }
rem     } catch { if ($_.FullyQualifiedErrorId -eq 'CONSOLA_ELEVADA') { throw } }
rem   }
rem
rem   $cmdDir = Split-Path -Parent $env:JF_SELF
rem   $candidatos = @()
rem   $candidatos += (Join-Path $cmdDir $ZIP_NAME)
rem   if ($env:USERPROFILE) { $candidatos += (Join-Path (Join-Path $env:USERPROFILE 'Downloads') $ZIP_NAME) }
rem   $zip = $null
rem   foreach ($c in $candidatos) { if (Test-Path -LiteralPath $c) { $zip = $c; break } }
rem   if (-not $zip) {
rem     Fallo 'ZIP_NO_ENCONTRADO' ('No encuentro ' + $ZIP_NAME + '. Coloque el ZIP JUNTO a este instalador (misma carpeta) y vuelva a hacer doble clic.')
rem   }
rem   Write-Host ('ZIP encontrado: ' + $zip)
rem
rem   Write-Host 'Paso 1 de 5: verificando el sello SHA-256 del ZIP...'
rem   $h = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
rem   if ($h -ne $ZIP_SHA) {
rem     Fallo 'SELLO_ZIP_INCORRECTO' ('El ZIP no es el oficial v' + $VERSION + '.' + [Environment]::NewLine + 'Esperado: ' + $ZIP_SHA + [Environment]::NewLine + 'Obtenido: ' + $h + [Environment]::NewLine + 'Descargue el ZIP de nuevo desde el chat y reintente.')
rem   }
rem   Write-Host '  Sello del ZIP: CORRECTO'
rem
rem   if (-not (Test-Path -LiteralPath $JF)) { New-Item -ItemType Directory -Path $JF | Out-Null }
rem   $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
rem   $staging = Join-Path $JF ('.instalando_555_' + $ts)
rem   if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
rem   Write-Host 'Paso 2 de 5: extrayendo a una carpeta temporal...'
rem   Expand-Archive -LiteralPath $zip -DestinationPath $staging -Force
rem   $nuevo555 = Join-Path $staging '555'
rem   if (-not (Test-Path -LiteralPath $nuevo555)) { Fallo 'ZIP_SIN_CARPETA_555' 'El ZIP no contiene la carpeta 555 esperada.' }
rem
rem   Write-Host ('Paso 3 de 5: verificando el manifiesto y los ' + $MANIFEST_FILES + ' archivos uno a uno...')
rem   $manifest = Join-Path $nuevo555 'RELEASE_MANIFEST.sha256'
rem   if (-not (Test-Path -LiteralPath $manifest)) { Fallo 'SIN_MANIFIESTO' 'Falta RELEASE_MANIFEST.sha256 dentro de 555.' }
rem   $mh = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant()
rem   if ($mh -ne $MANIFEST_SHA) {
rem     Fallo 'SELLO_MANIFIESTO_INCORRECTO' ('Esperado: ' + $MANIFEST_SHA + [Environment]::NewLine + 'Obtenido: ' + $mh)
rem   }
rem   $lineas = @(Get-Content -LiteralPath $manifest | Where-Object { $_.Trim().Length -gt 0 })
rem   if ($lineas.Count -ne $MANIFEST_FILES) {
rem     Fallo 'CONTEO_INCORRECTO' ('El manifiesto tiene ' + $lineas.Count + ' entradas; esperaba ' + $MANIFEST_FILES + '.')
rem   }
rem   $n = 0
rem   $malos = @()
rem   $esperados = New-Object 'System.Collections.Generic.HashSet[string]'
rem   [void]$esperados.Add((Get-Item -LiteralPath $manifest -Force).FullName)
rem   foreach ($ln in $lineas) {
rem     $sha = $ln.Substring(0, 64).ToLowerInvariant()
rem     $rel = $ln.Substring(64).Trim()
rem     $rel2 = $rel -replace '^555/', ''
rem     $fp = Join-Path $nuevo555 $rel2
rem     if (-not (Test-Path -LiteralPath $fp)) { $malos += ($rel + ' (FALTA)'); continue }
rem     [void]$esperados.Add((Get-Item -LiteralPath $fp -Force).FullName)
rem     $fh = (Get-FileHash -LiteralPath $fp -Algorithm SHA256).Hash.ToLowerInvariant()
rem     if ($fh -ne $sha) { $malos += ($rel + ' (SELLO DISTINTO)') }
rem     $n = $n + 1
rem     if (($n % 25) -eq 0) { Write-Host ('  ' + $n + ' / ' + $MANIFEST_FILES) }
rem   }
rem   if ($malos.Count -gt 0) {
rem     Fallo 'ARCHIVOS_CORRUPTOS' ('Fallaron ' + $malos.Count + ' archivos:' + [Environment]::NewLine + ($malos -join [Environment]::NewLine))
rem   }
rem   $extras = @(Get-ChildItem -LiteralPath $nuevo555 -Recurse -File -Force | Where-Object { -not $esperados.Contains($_.FullName) })
rem   if ($extras.Count -gt 0) {
rem     Fallo 'ARCHIVOS_EXTRA' ('El arbol trae ' + $extras.Count + ' archivos fuera del manifiesto: ' + (($extras | ForEach-Object { $_.FullName }) -join ', '))
rem   }
rem   Write-Host ('  Archivos verificados: ' + $n + ' / ' + $MANIFEST_FILES + ' CORRECTOS, sin extras')
rem
rem   $initPy = Join-Path $nuevo555 'binance_phase1_collector/src/binance_collector/__init__.py'
rem   $vline = @(Get-Content -LiteralPath $initPy | Where-Object { $_ -match '__version__' })[0]
rem   if ($vline -notmatch [regex]::Escape('"' + $VERSION + '"')) {
rem     Fallo 'VERSION_INCORRECTA' ('El arbol no declara la version ' + $VERSION + ': ' + $vline)
rem   }
rem
rem   $destino = Join-Path $JF '555'
rem   if (Test-Path -LiteralPath $destino) {
rem     $anterior = Join-Path $JF ('555_anterior_' + $ts)
rem     Write-Host ('Paso 4 de 5: apartando la instalacion previa como: ' + $anterior)
rem     Write-Host '  (NO se borra nada: la instalacion previa queda como evidencia)'
rem     try {
rem       Move-Item -LiteralPath $destino -Destination $anterior
rem     } catch {
rem       Fallo 'PREVIA_EN_USO' 'No pude apartar la carpeta 555 actual porque hay archivos en uso. Cierre INICIAR, el navegador del dashboard y toda ventana negra, y vuelva a hacer doble clic.'
rem     }
rem   } else {
rem     Write-Host 'Paso 4 de 5: no hay instalacion previa que apartar.'
rem   }
rem
rem   Write-Host 'Paso 5 de 5: dejando la instalacion oficial en su lugar...'
rem   Move-Item -LiteralPath $nuevo555 -Destination $destino
rem   Remove-Item -LiteralPath $staging -Recurse -Force
rem
rem   $fin = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
rem   $json = '{' + [Environment]::NewLine
rem   $json = $json + '  "status": "INSTALADO",' + [Environment]::NewLine
rem   $json = $json + '  "version": "' + $VERSION + '",' + [Environment]::NewLine
rem   $json = $json + '  "zip_sha256": "' + $ZIP_SHA + '",' + [Environment]::NewLine
rem   $json = $json + '  "manifest_sha256": "' + $MANIFEST_SHA + '",' + [Environment]::NewLine
rem   $json = $json + '  "archivos_verificados": ' + $n + ',' + [Environment]::NewLine
rem   $json = $json + '  "destino": "' + ($destino -replace '\\', '\\\\') + '",' + [Environment]::NewLine
rem   $json = $json + '  "fecha": "' + $fin + '"' + [Environment]::NewLine
rem   $json = $json + '}'
rem   $resPath = Join-Path $cmdDir ('INSTALACION_v241_RESULT_' + $ts + '.json')
rem   [IO.File]::WriteAllText($resPath, $json)
rem
rem   Write-Host ''
rem   Write-Host '=================================================='
rem   Write-Host ('INSTALACION CORRECTA en: ' + $destino)
rem   Write-Host ('Version instalada: ' + $VERSION + ' (' + $n + ' archivos verificados)')
rem   Write-Host 'Siguiente paso: abrir la carpeta 555 y doble clic a INICIAR.cmd,'
rem   Write-Host 'opcion 3 y Enter (simbolo BTCUSDT, el menu ya lo sugiere).'
rem   Write-Host 'Durante la certificacion: laptop enchufada, sin programas'
rem   Write-Host 'pesados y la ventana negra VISIBLE (no minimizada).'
rem   Write-Host '=================================================='
rem   exit 0
rem } catch {
rem   if ($_.FullyQualifiedErrorId -and $_.Exception.Message) {
rem     Write-Host ''
rem     Write-Host '[FALLO] ERROR_INESPERADO'
rem     Write-Host $_.Exception.Message
rem   }
rem   exit 1
rem }
