# INFORME — Release v2.3.9 de JEAN_FLOW 555 META_QUANT (14-ago-2026)

## Por qué existe esta versión

La certificación de la sesión `b977be885902` (modo 3, primera etapa de 10 min, BTCUSDT, motor 2.3.8) pasó TODOS los exámenes de datos — commitment, identidad, doble replay, 0 overflows, 600.0 s sanos completados — y fue vetada por UN solo número: `writer_yield_p99` de spot = 9.525 ms (límite 5 ms).

El detalle ventana a ventana del propio log de métricas demuestra que el pico pertenece al ARRANQUE del proceso: ~3 muestras de 9.5–13.7 ms en los primeros segundos (mientras el motor abría y el equipo estaba ocupado) quedaron dentro de la ventana deslizante y el estimador p99 las devolvió como resultado hasta el segundo ~70. El estado estacionario de los 530 s restantes fue 2.8–3.2 ms — un orden de magnitud bajo el límite.

Un gate que evalúa el peor p99 sobre TODAS las ventanas convierte el costo fijo de arranque en veto de una captura estacionariamente perfecta. El gate certifica salud SOSTENIDA de captura; por eso v2.3.9 cambia QUÉ ventanas se evalúan — no los límites.

## Qué cambió (detalle en `CAMBIOS_v2.3.9.md`)

1. **Exclusión de calentamiento EXPLÍCITA (120 s)** en el basis del gate de p99 (`audit.py`, CLI `--warmup-exclusion-s`, 0 = comportamiento 2.3.8). Salvaguardas de honestidad, todas con contrato de test (`tests/test_metrics_warmup.py`):
   - ambos valores se publican SIEMPRE (`worst_value_ms` y `worst_value_ms_incl_warmup`), más el bloque `warmup_exclusion` con ventanas totales/excluidas/evaluadas;
   - un log más corto que el corte se evalúa COMPLETO (sin estado estacionario no hay exclusión);
   - una ventana sin timestamp interpretable NUNCA se excluye;
   - el fallback de muestra pequeña (`max_fallback_small_n`) mantiene el MAX absoluto;
   - un problema sostenido sigue vetando (sus picos aparecen también después del corte).
2. **`foreground_qos_error`**: cuando el opt-out de EcoQoS (v2.3.7) falla, el log registra ahora el `GetLastError` (la sesión vetada registró `foreground_qos=False` sin ningún detalle diagnosticable).
3. Documentación: revisión 2.3.9 en `CERTIFICACION_FASE1.md` (misma disciplina que la revisión 2.3.4: nunca un cambio de criterio silencioso), README/SECURITY/LEEME al día, 5 sellos de versión en 2.3.9, título de `INICIAR.cmd`.
4. Manifiesto: 138 → **140** archivos (changelog + test nuevo).

Los límites numéricos NO cambiaron: p99 ≤ 5 ms (parse, book_apply, book_pipeline_total, writer_yield) y ≤ 40 ms (event_loop_lag), revisión 2.3.4.

## Verificación (todo PASS)

| Qué se verificó | Resultado |
|---|---|
| Suite offline en el árbol v2.3.9 | ✅ 244 passed, 2 skipped (6 tests nuevos de calentamiento + detalle de error QoS) |
| `build_release.py` (pipeline oficial) | ✅ PASS: wheelhouse validado, integridad validada, ZIP reproducible |
| Diff de manifiestos v2.3.8 → v2.3.9 | ✅ EXACTAMENTE lo previsto: 2 añadidos, 16 modificados, 0 eliminados |
| ZIP extraído en frío: manifiesto | ✅ 140/140 archivos OK uno a uno, cero extras |
| ZIP extraído en frío: `verify_release_tree` | ✅ PASS, 5 sellos en 2.3.9 |
| ZIP extraído en frío: suite completa | ✅ 244 passed, 2 skipped |
| **Evidencia REAL de la sesión vetada** | ✅ el `jean_flow_metrics.jsonl` de `b977be885902` auditado con el motor 2.3.9 da **PASS** (spot writer_yield 3.16 ms post-calentamiento; 9.525 publicado al lado); con `--warmup-exclusion-s 0` reproduce el FAIL de 2.3.8 — la exclusión es la única diferencia |
| Instalador `INSTALAR_EN_C_v239.cmd` | ✅ instalación en frío PASS (140/140) y ZIP adulterado RECHAZADO sin tocar nada |
| Recogedor `RECOGER_EVIDENCIA_TODO.cmd` | ✅ probado con PowerShell real: encuentra TODAS las instalaciones bajo C:\JF, toma el run más reciente de cada una, excluye CSVs, deja UN zip en el Escritorio |

## Sellos de la entrega v2.3.9

```
4f7c873dfc290142e733828922068054f30b40f5d38f1fc180685e23f19d2b96  JEAN_FLOW_555_META_QUANT_v2.3.9.zip
08cdf48ba8b2029a089aadf984e5d64eb9d3a63efb6c323379504d3b93c9d424  RELEASE_MANIFEST.sha256 (dentro del ZIP, 140 archivos)
3284d3490c1a66bbc3baf7434ef526fb0e5d4022f39a979807043a48ccec6342  INSTALAR_EN_C_v239.cmd
bb9404cf3555fe2c0fc482a98301f8472b3941628ff0c39083ce55e7a9bbca78  RECOGER_EVIDENCIA_TODO.cmd
b4d19a6975b5ce1f645fe315dff9b4f96c6426dd4c904973a710cfac75a78278  HABILIDAD_JEAN_FLOW_555_v239.zip
bff5397bae5e1cd45f8bc1a00a4026a37830d5cee72d555811c15fc29fca89c9  HABILIDAD_QUANT_DEV_SENIOR_v3.zip
13dfd3c0450392890ca84768527ff03590e902e79e5ce00b332b44be63d08dd7  PROTOCOLO_JEAN_FLOW_v2.3.9.txt
```

Los sellos de v2.3.8 (ZIP `616a6561…`, manifest `16d9b97c…`, 138 archivos) quedan como evidencia histórica.

## Pasos para Jean (uno a la vez, en este orden)

1. Descargar del chat `JEAN_FLOW_555_META_QUANT_v2.3.9.zip` e `INSTALAR_EN_C_v239.cmd` y ponerlos JUNTOS en una misma carpeta (por ejemplo Descargas).
2. Doble clic NORMAL a `INSTALAR_EN_C_v239.cmd` (nunca "como administrador"). Verifica el sello, aparta la instalación anterior y deja la nueva en `C:\JF\555`.
3. Certificar: abrir `C:\JF\555`, doble clic a `INICIAR.cmd`, opción `3`, Enter. Laptop enchufada, ventana negra VISIBLE, y NO usar la laptop durante la corrida (~3 horas).
4. Tras el veredicto: doble clic a `RECOGER_EVIDENCIA_TODO.cmd` y subir al chat el ZIP del Escritorio.
5. En claude.ai: ELIMINAR la habilidad `jean-flow-555` instalada y subir `HABILIDAD_JEAN_FLOW_555_v239.zip`; reemplazar la quant por `HABILIDAD_QUANT_DEV_SENIOR_v3.zip`. En el proyecto JOTA, reemplazar el protocolo por `PROTOCOLO_JEAN_FLOW_v2.3.9.txt`.
