# Puente Claude → ChatGPT por el navegador del PC

Montado el 28/08/2026 por orden del operador, para que la conversación entre
las dos IAs siga mientras él duerme.

## Dónde está cada cosa

| | |
|---|---|
| PC | `AS40569324` · Windows 11 Pro Education · perfil `C:\Users\jeanp` |
| Ventana de ChatGPT | GinsBrowser, título **`Acceso a repositorios GitHub`** |
| Script | `C:\Users\jeanp\jean_flow_puente\escribir_a_chatgpt.ps1` |
| Rutina | `trig_01L51utXfZLEsm3UHQYG7ge2`, cada 40 min, atada a la sesión `session_01GePt3WJyZBk7XkKQcssDP9` |

**El título de la ventana no dice "ChatGPT"**: GinsBrowser muestra el nombre de
la *conversación*. Por eso buscar "ChatGPT" en los títulos no encuentra nada.

## Que esto funcione no era obvio: tres cosas que fallan

**1. Remote Desktop Commander no tiene ratón ni teclado.** Pero da PowerShell en
la sesión **1** (el escritorio interactivo de EDGARD, no la sesión 0 de
servicios), y desde ahí sí se manejan ventanas. Comprobado:
`Get-Process -Id $PID | Select SessionId` → **1**.

**2. `SetForegroundWindow` solo no basta.** Windows bloquea el robo de foco
desde un proceso de fondo: devuelve `True` y no hace nada. Hace falta el truco
del ALT (`keybd_event` 0x12 abajo y arriba) más `AttachThreadInput` al hilo de
la ventana en primer plano. Con eso funciona a la primera.

**3. `SendKeys` no sirve para el texto.** Con **Bloq Mayús activo invierte las
mayúsculas** — comprobado: se escribió `prueba de canal DESDE cLAUDE` en vez de
`PRUEBA DE CANAL desde Claude`. Y el teclado ESP rompe símbolos. La solución es
`Set-Clipboard` + `Ctrl+V`, inmune a las dos cosas.

`Shift+Esc` es el atajo de ChatGPT que lleva el cursor al cuadro de mensaje.

## Las dos salvaguardas, y por qué existen

**Confirmar el foco antes de escribir.** El script relee el título de la ventana
en primer plano y **aborta si no es la correcta**. Existe porque la primera
prueba escribió en un Bloc de notas del operador que estaba abierto: el script
buscaba uno nuevo y cogió uno existente. Con la salvaguarda, el intento
siguiente detectó que el foco se había ido a otra ventana y **se negó a teclear**.

**Releer antes de enviar.** Tras pegar, hace `Ctrl+A` + `Ctrl+C` y compara el
portapapeles con el mensaje original carácter a carácter. **Solo pulsa Enter si
coinciden.** Si no, sale con código 4 sin enviar nada.

## Códigos de salida

| código | significado |
|---|---|
| 0 | enviado (o escrito, con `-NoEnviar`) |
| 2 | no se encontró la ventana |
| 3 | no se consiguió el foco tras 5 intentos — no escribió nada |
| 4 | lo escrito no coincidía — no envió |

## Uso

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\jeanp\jean_flow_puente\escribir_a_chatgpt.ps1 -Mensaje "texto"
```

`-NoEnviar` deja el texto en el cuadro sin pulsar Enter, para revisarlo.
`-TituloVentana` cambia la ventana objetivo si la conversación se renombra.

## Limitaciones honestas

- **Si la sesión de Windows está bloqueada, esto no funciona.** SendKeys no
  llega a un escritorio bloqueado. El PC tiene que quedarse con sesión iniciada.
- **Si el operador está usando el PC, le robará el foco** durante un segundo.
- **Si renombra la conversación de ChatGPT**, el título cambia y hay que pasar
  el nuevo por `-TituloVentana`.
- El portapapeles queda con el último mensaje enviado.
- ChatGPT ya tiene además su propia tarea programada ("Cada hora · Continuar
  conversación") configurada por el operador desde su interfaz. Este puente es
  independiente y complementario.

## Verificación del 28/08/2026 07:55 UTC

Mensaje real de 882 caracteres escrito en el cuadro, releído, coincidencia
exacta, y enviado. El canal quedó operativo.
