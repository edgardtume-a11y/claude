/* ============================================================================
   UNIVERSO SEBAS GRANDA — qa34.js (V3.4)
   Modo QA `?qa=v34` (brief §38–§40): saltos DIRECTOS a cada beat de la misión
   recorriendo SIEMPRE el código real (skipIntro → CTA → reloj de capítulo),
   nunca estados falsos; botones de aislamiento de capas; y el criterio de
   aceptación en vivo: EARTH SCREEN COVERAGE + origen real de cada textura
   (FILE vs PROCEDURAL — un HIGH/ULTRA sin archivo real se marca ERROR).
   `?qa=v34&jump=<key>` arranca el salto automáticamente (Playwright QA).
   ============================================================================ */

import { getLanguage } from './i18n.js';

const JUMPS = {
  countdown5:   { phase: 'countdown',   at: 1.2,   pin: 1.85 },
  countdown1:   { phase: 'countdown',   at: 5.05,  pin: 5.9 },
  ignition:     { phase: 'countdown',   at: 6.05,  pin: 6.7 },
  liftoff:      { phase: 'ascent',      at: 2.2,   pin: 2.6 },
  cloudbreak:   { phase: 'ascentSpace', at: 6.9,   pin: 7.35 },
  mach1:        { phase: 'ascentSpace', at: 8.15,  pin: 8.7 },
  maxq:         { phase: 'ascentSpace', at: 10.35, pin: 11.1 },
  stagesep:     { phase: 'ascentSpace', at: 15.75, pin: 16.6, capSep: 0.85, rig: 'STRATO', frac: 0.12 },
  stage2:       { phase: 'ascentSpace', at: 16.55, pin: 17.15, rig: 'STRATO', frac: 0.12 },
  fairing:      { phase: 'ascentSpace', at: 17.35, pin: 18.1, capFair: 0.75, rig: 'STRATO', frac: 0.12 },
  stratosphere: { phase: 'ascentSpace', at: 13.3,  pin: 14.4 },
  earthhero:    { phase: 'orbit',       at: 1.2,   pin: 2.2 },
  freecam:      { phase: 'orbit',       free: true },
  dep25:        { phase: 'orbit',       dep: 0.25 },
  dep50:        { phase: 'orbit',       dep: 0.5 },
  dep100:       { phase: 'orbit',       dep: 1 },
  warp:         { phase: 'warp',        at: 1.4,   pin: 2.0 },
  hub:          { phase: 'hub' },
};

const BTNS = [
  ['COUNTDOWN 5', 'countdown5'], ['COUNTDOWN 1', 'countdown1'],
  ['IGNITION', 'ignition'], ['LIFTOFF', 'liftoff'],
  ['MACH 1', 'mach1'], ['MAX-Q', 'maxq'],
  ['STAGE SEP', 'stagesep'], ['STAGE 2', 'stage2'], ['FAIRING SEP', 'fairing'],
  ['CLOUD BREAK', 'cloudbreak'], ['STRATOSPHERE', 'stratosphere'],
  ['EARTH HERO', 'earthhero'], ['ORBIT FREE CAMERA', 'freecam'],
  ['EARTH DEPARTURE 25', 'dep25'], ['EARTH DEPARTURE 50', 'dep50'],
  ['EARTH DEPARTURE 100', 'dep100'],
  ['WARP', 'warp'], ['GALAXY HUB', 'hub'],
];

const ORDER = ['countdown', 'ascent', 'ascentSpace', 'orbit', 'charge', 'warp', 'hub'];
/* fin natural de cada capítulo automático — para avanzar rápido HASTA la fase
   objetivo sin saltarse ningún trozo de código de producción */
const CH_END = { countdown: 6.9, ascent: 6.3, ascentSpace: 18.7, warp: 3.3 };

