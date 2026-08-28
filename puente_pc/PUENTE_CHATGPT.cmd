@echo off
rem ===================================================================
rem  PUENTE CHATGPT - ARCHIVO UNICO  (v2)
rem
rem  Escribe un mensaje en ChatGPT cada N minutos y COMPRUEBA que se
rem  envio de verdad. Sirve para bajar de la hora que permite la tarea
rem  programada de ChatGPT.
rem
rem  DOBLE CLIC y ya. No necesita ningun otro archivo al lado.
rem  Borra las versiones anteriores para no confundirte.
rem ===================================================================
title PUENTE CHATGPT
powershell.exe -NoProfile -ExecutionPolicy Bypass -Sta -Command "$c = Get-Content -LiteralPath '%~f0' -Raw; $ps = $c.Substring($c.IndexOf('#PSSTART') + 8); Invoke-Expression $ps"
echo.
pause
exit /b

#PSSTART

# --------------------------------------------------------------------
# NOVEDAD v2: comprueba que el mensaje SE ENVIO, no solo que se escribio.
#
# Antes se pulsaba Enter y se daba por hecho. Ahora, despues del Enter,
# relee la caja: si quedo VACIA, el mensaje salio. Si sigue con texto,
# el Enter no llego, y entonces prueba:
#   1) Enter otra vez
#   2) Ctrl+Enter (algunas versiones lo usan para enviar)
#   3) clic en el boton de enviar, abajo a la derecha de la caja
#
# Solo ChatGPT. Claude Code no tiene atajo para meter el cursor en su
# caja de escribir, asi que este puente no lo toca.
#
# LO QUE COSTO ENCONTRAR
#  - SetForegroundWindow solo no basta: Windows bloquea el robo de foco,
#    devuelve True y no hace nada. Hace falta el truco del ALT
#    (keybd_event 0x12) mas AttachThreadInput al hilo activo.
#  - SendKeys para el TEXTO no vale: con Bloq Mayus invierte las
#    mayusculas y el teclado ESP rompe simbolos. Se pega por portapapeles.
#  - El navegador pone el nombre de la CONVERSACION en el titulo, no
#    "ChatGPT". Si la renombras, cambia el titulo.
# --------------------------------------------------------------------

$TITULO  = 'Activar Remote Desktop'
$MINUTOS = 10
$MENSAJE = 'MEJOREN LA LATENCIA. COMUNICATE CON LA OTRA IA. CONTINUA CONVERSANDO, NO PARES HASTA QUE EL DUENO TE DIGA QUE PARES.'

$ErrorActionPreference = 'Stop'
try {

Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
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
    PP a; GetCursorPos(out a);
    SetCursorPos(x, y); System.Threading.Thread.Sleep(150);
    mouse_event(0x0002,0,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(60);
    mouse_event(0x0004,0,0,0,IntPtr.Zero); System.Threading.Thread.Sleep(150);
    SetCursorPos(a.X, a.Y);
  }
}
'@

function Log($t) { Write-Host ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }

function Activo {
  $sb = New-Object System.Text.StringBuilder 300
  [PW]::GetWindowText([PW]::GetForegroundWindow(), $sb, 300) | Out-Null
  $sb.ToString()
}

# lee lo que hay ahora mismo en la caja de escribir
function LeerCaja {
  [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 700
  [System.Windows.Forms.SendKeys]::SendWait('{END}')
  try { return (Get-Clipboard -Raw) } catch { return $null }
}

function Enviar {
  $w = Get-Process | Where-Object {
         $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -like "*$TITULO*"
       } | Select-Object -First 1

  if (-not $w) {
    Log "NO encuentro ninguna ventana que contenga '$TITULO'"
    Log 'Ventanas abiertas ahora mismo:'
    Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
      Log ("    [{0,-14}] {1}" -f $_.ProcessName, $_.MainWindowTitle)
    }
    Log "Si tu conversacion se llama de otra forma, edita este .cmd y cambia"
    Log "la linea que empieza por  TITULO  =  ..."
    return 2
  }
  Log "ventana: '$($w.MainWindowTitle)'"

  $ok = $false
  for ($i = 1; $i -le 5 -and -not $ok; $i++) {
    [PW]::Forzar($w.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 900
    if ((Activo) -like "*$TITULO*") { $ok = $true }
  }
  if (-not $ok) { Log "SIN FOCO (activa: '$(Activo)'). No escribo nada."; return 3 }

  # 1) escribir
  [System.Windows.Forms.SendKeys]::SendWait('+{ESC}')   # Shift+Esc: cursor a la caja
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 300
  Set-Clipboard -Value $MENSAJE;                   Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 1000

  # 2) comprobar que se escribio bien
  $leido = LeerCaja
  if ($null -eq $leido -or $leido.Trim() -ne $MENSAJE.Trim()) {
    $n = if ($leido) { $leido.Length } else { 0 }
    Log "lo escrito no coincide (leidos $n car., esperados $($MENSAJE.Length)). NO envio."
    return 4
  }
  Log "texto escrito y verificado ($($MENSAJE.Length) car.). Ahora lo envio."

  # 3) enviar, y COMPROBAR que salio: la caja tiene que quedar vacia
  $r = New-Object RC
  [PW]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null

  $intentos = @(
    @{ n = 'Enter';       accion = { [System.Windows.Forms.SendKeys]::SendWait('{ENTER}') } },
    @{ n = 'Enter otra vez'; accion = { [System.Windows.Forms.SendKeys]::SendWait('{ENTER}') } },
    @{ n = 'Ctrl+Enter';  accion = { [System.Windows.Forms.SendKeys]::SendWait('^{ENTER}') } },
    @{ n = 'clic en el boton de enviar'; accion = {
        # el boton esta abajo a la derecha de la caja
        [PW]::Click(($r.Right - 60), ($r.Bottom - 95))
      } }
  )

  foreach ($it in $intentos) {
    & $it.accion
    Start-Sleep -Milliseconds 1800
    $queda = LeerCaja
    $n = if ($queda) { $queda.Trim().Length } else { 0 }
    if ($n -lt 10) {
      Log "ENVIADO (con '$($it.n)'; la caja quedo vacia)."
      return 0
    }
    Log "  '$($it.n)' no envio: la caja aun tiene $n caracteres. Pruebo lo siguiente."
  }

  Log 'NO se pudo enviar. El texto se queda escrito en la caja; pulsa Enter tu.'
  return 5
}

Log '=== PUENTE CHATGPT (archivo unico, v2) ==='
Log "    ventana que contenga: '$TITULO'"
Log "    cada $MINUTOS minutos.  Ctrl+C para parar."
Log '    la sesion de Windows tiene que estar DESBLOQUEADA.'
Log ''

while ($true) {
  $res = Enviar
  Log "resultado: $res   (0=enviado 2=sin ventana 3=sin foco 4=no escribio 5=escribio pero no envio)"
  $prox = (Get-Date).AddMinutes($MINUTOS).ToString('HH:mm:ss')
  Log "proximo envio a las $prox"
  Log ''
  Start-Sleep -Seconds ($MINUTOS * 60)
}

}
catch {
  Write-Host ''
  Write-Host '##########  ERROR  ##########' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host $_.ScriptStackTrace
  Read-Host 'Pulsa Enter para cerrar'
}
