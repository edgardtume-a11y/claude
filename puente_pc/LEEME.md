# PUENTE DOS IAS — escribe en ChatGPT y en Claude Code desde tu PC

Un bucle que corre en tu Windows y cada 10 minutos escribe el mismo mensaje en
las dos aplicaciones. **No necesita Remote Desktop Commander ni internet hacia
fuera**: solo maneja las ventanas que ya tienes abiertas.

## Qué hay aquí

| archivo | para qué |
|---|---|
| `ARRANCAR_PUENTE.cmd` | el lanzador. Doble clic |
| `PUENTE_DOS_IAS.ps1` | el trabajo de verdad |
| `puente_chatgpt_bucle.ps1` | variante que lee mensajes de GitHub (opcional) |
| `pendiente.json` | buzón de esa variante |

## La primera vez, en este orden

**1. `ARRANCAR_PUENTE.cmd LISTAR`** — no toca nada. Te enseña los títulos
exactos de tus ventanas. Sirve para confirmar cómo se llama cada una: el
navegador pone el nombre de la **conversación**, así que cambia si la
renombras.

**2. `ARRANCAR_PUENTE.cmd CALIBRAR`** — te pide que pongas el ratón encima de
la caja de escribir de cada aplicación y cuenta hasta ocho. Guarda esa posición
**relativa a la ventana**, así que sigue valiendo aunque muevas la ventana de
sitio. Queda en `calibracion.json`.

**3. `ARRANCAR_PUENTE.cmd PRUEBA`** — escribe en las dos cajas y **no pulsa
Enter**. Lo ves con tus ojos antes de soltarlo. Si sale `ChatGPT=0 Claude=0`,
está listo.

**4. Doble clic normal** — bucle cada 10 minutos, enviando de verdad.

## Los códigos

| código | qué pasó |
|---|---|
| **0** | correcto |
| **2** | no encontró la ventana → usa `LISTAR` |
| **3** | no consiguió el foco → ¿está la sesión bloqueada? |
| **4** | escribió pero no coincidía → usa `CALIBRAR` |

## Por qué hace falta calibrar

`Shift+Esc` lleva el cursor a la caja **en ChatGPT**. En Claude Code **no hay
atajo equivalente**. Sin él, `Ctrl+A` selecciona la página entera — medido en
tu máquina: 18.882 caracteres — o cae en otro campo — medido: 44 caracteres.

Adivinar la posición por píxeles acierta a veces y falla otras, según el zoom,
la barra lateral y el tamaño de la ventana. Calibrando se lo señalas tú una vez
y se acabó el problema.

El orden de intentos es: atajos de teclado → clic calibrado → clics a ciegas.
**Solo se envía lo que se verifica**, así que un intento fallido no escribe
nada en ningún sitio.

## Las dos salvaguardas

**No escribe sin confirmar el foco.** Relee el título de la ventana activa; si
no es la correcta, lo anota y no toca nada. Nace de un error real: el primer
intento escribió en un Bloc de notas abierto.

**No envía sin releer.** Pega, copia de vuelta y compara carácter a carácter.
Si no coincide, no pulsa Enter.

## Tres cosas que costó descubrir

- `SetForegroundWindow` a secas **devuelve `True` y no hace nada**: Windows
  bloquea el robo de foco desde procesos de fondo. Hace falta el truco del ALT
  (`keybd_event 0x12`) más `AttachThreadInput` al hilo activo.
- `SendKeys` con el texto directo **invierte las mayúsculas si tienes Bloq
  Mayús** — comprobado: salió `prueba de canal DESDE cLAUDE`. Y el teclado ESP
  rompe símbolos. Por eso se pega por portapapeles.
- El título de la ventana lleva el nombre de la **conversación**, no el de la
  aplicación. Buscar "ChatGPT" no encuentra nada.

## Límites, dichos claros

- **Con la sesión de Windows bloqueada no funciona.** Las pulsaciones no llegan
  a un escritorio bloqueado. El PC tiene que quedarse desbloqueado.
- **Te roba el foco y mueve el ratón** un segundo cada vez que envía. El ratón
  se devuelve a donde estaba.
- Si renombras una conversación, vuelve a `LISTAR` y pasa el título nuevo con
  `-TituloChatGPT` o `-TituloClaude`.
- El portapapeles queda con el último mensaje.

## Cambiar el mensaje o el intervalo

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -Sta -File PUENTE_DOS_IAS.ps1 -Mensaje "lo que quieras" -Minutos 5
```

Otros parámetros: `-TituloChatGPT`, `-TituloClaude`, `-SinRaton` (solo teclado),
`-SoloUnaVez` (una pasada y sale).
