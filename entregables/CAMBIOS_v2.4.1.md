# CAMBIOS v2.4.1 — El panel deja de robarle el primer plano a la captura

Continúa la cadena de 2.4.0 y cierra la MISMA causa raíz por el otro extremo.
**Corrección de comportamiento, no de criterio**: ningún límite, basis o gate
cambia.

## Motivo (evidencia de campo, sesión `aa1e3beafeec` + reporte del usuario)

El usuario lo describió antes de que el análisis llegara ahí: *«abre solito el
servidor en vivo y cambia de pestaña, lo que ocasiona que se cambie de cmd a
pestaña de navegador (Edge), y lo tengo que estar así»*.

La evidencia del run lo fecha con precisión. `control/browser.json` registra
`attempted_utc_ns` **4.0 s** después de la primera línea del log del proceso.
El `max` de `writer_cooperative_yield` de USDⓈ-M sube en escalones justo a
partir de ahí:

| t (s) | max writer_yield |
|---|---|
| 5.0 | 1.036 ms |
| 10.0 | 3.8 ms |
| 30.0 | 9.404 ms |
| 105.1 | **14.2 ms** |

y se queda clavado en 14.2 ms el resto de los 30 minutos. **14.2 ms es del
orden del tic de 15.625 ms** del temporizador degradado — la firma exacta de
un proceso al que Windows 11 le aplicó EcoQoS.

El mecanismo completo, ya con las dos piezas:

1. el launcher abría el panel automáticamente a los pocos segundos de
   arrancar la captura;
2. el navegador se ponía DELANTE de la consola, así que la captura dejaba de
   estar en primer plano;
3. Windows 11 degrada (E-cores + se ignora la petición de temporizador de
   1 ms) a los procesos que no están en primer plano;
4. y el opt-out que debía protegerlo de eso **no se estaba aplicando** por el
   bug de handle que corrigió 2.4.0.

2.4.0 arregla (4). 2.4.1 arregla (1) y (2): son independientes y conviene
cerrar los dos. De paso desaparece la molestia real del usuario, que tenía
que volver a la consola a mano una y otra vez.

## Qué cambia

- **`_should_open_browser(spec, *, no_browser)`** (nuevo, puro): una etapa
  CERTIFICABLE (`healthy_seconds is not None`, o sea 10m/30m/120m) **nunca**
  abre el panel — motivo `CERTIFICATION_FOREGROUND_PROTECTION`. En uso normal
  se sigue abriendo, que para eso está, salvo la nueva bandera.
- **`--no-browser`** en el launcher: no abrir el panel tampoco en uso normal
  (motivo `USER_REQUESTED_NO_BROWSER`).
- **`_browser_evidence(...)`** (nuevo, puro): `control/browser.json` conserva
  SIEMPRE las mismas claves y añade `skipped` y `skip_reason`. Un run que no
  abrió el panel dice por qué; y uno omitido no puede fingir que lo intentó
  (`attempted_utc_ns` queda en `null`).
- **El panel NO se apaga.** El servidor sigue sirviendo la misma URL, que se
  imprime en pantalla. Quien quiera mirarlo lo abre cuando quiera —
  simplemente el programa ya no decide por el usuario en mitad de una
  medición.

## Pruebas

Suite offline completa: **263 passed, 2 skipped** (11 pruebas nuevas en
`tests/test_browser_foreground.py` y 1 en `tests/test_runtime_contract.py`):

- ninguna de las tres etapas certificables abre el panel;
- uso normal lo sigue abriendo;
- la bandera manda en uso normal y NO puede forzar la apertura en una etapa
  certificable;
- la evidencia tiene el mismo juego de claves se abra o no, y un run omitido
  no finge un intento;
- `run_capture` exige la política del panel por keyword;
- contrato de origen: `main` decide con `_should_open_browser` ANTES de
  llamar a `run_capture` y le pasa las dos cosas;
- la bandera existe en la línea de comandos;
- **una sola puerta**: `webbrowser.open` aparece una vez en todo el launcher,
  dentro de `_open_browser_once`, y su única llamada está bajo la guarda
  `if open_browser:`.
- **la segunda puerta también queda cerrada**: `dual_main.py` es un entry
  point público (`jean-flow`) con su propio `webbrowser.open`. El launcher
  siempre le pasa `--no-browser` (hay un test que fija ese literal), y además
  el propio motor no abre el panel si trae `--healthy-seconds`, así que
  invocarlo a mano tampoco degrada una etapa certificable. Prueba funcional:
  una etapa con `healthy_seconds` y `no_browser=False` no llama ni una vez a
  `webbrowser.open`.

## Sin cambios

Límites EXACTAMENTE iguales (p99 ≤ 5 ms y ≤ 40 ms, revisión 2.3.4), basis de
2.3.9 intacto, esquema 2.0.0, journals, sellos por archivo, commitment,
identidad, doble replay y gates estructurales sin tocar. El dashboard, el
servidor HTTP y la captura funcionan igual que antes.
