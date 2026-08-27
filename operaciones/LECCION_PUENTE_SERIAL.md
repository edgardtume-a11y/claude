# El puente procesa las órdenes en fila: no le des trabajos largos

**Detectado:** 27/08/2026, ~21:35 UTC, en carne propia.
**Coste:** la cola del puente parada varios minutos con cuatro órdenes esperando.

---

## Qué pasó

El guardián (`puente_github/watcher.py`) procesa las órdenes así:

```python
for name in sorted(os.listdir(ORDERS_DIR)):
    ...
    result = process(order)      # <-- bloqueante
    push_result(order_id, out)
```

**Una detrás de otra, en el mismo hilo.** Hasta que una orden no termina, la
siguiente ni se mira.

Yo mismo mandé un `esperar_gemini.py` que sondea al router **hasta 540 segundos**
esperando a que Gemini termine. Mientras ese script giraba, el guardián estaba
dentro de `process()` y no podía atender nada más. Se acumularon detrás:

- el chequeo periódico de la máquina (`monitor-2130`)
- la comprobación de si el auditor lee Parquet (`lee-parquet-001`)
- la tarea de diagnóstico del GIL (`diagnostico-gil-001`)

Nueve minutos de cola por una espera que no hacía trabajo útil.

## La ironía

Justo hoy el operador trajo un documento sobre paralelizar agentes, y yo
respondí que nuestro cuello de botella no era la serialización sino el tiempo de
pared de las mediciones físicas.

Eso sigue siendo cierto para las capturas y las auditorías. Pero **aquí sí había
un cuello de botella de serialización**, y era mío: una orden que no calcula
nada, solo espera, ocupando el único carril que tiene el puente.

## La regla que sale de esto

> **Ninguna orden del puente debe bloquear esperando algo externo.**
> Esperar es trabajo del revisor desde su lado, con órdenes cortas y repetidas,
> no del guardián desde el suyo.

En concreto:

| En vez de | Hacer |
|---|---|
| una orden que sondea 540 s hasta que Gemini termine | varias órdenes `gemini_result`, cortas, separadas en el tiempo |
| una orden que espera a que acabe una captura de 30 min | una orden que consulta el estado y vuelve enseguida |
| una orden que convierte 18 GB de golpe | lanzar en segundo plano con `nohup` y consultar el registro |

El patrón correcto ya está en la acción `auditar_staging`: lanza con
`subprocess.Popen(..., start_new_session=True)` y **devuelve al instante**. El
trabajo sigue corriendo; el puente queda libre.

## Mejora pendiente del guardián

Dos opciones, por orden de sencillez:

1. **Tope de tiempo por orden más corto.** Hoy `ejecutar_script_repo` permite
   600 s. Bajarlo a ~120 s obligaría a que todo lo largo se lance en segundo
   plano, que es como debe ser.
2. **Atender varias órdenes a la vez.** Un hilo por orden, con un límite (3 o 4).
   Más potente, pero hay que pensar los choques: dos órdenes escribiendo el
   manifiesto o el mismo fichero a la vez.

La 1 es una línea de código y elimina la causa. La 2 es la solución de verdad
pero necesita cuidado. **Empezar por la 1.**
