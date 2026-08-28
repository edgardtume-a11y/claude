# Gate post-máscara: la firma periódica desapareció, la línea base empeoró

28/08/2026 · `20260828T155419Z_tokyo_postmask_gate_30m`

## Procedencia

```
ruta   : /home/trading/jean-flow-exec/staging_runs/
         20260828T155419Z_tokyo_postmask_gate_30m/capture/jean_flow_metrics.jsonl
sha256 : 8ab5cc3ba9c4c3320d9ebf7089cd929b5daf48b4c8008e5ccbf7913889919338
bytes  : 9617595
commit : f1d183b0fad91f2b137b5f087b76b4bd19f67167
duración real : 59.7 min (15:55:26 → 16:55:11 UTC), pese a "30m" en el nombre
```

Este gate **no lo lanzó Claude**. Conviene confirmar con el operador quién
autorizó el lanzamiento.

## Las máscaras aguantaron

Durante toda la captura, en el journal: `packagekit` 0 arranques, `apt-news` 0,
`esm-cache` 0.

## El resultado, normalizado por hora de exposición

Normalizar es imprescindible: los ficheros cubren de 18 min a 4.93 h, y comparar
máximos entre exposiciones distintas es el error de estadístico extremo.

| | horas | mediana | p95 | max | >20/h | >100/h | >400/h |
|---|---|---|---|---|---|---|---|
| gate3 pre-máscara | 4.93 | 46.27 | 342.75 | 475.59 | 665.8 | 47.7 | **16.02** |
| post-máscara | 1.00 | **99.64** | 173.47 | **584.11** | 650.8 | **302.3** | **7.03** |

No es "mejoró" ni "empeoró". Son dos efectos a la vez.

**Desapareció la firma periódica.** Solo 2 flancos por encima de 150 ms, y
ninguno con arranque de PackageKit cerca — no puede haberlo, no hubo ninguno.
La cadencia de 10 minutos no está. Los extremos >400 ms bajan de 16.02/h a
7.03/h: **una reducción del 56 %**.

**Empeoró la línea base.** Mediana de 46 a 100 ms, y >100/h de 47.7 a 302.3.
Con mediana 99.6, la mitad de las ventanas rozan los 100 ms: es un suelo
elevado sostenido, no picos.

## Por qué no se puede atribuir todavía

El post-máscara corre `f1d183b`, con la instrumentación nueva de excedencias,
muestreo de contexto, GC y gauges de colas. **El baseline no declara commit**
(ver `auditoria/GATES_DUPLICADOS_28AGO2026.md`). La comparación mezcla dos
cambios: quitar la cadena de Ubuntu Pro, y añadir instrumentación.

Dos hipótesis, ninguna demostrada:

1. **Efecto observador** de la instrumentación nueva.
2. **Teardown.** El pico de 584 ms cae a las 16:54:39 y la captura termina a las
   16:55:11 — 32 s antes del cierre. Puede no ser régimen estacionario.

La forma barata de zanjar la (1): benchmark offline con excedencias activadas
contra desactivadas, mismo commit. No graba, no necesita autorización.

## Condiciones propuestas para el siguiente gate

Sobre la matriz ya prerregistrada, añadir:

1. **Mismo commit en las dos ramas.** Baseline sin máscaras y tratamiento con
   máscaras, ambos en `f1d183b` o posterior.
2. **`evidence/source_commit.txt` obligatorio**, con fallo al arrancar si falta.
3. **Descartar los últimos 60 s** del análisis de régimen estacionario, o
   instrumentar el teardown.

Exposición ≥ 4 h por rama, para ≥ 20 oportunidades de la cadena de 10 minutos.
Outcome primario: excedencias >100 ms por hora. Secundario: la firma periódica —
si al desenmascarar reaparece la banda de 5 s, cierra el argumento causal mejor
que cualquier percentil.

**Ningún lanzamiento sin orden expresa del operador.**

## Reversibilidad, verificada

```
/etc/systemd/system/apt-news.service   -> /dev/null   (Aug 28 07:36)
/etc/systemd/system/esm-cache.service  -> /dev/null   (Aug 28 07:36)
/etc/systemd/system/packagekit.service -> /dev/null   (Aug 28 07:36)
```

Se deshace con
`systemctl unmask apt-news.service esm-cache.service packagekit.service`.
`apt-daily.timer`, `apt-daily-upgrade.timer` y `unattended-upgrades` siguen
activos: la vía normal de actualizaciones de seguridad no se tocó.
