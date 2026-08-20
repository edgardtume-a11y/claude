/* ============================================================================
   UNIVERSO SEBAS GRANDA — main.js (boot orchestrator)
   Paints the shell instantly, then streams the heavy experience in.
   If WebGL/Three.js never arrives, LITE MODE keeps every destination reachable.
   ============================================================================ */

import { SG_VERSION, SG_BUILD_ID } from './config.js';
import { classifyError, makeErrorWindow, buildMatches, diagAsset, DIAG_ASSETS, FATAL } from './boot-diagnostics.js';
import { setLanguage, getLanguage, t } from './i18n.js';
import * as SAVE from './save.js';
import { SGAudio } from './audio.js';
import { UI } from './ui.js';

const qs = new URLSearchParams(window.location.search);
const DEBUG = qs.get('debug') === '1';
const FORCE_LITE = qs.get('lite') === '1';
const AUTOTEST_RAW = qs.get('autotest') || '';
const AUTOTEST = AUTOTEST_RAW === '1' || AUTOTEST_RAW === 'skip' || AUTOTEST_RAW === 'mismatch';
const AUTOTEST_SKIP = AUTOTEST_RAW === 'skip';
const AUTOTEST_MISMATCH = AUTOTEST_RAW === 'mismatch';
const SAFE = qs.get('safe') === '1';
const DIAG = qs.get('diag') === '1';
const FAIL_FLAGS = new Set((qs.get('fail') || '').split(',').map((x) => x.trim()).filter(Boolean));
const SHOT = ['intro', 'facility', 'ignition', 'ascent', 'maxq', 'stageSep', 'stage2', 'fairing', 'orbit', 'earthDeparture25', 'earthDeparture50', 'earthDeparture100', 'hub', 'galaxySelected'].indexOf(qs.get('shot') || '') >= 0 ? qs.get('shot') : null;

