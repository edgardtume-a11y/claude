# La ruta de los 7 días: qué se hace, en qué orden y qué tiene que dar

**Escrito:** 28/08/2026, 22:35 UTC
**Para:** el operador, y para cualquier IA que retome esto sin haber estado hoy.

Hoy se resolvieron cuatro bloqueadores y aparecieron dos que no sabíamos que
existían. Este documento es la ruta completa, en orden, con lo que cada paso
tiene que dar para poder pasar al siguiente.

---

## Antes de empezar: qué se usa

**El staging bueno es `20260828T143727Z_auditparquet`.** Lleva todo:

| | |
|---|---|
| uvloop y `gc.freeze` | del gate 4 certificado |
| Liquidaciones forzadas (`FORCE_ORDER`) | añadido y revisado hoy |
| Precio de marca y financiación (`MARK_PRICE`) | añadido y revisado hoy |
| Auditor que lee Parquet | añadido y probado hoy |
| Pruebas | 33, todas pasan |

Los demás stagings quedan superados. **La instalación base no se toca nunca**:
es el punto de partida de los overlays, no lo que corre.

**Regla que se aplica a todo lo de abajo:** cualquier herramienta que importe
módulos del colector usa `PYTHONPATH=<run>/overlay/src` **de la captura sobre
la que trabaja**. Nunca la base.

---

## Paso 0 — La prueba comparativa (1 hora)  ⏳ PENDIENTE DE ORDEN

**Por qué:** el gate del operador de hoy **no certificó** (7 umbrales de
latencia). Corrió en un mercado 9-12 veces más activo que el gate 4, y con
instrumentación distinta. **No sabemos cuál de las dos cosas lo tumbó.**

**Qué hacer:** un gate de 60 minutos sobre `20260828T143727Z_auditparquet`, a
una hora de mercado parecida a la de hoy (15:54-16:55 UTC).

**Qué tiene que dar:**
- Si los p99 **siguen altos** → fue la carga del mercado, y hay que decidir si
  los límites (5 ms de `book_apply`, 20 ms de bucle) son correctos o están
  calibrados contra un mercado dormido.
- Si **bajan** → fue la instrumentación del linaje «postmask», y se sabe qué
  quitar.

**No se puede saltar este paso.** Lanzar 7 días sin saberlo es apostar la
semana.

---

## Paso 1 — El rotador en vivo (durante el mismo gate)

**Por qué:** es lo único de la cadena de compresión que **nunca se ha probado
con una captura al lado**. Todo lo demás se midió con la máquina en reposo.

**Cómo:** con el gate ya lanzado, y **sin `--borrar`** la primera vez:

```
PYTHONPATH=<run>/overlay/src \
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python \
/home/trading/jean-flow-exec/herramientas/rotador_parquet.py \
  --run <el staging del gate> --intervalo 60 --max-por-ciclo 2
```

**Qué tiene que dar:** que el disco baje de ritmo **y que la latencia no se
mueva**. El rotador ya corre con `os.nice(10)` para no competir. Si los p99
empeoran respecto al mismo gate sin rotador, hay que saberlo antes de la
semana, no durante.

Sólo en el gate siguiente se activa `--borrar`.

---

## Paso 2 — Los 7 días  ⏳ PENDIENTE DE ORDEN

Con el paso 0 entendido y el 1 pasado.

**Durante la captura:**
- El rotador corriendo con `--borrar`, que reverifica antes de borrar cada CSV
  (manifiesto, filas, columnas, valores y `sha256`).
- 3,74 GiB/h en CSV se convierten a Parquet a razón de **65×**. Siete días en
  CSV serían 628 GiB; en Parquet son **~9,7 GiB**. Hay 114 GB libres.

**Regla de oro:** nada se toca mientras hay una captura activa.

---

## Paso 3 — La certificación, y aquí está lo aprendido hoy

**No se certifica la semana de una vez. Se certifica día a día.**

