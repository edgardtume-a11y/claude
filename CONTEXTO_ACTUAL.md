# CONTEXTO ACTUAL — para retomar el trabajo en cualquier chat nuevo

**Última actualización:** 1 de septiembre de 2026
**Cubre:** todo lo trabajado del 28 al 29 de agosto, más el estado al 1 de septiembre.
**Para quién:** Claude, ChatGPT o cualquier IA que retome esto. Léelo entero antes de tocar nada.

---

## ⚠️ LO PRIMERO: la VM de Tokio está APAGADA

Verificado el 1/09: `jean-flow-02-tokyo` lleva **77 horas fuera de línea** (desde el
29/08 ~09:00 UTC). El PC Windows `AS40569324` sí está en línea.

Consecuencia: **todo lo que corría en la VM se detuvo con ella.** Nada de lo de
abajo se ha podido verificar desde entonces. Antes de asumir cualquier estado,
encender la VM y comprobar.

Lo que corría cuando se apagó:

| proceso | qué hacía | fin previsto | estado real |
|---|---|---|---|
| `registrar_libro.py` | 100 niveles de libro, spot+fut, 1/s | 10:31 UTC 29/08 | **desconocido** |
| `registrar_trades.py` | operaciones de futuros con agresor | 10:54 UTC 29/08 | **desconocido** |
| `operar.py` | robot direccional en papel, 200k USD | 10:32 UTC 29/08 | **desconocido** |

Los archivos deberían estar en `/home/trading/basis/` si el disco sobrevivió.

---

## 1. Qué es el proyecto

Sistema de captura de datos de Binance (BTCUSDT, spot y futuros) corriendo en una
VM de Google Cloud en Tokio. Colector propio en Python con latencia interna de
**0.9 ms de mediana** — el objetivo de 5 ms está cumplido desde hace días.

El operador decidió el 29/08 que el destino es **OPERAR** (no vender datos ni
vender el sistema). Todo lo de trading parte de ahí.

---

## 2. Lo que se decidió con números, y no hay que volver a probar

### El scalping de segundos está MUERTO por aritmética

Movimiento medio del precio contra el peaje de operar direccional en futuros
(0.05 % × 2 = 10 pb ida y vuelta):

| horizonte | movimiento medio | peaje |
|---|---|---|
| 60 s | 1.26 pb | 10 pb |
| 5 min | 4.32 pb | 10 pb |
| 15 min | 8.84 pb | 10 pb |
| ~20 min | ~10 pb | frontera |
| ~1 h | ~18 pb | ✅ hay margen |

**Por debajo de ~20 minutos de posición, el coste supera al movimiento disponible.**
Da igual la señal, la velocidad o el hardware. No volver a intentarlo.

### El basis spot-futuros está MUERTO

Separación típica 4 pb; coste de las 4 patas 30 pb. Simulación en vivo con 200k USD:
**−3.020 USD en 1.3 minutos**, cada operación perdía exactamente las comisiones.

### Las señales de flujo de órdenes son REALES pero NO PAGAN

Validadas entre días distintos (entrenar 25-26/08, verificar 27/08):

| señal | r entrena | r verifica | predice | peaje |
|---|---|---|---|---|
| `delta_btc` (agresores) | +0.087 | +0.108 | 0.69 pb | 10 pb |
| `obi_1` (desequilibrio 1 nivel) | +0.079 | +0.089 | 0.52 pb | 10 pb |
| `obi_5` | +0.077 | +0.085 | 0.51 pb | 10 pb |

Sobreviven 48 h de separación. **Predicen medio punto básico.** A 5-15 min todo
cambia de signo: ruido. Solo servirían con comisiones < 1 pb (market maker institucional).

### Lo ÚNICO que sale positivo: el carry de funding

Posición neutral (long spot + short perpetuo). No predice nada; cobra el funding
cada 8 h (00:00, 08:00, 16:00 UTC). Datos reales de 166 días, 500 cobros:

```
funding medio:       +0.27 pb por cobro  →  +2.96 % anual
sobre 200k USD:      +16.22 USD/día
coste abrir+cerrar:  600 USD  →  37 días hasta empatar
cobros negativos:    26 % (130 de 500)
```

El 29/08 el funding estaba en **+1.000 pb, el techo del rango histórico** → se
abrió posición en papel a las 08:26 UTC. A ese ritmo, el 1 % (2.000 USD) tarda
**~44 días**. Si vuelve a la mediana (+0.33), ~130 días.

**Riesgo principal:** el corto puede liquidarse aunque tengas el spot. Son cuentas
separadas; el bitcoin al contado NO evita la liquidación del futuro.

