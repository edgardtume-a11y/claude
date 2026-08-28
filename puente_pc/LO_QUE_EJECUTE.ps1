# LO_QUE_EJECUTE.ps1
#
# Esto es EXACTAMENTE el codigo que ejecute en tu PC por Remote Desktop
# Commander, sin cambios. Con esto:
#   - encontre la ventana 'Activar Remote Desktop - GinsBrowser'
#   - le robe el foco
#   - hice clic en la caja de escribir: ACERTARON LAS 6 ALTURAS probadas
#   - pegue 150 caracteres y los verifique uno a uno: CORRECTO
#   - pulse Enter: eso es lo unico que no llegue a confirmar
#
# LANZARLO (una linea):
#   Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\ruta\LO_QUE_EJECUTE.ps1"
#
# MODOS:
#   -Sondear   prueba 6 alturas de clic y dice cuales aciertan (no envia)
#   -Escribir  escribe el mensaje y lo verifica (no envia)
#   (sin nada) escribe, verifica y pulsa Enter

param(
  [string]$Titulo  = 'Activar Remote Desktop',
  [string]$Mensaje = 'Claude aqui, por el puente del PC. Prueba de envio automatico.',
  [switch]$Sondear,
  [switch]$Escribir
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
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);

  // El truco del ALT + AttachThreadInput. Sin esto, SetForegroundWindow
  // devuelve True y NO HACE NADA: Windows bloquea el robo de foco.
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
}
"@

function Pausa($c) {
  Write-Host ''
  Write-Host "== terminado, codigo $c =="
  try { Read-Host 'Pulsa Enter para cerrar' | Out-Null } catch { Start-Sleep 60 }
  exit $c
}

$w = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
if (-not $w) {
  "NO encuentro ventana con '$Titulo'. Ventanas abiertas:"
  Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
    "   [{0,-14}] {1}" -f $_.ProcessName, $_.MainWindowTitle
  }
  Pausa 2
}

$r = New-Object RC
[PW]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
$cx = [int](($r.Left + $r.Right) / 2)

"ventana: $($w.MainWindowTitle)"
"rectangulo: Left=$($r.Left) Top=$($r.Top) Right=$($r.Right) Bottom=$($r.Bottom)"
"            ancho=$($r.Right-$r.Left)  alto=$($r.Bottom-$r.Top)"
""

# ---------- SONDEO: que alturas de clic aciertan en la caja ----------------
if ($Sondear) {
  $TEST = 'zzz_prueba_claude_zzz'
  'sondeo de alturas (no se envia nada):'
  foreach ($off in 60,75,90,105,120,140) {
    [PW]::Forzar($w.MainWindowHandle) | Out-Null; Start-Sleep -Milliseconds 700
    $y = $r.Bottom - $off
    [PW]::Click($cx, $y); Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 200
    Set-Clipboard -Value $TEST; Start-Sleep -Milliseconds 250
    [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 700
    [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 500
    $leido = try { Get-Clipboard -Raw } catch { '' }
    $n  = if ($leido) { $leido.Trim().Length } else { 0 }
    $ok = if ($leido -and $leido.Trim() -eq $TEST) { 'ACIERTO <<<<<' } else { '' }
    "  off=$off  y=$y  leidos=$n  $ok"
  }
  ''
  'Limpia la caja a mano antes de usar el modo normal.'
  Pausa 0
}

# ---------- ESCRIBIR (y enviar, si no se pide -Escribir) -------------------
[PW]::Forzar($w.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 900

$sb = New-Object System.Text.StringBuilder 300
[PW]::GetWindowText([PW]::GetForegroundWindow(), $sb, 300) | Out-Null
"foco: '$($sb.ToString())'"
if ($sb.ToString() -notlike "*$Titulo*") { 'SIN FOCO. No toco nada.'; Pausa 3 }

[PW]::Click($cx, ($r.Bottom - 90)); Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
Set-Clipboard -Value $Mensaje; Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 900

[System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 600
[System.Windows.Forms.SendKeys]::SendWait('{END}')
$v = try { Get-Clipboard -Raw } catch { '' }

if ($v.Trim() -ne $Mensaje.Trim()) {
  "FALLO al escribir: leidos $($v.Length), esperados $($Mensaje.Length)"
  if ($v) { "lo que hay en la caja:"; $v.Substring(0, [Math]::Min(200, $v.Length)) }
  Pausa 4
}

"escrito y verificado ($($Mensaje.Length) caracteres)"

if ($Escribir) { 'modo -Escribir: lo dejo sin enviar. Pulsa Enter tu.'; Pausa 0 }

'pulso ENTER...'
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 2500

# AVISO: comprobar el envio con Ctrl+A NO es fiable. En una caja VACIA,
# Ctrl+A selecciona toda la pagina, asi que se leen miles de caracteres y
# parece que no se envio cuando si se envio. Mirar la pantalla es lo unico
# que no miente.
'Enter pulsado. MIRA LA PANTALLA: si el mensaje aparece en la conversacion, funciono.'
Pausa 0
