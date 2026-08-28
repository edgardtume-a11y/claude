# Puente V16 RELEVO — las dos IAs se turnan solas, sin API

28/08/2026 · sustituye a `puente_pc/` (abandonado) y a `agente_ia/` (requiere API de pago)

## De dónde sale

ChatGPT resolvió por AutoHotkey lo que yo no conseguí por PowerShell. Su
`PUENTE_V15_HOLA_FIJO.ahk` **funciona**: encuentra la pestaña, escribe, verifica
y envía. Lo que le faltaba no era el envío, era **el contenido**.

V15 manda siempre el mismo texto: `HOLA`. Es un despertador, no una
conversación. Lee, no entiende, no relaciona.

V16 es V15 con **tres líneas cambiadas** — mensaje, título y nombre del log.
Ningún cambio de lógica.

```autohotkey
; línea 21 del original
global MESSAGE := "HOLA"
```

## Por qué V15 funciona y mi PowerShell no

| mi intento | V15 / V16 |
|---|---|
| buscaba por **título** de ventana | busca por **URL** entre las pestañas abiertas |
| el título cambia al renombrar la conversación | fija el destino por **URL exacta** toda la ejecución |
| adivinaba la altura del cuadro por píxeles | lo **localiza solo** en la zona inferior |
| enviaba y confiaba | **prueba inicial** que escribe y borra sin enviar |
| `Ctrl+A` para verificar → falso positivo con caja vacía | **centinela en el portapapeles** (`__PUENTE_V15_CLIPBOARD_135790__`) |

Esa última fila era mi error concreto: en una caja vacía `Ctrl+A` selecciona la
página entera, así que leía miles de caracteres y creía que no se había enviado.
V15 mete un centinela conocido en el portapapeles antes de leer, y así distingue
"no se copió nada" de "se copió otra cosa". También guarda y restaura el
portapapeles del usuario.

## El mensaje nuevo

Va igual a las dos IAs. Se reparte solo porque cada una comprueba de quién fue
el último turno:

> Turno automatico del puente. Con Remote Desktop Commander abre
> `/home/trading/dialogo_ia` en jean-flow-02-tokyo. Mira el numero de turno mas
> alto en `claude/` y en `chatgpt/`. Si existe el fichero PARE, detente y no
> escribas nada. Si el ultimo turno lo escribio la OTRA IA: leelo entero, y
> escribe el turno siguiente en TU carpeta con el numero que toca, avanzando el
> trabajo sobre el colector JEAN FLOW. Si el ultimo turno es tuyo: no escribas
> nada, responde solo ESPERANDO. No ejecutes nada en la maquina: propon y que
> decida el operador.

**Esto resuelve la condición de carrera sin coordinación.** Si el último turno
es de ChatGPT, ChatGPT dice ESPERANDO y Claude escribe. Al ciclo siguiente, al
revés. Nunca escriben las dos.

## La arquitectura, en una línea

**V16 es el despertador. `/home/trading/dialogo_ia/` es el buzón.**

El canal ya existía y las dos IAs ya tenían acceso de lectura y escritura por
Remote Desktop Commander. No hacía falta programar la parte de "entender lo que
dicen": eso lo hace cada IA al leer el turno anterior. Solo faltaba que alguien
las despertara con la instrucción correcta.

## Cómo se usa

1. Parar V15: botón DETENER, o `Ctrl+Alt+Q`.
2. Doble clic en `C:\Users\jeanp\Downloads\PUENTE_V16_RELEVO\PUENTE_V16_RELEVO.ahk`.
3. Esperar a `PRUEBA INICIAL SUPERADA EN CHATGPT Y CLAUDE CODE.`

Para pararlo **sin tocar el PC**: crear el fichero `/home/trading/dialogo_ia/PARE`
en la VM. Las dos IAs lo comprueban antes de escribir.

## Límites, dichos claros

- **Necesita el PC encendido y la sesión desbloqueada.** Las pulsaciones no
  llegan a un escritorio bloqueado. Es el precio de usar la suscripción ya
  pagada en vez de una API facturada por token.
- **Consume de las suscripciones.** Seis turnos por hora cada una; una noche de
  8 h son ~48 intercambios. Si una plataforma corta por límite de mensajes, el
  puente sigue disparando al vacío hasta que se recupere.
- Si se cierra una pestaña, ese lado deja de contestar. V15/V16 refija por URL en
  cada ciclo, así que se recupera solo al reabrirla.

## La alternativa de pago, por si algún día interesa

`agente_ia/agente_dialogo.py` hace lo mismo por API: no necesita PC encendido,
ni foco, ni sesión desbloqueada. Cuesta dinero por token y abre una conversación
nueva en vez de continuar la del navegador. Está escrito y probado; no está en
uso por decisión del operador.
