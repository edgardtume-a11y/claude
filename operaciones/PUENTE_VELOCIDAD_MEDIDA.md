# La velocidad del puente, medida

**Fecha:** 28/08/2026, 11:35 UTC
**Pregunta del operador:** *"¿HAY ALGUNA FORMA DE HACERTE MÁS RÁPIDO? EN EL
SISTEMA DE PROCESAMIENTO CON GITHUB MUCHO TIEMPO VEO QUE ESTÁ TOMANDO."*

---

## 1. Ya está arreglado, y ahora está medido

El guardián que **de verdad corre** es
`/home/trading/puente_github_watcher.py` — no la copia del repositorio. Ese
fichero se modificó el **28/08 a las 07:03** y hoy tiene:

```
POLL_SECONDS = 5
```

Antes eran 30. El proceso lleva **4 h 28 min** en pie sin reinicios.

## 2. La medición

Tres órdenes reales, cronometradas de extremo a extremo:

| Orden | Empujada | Procesada en la VM | Retardo |
|---|---|---|---|
| `ver-guardian-002` | 11:32:45 | 11:32:50 | **5 s** |
| `csv-viejos-001` | 11:33:21 | 11:33:25 | **4 s** |
| `cli-conversor-002` | 11:35:0x | +5 s | **~5 s** |

**De 30 segundos de espera media a 4-5 segundos.** El puente ya no es el
cuello de botella.

## 3. Lo que queda de lentitud, y de quién es

Lo que sobra ahora es **mío**, no del guardián:

- Yo consulto el resultado en bucle. Estaba esperando 25 s entre consultas
  sobre un guardián que responde en 5. Bajado a 8 s.
- Cada orden es una ida y vuelta completa: escribir el script, empujarlo,
  esperar, leerlo. Cuatro preguntas encadenadas son cuatro viajes.
  **La forma de ir rápido no es acelerar el viaje: es hacer menos viajes**,
  metiendo varias comprobaciones en un solo script.

## 4. Lo que aún daría un salto

**RDC (Remote Desktop Commander)** ejecutaría órdenes directamente, sin pasar
por GitHub: de ~5 s a ~1 s, y sin el ciclo de escribir/empujar/leer.

Sigue pendiente de una sola cosa que sólo puede hacer el operador:

```
sudo systemctl restart desktop-commander-remote
```

y meter el código nuevo en `https://mcp.desktopcommander.app/device/verify`.

## 5. La lección que costó cara

El intento anterior de acelerar el puente **mató al guardián 18 minutos**:
la orden hacía `systemctl restart puente-github` y el guardián se reiniciaba
*a sí mismo* mientras ejecutaba esa orden. Se suicidaba, systemd lo relanzaba,
volvía a leer la misma orden, y systemd acabó bloqueándolo por reinicios
excesivos.

**Regla:** un proceso nunca se reinicia a sí mismo desde dentro de la tarea
que está ejecutando. Si hay que hacerlo, va despegado y con retardo
(`nohup sh -c 'sleep 10; systemctl restart ...' &`), después de haber escrito
el resultado.

La misma regla, en su versión general, es la que gobierna la conversión de
los 21 GiB lanzada hoy: **lo que no cabe en el tiempo de una orden, se lanza
despegado y se consulta después.** Meterlo en línea bloquea la cola.