export function initQA34(exp, ui, opts) {
  let target = null;
  let readT = 0;
  let holding = false;
  let lastKey = null;
  try { window.__SG_EXP = exp; } catch (e) {}   /* inspección QA/Playwright */
  /* estado legible desde Playwright: window.__QA34 = {key, holding} */
  const setState = () => {
    try { window.__QA34 = { key: target ? target.key : lastKey, holding }; } catch (e) {}
  };

  /* ---------- readout: criterio de aceptación en vivo ---------- */
  const read = document.createElement('div');
  read.id = 'qa34-readout';
  document.body.appendChild(read);

  /* ---------- panel ---------- */
  const panel = document.createElement('div');
  panel.id = 'qa34-panel';
  const head = document.createElement('div');
  head.className = 'qa34-head';
  head.textContent = 'QA V3.4';
  panel.appendChild(head);
  const addBtn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'qa-btn hit';
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    panel.appendChild(b);
    return b;
  };
  for (const [label, key] of BTNS) addBtn(label, () => startJump(key));
  const sep = document.createElement('div');
  sep.className = 'qa34-head';
  sep.textContent = '— TOOLS —';
  panel.appendChild(sep);
  addBtn('VOICE 5-4-3-2-1', () => exp.voice.sayCountdown(getLanguage()));
  addBtn('FOCUS EARTH', () => exp.focusEarth());
  addBtn('FREE EARTH CAM', () => startJump('freecam'));
  addBtn('TOGGLE DAY MAP', () => exp.toggleEarthLayer('day'));
  addBtn('TOGGLE NIGHT MAP', () => exp.toggleEarthLayer('night'));
  addBtn('TOGGLE CLOUDS', () => exp.toggleEarthLayer('clouds'));
  addBtn('TOGGLE ATMOSPHERE', () => exp.toggleEarthLayer('atmo'));
  addBtn('TOGGLE HOME MARKER', () => exp.toggleHomeMarker());
  addBtn('SHOW EARTH COVERAGE', () => { read.style.display = read.style.display === 'none' ? '' : 'none'; });
  addBtn('RELEASE HOLD', () => { target = null; exp._holdCharge = false; exp._qaPin = null; exp._qaPinCh = null; exp._qaFrac = null; });
  document.body.appendChild(panel);

  function startJump(key) {
    const def = JUMPS[key];
    if (!def) return;
    target = { key, def, jumped: false };
    holding = false;
    lastKey = key;
    exp._holdCharge = false;
    /* el pin queda armado desde YA, anclado al capítulo destino: ni un frame
       gigante puede disparar eventos posteriores al beat congelado */
    exp._qaPin = def.pin != null ? def.pin : null;
    exp._qaPinCh = def.pin != null ? def.phase : null;
    exp._qaFrac = def.frac != null ? def.frac : null;
    setState();
    try { console.log('[QA34] JUMP →', key); } catch (e) {}
  }

  const setClock = (t) => { exp._chStart = performance.now() - (t - exp._chBase) * 1000; };

  function drive(dt) {
    if (!target) return;
    const d = target.def;
    const ch = exp.chapter;
    if (ch === 'intro' || ch === 'approach') { exp.skipIntro(); return; }
    if (d.phase === 'hub') {
      if (ch === 'facility') exp.skipFlight();
      if (ch === 'hub' && exp.builtHub) { holding = true; target = null; }
      return;
    }
    if (ch === 'facility') {
      if (exp.ctaMode === 'launch') exp.handleCTA();
      return;
    }
    if (ch === 'charge') {
      if (d.phase === 'warp') { if (exp.ctaMode === 'warp') exp.handleCTA(); }
      else if (ORDER.indexOf(d.phase) <= ORDER.indexOf('charge')) target = null;
      return;
    }
    if (ch === d.phase) {
      if (d.dep != null) {
        if (!exp._depT && exp.mt > 1.0) exp._beginDeparture();
        if (exp._depT) {
          if (d.dep < 1) {
            exp._depT = Math.min(Math.max(exp._depT, d.dep * 0.999), d.dep);
            exp._depDone = false;
          } else {
            exp._depT = 1;
            exp._holdCharge = true;
          }
          holding = true;
        }
        return;                                   /* hold del frame pedido */
      }
      if (d.free) {
        if (exp.mt > 1.2) {
          exp._setCamMode('free', true);
          exp._aimFreeAtEarth();
          holding = true;
          target = null;
        }
        return;
      }
      if (d.rig && exp.camRig !== d.rig) { exp.camRig = d.rig; exp.userCamLock = true; }
      if (!target.jumped && d.at != null && exp.mt < d.at) {
        setClock(d.at);
        target.jumped = true;
        return;
      }
      target.jumped = true;
      if (d.pin != null) {
        if (d.capSep != null && exp._sepT > d.capSep) exp._sepT = d.capSep;
        if (d.capFair != null && exp._fairT > d.capFair) exp._fairT = d.capFair;
        holding = exp.mt >= d.pin - 0.45;
        return;                                   /* hold hasta otro salto */
      }
      holding = true;
      target = null;
      return;
    }
    /* fase anterior a la objetivo: acelerar el reloj real hasta su final
       (el pin no interfiere: está anclado al capítulo destino) */
    if (ORDER.indexOf(ch) >= 0 && ORDER.indexOf(d.phase) > ORDER.indexOf(ch)) {
      const e = CH_END[ch];
      if (e && exp.mt < e) setClock(e);
      if (ch === 'orbit') {
        if (!exp._depT && exp.mt > 1.0) exp._beginDeparture();
        if (exp._depT && !exp._depDone) exp._depT = Math.min(1, exp._depT + dt * 2.2);
      }
    }
  }

  function readout(dt) {
    readT -= dt;
    if (readT > 0) return;
    readT = 0.25;
    const cov = exp.earthScreenCoverage();
    const src = exp._earthTexSrc || {};
    const tier = exp._tier();
    const isHi = tier === 'high' || tier === 'ultra';
    const bad = isHi && ['day', 'night', 'clouds'].some((k) => src[k] !== 'file');
    const pct = Math.round(cov.frac * 100);
    read.classList.toggle('err', bad);
    read.textContent =
      'EARTH SCREEN COVERAGE: ' + pct + '% (' + cov.mode.toUpperCase() + ')' +
      '\nDAY=' + String(src.day || '—').toUpperCase() +
      ' · NIGHT=' + String(src.night || '—').toUpperCase() +
      ' · CLOUDS=' + String(src.clouds || '—').toUpperCase() +
      ' · SPEC=' + String(src.spec || '—').toUpperCase() +
      (bad ? '\n✗ ERROR: HIGH/ULTRA SIN ARCHIVO REAL (brief §36)' : '') +
      '\nCH ' + exp.chapter + ' · MT ' + exp.mt.toFixed(1) + ' · CAM ' + exp.camMode + ' · TIER ' + tier +
      (target ? ' · JUMP ' + target.key : '');
  }

  if (opts && opts.jump && JUMPS[opts.jump]) {
    setTimeout(() => startJump(opts.jump), 600);
  }

  return {
    tick(dt) {
      try { drive(dt); readout(dt); setState(); } catch (e) { /* QA jamás rompe la misión */ }
    },
    jump: startJump,
  };
}
