# INFORME — Verificación y mantenimiento de las skills JEAN_FLOW (14-ago-2026)

## 1. Verificación del paquete v2.3.7 (todo PASS)

Verificación independiente en un entorno Linux limpio, sin tocar ningún archivo del release:

| Qué se verificó | Resultado |
|---|---|
| Sello SHA-256 del ZIP `JEAN_FLOW_555_META_QUANT_v2.3.7.zip` | ✅ EXACTO: `647f4c3d40e763c84499acee36877f043bca0c7a432b2602025135b0858c9216` |
| Sello SHA-256 de `RELEASE_MANIFEST.sha256` | ✅ EXACTO: `cd049213d698d485f19fc1b8bc0040cdc1f709d9c678fb0e204863a7bcccb8d1` |
| Archivos del manifiesto | ✅ 137/137 OK, uno a uno, cero fallos, cero archivos extra |
| `verify_release_tree` (5 sellos de versión) | ✅ PASS — pyproject, jean_flow_launcher.py, `__init__.py`, launcher.py y build_release.py, todos en 2.3.7 |
| Suite offline (Python 3.12, dependencias exactas del lock) | ✅ **238 passed, 2 skipped** — idéntico al resultado sellado; los 2 skipped son los tests de red real (`RUN_BINANCE_LIVE=1`) |
| Wheelhouse (20 wheels) | ✅ 20/20 OK contra `WHEELHOUSE_MANIFEST.sha256`, hashes coincidentes con `requirements.lock` |

Además, una auditoría con 5 agentes en paralelo contrastó CADA afirmación técnica de la habilidad contra el código real: umbrales (5 ms book/writer, 40 ms event loop en `audit.py`), etapas 10+30+120 min (`launcher.py`), temporizador fino + opt-out de EcoQoS con restauración al salir (`latency.py`), UTF-8 en hijos aislados, invariante `count <= count_total`, y los contratos en tests. **Todo coincide.**

## 2. Qué se encontró en las skills

- **`HABILIDAD_JEAN_FLOW_555.zip` (vieja, era v2.3.5)**: comparte `name` y descripción idénticos con la v237 pero declara sellos, instalador y pendientes de v2.3.5. Si convive instalada con la nueva, la activación es ambigua y puede dictar el sello o instalador EQUIVOCADO (falso FAIL de integridad). **Hay que eliminarla de claude.ai.**
- **`HABILIDAD_JEAN_FLOW_555_v237.zip` (vigente)**: técnicamente exacta, pero con: umbrales redactados para la era 2.3.5 ("sin cambios en 2.3.5"), contradicción instalado-vs-pendiente, y sin varias reglas operativas del propio producto (nunca administrador, BTCUSDT para certificar, laptop enchufada + ventana visible, dónde va VALIDAR_EN_WINDOWS.cmd).
- **`SKILL.md` de quant-dev-senior**: un error técnico material — manda usar `time.monotonic_ns()` para latencia local, EXACTAMENTE el reloj de tic 15.625 ms que vetó la certificación v2.3.5 y que el proyecto migró a `perf_counter_ns` en v2.3.6. Además: ordena "comenzar por la Fase 1" cuando la Fase 1 ya existe sellada (riesgo de que un asistente la reimplemente), pide baterías de preguntas que el protocolo prohíbe, y explicaciones línea por línea que no sirven a Jean.

## 3. Qué se mejoró (revisión r2)

