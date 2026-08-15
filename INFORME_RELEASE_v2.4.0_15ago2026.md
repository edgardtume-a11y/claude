# INFORME — Release v2.4.0 de JEAN_FLOW 555 META_QUANT (15-ago-2026)

## Por qué existe esta versión

La sesión `aa1e3beafeec` (etapa de 30 min, BTCUSDT, 2026-08-15 02:56 UTC,
motor 2.3.9, equipo por fin DESATENDIDO) fue la mejor captura hasta la fecha:

- etapa previa de 10 min: **PASS** (la exclusión de calentamiento de 2.3.9
  hizo su trabajo);
- 30 min: 1800.0 s sanos completados, 0 overflows, colas con high-water
  ridículo (79 de 4096 en el writer de spot), 0 líneas malformadas,
  commitment, identidad y **doble replay con sellos idénticos** en ambos
  mercados, spot con `writer_yield_p99` de 1.898 ms;
- vetada por UN gate: `writer_yield_p99` de USDⓈ-M = 9.404 ms.

La causa estaba en la primera línea del log, y sólo era visible gracias al
diagnóstico que había añadido 2.3.9:

```
low_latency_runtime ... fine_timer_1ms=True foreground_qos=False foreground_qos_error=6
```

**6 = ERROR_INVALID_HANDLE.** No es permisos (5), ni parámetro inválido (87):
Windows rechazaba el HANDLE. `_set_power_throttling` llamaba a
`GetCurrentProcess` y `SetProcessInformation` sin declarar
`restype`/`argtypes`, así que ctypes trataba el pseudo-handle `(HANDLE)-1`
como entero de 32 bits. Conclusión: **el opt-out de EcoQoS que 2.3.7
introdujo nunca llegó a aplicarse en ningún equipo x64.** Windows 11 siguió
libre de degradar el proceso a E-cores e ignorar la petición de temporizador
de 1 ms.

Encaja con la medida: el peor yield absoluto fue 14.2 ms —del orden del tic
de 15.625 ms del temporizador degradado—, ocurrió dentro de los primeros
~100 s y **no volvió a repetirse en los 28 minutos siguientes** (el `max` de
la ventana quedó clavado en 14.2 mientras el p99 bajaba por dilución de 9.404
a 1.952).

## Qué cambió (detalle en `CAMBIOS_v2.4.0.md`)

Corrección de BUG. **Ningún límite, basis o gate se modifica.**

1. `_declare_power_signatures` (nuevo): declara los tipos Win64 reales antes
   de llamar (`GetCurrentProcess.restype = c_void_p`;
   `SetProcessInformation.argtypes = (c_void_p, c_int, c_void_p, c_uint32)`,
   `restype = c_int`), con `ctypes` puro (no `wintypes`, que no existe fuera
   de Windows) y tolerando dobles de prueba que no admiten atributos.
2. Handle nulo: no se llama a la API con un handle que no existe.
3. `PROCESS_POWER_THROTTLING_STATE` con `c_uint32` en vez de `c_ulong`: DWORD
   es 32 bits por definición; `c_ulong` acertaba en Windows y medía 8 bytes
   fuera, o sea que el struct sólo tenía el tamaño correcto justo donde la
   suite no puede correr.
4. Documentación: revisión 2.4.0 en `CERTIFICACION_FASE1.md`, changelog,
   README/SECURITY/LEEME al día, 5 sellos de versión en 2.4.0, título de
   `INICIAR.cmd`.
5. Manifiesto: 140 → **142** archivos (changelog + test nuevo).

## Verificación (todo PASS)

| Qué se verificó | Resultado |
|---|---|
| Suite offline en el árbol v2.4.0 | ✅ 251 passed, 2 skipped (7 pruebas nuevas de handle/tipos) |
| `build_release.py` (pipeline oficial) | ✅ PASS: wheelhouse validado, integridad validada, ZIP reproducible |
| Diff de manifiestos v2.3.9 → v2.4.0 | ✅ EXACTAMENTE lo previsto: 2 añadidos, 12 modificados, 0 eliminados |
| ZIP extraído en frío: manifiesto | ✅ 142/142 archivos OK uno a uno, cero extras |
| ZIP extraído en frío: `verify_release_tree` | ✅ PASS, 5 sellos en 2.4.0 |
| ZIP extraído en frío: suite completa | ✅ 251 passed, 2 skipped |
| **Prueba de que NO cambió ningún criterio** | ✅ el `jean_flow_metrics.jsonl` real de `aa1e3beafeec` auditado con el motor 2.4.0 produce un informe **byte a byte idéntico** al que generó 2.3.9 en campo (mismo FAIL, mismo 9.404, mismo 1.898) |
| Instalador `INSTALAR_EN_C_v240.cmd` | ✅ instalación en frío PASS (142/142) y ZIP adulterado RECHAZADO sin tocar la instalación previa |

