# INFORME — `ARREGLAR_RELOJ.cmd` (15-ago-2026)

## Síntoma de campo

Tras reiniciar el equipo, dos arranques consecutivos de modo 3 murieron en el
gate NTP, antes de capturar un solo mensaje:

1. `NO_VALID_SOURCE: El gate NTP falló y no admite reparación segura`
   (W32Time todavía sin par activo justo después del arranque).
2. `W32Time informa 372.904 ms respecto de su fuente activa` → el usuario
   autorizó el `/resync` con UAC que ofrece el launcher (2.3.4) y el resultado
   fue `CLOCK_REVALIDATION_FAILED: NTP sigue fuera de umbral:
   OFFSET_OUT_OF_RANGE`.

El camino de auto-reparación del launcher es deliberadamente mínimo: un único
`w32tm /resync` elevado, sin tocar peers, registro, startup, firewall ni GPO
(`README_NTP_WINDOWS.md`). Con la configuración de fábrica —un solo peer
(`time.windows.com`) y `SpecialPollInterval` semanal— un `/resync` puntual no
basta para bajar un desvío de ~373 ms por debajo de 50 ms, y el launcher agota
sus 240 s de revalidación. El gate hace lo correcto al fallar cerrado; lo que
faltaba era un camino de reparación REAL al alcance del usuario.

## Qué es este entregable

`ARREGLAR_RELOJ.cmd` es un envoltorio de un clic para la herramienta manual de
administrador que YA viaja sellada dentro del paquete —
`tools/windows/time-sync/Start-W32TimeRepair.ps1` → `Configure-W32Time.ps1`,
perfil `PublicInternet`. No reimplementa nada ni modifica el árbol instalado.

Lo que hace la herramienta oficial que invoca: respalda
`HKLM\...\Services\W32Time` en `C:\ProgramData\JEAN_FLOW\time-sync` (reversible
con `Restore-W32Time.ps1`), pone W32Time en arranque automático, configura los
cuatro peers `pool.ntp.org` con flag `0x8` y poll de 2048 s (≥1800 s, invariante
del perfil público), reinicia el servicio, hace UN `/resync /rediscover` y
revalida con `Test-W32Time.ps1` reintentando hasta 120 s.

Lo que añade el envoltorio:

- **Localiza la instalación sola** (recorre `C:\JF` hasta 10 niveles y prefiere
  la ruta 2.3.9, luego la más reciente). El equipo del usuario tiene el paquete
  extraído a mano en `C:\JF\140826\22\JEAN_FLOW_555_META_QUANT_v2.3.9\555`, no
  en `C:\JF\555`, así que una ruta fija no habría servido.
- **Sigue comprobando aunque la reparación reporte FAIL**: hasta 6 pasadas de
  `Test-ClockSync.ps1` (el MISMO examen del gate, `-Samples 20 -WarnMs 50`)
  espaciadas 40 s, y corta en cuanto pasa. Cubre el caso real en que W32Time
  converge después de la ventana de 120 s de `Configure-W32Time.ps1`.
- **Un solo UAC**, anunciado antes en castellano llano.
- **Evidencia**: deja `RELOJ_<marca>.txt` en el Escritorio con la salida JSON
  íntegra de la reparación y de cada chequeo, y lo selecciona en el Explorador.
- **Veredicto accionable**: LISTO → «INICIAR.cmd, opción 3, no toques la
  laptop»; NO QUEDO → causa traducida (`DOMAIN_POLICY`,
  `EXTERNAL_TIME_SERVICE`, `CONVERGENCE_TIMEOUT`, `OFFSET_OUT_OF_RANGE`,
  `NO_VALID_SOURCE`, …) y qué hacer.

El motor JEAN_FLOW sigue SIN elevarse: lo único elevado es la configuración de
W32Time, que es exactamente el camino manual de administrador que el propio
paquete documenta.

## Verificación

Sintaxis: `Parser::ParseFile` sobre la carga extraída → PARSE OK. Fichero
`.cmd` ASCII puro con CRLF (`file`: *DOS batch file, ASCII text, CRLF*).

Seis escenarios ejecutados con PowerShell real (7.4.6) contra un árbol falso
con dobles de `Start-W32TimeRepair.ps1` y `Test-ClockSync.ps1`:

| Escenario | Resultado |
|---|---|
| A — reparación PASS y reloj en hora al primer chequeo | ✅ LISTO, desfase publicado, evidencia escrita |
| B — el usuario cancela el UAC (`UAC_CANCELLED`) | ✅ mensaje específico «vuelve a dar doble clic y pulsa SÍ»; no entra al bucle |
| C — reparación FAIL, converge en el 3.er chequeo | ✅ LISTO igualmente (el caso que rescata la sesión del usuario) |
| D — nunca converge (6 chequeos) | ✅ NO QUEDO, causa traducida, ruta del `RELOJ_*.txt` |
| E — no hay herramienta bajo la raíz | ✅ error claro, nada modificado |
| F — dos instalaciones (2.3.8 más reciente en disco) | ✅ elige la 2.3.9 |

## Sello

```
0f56416003bae8ed21add974996461b8ab3b175243c845c7edea685bd7b7d90e  ARREGLAR_RELOJ.cmd
```

## Pendiente de decidir para una futura revisión del paquete

El mensaje de `CLOCK_REVALIDATION_FAILED` no menciona hoy la herramienta de
reparación existente; el usuario no tiene cómo saber que existe. Candidato a
2.4.0 (cambio de texto, no de criterio): nombrar `Start-W32TimeRepair.ps1` —o
incluir este `.cmd` dentro del paquete— en los mensajes `OFFSET_OUT_OF_RANGE` /
`NO_VALID_SOURCE`. No se toca el criterio del gate ni se eleva el motor.
