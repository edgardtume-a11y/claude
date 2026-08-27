# DATOS — conjunto sintético de práctica TRAZA v1.0.0

Material de práctica para aprender a **leer y procesar registros** (*logs*: bitácoras).
Complementa al laboratorio TRAZA: mismo esquema de eventos, pero un volumen mucho mayor
y varios días de actividad de una pequeña red doméstica de laboratorio.

> **Todo es sintético.** Direcciones solo de rangos reservados para documentación y
> redes privadas (RFC 5737 y RFC 1918), dominios del TLD reservado `.example`
> (RFC 2606). Ninguna dirección, dominio, persona ni entidad real. Ninguna medición
> procede de una red real.

> **Advertencia honesta**: como los registros reales, estos archivos están *sucios*.
> Contienen defectos deliberados de formato y de contenido, además de varios episodios
> de actividad que merece la pena detectar. Parte del ejercicio es encontrarlos. La hoja
> de respuestas completa está en `SOLUCIONES.md`: no la leas antes de intentarlo.

## Archivos

| Archivo | Contenido |
| --- | --- |
| `traza_practica.json` | 2784 objetos de evento bajo el esquema `traza.eventos.v1` (documento JSON válido) |
| `traza_practica.log` | 2806 líneas de registro en texto plano (cabeceras `#` incluidas) |
| `DATOS.md` | Este documento |
| `SOLUCIONES.md` | Hoja de respuestas (aparte a propósito) |

Ambos archivos describen el **mismo periodo**: cinco días, del lunes 2026-08-17 al
viernes 2026-08-21 (UTC). El instante `t_ms` cuenta milisegundos desde la época
**t0 = 2026-08-17T00:00:00Z** (así, por ejemplo, t_ms 86 400 000 = medianoche del día 2).

## El escenario

Una red doméstica de laboratorio con seis dispositivos —portatil (192.168.1.21),
sobremesa (.22), movil (.23), tele (.24), sensor-iot (.25) e invitado (.26)— detrás de
un router con dirección pública 203.0.113.42, usando el resolvedor DNS 198.51.100.53 y
visitando seis servicios del propio laboratorio (`portal.example`, `api.example`,
`archivos.example`, `correo.example`, `acceso.example`, `noticias.example`, en
192.0.2.80–85). El colector también registra el tráfico que llega a esos servidores
desde fuera de la red (campo `desde` = `proveedor`).

La mayor parte del registro es navegación normal en horario diurno. El resto… es lo que
hay que encontrar.

## Campos de cada evento (versión JSON)

Mismo esquema `traza.eventos.v1` del laboratorio TRAZA:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `id` | texto | Identificador del evento (`E0001`…), asignado en orden cronológico |
| `t_ms` | número | Milisegundos simulados desde t0 (2026-08-17T00:00Z) |
| `etapa` | texto | `dns` · `nat` · `tcp` · `tls` · `http_solicitud` · `http_respuesta` |
| `tipo` | texto | `paquete` (algo viaja) o `estado` (algo cambia en un nodo) |
| `desde`, `hasta` | texto | `equipo` · `router` · `dns` · `proveedor` · `servidor` |
| `origen_ip`, `origen_puerto` | texto/número o `null` | Origen del paquete |
| `destino_ip`, `destino_puerto` | texto/número o `null` | Destino del paquete |
| `protocolo` | texto | `UDP` · `TCP` · `TLS` · `HTTP` · `—` |
| `tam_bytes` | número o `null` | Tamaño simulado del mensaje |
| `estado` | texto | `ok` · `info` · `advertencia` · `error` |
| `resumen` | texto | Qué ocurre, en una línea |
| `detalle` | texto | Evidencia sintética abreviada |
| `nota_aprender` | texto | Nota didáctica breve |
| `sintetico` | booleano | Siempre `true` |

El documento envolvente añade `esquema`, `version_app`, `generado_en`,
`escenario` (`practica-mixta`), `aviso`, `campos` y `epoca_t0`.

## Formato de línea del registro `.log`

Cabecera de líneas `#` y después, en el **formato documentado**, una línea por evento:

```
[+     t_ms ms] id  etapa  tipo  protocolo  origen -> destino  tam  estado  :: resumen (SINTETICO)
```

con `origen`/`destino` como `ip:puerto` (o `—`) y `tam` en bytes. Igual que en
los registros reales, **no se garantiza que todas las líneas del archivo cumplan el
formato documentado**: tratar las desviaciones forma parte de la práctica.

## Ideas de práctica (sin herramientas incluidas)

Este paquete entrega **solo datos y documentación** — deliberadamente no incluye ningún
programa de análisis. Ejercicios sugeridos, con la herramienta que cada cual prefiera:

1. Validar el archivo: ¿cuántas líneas cumplen el formato documentado? ¿Qué se hace con
   las que no?
2. Reconstruir la línea de tiempo por dispositivo y por hora del día.
3. Contar respuestas por código y por origen; buscar concentraciones llamativas.
4. Contrastar la versión JSON con la versión .log: ¿coinciden?
5. Escribir un pequeño informe de hallazgos y compararlo después con `SOLUCIONES.md`.
