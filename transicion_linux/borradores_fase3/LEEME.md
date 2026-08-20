# Borradores de la Fase 3 — NO ACTIVADOS

**Estado: BORRADOR. Ninguno de estos archivos está instalado, invocado ni referenciado por el
motor.** La Fase 3 solo se emprende si las fases 1 y 2 aprueban (INFORME_TRANSICION_LINUX_v2,
sección 7). La fase 1 fue ejecutada el 20 de agosto de 2026 con resultado APROBADA
(ver `INFORME_FASE1_LINUX_20ago2026.md`); la fase 2 requiere la decisión de Jean sobre
dónde correr Linux y no ha comenzado.

Estos borradores existen para que la Fase 3, cuando se autorice, empiece desde diseño
revisado y no desde cero. Cumplen las decisiones del proyecto:

- **Un único punto de entrada** (`iniciar.sh`), no cinco.
- **Cero pasos de doble clic nuevos, cero configuración manual nueva.**
- **Ningún umbral se toca**: `CLOCK_WARN_MS = 50.0` y los p99 vigentes quedan como están.
- **`RESULT.pass` y `CAPTURA_COMPLETA_AUDITADA.json` intactos**, con su significado actual.
- **chronyd disciplina el reloj; el proyecto solo lo LEE** en forma legible por máquina y
  sin depender del idioma del sistema (`chronyc -c` emite CSV estable).

| Archivo | Sustituye a | Qué hace |
|---|---|---|
| `iniciar.sh` | `INICIAR.cmd`, `CERTIFICAR_BTCUSDT.cmd`, `ARREGLAR_RELOJ.cmd`, `RECOGER_EVIDENCIA_TODO.cmd`, `INSTALAR_EN_C_v241.cmd` | Punto de entrada único con subcomandos |
| `instalar_linux.sh` | `INSTALAR_EN_C_v241.cmd` | Instalación en frío desde paquete sellado, con verificación de sellos y apartado de la instalación previa |
| `lector_chrony.py` | Las 2 202 líneas de PowerShell de `tools/windows/time-sync/` | Lee el estado de chronyd (CSV, sin regex de texto traducido) y emite el JSON del contrato de `clock_preflight` con la banda honesta &#124;θ̂&#124;+δ/2 |
| `chrony.conf` | Perfil `PublicInternet` de `Configure-W32Time.ps1` | Disciplina del reloj: desliza siempre, escalona solo al arrancar |
| `jean-flow-555.service` | (no existía) | Supervisión systemd del modo captura |

**Regla de oro conservada:** ningún `resync` manual durante una captura. Con chronyd esta
regla queda garantizada por configuración (`makestep` limitado al arranque), no por
disciplina del operador.

**Contrato del protocolo que el punto de entrada preserva** (extraído del análisis de
`PROTOCOLO_JEAN_FLOW_v2.4.1.txt`, los cinco `.cmd` y `LEEME_PRIMERO.txt`):

- Rechazo de privilegios con fallo cerrado (EUID 0 = `CONSOLA_ELEVADA`, nada se inicia).
- Python 3.12 x64 localizado por rutas fijas, nunca por alias del PATH; motor con `-I -S -B -u`.
- `runs/` es evidencia intocable: el recogedor SOLO lee, y copia únicamente informes
  (`.json .jsonl .txt .log .md`, ≤100 MB), jamás CSV de datos — la misma política del
  `.cmd` actual.
- Una sola instalación oficial, creada solo por instalador sellado, en disco interno.
- La política de navegador de la 2.4.1 (etapa certificable jamás abre el panel,
  `browser.json` con el mismo esquema) no cambia.
- La condición «ventana visible» de Windows desaparece (era mitigación de EcoQoS);
  la sustituye `systemd-inhibit` contra la suspensión durante certificaciones.
- El launcher enruta por `error_code`: la taxonomía de los 24 códigos de la cadena de
  gates de reloj se conserva con chronyd como fuente (ver nota en `lector_chrony.py`);
  `STATUS_LOCALE_UNSUPPORTED` desaparece de raíz porque `chronyc -c` no depende del idioma.
