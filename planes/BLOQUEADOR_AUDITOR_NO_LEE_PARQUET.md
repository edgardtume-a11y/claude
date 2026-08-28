# El auditor no sabe leer Parquet — y el rotador borra los CSV

**Fecha:** 28/08/2026, 13:45 UTC
**Encontrado por:** Claude, revisando la integración antes del gate de 7 días
**Estado: RESUELTO el 28/08 a las 15:25 UTC.** Ver `operaciones/VEREDICTO_AUDITOR_PARQUET.md`. Se tomó la opción B.

~~BLOQUEADOR ABIERTO.~~ No impide lanzar el gate de 6 h. Sí impide
cerrar los 7 días tal como está planteado hoy.

---

## 1. El choque, en una frase

**El rotador borra los CSV según los comprime. El auditor sólo sabe leer CSV.**

Si los 7 días corren con el rotador en modo `--borrar`, al terminar no habrá
un solo `.csv` en la captura. El dato estará **entero y a salvo** en Parquet
—eso está demostrado—, pero el guion de certificación busca esto:

```bash
spot=("$run"/capture/spot/events-*.csv)
usdm=("$run"/capture/usdm_futures/events-*.csv)
```

y no encontraría nada. **La captura sería incertificable.**

---

## 2. Las pruebas

| Comprobación | Resultado |
|---|---|
| Menciones de `parquet` o `pyarrow` en `audit.py` | **0** |
| Cómo abre los ficheros | `path.open("r", encoding="utf-8")` + `csv.DictReader`, en las líneas 327, 518 y 789 |
| Qué recibe el subcomando `journal` | «CSV o globs de un solo mercado» |
| Qué globa `run_live_audits.sh` | `events-*.csv` |

No es una sospecha: el auditor es un lector de CSV de principio a fin.

---

## 3. Por qué no basta con reconstruir y ya está

La reconstrucción **funciona** —está probada byte a byte, con `sha256`
idéntico y el auditor certificando el CSV reconstruido—. El problema es el
tamaño.

El subcomando `journal` recibe **todos los segmentos de un mercado en una sola
llamada** y comprueba la continuidad de `ingest_seq`. Si le das un subconjunto,
ve huecos y falla. Es correcto que lo haga: para eso está.

Eso significa que para certificar los 7 días hay que tener **todos los CSV de
un mercado en disco a la vez**. Y son ~628 GiB. Hay 123 GB.

**Reconstruir al final no cabe.**

---

## 4. Las salidas posibles

### A. Certificar por días, no por semana
Siete auditorías de un día cada una. Un día son ~90 GiB de CSV reconstruido,
que **sí caben** en los 123 GB libres.
- **A favor:** no toca nada certificado. Se puede hacer hoy con el
  reconstructor que ya existe.
- **En contra:** siete certificados en vez de uno. La continuidad *entre*
  días queda sin comprobar por el auditor, y habría que comprobarla aparte
  (que el último `ingest_seq` de un día enlaza con el primero del siguiente).
- **Holgura:** justa. 90 de 123 GB deja poco margen si algo más crece.

### B. Enseñar al auditor a leer Parquet
Que `journal` acepte `.parquet` además de `.csv`, produciendo **exactamente las
mismas filas** que produce hoy desde el CSV. Como el Parquet contiene los
mismos valores (está verificado columna a columna y como texto), los resultados
serían idénticos por construcción.
- **A favor:** es la única salida que escala. Un solo certificado de 7 días. Y
  leer Parquet es **más rápido** que leer CSV, así que la auditoría además
  se acortaría.
- **En contra:** toca `audit.py`, que está certificado. Necesita su propia
  certificación: correr las dos versiones sobre una captura ya certificada y
  exigir informes **idénticos**. Eso es trabajo, pero es trabajo medible.

### C. No borrar durante los 7 días
Descartada. Son 628 GiB y hay 123 GB. Fue el bloqueador original.

---

## 5. Lo que recomiendo

**B, con A como red.**

La prueba de que B es correcta es barata y contundente: coger el gate 4, que ya
está certificado, convertirlo a Parquet, correr el auditor nuevo sobre el
Parquet y el viejo sobre el CSV, y exigir que los dos informes salgan
**idénticos byte a byte**. Si salen idénticos, la capacidad nueva no cambia
ningún criterio de certificación: sólo cambia de dónde lee.

Y mientras B no esté certificada, A permite lanzar los 7 días sin quedarse
bloqueado: se rota, se comprime, y se certifica día a día.

**Lo que NO hay que hacer es lanzar los 7 días sin decidir esto.** El fallo no
aparecería hasta el final, con la semana entera ya capturada.

---

## 6. De paso: la auditoría es secuencial y no tiene por qué serlo

`run_live_audits.sh` hace las cuatro fases una detrás de otra:

```
journal_spot  →  journal_usdm  →  identity  →  metrics
```

Las cuatro son de **sólo lectura** y escriben a ficheros distintos.
`journal_spot` y `journal_usdm` ni siquiera leen los mismos ficheros. La
máquina tiene 8 núcleos y usa uno.

Paralelizarlas **no toca `audit.py`**: es un cambio en el guion que lo llama.
El ahorro va de la suma al máximo de los cuatro.

Antes de hacerlo hay que **medir**, no suponer: cuánto tarda cada fase por
separado y cuánta memoria pide, porque cuatro procesos leyendo CSV grandes a
la vez podrían competir. Es la lección de los 19 ms: no optimizar contra un
número que no se ha comprobado.

Prioridad: **detrás** del bloqueador de arriba. Ahorrar seis minutos no importa
si al final no se puede certificar.
