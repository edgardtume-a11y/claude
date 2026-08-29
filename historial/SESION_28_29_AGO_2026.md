# Historial de sesión — 28 al 29 de agosto de 2026

Registro de lo trabajado entre Claude y el operador, con ChatGPT auditando por
el canal `dialogo_ia/`. Incluye los errores cometidos y retirados, porque son
la parte más útil del registro.

---

## 1. Investigación de latencia del colector

### El objetivo ya estaba cumplido

Medido sobre el gate post-máscara `20260828T155419Z_tokyo_postmask_gate_30m`:

| serie | p50 | p95 | p99 | max |
|---|---|---|---|---|
| `book_pipeline_total` | **0.900 ms** | **3.156 ms** | 5.657 ms | 23.218 ms |
| `event_loop_lag` | 0.103 ms | 1.333 ms | 4.843 ms | 584.113 ms |

El objetivo de 5 ms se cumple con holgura en el caso normal. Lo que quedaba
abierto eran los picos del event loop: 871 de 1.384 intervalos de 5 s (62.9 %)
contienen al menos un pico por encima de 20 ms.

### PackageKit, causa de los atascos periódicos

Identificado con p ≈ 2.4×10⁻¹⁰. Tras enmascararlo, los eventos >400 ms bajaron
de 16.02/h a 7.03/h y desapareció la firma periódica.

### Cuatro mecanismos propuestos, cuatro caídos

1. **Bloqueo síncrono de `_emit_metrics`** — falso: usa `asyncio.to_thread`.
   Retirado en el turno 031 tras corrección de ChatGPT.
2. **`15/20 = 75 %`** — aritmética mal aplicada: era probabilidad de
   solapamiento, no de exceder umbral. Retirado.
3. **Contención de un hilo** — el brazo `thread_uno` da cero excedencias.
4. **Contención de dos hilos concurrentes** — pareció confirmarse (41.254 ms,
   6 excedencias) y **también cayó** al corregir el runtime del banco.

### El defecto que ChatGPT encontró en el banco

`banco_v23.py`, brazo `snapshot_en_thread_doble`:

```python
for m in metricas:
    doc = await asyncio.to_thread(m.snapshot)
    await asyncio.to_thread(_dumps, doc)
```

Secuencial. El brazo declaraba medir "dos mercados" pero nunca puso dos hilos
a la vez. Su cero no podía responder la pregunta.

**Corregirlo invirtió el resultado**: con `asyncio.gather`, 41.254 ms y 6
excedencias contra 8.618 ms y cero del brazo serie.

### Y el defecto que anulaba esa corrección

Al verificar los números de producción en vez de citarlos de memoria:

| parámetro | producción | banco V2.3.1 |
|---|---|---|
| `thread_switch_s` (conmutación del GIL) | **0.001** | **0.005** |
| `gc_thresholds` | (50000, 100, 100) | (700, 10, 10) |

El intervalo de conmutación del GIL es justo el parámetro que gobierna el
mecanismo bajo estudio. Con el runtime real:

```
brazo                         >20ms/min   peor max
sin_snapshot                        0.0      1.766
snapshot_en_loop (control)          9.5     28.520
thread_uno                          0.0      3.610
thread_doble_serie                  0.0      4.907
thread_doble_concurrente            0.0     11.980   <- de 41.254 a 11.980
```

El control positivo siguió disparando (19 contra 22 excedencias): el banco no
perdió sensibilidad, desapareció el fenómeno. **Hipótesis retirada.**

### Lo que sobrevive

El dato de ChatGPT del turno 036: **66/66 y 19/19 excedencias a ±250 ms de un
snapshot**. La asociación es sólida. El mecanismo sigue sin cerrarse.

El evento de 584 ms es población aparte. El único campo que lo separa es
`gc_count[0] = 59`, que es un contador y no una duración.

---

## 2. Correcciones y retractaciones

Registradas porque el método importa más que el resultado.

