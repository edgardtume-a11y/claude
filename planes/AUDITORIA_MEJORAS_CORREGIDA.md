# Corrección de la auditoría cruzada: 2 de las 3 mejoras ya estaban hechas

**Fecha:** 27/08/2026, ~20:40 UTC (15:40 Perú)
**Quién lo detecta:** el revisor (Claude), al leer el código real antes de
aceptar el trabajo del autor (Gemini).
**Por qué importa:** habríamos pagado tiempo y riesgo por escribir código que
ya existía — y, en un caso, por escribir algo que ni siquiera es aplicable.

---

## 1. Qué había concluido la auditoría cruzada

Claude y Gemini, discutiendo entre ellos, convergieron en tres mejoras:

| | Mejora | Propuesta |
|---|---|---|
| M1 | Domar el recolector de basura | `gc.set_threshold(50000, 50, 50)` + `gc.freeze()` |
| M2 | Escritura del writer por lotes | trocear ~50 filas + `await asyncio.sleep(0)` |
| M3 | Bucle de eventos uvloop | `uvloop` + afinidad de CPU |

Ese es el resultado de dos modelos razonando **sobre un colector asyncio
genérico**. Ninguno de los dos había leído JEAN FLOW.

## 2. Qué dice el código real

### M1 — YA ESTABA. Y mejor de lo que proponíamos.

En `latency.py`, la función `low_latency_runtime()`:

```python
switch_interval = _env_float("PYTHON_THREAD_SWITCH_INTERVAL_S", 0.001)
thresholds = (
    _env_int("GC_THRESHOLD_0", 50_000),
    _env_int("GC_THRESHOLD_1", 100),
    _env_int("GC_THRESHOLD_2", 100),
)
...
gc.set_threshold(*thresholds)
try:
    yield RuntimeTuning(switch_interval, thresholds)
finally:
    gc.set_threshold(*previous_thresholds)   # restaura al salir
    sys.setswitchinterval(previous_switch)
```

Y `dual_main.py:main()` ya envuelve toda la captura dentro de ese contexto.

- El umbral propuesto era `(50000, 50, 50)`. **El real es `(50000, 100, 100)`** —
  el doble de conservador en las generaciones 1 y 2, es decir mejor.
- Además ajusta `sys.setswitchinterval(0.001)`, que la auditoría ni mencionó.
- Es configurable por variables de entorno y **restaura los valores al salir**.
  Nuestra propuesta no contemplaba restaurar.

**Lo único que faltaba de M1: `gc.freeze()`.** Verificado: no existe en ningún
módulo del paquete.

### M2 — YA ESTABA el troceado, y el resto es INAPLICABLE.

El troceado existe desde antes, en `writer.py`:

```python
write_chunk_rows: int = 64          # parámetro con validación
...
self._csv.writerows(chunk)          # escritura por lotes real
```

Propusimos ~50 filas. **El código ya usa 64.**

Y la otra mitad de M2 — `await asyncio.sleep(0)` para cederle el turno al bucle
de eventos — **no se puede hacer, porque no hay bucle de eventos ahí**:

```python
self._thread = threading.Thread(
    target=self._run,
    name="csv-journal-writer",
    daemon=False,
)
```

El escritor es un **hilo del sistema operativo**, no una tarea asyncio. Un
`await` en ese código sería un error de sintaxis. La cesión de turno entre ese
hilo y el bucle ya la gobierna `sys.setswitchinterval(0.001)`, que —otra vez—
ya estaba puesto.

**M2 queda ANULADA.** No por difícil: por innecesaria e inaplicable.

### M3 — ESTA SÍ FALTA.

`dual_main.py:913`:

```python
asyncio.run(_run(args))
```

Bucle de eventos estándar. uvloop 0.22.1 ya está instalado en el venv y sin usar.
Es la única mejora real de las tres.

---

## 3. El alcance corregido

| | Estado real | Acción |
|---|---|---|
| M1 umbrales GC | ya hecho, mejor que lo propuesto | no tocar |
| M1 `gc.freeze()` | **falta** | **añadir** |
| M2 troceado | ya hecho (64 filas) | no tocar |
| M2 cesión de turno | inaplicable (es un hilo, no una tarea) | **anulada** |
| M3 uvloop | **falta** | **añadir** |

De tres mejoras quedan **una y media**, ambas en un solo archivo
(`dual_main.py`), unas quince líneas. El contrato al autor se reescribió a esa
medida.

---

## 4. Las dos lecciones

**Primera, sobre el sistema:** el motor de JEAN FLOW ya hacía, por su cuenta,
lo que dos inteligencias artificiales recomendaron de forma independiente — y
en los dos casos lo hacía mejor que la recomendación. Eso no es suerte: es
código maduro. La auditoría cruzada no encontró agujeros porque casi no los hay.

**Segunda, sobre el método:** una auditoría hecha *sin leer el código* produce
recomendaciones plausibles y falsas. El paso que las separó de convertirse en
trabajo inútil fue el del revisor leyendo el archivo antes de aceptar nada.
Esto confirma el flujo de `operaciones/PROTOCOLO_ROLES_AUTOR_REVISOR.md`:
**el revisor lee el código real antes de encargar; nunca encarga sobre supuestos.**

Corolario práctico: el primer encargo a Gemini pedía las tres mejoras en dos
archivos y **falló por agotar el tiempo** (19 min, `gemini_failed: timeout`).
Al comprobarlo, los dos archivos habían quedado **intactos** — huella idéntica
a la del gate 3 — así que no hubo que limpiar nada. Contratos pequeños no solo
se cumplen mejor: fallan más limpio.
