# CAMBIOS v2.3.9 — Exclusión de calentamiento explícita del gate de p99

Continúa la cadena de 2.3.8. Revisión de CRITERIO documentada (nunca
silenciosa) + diagnóstico nuevo. Los límites numéricos NO cambian.

## Motivo (evidencia de campo, sesión `b977be885902`)

Etapa certificable de 10 minutos (BTCUSDT, 2026-08-14, motor 2.3.8, C:):
captura SANA de punta a punta — 0 overflows, libros SYNCED, causalidad,
identidad, commitment y doble replay PASS, 600.0 s sanos completados — y
veredicto DATA_GATES_FAILED por UN gate: `writer_yield_p99` spot con
worst_p99 = 9.525 ms (límite 5 ms).

El detalle por ventana del propio `jean_flow_metrics.jsonl` muestra que el
pico pertenece al ARRANQUE del proceso: ~3 muestras de 9.5-13.7 ms en los
primeros segundos quedaron dentro de la ventana deslizante (10 000 muestras,
que con ~388 yields en 10 min nunca desaloja) y, con solo ~200 muestras
acumuladas, el estimador nearest-rank devolvió esos picos como p99 desde la
primera ventana hasta el segundo ~70. El estado estacionario fue 2.8-3.2 ms
durante los 530 s restantes — un orden de magnitud bajo el límite.

Un gate cuyo basis es worst-p99 sobre TODAS las ventanas convierte el costo
fijo de arranque (import, sincronización inicial, primer snapshot REST,
actividad residual del host) en veto de una captura estacionariamente
perfecta. El gate certifica salud SOSTENIDA de captura; el arranque no es
lo que certifica.

## Cambio de criterio (explícito, verificable)

- Basis del gate p99 desde 2.3.9: worst-p99 sobre las ventanas emitidas
  DESPUÉS de los primeros **120 s** de calentamiento (referencia: primera
  ventana de métricas del mercado). `METRICS_WARMUP_EXCLUSION_S` en
  `audit.py`; CLI `--warmup-exclusion-s` (0 = comportamiento 2.3.8).
- Honestidad del cambio, en el propio informe `audit_metrics.json`:
  - cada gate publica SIEMPRE ambos valores: `worst_value_ms` (evaluado) y
    `worst_value_ms_incl_warmup` (todas las ventanas);
  - el `basis` declara qué se evaluó: `worst_p99_post_warmup` cuando la
    exclusión aplicó, `worst_p99` cuando no;
  - el bloque `warmup_exclusion` declara segundos, referencia, ventanas
    totales/excluidas/evaluadas y si aplicó;
  - `worst_p99_ms_post_warmup` se publica junto a
    `worst_p99_ms_across_windows` (que sigue intacto).
- Salvaguardas (el gate NO se vuelve más laxo de lo defendible):
  - un log más corto que el corte se evalúa COMPLETO, como hasta 2.3.8
    (sin estado estacionario no hay exclusión);
  - una ventana sin timestamp interpretable NUNCA se excluye (se evalúa);
  - el fallback de muestra pequeña (`max_fallback_small_n`, P0.4b)
    mantiene el MAX absoluto sin recorte de calentamiento;
  - un problema SOSTENIDO sigue vetando: sus picos aparecen también
    después del corte (regresión que lo prueba en
    `tests/test_metrics_warmup.py`).
- Documentado aquí, en `CERTIFICACION_FASE1.md` (tabla de límites +
  revisión 2.3.9) y en `README.md`/`LEEME_PRIMERO.txt`, siguiendo la regla
  de la revisión 2.3.4: toda revisión de criterio es explícita.

## Diagnóstico nuevo (sin cambio de comportamiento)

La misma sesión registró `foreground_qos=False`: el opt-out de EcoQoS de
2.3.7 no aplicó y no había forma de saber por qué. Desde 2.3.9,
`_set_power_throttling` devuelve el detalle y el log de arranque registra
`foreground_qos_error=<GetLastError>` cuando falla (y `None` cuando no hay
código disponible). La captura continúa igual que antes: es diagnóstico.

## Verificación contra la evidencia real

El `jean_flow_metrics.jsonl` de la sesión `b977be885902` auditado con el
motor 2.3.9: `certification=PASS`, spot `writer_yield_p99`
basis=`worst_p99_post_warmup`, worst 3.16 ms (incl. calentamiento: 9.525),
24 ventanas excluidas / 96 evaluadas por mercado. Con
`--warmup-exclusion-s 0` reproduce exactamente el veredicto 2.3.8 (FAIL,
9.525): la exclusión es la única diferencia.

## Pruebas

Suite offline completa: **244 passed, 2 skipped** (6 pruebas nuevas en
`tests/test_metrics_warmup.py` + detalle de error en
`tests/test_metrics_fidelity.py`).

## Sin cambios

Límites EXACTAMENTE iguales (`parse`/`book_apply`/`book_pipeline_total`/
`writer_yield` p99 ≤ 5 ms, `event_loop_lag` p99 ≤ 40 ms, revisión 2.3.4).
Esquema 2.0.0, journals, sellos por archivo, commitment, identidad, doble
replay, gates estructurales (malformed, pérdidas, terminal, capacidad,
cobertura de ventana), comando aislado (`-X utf8`, 2.3.5), regla de medir
(`perf_counter_ns`, 2.3.6), temporizador fino y opt-out de EcoQoS (2.3.7).
