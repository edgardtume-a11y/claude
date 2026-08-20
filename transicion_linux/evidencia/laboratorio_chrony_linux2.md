# Laboratorio de chrony real — candidato 2.4.1+linux.2

**Fecha:** 20 de agosto de 2026. **Entorno:** contenedor Linux de la sesión, chrony 4.x de Ubuntu
instalado de repositorio (`/usr/bin/chronyc`, root:root 0755). El puerto NTP externo está bloqueado
en este contenedor, así que se montó un par de chronyd locales por loopback: un servidor de estrato 8
(`local stratum 8`, puerto 11123) y un cliente con `-x` (sin control del reloj del host). **Esto
prueba el MECANISMO completo del subsistema de reloj con el binario de producción; no prueba
exactitud UTC real** — eso es de la Fase 2 en el VPS.

## Camino PASS (cliente sincronizado, estrato 9)

`clock_linux.read_clock_evidence()` ejecutado como usuario sin privilegios contra el chronyd vivo:

```json
{
 "pass": true,
 "error_code": "PASS",
 "abs_phase_offset_ms": 0.00642,
 "banda_ms": 0.009303,
 "incertidumbre_total_ms": 0.015723,
 "utc_calificada": "DEMOSTRADA",
 "stratum": 9,
 "leap_status": "Normal",
 "reference_source": "127.0.0.1"
}
```

`preflight_clock()`: pass=True al primer intento.

## Caminos de fallo cerrado, con el binario real

| Estado provocado | error_code | pass | utc_calificada |
|---|---|---|---|
| chronyd detenido | `CHRONYC_COMMAND_FAILED` | false | UNKNOWN |
| chronyd vivo pero sin fuente (arranque frío sin red) | `CHRONY_UNSYNCHRONIZED` («chrony no informa una fuente activa») | false | UNKNOWN |
| Ejecutar el bootstrap como root | `ROOT_PROCESS_FORBIDDEN` (nada se inicia) | — | — |
| `--mode preflight` sin margen de disco | `DISK_SPACE_INSUFFICIENT: libres=29.3 GiB (11.6%)` | false | — |

## Sidecar en vivo

`chrony_sidecar.py` contra el chronyd real, como usuario sin privilegios: escribió JSONL válido con
`schema_version`, `boot_id`, doble marca `observed_utc_ns`/`observed_monotonic_ns`, `tracking.pass=true`,
`informational_only=true` y `session=null` (correcto: no había captura activa).

## Superficie completa de un clic

`./INICIAR.sh --mode offline` como usuario sin privilegios, desde el ZIP frío: `OFFLINE_READY`
(integridad 161 archivos + batería 292/2 + benchmark, dentro de los hijos aislados reales).