Motivo medido: el auditor gasta **58 MB + 290 MB por cada millón de filas**.
Una semana entera pediría ~28 GB sólo para `identity`, de los 32 de la máquina;
y las tres fases en paralelo, ~55 GB. **No cabe.**

Por día son ~2,4 GB por fase y ~9,6 GB las tres en paralelo. Holgado.

### 3a. Siete auditorías diarias, cada una con sus cuatro fases EN PARALELO

Medido hoy: en serie 577 s, en paralelo **245 s**, con los cuatro informes
**byte a byte idénticos**. El cambio son cuatro `&` y un `wait` en
`control/run_live_audits.sh`. **No toca `audit.py`.**

El auditor lee Parquet directamente, así que **no hay que reconstruir nada**.
Probado: sobre el gate 4, que ya no tiene CSV, reproduce su informe certificado
con el mismo hash canónico del libro.

### 3b. La costura entre días

```
continuidad_dias.py --mercado spot          <dia1> ... <dia7>
continuidad_dias.py --mercado usdm_futures  <dia1> ... <dia7>
```

**Sin esto, siete certificados diarios NO equivalen a uno semanal.** Comprueba
que el último `ingest_seq` de cada día enlaza con el primero del siguiente, que
la sesión de captura es la misma toda la semana y que el esquema no cambió.

Probada contra datos rotos a propósito: detecta huecos y solapamientos y da el
número exacto de eventos afectados.

**La semana está certificada cuando:** los 7×4 informes diarios dan PASS **y**
las 2 comprobaciones de continuidad dan PASS.

---

## Paso 4 — Antes de entrenar: dos reglas que salen de los datos

No son opcionales. Salen de lo observado hoy en una hora real de mercado.

### Ninguna ventana cruza una frontera de época

Hubo **22 resincronizaciones del libro en una hora** de mercado movido. Cada
resync es una frontera: el libro de antes y el de después no son el mismo
objeto continuo. Una característica de 30 segundos que abarque un resync mezcla
dos libros distintos y produce **una señal que nunca existió**.

### El embargo es más largo de lo que parece

```
embargo = máximo periodo de las características + horizonte de predicción
```

No sólo el horizonte. Si una característica mira 5 minutos atrás y se predice a
10 segundos, el embargo son 5 minutos y 10 segundos.

---

## Lo que sigue sin resolverse

1. **Interés abierto.** No existe como flujo de websocket en Binance: sólo por
   REST. Meter peticiones HTTP en un colector de websockets es un cambio de
   otra naturaleza —límites de peticiones, un fallo posible en el camino
   caliente— y se decide aparte. Hoy **no está capturado**.
2. **Los límites de latencia.** Si el paso 0 dice que fue la carga, hay que
   decidir si 5 ms y 20 ms son las cifras correctas para un mercado despierto.
   Es una decisión del operador, no una corrección técnica.
3. **Los respaldos siguen sólo en la VM.** Un fallo del disco se lleva todo.

---

## Los cinco errores de hoy, para no repetirlos

| | Lección |
|---|---|
| Encargué a Gemini «dos sitios en `audit.py`» | Había un tercer lector en otro módulo. **Antes de acotar un encargo, releer lo que ya escribí sobre esa pieza** — el dato estaba en mi propia documentación |
| Un banco medía mal por una redirección | La línea de tiempos acababa dentro del JSON. **Un banco mal instrumentado no da un error, da un resultado** |
| Otro banco imprimió «CABE» | Contestaba a una pregunta más estrecha que la que importaba. **Un banco contesta lo que le programaste, no lo que te importa** |
| Leí un chequeo de ayer creyéndolo de hoy | El id `monitor-<HHMM>` colisiona cada 24 h. **Comprobar la edad de toda respuesta antes de creérsela** |
| Dije que 10 violaciones de invariante me preocupaban | Eran el sistema curándose, y el informe lo decía. **Juzgar por el informe, no por el nombre de un contador** |
