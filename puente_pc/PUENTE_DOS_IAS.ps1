# PUENTE_DOS_IAS.ps1  (v4)
# Escribe el mismo mensaje en ChatGPT y en Claude Code cada N minutos.
#
#   ARRANCAR_PUENTE.cmd            -> bucle normal (SI envia)
#   ARRANCAR_PUENTE.cmd PRUEBA     -> escribe y verifica, NO envia
#   ARRANCAR_PUENTE.cmd LISTAR     -> solo dice que ventanas hay
#   ARRANCAR_PUENTE.cmd CALIBRAR   -> aprende donde esta cada caja de texto
#
# ---------------------------------------------------------------------------
# POR QUE HAY CALIBRACION
#
# Shift+Esc lleva el cursor a la caja en ChatGPT. En Claude Code NO existe ese
# atajo. Sin el, Ctrl+A selecciona la pagina entera (medido: 18.882 caracteres)
# o cae en cualquier otro sitio (medido: 44 caracteres). Adivinar la posicion
# de la caja por pixeles funciona a veces y falla otras, segun el zoom, la
# barra lateral y el tamano de la ventana.
#
# Con -Calibrar pones TU el raton encima de cada caja y el script guarda esa
# posicion RELATIVA a la ventana. A partir de ahi hace clic exactamente ahi,
# aunque muevas la ventana. Se guarda en calibracion.json, junto al script.
#
# Orden de intentos: primero atajos de teclado; si no, el clic calibrado; si
# no hay calibracion, clics a ciegas en varias alturas. Solo se envia lo que
# se verifica.
# ---------------------------------------------------------------------------
# LO QUE COSTO ENCONTRAR
#
#  - SetForegroundWindow solo no basta: Windows bloquea el robo de foco,
#    devuelve True y no hace nada. Hace falta el truco del ALT
#    (keybd_event 0x12) mas AttachThreadInput al hilo activo.
#  - SendKeys para el TEXTO no vale: con Bloq Mayus activo invierte las
#    mayusculas (comprobado: salio "prueba de canal DESDE cLAUDE") y el
#    teclado ESP rompe simbolos. Se pega por portapapeles.
#  - El navegador pone el nombre de la CONVERSACION en el titulo y cambia si
#    la renombras. Por eso se busca por texto parcial y hay modo -Listar.
#
# DOS SALVAGUARDAS, nacidas de errores reales
#  - No escribe sin confirmar el foco en la ventana correcta.
#  - No pulsa Enter sin releer lo pegado y compararlo caracter a caracter.
# ---------------------------------------------------------------------------

param(
  [string]$Mensaje = 'MEJOREN LA LATENCIA. COMUNICATE CON LA OTRA IA. CONTINUA CONVERSANDO, NO PARES HASTA QUE EL DUENO TE DIGA QUE PARES.',
  [string]$TituloChatGPT = 'Activar Remote Desktop',
  [string]$TituloClaude  = 'Claude Code',
  [int]$Minutos = 10,
  [switch]$Prueba,
  [switch]$Listar,
  [switch]$Calibrar,
  [switch]$SoloUnaVez,
  [switch]$SinRaton
)

$ErrorActionPreference = 'Stop'

function Fin([int]$codigo) {
  Write-Host ''
  Write-Host '======================================================'
  Write-Host " Terminado. Codigo: $codigo"
  Write-Host '======================================================'
  try { Read-Host 'Pulsa Enter para cerrar' | Out-Null } catch { Start-Sleep -Seconds 30 }
  exit $codigo
}

