# CAMBIOS v2.4.0 — El opt-out de EcoQoS por fin se aplica (bug de handle)

Continúa la cadena de 2.3.9. **Corrección de BUG, no revisión de criterio**:
ningún límite, basis ni gate cambia. Lo que cambia es que una petición al
sistema operativo que llevaba desde 2.3.7 fallando en silencio ahora sí llega.

## Qué pasaba (evidencia de campo, sesión `aa1e3beafeec`)

Etapa de 30 minutos (BTCUSDT, 2026-08-15, motor 2.3.9, equipo desatendido):
captura impecable —0 overflows, colas con high-water ridículo, 0 líneas
malformadas, identidad, commitment y doble replay PASS, 1800.0 s sanos— y
UN solo gate en rojo: `writer_yield_p99` de USDⓈ-M, 9.404 ms.

El log de arranque de esa misma sesión, gracias al diagnóstico que añadió
2.3.9, dice:

```
low_latency_runtime ... fine_timer_1ms=True foreground_qos=False foreground_qos_error=6
```

**6 = ERROR_INVALID_HANDLE.** No es un problema de permisos, ni de versión de
Windows, ni del struct (habrían dado 5 o 87): Windows rechazó el HANDLE.

La causa: `_set_power_throttling` llamaba a `GetCurrentProcess` y a
`SetProcessInformation` sin declarar `restype`/`argtypes`. Sin declaración,
ctypes asume `int` de 32 bits, y el pseudo-handle `(HANDLE)-1` no sobrevive
al viaje a una API de 64 bits. Conclusión incómoda pero clara: **el opt-out
de EcoQoS que 2.3.7 introdujo nunca llegó a aplicarse en ningún equipo x64**.
Todas las sesiones de campo lo venían diciendo (`foreground_qos=False`); hasta
2.3.9 no había forma de saber por qué.

Consecuencia medible: Windows 11 siguió libre de degradar el proceso a
E-cores e ignorar la petición de temporizador de 1 ms durante el arranque.
Los picos de `writer_cooperative_yield` de la sesión encajan con eso: el peor
valor absoluto fue 14.2 ms —del orden del tic de 15.625 ms del temporizador
degradado—, ocurrió dentro de los primeros ~100 s y **no volvió a repetirse
en los 28 minutos restantes** (el `max` de la ventana se quedó clavado en
14.2 hasta el final, mientras el p99 bajaba por dilución de 9.404 a 1.952).

## Qué cambia

1. **`_declare_power_signatures` (nuevo)**: declara los tipos Win64 reales
   antes de llamar — `GetCurrentProcess.restype = c_void_p`,
   `SetProcessInformation.argtypes = (c_void_p, c_int, c_void_p, c_uint32)`,
   `restype = c_int`. Con tipos de `ctypes` puros (no `wintypes`, que no
   existe fuera de Windows) y tolerando dobles de prueba que no admiten
   atributos.
2. **Handle nulo**: si `GetCurrentProcess` devolviera 0, no se llama a la API
   (antes se habría llamado con un handle inválido).
3. **`PROCESS_POWER_THROTTLING_STATE` con `c_uint32`** en vez de `c_ulong`:
   DWORD es 32 bits por definición; `c_ulong` acertaba en Windows (4 bytes) y
   medía 8 fuera, de modo que el struct sólo tenía el tamaño correcto en el
   sistema donde no se puede probar. Ahora mide 12 bytes en Windows y en la
   suite offline, y hay una prueba que lo fija.

Nada más se toca: mismas máscaras (`EXECUTION_SPEED |
IGNORE_TIMER_RESOLUTION` con `StateMask=0` al entrar, `ControlMask=0` al
salir), mismo `timeBeginPeriod(1)`, misma captura.

## Pruebas

Suite offline completa: **251 passed, 2 skipped** (7 pruebas nuevas en
`tests/test_power_qos_handle.py`):

- los tipos Win64 quedan declarados en las dos funciones;
- el pseudo-handle `0xFFFFFFFFFFFFFFFF` llega ENTERO (si alguien vuelve a
  dejar que ctypes lo trunque a 32 bits, la prueba lo delata);
- struct y máscaras intactos, 12 bytes;
- handle nulo no llama a la API;
- un doble antiguo sin atributos asignables sigue funcionando;
- el fallo real sigue reportando su código;
- `fine_timer_resolution` deja `foreground_qos=True` sin campo de error y
  devuelve el control al sistema al salir.

Lo que la suite offline NO puede demostrar: que Windows acepte ahora la
llamada. Eso se confirma en la PRÓXIMA sesión de campo, en una línea del log:
`foreground_qos=True` (y sin `foreground_qos_error`). Si volviera a salir
`False`, el código de error dirá la nueva causa.

## Sin cambios

Límites EXACTAMENTE iguales (`parse`/`book_apply`/`book_pipeline_total`/
`writer_yield` p99 ≤ 5 ms, `event_loop_lag` p99 ≤ 40 ms, revisión 2.3.4) y
basis de 2.3.9 (exclusión de calentamiento de 120 s) intacto. Esquema 2.0.0,
journals, sellos por archivo, commitment, identidad, doble replay, gates
estructurales, comando aislado (2.3.5), regla de medir (2.3.6), temporizador
fino y opt-out de EcoQoS (2.3.7 — que es lo que esta versión hace funcionar
de verdad).
