# PUENTE_TECLEA.ps1  (v2 - encuentra ChatGPT solo, por la URL)
#
# Escribe un mensaje en ChatGPT tecleandolo letra a letra.
# ARCHIVO UNICO. No necesita nada al lado.
#
# LANZARLO (siempre en UNA sola linea):
#   Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\ruta\PUENTE_TECLEA.ps1" -Escribir
#   & "C:\ruta\PUENTE_TECLEA.ps1"                    (teclea y envia, una vez)
#   & "C:\ruta\PUENTE_TECLEA.ps1" -Bucle -Minutos 30
#   & "C:\ruta\PUENTE_TECLEA.ps1" -Listar            (que ventanas hay)
#
# ==========================================================================
# ENCUENTRA LA VENTANA SOLO
#
# El titulo lleva el nombre de la CONVERSACION, que cambia cada vez que la
# renombras o abres otra. Asi que no se busca por titulo: se le pregunta al
# navegador por su URL.
#
# Ctrl+L selecciona la barra de direcciones, Ctrl+C la copia, Escape la
# suelta. Si la URL contiene chatgpt.com, esa es la ventana. Funciona en
# cualquier navegador Chromium y no depende de como se llame el chat.
#
# Con -Titulo "loquesea" se salta la deteccion y se usa ese titulo.
# ==========================================================================
# POR QUE TECLEAR Y NO PEGAR
#
# Con el texto VISIBLE en la caja, ChatGPT mostraba "El mensaje esta vacio"
# junto al boton de enviar. ChatGPT usa React: Ctrl+V mete el texto en el
# DOM pero no dispara los eventos que React necesita, asi que su estado
# interno sigue vacio, el boton queda desactivado y el Enter no hace nada.
# Tecleando caracter a caracter si se disparan.
#
# El Bloq Mayus invertia las mayusculas al teclear (medido: salio
# "prueba de canal DESDE cLAUDE"). Se apaga antes y se deja como estaba.
# ==========================================================================
# LO DEMAS QUE COSTO ENCONTRAR
#
#  - SetForegroundWindow solo NO basta: Windows bloquea el robo de foco,
#    devuelve True y no hace nada. Hace falta el truco del ALT
#    (keybd_event 0x12) mas AttachThreadInput al hilo activo.
#  - Shift+Esc NO sirve: en Chromium abre el administrador de tareas DEL
#    NAVEGADOR y se lleva el foco. Se hace clic en la caja.
#  - ESTA CONSOLA SE MINIMIZA antes de escribir. Si queda encima del
#    navegador, el clic cae en ella y el texto se teclea aqui: paso el
#    28/08 y en el log aparecio "Pulsa Enter para cerrar: ^Atengas."
#  - Comprobar el envio con Ctrl+A NO es fiable: en una caja VACIA, Ctrl+A
#    selecciona toda la pagina y parece que quedan miles de caracteres.
# ==========================================================================

