# puente_chatgpt_bucle.ps1
#
# Bucle que corre en el PC del operador y escribe en ChatGPT lo que Claude
# deje en el repositorio. NO necesita Remote Desktop Commander: el PC va a
# buscar el mensaje, en vez de que alguien se lo meta desde fuera.
#
# Arranque desde CMD:
#   powershell -NoProfile -ExecutionPolicy Bypass -File puente_chatgpt_bucle.ps1
#
# Se para con Ctrl+C.
#
# --- Por que esta hecho asi, y no de la forma obvia -------------------------
#  - SetForegroundWindow solo NO basta: Windows bloquea el robo de foco desde
#    un proceso de fondo, devuelve True y no hace nada. Hace falta el truco
#    del ALT (keybd_event 0x12) mas AttachThreadInput al hilo activo.
#  - SendKeys para el TEXTO no vale: con Bloq Mayus activo invierte las
#    mayusculas (comprobado el 28/08: salio "prueba de canal DESDE cLAUDE"),
#    y el teclado ESP rompe simbolos. Se pega por portapapeles.
#  - Shift+Esc es el atajo de ChatGPT que lleva el cursor al cuadro.
#  - GinsBrowser pone el nombre de la CONVERSACION en el titulo, no "ChatGPT".
#
# --- Las dos salvaguardas --------------------------------------------------
#  - No escribe si no confirma el foco en la ventana correcta.
#  - No pulsa Enter sin releer lo pegado y compararlo caracter a caracter.

param(
  [int]$SegundosEntreConsultas = 60,
  [string]$TituloVentana = 'Acceso a repositorios GitHub',
  [string]$Url = 'https://raw.githubusercontent.com/edgardtume-a11y/claude/claude/remote-connection-nztu9t/puente_pc/pendiente.json',
  [switch]$SoloUnaVez
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
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
}
"@

$Base      = Split-Path -Parent $MyInvocation.MyCommand.Path
$FicheroId = Join-Path $Base 'ultimo_id.txt'
$Log       = Join-Path $Base 'puente.log'

function Escribir-Log([string]$txt) {
  $linea = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $txt
  Write-Host $linea
  try { Add-Content -Path $Log -Value $linea -Encoding UTF8 } catch { }
}

function Get-TituloActivo {
  $sb = New-Object System.Text.StringBuilder 300
  [PuenteWin]::GetWindowText([PuenteWin]::GetForegroundWindow(), $sb, 300) | Out-Null
  $sb.ToString()
}

function Enviar-AChatGPT([string]$Mensaje) {
  $w = Get-Process -Name ginsbrowser -EA SilentlyContinue |
       Where-Object { $_.MainWindowTitle -match [regex]::Escape($TituloVentana) } |
       Select-Object -First 1
  if (-not $w) { Escribir-Log "  ERROR: no encuentro la ventana '$TituloVentana'"; return $false }

  $conseguido = $false
  for ($i = 1; $i -le 5 -and -not $conseguido; $i++) {
    [PuenteWin]::Forzar($w.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 900
    if ((Get-TituloActivo) -match [regex]::Escape($TituloVentana)) { $conseguido = $true }
  }
  if (-not $conseguido) {
    Escribir-Log "  SIN FOCO (esta en '$(Get-TituloActivo)'). No escribo. Reintento al proximo ciclo."
    return $false
  }

  [System.Windows.Forms.SendKeys]::SendWait("+{ESC}")   # cursor al cuadro
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 300
  Set-Clipboard -Value $Mensaje
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 1000

  # releer antes de enviar
  [System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait("^c"); Start-Sleep -Milliseconds 700
  [System.Windows.Forms.SendKeys]::SendWait("{END}")
  $leido = (Get-Clipboard -Raw)

  if ($null -eq $leido -or $leido.Trim() -ne $Mensaje.Trim()) {
    $n = if ($leido) { $leido.Length } else { 0 }
    Escribir-Log "  NO COINCIDE (leidos $n car., esperados $($Mensaje.Length)). NO envio."
    return $false
  }

  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Milliseconds 1500
  Escribir-Log "  ENVIADO ($($Mensaje.Length) caracteres)."
  return $true
}

Escribir-Log "=== puente arrancado. ventana='$TituloVentana', cada $SegundosEntreConsultas s ==="
Escribir-Log "    buzon: $Url"
Escribir-Log "    Ctrl+C para parar."

while ($true) {
  try {
    # salta la cache del CDN de GitHub
    $u = $Url + '?t=' + [Guid]::NewGuid().ToString('N')
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30 `
           -Headers @{ 'Cache-Control' = 'no-cache'; 'Pragma' = 'no-cache' }
    $doc = $r.Content | ConvertFrom-Json

    $ultimo = ''
    if (Test-Path $FicheroId) { $ultimo = (Get-Content $FicheroId -Raw).Trim() }

    if ([string]::IsNullOrWhiteSpace($doc.mensaje)) {
      # buzon vacio a proposito: no hay nada que enviar
    }
    elseif ($doc.id -eq $ultimo) {
      # ya enviado
    }
    else {
      Escribir-Log "MENSAJE NUEVO id='$($doc.id)' ($($doc.mensaje.Length) car.)"
      if (Enviar-AChatGPT $doc.mensaje) {
        Set-Content -Path $FicheroId -Value $doc.id -Encoding UTF8
      }
    }
  }
  catch {
    Escribir-Log "aviso: $($_.Exception.Message)"
  }

  if ($SoloUnaVez) { Escribir-Log "SoloUnaVez: salgo."; break }
  Start-Sleep -Seconds $SegundosEntreConsultas
}
