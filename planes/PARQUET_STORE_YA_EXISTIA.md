# Segundo hallazgo del mismo tipo: `parquet_store.py` ya existía

**Fecha:** 27/08/2026, ~21:50 UTC (16:50 Perú)
**Quién falla:** el revisor (Claude). Yo.

---

## Lo que pasó

Esta mañana escribí, en `planes/AUDITORIA_MEJORAS_CORREGIDA.md`, esta conclusión:

> *"Una auditoría hecha sin leer el código produce recomendaciones plausibles y
> falsas. El revisor lee el código real antes de encargar; nunca encarga sobre
> supuestos."*

Cinco horas después encargué a Gemini un conversor de CSV a Parquet **sin
comprobar si ya existía uno**. Existía: `parquet_store.py`, 641 líneas, escritas
por el autor original del motor.

## Qué tiene el que ya estaba

Buscando sus funciones:

```
convert_segment(...)          _write_csv_as_parquet(...)
_verify_parquet(...)          _validate_row(...)
_logical_digest_row(...)      _validate_header(...)
_exclusive_lock(...)          _lock_is_stale(...)
_atomic_json(...)             _fsync_directory(...)
_sha256(...)                  discover_closed_csv(...)
class SegmentBusy             class ConversionResult
```

Es **más cuidadoso que el que encargué**:

| | El que ya existía | El que encargué hoy |
|---|---|---|
| Verificación de la tabla | sí | sí |
| **Validación fila a fila** con tipos | **sí** (`_validate_row`, `_parse_field`) | no |
| **Huella lógica por fila** | **sí** (`_logical_digest_row`) | no |
| **Bloqueo exclusivo** entre procesos | **sí** (`_exclusive_lock`) | no |
| **Detección de bloqueo huérfano** | **sí** (`_lock_is_stale`, 900 s) | no |
| `fsync` del directorio | sí | no |
| Manifiesto atómico | sí | sí |
| **Descubrir segmentos ya cerrados** | **sí** (`discover_closed_csv`) | no |
| **Detectar segmento en uso** | **sí** (`SegmentBusy`) | no |
| Probado hoy con datos reales | no | **sí** |

Las tres últimas filas del "ya existía" son justo lo que hace falta para la
**rotación en vivo** durante la captura de 7 días: saber qué fichero ya se cerró,
no tocar el que el colector tiene abierto, y no pisarse con otro proceso.

Nadie lo importa. `grep -rn "parquet_store"` fuera del propio archivo: **cero
resultados**. Estaba escrito, esperando, y no lo usa nadie.

---

## Por qué volví a caer

Distinto motivo que por la mañana, y peor.

Por la mañana el fallo fue de las dos IAs opinando sin leer. Esta vez **yo ya
sabía que `parquet_store.py` existía**: lo había visto en la radiografía del
código, y hasta lo anoté — *"parquet_store.py 641 (¡ya existe!)"*. Lo tenía
delante y aun así encargué uno nuevo.

No fue ignorancia. Fue no releer mis propias notas antes de dar una orden.

---

## Qué se hace ahora

**Corto plazo, la limpieza de los 32 GB:** se usa el conversor nuevo. No por
mejor, sino porque **está probado**: convirtió datos reales, y yo verifiqué la
salida con un motor distinto (288 000 celdas, cero discrepancias). El que ya
existía no se ha ejecutado nunca. Para una tarea que borra datos, "probado" pesa
más que "mejor diseñado".

**Medio plazo, la rotación en vivo del gate de 7 días:** se usa
`parquet_store.py`. Está construido exactamente para eso —`discover_closed_csv`,
`SegmentBusy`, bloqueo exclusivo— y ninguna de esas piezas tiene el conversor
nuevo. Lo que hay que hacer no es escribirlo: es **probarlo y engancharlo**.

**Tarea que se añade:** poner a prueba `parquet_store.py` con datos reales y
conectarlo a la rotación. Es trabajo de integración y pruebas, no de escritura.

---

## Lo que hay que cambiar en el método

La regla de esta mañana era correcta pero incompleta. Decía *leer el código
antes de encargar*. Le falta un paso previo, más barato y que yo me salté:

> **Antes de encargar cualquier cosa, buscar si ya está hecha.**
> Un `grep` del concepto en el paquete. Treinta segundos.
> `grep -rn "parquet" src/` habría bastado hoy.

Dos veces en un día, el mismo tipo de error: **escribir lo que ya estaba
escrito**. La causa común no es la falta de capacidad de nadie — es dar una
orden antes de mirar.

Y hay una consecuencia práctica que va más allá del método: **este motor tiene
más cosas hechas de las que su propia documentación refleja.** Antes de pedir
una función nueva, la primera hipótesis debería ser que ya está ahí.
