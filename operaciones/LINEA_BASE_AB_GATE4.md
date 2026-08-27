# Línea base del A/B: contra qué se mide uvloop

**Fecha:** 27/08/2026, ~20:35 UTC (15:35 Perú)
**Origen:** gate 3, máquina n2-standard-8 de Tokio, 4 h 45 min, sin uvloop.
**Uso:** es el "antes" contra el que se juzga el gate 4 (con uvloop + `gc.freeze`).

---

## 1. Por qué no vale comparar un número contra otro

El gate 3 corrió **4 h 45**. El gate 4 corre **30 min**. La métrica que falla es
un **peor p99**, es decir un máximo. Y un máximo depende de cuánto tiempo mires:
media hora tiene menos oportunidades de tropezar con el pico raro que casi cinco
horas. Comparar "el peor de 4h45" contra "el peor de 30 min" le regala la
victoria al corto **antes de ejecutar nada**.

Por eso el gate 3 se partió en **diez tramos de 30 minutos** y se calculó el peor
p99 de cada tramo. Así el gate 4 no se compara contra un número: se compara
contra una **distribución de diez mediciones equivalentes**.

## 2. La línea base, tramo a tramo

Peor p99 de cada ventana de 30 min. Límite de certificación: **5.0 ms**.

| Métrica | mejor | mediana | peor | tramos que superan 5.0 |
|---|---|---|---|---|
| spot · `book_apply` | 1.400 | 2.768 | 3.561 | **0 / 10** |
| spot · `book_pipeline_total` | 1.804 | 3.200 | 4.226 | **0 / 10** |
| usdm · `book_apply` | 3.185 | 4.642 | 6.282 | **3 / 10** |
| usdm · `book_pipeline_total` | 3.602 | 5.192 | 7.399 | **7 / 10** |

Serie completa de `usdm.book_pipeline_total`, en orden cronológico:

```
7.13  7.40  5.48  4.66  6.26  5.03  5.19  5.15  3.75  3.60
14:56 ───────────────────────────────────────────────► 19:41 UTC
```

**Spot nunca falla. El problema es entero de futuros (usdm).**

## 3. El confusor que hay que declarar

Mírese la serie otra vez: **empieza en 7.13 y termina en 3.60**. No mejora por
arte de magia — **baja la actividad del mercado**. Las primeras ventanas caen en
el solape Asia–Europa; las últimas, en una franja tranquila.

Esto tiene una consecuencia incómoda y hay que decirla:

> El gate 4 corre de ~20:30 a ~21:00 UTC. En el gate 3, la franja horaria más
> parecida son justo **las dos últimas ventanas: las más tranquilas de todas**
> (3.19 y 3.21 en `book_apply`; 3.75 y 3.60 en `pipeline`).
>
> **Si el gate 4 devuelve ~3.2 ms, eso no prueba nada.** Es exactamente lo que
> ya daba la máquina *sin* uvloop a esa misma hora.

## 4. El listón, entonces

No es el límite de 5.0 ms, que a esta hora se pasa sin ayuda. Es el **mejor
tramo de la línea base**:

| Métrica | uvloop tiene que bajar de |
|---|---|
| usdm · `book_apply` | **3.185 ms** |
| usdm · `book_pipeline_total` | **3.602 ms** |
| spot · `book_apply` | 1.400 ms |
| spot · `book_pipeline_total` | 1.804 ms |

Y aun así, un solo tramo por debajo es **indicio, no prueba**.

## 5. Lo que este A/B puede y no puede decidir

**Puede** descartar: si uvloop empeorase los números o rompiese la
certificación de identidad, se ve en 30 minutos y se revierte sin discusión.

**No puede** confirmar: con una sola ventana de 30 min, contra una línea base
tomada a otras horas, no se puede afirmar que uvloop mejore la latencia. La
variable dominante en estas métricas no es el bucle de eventos: **es cuánto
mercado hay**.

### La prueba que sí decidiría

La que propuso Gemini en la auditoría cruzada: **dos procesos en paralelo, sobre
el mismo flujo de Binance, a la misma hora** — uno con uvloop y otro sin él,
comparados durante 48 h. Misma hora y mismo mercado para los dos: el confusor
desaparece por construcción, en vez de por argumento.

Coste: dos capturas simultáneas durante dos días. **Requiere orden del operador**
y resolver antes el bloqueador de disco (`planes/BLOQUEADOR_DISCO_7DIAS.md`):
dos capturas de 48 h en CSV son ~360 GiB y solo hay 120 GiB libres.
