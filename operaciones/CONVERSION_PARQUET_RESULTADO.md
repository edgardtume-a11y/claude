# Compresión a Parquet: resultado real

**Fecha:** 27/08/2026, 21:45 – 21:51 UTC (16:45 – 16:51 Perú)
**Orden del operador:** *"COMPRIME LA CARPETA Y ELIMINA EL ARCHIVO […] LUEGO DE
GENERARLO"*
**Duración:** 6 minutos para las once capturas.

---

## 1. El resultado

| | Antes | Después |
|---|---|---|
| `staging_runs/` completo | **32 GB** | **638 MB** |
| Disco libre | 119 GB | **150 GB** |
| Ficheros CSV | 74 | **0** |
| Ficheros Parquet | 0 | **74** |
| **Fallos de verificación** | — | **0** |

**31 GB liberados. Setenta y cuatro conversiones seguidas, ninguna falló.**

### Por captura

| Captura | Antes | Después | Factor |
|---|---|---|---|
| `20260827T143004Z…gate3_2h` | **17.83 GiB** | **0.27 GiB** | **65.41×** |
| `20260827T031500Z…gate2_2h` | 4.35 GiB | 0.06 GiB | 68.61× |
| `20260827T075205Z…tokyo_gate1_30m` | 3.20 GiB | 0.05 GiB | 61.95× |
| `20260827T123816Z…tokyo12_gate2_30m` | 1.38 GiB | 0.02 GiB | 65.89× |
| `20260825T232929Z…orchestrated_10m` | 1.26 GiB | 0.02 GiB | 64.76× |
| resto (6 capturas) | ~4 GiB | ~0.06 GiB | ~60× |

### Un dato útil para planificar

**Los futuros comprimen mejor que el spot: 74-76× contra 58-60×.**

Y los futuros son justo los que generan **el doble** de filas por minuto
(112 800 frente a 52 700). O sea que el formato ayuda más precisamente donde más
pesa. Un fichero de 512 MiB de futuros queda en **6.8 MiB**.

---

## 2. Por qué se pudo borrar con tranquilidad

Cuatro comprobaciones, en este orden, **todas antes** de borrar nada:

1. **Verificación del propio conversor**, por fichero: `tabla.equals()`, número
   de filas y nombres y orden de columnas. Si falla, borra el Parquet recién
   hecho y **conserva** el CSV.
2. **Verificación independiente del revisor.** Se releyeron los Parquet con el
   módulo `csv` de Python —otro motor, otro analizador— y se compararon
   **288 000 celdas**: cero discrepancias.
3. **Revisión del código del borrado**, línea a línea: sólo dentro del `else` de
   la verificación, sólo con `--borrar`, y con comprobación de que la ruta está
   bajo `capture/` y termina en `.csv`.
4. **Vuelta atrás probada antes de tocar nada grande**: se reconstruyó un CSV
   desde su Parquet y se le dio al auditor, que **lo certificó** (`rc=0`).

Y una quinta, ya con todo borrado, sobre la captura más valiosa:

> **Gate 3, fichero de futuros nº 1.** Reconstruido desde su Parquet:
> **1 340 365 filas**, sesión `c37b7c55fca84a6cb08afb8bb43d1a08`.
> Auditor: `causal_replay: PASS`, `journal_integrity: PASS`, **rc=0**.

**El dato vuelve y pasa el examen. Borrar fue reversible.**

---

## 3. Lo que hay que saber

### El auditor no lee Parquet

`grep -c parquet audit.py` = **0**. Lo mismo `reconstruct.py`. Para re-auditar
cualquiera de estas capturas hay que reconstruir el CSV primero, con
`puente_github/scripts/reconstruir_csv.py`. Funciona y está probado, pero **es
un paso que antes no existía**.

Mejora natural: enseñar al auditor a leer Parquet directamente. No es urgente —
la reconstrucción tarda segundos— pero ahorraría el rodeo.

### La reconstrucción no es byte a byte

El CSV reconstruido difiere del original en formato: comillas de cabecera y fin
de línea. En la prueba sobre la captura pequeña la diferencia fue de ~74 KB
sobre 29.8 MB (0.25 %). **El dato es idéntico; el envoltorio no.** El auditor
certifica igual, que es lo que importa.

Si alguna vez hiciera falta el original exacto —para una huella criptográfica
de un fichero concreto, por ejemplo— habría que afinar el dialecto de escritura.
El manifiesto guarda el **sha256 de cada CSV original**, así que la comprobación
seguiría siendo posible una vez ajustado.

---

## 4. Lo que cambia para el objetivo de 7 días

Con la tasa medida de **3.74 GiB/h**:

| Objetivo | En CSV | En Parquet (65×) |
|---|---|---|
| Gate 6 h | 22.4 GiB | **0.34 GiB** |
| Gate 24 h | 89.8 GiB | **1.4 GiB** |
| **7 días** | **628 GiB** | **9.6 GiB** |

Libres: **150 GiB**. Los siete días caben **quince veces**.

**El bloqueador de `planes/BLOQUEADOR_DISCO_7DIAS.md` queda resuelto por la vía
A (compresión), sin coste y sin tocar la facturación.**

---

## 5. Lo que falta para que sirva en el gate de 7 días

Hoy se comprimieron ficheros **ya cerrados**, a mano, con la captura parada. Para
los siete días hace falta que ocurra **solo, mientras graba**, según rota cada
fichero.

Para eso **no hay que escribir nada**: `parquet_store.py` ya existe en el
paquete (641 líneas del autor original) y trae exactamente las piezas que
faltan —`discover_closed_csv` para saber qué segmento ya cerró, `SegmentBusy`
para no tocar el que el colector tiene abierto, bloqueo exclusivo entre procesos,
validación fila a fila y huella lógica por fila.

**Nadie lo importa.** La tarea es **probarlo y engancharlo**, no escribirlo.
Detalle en `planes/PARQUET_STORE_YA_EXISTIA.md`.

### Regla que no cambia

> El conversor en vivo **jamás** debe borrar un CSV que el colector pueda tener
> abierto, ni borrar sin verificar en la ejecución en curso. `SegmentBusy` está
> en `parquet_store.py` precisamente para eso: úsese.
