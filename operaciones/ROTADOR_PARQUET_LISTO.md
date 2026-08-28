# El rotador de Parquet en vivo: escrito, revisado y probado

**Fecha:** 27/08/2026, 23:35 UTC (18:35 Perú)
**Autor del código:** Gemini, bajo contrato.
**Revisión y pruebas:** Claude.
**Estado:** **LISTO.** Falta una sola cosa: la orden del operador para usarlo en
una captura real.

---

## 1. Qué resuelve

La captura escribe **3.74 GiB/h**. Siete días son **628 GiB** y sólo hay 150 GiB
libres. Esta noche se comprimió a mano, con la captura parada, y 32 GB quedaron
en 638 MB. Pero para los siete días eso tiene que ocurrir **solo, mientras
graba**.

Eso es este programa: `/home/trading/jean-flow-exec/herramientas/rotador_parquet.py`

---

## 2. Por qué es seguro tocar ficheros durante una captura

Porque el colector ya tenía resuelto el apretón de manos, y sólo había que
usarlo. Al escribir, el colector usa `{nombre}.csv.partial`. Al terminar hace,
**en este orden**:

```
flush() → os.fsync() → close() → os.replace(partial → .csv) → fsync del directorio
```

Un fichero que se llama `.csv` está **cerrado, completo y durable en disco**.
Y `parquet_store` sólo mira ficheros `.csv`: su `_relative_closed_csv` rechaza
cualquier otro sufijo.

**El colector entrega; el rotador recoge. Nunca se cruzan.**

---

## 3. Lo que hace, y lo que NO hace

Usa `binance_collector.parquet_store` —641 líneas del autor original, probadas
hoy por primera vez— para convertir. **No reimplementa la conversión**: el
recuento de `pq.write_table` en el rotador es **0**. Su trabajo es el lazo que
la llama y el borrado seguro.

Cada ciclo (por defecto cada 60 s, máximo 2 ficheros):
1. Llama a `convert_available` sobre `{run}/capture`.
2. Si —y sólo si— se pasó `--borrar`, **verifica en esa misma ejecución**:
   manifiesto en estado `parquet_valid`, número de filas, columnas iguales,
   valores iguales comparados como texto, y sha256 del CSV.
3. Sólo si las cuatro pasan, borra el CSV.
4. Registra una línea por fichero y duerme.

**Sin `--borrar` no borra nada.** Es el valor por defecto.

---

## 4. La revisión

13 comprobaciones, todas presentes:

| | Salvaguarda | |
|---|---|---|
| R1 | Respeta `.csv.partial` | ✓ |
| R2 | Verifica en la ejecución en curso | ✓ |
| R3 | Sólo bajo `capture/`, con `realpath` | ✓ |
| R4 | Captura `SegmentBusy` y `ParquetStoreError` por segmento | ✓ |
| R5 | Bloqueo exclusivo con `O_EXCL` (una sola instancia) | ✓ |
| R6 | `os.nice(10)`: no compite con la captura | ✓ |
| R7 | Salida limpia ante `SIGTERM` y `SIGINT` | ✓ |
| R8 | Exige que exista `capture/` | ✓ |
| — | Usa `parquet_store`, no lo reimplementa | ✓ (0 `write_table`) |
| — | `--borrar` por defecto `False` | ✓ |

**Un solo punto de borrado de un CSV** en las 493 líneas (línea 454), y está
dentro de cuatro condiciones anidadas: `if args.borrar` → `verificar_segmento`
→ `if verificado` → `if es_seguro_borrar_csv`. Los otros tres `unlink` del
fichero son la gestión del propio bloqueo.

---

## 5. Las pruebas

Laboratorio con dos ficheros: uno **cerrado** (`cerrado.csv`) y uno que simula
estar **en uso por la captura** (`abierto.csv.partial`), ambos con datos reales.

| Prueba | Esperado | Resultado |
|---|---|---|
| Pasada sin `--borrar` | convierte y conserva | **54.18×, CONSERVADO** ✓ |
| Pasada con `--borrar` | reverifica y borra | **VERIFICADO, BORRADO** ✓ |
| **El fichero en uso** | **ni tocarlo** | **huella idéntica antes y después; 0 Parquet generados de él** ✓ |

La tercera es la que decide si esto se puede usar en vivo. Pasa.

Detalle que aporta valor: el rotador **reporta** `regresiones_orden_fisico=1`,
un dato que `parquet_store` detecta por su cuenta y que el conversor manual de
esta noche no habría visto.

### Una corrección sobre mi propia prueba

Mi cuarta comprobación buscaba que el rotador abortara si hay una captura
activa. **La pregunta estaba mal, no el código**: este programa está hecho
precisamente para correr *durante* la captura. Lo que sí debe tener —y tiene—
es `os.nice(10)` para no competir con ella. Confundí la regla del respaldo (que
sí debe abortar) con la del rotador.

---

## 6. Cómo se usa cuando llegue la orden

> ### ⚠️ CORRECCIÓN del 28/08 — el `PYTHONPATH` importa
>
> El ejemplo original usaba el `PYTHONPATH` de la **instalación base**. Está
> mal. El rotador importa `binance_collector.parquet_store`, y desde que se
> añadió la captura de liquidaciones, la base **no** conoce el tipo
> `FORCE_ORDER`: el rotador fallaría en el primer fichero que contuviera una.
>
> **Usa siempre el `PYTHONPATH` de la captura que estás comprimiendo:**
> `PYTHONPATH=<run>/overlay/src`
>
> Regla general: cualquier herramienta que importe módulos del colector debe
> usar el `PYTHONPATH` de su captura, no el de la base. La base es el punto de
> partida de los overlays, no lo que corre.

Con la captura ya lanzada:

```
PYTHONPATH=<run>/overlay/src \
/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python \
/home/trading/jean-flow-exec/herramientas/rotador_parquet.py \
  --run <staging de la captura> --intervalo 60 --max-por-ciclo 2 --borrar
```

**Recomendación para el primer uso real:** correrlo **sin `--borrar`** durante
el primer gate largo. Convierte y conserva; se comprueba que el disco baja de
ritmo y que la latencia no se mueve; y sólo en el siguiente gate se activa el
borrado. El coste de esa prudencia es disco temporal; el beneficio es no
descubrir un fallo con los originales ya borrados.

---

## 7. Lo que sigue faltando

Una prueba **con una captura de verdad corriendo al lado**. Todo lo anterior se
midió con la máquina en reposo. Lo que aún no está demostrado es que el rotador
no altere la latencia mientras el colector trabaja.

Esa prueba **requiere lanzar un gate, y eso necesita la orden del operador**.
El gate de 6 h sería el sitio natural para hacerla.
