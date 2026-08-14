# CAMBIOS v2.3.8 — Mantenimiento documental y guía interna

Entrega SOLO de documentación y de la guía interna para asistentes, sin
tocar ningún umbral, gate, esquema, formato ni ruta de código del motor.
Continúa la cadena de 2.3.7.

## Motivo (verificación independiente del 14-ago-2026)

El release v2.3.7 fue verificado de forma independiente en un entorno
Linux limpio: sello del ZIP exacto, sello del RELEASE_MANIFEST exacto,
137/137 archivos correctos uno a uno, `verify_release_tree` PASS con los
cinco sellos de versión, suite offline reproducida (238 passed,
2 skipped) y wheelhouse 20/20 wheels correctos. La misma revisión auditó
la documentación y la guía interna, y encontró textos desactualizados o
incorrectos que esta entrega corrige.

## Cambios

1. `SKILL_QUANT_DEV_SENIOR.md` (guía interna para asistentes) reescrita:
   - Regla de medir corregida: `perf_counter_ns` para duraciones locales
     (la guía anterior indicaba `monotonic_ns`, el reloj con tic de
     15.625 ms en Windows que vetó la certificación de la sesión
     `5ebb3efde620…`; contrato de medición desde 2.3.6).
   - La Fase 1 se declara IMPLEMENTADA: sus pasos pasan a ser criterios
     de revisión, no pauta de reconstrucción. El avance a Fase 2 queda
     anclado al marcador `runs\CAPTURA_COMPLETA_AUDITADA.json`.
   - Comunicación alineada al protocolo de trabajo: decisiones ya
     fijadas no se preguntan; máximo una pregunta por mensaje, en texto
     plano; explicaciones por bloques en español simple; entregables de
     doble clic.
   - Fase 2 con los requisitos reales de GPU: el wheel estándar de
     LightGBM es solo CPU (`device_type="cuda"` exige build con CUDA),
     límites de la RTX 3050 6 GB y comparación obligatoria contra CPU.
2. `README.md`: el título y el bloque de identificadores decían
   `2.3.0`/`2.2.2` por arrastre de la era de la remediación; ahora
   declaran la versión de la entrega (con nota histórica). «Estado
   verificable» actualizado a 2.3.8.
3. `SECURITY.md`: título actualizado a la versión de la entrega, con la
   aclaración de que el modelo de amenaza rige desde 2.3.0 sin cambios
   de alcance.
4. `LEEME_PRIMERO.txt`: encabezado actualizado y NOVEDAD v2.3.8.
5. Sellos de versión: `2.3.7` → `2.3.8` en los cinco puntos verificados
   por `verify_release_tree` (pyproject, `jean_flow_launcher.py`,
   `__init__.py`, `launcher.py`, `build_release.py`) y en el título de
   `INICIAR.cmd`.

El manifiesto pasa de 137 a 138 archivos (se añade este documento).

## Pruebas

Suite offline completa, sin cambios de tests: **238 passed, 2 skipped**.

## Sin cambios

Umbrales EXACTAMENTE iguales (`book_*_p99 <= 5 ms`,
`writer_yield_p99 <= 5 ms`, `event_loop_lag p99 <= 40 ms` revisión
2.3.4), esquema 2.0.0, journals, sellos por archivo, comando aislado
(`-X utf8`, contrato 2.3.5), regla de medir (`perf_counter_ns`, contrato
2.3.6), temporizador fino y QoS de primer plano (2.3.7). Una
certificación en curso con v2.3.7 sigue siendo válida: el motor es el
mismo.