**`jean-flow-555` (v2.3.7-r2)** — sin cambiar ningún hecho, sello ni criterio:
- Umbrales actualizados y completos: los 5 límites p99 vigentes, "fijados en 2.3.4, sin cambios hasta v2.3.7".
- Resuelta la contradicción instalado/pendiente (ahora describe la ruta y la regla, no el hecho).
- Aclarado que `INSTALAR_EN_C_v237.cmd`, `RECOGER_EVIDENCIA_4.cmd` y `VALIDAR_EN_WINDOWS.cmd` se entregan FUERA del ZIP, y que el "extrae el ZIP" del LEEME quedó sustituido por el instalador.
- 2 reglas de oro nuevas: instalación única oficial (consolidada) y NUNCA ejecutar como administrador (TokenElevation falla cerrado; única excepción el /resync NTP con UAC).
- Reglas operativas de certificación completas: BTCUSDT en modos 2 y 3, laptop enchufada, sin suspender, sin programas pesados, ventana VISIBLE.
- Precisión sobre veredictos: `RESULT.json` existe en TODA etapa; el marcador de éxito es `CAPTURA_COMPLETA_AUDITADA.json`.
- Sección nueva de triage rápido: STATUS_LOCALE_UNSUPPORTED, HEALTHY_DURATION_INCOMPLETE, ALREADY_RUNNING, etapas por tiempo saludable, UAC_CANCELLED.
- Matiz de seguridad honesto (integridad interna, sin firma externa — SECURITY.md) y aviso de los encabezados viejos del README/SECURITY.
- Registrada la verificación independiente del 14-ago-2026 (sección Estado).
- Descripción con los disparadores que faltaban (INSTALAR_EN_C, RECOGER_EVIDENCIA, VALIDAR_EN_WINDOWS, JOTA, vetos, gates, umbrales, sellos) y regla de precedencia sobre otras skills.
- Nota de mantenimiento: fuente única, regenerar el TXT de JOTA desde el SKILL.md, y eliminar siempre la habilidad anterior al subir una nueva.

**`quant-dev-senior` (nueva versión instalable)**:
- Corregido el contrato de medición: `perf_counter_ns` para duraciones (con la lección GetTickCount64 + EcoQoS documentada para que ninguna fase la reaprenda).
- La Fase 1 declarada como YA IMPLEMENTADA: sus pasos pasan a ser criterios de revisión, no de reconstrucción; el avance a Fase 2 se ancla al marcador `CAPTURA_COMPLETA_AUDITADA.json`.
- Comunicación alineada al protocolo: decisiones ya fijadas no se preguntan; máximo una pregunta por mensaje, texto plano; explicaciones por bloques en español simple; entregables `.cmd`.
- Fase 2 con la realidad de la GPU: el wheel estándar de LightGBM es solo CPU (`device_type="cuda"` exige build con CUDA), límites de la RTX 3050 6 GB (`max_bin`, dataset residente), y comparación obligatoria contra CPU.
- Eliminado Gate.io (no existe en el proyecto; diluía la activación) y declarada la precedencia del protocolo jean-flow-555.
- Empaquetada en el formato instalable correcto: `quant-dev-senior/SKILL.md`.

**Importante**: la copia `SKILL_QUANT_DEV_SENIOR.md` que viaja DENTRO del release v2.3.7 quedó **intacta** — está sellada por el manifiesto y solo puede cambiar vía el proceso completo de release (regla de oro 4). La versión instalable en claude.ai es la vigente mientras tanto.

## 4. Sellos de los entregables nuevos

```
5e02637630f6939a9113fa76c91057042832b677c824c65504d6af7fb7e0cf80  HABILIDAD_JEAN_FLOW_555_v237_r2.zip
684d31e75977b58faebae18ceccce39b1932ca4e7cb8da92dfc8fb57e339923d  HABILIDAD_QUANT_DEV_SENIOR_v1.zip
4b5714df7b413ab3eb4ed9c633ae0727491a9c6dd1e51b7c18b68ac475e5f65a  PROTOCOLO_JEAN_FLOW_v2.3.7_r2.txt
5a4782d8d2090924e9cd0a9851d114a5abc1200ee8a54f83eab161eb098a7cf6  jean-flow-555/SKILL.md (fuente única)
```

## 5. Pasos para activar (uno a la vez)

1. En claude.ai → Configuración → Capacidades/Skills: **ELIMINAR** la habilidad `jean-flow-555` instalada (la vieja).
2. Subir `HABILIDAD_JEAN_FLOW_555_v237_r2.zip`.
3. Subir `HABILIDAD_QUANT_DEV_SENIOR_v1.zip`.
4. En el proyecto JOTA: reemplazar la copia del protocolo por `PROTOCOLO_JEAN_FLOW_v2.3.7_r2.txt`.
5. Guardar los ZIPs viejos como evidencia (no instalados).

El pendiente del producto no cambia: instalar con `INSTALAR_EN_C_v237.cmd` y recertificar modo 3 (INICIAR → 3 → Enter, símbolo BTCUSDT, ventana visible, laptop enchufada).
