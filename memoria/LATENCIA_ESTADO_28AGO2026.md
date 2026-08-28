# Latencia — estado real al 28/08/2026

Respuesta a *"¿no íbamos a 5 ms?"*, con los números medidos sobre **ventanas
maduras** (`count=10000`; excluido el calentamiento).

## Los 5 ms: es el límite de `book_apply` y `book_pipeline_total`, y YA SE CUMPLE

| gate | mercado | métrica | mediana | **peor** | límite | |
|---|---|---|---|---|---|---|
| 3 (sin uvloop) | spot | `book_apply` | 1.969 | 3.561 | 5.0 | PASA |
| 3 | spot | `book_pipeline_total` | 2.521 | 4.226 | 5.0 | PASA |
| 3 | **futuros** | `book_apply` | 3.662 | **6.282** | 5.0 | **FALLA** |
| 3 | **futuros** | `book_pipeline_total` | 4.279 | **7.399** | 5.0 | **FALLA** |
| **4 (con uvloop)** | spot | `book_apply` | 0.730 | **0.996** | 5.0 | PASA |
| 4 | spot | `book_pipeline_total` | 1.004 | **1.310** | 5.0 | PASA |
| 4 | **futuros** | `book_apply` | 1.538 | **2.347** | 5.0 | **PASA** |
| 4 | **futuros** | `book_pipeline_total` | 1.860 | **2.770** | 5.0 | **PASA** |

**El objetivo está cumplido.** El peor caso del gate 4 es 2.770 ms contra un
límite de 5.0: un **45 % de margen**. En spot el margen es del 74-80 %.

Lo consiguió uvloop. Y esta conclusión **no está afectada** por el problema del
reloj: estas métricas se miden con `time.perf_counter_ns()`, que uvloop no toca,
y su entrada (la profundidad) fue idéntica entre gates.

## Los otros dos frentes

**`event_loop_lag` (límite 20 ms de grado servidor):** nunca fue un problema. El
"19 ms" era la publicación de calentamiento (247 muestras). El peor p99 maduro
es **10.9 ms** en el gate 3 y **3.0 ms** en el gate 4. Ventanas maduras en la
banda de los 19: **cero**.

**Los atascos de ~475 ms:** el único frente real que quedaba, y **no está en el
código del colector**. Ver `ATASCO_475MS_INVESTIGACION_28AGO2026.md`: 8 de 9
sucesos a +35.6/+38.4 s del arranque de PackageKit, en 3 gates y 2 días.

## Acción aplicada el 28/08/2026 08:45 UTC (orden del operador)

```
systemctl mask apt-news.service esm-cache.service packagekit.service
```

Resultado verificado:

| unidad | antes | después |
|---|---|---|
| `apt-news.service` | static / inactive | **masked** |
| `esm-cache.service` | static / inactive | **masked** |
| `packagekit.service` | static / **active** | **masked / inactive** |
| `apt-daily.timer` | enabled / active | enabled / active (intacto) |
| `apt-daily-upgrade.timer` | enabled / active | enabled / active (intacto) |
| `unattended-upgrades.service` | enabled / active | enabled / active (intacto) |

**Las actualizaciones de seguridad no se han tocado**: van por
`apt-daily` / `unattended-upgrades`, que siguen habilitadas y activas. Lo
enmascarado es la maquinaria de noticias de apt y cachés de ESM, que un colector
de trading no usa.

Reversible en cualquier momento:

```
sudo systemctl unmask apt-news.service esm-cache.service packagekit.service
```

## Prueba pendiente

El siguiente gate corto debe comparar la cola (`max` en ventanas maduras) contra
el gate 3, que dio mediana 46.3, p95 342.75 y máximo 475.59. Si la cola se
desploma, queda cerrado.

## Resumen para el operador

| frente | objetivo | estado |
|---|---|---|
| `book_apply` / `book_pipeline_total` | < 5 ms | **CUMPLIDO** (peor 2.770, margen 45 %) |
| `event_loop_lag` | < 20 ms | **CUMPLIDO** (peor maduro 10.9; el 19 era calentamiento) |
| atascos de 475 ms | eliminar | **causa localizada y enmascarada**; falta confirmarlo con un gate |