---

## 3. Posiciones abiertas EN PAPEL (ninguna con dinero real)

Todas en `/home/trading/basis/`, estado en `*_estado.json`. Sin claves de API en
ningún momento: **nunca se envió una orden real.**

| archivo | posición | abierta | notas |
|---|---|---|---|
| `carry_estado.json` | long 2.5786 BTC spot @77.561 + short @77.526 | 08:26 UTC 29/08 | neutral, cobra funding |
| `direccional_estado.json` | SHORT 2.5788 BTC @77.554 | 08:30 UTC 29/08 | 3 señales votaron SHORT unánime |
| `operar_diario.jsonl` | robot: abrió SHORT @77.512 a las 08:32 | — | esperanza escrita: −9 pb/op |

Comandos para ver cada una (en la VM): `python3 carry.py`, `python3 direccional.py`,
`tail operar.log`.

---

## 4. Lo que hay guardado

### Datos históricos (VM, parquet)

**95 millones de filas, 14 capturas, 3 días (25, 26, 27 de agosto), ~10 horas
reales.** La mayor: 27/08 14:56→19:52, 4.93 h, 49 M filas. Esquema completo:
libro nivel a nivel (`L2_PARTIAL_LEVEL`, 40 niveles), operaciones con agresor
(`AGG_TRADE`, `buyer_is_maker`), timestamps en ns.

**Cuatro capturas son la MISMA copiada** (27/08 20:30-21:00, 2.977.909 filas):
`gate4_mejoras`, `forceorder`, `markprice`, `auditparquet`. Deduplicar siempre.

Series extraídas a 1 Hz en `/home/trading/basis/series/*.csv`.

### Herramientas (VM, `/home/trading/basis/`)

| archivo | qué hace |
|---|---|
| `registrar_libro.py` | graba 100 niveles spot+fut, gzip, ~7.8 MB/día |
| `registrar_trades.py` | operaciones con agresor, sin huecos (`fromId`) |
| `extraer.py` | parquet crudo → series 1 Hz con obi, micro, spread, delta |
| `analizar.py` | validación de señales ENTRE DÍAS distintos |
| `explorar.py` | idem partiendo un día por la mitad (más débil) |
| `probar_hipotesis.py` | H1 muro, H2 delta, H3 POC con control de azar |
| `simular_libro.py` | camina el libro, comisiones, control de sanidad |
| `simulador_vivo.py` | papel en vivo con latencia real |
| `funding.py` | análisis del carry con 166 días reales |
| `carry.py` | abre/vigila la posición neutral en papel |
| `direccional.py` | abre/vigila una posición direccional en papel |
| `operar.py` | robot automático en papel |
| `perfil.py` | volume profile, footprint, POC, DOM |
| `profundidad.py` | cuántos niveles hacen falta para un tamaño |
| `medir_latencia.py` | latencia real p50/p95 a Binance |
| `arrancar.sh` | lanza el grabador con fichero PID (evita el bug de pgrep) |

**Todas: solo lectura, sin claves, sin órdenes.**

### GitHub

Repo `edgardtume-a11y/claude`, rama `claude/remote-connection-nztu9t`. Push
**restablecido** el 29/08 tras rehabilitar el repo. Último commit: `e656b7f`.

Documentos clave: `historial/SESION_28_29_AGO_2026.md` (narrativa completa),
`memoria/*.md` (hallazgos de latencia), `operaciones/TUTORIAL_CONECTAR_GITHUB_A_CLAUDE.md`.

Repo espejo `trading-cyber/jean-trading` existe pero **no es alcanzable desde
sesiones que arrancaron con el repo de Edgard** (rechazo cross-owner). Para usarlo
hay que abrir sesión nueva con él como origen.

---

## 5. Latencias medidas (no estimadas)

| desde | spot | futuros |
|---|---|---|
| VM Tokio | 19.2 ms | 14.3 ms |
| PC Perú | ~470 ms | ~490 ms |

Humano en Perú (red + render + reacción + clic + red): 1.5–2 s. Máquina en
Tokio: ~25 ms. **60-80× más rápido.** La RTX 3050 no influye. Y la velocidad no
crea ventaja, solo la conserva: se perdieron 3.020 USD simulados yendo 70× más
rápido que un humano.

Límites de Binance: futuros 300 órdenes/10 s, spot 100/10 s → **10/s** manda.

---

## 6. Investigación de latencia (cerrada en lo esencial)

