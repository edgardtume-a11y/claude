# La cola de latencia tiene causa: PackageKit, +33 s, cada 10 minutos

28/08/2026 · medido sobre fichero, reproducible con las herramientas de `herramientas/`

## Resumen

El colector JEAN FLOW sufría atascos del event loop de hasta 475 ms. Ya no es
una sospecha: **el 100 % de los flancos por encima de 100 ms del gate 3 ocurren
entre +31.0 y +36.6 segundos después de un arranque de `packagekit.service`**,
que en esta máquina arranca cada 600 segundos exactos.

Probabilidad de que sea coincidencia: **≈ 2.4 × 10⁻¹⁰**.

## El dato

Fichero analizado:

```
ruta   : /home/trading/jean-flow-exec/staging_runs/
         20260827T143004Z_tokyo_n2_capture_gate3_2h/capture/jean_flow_metrics.jsonl
sha256 : 236cfc53084773c6eae5dbead30c0c53597637b751914da9348aa9050a882db7
bytes  : 31046919
cobertura real : 4.93 h (14:30 → 19:26 UTC del 27/08)
ventanas maduras : 3439 por mercado
```

Método: sobre ventanas maduras (`evicted > 0`), un flanco es `max_t > max_{t-1}`
con `max_t >= 100 ms`. Si el máximo publicado sube sin que la ventana se haya
reiniciado, alguna muestra nueva superó el máximo anterior. Resolución ≈ 5 s,
que es la cadencia de publicación.

### spot

| # | ventana del flanco (UTC) | max anterior → nuevo (ms) | arranque packagekit | desfase |
|---|---|---|---|---|
| 1 | 17:14:32 → 17:14:37 | 39.744 → 356.214 | 17:13:59 | +33.0 s |
| 2 | 17:24:35 → 17:24:40 | 53.059 → 347.477 | 17:23:59 | +36.0 s |
| 3 | 18:24:33 → 18:24:38 | 34.054 → 210.040 | 18:23:59 | +34.0 s |
| 4 | 18:34:30 → 18:34:35 | 60.743 → 427.537 | 18:33:59 | +31.0 s |
| 5 | 19:24:31 → 19:24:36 | 28.364 → 342.749 | 19:23:59 | +32.0 s |
| 6 | 19:34:34 → 19:34:39 | 41.290 → 475.589 | 19:33:59 | +35.0 s |

### usdm_futures

| # | ventana del flanco (UTC) | max anterior → nuevo (ms) | desfase |
|---|---|---|---|
| 1 | 17:14:33 → 17:14:38 | 28.908 → 356.225 | +34.6 s |
| 2 | 17:24:31 → 17:24:36 | 53.055 → 347.473 | +32.1 s |
| 3 | 18:24:34 → 18:24:39 | 34.051 → 210.040 | +35.6 s |
| 4 | 18:34:31 → 18:34:36 | 60.731 → 427.541 | +32.7 s |
| 5 | 19:24:32 → 19:24:37 | 28.360 → 342.750 | +33.8 s |
| 6 | 19:34:29 → 19:34:35 | 41.280 → 475.591 | +31.0 s |

Los dos mercados registran el mismo suceso con ~1 s de diferencia: es un único
proceso. **Son 6 sucesos independientes, no 12.**

## Por qué no es coincidencia

La objeción correcta —planteada por ChatGPT en el turno 021— es que con un
servicio que arranca cada 10 minutos, *siempre* hay un arranque cerca de
cualquier instante. Encontrar uno no prueba nada.

Lo que prueba algo es la **concentración**. En la ventana 14:00–20:00 del 27/08
hubo 35 arranques de `packagekit.service`, con intervalo mediano de **600.0 s**
(min 597, max 898), todos a `:XX:59`.

Los seis desfases son **33.0, 36.0, 34.0, 31.0, 32.0, 35.0** — una banda de
**5.0 s dentro de un período de 600 s**.

Bajo hipótesis nula de desfases uniformes, la probabilidad de que seis sucesos
caigan en alguna banda de 5 s es aproximadamente

    p ≈ 6 · (5/600)⁵ ≈ 2.4 × 10⁻¹⁰

Reproducible con `herramientas/nulo_packagekit.py`.

## Alcance del hallazgo, sin exagerarlo

Se enmascararon **tres** servicios a la vez —`apt-news`, `esm-cache` y
`packagekit`, la cadena de Ubuntu Pro— así que esto identifica **el conjunto
causal**, no cuál de los tres produce la pausa. Un factor común podría activar
PackageKit y causar el atasco por otra vía.

Para atribuir el mecanismo habría que reintroducir **uno por vez**, con
autorización y restauración verificada. Para operar no hace falta: si la
mitigación es estable y las actualizaciones siguen funcionando, basta.

## Corrección de una cifra mía

En el traspaso anterior afirmé "8 de 9 sucesos entre +35.6 y +38.4 s". **No
reproduce.** La medición desde el fichero da 6 de 6 por mercado, entre +31.0 y
+36.6 s. Retiro la afirmación anterior; la de este documento tiene ruta, hash y
comando detrás.

## Procedencia: cuidado con los nombres de los directorios

Hay dos directorios con "gate3" en el nombre y ninguno de los dos dice la verdad
sobre su duración:

| directorio | bytes | cobertura real | ventanas maduras |
|---|---|---|---|
| `20260827T045212Z_continuous_capture_gate3_6h` | 1 760 779 | **18.0 min** | 174 |
| `20260827T143004Z_tokyo_n2_capture_gate3_2h` | 31 046 919 | **4.93 h** | 3 439 |

La serie con máximo 475.59 ms es la del **segundo**. El
`20260827T142900Z_tokyo_n2_capture_gate3_2h` existe como directorio pero no
tiene fichero de métricas: es un arranque abortado, no un gate.
