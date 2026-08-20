/* ============================================================================
   UNIVERSO SEBAS GRANDA — boot diagnostics (P0.1)
   Pure, unit-testable helpers used by main.js:
   · error classification (FATAL vs RECOVERABLE) with a sliding time window
   · build/version matching (index ↔ main.js ↔ build.json)
   · ?diag=1 asset verification (status, MIME, size, HTML-instead-of-JS)
   ============================================================================ */

export const FATAL = 'FATAL';
export const RECOVERABLE = 'RECOVERABLE';

/* FATAL only when the 3D runtime itself cannot exist (P0.1 §2/§14):
   renderer creation, three core import, unrecoverable WebGL context.
   Everything else — textures, audio, weather, worker, satellites, scanner,
   post effects, optional assets — is RECOVERABLE by definition. */
const FATAL_PATTERNS = [
  /webglrenderer/i,
  /error creating webgl context/i,
  /webgl.*context.*(creation|unavailable|unrecoverable)/i,
  /three(\.module)?\.js.*(load|import|fetch)/i,
  /failed to fetch dynamically imported module.*three/i,
];
const RECOVERABLE_HINTS = [
  /texture|audio|weather|worker|satellit|scanner|bloom|postprocess|earthworker|moon|star|city/i,
];

export function classifyError(message, sourceFile, phase) {
  const msg = String(message || '');
  const src = String(sourceFile || '');
  if (RECOVERABLE_HINTS.some((r) => r.test(msg) || r.test(src))) return RECOVERABLE;
  if (FATAL_PATTERNS.some((r) => r.test(msg) || r.test(src))) return FATAL;
  /* unknown errors are only fatal while the engine is still booting —
     once the renderer exists, an unknown error can degrade, never destroy */
  return phase === 'boot' ? FATAL : RECOVERABLE;
}

/* Sliding-window, deduplicated error counter (P0.1 §15). Escalates only when
   the SAME fatal-class error repeats fast; cosmetic noise never accumulates. */
export function makeErrorWindow(windowMs, threshold) {
  const win = windowMs || 30000;
  const th = threshold || 5;
  const entries = [];
  return {
    push(key, cls, now) {
      const t = now == null ? Date.now() : now;
      while (entries.length && t - entries[0].t > win) entries.shift();
      entries.push({ t, key, cls });
      if (cls !== FATAL) return false;
      const same = entries.filter((e) => e.cls === FATAL && e.key === key);
      return same.length >= th;
    },
    size() { return entries.length; },
  };
}

/* §22/§23: the three builds that must agree before the app may continue */
export function buildMatches(indexBuild, jsBuild, manifestBuild) {
  const set = [indexBuild, jsBuild, manifestBuild].filter((b) => b != null && b !== '');
  if (set.length < 2) return { ok: true, builds: set };  /* nothing to compare */
  const ok = set.every((b) => b === set[0]);
  return { ok, builds: { index: indexBuild || null, js: jsBuild || null, manifest: manifestBuild || null } };
}

/* §19/§20: fetch one asset with cache bypass; verdict on status + MIME +
   HTML-served-as-JS (the classic broken-hosting signature) */
export async function diagAsset(url, expectJs, fetchImpl) {
  const f = fetchImpl || fetch;
  const out = { url, status: 0, type: '', size: 0, ok: false, note: '' };
  try {
    const r = await f(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'diag=' + Date.now(), { cache: 'no-store' });
    out.status = r.status;
    out.type = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
    const text = await r.text();
    out.size = text.length;
    if (!r.ok) { out.note = 'HTTP ' + r.status; return out; }
    if (expectJs) {
      const head = text.slice(0, 200).trimStart();
      if (head.startsWith('<')) { out.note = 'HTML SERVED INSTEAD OF JS'; return out; }
      if (out.type && !/javascript|ecmascript/i.test(out.type)) {
        out.note = 'BAD MIME FOR ES MODULE: ' + out.type;
        return out;
      }
    }
    out.ok = true;
    return out;
  } catch (e) {
    out.note = 'FETCH FAILED: ' + (e && e.message ? e.message : e);
    return out;
  }
}

export const DIAG_ASSETS = [
  { url: 'index.html', js: false },
  { url: 'build.json', js: false },
  { url: 'css/main.css', js: false },
  { url: 'js/main.js', js: true },
  { url: 'js/config.js', js: true },
  { url: 'js/experience.js', js: true },
  { url: 'js/astronomy.js', js: true },
  { url: 'js/celestial.js', js: true },
  { url: 'js/earthworker.js', js: true },
  { url: 'js/boot-diagnostics.js', js: true },
  { url: 'vendor/three.module.js', js: true },
  /* V3.4 TRUE EARTH: los archivos NASA reales forman parte del contrato */
  { url: 'js/countdown-voice.js', js: true },
  { url: 'js/qa34.js', js: true },
  { url: 'assets/earth/runtime/day-4096.jpg', js: false },
  { url: 'assets/earth/runtime/night-4096.jpg', js: false },
  { url: 'assets/earth/runtime/clouds-alpha-2048.png', js: false },
  { url: 'assets/earth/runtime/spec-1024.jpg', js: false },
];