| # | afirmación | qué pasó |
|---|---|---|
| 1 | "8 de 9 eventos a +35.6 s" | no reprodujo; era 6 de 6 a +31.0–36.6 s |
| 2 | "la línea base empeoró de 46 a 100 ms" | error de método: mediana de un máximo rodante no es línea base. Real: p50 = 0.097 ms. Factor ~1000 |
| 3 | "la sonda desnuda se atascó" | era mi propio `sorted()` sobre lista creciente dentro del bucle |
| 4 | Banco V1 | `niveles` no afectaba al lote; `queue_size` 16 contra 4096 de producción. **Lo encontró ChatGPT** |
| 5 | Mecanismo del observador | `_emit_metrics` usa `to_thread`; no bloquea. **Lo encontró ChatGPT** |
| 6 | Atribución de turno | dije 030, era 028. **Lo encontró ChatGPT** |
| 7 | `clock_delta_ms` positivo | 50.6 % de los otros también lo son. Muerto antes de publicarse |
| 8 | Regla del anillo | habría bloqueado el canal esperando a un verificador pendiente |
| 9 | "faltan uvloop y orjson" | falsa alarma: `-maxdepth` demasiado corto. Estaban en el venv del colector |
| 10 | "290 veces mayor que el coste" | solo contaba el spread, faltaban las comisiones. **Lo señaló el operador** |
| 11 | "no se abrió ninguna operación" | contaba solo las cerradas; sí se abrió una |
| 12 | Filtro del muro | disparaba el 99.6 % de las veces: no seleccionaba nada |

---

## 3. Infraestructura

### Vertex AI, cortado

`jean-flow-gemini` y `jean-flow-router` detenidos y deshabilitados. Verificado:
cero procesos, cero conexiones a googleapis. El guardián solo usaba Vertex en
`gemini_enqueue` y `gemini_result`; sus otras seis acciones no lo tocan.

### Migración del repositorio

De `edgardtume-a11y/claude` a `trading-cyber/jean-trading`, 15 ramas,
verificado completo.

### El bloqueo de GitHub, y su causa

`git push` devolvía **403**. Diagnóstico verificado:

- la sesión quedó autenticada como `trading-cyber` tras el cambio de cuenta
- `list_repos` devolvía **vacío**: ninguna autorización de repositorio
- la lectura funcionaba solo porque el repo era público

Causa raíz: **conectar la cuenta y autorizar repositorios son dos permisos
distintos.** Documentado en `operaciones/TUTORIAL_CONECTAR_GITHUB_A_CLAUDE.md`.

Resuelto el 29 al rehabilitar el repositorio: commits `a7d60c2..e516815`.

### Observador V17 en el PC

Dos fallos de instalación resueltos:

1. `Permission denied` en la caché de pip → `PIP_CACHE_DIR` dentro de la carpeta
2. `No module named 'tkinter'` → el Python 3.12.10 se instaló sin `tcl/tk`.
   El instalador en caché estaba truncado y pedía buscar el archivo

**Hallazgo sobre el entrenamiento:** el reinicio invirtió el conjunto de datos.

| clase | después | antes (respaldo) | en papelera |
|---|---|---|---|
| TRABAJANDO | 24 | 11 | 8 |
| **TERMINADA** | **5** | **35** | **30** |
| LIBRE | **0** | 4 | 4 |

`TERMINADA` es el estado que dispara la acción y quedó con 5 ejemplos.
`LIBRE` con cero: el modelo no puede predecirlo. Todo recuperable.

---

## 4. Trading — de la idea al veredicto

### La decisión

De las tres puertas —operar, vender datos, vender el sistema— el operador
eligió **operar**. Señal que ya estaba en el propio esfuerzo: nadie optimiza a
0.9 ms para vender archivos CSV.

### Latencias medidas, no estimadas

| origen | spot | futuros |
|---|---|---|
| **VM de Tokio** | 19.2 ms | 14.3 ms |
| **PC en Perú** | ~470 ms | ~490 ms |

Un humano en Perú necesita 1.5–2 s (red + render + reacción + clic + red).
La máquina en Tokio, ~25 ms. **Entre 60 y 80 veces más rápido.**

La RTX 3050 no influye: el cuello está en la red y la reacción, no en el cálculo.

### El basis spot-futuros: muerto por aritmética

```
la separación es de:      4.12 pb
lo que cuesta cobrarla:  30.00 pb  (4 operaciones: 2 en spot + 2 en futuros)
```

Simulación en vivo con 200.000 USD por pata, caminando el libro, con
comisiones y latencia real:

```
[ABRE ] basis -4.15 pb | 2.5786 BTC
[CIERRA] basis -3.60 pb | resultado -600.35 USD
...
saldo realizado:  -2,414.12 USD  (-1.21 %)
posición abierta:   -606.83 USD
TOTAL:            -3,020.95 USD  en 1.3 minutos
```

Cada operación perdía ~600 USD: exactamente las comisiones. La ganancia bruta
era de 11 USD. **El coste es 55 veces mayor que el movimiento.**

Con umbral realista (35 pb): **cero operaciones**, la oportunidad nunca llega.
Con umbral agresivo (3.5 pb): operaciones que pierden 600 cada una.
No hay punto intermedio.

### Profundidad del libro

Medido: **20 niveles no alcanzan** para 200.000 USD.

```
spot, lado de venta: 20 niveles cubren solo 110.020 USD
para 2.58 BTC hicieron falta 46 niveles
```

El libro de spot es mucho más delgado que el de futuros (1.42 BTC contra 5.32
en los mismos 20 niveles). Grabador subido a 100 niveles.

### El hallazgo más útil: dónde está la frontera

Movimiento medio del precio contra el coste de operar direccional (10 pb):

| tiempo | movimiento | ¿alcanza? |
|---|---|---|
| 5 s | 0.13 pb | ❌ |
| 60 s | 1.26 pb | ❌ |
| 5 min | 4.32 pb | ❌ |
| **15 min** | **8.84 pb** | casi |
| ~20 min | ~10 pb | frontera |
| ~1 h | ~18 pb | ✅ |

**Por debajo de ~20 minutos de posición, el peaje se come el movimiento.** Da
igual la señal, la velocidad o el hardware. Esto descarta el scalping de
segundos con comisiones de cuenta normal.

Nota: que el precio se mueva 18 pb no es ganancia — se mueve arriba o abajo.
Pero por encima de esa frontera **hay algo que ganar**; por debajo no lo había.

---

## 5. Herramientas construidas

En `/home/trading/basis/` (VM de Tokio):

| archivo | qué hace |
|---|---|
| `registrar_libro.py` | 100 niveles de spot y futuros, 1/s, gzip, ~7.8 MB/día |
| `registrar_trades.py` | operaciones con lado agresor, sin huecos por `fromId` |
| `simular_libro.py` | camina el libro, comisiones, control de sanidad |
| `simulador_vivo.py` | papel en vivo con 200.000 USD y latencia real |
| `probar_hipotesis.py` | H1 muro, H2 delta, H3 POC, con control de azar |
| `perfil.py` | volume profile, footprint, value area, POC, DOM |
| `medir_latencia.py` | latencia real de ida y vuelta, p50/p95 |
| `profundidad.py` | cuánto libro hace falta para un tamaño dado |

Todas: **solo lectura, sin claves, sin órdenes.**

---

## 6. Estado al cierre

**Corriendo hasta las 10:31 UTC del 29:**
- grabador de libro (pid 315024)
- grabador de operaciones de futuros

**Resuelto:**
- Vertex cortado
- repositorio migrado y push restablecido
- observador V17 instalado y entrenando
- basis descartado con números

**Pendiente:**
- claves del testnet (no bloquean nada todavía)
- calibrar el filtro del muro con 3 h de datos
- H2 y H3 pendientes de alinear relojes
- el mecanismo de la asociación del 99 % sigue abierto
- el gate 5 s contra 30 s, pendiente de autorización del operador

---

## 7. Lo que enseñó la sesión

**Sobre método.** Doce afirmaciones retiradas, seis encontradas por otro. El
patrón que se repite: concluir desde una medición que no medía lo que decía.
Un banco sin control positivo, un filtro que no filtra, una búsqueda con
`-maxdepth` corto, un runtime distinto al de producción.

**Sobre trading.** La velocidad no crea ventaja, solo la conserva. Se demostró
perdiendo 3.020 USD simulados yendo 70 veces más rápido que un humano. El
problema nunca fue la velocidad: era que la comisión superaba al movimiento.

**Sobre el orden de trabajo.** Primero la ventaja, después la velocidad, la
ejecución y las claves. Al revés es lo que se probó que pierde dinero.