param(
  [string]$Titulo  = '',
  [string]$Url     = 'chatgpt.com',
  [string]$Mensaje = 'Continua con el trabajo pendiente. No te detengas.',
  [int]$Minutos    = 30,
  [switch]$Escribir,
  [switch]$Bucle,
  [switch]$Listar
)

Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public struct RC { public int Left, Top, Right, Bottom; }
public class PW {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  public static bool Forzar(IntPtr h) {
    keybd_event(0x12,0,0,IntPtr.Zero); keybd_event(0x12,0,2,IntPtr.Zero);
    uint mio = GetCurrentThreadId();
    uint suyo = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
    AttachThreadInput(mio, suyo, true);
    ShowWindow(h,9); BringWindowToTop(h);
    bool r = SetForegroundWindow(h);
    AttachThreadInput(mio, suyo, false);
    return r;
  }
  public static void Click(int x, int y) {
    SetCursorPos(x, y); System.Threading.Thread.Sleep(150);
    mouse_event(0x0002,0,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(60);
    mouse_event(0x0004,0,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(200);
  }
  public static void PulsaBloqMayus() {
    keybd_event(0x14,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(40);
    keybd_event(0x14,0,2,IntPtr.Zero); System.Threading.Thread.Sleep(120);
  }
}
"@

$Base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Log  = Join-Path $Base 'puente_teclea.log'

function Log($t) {
  $l = "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $t
  Write-Host $l
  try { Add-Content -Path $Log -Value $l -Encoding UTF8 } catch { }
}

function Pausa($c) {
  Write-Host ''
  Write-Host "== terminado, codigo $c =="
  try { Read-Host 'Pulsa Enter para cerrar' | Out-Null } catch { Start-Sleep 60 }
  exit $c
}

function TituloActivo {
  $sb = New-Object System.Text.StringBuilder 300
  [PW]::GetWindowText([PW]::GetForegroundWindow(), $sb, 300) | Out-Null
  $sb.ToString()
}

function MinimizarConsola {
  $c = [PW]::GetConsoleWindow()
  if ($c -ne [IntPtr]::Zero) { [PW]::ShowWindow($c, 6) | Out-Null }
  Start-Sleep -Milliseconds 400
}
function RestaurarConsola {
  $c = [PW]::GetConsoleWindow()
  if ($c -ne [IntPtr]::Zero) { [PW]::ShowWindow($c, 9) | Out-Null }
  Start-Sleep -Milliseconds 300
}

function EscaparParaSendKeys([string]$t) { $t -replace '([+^%~(){}\[\]])', '{$1}' }

function BloqMayusActivo {
  [System.Windows.Forms.Control]::IsKeyLocked([System.Windows.Forms.Keys]::CapsLock)
}

function TeclearTexto([string]$t) {
  $trozo = 12
  for ($i = 0; $i -lt $t.Length; $i += $trozo) {
    $p = $t.Substring($i, [Math]::Min($trozo, $t.Length - $i))
    [System.Windows.Forms.SendKeys]::SendWait((EscaparParaSendKeys $p))
    Start-Sleep -Milliseconds 45
  }
  Start-Sleep -Milliseconds 500
}

# Lee la caja. IMPRESCINDIBLE vaciar el portapapeles antes: si Ctrl+C no
# copia nada (porque el cursor no esta en la caja), Get-Clipboard devuelve lo
# ANTERIOR y parece que si leyo algo. Paso el 28/08: devolvia la URL que se
# habia copiado al detectar la ventana, y daba una verificacion falsa.
$SENAL = '<<NADA_COPIADO>>'
function LeerCaja {
  try { Set-Clipboard -Value $SENAL } catch { }
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 600
  [System.Windows.Forms.SendKeys]::SendWait('{END}')
  $t = try { Get-Clipboard -Raw } catch { '' }
  if ($null -eq $t -or $t -eq $SENAL) { return '' }   # no se copio nada
  return $t
}

function VentanasNavegador {
  Get-Process | Where-Object {
    $_.MainWindowTitle -ne '' -and
    $_.ProcessName -match 'ginsbrowser|chrome|msedge|brave|opera|vivaldi'
  }
}

# Pregunta al navegador su URL: Ctrl+L selecciona la barra, Ctrl+C copia,
# Escape la suelta. No modifica nada.
function UrlDe($w) {
  if (-not [PW]::Forzar($w.MainWindowHandle)) { }
  Start-Sleep -Milliseconds 700
  if ((TituloActivo) -ne $w.MainWindowTitle) { return '' }
  [System.Windows.Forms.SendKeys]::SendWait('^l'); Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}'); Start-Sleep -Milliseconds 250
  try { return (Get-Clipboard -Raw).Trim() } catch { return '' }
}

function BuscarVentana {
  # 1) si dieron titulo a mano, se respeta
  if ($Titulo -ne '') {
    $w = Get-Process | Where-Object {
      $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -like "*$Titulo*"
    } | Select-Object -First 1
    if ($w) { Log "  encontrada por titulo: '$($w.MainWindowTitle)'" }
    return $w
  }
  # 2) si no, se busca por URL
  Log "  buscando la ventana cuya URL contenga '$Url'..."
  foreach ($w in VentanasNavegador) {
    $u = UrlDe $w
    $corta = if ($u.Length -gt 70) { $u.Substring(0,70) + '...' } else { $u }
    Log ("    [{0,-12}] {1}  ->  {2}" -f $_.ProcessName, $w.MainWindowTitle, $corta)
    if ($u -like "*$Url*") {
      Log "  ENCONTRADA: '$($w.MainWindowTitle)'"
      return $w
    }
  }
  return $null
}

# --------------------------------------------------------------------------
function UnCiclo {
  MinimizarConsola
  $w = BuscarVentana
  if (-not $w) {
    RestaurarConsola
    Log "NO encuentro ninguna ventana con '$Url' en la URL."
    Log 'Abre ChatGPT en el navegador, o pasa -Titulo "trozo del titulo".'
    return 2
  }

  $r = New-Object RC
  [PW]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
  $cx = [int](($r.Left + $r.Right) / 2)

  $ok = $false
  for ($i = 1; $i -le 5 -and -not $ok; $i++) {
    [PW]::Forzar($w.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 900
    if ((TituloActivo) -eq $w.MainWindowTitle) { $ok = $true }
  }
  if (-not $ok) { Log "SIN FOCO (activa: '$(TituloActivo)'). No toco nada."; return 3 }

  # La caja no esta siempre en el mismo sitio. Si ChatGPT abre un panel
  # lateral -- "Reading mode", los artefactos, el canvas -- la conversacion
  # se queda en la mitad izquierda y la caja YA NO esta en el centro
  # horizontal de la ventana. Paso el 28/08: los clics al centro caian en el
  # panel de lectura y leian 1951 caracteres de su texto.
  #
  # Asi que se prueba una rejilla: varias posiciones a lo ancho y a lo alto.
  # Para que sea rapido se sondea con dos letras; el mensaje entero solo se
  # teclea en el sitio que se verifica.
  $mayus = BloqMayusActivo
  if ($mayus) { Log '  Bloq Mayus estaba activo: lo apago'; [PW]::PulsaBloqMayus() }

  $ancho = $r.Right - $r.Left
  $xs = @(
    @{ n = 'izquierda'; x = [int]($r.Left + $ancho * 0.28) },
    @{ n = 'centro';    x = $cx },
    @{ n = 'derecha';   x = [int]($r.Left + $ancho * 0.72) }
  )
  $ys = @(90, 120, 65, 150)

  $sitio = $null
  :fuera foreach ($yy in $ys) {
    foreach ($xx in $xs) {
      $y = $r.Bottom - $yy
      [PW]::Click($xx.x, $y)
      Start-Sleep -Milliseconds 450
      [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 200
      [System.Windows.Forms.SendKeys]::SendWait('{DEL}'); Start-Sleep -Milliseconds 300
      [System.Windows.Forms.SendKeys]::SendWait('zz'); Start-Sleep -Milliseconds 450
      $p = LeerCaja
      if ($p -ne '' -and $p.Trim() -eq 'zz') {
        Log "  CAJA ENCONTRADA: $($xx.n), a $yy px del borde inferior"
        $sitio = @{ x = $xx.x; y = $y }
        break fuera
      }
      $n = if ($p) { $p.Trim().Length } else { 0 }
      Log "  sondeo $($xx.n)/$yy px: no (leidos $n)"
    }
  }

  if (-not $sitio) {
    if ($mayus) { [PW]::PulsaBloqMayus() }
    Log '  no encuentro la caja de escribir.'
    Log '  Prueba a cerrar los paneles laterales de ChatGPT (Reading mode,'
    Log '  artefactos, canvas) y maximizar la ventana; luego repite.'
    return 4
  }

  # ahora si, el mensaje de verdad, en el sitio que funciono
  [PW]::Click($sitio.x, $sitio.y); Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait('{DEL}'); Start-Sleep -Milliseconds 350
  Log "  tecleando $($Mensaje.Length) caracteres..."
  TeclearTexto $Mensaje
  $leido = LeerCaja

  if ($mayus) { [PW]::PulsaBloqMayus(); Log '  Bloq Mayus devuelto' }

  if ($leido -eq '' -or $leido.Trim() -ne $Mensaje.Trim()) {
    $n = if ($leido) { $leido.Trim().Length } else { 0 }
    Log "  lo tecleado no coincide (leidos $n, esperados $($Mensaje.Length))"
    return 4
  }
  Log "  tecleado y verificado ($($Mensaje.Length) car.)"

  if ($Escribir) { Log '  modo -Escribir: NO pulso Enter.'; return 0 }

  [System.Windows.Forms.SendKeys]::SendWait('{END}'); Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 2500
  Log '  Enter pulsado. MIRA LA PANTALLA para confirmar.'
  return 0
}

# --------------------------------------------------------------------------
Log '=== PUENTE TECLEA v2 ==='
Log "    PowerShell $($PSVersionTable.PSVersion)"
if ($Titulo -ne '') { Log "    ventana por titulo: '$Titulo'" }
else { Log "    ventana por URL: '$Url'" }
Log "    log: $Log"

if ($Listar) {
  Log 'ventanas de navegador y su URL:'
  MinimizarConsola
  $res = @()
  foreach ($w in VentanasNavegador) {
    $u = UrlDe $w
    $res += [pscustomobject]@{ Proceso=$w.ProcessName; Titulo=$w.MainWindowTitle; Url=$u }
  }
  RestaurarConsola
  foreach ($x in $res) { Log ("  [{0,-12}] {1}`n                 {2}" -f $x.Proceso, $x.Titulo, $x.Url) }
  Pausa 0
}

if (-not $Bucle) {
  $c = UnCiclo
  RestaurarConsola
  Log "resultado: $c  (0=ok 2=sin ventana 3=sin foco 4=no coincide)"
  Pausa $c
}

Log "    BUCLE cada $Minutos minutos. Ctrl+C para parar."
Log '    la sesion de Windows tiene que estar DESBLOQUEADA.'
Log ''
while ($true) {
  $c = UnCiclo
  RestaurarConsola
  Log "resultado: $c  (0=ok 2=sin ventana 3=sin foco 4=no coincide)"
  Log "proximo a las $((Get-Date).AddMinutes($Minutos).ToString('HH:mm:ss'))"
  Log ''
  Start-Sleep -Seconds ($Minutos * 60)
}
