# El auditor ya sabe leer Parquet — y certifica exactamente igual

**Fecha:** 28/08/2026, 15:25 UTC
**Autor del código:** Gemini, en tres encargos
**Revisión y banco de pruebas:** Claude
**Staging:** `/home/trading/jean-flow-exec/staging_runs/20260828T143727Z_auditparquet`
**Veredicto: APROBADO.** El bloqueador de
`planes/BLOQUEADOR_AUDITOR_NO_LEE_PARQUET.md` queda **RESUELTO**.

---

## 1. Qué resuelve

El rotador borra los CSV según los comprime. El auditor sólo sabía leer CSV.
Los 7 días habrían terminado con el dato entero y **sin poder certificarse**.

Ahora el auditor lee las dos cosas. Y no es teórico: **el gate 4 ya no tiene
CSV**, sólo Parquet, y acaba de certificarse otra vez desde ellos.

---

## 2. El banco de pruebas: tres caminos que deben coincidir

La verdad son los informes que el gate 4 produjo el 27/08, certificados con
código 0 en las cuatro fases.

| Camino | Resultado |
|---|---|
| El informe guardado (auditor viejo sobre CSV) | la verdad |
| **Auditor nuevo sobre Parquet** | **IDÉNTICO** |
| **Auditor nuevo sobre CSV reconstruido** | **IDÉNTICO** |

Comparación **campo a campo**, con una sola exclusión declarada: `files`, que
legítimamente nombra `.parquet` en vez de `.csv`. Todo lo demás —contadores de
eventos, disposiciones de deltas, percentiles de latencia, identidad causal,
niveles del libro— coincide.

### El número que decide

`replay.sha256` es el hash canónico del libro de órdenes reconstruido. Si una
sola fila cambiara de valor o de orden, cambia.

```
spot   verdad : 1d749fd5d6c741b1d9cba0bdc9f2668fbe796baa7bff5af1113b2e0dc9f36c00
       parquet: 1d749fd5d6c741b1d9cba0bdc9f2668fbe796baa7bff5af1113b2e0dc9f36c00  IGUAL
       csv rec: 1d749fd5d6c741b1d9cba0bdc9f2668fbe796baa7bff5af1113b2e0dc9f36c00  IGUAL

usdm   verdad : f18fe64bdad436ffca4d7777def23c916ba4b38e93c4b8d8019aaac3492e7a21
       parquet: f18fe64bdad436ffca4d7777def23c916ba4b38e93c4b8d8019aaac3492e7a21  IGUAL
       csv rec: f18fe64bdad436ffca4d7777def23c916ba4b38e93c4b8d8019aaac3492e7a21  IGUAL
```

Seis ejecuciones, **las seis con código 0**, `causal_replay: PASS` y
`journal_integrity: PASS`.

---

## 3. Que el cambio no ablandó nada

| | Resultado |
|---|---|
| ¿Se tocó la instalación base? | **NO.** `grep parquet` en `base/audit.py` y `base/reconstruct.py`: **0, 0** |
| Ficheros cambiados | **sólo** `audit.py` (218 líneas) y `reconstruct.py` (61) |
| `collector`, `normalize`, `models`, `protocol`, `config`, `parquet_store`, `dual_main`, `identity`, `metrics` | **idénticos** |
| `EVENT_LOOP_P99_LIMIT_MS`, `METRICS_WARMUP_EXCLUSION_S`, `_MAX_REPORTED_CONFLICTS`, `_MAX_REPORTED_GAP_RANGES` | intactos |
| `_CAUSAL_RECORD_TYPES`, `_REQUIRED_IDENTITY_MARKETS`, `_IDENTITY_COLUMNS` | intactos |
| El apretón de manos `.csv.partial` | conservado en los 6 sitios |
| Pruebas | **33 pasan** |

### El mecanismo

Una sola función, `_iterar_filas`, que vive en `reconstruct.py` y que `audit.py`
importa (ese sentido y no el contrario: `audit` ya importaba de `reconstruct`,
así que no hay ciclo). Genera diccionarios de texto:

- `.csv` → exactamente lo de antes: `open` + `csv.DictReader`
- `.parquet` → `pq.ParquetFile(...).iter_batches()`, lote a lote para no
  materializar 1.3 millones de filas, con la regla
  `"" if v is None else str(v)`

Esa regla es la que hace que los dos caminos den lo mismo, y no es una
suposición: es la misma correspondencia que ya estaba demostrada byte a byte
por el reconstructor.

---

## 4. Los temporales: comprobado, no supuesto

El `glob("*.parquet")` no excluye ningún temporal, y eso me preocupó: durante
la rotación en vivo el auditor podría leer un fichero a medio escribir.

**No ocurre.** `parquet_store` escribe con
`tempfile.mkstemp(prefix=f".{nombre}.", suffix=".partial")`, es decir
`.events-XXX.parquet.ab12cd.partial`: punto delante y sufijo `.partial`.
Ningún `*.parquet` lo alcanza. Dos protecciones, no una.

---

## 5. Una diferencia de comportamiento que sí existe, y hay que saberla

La comprobación de columnas v2 que faltan **no se eliminó**: se movió. Antes
salía de `reader.fieldnames`, que se lee de la cabecera; ahora sale de las
claves de la **primera fila**.

**Consecuencia:** un fichero con cabecera pero **cero filas de datos** ya no
dispararía ese error. Antes sí.

Es un caso estrecho —un segmento vacío no aporta dato que certificar— y no
puede producir un aprobado falso sobre datos reales, porque sin filas no hay
nada que aprobar. Pero es una diferencia real y queda anotada aquí en vez de
quedarse en el diff.

---

## 6. Lo que esto desbloquea

Los 7 días se pueden certificar **de una sola vez**, sin trocear por días y sin
reconstruir 628 GiB. Y como leer Parquet es más rápido que leer CSV, la
auditoría además se acorta.

**Falta el permiso del operador para usarlo.** El código está probado; la
decisión de que la certificación de los 7 días se apoye en esto es tuya.

---

## 7. El error de este encargo fue mío

El primer encargo falló al auditar un Parquet:

```
audit.py:532 audit_journal -> reconstruct(resolved)
reconstruct.py:496 -> csv.DictReader(handle)
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb5 in position 19
```

Le dije a Gemini «exactamente dos sitios, en `audit.py`» y le prohibí tocar
otros módulos. Hizo bien un encargo incompleto: **había un tercer lector en
`reconstruct.py`**.

Y lo que duele es que el dato lo tenía escrito yo. La cabecera de
`reconstruir_csv.py`, escrita anoche, dice literalmente:

> *«el auditor (audit.py) **y el reconstructor (reconstruct.py)** buscan
> exclusivamente ficheros `*.csv`»*

Lo sabía y no lo trasladé al encargo. **Acotar un encargo sirve para que no se
desmadre, pero si lo acoto contra un mapa que no he releído, acoto fuera de
donde está el problema.** La regla que saco: antes de escribir las
prohibiciones de un encargo, releer lo que ya escribí sobre esa misma pieza.

Coste: un ciclo de encargo, unos veinte minutos. Barato porque salió en el
banco de pruebas y no en el día siete de una captura.
