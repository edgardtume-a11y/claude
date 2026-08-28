# Captura de liquidaciones forzadas: revisada y aprobada

**Fecha:** 28/08/2026, 09:45 UTC
**Autor del código:** Gemini, bajo contrato acotado
**Revisión:** Claude
**Staging:** `/home/trading/jean-flow-exec/staging_runs/20260828T083219Z_forceorder`
**Veredicto: APROBADO**, con una corrección de integración pendiente (§5).

---

## 1. Por qué hacía falta

De la auditoría cruzada con Gemini (`planes/DEBATE_FASE2_GEMINI.md`):

> *Las cascadas de liquidaciones mueven el mercado a corto plazo más que
> cualquier flujo orgánico. Si tu modelo no sabe que ese trade fue una orden
> forzada, atribuirá el movimiento a una "decisión informada" y **sobreajustará
> patrones erróneos**.*

Sin este flujo, el modelo aprende una explicación falsa de los movimientos más
violentos del período. Y añadirlo después de los 7 días cuesta repetirlos.

---

## 2. La restricción que gobernó el diseño

**No cambiar el esquema.** 36 columnas, `SCHEMA_VERSION = "2.0.0"`.

Motivo: cambiarlo invalidaría las 5 horas ya capturadas y certificadas,
obligaría a tocar el auditor, y rompería la comparabilidad entre gates.

La liquidación entra como un **valor nuevo de `record_type`**, encajando sus
datos en columnas que ya existían.

---

## 3. La revisión, comprobación a comprobación

### Lo irreversible, primero

| | Resultado |
|---|---|
| ¿Se tocó la instalación base? | **NO.** `grep force_order` en base: **0, 0, 0**. Fechas del 13 y 27 de agosto, anteriores al cambio |
| ¿Cambió el esquema? | **NO.** 36 columnas, versión 2.0.0 |

### Lo corregible

| | Resultado |
|---|---|
| `FORCE_ORDER` en `_SEQUENCED_RECORD_TYPES` | ✅ presente. **Sin esto, la conversión a Parquet fallaría en vivo** |
| Suscripción al flujo | ✅ `force_order_batch` en `collector.py` |
| Contrato de parada | intacto |
| Salida con código 20 | intacta |
| uvloop y `gc.freeze` | intactos |
| `gc.disable` | ausente, como debe ser |
| Compilación | los 5 módulos |
| **Pruebas** | **25 pasan** |

### El mapeo a columnas — lo que decide si el dato sirve

```python
record_type ............. "FORCE_ORDER"
channel ................. "forceOrder"
side .................... event.side
price ................... event.price
quantity ................ event.quantity
exchange_event_time_ms .. event.event_time_ms
exchange_trade_time_ms .. event.trade_time_ms
note .................... {"o":tipo,"f":TIF,"X":estado,"q":cant_orig,"p":precio_orden}
ingest_seq .............. del secuenciador causal
```

Es exactamente el contrato. Nada se pierde: lo que no cabe en columna propia va
al campo `note` como JSON compacto, recuperable.

Y la decisión de arquitectura es correcta: la liquidación **pasa por el
secuenciador causal** y lleva `ingest_seq`, como un trade. Es un evento de
mercado real, no de control.

### Integración en el camino caliente

`ForceOrderEvent` se enruta a la **cola de trades** y se procesa en
`_trade_worker`, con las mismas métricas de latencia que un trade normal. No
añade una cola nueva ni un camino paralelo: reutiliza el que ya estaba
certificado.

---

## 4. Lo que el overlay resuelve bien

El overlay del staging es una **copia completa** del paquete (27 módulos), no
un parche parcial. Y Gemini **añadió `parquet_store.py` al overlay** —el gate 4
no lo tenía— copiándolo de la base y ampliando la lista cerrada.

Como la captura arranca con `PYTHONPATH=<run>/overlay/src`, usa la versión
corregida. Correcto.

---

## 5. ⚠️ El hueco de integración — pendiente

**El rotador de Parquet importa `binance_collector.parquet_store`.** Y en la
documentación que escribí (`operaciones/ROTADOR_PARQUET_LISTO.md`) el ejemplo
usa:

```
PYTHONPATH=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/src
```

Ésa es **la instalación base**, que NO tiene `FORCE_ORDER`.

### La consecuencia

Durante una captura con liquidaciones, el rotador fallaría en el primer fichero
que contenga una: `ParquetStoreError: record_type no admitido`. El arreglo
estaría en el overlay y el fallo en producción.

### La corrección

El rotador debe usar el `PYTHONPATH` **de la captura que está comprimiendo**:

```
PYTHONPATH=<run>/overlay/src
```

No es un cambio de código: es un cambio de uso. Pero si nadie lo escribe, se
descubre a mitad de un gate de 7 días.

**Regla general que sale de esto:** cualquier herramienta que importe módulos
del colector debe usar el `PYTHONPATH` de la captura sobre la que trabaja, no el
de la instalación base. La base es el punto de partida de los overlays, no lo
que corre.

---

## 6. Lo que falta antes de usarlo

1. **Corregir el `PYTHONPATH` del rotador** (§5) y su documentación
2. **Probarlo con una captura real** — el gate de 6 h es el sitio natural
3. **Comprobar que llegan liquidaciones de verdad.** BTCUSDT tiene varias por
   hora en condiciones normales, pero podría pasar una ventana entera sin
   ninguna. Si el gate de 6 h no captura ninguna, no significa que falle:
   significa que hay que mirar el contador `force_order_messages` y esperar a
   una ventana con movimiento
4. **`markPrice` e interés abierto** siguen sin capturarse. Gemini los señaló
   como importantes, aunque menos críticos que las liquidaciones

---

## 7. Sobre el proceso

El encargo terminó con estado **`failed`** por agotar el tiempo. Pero el trabajo
estaba **completo y correcto**: había escrito el código, ampliado la lista
cerrada, añadido las pruebas y dejado todo compilando.

Es la segunda vez que pasa (la primera fue el banco del GIL). La lección
práctica: **cuando un encargo falla por tiempo, comprobar el disco antes de
repetirlo.** Lo caro es escribir; reportar es lo que se pierde.