const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- save + settings ---------- */
const save = SAVE.registerVisit();
if (save.settings.language) setLanguage(save.settings.language);
else setLanguage((navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en');

let motionOK = save.settings.motion == null ? !prefersReduced : !!save.settings.motion;
document.body.classList.toggle('reduced-motion', !motionOK);

/* ---------- audio ---------- */
const audio = new SGAudio();
audio.setEnabled(save.settings.sound !== false);
const unlockOnce = () => { audio.unlock(); window.removeEventListener('pointerdown', unlockOnce); window.removeEventListener('keydown', unlockOnce); };
window.addEventListener('pointerdown', unlockOnce);
window.addEventListener('keydown', unlockOnce);

/* ---------- experience handle (filled later) ---------- */
let exp = null;
let liteShown = false;
let skyTimer = 0;

let bootPhase = 'boot';               /* 'boot' → 'running' once exp starts */
function enterLite(reason) {
  if (liteShown) return;
  liteShown = true;
  try { if (exp) cancelAnimationFrame(exp._raf); } catch (e) {}
  ui.loader(null);
  ui.showLite(true);
  console.error('[SG LITE]', reason);
  if (AUTOTEST) console.log('[SG TEST] LITE ' + (FAIL_FLAGS.has('webgl') ? 'PASS' : 'REACHED') + ' — ' + reason);
  if (DEBUG && reason) ui.debug('LITE: ' + reason);
}
/* full-screen recovery offer that comes BEFORE Lite (P0.1 §13/§24/§27) */
let overlayEl = null;
function bigOverlay(title, lines, buttons) {
  if (overlayEl) overlayEl.remove();
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(3,6,12,.94);color:#eaf4ff;font:13px/1.7 monospace;padding:20px;text-align:left';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:640px;border:1px solid rgba(53,214,255,.4);border-radius:10px;padding:22px;background:#070d18';
  const h = document.createElement('div');
  h.style.cssText = 'font-weight:700;letter-spacing:.12em;color:#35d6ff;margin-bottom:12px';
  h.textContent = title;
  box.appendChild(h);
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;margin:0 0 16px;max-height:46vh;overflow:auto';
  pre.textContent = lines.join('\n');
  box.appendChild(pre);
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin-right:10px;padding:10px 16px;font:600 12px monospace;letter-spacing:.1em;background:#0d2333;color:#9fe0ff;border:1px solid #35d6ff;border-radius:8px;cursor:pointer';
    b.onclick = fn;
    box.appendChild(b);
  }
  d.appendChild(box);
  document.body.appendChild(d);
  overlayEl = d;
  return d;
}
function closeOverlay() { if (overlayEl) { overlayEl.remove(); overlayEl = null; } }

/* ---------- UI + callbacks ---------- */
const ui = new UI({
  onLangToggle() {
    const next = getLanguage() === 'es' ? 'en' : 'es';
    setLanguage(next);
    SAVE.setSetting('language', next);
    ui.applyLanguage();
    ui.setSeg('seg-lang', next);
    if (exp) exp.refreshLang();
    audio.uiBeep();
  },
  onLangSet(v) {
    setLanguage(v);
    SAVE.setSetting('language', v);
    ui.applyLanguage();
    if (exp) exp.refreshLang();
  },
  onSoundToggle() {
    const on = !(SAVE.loadSave().settings.sound !== false);
    SAVE.setSetting('sound', on);
    audio.setEnabled(on);
    ui.soundPressed(on);
    ui.setSeg('seg-sound', on ? 'on' : 'off');
    if (on) audio.uiBeep();
  },
  onSoundSet(v) {
    const on = v === true || v === 'on';
    SAVE.setSetting('sound', on);
    audio.setEnabled(on);
    ui.soundPressed(on);
    if (on) audio.uiBeep();
  },
  onMotionSet(v) {
    motionOK = v === true || v === 'on';
    SAVE.setSetting('motion', motionOK);
    document.body.classList.toggle('reduced-motion', !motionOK);
    if (exp) exp.setMotion(motionOK);
  },
  onQualitySet(v) {
    SAVE.setSetting('quality', v);
    if (exp) exp.setQuality(v);
  },
  onSkipReturnSet(v) {
    SAVE.setSetting('skipIntroOnReturn', v === true || v === 'on');
  },
  onScanToggle() { if (exp) exp.toggleScanner(); },
  onCam() { if (exp) exp.cycleCamera(); },
  onPhotoToggle() { if (exp) exp.togglePhoto(); },
  onCapture() { if (exp) exp.capture(); },
  onPhotoPreset(k) { if (exp) exp.setPhotoPreset(k); },
  onSkipIntro() { if (exp) exp.skipIntro(); },
  onSkipFlight() { if (exp) exp.skipFlight(); },
  onCTA() { if (exp) exp.handleCTA(); },
  onCTAHover() { audio.uiHover(); },
  onGalaxyHover(i) { if (exp) exp.galaxyHover(i); },
  onGalaxyFocus(i) { if (exp) exp.galaxyHover(i); },
  onGalaxyActivate(i) { if (exp) { exp._lastDomHit = i; exp.galaxyActivate(i); } },
  onGalaxyTap(i) { if (exp) { exp._lastDomHit = i; exp._galaxyTap(i); } },
  onGalaxyConfirm(i, src) { if (exp) exp.galaxyConfirm(i, src); },
  onOpenLog() { ui.renderLog(SAVE.loadSave()); },
  onOpenSky() {
    const draw = () => { if (exp) ui.drawSkyPanel(exp.getPanelState()); };
    draw();
    clearInterval(skyTimer);
    skyTimer = setInterval(() => {
      if (ui.openPanel !== 'sky') { clearInterval(skyTimer); return; }
      draw();
    }, 2000);
  },
  onSyncLocation() {
    if (!navigator.geolocation) { ui.sgos('SG.OS // GEOLOCATION UNAVAILABLE'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude, lo = pos.coords.longitude;
        ui.setLocChip(t('your_location') + ' ' + la.toFixed(2) + '°, ' + lo.toFixed(2) + '°');
        ui.sgos('SG.OS // OBSERVER POSITION SYNCED');
        if (exp) exp.setUserObserver(la, lo);
        ui.enableUserObserver();
        ui.setSeg('seg-observer', 'user');
        if (exp) { exp.setSkyObserver('user'); if (ui.openPanel === 'sky') ui.drawSkyPanel(exp.getPanelState()); }
      },
      () => ui.sgos('SG.OS // POSITION PERMISSION DENIED'),
      { timeout: 8000 }
    );
  },
  onLite() {
    const u = new URL(window.location.href);
    u.searchParams.set('lite', '1');
    window.location.assign(u.toString());
  },
  onReset() {
    if (window.confirm(t('reset_confirm'))) {
      SAVE.resetSave();
      window.location.reload();
    }
  },
  onSkyObserverSet(v) {
    if (!exp) return;
    exp.setSkyObserver(v);
    if (ui.openPanel === 'sky') ui.drawSkyPanel(exp.getPanelState());
  },
  onEscape() { if (exp) exp.escape(); },
});

ui.applyLanguage();
ui.soundPressed(save.settings.sound !== false);
ui.setSeg('seg-lang', getLanguage());
ui.setSeg('seg-sound', save.settings.sound !== false ? 'on' : 'off');
ui.setSeg('seg-motion', motionOK ? 'on' : 'off');
ui.setSeg('seg-quality', save.settings.quality || 'auto');
ui.setSeg('seg-skipreturn', save.settings.skipIntroOnReturn ? 'on' : 'off');
ui.setClock('MEDELLÍN // --:--:--');
ui.hideActionButtons([]);
ui.setDiscoveries(save.discoveries.length);
ui.setSightings(save.celestialSightings.length);

/* returning visitor (§27): recognized locally, offered three real paths */
const returning = save.visits > 1;
let welcomeChoice = null;         /* 'continue' | 'replay' | 'hub' */
let welcomeResolve = null;
const welcomePromise = (returning && !AUTOTEST && !SHOT && !FORCE_LITE && !DIAG)
  ? new Promise((res) => { welcomeResolve = res; })
  : Promise.resolve(null);
if (welcomeResolve) {
  ui.showWelcome(save, true);
  const pick = (k) => { if (welcomeResolve) { welcomeChoice = k; welcomeResolve(k); welcomeResolve = null; } };
  ui.cb.onWelcomeContinue = () => pick('continue');
  ui.cb.onWelcomeReplay = () => pick('replay');
  ui.cb.onWelcomeHub = () => pick('hub');
  setTimeout(() => { ui.hideWelcome(); pick('continue'); }, 8000);   /* never forced (§27) */
} else if (returning) {
  ui.showWelcome(save, false);
}

/* global error safety net (P0.1 §14/§15): classify + slide a 30 s window.
   Cosmetic errors NEVER escalate; only the SAME fatal-class error repeating
   fast while the engine is still booting may end in LITE. Once the 3D
   experience runs, window errors are logged and absorbed — the experience
   has its own degrade ladder (post → safe → restart offer). */
const errWin = makeErrorWindow(30000, 5);
function onGlobalError(message, source) {
  const cls = classifyError(message, source, bootPhase);
  const escalate = errWin.push(String(message || '').slice(0, 120), cls, Date.now());
  if (cls === FATAL) console.error('[SG ' + cls + ']', message, source || '');
  if (escalate && bootPhase === 'boot' && !liteShown) {
    enterLite('repeated fatal boot error: ' + message);
  }
}
window.addEventListener('error', (e) => onGlobalError(e.message, e.filename));
window.addEventListener('unhandledrejection', (e) => onGlobalError(e.reason && e.reason.message ? e.reason.message : String(e.reason), 'promise'));

/* ---------- three.js loader (local vendor first, then CDN, then LITE) ---- */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

/* THREE r161 loader (P0.1 §10/§11/§41): the local vendor copy is the primary
   source; pinned CDNs are only a secondary fallback. The vendor file is
   validated (real JS, plausible size) so a hosting 404-as-HTML page can
   never be imported as a module. */
async function vendorLooksReal(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return false;
    const text = await r.text();
    if (text.length < 100000) return false;                 /* three core ≈ 1.2 MB */
    if (text.slice(0, 200).trimStart().startsWith('<')) return false;
    return true;
  } catch (e) { return false; }
}
async function loadThree() {
  const local = './vendor/three.module.js?v=' + SG_BUILD_ID;
  if (await vendorLooksReal(local)) {
    try {
      const m = await import(/* @vite-ignore */ local);
      window.__SG_THREE_SRC = 'vendor';
      return m;
    } catch (e) { console.error('[SG THREE] vendor import failed', e); }
  }
  const cdns = [
    'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js',
    'https://unpkg.com/three@0.161.0/build/three.module.js',
  ];
  for (const url of cdns) {
    try {
      const m = await import(/* @vite-ignore */ url);
      window.__SG_THREE_SRC = 'cdn';
      return m;
    } catch (e) { /* try next */ }
  }
  return null;
}

