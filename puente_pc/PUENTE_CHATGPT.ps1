# PUENTE_CHATGPT.ps1  (v3)
#
# Escribe un mensaje en ChatGPT cada N minutos y comprueba que se envio.
#
# LANZARLO (una sola linea, para que la consola no la parta):
#   Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\ruta\PUENTE_CHATGPT.ps1"
#
# Primero conviene calibrar una vez:
#   & "C:\ruta\PUENTE_CHATGPT.ps1" -Calibrar
#
# --------------------------------------------------------------------------
# LO QUE SE ARREGLA EN LA v3, y por que
#
# 1. FUERA Shift+Esc. En un navegador Chromium (GinsBrowser lo es) ese atajo
#    abre el ADMINISTRADOR DE TAREAS DEL NAVEGADOR. Medido en la maquina del
#    operador: el foco se iba y el mensaje acababa escrito en la consola de
#    PowerShell. Ahora se hace clic en la caja, que no depende de atajos.
#
# 2. Se vuelve a comprobar el foco JUSTO ANTES de teclear. Antes se
#    comprobaba solo al principio, y cualquier cosa que moviera el foco
#    despues (como el propio Shift+Esc) pasaba desapercibida.
#
# 3. Si el foco no es el correcto en ese instante, NO se pulsa ninguna tecla.
#
# LO QUE SE CONSERVA
#  - SetForegroundWindow solo no basta: Windows bloquea el robo de foco,
#    devuelve True y no hace nada. Hace falta el truco del ALT
#    (keybd_event 0x12) mas AttachThreadInput al hilo activo.
#  - SendKeys para el TEXTO no vale: con Bloq Mayus invierte las mayusculas
#    y el teclado ESP rompe simbolos. Se pega por portapapeles.
#  - El navegador pone el nombre de la CONVERSACION en el titulo.
# --------------------------------------------------------------------------

param(
  [string]$Titulo  = 'Activar Remote Desktop',
  [int]$Minutos    = 10,
  [string]$Mensaje = 'MEJOREN LA LATENCIA. COMUNICATE CON LA OTRA IA. CONTINUA CONVERSANDO, NO PARES HASTA QUE EL DUENO TE DIGA QUE PARES.',
  [switch]$Prueba,
  [switch]$Listar,
  [switch]$Calibrar
)

$ErrorActionPreference = 'Stop'

function Fin($codigo) {
  Write-Host ''
  Write-Host '======================================================'
  Write-Host " Terminado. Codigo: $codigo"
  Write-Host '======================================================'
  # La pausa es imprescindible: si lo abres con doble clic o con
  # "Ejecutar con PowerShell", la ventana es del propio script y se cierra
  # en cuanto termina. Sin esto no da tiempo a leer nada.
  try { Read-Host 'Pulsa Enter para cerrar' | Out-Null } catch { Start-Sleep -Seconds 60 }
  exit $codigo
}

try {

$Base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Log  = Join-Path $Base 'puente_chatgpt.log'
$FCal = Join-Path $Base 'calibracion_chatgpt.json'

function Log($t) {
  $l = "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $t
  Write-Host $l
  try { Add-Content -Path $Log -Value $l -Encoding UTF8 } catch { }
}

Log '=== PUENTE CHATGPT v3 ==='
Log "    PowerShell $($PSVersionTable.PSVersion)"

Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public struct RC { public int Left, Top, Right, Bottom; }
public struct PP { public int X, Y; }
public class PW {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out PP p);
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
    mouse_event(0x0004,0,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(150);
  }
}
"@
Log '    API de ventanas y raton cargada'

function Activo {
  $sb = New-Object System.Text.StringBuilder 300
  [PW]::GetWindowText([PW]::GetForegroundWindow(), $sb, 300) | Out-Null
  $sb.ToString()
}

function Ventanas {
  Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
    Log ("    [{0,-14}] {1}" -f $_.ProcessName, $_.MainWindowTitle)
  }
}

