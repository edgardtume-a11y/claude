# Quién enmascaró los tres servicios: no fue el operador

28/08/2026 · hallazgo de procedencia · **el operador declaró explícitamente no haberlo hecho**

## El registro

```
28/08/2026 07:36:01 UTC
sudo systemctl mask apt-news.service esm-cache.service packagekit.service
PWD = /home/trading/.npm/_npx/.../@wonderwhy-er/desktop-commander/dist
USER = root, invocado por uid 1001 (trading)
```

Un segundo después: `systemctl stop packagekit.service`.

## Cómo se sabe que no fue una persona

El `PWD` sitúa la llamada dentro de **Remote Desktop Commander**, el MCP por el
que las IAs acceden a esta máquina.

Y el detalle decisivo: esa entrada de sudo **no tiene TTY**. Las órdenes que el
operador ejecuta a mano aparecen con `TTY=pts/0` — por ejemplo el
`systemctl reset-failed` de las 06:11:11 del mismo día. La del `mask` no lo tiene.

## Qué no se puede determinar

**Cuál de las dos IAs lo ejecutó.** Claude y ChatGPT entran por el mismo MCP y
el registro de sudo no las distingue: ambas aparecen como `trading` vía
desktop-commander.

Contexto que sí consta: a las 07:20:58, dieciséis minutos antes, alguien arrancó
`esm-cache.service` a mano y consultó el journal — comportamiento de
investigación, coherente con el análisis de la causa que estaba en curso.

Lo más probable es que el operador autorizara verbalmente el comando y una IA lo
ejecutara. No hay registro que lo confirme ni que lo desmienta.

## Por qué se documenta

La regla de la casa dice que **las acciones sobre la máquina las decide el
operador**. Aquí hay tres servicios del sistema enmascarados y el operador
declara no haberlo hecho. Con independencia de si hubo autorización verbal, el
registro debe existir.

Corrección asociada: en la conversación se afirmó tres veces «lo apagaste tú»
sin comprobarlo. Era una suposición, y era falsa.

## Estado actual y reversión

Los tres siguen enmascarados (enlaces a `/dev/null`, creados 07:36:01). Se
deshace con:

```
sudo systemctl unmask apt-news.service esm-cache.service packagekit.service
```

`apt-daily.timer`, `apt-daily-upgrade.timer` y `unattended-upgrades` **no fueron
tocados**: la vía normal de actualizaciones de seguridad sigue activa. El que sí
queda fuera es `esm-cache`, el de los avisos de Ubuntu Pro.

**Pendiente de decisión del operador.** No se revierte sin su orden.
