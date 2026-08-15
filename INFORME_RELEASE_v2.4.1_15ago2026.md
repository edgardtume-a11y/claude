# INFORME — Release v2.4.1 de JEAN_FLOW 555 META_QUANT (15-ago-2026)

## Por qué existe esta versión

Lo reportó Jean, no el análisis: *«abre solito el servidor en vivo y cambia de
pestaña, lo que ocasiona que se cambie de cmd a pestaña de navegador (Edge), y
lo tengo que estar así»*.

La evidencia de la sesión `aa1e3beafeec` lo confirma y lo fecha.
`control/browser.json` registra la apertura automática del panel **4.0 s**
después de la primera línea del log del proceso. El `max` de
`writer_cooperative_yield` de USDⓈ-M sube en escalones justo a partir de ahí:

| t (s) | max writer_yield |
|---|---|
| 5.0 | 1.036 ms |
| 10.0 | 3.8 ms |
| 30.0 | 9.404 ms |
| 105.1 | **14.2 ms** |

y se queda clavado en 14.2 ms los 28 minutos restantes. **14.2 ms es del orden
del tic de 15.625 ms** del temporizador degradado: la firma de un proceso al
que Windows 11 le aplicó EcoQoS.

El mecanismo completo, con las dos piezas ya identificadas:

1. el launcher abría el panel a los pocos segundos de arrancar la captura;
2. el navegador se ponía delante de la consola → la captura dejaba de estar en
   primer plano;
3. Windows 11 degrada (E-cores + se ignora la petición de temporizador de
   1 ms) a los procesos que no están en primer plano;
4. y el opt-out que debía protegerla de eso **no se aplicaba** por el bug de
   handle que corrigió v2.4.0.

v2.4.0 cierra (4). v2.4.1 cierra (1) y (2). Son independientes: conviene tener
las dos. Y de paso desaparece la molestia real de Jean.

## Qué cambió (detalle en `CAMBIOS_v2.4.1.md`)

Cambio de COMPORTAMIENTO. **Ningún límite, basis o gate se modifica.**

1. `_should_open_browser(spec, *, no_browser)` (nuevo, puro): una etapa
   certificable (`healthy_seconds is not None`) **nunca** abre el panel
   (`CERTIFICATION_FOREGROUND_PROTECTION`). Uso normal lo sigue abriendo.
2. `--no-browser` en el launcher (`USER_REQUESTED_NO_BROWSER`).
3. `_browser_evidence(...)` (nuevo, puro): `control/browser.json` mantiene las
   mismas claves y añade `skipped` y `skip_reason`. Un run omitido no puede
   fingir un intento: `attempted_utc_ns` queda en `null`.
4. **Segunda puerta cerrada**: `dual_main.py` es también un entry point
   público (`jean-flow`) con su propio `webbrowser.open`. El launcher siempre
   le pasa `--no-browser` (hay un test que fija ese literal) y además el motor
   no abre el panel si trae `--healthy-seconds`. Este hueco lo encontró la
   revisión adversarial, no el diseño inicial.
5. El panel **no se apaga**: el servidor sigue sirviendo la misma URL y se
   imprime en pantalla.
6. Manifiesto: 142 → **144** archivos.

## Verificación (todo PASS)

| Qué se verificó | Resultado |
|---|---|
| Suite offline en el árbol v2.4.1 | ✅ 263 passed, 2 skipped (11 pruebas nuevas de panel + 1 funcional) |
| **Mutación 1**: quitar la guarda del motor | ✅ caen 2 tests (`test_el_motor_no_abre_el_panel_en_una_etapa_certificable`, `test_certification_stage_never_opens_the_browser`) |
| **Mutación 2**: quitar `--no-browser` del comando del motor | ✅ cae `test_el_launcher_siempre_le_pasa_no_browser_al_motor` |
| `build_release.py` (pipeline oficial) | ✅ PASS: wheelhouse validado, integridad validada |
| Diff de manifiestos v2.4.0 → v2.4.1 | ✅ 2 añadidos, 13 modificados, 0 eliminados |
| ZIP extraído en frío: manifiesto | ✅ 144/144 uno a uno, cero extras |
| ZIP extraído en frío: `verify_release_tree` | ✅ PASS, 5 sellos en 2.4.1 |
| ZIP extraído en frío: suite completa | ✅ 263 passed, 2 skipped |
| **Prueba de que NO cambió ningún criterio** | ✅ la evidencia real de `aa1e3beafeec` auditada con el motor 2.4.1 produce un informe **byte a byte idéntico** al de campo |
| Instalador `INSTALAR_EN_C_v241.cmd` | ✅ instala 144/144, aparta la previa en `555_anterior_<ts>` sin tocarla |

Un apunte de proceso: el análisis en paralelo (9 agentes, mapa + verificación
adversarial + síntesis) produjo mapas con citas y números de línea inventados
—los verificadores adversariales los cazaron—, pero aportó **dos hallazgos
reales que el diseño inicial no cubría**: la segunda puerta de `dual_main.py`
y la documentación de usuario que seguía prometiendo una apertura que ya no
ocurre. Ambos están corregidos aquí. Nada se aceptó sin comprobarlo contra el
código.

## Sellos de la entrega v2.4.1

```
d378f07653dcfd5e21b88df821ea14753709a4ba3f16f99069fbd23d3380f6ab  JEAN_FLOW_555_META_QUANT_v2.4.1.zip
ca6156075b45bccd6f237d37c789675d1115b82821479b6df478c5470a704d20  RELEASE_MANIFEST.sha256 (dentro del ZIP, 144 archivos)
d11956aa18020d35ae5bd823a564427fe90f29e8d12ad7b9804345993299a654  INSTALAR_EN_C_v241.cmd
49fa18d50627590d6f2969e43266949107923288f02eb28261cdccff09baa019  CERTIFICAR_BTCUSDT.cmd
0f56416003bae8ed21add974996461b8ab3b175243c845c7edea685bd7b7d90e  ARREGLAR_RELOJ.cmd
bb9404cf3555fe2c0fc482a98301f8472b3941628ff0c39083ce55e7a9bbca78  RECOGER_EVIDENCIA_TODO.cmd
53008bf41ae5c661a4cfa43859807319d14febbda53b2beb638b3906d378a4de  HABILIDAD_JEAN_FLOW_555_v241.zip
fadc731004d1b85b904de84880621f8cdc650bffe295baef39e051031c9bbf55  HABILIDAD_QUANT_DEV_SENIOR_v5.zip
2c0acbd89d19bd6afa2030eee7d3b1f74f9cc7f5ee3edb96e1f8f5c6da075137  PROTOCOLO_JEAN_FLOW_v2.4.1.txt
```

v2.4.0 nunca llegó a instalarse en campo; sus sellos quedan en el historial de
git como evidencia.

## Qué mirar en la próxima corrida

1. Línea de arranque: **`foreground_qos=True`** (fix de 2.4.0 aplicado).
2. Que el navegador **no** se abra solo (fix de 2.4.1).
3. `control/browser.json` con `"skipped": true` y
   `"skip_reason": "CERTIFICATION_FOREGROUND_PROTECTION"`.
4. Si con las dos cosas el `writer_yield_p99` sigue alto por picos de los
   primeros segundos, entonces sí toca revisar el basis estadístico
   (documentado en el informe de v2.4.0, sección final). Aún **no** se ha
   tocado.
