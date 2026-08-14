# INFORME — Release v2.3.8 de JEAN_FLOW 555 META_QUANT (14-ago-2026)

## Qué es esta entrega

Todo el mantenimiento auditado quedó APLICADO AL PRODUCTO, siguiendo el proceso completo de la regla de oro 4: tests → `tools/build_release.py` → RELEASE_MANIFEST.sha256 → sello del ZIP → nueva versión con los 5 sellos verificados por `verify_release_tree`. **Cero ediciones a mano sobre ninguna instalación.**

Es una entrega **SOLO documental**: ningún cambio de código del motor, umbral, gate, esquema ni formato. El motor es el mismo de v2.3.7; una certificación corrida con v2.3.7 sigue siendo válida.

## Qué cambió (detalle en `CAMBIOS_v2.3.8.md` dentro del ZIP)

1. **`SKILL_QUANT_DEV_SENIOR.md`** (guía interna para asistentes) reescrita: regla de medir corregida (`perf_counter_ns`; la guía vieja indicaba `monotonic_ns`, el reloj del tic de 15.625 ms que vetó la certificación v2.3.5), Fase 1 declarada implementada con avance anclado a `runs\CAPTURA_COMPLETA_AUDITADA.json`, comunicación conforme al protocolo, y requisitos reales de LightGBM/CUDA para la RTX 3050 6 GB.
2. **`README.md`**: título e identificadores decían `2.3.0`/`2.2.2` por arrastre; ahora declaran la versión de la entrega (con nota histórica). «Estado verificable» actualizado.
3. **`SECURITY.md`**: título al día (mismo modelo de amenaza desde 2.3.0).
4. **`LEEME_PRIMERO.txt`**: encabezado v2.3.8 y NOVEDAD v2.3.8.
5. **Sellos de versión**: `2.3.7` → `2.3.8` en los 5 puntos + título de `INICIAR.cmd`.
6. El manifiesto pasa de **137 a 138 archivos** (se suma el changelog).

## Verificación del ZIP v2.3.8 construido (todo PASS)

| Qué se verificó | Resultado |
|---|---|
| Diff de manifiestos v2.3.7 → v2.3.8 | ✅ EXACTAMENTE lo previsto: 1 archivo nuevo (CAMBIOS_v2.3.8.md), 10 modificados (los 9 documentos/sellos + guía interna), 0 eliminados |
| Suite offline en el árbol v2.3.8 | ✅ 238 passed, 2 skipped (idéntica a v2.3.7 — ningún test cambió) |
| `build_release.py` (pipeline oficial) | ✅ PASS: wheelhouse validado, integridad validada, ZIP reproducible |
| ZIP extraído en frío: manifiesto | ✅ 138/138 archivos OK uno a uno, cero extras |
| ZIP extraído en frío: `verify_release_tree` | ✅ PASS, 5 sellos en 2.3.8 |
| ZIP extraído en frío: suite completa | ✅ 238 passed, 2 skipped |

## Instalador `INSTALAR_EN_C_v238.cmd` (nuevo, probado)

Sigue las convenciones del protocolo: doble clic, autocontenido, ASCII puro + CRLF, patrón `rem ==CARGA==` con payload PowerShell embebido. Qué hace, en orden:

1. Rechaza consola elevada (nunca "Ejecutar como administrador").
2. Busca el ZIP junto al instalador (o en Descargas) y verifica su sello SHA-256.
3. Extrae a una carpeta temporal y verifica el manifiesto: su propio sello, las 138 entradas, cada archivo uno a uno, y que no haya archivos extra.
4. Aparta la instalación previa como `C:\JF\555_anterior_<fecha>` — **no borra nada, la previa queda como evidencia**.
5. Deja la instalación oficial en `C:\JF\555` y escribe un `INSTALACION_v238_RESULT_<fecha>.json` junto al instalador.

Probado en esta sesión con PowerShell real: **instalación completa en frío PASS** (138/138 verificados, previa apartada, resultado JSON) y **ZIP adulterado RECHAZADO** con mensaje claro y sin tocar nada.

## Sellos de la entrega v2.3.8

```
616a6561d8220b66ba0ff7d7700905793dd0d58f7bd98da0c932005f5d677854  JEAN_FLOW_555_META_QUANT_v2.3.8.zip
16d9b97c2d74f47dc4a33c93bc4c8dda1fa8ac1a8ae37bbfca5d0db7aa9850a1  RELEASE_MANIFEST.sha256 (dentro del ZIP, 138 archivos)
d48fcc9e1efe53a49dbfaeda0dc54d9dc419cedf8def393344fed40827cba9e6  INSTALAR_EN_C_v238.cmd
d81a7c85998ef99dfb3302007d3250298c131e1c90e0ee5f5ada22ec2bbaa90a  HABILIDAD_JEAN_FLOW_555_v238.zip
93148d07d6f2035c66e4106de722d09f0ff8b6f027070d52ec92d630b127ee7e  HABILIDAD_QUANT_DEV_SENIOR_v2.zip
4d17095ac61c99e92939188c2719f3142092989181d3bcaf9b322281571eb2bb  PROTOCOLO_JEAN_FLOW_v2.3.8.txt
```

Los sellos de v2.3.7 (ZIP `647f4c3d…`, manifest `cd049213…`, 137 archivos) quedan como evidencia histórica.

## Pasos para Jean (uno a la vez, en este orden)

1. Descargar del chat `JEAN_FLOW_555_META_QUANT_v2.3.8.zip` e `INSTALAR_EN_C_v238.cmd` y ponerlos JUNTOS en una misma carpeta (por ejemplo Descargas).
2. Doble clic NORMAL a `INSTALAR_EN_C_v238.cmd` (nunca "como administrador"). Él solo verifica el sello, aparta la instalación anterior y deja la nueva en `C:\JF\555`.
3. Certificar: abrir `C:\JF\555`, doble clic a `INICIAR.cmd`, opción `3`, Enter (símbolo BTCUSDT, el menú ya lo sugiere). Laptop enchufada, sin programas pesados, ventana negra VISIBLE.
4. Tras el veredicto: juntar evidencia con `RECOGER_EVIDENCIA_4.cmd` y subir UN zip al chat.
5. En claude.ai: ELIMINAR la habilidad `jean-flow-555` instalada y subir `HABILIDAD_JEAN_FLOW_555_v238.zip`; subir también `HABILIDAD_QUANT_DEV_SENIOR_v2.zip`. En el proyecto JOTA, reemplazar el protocolo por `PROTOCOLO_JEAN_FLOW_v2.3.8.txt`.
