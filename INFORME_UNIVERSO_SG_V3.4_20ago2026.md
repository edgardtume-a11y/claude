# INFORME — UNIVERSO SEBAS GRANDA V3.4 (TRUE EARTH + CINEMATIC LAUNCH)
**Fecha:** 2026-08-20 · **Branch:** `claude/universo-earth-visibility-2b7gyn` · **Build:** `20260820-V34-01`

## Qué se entregó

Sobre el ZIP `universo-sebas-granda-V3.3-production.zip` (importado intacto como
baseline en `universo-sebas-granda/`), se produjo la **V3.4** con la prioridad
absoluta del brief: *NO MÁS ESPACIO VACÍO — que se vea la Tierra*.

Entregables en `entregables/`:
- `universo-sebas-granda-V3.4-production.zip` (proyecto completo + auditoría +
  15 capturas QA + assets source)
- `universo-sebas-granda-V3.4-HOSTING.zip` (lo que se sube al servidor, con
  las texturas NASA físicamente dentro)

Documentos clave dentro del proyecto:
- `AUDIT-V34.md` — auditoría completa de V3.3 ANTES de tocar código
- `ENTREGA-V3.4.txt` — informe final obligatorio (los 20 puntos del brief §49)
- `ASSET-CREDITS.md §6` / `THIRD-PARTY.md` — fuentes NASA, SHA-256, licencias
- `qa-captures-v34/` — las 15 capturas obligatorias (Chromium+SwiftShader real)

## La causa raíz que nadie había visto

`_yawPitchGoal()` recibía como `pos` el mismo vector temporal que luego
sobrescribía como target del lookAt → `lookAt(eye === target)` degenerado →
**pitch y yaw siempre 0**. Todas las cámaras "Earth-aware" de V3.3 calculaban
su pitch hacia la Tierra… y lo ignoraban. Con el fix, el hero orbital pasó de
13 % a **55 % de cobertura de Tierra** medida en vivo.

## Resto de causas y fixes principales

1. **Texturas NASA reales** (Blue Marble 4096², Black Marble 4096², nubes con
   alfa real, máscara oceánica) físicamente en el ZIP, por tier
   (4096/2048/1024). Hosts NASA bloqueados por egress (403 documentado) →
   obtenidas del mirror MIT npm `three-globe@2.45.2`; QA verifica
   `DAY/NIGHT/CLOUDS/SPEC = FILE`.
2. **Mach 1 doblaba el cohete**: heat haze huérfano congelado al pasar a
   espacio + máscara isotrópica. Apagado/decay global + máscara solo bajo la
   tobera. Nuevo evento Mach 1 (cono de condensación, shock collar, stress) y
   Max-Q diferenciado (throttle bucket, vibración grave).
3. **Countdown con voz**: 5-4-3-2-1 gigante + `SpeechSynthesis`
   (es-CO→…→es-ES / en-US), "IGNICIÓN"/"DESPEGUE", clips locales opcionales,
   fallback beep+texto. Cero TTS externo.
4. **Free camera orbital**: límites por `earthR` (R+70…3.4R), nace mirando la
   Tierra, F = FOCUS EARTH, R = RESET, velocidad por altitud. Photo mode
   orbital con target Tierra/nave, LOCATE HOME, satélites, reset.
5. **Departure real**: `frameSphereDistance()` — 55→45→32 % hasta disco
   completo (52 %) con América reconocible; cámara en radial+swing, cero scale.
6. **Bugs V3.3 latentes**: vendor three.module.js jamás se importaba (URL
   relativa al módulo), `audio.uiSelect` inexistente reventaba el fairing sep,
   la Tierra brillante fotobombardeaba el warp (gSpace ahora se oculta).
7. **QA `?qa=v34`**: saltos por el código real con pin de reloj determinista,
   cobertura en vivo, toggles de capas, verificación FILE/PROCEDURAL.

## Verificación

- 15/15 capturas con Playwright + Chromium/SwiftShader (WebGL real), todas con
  `JS ERRORS: 0`; el overlay QA de cada una muestra cobertura y origen de
  texturas.
- Regresión `?autotest=1` (misión completa + UX de galaxias del hub): ver
  resultado al final de la sesión.
- Cobertura medida: HERO 55 % · Mach1 18 % · Max-Q 24 % · Strato 34 % ·
  Departure final 52 % disco completo — todo dentro de los rangos del brief §8.
