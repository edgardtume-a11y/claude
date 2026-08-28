# La captura fantasma: un identificador que se repite cada 24 horas

**Fecha:** 28/08/2026, 15:35 UTC
**Gravedad:** alta — el fallo **no da error**, devuelve un dato viejo que
parece bueno.

---

## 1. Lo que vi

El chequeo de las 15:28 devolvió:

```
capturas_activas: 1        <- ninguna captura fue ordenada
disco: 58G usados, 135G libres   <- una hora antes eran 71G / 123G
```

Una captura corriendo que nadie lanzó, y un disco que había liberado 13 GB solo.

---

## 2. Lo que era

**No era un dato de hoy. Era el de ayer.**

El resultado traía:

```
"procesado_utc": "2026-08-27T15:29:09Z"    <- 27, no 28
```

y le faltaba el campo `estado` que llevan todos los resultados actuales.

La causa, en el historial de git:

```
08-27 15:28:51  puente: monitoreo horario 1528     <- la orden de AYER
08-27 15:29:09  puente: resultado monitor-1528     <- su resultado
08-28 15:29:19  chequeo 15:28                      <- MI orden de HOY, mismo id
```

La rutina de monitoreo nombra las órdenes `monitor-<HHMM>`. **Ese
identificador se repite cada 24 horas.** El guardián no reprocesa un id que ya
tiene resultado, así que hoy leí el fichero de ayer.

Y ayer a las 15:28 **sí había un gate corriendo** y el disco **sí estaba en
58G**. El dato era correcto — de ayer. Por eso resultaba creíble.

---

## 3. Por qué esto es peor que un error

Un error se ve. Esto no: devuelve un valor plausible.

Hoy me inventó una captura que no existía. Otro día puede hacer lo contrario:
decir *«0 capturas, disco bien»* mientras la máquina está llena o hay dos
capturas a la vez. **La alarma que no salta es peor que la falsa.**

Y me llevó a investigar durante quince minutos un segundo puente que no
existía.

---

## 4. Las dos correcciones

### El identificador lleva la fecha
```
monitor-<MMDD>-<HHMM>     →  monitor-0828-1540
```
No `<HHMM>` a secas. Cualquier orden repetible necesita un id que no colisione
con el de otro día.

### Comprobar la frescura antes de creerse nada
Todo resultado del puente trae `procesado_utc`. **Comparar con la hora actual
antes de usarlo.** Si tiene más de unos minutos, no es la respuesta a la
pregunta que acabo de hacer:

```python
edad = ahora - procesado_utc
"FRESCO" if edad < 300 else "***RANCIO, NO FIARSE***"
```

Aplicado al chequeo real de las 15:32: **edad 4 segundos**, y el dato de verdad
es `capturas_activas: 0`, `120G libres`, `load 0.13`. Nada corriendo.

---

## 5. La regla general

**Un resultado leído de un fichero no lleva escrito cuándo se escribió, salvo
que uno lo mire.** Un sistema que responde por ficheros compartidos siempre
puede darte el de la vez anterior. La defensa no es confiar en el sistema: es
que cada respuesta diga su edad y que el que lee la compruebe.

Es el mismo tipo de fallo que el `PYTHONPATH` del rotador y que el tercer
lector en `reconstruct.py`: **algo correcto en su sitio, usado en un contexto
donde ya no valía.**