Lo que la suite offline NO puede demostrar: que Windows acepte ahora la
llamada. Eso se confirma en la próxima sesión de campo, en una línea del log
de arranque: `foreground_qos=True` (y sin `foreground_qos_error`). Si volviera
a salir `False`, el código de error dirá la nueva causa.

## Sellos de la entrega v2.4.0

```
faf0ee37dd41ac1bdde49b61cb37965e8ea8f150acb4c248eea2439c7fb62856  JEAN_FLOW_555_META_QUANT_v2.4.0.zip
6a4e38451ea13415d181abad62bf6ca8c4a9cf4b46ffcdb7297dde0c5b7e45db  RELEASE_MANIFEST.sha256 (dentro del ZIP, 142 archivos)
14f4aede0374c675a5a0c3065bdd46479301fb6d3bd981f9f0ca95098711642b  INSTALAR_EN_C_v240.cmd
49fa18d50627590d6f2969e43266949107923288f02eb28261cdccff09baa019  CERTIFICAR_BTCUSDT.cmd
0f56416003bae8ed21add974996461b8ab3b175243c845c7edea685bd7b7d90e  ARREGLAR_RELOJ.cmd
bb9404cf3555fe2c0fc482a98301f8472b3941628ff0c39083ce55e7a9bbca78  RECOGER_EVIDENCIA_TODO.cmd
595f16d246372494d8dad758438141e6c907b5282b96f19581b08bfc02c6c6a2  HABILIDAD_JEAN_FLOW_555_v240.zip
671807753069ae089485d54cb20a230c1faeb6efc32fd4c5ed79b859fbfeb4d1  HABILIDAD_QUANT_DEV_SENIOR_v4.zip
185d91e8992d3f32c6d6b89e0a363dd8a53bf57a08fcaa1800b0651c0cb8b8bf  PROTOCOLO_JEAN_FLOW_v2.4.0.txt
```

Los sellos de v2.3.9 (ZIP `4f7c873d…`, manifest `08cdf48b…`, 140 archivos)
quedan como evidencia histórica en el historial de git.

## Pasos para Jean (uno a la vez, en este orden)

1. Descargar del chat `JEAN_FLOW_555_META_QUANT_v2.4.0.zip` e
   `INSTALAR_EN_C_v240.cmd` y ponerlos JUNTOS en una misma carpeta.
2. Doble clic NORMAL a `INSTALAR_EN_C_v240.cmd` (nunca "como
   administrador"). Verifica el sello, aparta la instalación anterior y deja
   la nueva en `C:\JF\555`.
3. Doble clic a `CERTIFICAR_BTCUSDT.cmd`: arranca modo 3 con BTCUSDT sin
   preguntar nada y elige sola la instalación con el motor más nuevo.
4. No usar la laptop durante la corrida (~3 h). Al terminar,
   `RECOGER_EVIDENCIA_TODO.cmd` y subir el ZIP del Escritorio.
5. En claude.ai: reemplazar la habilidad `jean-flow-555` por
   `HABILIDAD_JEAN_FLOW_555_v240.zip` y la quant por
   `HABILIDAD_QUANT_DEV_SENIOR_v4.zip`. En el proyecto JOTA, reemplazar el
   protocolo por `PROTOCOLO_JEAN_FLOW_v2.4.0.txt`.

## Si el veto vuelve a aparecer

Si la próxima sesión registra `foreground_qos=True` y AUN ASÍ el
`writer_yield_p99` de un mercado queda alto por picos de los primeros
segundos, entonces el problema no es del sistema operativo sino del basis
estadístico, y hay evidencia acumulada para revisarlo con criterio: con una
ventana deslizante que nunca desaloja (`max_evicted = 0`, 5638 muestras de
10000), el p99 de las ventanas tempranas es rank-quantizado (con ~190
muestras, el p99 es la 2.ª peor) y "worst p99 sobre todas las ventanas" mide
sobre todo el arranque. La revisión natural sería declarar que, cuando la
ventana no desalojó en toda la captura, el p99 de la ÚLTIMA ventana es el
p99 de la captura completa (no esconde nada: contiene el 100 % de las
muestras) y usarlo como basis. Contra la evidencia disponible esa regla
seguiría vetando la sesión mala (`20260814T210203`, p99 finales 5.917 y
~6.2 con Jean usando la laptop) y aprobando las sanas. **No se ha
implementado**: primero hay que ver si el arreglo del sistema operativo hace
innecesaria cualquier revisión.