function Buscar { Get-Process | Where-Object {
    $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1 }

if ($Listar) { Log 'ventanas abiertas:'; Ventanas; Fin 0 }

# ---- CALIBRAR ------------------------------------------------------------
if ($Calibrar) {
  $w = Buscar
  if (-not $w) { Log "no encuentro ventana con '$Titulo'"; Ventanas; Fin 2 }
  Log "ventana: '$($w.MainWindowTitle)'"
  Log ''
  Log '>>> PON EL RATON encima de la CAJA DE ESCRIBIR de ChatGPT.'
  Log '    No hace falta que hagas clic. Solo dejalo ahi quieto.'
  for ($s = 10; $s -ge 1; $s--) { Write-Host "    capturo en $s..."; Start-Sleep -Seconds 1 }
  $p = New-Object PP; [PW]::GetCursorPos([ref]$p) | Out-Null
  $r = New-Object RC; [PW]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
  @{ dx = ($p.X - $r.Left); dy = ($p.Y - $r.Top) } | ConvertTo-Json | Set-Content $FCal -Encoding UTF8
  Log "guardado: dx=$($p.X - $r.Left)  dy=$($p.Y - $r.Top)  en $FCal"
  Log 'Ahora lanzalo con -Prueba para comprobarlo.'
  Fin 0
}

# ---- utilidades ----------------------------------------------------------
function ConFoco { (Activo) -like "*$Titulo*" }

# Teclea SOLO si el foco sigue siendo la ventana correcta.
function Teclas($k) {
  if (-not (ConFoco)) { throw "el foco se fue a '$(Activo)'" }
  [System.Windows.Forms.SendKeys]::SendWait($k)
}

function LeerCaja {
  Teclas '^a'; Start-Sleep -Milliseconds 300
  Teclas '^c'; Start-Sleep -Milliseconds 700
  Teclas '{END}'
  try { return (Get-Clipboard -Raw) } catch { return $null }
}

function Enviar {
  $w = Buscar
  if (-not $w) { Log "NO hay ventana que contenga '$Titulo'. Hay estas:"; Ventanas; return 2 }
  Log "ventana: '$($w.MainWindowTitle)'"

  $ok = $false
  for ($i = 1; $i -le 5 -and -not $ok; $i++) {
    [PW]::Forzar($w.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 900
    if (ConFoco) { $ok = $true }
  }
  if (-not $ok) { Log "SIN FOCO (activa: '$(Activo)'). No toco nada."; return 3 }

  $r = New-Object RC; [PW]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
  $cx = [int](($r.Left + $r.Right) / 2)

  # donde hacer clic para meter el cursor en la caja
  $puntos = New-Object System.Collections.ArrayList
  if (Test-Path $FCal) {
    try {
      $c = Get-Content $FCal -Raw | ConvertFrom-Json
      [void]$puntos.Add(@{ n='calibrado'; x=($r.Left + [int]$c.dx); y=($r.Top + [int]$c.dy) })
    } catch { }
  }
  foreach ($off in 95, 130, 70, 165) {
    [void]$puntos.Add(@{ n="a $off px del borde"; x=$cx; y=($r.Bottom - $off) })
  }

  foreach ($p in $puntos) {
    try {
      if (-not (ConFoco)) { Log "  el foco se fue a '$(Activo)'. Corto aqui."; return 3 }
      $antes = New-Object PP; [PW]::GetCursorPos([ref]$antes) | Out-Null
      [PW]::Click($p.x, $p.y)
      Start-Sleep -Milliseconds 500
      [PW]::SetCursorPos($antes.X, $antes.Y) | Out-Null

      Teclas '^a'; Start-Sleep -Milliseconds 300
      Set-Clipboard -Value $Mensaje; Start-Sleep -Milliseconds 400
      Teclas '^v'; Start-Sleep -Milliseconds 1000

      $leido = LeerCaja
      if ($null -ne $leido -and $leido.Trim() -eq $Mensaje.Trim()) {
        Log "  texto escrito y verificado con clic '$($p.n)' ($($Mensaje.Length) car.)"
        if ($Prueba) { Log '  MODO PRUEBA: lo dejo sin enviar.'; return 0 }

        foreach ($f in @(
            @{ n='Enter';            a={ Teclas '{ENTER}' } },
            @{ n='Enter otra vez';   a={ Teclas '{ENTER}' } },
            @{ n='Ctrl+Enter';       a={ Teclas '^{ENTER}' } },
            @{ n='clic en el boton'; a={ [PW]::Click(($r.Right - 60), ($r.Bottom - 95)) } })) {
          & $f.a
          Start-Sleep -Milliseconds 1800
          $q = LeerCaja
          $n = if ($q) { $q.Trim().Length } else { 0 }
          if ($n -lt 10) { Log "  ENVIADO (con '$($f.n)')."; return 0 }
          Log "  '$($f.n)' no envio: quedan $n car."
        }
        Log '  escrito pero NO enviado. Pulsa Enter tu.'
        return 5
      }

      $n = if ($leido) { $leido.Length } else { 0 }
      Log "  clic '$($p.n)' no colo (leidos $n car.)"
    }
    catch { Log "  clic '$($p.n)': $($_.Exception.Message)"; return 3 }
  }

  Log 'ningun clic acerto. Lanza el script con -Calibrar y senalale la caja.'
  return 4
}

Log "    ventana que contenga: '$Titulo'"
Log "    cada $Minutos minutos.  Ctrl+C para parar."
if ($Prueba) { Log '    MODO PRUEBA: escribe pero no envia.' }
if (Test-Path $FCal) { Log '    calibracion cargada' } else { Log '    sin calibrar (usa clics calculados)' }
Log '    la sesion de Windows tiene que estar DESBLOQUEADA.'
Log ''

while ($true) {
  $res = Enviar
  Log "resultado: $res  (0=ok 2=sin ventana 3=foco perdido 4=ningun clic acerto 5=escribio pero no envio)"
  if ($Prueba) { Fin $res }
  Log "proximo envio a las $((Get-Date).AddMinutes($Minutos).ToString('HH:mm:ss'))"
  Log ''
  Start-Sleep -Seconds ($Minutos * 60)
}

}
catch {
  Write-Host ''
  Write-Host '##########  ERROR  ##########' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host $_.ScriptStackTrace
  Fin 1
}