/* ---------- build coherence (P0.1 §22–§24/§34) ---------- */
async function fetchManifestBuild() {
  try {
    const r = await fetch('build.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.build ? String(j.build) : null;
  } catch (e) { return null; }
}
function versionMismatchOverlay(b) {
  const url = new URL(window.location.href);
  url.searchParams.set('v', SG_BUILD_ID);
  url.searchParams.set('ts', String(Date.now()));
  const doReload = () => { window.location.replace(url.toString()); };
  const lines = [
    'SG DEPLOYMENT MISMATCH',
    'INDEX BUILD:    ' + (b.index || '—'),
    'JS BUILD:       ' + (b.js || '—'),
    'MANIFEST BUILD: ' + (b.manifest || '—'),
    '',
    'HARD RELOAD REQUIRED',
  ];
  bigOverlay('VERSION MISMATCH', lines, [['RELOAD LATEST BUILD', doReload]]);
  /* at most ONE automatic attempt, then the user is in control */
  const key = 'sgReloadTried:' + SG_BUILD_ID;
  let tried = false;
  try { tried = sessionStorage.getItem(key) === '1'; } catch (e) {}
  if (!tried && !AUTOTEST_MISMATCH) {
    try { sessionStorage.setItem(key, '1'); } catch (e) {}
    setTimeout(doReload, 1200);
  }
}
async function verifyBuildCoherence() {
  const indexBuild = (document.documentElement.dataset && document.documentElement.dataset.sgBuild) ||
    window.SG_EXPECTED_BUILD || null;
  const jsBuild = AUTOTEST_MISMATCH ? 'TEST-BUILD-B' : SG_BUILD_ID;
  const manifestBuild = AUTOTEST_MISMATCH ? 'TEST-BUILD-B' : await fetchManifestBuild();
  const res = buildMatches(AUTOTEST_MISMATCH ? 'TEST-BUILD-A' : indexBuild, jsBuild, manifestBuild);
  if (!res.ok) {
    console.error('[SG DEPLOYMENT MISMATCH]', res.builds);
    if (AUTOTEST) console.log('[SG TEST] VERSION MISMATCH DETECTED');
    if (AUTOTEST) console.log('[SG TEST] CACHE VERSION PASS');
    versionMismatchOverlay(res.builds);
    return false;
  }
  if (AUTOTEST && !AUTOTEST_MISMATCH) console.log('[SG TEST] CACHE VERSION PASS');
  return true;
}

/* ---------- ?diag=1 (P0.1 §19/§20) ---------- */
async function runDiagnostics() {
  const rows = [];
  for (const a of DIAG_ASSETS) {
    const r = await diagAsset(a.url, a.js);
    rows.push(
      (r.ok ? ' OK   ' : ' ERR  ') + String(r.status).padEnd(5) +
      (r.type || '—').split(';')[0].padEnd(26).slice(0, 26) +
      String(Math.round(r.size / 1024) + 'kb').padEnd(8) +
      a.url + (r.note ? '   ← ' + r.note : '')
    );
  }
  const manifest = await fetchManifestBuild();
  bigOverlay('SG NETWORK DIAGNOSTIC', [
    'BUILD (index):    ' + (window.SG_EXPECTED_BUILD || '—'),
    'BUILD (main.js):  ' + SG_BUILD_ID,
    'BUILD (manifest): ' + (manifest || '—'),
    'THREE SOURCE:     vendor/three.module.js primero · CDN 0.161.0 fallback',
    '',
    ...rows,
  ], [['CONTINUAR A LA EXPERIENCIA', () => {
    const u = new URL(window.location.href);
    u.searchParams.delete('diag');
    window.location.assign(u.toString());
  }]]);
}

function offerRestart(reason, detailLines) {
  /* one honest recovery step BEFORE Lite (P0.1 §13/§27) */
  bigOverlay('SG // 3D EXPERIENCE INTERRUPTED', [
    reason,
    ...(detailLines || []),
    '',
    'La experiencia 3D puede reiniciarse. LITE solo es el último recurso.',
  ], [
    ['RESTART 3D EXPERIENCE', () => {
      const u = new URL(window.location.href);
      u.searchParams.set('ts', String(Date.now()));
      window.location.replace(u.toString());
    }],
    ['MODO SAFE 3D', () => {
      const u = new URL(window.location.href);
      u.searchParams.set('safe', '1');
      u.searchParams.set('ts', String(Date.now()));
      window.location.replace(u.toString());
    }],
    ['CONTINUAR EN LITE', () => { closeOverlay(); enterLite('user choice after: ' + reason); }],
  ]);
}

function makeExperience(three, expMod, safeMode) {
  return expMod.createExperience(three, {
    canvas: document.getElementById('gl'),
    ui,
    audio,
    debugOn: DEBUG,
    autotest: AUTOTEST,
    autotestSkip: AUTOTEST_SKIP,
    safeMode,
    failFlags: FAIL_FLAGS,
    buildId: SG_BUILD_ID,
    shot: SHOT,
    isTouch,
    motionOK,
    onContextIssue(kind, info) {
      /* context lost/restore-failed → restart offer, not Lite (P0.1 §12/§13) */
      if (kind === 'restore-failed' || kind === 'lost-final') {
        offerRestart('GRAPHICS CONTEXT ' + (kind === 'lost-final' ? 'LOST' : 'RESTORE FAILED'),
          info ? [String(info)] : []);
      }
    },
    onFatal(err) {
      /* reached ONLY after the experience exhausted its own degrade ladder
         (post off → safe visuals). WebGL context problems go through
         onContextIssue; anything else gets a restart offer first. */
      const msg = (err && err.message) ? err.message : String(err || 'render loop');
      console.error('[SG FATAL]', err);
      if (/context|webgl/i.test(msg) && !webglOK()) {
        enterLite('webgl unrecoverable: ' + msg);
        return;
      }
      offerRestart('RUNTIME ERROR TRAS AGOTAR DEGRADACIÓN', [msg]);
    },
  });
}

async function boot() {
  if (DIAG) { runDiagnostics(); return; }
  if (FORCE_LITE) { enterLite('forced (?lite=1)'); return; }
  if (FAIL_FLAGS.has('webgl')) { enterLite('injected webgl failure (autotest)'); return; }
  if (!webglOK()) { enterLite('WebGL unavailable on this device/browser'); return; }

  const coherent = await verifyBuildCoherence();
  if (!coherent) return;                       /* mismatch overlay owns the page */

  /* surface context-creation failures explicitly (P0.1 §12) */
  const glCanvas = document.getElementById('gl');
  glCanvas.addEventListener('webglcontextcreationerror', (e) => {
    console.error('[SG CONTEXT CREATION ERROR]', e.statusMessage || '');
    enterLite('webgl context creation error: ' + (e.statusMessage || 'unknown'));
  }, false);

  let loaderTimer = setTimeout(() => { if (!exp && !liteShown) ui.loader('SYNCING FLIGHT DATA'); }, 700);

  const [three, expMod] = await Promise.all([
    loadThree(),
    import('./experience.js'),
  ]);
  clearTimeout(loaderTimer);
  ui.loader(null);

  if (!three) { enterLite('three.js unreachable (vendor + CDN)'); return; }
  if (!expMod) { enterLite('experience module failed to import'); return; }
  await welcomePromise;                       /* §27: the visitor decides */
  if (DEBUG) console.log('[SG BOOT]', 'v' + SG_VERSION, 'build', SG_BUILD_ID, 'three:', window.__SG_THREE_SRC, 'rev', three.REVISION);

  const startWith = (safeMode) => {
    exp = makeExperience(three, expMod, safeMode);
    let skip = returning && !!SAVE.loadSave().settings.skipIntroOnReturn;
    if (welcomeChoice === 'replay') skip = false;        /* REPLAY ARRIVAL */
    if (welcomeChoice === 'hub') skip = true;            /* GO TO GALAXY HUB */
    exp.start({ skip });
    if (welcomeChoice === 'hub') {
      const toHub = setInterval(() => {
        if (!exp) { clearInterval(toHub); return; }
        if (exp.chapter === 'facility') { clearInterval(toHub); try { exp.skipFlight(); } catch (e) {} }
      }, 250);
      setTimeout(() => clearInterval(toHub), 8000);
    }
    bootPhase = 'running';
    if (DEBUG) {
      ui.debug('UNIVERSO SG v' + SG_VERSION + ' BUILD ' + SG_BUILD_ID + (safeMode ? ' [SAFE]' : ''));
      ui.qaControls((a) => { if (exp) exp.qa(a); });   /* V3.3 QA buttons */
    }
    if (AUTOTEST && safeMode) console.log('[SG TEST] SAFE MODE ACTIVE');
  };

  try {
    startWith(SAFE);
  } catch (err) {
    console.error('[SG INIT ERROR]', err);
    const msg = (err && err.message) || '';
    const contextish = /webgl|context/i.test(msg);
    if (!SAFE) {
      /* hierarchy: FULL failed → try SAFE 3D before anything drastic (§27) */
      try { startWith(true); console.warn('[SG BOOT] FULL init failed — running SAFE 3D'); return; } catch (err2) {
        console.error('[SG INIT ERROR][SAFE]', err2);
        if (/webgl|context/i.test((err2 && err2.message) || '') || contextish) {
          enterLite('renderer creation failed: ' + ((err2 && err2.message) || msg));
        } else if (DEBUG) {
          bigOverlay('SG RUNTIME ERROR (INIT)', [String((err2 && err2.stack) || err2)], [['CERRAR', closeOverlay]]);
        } else {
          offerRestart('INIT ERROR', [msg]);
        }
        return;
      }
    }
    if (contextish) enterLite('renderer creation failed: ' + msg);
    else if (DEBUG) bigOverlay('SG RUNTIME ERROR (INIT)', [String((err && err.stack) || err)], [['CERRAR', closeOverlay]]);
    else offerRestart('INIT ERROR', [msg]);
  }
}

boot();
