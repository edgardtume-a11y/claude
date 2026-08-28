# Precio de marca y tipo de financiación: revisado y aprobado

**Fecha:** 28/08/2026, 13:20 UTC
**Autor del código:** Gemini, en dos encargos
**Revisión:** Claude
**Staging:** `/home/trading/jean-flow-exec/staging_runs/20260828T122455Z_markprice`
**Veredicto: APROBADO.**

---

## 1. Por qué hacía falta

En futuros perpetuos hay dos números que el colector no estaba guardando:

- **El precio de marca.** Es el que **dispara las liquidaciones**, no el último
  precio negociado. Esta mañana se añadió la captura de liquidaciones; sin el
  precio de marca, el modelo ve el efecto y no la causa.
- **El tipo de financiación.** Un coste real que se cobra cada 8 horas y que
  **cambia el signo de la rentabilidad** de cualquier estrategia que mantenga
  posición. Un modelo que no lo conoce cree ganar dinero que en realidad paga.

El flujo `@markPrice@1s` trae **los dos en el mismo mensaje**, a 1 Hz:
~86.400 filas al día, nada al lado de los millones del libro.

---

## 2. La restricción, otra vez: no tocar el esquema

36 columnas, `SCHEMA_VERSION = "2.0.0"`. El precio de marca entra como un
**valor nuevo de `record_type`**, igual que hicimos con las liquidaciones.

Comprobado: **36 columnas | versión 2.0.0**. Sin cambios.

---

## 3. La revisión

### Lo irreversible, primero

| | Resultado |
|---|---|
| ¿Se tocó la instalación base? | **NO.** `grep` de `mark_price\|markPrice` en los 8 módulos de la base: **0 en todos**. Fechas del 13 y el 27 de agosto, anteriores al cambio |
| ¿Cambió el esquema? | **NO.** 36 columnas, 2.0.0 |

### Lo corregible

| | Resultado |
|---|---|
| `MARK_PRICE` en `_SEQUENCED_RECORD_TYPES` | ✅ y **`FORCE_ORDER` sigue estando** |
| Suscripción al flujo | ✅ `@markPrice@1s` en `config.py` |
| Decodificación | ✅ `markPriceUpdate` en `protocol.py`, con validación del símbolo |
| Contrato de parada / código 20 / uvloop / `gc.freeze` | intactos |
| `gc.disable` | ausente, como debe ser |
| Compilación | los 8 módulos |
| **Pruebas** | **31 pasan** (eran 25 en el gate 4, 26 tras liquidaciones) |

### El mapeo a columnas

```python
record_type ............. "MARK_PRICE"
channel ................. "markPrice"
price ................... p   (el precio de marca)
exchange_event_time_ms .. E
symbol .................. s   (validado contra el símbolo esperado)
side, quantity .......... vacíos (no aplican)
note .................... {"i":índice,"P":estimado,"r":financiación,"T":ms_próxima}
ingest_seq .............. del secuenciador causal
```

Es exactamente el contrato. Nada se pierde: lo que no cabe en columna propia
va a `note` como JSON compacto, recuperable con `json.loads`.

### El auditor: se comprobó, no se tocó

`audit.py`: **0 líneas cambiadas.** Y es correcto:

```python
_CAUSAL_RECORD_TYPES = frozenset({"AGG_TRADE", "FORCE_ORDER", "L2_PARTIAL", "L2_DELTA"})
...
if record_type not in _CAUSAL_RECORD_TYPES:
    return "collector"
```

`MARK_PRICE` **no** entra en la cadena causal del libro —no es un evento del
libro— y el auditor lo ignora limpiamente por la rama que ya existía. Sin
cambios y sin riesgo de romper una certificación.

---

## 4. El riesgo que busqué y no estaba: la doble grabación

`config.py` tiene **dos** listas de flujos, y `markPrice` aparece en ambas. Si
los dos sockets estuvieran activos a la vez sobre el mismo mercado, **cada
precio de marca se grabaría dos veces** y el dato quedaría inservible sin que
nada fallara. Lo comprobé antes de aprobar.

No ocurre. Las dos listas tienen papeles distintos:

- `websocket_sources` abre **dos sockets con flujos disjuntos**:
  `usdm_public_depth` lleva `depth20@100ms` + `depth@100ms`;
  `usdm_market_trades` lleva `aggTrade` + `forceOrder` + `markPrice@1s`.
  **Ningún flujo está en los dos.**
- `stream_names` (la tupla de 5) es el **catálogo** que usa el decodificador
  para reconocer por posición, no una lista de suscripción. Por eso
  `stream_names[4]` es `markPrice` y encaja.

Comprobado además que añadir `markPrice` al final **no desplazó el índice de
`forceOrder`** en ninguna de las dos listas. Se añadió al final en ambas.

---

## 5. Tamaño de los cambios

Diff contra el staging de liquidaciones:

| Fichero | Líneas |
|---|---|
| `normalize.py` | 53 |
| `collector.py` | 41 |
| `protocol.py` | 40 |
| `models.py` | 29 |
| `config.py` | 9 |
| `parquet_store.py` | **3** |
| `audit.py` | **0** |
| `dual_main.py` | **0** |

Proporcionado: el grueso en decodificar y normalizar, tres líneas en la lista
cerrada, y **cero** en lo certificado.

---

## 6. Lo que esto cambia para el operador

**El staging bueno para la captura de 7 días es ahora
`20260828T122455Z_markprice`.** Contiene los dos añadidos: liquidaciones
*y* precio de marca. El de liquidaciones (`20260828T083219Z_forceorder`) queda
superado.

Y sigue en pie la regla del `PYTHONPATH`: el rotador de Parquet debe usar
`PYTHONPATH=<run>/overlay/src` de **la captura que está comprimiendo**. Con
este staging la base desconoce ya dos tipos, no uno.

---

## 7. Sobre el proceso: la cola es serie

El encargo grande caducó a los **80 minutos** con el trabajo casi entero hecho
—tercera vez que pasa—. Faltaban dos cosas: la lista cerrada de
`parquet_store` (dos líneas, la crítica) y la prueba.

Al mandar un segundo encargo **pequeño y acotado**, descubrí algo que no
sabíamos: **la cola de Gemini es serie.** El encargo de cierre se quedó
esperando y sólo arrancó a las 13:06, cuando el primero soltó el turno. Once
minutos de espera invisible.

Dos lecciones prácticas:

1. **Trocear los encargos desde el principio**, no cuando ya han caducado. Un
   encargo de 80 minutos que muere sin entregar cuesta más que tres de veinte.
2. **Un encargo urgente no adelanta a uno atascado.** Si hace falta, hay que
   dar por muerto el primero antes de mandar el segundo.

También quedó confirmado que **el ejecutor del puente corta a los 120 segundos**
(no 300): lo que dure más se lanza despegado y se consulta con órdenes cortas.
