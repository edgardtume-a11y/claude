# SG FUTURE FLIGHT MODE — diseño interno (NO implementado)
Estado: DOCUMENTADO ÚNICAMENTE (addendum §47/§48). Esta versión prioriza
runtime estable > navegación > performance > pase visual > narrativa (§64);
la mecánica descrita aquí queda preparada a nivel de arquitectura y NO forma
parte del build 20260820-V3-01.

## Objetivo
Una única mecánica espectacular (§47): control temporal de un vehículo SG
durante 15–25 s, sin convertir la experiencia en videojuego.

## Momento propuesto
Tras `ORBIT ACHIEVED` y antes de armar el warp: SG-01 ofrece
`SG FLIGHT INTERACTION — OPTIONAL`. Rechazable; el golden path no cambia.

## Vehículo
El dron SG-01 (ya existe como personaje con estados GUIDE/SCAN/IDLE/MISSION)
o la nave SG en un pasillo orbital corto.

## Controles
Ratón/touch: puntero = rumbo suavizado (damp, como la cámara actual).
Gamepad: stick izq. rumbo, RT impulso.
Sin físicas nuevas complejas: reutilizar el integrador de partículas
(pos += vel·dt, drag) ya presente en `experience.js`.

## Bucle (15–25 s)
1. Fade de HUD a versión mínima (sistema `cinema` existente).
2. 3–5 anillos/balizas SG generados sobre la órbita actual (reutilizar
   geometría de `evRing` y colliders esféricos del hub).
3. Cruzar balizas emite el `discoveryChime` + partículas `pBurst` existentes.
4. Timeout o última baliza → devolución de cámara con el mismo damp,
   `MISSION LOG` registra `flight-interaction` vía `SAVE.completeMission`.

## Contratos que DEBE respetar (por eso aún no se activa)
- Nunca bloquear Launch/Orbit/Warp/Hub (§49) ni añadir estados al chapter
  chain del autotest.
- Presupuesto: 0 texturas nuevas, 0 shaders nuevos, ≤ 1 draw call extra.
- SAFE/PERF: desactivado por defecto; LITE: inexistente.
- Watchdog: la interacción vive DENTRO del capítulo `orbit` (sin nuevo
  capítulo), con salida garantizada por timeout.

## Punto de enganche previsto
`experience.js` → `_enterOrbit()` events, entre `at: 2.2` (ship reveal) y
`_beginCharge()`; gate por `settings.flightMode === true` (ajuste futuro).