try {

  $Base    = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
  $Log     = Join-Path $Base 'puente_dos_ias.log'
  $FicCal  = Join-Path $Base 'calibracion.json'

  function Log([string]$t) {
    $l = "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $t
    Write-Host $l
    try { Add-Content -Path $Log -Value $l -Encoding UTF8 } catch { }
  }

  Log '=== arrancando (v4) ==='
  Log "    PowerShell $($PSVersionTable.PSVersion)  |  carpeta: $Base"

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public struct RECT { public int Left, Top, Right, Bottom; }
public struct PT { public int X, Y; }
public class PuenteWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);

  public static bool Forzar(IntPtr h) {
    keybd_event(0x12, 0, 0, IntPtr.Zero);
    keybd_event(0x12, 0, 2, IntPtr.Zero);
    uint mio = GetCurrentThreadId();
    uint suyo = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
    AttachThreadInput(mio, suyo, true);
    ShowWindow(h, 9); BringWindowToTop(h);
    bool r = SetForegroundWindow(h);
    AttachThreadInput(mio, suyo, false);
    return r;
  }
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(150);
    mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(60);
    mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
  }
}
"@
  Log '    API de ventanas y raton cargada'

  function TituloActivo {
    $sb = New-Object System.Text.StringBuilder 300
    [PuenteWin]::GetWindowText([PuenteWin]::GetForegroundWindow(), $sb, 300) | Out-Null
    $sb.ToString()
  }

  function Buscar-Ventana([string]$Titulo) {
    Get-Process | Where-Object {
      $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -like "*$Titulo*"
    } | Select-Object -First 1
  }

  function Mostrar-Ventanas {
    Log '  --- ventanas abiertas con titulo ---'
    Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
      Log ("      [{0,-16}] {1}" -f $_.ProcessName, $_.MainWindowTitle)
    }
  }

  function Leer-Calibracion {
    if (Test-Path $FicCal) {
      try { return (Get-Content $FicCal -Raw | ConvertFrom-Json) } catch { }
    }
    return $null
  }

  function Poner-Foco($w, [string]$Titulo) {
    for ($i = 1; $i -le 5; $i++) {
      [PuenteWin]::Forzar($w.MainWindowHandle) | Out-Null
      Start-Sleep -Milliseconds 900
      if ((TituloActivo) -like "*$Titulo*") { return $true }
    }
    return $false
  }

  # ---------------- CALIBRAR ------------------------------------------------
  if ($Calibrar) {
    Log '=== CALIBRACION ==='
    Log ''
    Log 'Te voy a pedir que pongas el raton ENCIMA DE LA CAJA DE ESCRIBIR de'
    Log 'cada aplicacion. No hace falta que hagas clic: solo dejalo ahi.'
    Log ''
    $cal = @{}
    foreach ($par in @(@{t=$TituloChatGPT; n='ChatGPT'}, @{t=$TituloClaude; n='Claude Code'})) {
      $w = Buscar-Ventana $par.t
      if (-not $w) { Log "  $($par.n): no encuentro ventana con '$($par.t)'. La salto."; continue }
      Log "  $($par.n): ventana '$($w.MainWindowTitle)'"
      Log "  >>> Pon el raton sobre la CAJA DE ESCRIBIR de $($par.n)."
      for ($s = 8; $s -ge 1; $s--) { Write-Host "      capturo en $s..." ; Start-Sleep -Seconds 1 }
      $p = New-Object PT
      [PuenteWin]::GetCursorPos([ref]$p) | Out-Null
      $r = New-Object RECT
      [PuenteWin]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
      $dx = $p.X - $r.Left
      $dy = $p.Y - $r.Top
      $cal[$par.n] = @{ dx = $dx; dy = $dy }
      Log "  $($par.n): guardado desplazamiento dentro de la ventana dx=$dx dy=$dy"
      Log ''
    }
    $cal | ConvertTo-Json | Set-Content -Path $FicCal -Encoding UTF8
    Log "Calibracion guardada en: $FicCal"
    Log 'Ahora lanza el puente en modo PRUEBA para comprobarlo.'
    Fin 0
  }

  # ---------------- LISTAR --------------------------------------------------
  if ($Listar) {
    Log '=== solo listar: no se toca nada ==='
    Mostrar-Ventanas
    Log ''
    Log 'Coge un trozo del titulo de cada ventana y pasalo con -TituloChatGPT'
    Log 'y -TituloClaude si no coinciden con los de por defecto.'
    Fin 0
  }

  # ---------------- ENVIAR --------------------------------------------------
  # 0 enviado/escrito | 2 sin ventana | 3 sin foco | 4 no coincide
  function Enviar([string]$Titulo, [string]$Etiqueta, [string]$Texto, [bool]$NoEnviar) {

    $w = Buscar-Ventana $Titulo
    if (-not $w) {
      Log "  $Etiqueta : NO hay ninguna ventana que contenga '$Titulo'"
      Mostrar-Ventanas
      return 2
    }
    Log "  $Etiqueta : ventana '$($w.MainWindowTitle)'"

    if (-not (Poner-Foco $w $Titulo)) {
      Log "  $Etiqueta : SIN FOCO (activa: '$(TituloActivo)'). No escribo nada."
      return 3
    }

    $r = New-Object RECT
    [PuenteWin]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null

    $estrategias = New-Object System.Collections.ArrayList
    [void]$estrategias.Add(@{ n = 'Shift+Esc'; tipo = 'tecla'; k = '+{ESC}' })
    [void]$estrategias.Add(@{ n = 'directo';   tipo = 'nada' })

    if (-not $SinRaton) {
      $cal = Leer-Calibracion
      if ($cal -and $cal.$Etiqueta) {
        $x = $r.Left + [int]$cal.$Etiqueta.dx
        $y = $r.Top  + [int]$cal.$Etiqueta.dy
        [void]$estrategias.Add(@{ n = 'clic CALIBRADO'; tipo = 'clic'; x = $x; y = $y })
      }
      $cx = [int](($r.Left + $r.Right) / 2)
      foreach ($off in 80, 120, 60, 160) {
        [void]$estrategias.Add(@{ n = "clic a ciegas ($off px del borde)"; tipo = 'clic'; x = $cx; y = ($r.Bottom - $off) })
      }
    }

    foreach ($e in $estrategias) {
      switch ($e.tipo) {
        'tecla' { [System.Windows.Forms.SendKeys]::SendWait($e.k); Start-Sleep -Milliseconds 700 }
        'clic'  {
          $antes = New-Object PT
          [PuenteWin]::GetCursorPos([ref]$antes) | Out-Null
          [PuenteWin]::Click($e.x, $e.y)
          Start-Sleep -Milliseconds 600
          [PuenteWin]::SetCursorPos($antes.X, $antes.Y) | Out-Null
        }
      }

      [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
      Set-Clipboard -Value $Texto;                     Start-Sleep -Milliseconds 350
      [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 1000

      [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
      [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 700
      [System.Windows.Forms.SendKeys]::SendWait('{END}')
      $leido = $null
      try { $leido = Get-Clipboard -Raw } catch { }

      if ($null -ne $leido -and $leido.Trim() -eq $Texto.Trim()) {
        Log "  $Etiqueta : verificado con '$($e.n)' ($($Texto.Length) car.)"
        if ($NoEnviar) { Log "  $Etiqueta : modo PRUEBA, no pulso Enter (esto es lo esperado)."; return 0 }
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        Start-Sleep -Milliseconds 1500
        Log "  $Etiqueta : ENVIADO."
        return 0
      }

      $n = if ($leido) { $leido.Length } else { 0 }
      $pista = ''
      if ($n -gt 2000)            { $pista = ' (es la pagina entera: el cursor no esta en la caja)' }
      elseif ($n -gt 0 -and $n -lt 200) { $pista = ' (cayo en otro campo pequeno)' }
      Log "  $Etiqueta : '$($e.n)' no colo (leidos $n car.)$pista"
    }

    Log "  $Etiqueta : ninguna estrategia funciono. NO se envio nada."
    Log "  $Etiqueta : prueba CALIBRAR para senalarle la caja con el raton."
    return 4
  }

  Log '=== PUENTE DOS IAS ==='
  Log "    ChatGPT : ventana que contenga '$TituloChatGPT'"
  Log "    Claude  : ventana que contenga '$TituloClaude'"
  Log "    cada $Minutos min. Ctrl+C para parar."
  if ($Prueba)   { Log '    MODO PRUEBA: escribe y verifica pero NO pulsa Enter.' }
  if ($SinRaton) { Log '    SIN RATON: solo atajos de teclado.' }
  $c = Leer-Calibracion
  if ($c) { Log "    calibracion cargada de $FicCal" } else { Log '    sin calibracion (usa clics a ciegas)' }
  Log "    log: $Log"
  Log ''

  while ($true) {
    Log '--- ciclo ---'
    $a = Enviar $TituloChatGPT 'ChatGPT'     $Mensaje ([bool]$Prueba)
    Start-Sleep -Seconds 3
    $b = Enviar $TituloClaude  'Claude Code' $Mensaje ([bool]$Prueba)
    Log "ciclo terminado. ChatGPT=$a Claude=$b   (0=ok 2=sin ventana 3=sin foco 4=no coincide)"

    if ($Prueba -or $SoloUnaVez) { Log 'una sola pasada.'; Fin 0 }

    $prox = (Get-Date).AddMinutes($Minutos).ToString('HH:mm:ss')
    Log "esperando. proximo ciclo a las $prox"
    Log ''
    Start-Sleep -Seconds ($Minutos * 60)
  }

}
catch {
  Write-Host ''
  Write-Host '###############  ERROR  ###############' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host $_.ScriptStackTrace
  Fin 1
}