- Objetivo de 5 ms cumplido: `book_pipeline_total` p50 0.900 ms, p95 3.156 ms.
- PackageKit identificado como causa de atascos periódicos (p ≈ 2.4×10⁻¹⁰), enmascarado.
- **Asociación del 99 %** entre publicación de métricas y excedencias >20 ms:
  sólida (66/66 y 19/19 a ±250 ms de un snapshot). **Sin mecanismo**: se propusieron
  cuatro y cayeron los cuatro, el último al descubrir que el banco corría con
  `thread_switch_s=0.005` frente al 0.001 de producción.
- Evento de 584 ms: población aparte, sin explicación. Solo `gc_count[0]=59` lo separa.
- Gate 5 s vs 30 s: la prueba que lo cerraría, **pendiente de autorización del operador**.

Canal IA-IA en `/home/trading/dialogo_ia/`, turnos hasta `037-claude.md`.
ChatGPT debe el 038.

---

## 7. Pendientes

**Del operador:**
1. Encender la VM y verificar qué sobrevivió.
2. Claves de API del testnet en `/home/trading/.binance_testnet.env` (sigue con
   `PEGA_AQUI`). Solo permiso de futuros, sin retiros. **Nunca en el chat.**
3. Verificador ciego — pendiente por decisión explícita.
4. `unmask` de `apt-news`, `esm-cache`, `packagekit`.
5. IAM del agente Ops (falla >2 días con `IAM_PERMISSION_DENIED`).
6. Gate 5 s vs 30 s.

**Técnicos:**
- Observador V17 en el PC: reinicio de entrenamiento invirtió el dataset
  (TERMINADA pasó de 35 a 5 ejemplos; LIBRE a 0). **30 TERMINADA y 4 LIBRE
  recuperables en la papelera** y respaldo en
  `respaldo_reinicio_entrenamiento_20260829_003746/`.
- Calibrar el filtro del muro (disparaba 99.6 %, luego 0 %). Necesita horas de datos.
- H2 y H3 (delta, POC) pendientes de alinear relojes libro/operaciones.
- Probar horizontes de 30-60 min: faltaban datos.

---

## 8. Reglas del proyecto (no negociables)

- **Secretos jamás en GitHub/Notion/chats.** Claves en fichero con `chmod 600`.
- **Producción automática, purga de CSV y Cloud Storage: PROHIBIDOS sin orden expresa.**
- **Ningún lanzamiento de captura/gate sin orden del operador.**
- Ninguna IA autoriza a otra; ninguna ejecuta las propuestas de otra sobre la máquina.
- Nunca escribir en `puente_github/ordenes/` ni en `jean-flow-exec/io/jobs/pending/` — ejecutan.
- Nunca `kill -9` a los grabadores: `SIGTERM` para que cierren el gzip bien.
- Desarrollar y hacer push solo a `claude/remote-connection-nztu9t`.

---

## 9. Accesos

**Remote Desktop Commander** (shell y archivos, sin vista de pantalla):
- `jean-flow-02-tokyo` — VM, id `2985827f-…` — **OFFLINE**
- `AS40569324` — PC Windows, id `e70a7e16-…` — online
- Dos registros duplicados de `jean-flow-01` (Singapur, apagada) — conviene borrarlos.

**GitHub:** autenticado como `trading-cyber`. Escritura en `edgardtume-a11y/claude` OK.

**Vertex AI:** cortado el 28/08. `jean-flow-gemini` y `jean-flow-router` deshabilitados.
El guardián no lo necesita.

---

## 10. Cómo retomar

```bash
# 1. Comprobar que la VM responde y qué sobrevivió
ls -la /home/trading/basis/
tail -20 /home/trading/basis/operar.log
cat /home/trading/basis/operar_diario.jsonl

# 2. Ver las posiciones en papel
cd /home/trading/basis && python3 carry.py && python3 direccional.py

# 3. Si hay datos nuevos, extraer y validar entre días
PY=/home/trading/jean-flow-v2.4.1/555/binance_phase1_collector/.venv/bin/python
$PY extraer.py && $PY analizar.py

# 4. Ver el funding ahora
python3 funding.py
```

---

## 11. Lo que enseñó todo esto

Doce afirmaciones retiradas en dos días, seis las encontró ChatGPT, dos el operador.
El patrón común: **concluir desde una medición que no medía lo que decía medir.**
Un banco sin control positivo, un filtro que seleccionaba el 99.6 %, una búsqueda
con `-maxdepth` corto, un runtime distinto al de producción, buscar `*.csv` y no
ver 95 millones de filas en parquet.

Y sobre trading: **primero la ventaja, después la velocidad, la ejecución y las
claves.** Al revés es lo que se probó que pierde dinero. Lo único que dio positivo
fue lo que no requiere predecir nada.
