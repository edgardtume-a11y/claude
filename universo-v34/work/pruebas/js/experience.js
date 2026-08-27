/* ============================================================================
   UNIVERSO SEBAS GRANDA — experience.js  (AAA VISUAL POLISH PASS v2)
   Cinematic real-time mission. THREE is injected (createExperience) so the
   shell can boot instantly and fall back to LITE mode if WebGL never arrives.

   v2 pass: motivated night lighting, real shadow pipeline, PMREM environment
   per phase, contact shadows, geographic Earth, Meeus Moon + textured disc,
   real star catalog + galactic Milky Way, DIRECTOR/ORBIT/FREE cameras with
   blending, re-timed 16–18 s ascent, custom post (selective bloom, grading,
   FTL-only distortion), living Galaxy Hub with rare events, layered audio.
   Same architecture, same modules, same destinations, same mechanics.
   ============================================================================ */

import { MEDELLIN, GALAXIES, DISCOVERIES, TOTAL_DISCOVERIES, GREETINGS, SG_VERSION, SG_BUILD_ID } from './config.js';
import { t, getLanguage } from './i18n.js';
import * as SAVE from './save.js';
import * as ASTRO from './astronomy.js';
import * as CEL from './celestial.js';
import { createAssetPipeline } from './sgassets.js';
import { getWeather, weatherStatusKey } from './weather.js';

let T = null;

export function createExperience(three, opts) {
  T = three;
  return new Experience(opts);
}

/* ----------------------------- small utils ------------------------------ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const damp = (cur, tgt, l, dt) => lerp(cur, tgt, 1 - Math.exp(-l * dt));
const rand = (a, b) => a + Math.random() * (b - a);

function lerpTable(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (x <= tab[i][0]) {
      const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return tab[tab.length - 1][1];
}

/* deterministic value noise (terrain, placement, shake) */
function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm2(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * vnoise2(x * f, z * f); amp *= 0.5; f *= 2.03; }
  return s;
}
function gauss2() { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) / 1.05; }

/* ------------------------- canvas texture makers ------------------------- */
function blobTex(size, inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
function cloudTex() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  for (let i = 0; i < 46; i++) {
    const r = rand(18, 62), x = rand(r, s - r), y = rand(r * 0.8, s - r * 0.8);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
function nebulaTex() {
  /* V3.4 (adicional §4): the old version scattered blobs across the WHOLE
     canvas, so any large sprite revealed its rectangular edges (the dark
     frame around STAR MARK). Blobs now live inside a radial falloff and the
     whole canvas is masked by a soft radial fade — sprite edges are gone. */
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    const a = rand(0, TAU), rr = Math.pow(Math.random(), 1.6) * s * 0.34;
    const x = s / 2 + Math.cos(a) * rr, y = s / 2 + Math.sin(a) * rr * 0.8;
    const r = rand(20, 84) * (1 - rr / (s * 0.4)) + 12;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,' + rand(0.04, 0.10).toFixed(3) + ')');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  /* hard guarantee: radial mask to zero well before the canvas edge */
  const mask = g.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s * 0.5);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.75, 'rgba(255,255,255,0.55)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = mask; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'source-over';
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
function padMarkingsTex() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(240,246,255,0.85)'; g.lineWidth = 6;
  g.strokeRect(26, 26, s - 52, s - 52);
  g.beginPath(); g.arc(s / 2, s / 2, 150, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,196,60,0.9)';
  const hz = (x, y) => { for (let i = 0; i < 4; i++) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-40 + i * 22, -6, 12, 12); g.restore(); } };
  hz(70, 70); hz(s - 70, 70); hz(70, s - 70); hz(s - 70, s - 70);
  g.fillStyle = 'rgba(240,246,255,0.9)';
  g.font = 'bold 64px monospace'; g.textAlign = 'center';
  g.fillText('SG-L1', s / 2, s / 2 + 22);
  /* worn tire arcs + oil stains for lived-in apron */
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 10;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(rand(90, s - 90), rand(90, s - 90), rand(40, 120), rand(0, TAU), rand(0, TAU) + rand(0.4, 1.4));
    g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(rand(60, s - 60), rand(60, s - 60), rand(6, 20), 0, TAU); g.fill(); }
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
/* Rocket skin v2: panel seams, rivets, roughness variation, LOX frost band,
   subtle thermal zones — new but operational, no exaggerated grime. */
function hullTex() {
  const s = 1024, c = document.createElement('canvas'); c.width = c.height = s;   /* V3.4 §66: hero-res skin */
  const g = c.getContext('2d');
  g.fillStyle = '#e9edf3'; g.fillRect(0, 0, s, s);
  /* large panel plates with slight tonal variation */
  for (let py = 0; py < 8; py++) for (let px = 0; px < 6; px++) {
    g.fillStyle = 'rgba(' + (px + py) % 2 + ',' + 0 + ',' + 0 + ',0)';
    const v = 0.94 + hash2(px * 3.1, py * 7.7) * 0.08;
    g.fillStyle = 'rgba(' + Math.round(233 * v) + ',' + Math.round(237 * v) + ',' + Math.round(243 * v) + ',1)';
    g.fillRect(px * (s / 6), py * (s / 8), s / 6, s / 8);
  }
  /* seams */
  g.strokeStyle = 'rgba(96,106,122,0.5)'; g.lineWidth = 2;
  for (let y = 0; y <= s; y += s / 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
  g.strokeStyle = 'rgba(96,106,122,0.28)'; g.lineWidth = 1.4;
  for (let x = 0; x <= s; x += s / 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
  /* selective rivets along seams */
  g.fillStyle = 'rgba(70,80,95,0.55)';
  for (let y = 0; y <= s; y += s / 8) for (let x = 8; x < s; x += 22) {
    if (hash2(x, y) > 0.35) g.fillRect(x, y - 1.5, 2.6, 2.6);
  }
  /* micro wear (density scaled to the hero-res canvas) */
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = 'rgba(90,100,115,' + rand(0.015, 0.06).toFixed(3) + ')';
    g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 3));
  }
  /* faint vertical streaking (condensation history) */
  g.strokeStyle = 'rgba(150,160,175,0.06)';
  for (let i = 0; i < 76; i++) {
    const x = rand(0, s); g.beginPath(); g.moveTo(x, rand(0, s * 0.4)); g.lineTo(x + rand(-3, 3), s); g.stroke();
  }
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  tx.wrapS = tx.wrapT = T.RepeatWrapping;
  tx.anisotropy = 4;
  return tx;
}
function roughVarTex() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = Math.round(150 + fbm2(x * 0.09, y * 0.09) * 90);
    const i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tx = new T.CanvasTexture(c);
  tx.wrapS = tx.wrapT = T.RepeatWrapping;
  return tx;
}
function sgDecalTex() {
  const w = 256, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#0d1b30'; g.fillRect(10, 18, 108, 92);
  g.fillStyle = '#35d6ff'; g.font = 'bold 72px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('SG', 64, 90);
  g.fillStyle = '#0d1b30'; g.font = 'bold 30px monospace'; g.textAlign = 'left';
  g.fillText('UNIVERSO', 130, 58);
  g.fillText('SG-L1', 130, 96);
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
function textTex(lines, fg, bg, w, h, size) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
  g.fillStyle = fg; g.font = 'bold ' + size + 'px monospace'; g.textAlign = 'center';
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size + 6) + size * 0.35));
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}
function hazardTex() {
  const s = 128, c = document.createElement('canvas'); c.width = s; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8b23a'; g.fillRect(0, 0, s, 32);
  g.fillStyle = '#14171c';
  for (let x = -32; x < s; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); }
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  tx.wrapS = T.RepeatWrapping;
  return tx;
}

/* --------------------------- particle systems ---------------------------- */
/* v2: optional uLight (engine glow) tints smoke from the ignition point, so
   exhaust volumes catch warm light instead of staying flat grey. */
class SGParticles {
  constructor(opts) {
    const n = opts.count;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size0 = new Float32Array(n);
    this.head = 0;
    this.gravity = opts.gravity || 0;
    this.drag = opts.drag == null ? 0 : opts.drag;
    this.grow = opts.grow == null ? 1 : opts.grow;

    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
    this.aSize = new T.BufferAttribute(new Float32Array(n), 1);
    this.aLife = new T.BufferAttribute(new Float32Array(n), 1);
    this.aSeed = new T.BufferAttribute(new Float32Array(n), 1);
    for (let i = 0; i < n; i++) this.aSeed.array[i] = Math.random();
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aLife', this.aLife);
    geo.setAttribute('aSeed', this.aSeed);
    geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e7);

    this.uniforms = {
      uTex: { value: opts.tex },
      uC1: { value: new T.Color(opts.color) },
      uC2: { value: new T.Color(opts.color2 == null ? opts.color : opts.color2) },
      uOp: { value: opts.opacity == null ? 1 : opts.opacity },
      uGrow: { value: this.grow },
      uPx: { value: 1 },
      uLightPos: { value: new T.Vector3(0, -9999, 0) },
      uLightCol: { value: new T.Color(0x000000) },
      uLightR: { value: 60 },
    };
    this.mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: opts.blending || T.NormalBlending,
      uniforms: this.uniforms,
      vertexShader: [
        'attribute float aSize; attribute float aLife; attribute float aSeed;',
        'varying float vLife; varying float vSeed; varying float vLit;',
        'uniform float uGrow; uniform float uPx; uniform vec3 uLightPos; uniform float uLightR;',
        'void main(){',
        ' vLife=aLife; vSeed=aSeed;',
        ' vec4 wp=modelMatrix*vec4(position,1.0);',
        ' vLit=clamp(1.0-distance(wp.xyz,uLightPos)/uLightR,0.0,1.0);',
        ' vec4 mv=viewMatrix*wp;',
        ' float g=mix(1.0,uGrow,1.0-aLife);',
        ' gl_PointSize=aSize*g*uPx*(220.0/max(1.0,-mv.z));',
        ' gl_Position=projectionMatrix*mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uTex; uniform vec3 uC1; uniform vec3 uC2; uniform float uOp; uniform vec3 uLightCol;',
        'varying float vLife; varying float vSeed; varying float vLit;',
        '/* tiny value noise for edge erosion — no two puffs identical (V3 §17) */',
        'float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
        '  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }',
        'void main(){',
        ' /* per-particle rotation + slow tumble */',
        ' float ang=vSeed*6.2831+vLife*1.7*(vSeed>0.5?1.0:-1.0);',
        ' vec2 q=gl_PointCoord-0.5;',
        ' vec2 r=vec2(q.x*cos(ang)-q.y*sin(ang), q.x*sin(ang)+q.y*cos(ang))+0.5;',
        ' vec4 tx=texture2D(uTex,r);',
        ' /* noise-eroded, lifetime-dissolving edge */',
        ' float n=vn(r*5.0+vSeed*37.0)*0.65+vn(r*11.0+vSeed*91.0)*0.35;',
        ' float erode=smoothstep(0.28,0.62,vLife+ n*0.55 - 0.28);',
        ' float rim=smoothstep(0.5,0.18,length(q));',
        ' float fade=smoothstep(0.0,0.15,vLife);',
        ' vec3 col=mix(uC2,uC1,vLife*0.7+vSeed*0.3);',
        ' col*=0.86+0.28*n;                    /* internal density variation */',
        ' col+=uLightCol*vLit*vLit*(0.7+0.6*n);',
        ' gl_FragColor=vec4(col,tx.a*rim*erode*uOp*fade);',
        ' if(gl_FragColor.a<0.01) discard;',
        '}',
      ].join('\n'),
    });
    this.points = new T.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = opts.renderOrder == null ? 5 : opts.renderOrder;
  }
  spawn(x, y, z, vx, vy, vz, life, size) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size0[i] = size;
  }
  update(dt, wx, wz, deflectY, deflectPush) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.n; i++) {
      let L = this.life[i];
      if (L <= 0) { this.aLife.array[i] = 0; this.aSize.array[i] = 0; continue; }
      L -= dt; this.life[i] = L;
      const dragK = this.drag ? Math.exp(-this.drag * dt) : 1;
      v[i * 3] = v[i * 3] * dragK + wx * dt;
      v[i * 3 + 1] = v[i * 3 + 1] * dragK + this.gravity * dt;
      v[i * 3 + 2] = v[i * 3 + 2] * dragK + wz * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (deflectY != null && p[i * 3 + 1] < deflectY && v[i * 3 + 1] < 0) {
        p[i * 3 + 1] = deflectY;
        v[i * 3 + 1] *= -0.14;
        const away = p[i * 3] >= 0 ? 1 : -1;
        v[i * 3] += (deflectPush || 40) * away * 0.6 + (Math.random() - 0.5) * 14;
        v[i * 3 + 2] += (Math.random() - 0.5) * (deflectPush || 40);
      }
      this.aLife.array[i] = clamp(L / this.max[i], 0, 1);
      this.aSize.array[i] = this.size0[i];
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.aLife.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }
  setPx(px) { this.uniforms.uPx.value = px; }
  setLight(pos, col, r, k) {
    this.uniforms.uLightPos.value.copy(pos);
    this.uniforms.uLightCol.value.copy(col).multiplyScalar(k);
    this.uniforms.uLightR.value = r;
  }
  clear() { this.life.fill(0); this.aLife.array.fill(0); this.aSize.array.fill(0); this.aLife.needsUpdate = true; this.aSize.needsUpdate = true; }
}

/* rain: recycled streaks around a moving center */
class RainField {
  constructor(count, tex) {
    this.n = count;
    this.box = { x: 300, y: 190, z: 300 };
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand(-this.box.x, this.box.x) * 0.5;
      pos[i * 3 + 1] = rand(0, this.box.y);
      pos[i * 3 + 2] = rand(-this.box.z, this.box.z) * 0.5;
    }
    this.geo = new T.BufferGeometry();
    this.geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    this.geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e6);
    this.mat = new T.PointsMaterial({
      map: tex, size: 1.7, transparent: true, opacity: 0,
      color: 0xaac8e8, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new T.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  update(dt, wx, wz, cx, cz) {
    const p = this.geo.attributes.position.array;
    const fall = 120;
    for (let i = 0; i < this.n; i++) {
      p[i * 3] += wx * 0.9 * dt;
      p[i * 3 + 1] -= fall * dt;
      p[i * 3 + 2] += wz * 0.9 * dt;
      if (p[i * 3 + 1] < 0) {
        p[i * 3] = cx + rand(-this.box.x, this.box.x) * 0.5;
        p[i * 3 + 1] = this.box.y + rand(0, 30);
        p[i * 3 + 2] = cz + rand(-this.box.z, this.box.z) * 0.5;
      }
      if (Math.abs(p[i * 3] - cx) > this.box.x) p[i * 3] = cx + rand(-this.box.x, this.box.x) * 0.5;
      if (Math.abs(p[i * 3 + 2] - cz) > this.box.z) p[i * 3 + 2] = cz + rand(-this.box.z, this.box.z) * 0.5;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/* ---------------------------- post pipeline ------------------------------ */
/* Self-contained (no examples/jsm): scene → linear RT → threshold bright pass
   → separable blur (selective bloom) → composite (ACES + per-look grading +
   vignette + FTL-only chromatic aberration / radial distortion / exposure
   pulse) → sRGB out. PERF/MOBILE run the single composite pass only. */
class SGPost {
  constructor(renderer, opts) {
    this.r = renderer;
    this.bloomOn = !!opts.bloom;
    this.iters = opts.iters || 2;
    this.enabled = true;
    const type = renderer.capabilities.isWebGL2 ? T.HalfFloatType : T.UnsignedByteType;
    const mk = (w, h, dep) => new T.WebGLRenderTarget(w, h, {
      type, depthBuffer: !!dep, stencilBuffer: false,
      minFilter: T.LinearFilter, magFilter: T.LinearFilter,
    });
    this.rtScene = mk(4, 4, true);
    this.rtA = mk(4, 4, false);
    this.rtB = mk(4, 4, false);
    this.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new T.Scene();
    this.quadGeo = new T.PlaneGeometry(2, 2);

    this.brightU = { tDiffuse: { value: null }, uThresh: { value: 0.9 }, uKnee: { value: 0.55 } };
    this.brightMat = new T.ShaderMaterial({
      uniforms: this.brightU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uThresh,uKnee; varying vec2 vUv;',
        'void main(){',
        ' vec3 c=texture2D(tDiffuse,vUv).rgb;',
        ' float l=max(c.r,max(c.g,c.b));',
        ' float k=smoothstep(uThresh-uKnee,uThresh+uKnee,l);',
        ' gl_FragColor=vec4(c*k,1.0);',
        '}',
      ].join('\n'),
    });
    this.blurU = { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uPx: { value: new T.Vector2(1, 1) } };
    this.blurMat = new T.ShaderMaterial({
      uniforms: this.blurU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform vec2 uDir,uPx; varying vec2 vUv;',
        'void main(){',
        ' vec2 o=uDir*uPx;',
        ' vec3 s=texture2D(tDiffuse,vUv).rgb*0.227;',
        ' s+=texture2D(tDiffuse,vUv+o*1.3846).rgb*0.3162;',
        ' s+=texture2D(tDiffuse,vUv-o*1.3846).rgb*0.3162;',
        ' s+=texture2D(tDiffuse,vUv+o*3.2307).rgb*0.0702;',
        ' s+=texture2D(tDiffuse,vUv-o*3.2307).rgb*0.0702;',
        ' gl_FragColor=vec4(s,1.0);',
        '}',
      ].join('\n'),
    });
    this.compU = {
      tScene: { value: null }, tBloom: { value: null },
      uBloomStr: { value: 0.8 }, uExposure: { value: 1 },
      uLift: { value: new T.Vector3(0.01, 0.015, 0.03) },
      uGain: { value: new T.Vector3(0.95, 1.0, 1.1) },
      uSat: { value: 1.02 }, uVig: { value: 0.32 },
      uCA: { value: 0 }, uDistort: { value: 0 }, uPulse: { value: 0 },
      uHasBloom: { value: this.bloomOn ? 1 : 0 },
      /* V3.2 §21: LOCAL thermal refraction — a small animated noise warp
         masked to a screen-space disc around the engine plume. Never global. */
      uHeat: { value: 0 },
      uHeatC: { value: new T.Vector2(0.5, 0.25) },
      uHeatR: { value: 0.22 },
      uHeatT: { value: 0 },
    };
    this.compMat = new T.ShaderMaterial({
      uniforms: this.compU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'uniform sampler2D tScene,tBloom;',
        'uniform float uBloomStr,uExposure,uSat,uVig,uCA,uDistort,uPulse,uHasBloom;',
        'uniform float uHeat,uHeatR,uHeatT;',
        'uniform vec2 uHeatC;',
        'uniform vec3 uLift,uGain;',
        'varying vec2 vUv;',
        'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }',
        'vec2 warp(vec2 uv,float k){ vec2 d=uv-0.5; float r2=dot(d,d); return uv+d*r2*k; }',
        'float hh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'float hn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
        '  return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }',
        'void main(){',
        ' vec2 uv=warp(vUv,uDistort);',
        ' if(uHeat>0.0005){',
        '  float m=1.0-smoothstep(uHeatR*0.35,uHeatR,distance(vUv,uHeatC));',
        '  if(m>0.001){',
        '   vec2 hp=vUv*vec2(26.0,40.0)+vec2(0.0,-uHeatT*3.2);',
        '   vec2 off=vec2(hn(hp)-0.5,hn(hp+17.3)-0.5)*uHeat*m;',
        '   uv+=off;',
        '  }',
        ' }',
        ' vec3 c;',
        ' if(uCA>0.0005){',
        '  vec2 d=(uv-0.5)*uCA;',
        '  c.r=texture2D(tScene,uv+d).r;',
        '  c.g=texture2D(tScene,uv).g;',
        '  c.b=texture2D(tScene,uv-d).b;',
        ' } else c=texture2D(tScene,uv).rgb;',
        ' if(uHasBloom>0.5) c+=texture2D(tBloom,uv).rgb*uBloomStr;',
        ' c*=uExposure*(1.0+uPulse);',
        ' c=aces(c);',
        ' c=c*uGain+uLift*(1.0-c);',
        ' float l=dot(c,vec3(0.2126,0.7152,0.0722));',
        ' c=mix(vec3(l),c,uSat);',
        ' vec2 q=vUv-0.5; c*=1.0-uVig*dot(q,q)*2.2;',
        ' c=pow(max(c,vec3(0.0)),vec3(0.4545));',
        ' gl_FragColor=vec4(c,1.0);',
        '}',
      ].join('\n'),
    });
    this.quadMesh = new T.Mesh(this.quadGeo, this.compMat);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);
  }
  setSize(w, h) {
    this.rtScene.setSize(w, h);
    const bw = Math.max(2, Math.round(w / 2)), bh = Math.max(2, Math.round(h / 2));
    this.rtA.setSize(bw, bh);
    this.rtB.setSize(bw, bh);
    this.blurU.uPx.value.set(1 / bw, 1 / bh);
  }
  render(scene, cam) {
    const r = this.r;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, cam);
    if (this.bloomOn) {
      this.quadMesh.material = this.brightMat;
      this.brightU.tDiffuse.value = this.rtScene.texture;
      r.setRenderTarget(this.rtA);
      r.render(this.quadScene, this.quadCam);
      this.quadMesh.material = this.blurMat;
      let src = this.rtA, dst = this.rtB;
      for (let i = 0; i < this.iters; i++) {
        this.blurU.tDiffuse.value = src.texture;
        this.blurU.uDir.value.set(1 + i * 0.6, 0);
        r.setRenderTarget(dst);
        r.render(this.quadScene, this.quadCam);
        const tmp = src; src = dst; dst = tmp;
        this.blurU.tDiffuse.value = src.texture;
        this.blurU.uDir.value.set(0, 1 + i * 0.6);
        r.setRenderTarget(dst);
        r.render(this.quadScene, this.quadCam);
        const tmp2 = src; src = dst; dst = tmp2;
      }
      this.compU.tBloom.value = src.texture;
    }
    this.quadMesh.material = this.compMat;
    this.compU.tScene.value = this.rtScene.texture;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
  dispose() { this.rtScene.dispose(); this.rtA.dispose(); this.rtB.dispose(); }
}

/* ============================ EXPERIENCE ================================= */
class Experience {
  constructor(opts) {
    this.ui = opts.ui;
    this.audio = opts.audio;
    this.canvas = opts.canvas;
    this.debugOn = !!opts.debugOn;
    this.isTouch = !!opts.isTouch;
    this.onFatal = opts.onFatal || function () {};
    this.save = SAVE.loadSave();

    this.motionOK = opts.motionOK;
    this.qualityPref = this.save.settings.quality || 'auto';

    /* world state (director) */
    this.w = {
      weather: null, weatherSrc: 'offline', statusKey: 'cloudy',
      cloudLow: 0.45, cloudHigh: 0.25, cloudLowT: 0.45, cloudHighT: 0.25,
      haze: 0.35, hazeT: 0.35,
      rain: 0, rainT: 0,
      windX: 0, windZ: 0, windXT: 0, windZT: 0, gust: 0,
      wet: 0,
      sun: { alt: 30, az: 120 }, moon: { alt: -10, az: 0, illum: 0.5, phase: 0.25, angDiam: 0.52 },
      planets: [],
      sunDir: new T.Vector3(0, 1, 0), moonDir: new T.Vector3(0, -1, 0),
      lightning: 0, nextBolt: 1e9,
    };
    /* observers: BASE = Medellín (drives the 3D world), USER = optional sync */
    this.userObs = null;               /* {lat,lon} once permission granted */
    this.skyObserver = 'base';         /* which observer LOCAL SKY displays */
    this._userPanelCache = null;

    this.chapter = 'boot';
    this.mt = 0;                 /* chapter clock (real seconds, FPS-proof) */
    this._chStart = performance.now();
    this._chBase = 0;
    this._autotest = !!opts.autotest;
    this._autotestSkip = !!opts.autotestSkip;
    this._shot = opts.shot || null;             /* §56 art-shot mode */
    this._atState = {};
    this._wdFired = false;
    this.safeMode = !!opts.safeMode;
    this._fail = opts.failFlags instanceof Set ? opts.failFlags : new Set(opts.failFlags || []);
    this.buildId = opts.buildId || '';
    this.onContextIssue = opts.onContextIssue || (() => {});
    this._errLadder = [];                /* degrade ladder history (P0.1 §27) */
    this._degradeStage = 0;              /* 0 full → 1 no post → 2 safe visuals */
    this._ctxLost = false;
    this._lastTransition = 'boot';
    this.earthWorkerState = 'idle';
    this.elapsed = 0;
    this.timeScale = 1;
    this.trauma = 0;
    this.fatalCount = 0;
    this.buildQueue = [];          /* [{name, fn}] — small, measured tasks */
    this._buildLog = [];
    this.builtFacility = false;
    this.builtSpace = false;
    this.builtHub = false;
    this.events = [];
    this._sgosFlags = {};
    this._pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: 0, id: -1, pinch: 0 };
    this.keys = {};
    this.userCamLock = false;
    this.photo = false;
    this.scanOn = false;
    this.scanState = { lockT: 0, prog: 0, target: null };
    this.targets = [];
    this.hoverIdx = -1; this.selectedIdx = -1; this.confirming = false;
    this._panelIdx = -1; this._selPush = 0; this._selPushT = 0;
    this._assets = null; this._heroTried = {};   /* V3 asset pipeline */
    /* SG MISSION 001 narrative state (addendum §10-§17/§26-§33) */
    this._firstVisit = (this.save.visits || 0) <= 1;
    this._objKey = null;
    this._sg01 = null;
    this._sg01State = 'IDLE';
    this._sg01Gaze = 0;
    this._revealed = { cam: false, photo: false, sky: false };
    this._hotHintDone = !this._firstVisit;
    this._celNoted = {};
    this.gpIndex = -1; this._gpPrev = {};
    this._arrivalDone = true; this._arrivalT = 0; this._arrivalDur = 0;
    this._idle = 0;
    this._fps = { ema: 16, t: 0 };
    this.dpr = 1; this.cloudFrac = 1;

    /* camera controller */
    this.camMode = 'director';                       /* director | orbit | free */
    this.camBlend = { t: 1, dur: 0.6, fromPos: new T.Vector3(), fromQuat: new T.Quaternion(), fromFov: 58 };
    this.free = { pos: new T.Vector3(-40, 8, 96), yaw: 0.35, pitch: 0.04, vyaw: 0, vpitch: 0, fov: 58 };
    this.dirState = { t: 0, seg: 0, skyLook: 0 };
    this._goalPos = new T.Vector3(); this._goalQuat = new T.Quaternion(); this._goalFov = 58;
    this._tmpM = new T.Matrix4(); this._tmpV = new T.Vector3(); this._tmpV2 = new T.Vector3();
    this._up = new T.Vector3(0, 1, 0);
    this._blackC = new T.Color(0, 0, 0);

    /* look grading targets (EARTH NIGHT default) */
    this.grade = {
      lift: new T.Vector3(0.010, 0.015, 0.028), gain: new T.Vector3(0.92, 1.01, 1.12),
      sat: 1.02, thresh: 0.85, bloom: 0.85,
      tLift: new T.Vector3(0.010, 0.015, 0.028), tGain: new T.Vector3(0.92, 1.01, 1.12),
      tSat: 1.02, tThresh: 0.85, tBloom: 0.85,
    };
    this.exposure = 1; this.exposureT = 1;
    this.ftl = 0;

    this._initRenderer();
    this._initSceneCore();
    this._bindInput();
    this._clockFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: MEDELLIN.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    this._lastSec = -1; this._astroT = 0; this._weatherT = 0; this._planetT = 0;
    this._radioT = rand(18, 40);
    this._meteorT = rand(50, 140);
  }

  /* ------------------------------ renderer ------------------------------ */
  _tier() {
    if (this.qualityPref && this.qualityPref !== 'auto') return this.qualityPref === 'performance' ? 'perf' : this.qualityPref;
    const small = Math.min(window.innerWidth, window.innerHeight) < 760;
    if (this.isTouch && small) return 'mobile';
    if (navigator.gpu) return 'ultra';
    return 'high';
  }
  _tierN(map) { return map[this._tier()] != null ? map[this._tier()] : map.high; }
  /* Real quality presets — ULTRA genuinely changes shadow res, textures,
     particle counts, bloom quality, star density (spec §75). */
  _preset() {
    if (this.safeMode) {
      /* SAFE 3D (P0.1 §25): full mission, reduced GPU surface */
      return { shadow: 0, shadows: false, dprCap: 1.5, bloom: false, iters: 1, earthTex: 256, mwS: 2000, mwG: 60, faint: 1600, clouds: 28, aniso: 2, part: 0.5 };
    }
    const P = {
      ultra:  { shadow: 2048, shadows: true, dprCap: 2.25, part: 1.0, bloom: true, iters: 3, earthTex: 2048, mwS: 5200, mwG: 150, faint: 3200, clouds: 64, aniso: 8 },
      high:   { shadow: 1536, shadows: true, dprCap: 2.0,  part: 1.0, bloom: true, iters: 2, earthTex: 2048, mwS: 4200, mwG: 120, faint: 2800, clouds: 50, aniso: 4 },
      perf:   { shadow: 0,    shadows: false, dprCap: 1.5, part: 0.7, bloom: false, iters: 1, earthTex: 1024, mwS: 2600, mwG: 80,  faint: 2000, clouds: 36, aniso: 2 },
      mobile: { shadow: 0,    shadows: false, dprCap: 1.4, part: 0.55, bloom: false, iters: 1, earthTex: 1024, mwS: 2200, mwG: 70, faint: 1500, clouds: 26, aniso: 2 },
    };
    return P[this._tier()] || P.high;
  }
  _initRenderer() {
    const pre = this._preset();
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas, antialias: this._tier() !== 'mobile', alpha: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x04070d, 1);
    /* shadows: real pipeline on HIGH/ULTRA, one casting light, soft PCF */
    this.renderer.shadowMap.enabled = pre.shadows;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.dpr = clamp(window.devicePixelRatio || 1, 1, pre.dprCap);
    this.renderer.setPixelRatio(this.dpr);

    /* GPU + GL facts for the runtime error screen (P0.1 §3) */
    this._gpuInfo = { gl: '', gpu: '' };
    try {
      const gl = this.renderer.getContext();
      this._gpuInfo.gl = gl.getParameter(gl.VERSION) || '';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) this._gpuInfo.gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
    } catch (e) { /* facts only, never blocking */ }

    /* WEBGL CONTEXT EVENTS (P0.1 §12/§13): losing the GPU context is NOT a
       JavaScript error — detect it, report it, pause rendering, try restore. */
    this.canvas.addEventListener('webglcontextlost', (e) => {
      try { e.preventDefault(); } catch (e2) {}
      this._ctxLost = true;
      this.ui.sgos('SG.OS // GRAPHICS CONTEXT INTERRUPTED');
      console.error('[SG CONTEXT LOST]', {
        statusMessage: e.statusMessage || '',
        chapter: this.chapter,
        renderer: this.renderer && this.renderer.info ? this.renderer.info.render : null,
        gpu: this._gpuInfo,
      });
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[SG CONTEXT RESTORED] rebuilding GPU-side resources');
      try {
        this._ctxLost = false;
        this._reinitAfterRestore();
        this.ui.sgos('SG.OS // GRAPHICS CONTEXT RESTORED');
      } catch (err) {
        console.error('[SG CONTEXT RESTORE FAILED]', err);
        this.onContextIssue('restore-failed', err && err.message);
      }
    }, false);

    this.cam = new T.PerspectiveCamera(58, 1, 0.1, 30000);
    this.cam.position.set(0, 24, 95);
    this._fovT = 58;

    /* custom post: tone-mapping moves into the composite pass.
       POST IS 100% ISOLATED (P0.1 §28): any failure → standard renderer,
       never LITE. SAFE mode and ?fail=post skip it entirely. */
    try {
      if (this.safeMode || this._fail.has('post')) throw new Error('post disabled (' + (this.safeMode ? 'safe mode' : 'injected post failure') + ')');
      this.renderer.toneMapping = T.NoToneMapping;
      this.post = new SGPost(this.renderer, { bloom: pre.bloom, iters: pre.iters });
      this.postOK = true;
    } catch (e) {
      this.post = null; this.postOK = false;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
    }
    this._resize();
    window.addEventListener('resize', () => this._resize());
    if (this.debugOn) this._mkCtxTestBtn();
    document.addEventListener('visibilitychange', () => {
      this._hidden = document.hidden;
      if (this._hidden) this._hiddenAt = performance.now();
      else if (this._hiddenAt) { this._chStart += performance.now() - this._hiddenAt; this._hiddenAt = 0; }
    });
  }
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.post) this.post.setSize(Math.round(w * this.dpr), Math.round(h * this.dpr));
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /* ---------------------------- scene core ------------------------------ */
  _reinitAfterRestore() {
    const pre = this._preset();
    if (this.postOK) {
      try { this.post = new SGPost(this.renderer, { bloom: pre.bloom, iters: pre.iters }); }
      catch (e) { this.postOK = false; this.renderer.toneMapping = T.ACESFilmicToneMapping; }
    }
    try { this._buildEnvironments(); } catch (e) { /* env optional */ }
    this._resize();
  }
  _mkCtxTestBtn() {
    if (this._ctxBtn || typeof document === 'undefined' || !document.body || !document.body.appendChild) return;
    try {
      const b = document.createElement('button');
      b.textContent = 'TEST CONTEXT LOSS';
      b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:997;padding:6px 10px;font:600 10px monospace;letter-spacing:.08em;background:#101a26;color:#9fe0ff;border:1px solid #35d6ff;border-radius:6px;cursor:pointer;opacity:.75';
      b.onclick = () => this.debugLoseContext();
      document.body.appendChild(b);
      this._ctxBtn = b;
      try { window.SG = window.SG || {}; window.SG.loseContext = () => this.debugLoseContext(); } catch (e) {}
    } catch (e) { /* debug-only sugar */ }
  }
  /* debug tool (P0.1 §35): simulate a context loss from the console */
  debugLoseContext() {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) { console.warn('[SG] WEBGL_lose_context not available'); return false; }
      ext.loseContext();
      setTimeout(() => { try { ext.restoreContext(); } catch (e) {} }, 1500);
      return true;
    } catch (e) { console.error('[SG] debugLoseContext failed', e); return false; }
  }
  _initSceneCore() {
    const pre = this._preset();
    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x8fb0c8, 0.00035);

    this.gIntro = new T.Group();
    this.gSurface = new T.Group(); this.gSurface.visible = false;
    this.gSpace = new T.Group(); this.gSpace.visible = false;
    this.gWarp = new T.Group(); this.gWarp.visible = false;
    this.gHub = new T.Group(); this.gHub.visible = false;
    this.scene.add(this.gIntro, this.gSurface, this.gSpace, this.gWarp, this.gHub);

    /* MOTIVATED LIGHT HIERARCHY (spec §2)
       hemi        → SKY AMBIENT (deep-blue night floor, lets mountains read)
       moonL       → MOON KEY (only when Moon is truly up, real direction)
       sunL        → dual-role shadow key: real Sun by day, INDUSTRIAL KEY at
                     night (fixed flood direction from the tower toward pad),
                     so one shadow map serves both without shader recompiles
       fill*       → INDUSTRIAL FILLS (cyan / technical white / amber, no shadow)
       cityHemi via ground colour + glow sprites → CITY BOUNCE
       engineL     → ignition becomes the dominant source at liftoff */
    this.hemi = new T.HemisphereLight(0xbfd8ff, 0x2a3524, 0.9);
    this.sunL = new T.DirectionalLight(0xffe6c0, 2.2);
    if (pre.shadows) {
      this.sunL.castShadow = true;
      this.sunL.shadow.mapSize.set(pre.shadow, pre.shadow);
      const sc = this.sunL.shadow.camera;
      sc.left = -115; sc.right = 115; sc.top = 115; sc.bottom = -115;
      sc.near = 40; sc.far = 900;
      this.sunL.shadow.bias = -0.00032;
      this.sunL.shadow.normalBias = 0.55;
      this.sunTarget = new T.Object3D();
      this.scene.add(this.sunTarget);
      this.sunL.target = this.sunTarget;
    }
    this.moonL = new T.DirectionalLight(0x9db2e0, 0);
    this.engineL = new T.PointLight(0xffa040, 0, 380, 1.7);
    this.trenchL = new T.PointLight(0xff8a3a, 0, 220, 1.8);
    this.fillCyan = new T.PointLight(0x8fd8ff, 0, 150, 1.7);
    this.fillTech = new T.PointLight(0xfff1dc, 0, 130, 1.7);
    this.fillAmber = new T.PointLight(0xffbe7a, 0, 120, 1.8);
    this.scene.add(this.hemi, this.sunL, this.moonL, this.engineL, this.trenchL, this.fillCyan, this.fillTech, this.fillAmber);
    this.fillCyan.position.set(-48, 16, -40);
    this.fillTech.position.set(-30, 20, 52);
    this.fillAmber.position.set(-74, 10, 16);

    this.texBlob = blobTex(128, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.texSoft = blobTex(128, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.texContact = blobTex(128, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
    this.texCloud = cloudTex();
    this.texNebula = nebulaTex();
    this.texRough = roughVarTex();

    this._buildSkyDome();
    this._buildSkySystem();     /* catalog stars + Milky Way + faint layer + Moon */
    this._buildIntroFX();
    this._buildEnvironments();  /* PMREM IBL per phase (spec §10) */

    /* shared pools (particle counts scale with the real preset) */
    const pc = pre.part;
    this.pSteam = new SGParticles({ count: Math.round(460 * pc), tex: this.texSoft, color: 0xeef4fa, color2: 0xb9c6d4, opacity: 0.5, grow: 2.6, drag: 0.6, gravity: 3 });
    this.pCore = new SGParticles({ count: Math.round(760 * pc), tex: this.texBlob, color: 0xfff9ec, color2: 0xffd9a0, opacity: 0.95, grow: 2.2, drag: 0.4, blending: T.AdditiveBlending, renderOrder: 7 });
    this.pPlume = new SGParticles({ count: Math.round(420 * pc), tex: this.texSoft, color: 0xfff1d6, color2: 0xff9a4a, opacity: 0.55, grow: 3.4, drag: 0.55, blending: T.AdditiveBlending, renderOrder: 6 });
    /* V3.2 §19 OUTER GAS layer: blue-grey, transparent, fast expansion */
    this.pOuter = new SGParticles({
      count: Math.round(220 * pc), tex: this.texSmoke, color: 0x9fb4c6, color2: 0x6b7f92,
      opacity: 0.16, grow: 3.4, drag: 0.5, gravity: -2,
    });
    this.gSurface.add(this.pOuter.points);
    this.pSmoke = new SGParticles({ count: Math.round(980 * pc), tex: this.texCloud, color: 0xcdd6de, color2: 0x596069, opacity: 0.62, grow: 5.5, drag: 0.9, gravity: 6 });
    this.pBurst = new SGParticles({ count: 160, tex: this.texBlob, color: 0x7ff0ff, color2: 0x35d6ff, opacity: 0.9, grow: 1.6, drag: 1.4, blending: T.AdditiveBlending, renderOrder: 8 });
    this.scene.add(this.pSteam.points, this.pCore.points, this.pPlume.points, this.pSmoke.points, this.pBurst.points);
  }

  /* Sky dome v2: directional sunset warmth, valley city-glow term, dithered
     gradients. The Moon is now a real textured mesh (no shader dot). */
  _buildSkyDome() {
    const geo = new T.SphereGeometry(9000, 40, 22);
    this.skyU = {
      uSunDir: { value: new T.Vector3(0, 1, 0) },
      uDay: { value: 1 },
      uCloud: { value: 0.4 },
      uHaze: { value: 0.35 },
      uSpace: { value: 0 },
      uCityDirA: { value: new T.Vector3(0.42, 0.03, -0.9).normalize() },
      uCityDirB: { value: new T.Vector3(-0.5, 0.03, 0.86).normalize() },
      uCityI: { value: 0 },
    };
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: this.skyU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uSunDir,uCityDirA,uCityDirB; uniform float uDay,uCloud,uHaze,uSpace,uCityI;',
        'float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'void main(){',
        ' vec3 d=normalize(vDir); float h=d.y;',
        ' vec3 dayZen=vec3(0.16,0.38,0.72); vec3 dayHor=vec3(0.62,0.74,0.86);',
        ' vec3 nightZen=vec3(0.008,0.013,0.034); vec3 nightHor=vec3(0.040,0.058,0.105);',
        ' vec3 zen=mix(nightZen,dayZen,uDay); vec3 hor=mix(nightHor,dayHor,uDay);',
        ' vec3 col=mix(hor,zen,smoothstep(0.0,0.55,max(h,0.0)));',
        ' float sd=max(dot(d,uSunDir),0.0);',
        ' float sunLow=1.0-smoothstep(0.0,0.35,uSunDir.y);',
        ' col+=vec3(1.0,0.45,0.18)*pow(sd,4.0)*sunLow*(1.0-uSpace)*0.9;',
        ' col+=vec3(1.0,0.30,0.10)*pow(sd,1.6)*sunLow*max(0.0,0.25-h)*2.2*(1.0-uSpace);',
        ' col=mix(col,vec3(0.78,0.82,0.88)*max(uDay,0.15),uHaze*pow(1.0-clamp(h,0.0,1.0),3.0)*(1.0-uSpace));',
        ' col=mix(col,mix(col,vec3(0.55,0.6,0.66),0.55),uCloud*0.32*uDay);',
        ' /* CITY BOUNCE: extremely soft amber near the valley horizon */',
        ' float low=pow(clamp(1.0-h*6.0,0.0,1.0),2.0);',
        ' float ca=pow(max(dot(normalize(vec3(d.x,0.0,d.z)),uCityDirA),0.0),3.0);',
        ' float cb=pow(max(dot(normalize(vec3(d.x,0.0,d.z)),uCityDirB),0.0),3.0);',
        ' col+=vec3(0.62,0.42,0.20)*(ca*0.8+cb*0.55)*low*uCityI*(1.0-uSpace);',
        ' float disc=smoothstep(0.99930,0.99975,sd);',
        ' float halo=pow(sd,220.0)*0.55;',
        ' col+=vec3(1.0,0.93,0.78)*(disc*3.2+halo)*max(uDay,0.06)*(1.0-uCloud*0.85);',
        ' col=mix(col,vec3(0.003,0.005,0.011),uSpace);',
        ' col+=(h21(gl_FragCoord.xy)-0.5)*0.0045;',
        ' gl_FragColor=vec4(col,1.0);',
        '}',
      ].join('\n'),
    });
    this.skyMesh = new T.Mesh(geo, mat);
    this.skyMesh.renderOrder = -10;
    this.scene.add(this.skyMesh);
  }

  /* Real sky system: everything astronomically anchored lives in skyRot and is
     rotated rigidly by equatorialToWorldMatrix every astro tick (spec §13/17/18). */
  _buildSkySystem() {
    const pre = this._preset();
    this.skyRot = new T.Group();
    this.skyRot.renderOrder = -9;
    this.scene.add(this.skyRot);
    this._skyQTarget = new T.Quaternion();

    const mkStarMat = (baseSize, uniforms) => new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, vertexColors: true,
      uniforms,
      vertexShader: [
        'attribute float aSize; attribute float aTw; varying vec3 vC; varying float vA;',
        'uniform float uTime;',
        'void main(){ vC=color;',
        ' vA=0.72+0.28*sin(uTime*1.6+aTw);',
        ' vec4 mv=modelViewMatrix*vec4(position,1.0);',
        ' gl_PointSize=aSize*(' + baseSize.toFixed(1) + '/max(1.0,-mv.z));',
        ' gl_Position=projectionMatrix*mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uVis; varying vec3 vC; varying float vA;',
        'void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.06,length(q))*uVis*vA;',
        ' gl_FragColor=vec4(vC,a); if(a<0.012) discard; }',
      ].join('\n'),
    });

    /* CATALOG STARS — real RA/Dec/mag/colour */
    const cat = CEL.buildCatalogStars();
    const cg = new T.BufferGeometry();
    const cpos = new Float32Array(cat.n * 3);
    for (let i = 0; i < cat.n * 3; i++) cpos[i] = cat.pos[i] * 8500;
    cg.setAttribute('position', new T.BufferAttribute(cpos, 3));
    cg.setAttribute('color', new T.BufferAttribute(cat.col, 3));
    cg.setAttribute('aSize', new T.BufferAttribute(cat.siz, 1));
    const ctw = new Float32Array(cat.n);
    for (let i = 0; i < cat.n; i++) ctw[i] = rand(0, TAU);
    cg.setAttribute('aTw', new T.BufferAttribute(ctw, 1));
    cg.boundingSphere = new T.Sphere(new T.Vector3(), 20000);
    this.catU = { uVis: { value: 0 }, uTime: { value: 0 } };
    this.catalogStars = new T.Points(cg, mkStarMat(1750, this.catU));
    this.catalogStars.frustumCulled = false;
    this.skyRot.add(this.catalogStars);

    /* MILKY WAY — points + soft glow, sampled in real galactic coordinates */
    const mw = CEL.buildMilkyWay(pre.mwS, pre.mwG);
    const mg = new T.BufferGeometry();
    const mpos = new Float32Array(mw.nStars * 3);
    for (let i = 0; i < mw.nStars * 3; i++) mpos[i] = mw.starPos[i] * 8600;
    mg.setAttribute('position', new T.BufferAttribute(mpos, 3));
    mg.setAttribute('color', new T.BufferAttribute(mw.starCol, 3));
    mg.setAttribute('aSize', new T.BufferAttribute(mw.starSize, 1));
    const mtw = new Float32Array(mw.nStars);
    for (let i = 0; i < mw.nStars; i++) mtw[i] = rand(0, TAU);
    mg.setAttribute('aTw', new T.BufferAttribute(mtw, 1));
    mg.boundingSphere = new T.Sphere(new T.Vector3(), 20000);
    this.mwU = { uVis: { value: 0 }, uTime: { value: 0 } };
    this.mwStars = new T.Points(mg, mkStarMat(1500, this.mwU));
    this.mwStars.frustumCulled = false;
    this.skyRot.add(this.mwStars);

    const gg = new T.BufferGeometry();
    const gpos = new Float32Array(mw.nGlow * 3);
    for (let i = 0; i < mw.nGlow * 3; i++) gpos[i] = mw.glowPos[i] * 8650;
    gg.setAttribute('position', new T.BufferAttribute(gpos, 3));
    gg.setAttribute('color', new T.BufferAttribute(mw.glowCol, 3));
    gg.setAttribute('aSize', new T.BufferAttribute(mw.glowSize, 1));
    gg.boundingSphere = new T.Sphere(new T.Vector3(), 20000);
    this.mwGlowU = { uVis: { value: 0 } };
    this.mwGlow = new T.Points(gg, new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, vertexColors: true,
      uniforms: Object.assign({ uTex: { value: this.texSoft } }, this.mwGlowU),
      vertexShader: [
        'attribute float aSize; varying vec3 vC;',
        'void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);',
        ' gl_PointSize=aSize*(2000.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uTex; uniform float uVis; varying vec3 vC;',
        'void main(){ float a=texture2D(uTex,gl_PointCoord).a*uVis*0.052;',
        ' gl_FragColor=vec4(vC,a); if(a<0.004) discard; }',
      ].join('\n'),
    }));
    this.mwGlow.frustumCulled = false;
    this.skyRot.add(this.mwGlow);

    /* PROCEDURAL FAINT STARS — density layer, random equatorial directions so
       the whole sky still rotates as one body */
    const N = pre.faint;
    const fpos = new Float32Array(N * 3), fcol = new Float32Array(N * 3), fsz = new Float32Array(N), ftw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = new T.Vector3().randomDirection().multiplyScalar(8550);
      fpos[i * 3] = v.x; fpos[i * 3 + 1] = v.y; fpos[i * 3 + 2] = v.z;
      const c = CEL.starColor(rand(3400, 9800));
      const dim = rand(0.5, 0.9);
      fcol[i * 3] = c[0] * dim; fcol[i * 3 + 1] = c[1] * dim; fcol[i * 3 + 2] = c[2] * dim;
      fsz[i] = rand(0.55, 1.5);
      ftw[i] = rand(0, TAU);
    }
    const fg = new T.BufferGeometry();
    fg.setAttribute('position', new T.BufferAttribute(fpos, 3));
    fg.setAttribute('color', new T.BufferAttribute(fcol, 3));
    fg.setAttribute('aSize', new T.BufferAttribute(fsz, 1));
    fg.setAttribute('aTw', new T.BufferAttribute(ftw, 1));
    fg.boundingSphere = new T.Sphere(new T.Vector3(), 20000);
    this.faintU = { uVis: { value: 0 }, uTime: { value: 0 } };
    this.faintStars = new T.Points(fg, mkStarMat(1350, this.faintU));
    this.faintStars.frustumCulled = false;
    this.skyRot.add(this.faintStars);
    /* legacy alias kept for hub logic */
    this.starU = this.faintU;

    /* MOON — textured disc, real phase terminator, halo only near horizon */
    this.moonTexCv = CEL.makeMoonTexture(512);
    const moonTex = new T.CanvasTexture(this.moonTexCv);
    moonTex.colorSpace = T.SRGBColorSpace;
    this.moonTex = moonTex;
    this.moonU = {
      uMap: { value: moonTex },
      uSunDir: { value: new T.Vector3(1, 0, 0) },
      uDim: { value: 1 },
    };
    const moonMat = new T.ShaderMaterial({
      fog: false, depthWrite: false,
      uniforms: this.moonU,
      vertexShader: [
        'varying vec2 vUv; varying vec3 vN;',
        'void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal);',
        ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap; uniform vec3 uSunDir; uniform float uDim;',
        'varying vec2 vUv; varying vec3 vN;',
        'void main(){',
        ' vec3 alb=texture2D(uMap,vUv).rgb;',
        ' float d=dot(normalize(vN),normalize(uSunDir));',
        ' float lit=smoothstep(-0.06,0.10,d);',
        ' float terr=smoothstep(-0.02,0.14,d)-smoothstep(0.14,0.55,d);',
        ' vec3 col=alb*(0.012+lit*1.05);',
        ' col*=mix(1.0,0.92,terr*0.5);',
        ' col*=uDim;',
        ' gl_FragColor=vec4(col,1.0);',
        '}',
      ].join('\n'),
    });
    this.moonMesh = new T.Mesh(new T.SphereGeometry(39, 36, 24), moonMat);
    this.moonMesh.renderOrder = -8;
    this.moonMesh.visible = false;
    this.moonHalo = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: 0xcfe0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    this.moonHalo.scale.setScalar(260);
    this.moonHalo.renderOrder = -8;
    this.scene.add(this.moonMesh, this.moonHalo);
    this._moonDirS = new T.Vector3(0, -1, 0);

    /* occasional atmospheric meteor (only in the terrestrial scene; never
       called a shooting star in the hub — spec §61) */
    const mgm = new T.BufferGeometry();
    mgm.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
    this.meteor = new T.Line(mgm, new T.LineBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    this.meteor.frustumCulled = false;
    this.meteor.renderOrder = -8;
    this.scene.add(this.meteor);
    this._meteorLife = 0;
  }

  _buildIntroFX() {
    const N = 900;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = new T.Vector3().randomDirection().multiplyScalar(rand(2, 60));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      seed[i] = Math.random();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    geo.boundingSphere = new T.Sphere(new T.Vector3(), 500);
    this.introU = { uT: { value: 0 }, uMode: { value: 0 }, uDim: { value: 1 } };
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: this.introU,
      vertexShader: [
        'attribute float aSeed; varying float vS;',
        'uniform float uT,uMode;',
        'void main(){',
        ' vS=aSeed;',
        ' vec3 p=position;',
        ' if(uMode<0.5){ p*=mix(1.0,0.01,pow(uT,1.6)); }',
        ' else { vec3 dir=normalize(position+vec3(0.0001)); float sp=mix(40.0,320.0,aSeed); p=dir*(0.2+uT*sp); }',
        ' vec4 mv=modelViewMatrix*vec4(p,1.0);',
        ' float s=(uMode<0.5)? mix(2.4,0.6,uT) : mix(3.4,0.7,uT);',
        ' gl_PointSize=s*(320.0/max(1.0,-mv.z));',
        ' gl_Position=projectionMatrix*mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying float vS; uniform float uT,uMode,uDim;',
        'void main(){',
        ' vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.08,length(q))*uDim;',
        ' vec3 c=mix(vec3(0.55,0.85,1.0),vec3(0.85,0.6,1.0),vS);',
        ' float fade=(uMode<0.5)?1.0:(1.0-uT);',
        ' gl_FragColor=vec4(c,a*fade);',
        ' if(gl_FragColor.a<0.01) discard;',
        '}',
      ].join('\n'),
    });
    this.introPts = new T.Points(geo, mat);
    this.introPts.frustumCulled = false;
    this.introPts.position.set(0, 24, 0);
    this.gIntro.add(this.introPts);
    this.dot = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xcfefff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.dot.scale.setScalar(1.4);
    this.dot.position.set(0, 24, 0);
    this.ring = new T.Mesh(new T.RingGeometry(0.96, 1, 64), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    this.ring.position.set(0, 24, 0);
    this.gIntro.add(this.dot, this.ring);
  }

  /* PMREM environments per phase (spec §10): a night set for the facility,
     a completely different space set for orbit, a cyan/violet set for the hub.
     Built from tiny synthetic scenes — no external HDRIs, works offline. */
  _buildEnvironments() {
    try {
      const pm = new T.PMREMGenerator(this.renderer);
      const mkEnv = (zenith, horizon, panels) => {
        const sc = new T.Scene();
        const sph = new T.Mesh(
          new T.SphereGeometry(50, 24, 14),
          new T.ShaderMaterial({
            side: T.BackSide,
            uniforms: { uA: { value: new T.Color(zenith) }, uB: { value: new T.Color(horizon) } },
            vertexShader: 'varying float vH; void main(){ vH=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 uA,uB; varying float vH; void main(){ gl_FragColor=vec4(mix(uB,uA,smoothstep(-0.4,0.8,vH)),1.0); }',
          })
        );
        sc.add(sph);
        panels.forEach(([color, x, y, z, s, i]) => {
          const p = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
          p.position.set(x, y, z);
          p.lookAt(0, 0, 0);
          p.material.color.multiplyScalar(i);
          sc.add(p);
        });
        const env = pm.fromScene(sc, 0.06).texture;
        sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        return env;
      };
      this.envNight = mkEnv(0x060b1c, 0x0d1626, [
        [0x9fd8ff, -18, 8, -12, 10, 2.2],   /* cyan flood */
        [0xfff2df, 14, 12, 6, 8, 2.6],      /* technical white */
        [0xffb56a, 4, 3, 18, 9, 1.6],       /* amber industrial */
        [0x28406e, 0, 26, 0, 26, 0.7],      /* sky bounce */
      ]);
      this.envSpace = mkEnv(0x000104, 0x000104, [
        [0xfff4e0, 30, 18, -8, 10, 6.0],    /* raw sunlight */
        [0x2e6bd6, 0, -26, 0, 34, 1.6],     /* Earth bounce from below */
        [0x0a1a33, 0, 24, 0, 30, 0.4],
      ]);
      this.envHub = mkEnv(0x02030a, 0x040614, [
        [0x35d6ff, -22, 6, -16, 12, 2.0],
        [0x9b6bff, 4, -4, -26, 16, 2.4],
        [0xf2d9a4, 22, 2, -14, 10, 1.4],
      ]);
      pm.dispose();
      this.scene.environment = this.envNight;
      this._envPhase = 'night';
    } catch (e) {
      this.envNight = this.envSpace = this.envHub = null;
    }
  }
  _setEnv(phase) {
    if (this._envPhase === phase) return;
    this._envPhase = phase;
    const env = phase === 'space' ? this.envSpace : phase === 'hub' ? this.envHub : this.envNight;
    if (env) this.scene.environment = env;
  }

  /* ============================ FACILITY BUILD =========================== */
  /* V3 §2/§51: extra hero geometry only where it pays off */
  _heroSwap(slot, host, keep) {
    if (!host || this.safeMode || this._heroTried[slot]) return;
    this._heroTried[slot] = true;
    if (typeof fetch !== 'function') return;         /* harness/offline */
    try {
      if (!this._assets) this._assets = createAssetPipeline(T, { buildId: this.buildId });
      this._assets.load(slot).then((grp) => {
        if (!grp || !host.parent) return;
        const keepSet = new Set((keep || []).filter(Boolean));
        for (const c of host.children.slice()) if (!keepSet.has(c)) host.remove(c);
        host.add(grp);
        this.ui.sgos && this.ui.sgos('SG.OS // HERO ASSET ONLINE — ' + slot.toUpperCase());
      }).catch(() => {});
    } catch (e) { /* pipeline optional by contract */ }
  }
  /* -------- SG MISSION 001: single-objective driver (§10) -------- */
  /* V3.3: authoritative Earth framing. The camera KNOWS the sphere.
     _limbAngle: elevation (rad) of the near limb as seen from `pos`.
     _pitchForLimb: pitch that places that limb at screen fraction `frac`
     (0 = bottom edge) for a given VERTICAL fov — aspect-independent, so the
     composition holds on 16:9, ultrawide and mobile alike. */
  _limbAngle(pos) {
    const C = this.earthCenter, R = this.earthR || 1400;
    const dx = C.x - pos.x, dy = C.y - pos.y, dz = C.z - pos.z;
    const d = Math.max(R + 1, Math.hypot(dx, dy, dz));
    const el = Math.asin(dy / d);            /* centre elevation (negative) */
    return el + Math.asin(R / d);            /* + cone half-angle = limb */
  }
  _pitchForLimb(pos, fovDeg, frac) {
    const fov = fovDeg * Math.PI / 180;
    const limb = this._limbAngle(pos);
    return clamp(limb + fov * (0.5 - frac), -1.25, 0.6);
  }
  _earthAngRadius(pos) {
    const C = this.earthCenter, R = this.earthR || 1400;
    const d = Math.max(R + 1, Math.hypot(C.x - pos.x, C.y - pos.y, C.z - pos.z));
    return Math.asin(R / d);
  }
  /* frameSphere (V3.4 §26): camera position + orientation that shows the
     sphere at `coverage` (0..1 of the vertical frame), looking from direction
     `dir` at the centre. Aspect-independent (vertical FOV maths). */
  frameSphere(center, radius, coverage, dir, fovDeg) {
    const fov = (fovDeg || this.cam.fov) * Math.PI / 180;
    const halfAng = Math.min(1.5, fov * 0.5 * clamp(coverage, 0.05, 1));
    const d = radius / Math.sin(halfAng);
    const n = (dir || new T.Vector3(0, 0.35, 1)).clone().normalize();
    return { pos: center.clone().add(n.multiplyScalar(d)), look: center.clone(), fov: fovDeg || this.cam.fov };
  }
  /* EARTH SCREEN COVERAGE (V3.4 §27): fraction of the vertical frame that the
     Earth disc actually occupies right now — the QA number, not a guess. */
  _earthScreenCoverage() {
    if (!this.earth || !this.gSpace.visible) return 0;
    const pos = this.cam.position, C = this.earthCenter;
    const fov = this.cam.fov * Math.PI / 180;
    const fwd = this.cam.getWorldDirection(this._tmpV3 || (this._tmpV3 = new T.Vector3()));
    const to = this._tmpV.set(C.x - pos.x, C.y - pos.y, C.z - pos.z);
    const d = to.length() || 1;
    const a = Math.asin(Math.min(1, (this.earthR || 1400) / d));   /* angular radius */
    const off = fwd.angleTo(to.normalize());                        /* centre offset  */
    /* disc spans [off−a, off+a] from the view axis; frame spans ±fov/2 */
    const span = Math.min(off + a, fov / 2) - Math.max(off - a, -fov / 2);
    return clamp(span / fov, 0, 1);
  }
  startSunrise() {
    if (!this.earth) return;
    this._sunriseDone = true;
    /* sun starts behind the planet as seen from the rigs, ends on the hero key */
    this._sunriseFrom = new T.Vector3(-0.18, -0.30, -0.94).normalize();
    this._sunriseTo = new T.Vector3(0.46, 0.60, 0.66).normalize();
    this._heroOrient = true;
    if (!this._heroQ) this._orientEarthHero();
    this._sunriseT = 0.0001;
    this.ui.sgos('SG.OS // ORBITAL SUNRISE');
  }
  _atPass(tag) {
    if (!this._autotest) return;
    this._atSeen = this._atSeen || {};
    if (this._atSeen[tag]) return;
    this._atSeen[tag] = 1;
    console.log('[SG TEST] ' + tag + ' PASS');
  }
  _obj(key) {
    this._objKey = key;
    this.ui.setObjective(t(key));
  }
  _objDone(doneKey) {
    this._objKey = null;
    this.ui.completeObjective(doneKey ? t(doneKey) : null);
  }
  _sg01Contact() {
    if (!this._sg01 || this.save.sg01Contacted) return;
    const first = SAVE.markSg01Contacted();
    this.save = SAVE.loadSave();
    if (!first) return;
    this._sg01State = 'GUIDE';
    this.audio.radioBlip();
    this.ui.sgos('SG.OS // ' + t('sg01_online'));
    if (this._objKey === 'obj_contact') {
      this._objDone();
      setTimeout(() => { if (this.chapter === 'facility') this._obj('obj_prepare'); }, 1700);
    }
  }
  _sg01React() {                    /* SCAN state on important discoveries §8/§22 */
    if (!this._sg01) return;
    this._sg01State = 'SCAN';
    this._sg01.userData.reactT = 1.2;
  }
  _secretFound(id, msgKey) {
    const n = SAVE.addSecret(id);
    this.save = SAVE.loadSave();
    this.ui.sgos('SG.OS // ' + t(msgKey));
    this._sg01React();
    if (n >= 3 && !this.save.classifiedUnlocked) {
      SAVE.unlockClassified();
      this.save = SAVE.loadSave();
      setTimeout(() => {
        this.ui.banner(t('classified_granted'), 2400);
        this.ui.sgos('SG.OS // ' + t('classified_body'));
        this.audio.discoveryChime();
      }, 900);
    }
  }
  _detailHero() { return !this.safeMode && (this._tier() === 'high' || this._tier() === 'ultra'); }
  _q(name, fn, critical) { this.buildQueue.push({ name, fn, critical: !!critical }); }
  /* run one queued task with timing + failure isolation (spec P0 §4/§10):
     a cosmetic build error may never block Mission State. */
  _runTask(task) {
    const t0 = performance.now();
    let status = 'SUCCESS';
    try { task.fn(); }
    catch (e) {
      status = task.critical ? 'FAILED_FATAL' : 'FAILED_RECOVERABLE';
      console.error('[SG BUILD ' + status + ']', task.name, e);
      if (task.critical) {
        this._criticalFail = this._criticalFail || {};
        this._criticalFail[task.name] = e;
      }
    }
    const ms = performance.now() - t0;
    if (ms > 100) console.error('[SG BUILD] LONG TASK DETECTED', task.name, Math.round(ms) + 'ms');
    else if (ms > 30) console.warn('[SG BUILD]', task.name, Math.round(ms) + 'ms');
    if (this.debugOn || this._autotest) this._buildLog.push(task.name + ':' + Math.round(ms) + 'ms');
  }
  _drain(until) {
    while (this.buildQueue.length && !until()) this._runTask(this.buildQueue.shift());
  }
  queueFacility() {
    if (this._facilityQueued) return;
    this._facilityQueued = true;
    this._q('terrain', () => this._bTerrain(), true);
    this._q('pad', () => this._bPad(), true);
    this._q('rocket', () => this._bRocket(), true);
    this._q('tower', () => this._bTower());
    this._q('props', () => this._bGroundProps());
    this._q('sg01', () => this._bSG01());
    this._q('opsCabin', () => this._bOpsCabin());
    this._q('crew', () => this._bCrew());
    this._q('cloudsRain', () => this._bCloudsRain());
    this._q('city', () => this._bCity());
    this._q('facilityReady', () => {
      this._facilityMinimum();
      this.builtFacility = true;
      /* V3 §50 streaming: hero models (if present in assets/models/) come in
         behind the procedural versions — swap keeps functional refs */
      this._heroSwap('rocket', this.rocket, [this.nozzleGlow, this.frostBand, this.fairL, this.fairR]);
      this._heroSwap('tower', this.tower, []);
    });
  }
  /* FACILITY MINIMUM CONTRACT (P0.1 §17): terrain + pad + rocket + camera +
     light + UI. If a critical builder failed, a simplified stand-in is built
     so the chapter machine keeps its promises. Everything else is optional. */
  _facilityMinimum() {
    if (typeof this.terrainH !== 'function') {
      console.warn('[SG FALLBACK] terrain → flat plane');
      this.terrainH = () => 0;
      const flat = new T.Mesh(new T.PlaneGeometry(4000, 4000), this._mStd(0x131a17, 0.95, 0));
      flat.rotation.x = -Math.PI / 2;
      this.gSurface.add(flat);
    }
    if (this.rocketBaseY == null) {
      console.warn('[SG FALLBACK] pad → simple apron');
      this.rocketBaseY = 3.2;
      const apron = new T.Mesh(new T.CircleGeometry(90, 40), this._mStd(0x2b3138, 0.95, 0));
      apron.rotation.x = -Math.PI / 2;
      apron.position.y = 0.02;
      this.gSurface.add(apron);
    }
    if (!this.rocket) {
      console.warn('[SG FALLBACK] rocket → simplified vehicle');
      const g = new T.Group();
      const m = this._mStd(0xd9dee4, 0.5, 0.4);
      const body = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 46, 18), m);
      body.position.y = 23;
      const nose = new T.Mesh(new T.ConeGeometry(3.4, 8, 18), m);
      nose.position.y = 50;
      g.add(body, nose);
      g.position.y = this.rocketBaseY;
      this.rocket = g;
      this.gSurface.add(g);
    }
  }
  _mStd(color, rough, metal, extra) {
    return new T.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0 }, extra || {}));
  }
  _contact(parent, x, y, z, r, op) {
    const m = new T.Mesh(
      new T.CircleGeometry(r, 20),
      new T.MeshBasicMaterial({ map: this.texContact, color: 0x000000, transparent: true, opacity: op == null ? 0.4 : op, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    parent.add(m);
    return m;
  }
  terrainH(x, z) {
    const r = Math.hypot(x, z);
    const flat = sstep(240, 820, r);
    let h = Math.pow(fbm2(x * 0.0009 + 3.7, z * 0.0009 - 1.2), 1.5) * 250;
    h += Math.abs(fbm2(x * 0.0017 + 9, z * 0.0017 - 4) - 0.5) * 160;
    const bowl = sstep(700, 3800, r);
    h += bowl * bowl * (720 + 320 * fbm2(x * 0.0004, z * 0.0004));
    return h * flat;
  }
  _bTerrain() {
    const seg = this._tierN({ ultra: 230, high: 200, perf: 150, mobile: 118 });
    const size = 9000;
    const geo = new T.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new T.Color(0x21402a), cMid = new T.Color(0x40503a), cRock = new T.Color(0x5b6266);
    /* aerial perspective baked into the far ridge colour so distant mountains
       lose contrast and lift toward the sky (spec §5/§22) */
    const cFar = new T.Color(0x5d7292);
    const c = new T.Color();
    const cDirt = new T.Color(0x4a4034), cErod = new T.Color(0x6a5c48);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.terrainH(x, z);
      pos.setY(i, h);
      const r = Math.hypot(x, z);
      const n = fbm2(x * 0.004, z * 0.004);
      const micro = fbm2(x * 0.03 + 7.7, z * 0.03);      /* V3 §7: breakup */
      c.copy(cLow).lerp(cMid, sstep(40, 260, h) + n * 0.25);
      c.lerp(cRock, sstep(420, 900, h));
      /* erosion gullies on mid slopes + dry dirt patches near the valley floor */
      const gully = Math.max(0, Math.sin(x * 0.012 + n * 6) * Math.sin(z * 0.011)) * sstep(120, 520, h) * (1 - sstep(700, 1200, h));
      c.lerp(cErod, gully * 0.45);
      c.lerp(cDirt, (1 - sstep(30, 160, h)) * sstep(0.55, 0.9, micro) * 0.5);
      /* worn service track from the ops-cabin road out toward the perimeter */
      const tx = x + 16, tz = z - 30;
      const along = tx * Math.sin(-0.47) + tz * -Math.cos(-0.47);
      const across = Math.abs(tx * Math.cos(-0.47) + tz * Math.sin(-0.47));
      if (r > 118 && r < 700 && across < 7 && along > 0) c.lerp(cDirt, 0.55);
      c.multiplyScalar(0.92 + micro * 0.16);
      c.lerp(cFar, sstep(1900, 4200, r) * 0.85);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 });
    this.terrain = new T.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.gSurface.add(this.terrain);
    /* V3.4 §72/§73 VALLEY DEPTH: two far silhouette ridges beyond the terrain
       tile — noise-displaced crests, progressively bluer and lower-contrast,
       so the valley reads near → mid → far instead of a green wall. */
    const mkRidge = (r, hMin, hMax, color, fogged) => {
      const segs = 90;
      const pos2 = new Float32Array((segs + 1) * 2 * 3);
      const idx = [];
      for (let s2 = 0; s2 <= segs; s2++) {
        const a = s2 / segs * TAU;
        const hh = hMin + Math.pow(fbm2(Math.cos(a) * 3.1 + r * 0.001, Math.sin(a) * 3.1), 1.4) * (hMax - hMin);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        pos2[s2 * 6] = x; pos2[s2 * 6 + 1] = -60; pos2[s2 * 6 + 2] = z;
        pos2[s2 * 6 + 3] = x; pos2[s2 * 6 + 4] = hh; pos2[s2 * 6 + 5] = z;
        if (s2 < segs) {
          const b0 = s2 * 2;
          idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
        }
      }
      const rg = new T.BufferGeometry();
      rg.setAttribute('position', new T.BufferAttribute(pos2, 3));
      rg.setIndex(idx);
      rg.computeVertexNormals();
      const rm = new T.MeshBasicMaterial({ color, side: T.BackSide, fog: fogged });
      const mesh = new T.Mesh(rg, rm);
      mesh.renderOrder = -6;
      this.gSurface.add(mesh);
      return mesh;
    };
    this.ridgeMid = mkRidge(5200, 380, 1150, 0x2c3f52, true);
    this.ridgeFar = mkRidge(7000, 520, 1500, 0x39506b, true);
  }
  _bPad() {
    const g = this.gSurface;
    this.matAsphalt = this._mStd(0x2b3138, 0.95, 0, { envMapIntensity: 0.4 });
    this.matConcrete = this._mStd(0x9aa0a6, 0.9, 0, { envMapIntensity: 0.45 });
    /* V3 §6: the apron shrinks and dissolves into slabs/soil at its edge —
       an installation built into the valley, not a disc laid on top */
    const apron = new T.Mesh(new T.CircleGeometry(78, 48), this.matAsphalt);
    apron.rotation.x = -Math.PI / 2; apron.position.y = 0.05; apron.receiveShadow = true;
    const mSlabEdge = this._mStd(0x2e343b, 0.95, 0, { envMapIntensity: 0.3 });   /* V3.4: near-apron tone, no dark patches by day */
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU + 0.12;
      const rr = 82 + (i % 3) * 7;
      const sl = new T.Mesh(new T.BoxGeometry(16 + (i % 4) * 5, 0.22, 10 + (i % 3) * 4), i % 2 ? this.matAsphalt : mSlabEdge);
      sl.position.set(Math.cos(a) * rr, 0.03 + (i % 2) * 0.015, Math.sin(a) * rr);
      sl.rotation.y = a + rand(-0.2, 0.2);
      sl.receiveShadow = true;
      g.add(sl);
    }
    /* drainage channel from the flame trench toward the low side */
    const drain = new T.Mesh(new T.BoxGeometry(2.2, 0.14, 64), new T.MeshStandardMaterial({ color: 0x11151a, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.8 }));
    drain.position.set(34, 0.06, 26);
    drain.rotation.y = 0.5;
    g.add(drain);
    for (let i = 0; i < 6; i++) {
      const grate = new T.Mesh(new T.BoxGeometry(2.4, 0.05, 1.2), this._mStd(0x2c333c, 0.5, 0.6));
      grate.position.set(34 + Math.sin(0.5) * (i * 10 - 25) * 0 + Math.cos(0.5 + Math.PI / 2) * 0, 0.14, 0);
      grate.position.set(34 - Math.sin(0.5) * (i * 10 - 25), 0.14, 26 + Math.cos(0.5) * (i * 10 - 25));
      grate.rotation.y = 0.5;
      g.add(grate);
    }
    /* V3.2 §15: thermal scorch fanning out of the trench + deluge manifold */
    const scorch = new T.Mesh(new T.CircleGeometry(15, 26), new T.MeshBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.55, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(24, 0.07, 0);
    scorch.scale.set(1.6, 1, 0.9);
    g.add(scorch);
    const mMani = this._mStd(0x5a646d, 0.55, 0.55);
    for (const mz of [-11, 11]) {
      const pipe = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 9, 8), mMani);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-13, 0.5, mz);
      g.add(pipe);
      for (let nx = 0; nx < 3; nx++) {
        const noz = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 0.5, 6), mMani);
        noz.position.set(-16 + nx * 3, 0.85, mz);
        noz.rotation.x = mz > 0 ? -0.5 : 0.5;
        g.add(noz);
      }
    }
    /* access stairs + handrail up onto the slab (V3 §6/§8 human scale) */
    const mStair = this._mStd(0x6f7c86, 0.7, 0.4);
    for (let st = 0; st < 3; st++) {
      const step = new T.Mesh(new T.BoxGeometry(4.4, 0.34, 1.2), mStair);
      step.position.set(-24, 0.3 + st * 0.62, -6 + st * 1.05);
      step.castShadow = true;
      g.add(step);
    }
    const mRailP = this._mStd(0xd8dde2, 0.5, 0.5);
    for (const rx of [-26.1, -21.9]) {
      const rail = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 3.6, 6), mRailP);
      rail.rotation.x = -0.55;
      rail.position.set(rx, 1.5, -4.6);
      g.add(rail);
      for (let pi = 0; pi < 3; pi++) {
        const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1.0, 6), mRailP);
        post.position.set(rx, 0.75 + pi * 0.6, -6 + pi * 1.05);
        g.add(post);
      }
    }
    /* equipment cases staged by the stairs */
    for (let ci = 0; ci < 2; ci++) {
      const cs = new T.Mesh(new T.BoxGeometry(1.5, 0.7, 0.9), this._mStd(0x243038, 0.7, 0.3));
      cs.position.set(-27 - ci * 1.9, 0.35, -8.4 + ci * 0.7);
      cs.rotation.y = rand(-0.3, 0.3);
      const latch = new T.Mesh(new T.BoxGeometry(0.5, 0.06, 0.06), new T.MeshBasicMaterial({ color: 0xe8a13a }));
      latch.position.set(cs.position.x, 0.72, cs.position.z + 0.46);
      g.add(cs, latch);
    }
    const slab = new T.Mesh(new T.BoxGeometry(48, 2, 48), this.matConcrete);
    slab.position.y = 1; slab.receiveShadow = true; slab.castShadow = true;
    const mark = new T.Mesh(new T.PlaneGeometry(42, 42), new T.MeshBasicMaterial({ map: padMarkingsTex(), transparent: true, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 2.03;
    const mount = new T.Mesh(new T.BoxGeometry(12, 3.2, 12), this._mStd(0x6f7c86, 0.6, 0.5));
    mount.position.y = 3.6; mount.castShadow = true;
    /* placard */
    const plCv = document.createElement('canvas'); plCv.width = 256; plCv.height = 128;
    const pg = plCv.getContext('2d');
    pg.fillStyle = '#101d30'; pg.fillRect(0, 0, 256, 128);
    pg.strokeStyle = '#35d6ff'; pg.lineWidth = 6; pg.strokeRect(6, 6, 244, 116);
    pg.fillStyle = '#eaf4ff'; pg.font = 'bold 34px monospace'; pg.textAlign = 'center';
    pg.fillText('SG-L1', 128, 52);
    pg.font = '20px monospace'; pg.fillText('FIRST LIGHT PAD', 128, 88);
    const plTx = new T.CanvasTexture(plCv); plTx.colorSpace = T.SRGBColorSpace;
    this.placard = new T.Mesh(new T.PlaneGeometry(5.4, 2.7), new T.MeshBasicMaterial({ map: plTx }));
    this.placard.position.set(0, 3.8, 6.06);
    /* flame trench + deflector */
    const trench = new T.Mesh(new T.BoxGeometry(9, 0.2, 30), new T.MeshBasicMaterial({ color: 0x05070a }));
    trench.position.set(9, 2.06, 0); trench.rotation.y = Math.PI / 2;
    const defl = new T.Mesh(new T.BoxGeometry(10, 1.6, 12), this._mStd(0x59636b, 0.7, 0.4));
    defl.position.set(19, 2.6, 0); defl.rotation.z = 0.7; defl.castShadow = true;
    this.deflector = defl;
    /* perimeter pad-edge lights: cool cyan emissive ring */
    this.edgeLights = [];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU;
      const el = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), new T.MeshBasicMaterial({ color: 0x74e4ff }));
      el.position.set(Math.cos(a) * 74, 0.6, Math.sin(a) * 74);
      this.edgeLights.push(el);
      g.add(el);
    }
    /* barriers with hazard stripes near the trench */
    const hz = hazardTex(); hz.repeat.set(3, 1);
    const barMat = new T.MeshBasicMaterial({ map: hz });
    for (let i = 0; i < 3; i++) {
      const bar = new T.Mesh(new T.BoxGeometry(5, 0.9, 0.16), barMat);
      bar.position.set(26 + i * 0.2, 1.2, -8 + i * 8);
      bar.rotation.y = Math.PI / 2;
      g.add(bar);
      const legA = new T.Mesh(new T.BoxGeometry(0.14, 1.2, 0.5), this._mStd(0x39424c, 0.7));
      legA.position.set(bar.position.x, 0.6, bar.position.z - 2.2);
      const legB = legA.clone(); legB.position.z = bar.position.z + 2.2;
      g.add(legA, legB);
    }
    g.add(apron, slab, mark, mount, this.placard, trench, defl);
    /* CONTACT SHADOWS — nothing floats (spec §4) */
    this._contact(g, 0, 0.07, 0, 34, 0.32);            /* slab footprint */
    this.rocketContact = this._contact(g, 0, 2.08, 0, 8.5, 0.55);
    this._contact(g, 19, 0.08, 0, 8, 0.35);            /* deflector */
    this.rocketBaseY = 5.4;
  }
  _bRocket() {
    const g = new T.Group();
    const hull = hullTex(); hull.repeat.set(3, 5);
    const rough = this.texRough; rough.repeat.set(3, 5);
    const mHull = new T.MeshStandardMaterial({ map: hull, roughnessMap: rough, roughness: 0.62, metalness: 0.38, envMapIntensity: 1.0 });
    const mDark = this._mStd(0x2c333c, 0.6, 0.4);
    const body = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 34, 28), mHull);
    body.position.y = 17; body.castShadow = true;
    const inter = new T.Mesh(new T.CylinderGeometry(3.42, 3.42, 1.4, 28), mDark);
    inter.position.y = 34.7;
    /* interstage hazard ring */
    const hzTex = hazardTex(); hzTex.repeat.set(10, 1);
    const hzRing = new T.Mesh(new T.CylinderGeometry(3.43, 3.43, 0.5, 28, 1, true), new T.MeshBasicMaterial({ map: hzTex }));
    hzRing.position.y = 35.6;
    const upper = new T.Mesh(new T.CylinderGeometry(3.1, 3.4, 8, 28), mHull);
    upper.position.y = 39.4; upper.castShadow = true;
    /* LOX frost band + condensation zone (subtle, new-but-operational) */
    this.frostBand = new T.Mesh(
      new T.CylinderGeometry(3.44, 3.44, 7, 28, 1, true),
      new T.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.45, metalness: 0.05, transparent: true, opacity: 0.26, depthWrite: false })
    );
    this.frostBand.position.y = 12;
    /* fairing halves */
    this.fairL = new T.Group(); this.fairR = new T.Group();
    const half = () => {
      const grp = new T.Group();
      const cyl = new T.Mesh(new T.CylinderGeometry(3.1, 3.1, 6, 28, 1, false, 0, Math.PI), mHull);
      const cone = new T.Mesh(new T.ConeGeometry(3.1, 5, 28, 1, false, 0, Math.PI), mHull);
      cone.position.y = 5.5;
      grp.add(cyl, cone);
      grp.children.forEach((m) => { m.castShadow = true; });
      return grp;
    };
    const hl = half(); this.fairL.add(hl);
    const hr = half(); hr.rotation.y = Math.PI; this.fairR.add(hr);
    this.fairL.position.y = 46.4; this.fairR.position.y = 46.4;
    /* engines */
    const eng = new T.Group();
    const nMat = this._mStd(0x3a4149, 0.32, 0.85, { envMapIntensity: 1.2 });
    const nz = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]];
    nz.forEach(([x, z]) => {
      const cone = new T.Mesh(new T.CylinderGeometry(0.55, 1.05, 2.2, 16, 1, true), nMat);
      cone.position.set(x * 0.9, -1.1, z * 0.9);
      eng.add(cone);
    });
    eng.position.y = 0.2;
    /* nozzle inner glow for ignition */
    this.nozzleGlow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xffdca0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.nozzleGlow.position.y = -1.6;
    this.nozzleGlow.scale.setScalar(7);
    /* decals: SG mark, serials, level text */
    const decal = new T.Mesh(new T.PlaneGeometry(6.4, 3.2), new T.MeshBasicMaterial({ map: sgDecalTex(), transparent: true }));
    decal.position.set(0, 22, 3.48);
    const serial = new T.Mesh(new T.PlaneGeometry(2.6, 1.0), new T.MeshBasicMaterial({ map: textTex(['SG-L1'], '#22303f', null, 128, 48, 30), transparent: true }));
    serial.position.set(0, 8.5, 3.47);
    const serial2 = serial.clone(); serial2.rotation.y = Math.PI; serial2.position.z = -3.47;
    g.add(body, inter, hzRing, upper, this.frostBand, this.fairL, this.fairR, eng, this.nozzleGlow, decal, serial, serial2);
    /* V3 §9 HERO DETAIL — feed lines, panels, fasteners, seams, thermal base.
       Additive group; PERF/SAFE keep the clean vehicle above (procedural
       fallback contract §2). */
    if (this._detailHero()) {
      const det = new T.Group();
      const mLine = this._mStd(0xb8c1c9, 0.5, 0.5, { envMapIntensity: 1.1 });
      const mBracket = this._mStd(0x39424c, 0.6, 0.5);
      /* twin external feed/raceway lines with standoff brackets */
      for (const a of [0.45, 2.05]) {
        const line = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 31, 8), mLine);
        line.position.set(Math.cos(a) * 3.52, 17.5, Math.sin(a) * 3.52);
        det.add(line);
        for (const by of [5, 13, 21, 29]) {
          const br = new T.Mesh(new T.BoxGeometry(0.26, 0.4, 0.18), mBracket);
          br.position.set(Math.cos(a) * 3.47, by, Math.sin(a) * 3.47);
          br.lookAt(0, by, 0);
          det.add(br);
        }
      }
      /* access panels (flush, tonal) + two amber-outlined service hatches */
      const mPanel = this._mStd(0xc4ccd4, 0.68, 0.34);
      const outline = new T.MeshBasicMaterial({ map: textTex(['◻'], '#e8a13a', null, 64, 64, 40), transparent: true, opacity: 0.85 });
      for (let i = 0; i < 6; i++) {
        const a = 0.9 + i * 0.86;
        const p = new T.Mesh(new T.BoxGeometry(1.1, 1.5, 0.04), mPanel);
        p.position.set(Math.cos(a) * 3.43, 10 + (i % 3) * 7.5, Math.sin(a) * 3.43);
        p.lookAt(0, p.position.y, 0);
        det.add(p);
        if (i < 2) {
          const o = new T.Mesh(new T.PlaneGeometry(1.3, 1.7), outline);
          o.position.set(Math.cos(a) * 3.46, p.position.y, Math.sin(a) * 3.46);
          o.lookAt(Math.cos(a) * 10, p.position.y, Math.sin(a) * 10);
          det.add(o);
        }
      }
      /* fastener rings at stage joints */
      for (const jy of [0.6, 33.9, 43.3]) {
        const ring = new T.Mesh(new T.TorusGeometry(3.45, 0.045, 6, 40), mBracket);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = jy;
        det.add(ring);
      }
      /* thermal/soot-protected base band */
      const mTherm = this._mStd(0x39404a, 0.82, 0.3);
      const therm = new T.Mesh(new T.CylinderGeometry(3.41, 3.46, 5.2, 28, 1, true), mTherm);
      therm.position.y = 2.8;
      det.add(therm);
      /* panel-seam bump texture on the hull (§13 normal-ish detail) */
      try {
        const sc = document.createElement('canvas'); sc.width = 256; sc.height = 256;
        const sg2 = sc.getContext('2d');
        sg2.fillStyle = '#808080'; sg2.fillRect(0, 0, 256, 256);
        sg2.strokeStyle = '#6a6a6a'; sg2.lineWidth = 2;
        for (let yy = 16; yy < 256; yy += 42) { sg2.beginPath(); sg2.moveTo(0, yy); sg2.lineTo(256, yy); sg2.stroke(); }
        sg2.strokeStyle = '#747474';
        for (let xx = 20; xx < 256; xx += 64) { sg2.beginPath(); sg2.moveTo(xx, 0); sg2.lineTo(xx, 256); sg2.stroke(); }
        sg2.fillStyle = '#8a8a8a';
        for (let i = 0; i < 60; i++) sg2.fillRect((Math.random() * 250) | 0, (Math.random() * 250) | 0, 2, 2);
        const bump = new T.CanvasTexture(sc);
        bump.wrapS = bump.wrapT = T.RepeatWrapping; bump.repeat.set(3, 5);
        mHull.bumpMap = bump; mHull.bumpScale = 0.03; mHull.needsUpdate = true;
      } catch (e) { /* seams optional */ }
      g.add(det);
    }
    g.position.y = this.rocketBaseY;
    this.rocket = g;
    this.nozzleY = this.rocketBaseY - 1.2;
    this.gSurface.add(g);
  }
  _bTower() {
    const g = new T.Group();
    const mT = this._mStd(0x7d868d, 0.55, 0.6, { envMapIntensity: 0.8 });
    const mT2 = this._mStd(0x6a747c, 0.6, 0.55);
    const mR = this._mStd(0xb8412e, 0.7, 0.3);
    const H = 60;
    const legPos = [];
    for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
      const lx = 13 + ix * 5, lz = -2.5 + iz * 5;
      const leg = new T.Mesh(new T.BoxGeometry(0.9, H, 0.9), mT);
      leg.position.set(lx, H / 2, lz);
      leg.castShadow = true;
      g.add(leg);
      legPos.push([lx, lz]);
      this._contact(this.gSurface, lx, 0.08, lz, 1.7, 0.4);
    }
    /* diagonal bracing between legs — real structural depth (spec §8) */
    const brace = (x1, z1, x2, z2, y) => {
      const dx = x2 - x1, dz = z2 - z1;
      const L = Math.hypot(dx, dz, 8);
      const b = new T.Mesh(new T.BoxGeometry(0.22, L, 0.22), mT);
      b.position.set((x1 + x2) / 2, y + 4, (z1 + z2) / 2);
      b.lookAt(x2, y + 8, z2);
      b.rotateX(Math.PI / 2);
      g.add(b);
    };
    for (let y = 0; y < H - 8; y += 8) {
      brace(13, -2.5, 18, 2.5, y);
      brace(18, -2.5, 13, 2.5, y);
      brace(13, -2.5, 13, 2.5, y + (y % 16 ? 0 : 0));
    }
    /* platforms + railings + level lamps + level numbers */
    this.towerLamps = [];
    let lvl = 1;
    for (let y = 8; y < H; y += 8) {
      const pf = new T.Mesh(new T.BoxGeometry(7, 0.5, 7), mT);
      pf.position.set(15.5, y, 0); pf.castShadow = true;
      g.add(pf);
      const rail = new T.Mesh(new T.BoxGeometry(7, 0.08, 0.08), this._mStd(0x9aa4ac, 0.5, 0.5));
      rail.position.set(15.5, y + 1.1, 3.5);
      const rail2 = rail.clone(); rail2.position.z = -3.5;
      const rail3 = new T.Mesh(new T.BoxGeometry(0.08, 0.08, 7), rail.material);
      rail3.position.set(19, y + 1.1, 0);
      g.add(rail, rail2, rail3);
      /* level lamp: emissive head + glow sprite (selective bloom feeds on these) */
      const lampHead = new T.Mesh(new T.BoxGeometry(0.36, 0.2, 0.36), new T.MeshBasicMaterial({ color: 0xdff2ff }));
      lampHead.position.set(12.4, y + 0.9, 3.2);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xaee6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      glow.position.copy(lampHead.position);
      glow.scale.setScalar(3.4);
      g.add(lampHead, glow);
      this.towerLamps.push({ head: lampHead, glow });
      const num = new T.Mesh(new T.PlaneGeometry(1.4, 0.8), new T.MeshBasicMaterial({ map: textTex(['L' + lvl], '#dff2ff', '#101d30', 64, 40, 22), transparent: false }));
      num.position.set(12.05, y + 3.4, 0);
      num.rotation.y = -Math.PI / 2;
      g.add(num);
      lvl++;
    }
    const cap = new T.Mesh(new T.BoxGeometry(7.6, 2, 7.6), mR);
    cap.position.set(15.5, H + 1, 0);
    /* ops window strip on the cap — warm interior light */
    this.capWindow = new T.Mesh(new T.PlaneGeometry(5.4, 0.9), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
    this.capWindow.position.set(15.5, H + 1, -3.82);
    this.capWindow.rotation.y = Math.PI;
    const mast = new T.Mesh(new T.CylinderGeometry(0.14, 0.24, 16, 8), mT);
    mast.position.set(15.5, H + 10, 0);
    /* vertical service pipes + cable run */
    const mPipe = this._mStd(0x505a63, 0.6, 0.5);
    for (const [px, pz] of [[12.7, -3.1], [12.7, 3.1]]) {
      const pipe = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, H, 8), mPipe);
      pipe.position.set(px, H / 2, pz);
      g.add(pipe);
    }
    const cablePts = [new T.Vector3(15.5, H + 8, 0), new T.Vector3(34, 22, 26), new T.Vector3(48, 6, 50)];
    const curve = new T.CatmullRomCurve3(cablePts);
    const cable = new T.Mesh(new T.TubeGeometry(curve, 24, 0.07, 5), this._mStd(0x1c2127, 0.8, 0.2));
    const curve2 = new T.CatmullRomCurve3([
      new T.Vector3(16, 30, 9),
      new T.Vector3(-6, 15, 34),
      new T.Vector3(-28, 5.2, 56),
    ]);
    const cable2 = new T.Mesh(new T.TubeGeometry(curve2, 24, 0.06, 5), this._mStd(0x1c2127, 0.8, 0.2));
    g.add(cable, cable2);
    /* umbilical arms */
    const mkArm = (y) => {
      const pv = new T.Group(); pv.position.set(12.6, y, 0);
      const arm = new T.Mesh(new T.BoxGeometry(9.6, 0.8, 1.4), mT);
      arm.position.x = -4.8; arm.castShadow = true;
      const tip = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 2), mR);
      tip.position.x = -9.4;
      const led = new T.Mesh(new T.SphereGeometry(0.14, 6, 5), new T.MeshBasicMaterial({ color: 0x66ff9a }));
      led.position.set(-9.4, 0.8, 0);
      pv.add(arm, tip, led);
      pv.userData.led = led;
      g.add(pv);
      return pv;
    };
    this.arm1 = mkArm(26); this.arm2 = mkArm(43);
    /* V3 §10: cable trays, pipe risers, extra platform, maintenance lamps,
       corner warning lights — density that still reads from camera. */
    if (this._detailHero()) {
      const det = new T.Group();
      const mTray = this._mStd(0x2a323b, 0.7, 0.4);
      for (const tz of [-2.4, 2.4]) {
        const tray = new T.Mesh(new T.BoxGeometry(0.5, H - 6, 0.16), mTray);
        tray.position.set(15.2, (H - 6) / 2 + 2, tz);
        det.add(tray);
        for (let ly = 8; ly < H - 4; ly += 9) {
          const rung = new T.Mesh(new T.BoxGeometry(0.54, 0.1, 0.3), mTray);
          rung.position.set(15.2, ly, tz);
          det.add(rung);
        }
      }
      const mRiser = this._mStd(0x8f9aa4, 0.45, 0.6);
      for (const [rx, rz] of [[10.4, -2.6], [10.4, 2.6], [14.9, 0]]) {
        const riser = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, H - 8, 8), mRiser);
        riser.position.set(rx, (H - 8) / 2 + 3, rz);
        det.add(riser);
      }
      /* extra service platform + simple railing */
      const plat = new T.Mesh(new T.BoxGeometry(6.4, 0.3, 6.4), this._mStd(0x39424c, 0.7, 0.4));
      plat.position.set(12.6, 34.5, 0);
      det.add(plat);
      const mRailD = this._mStd(0xbac3cb, 0.5, 0.5);
      for (const [px2, pz2] of [[-2.9, -2.9], [-2.9, 2.9], [2.9, -2.9], [2.9, 2.9]]) {
        const post2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.1, 6), mRailD);
        post2.position.set(12.6 + px2, 35.2, pz2);
        det.add(post2);
      }
      for (const side of [-1, 1]) {
        const bar = new T.Mesh(new T.BoxGeometry(5.8, 0.06, 0.06), mRailD);
        bar.position.set(12.6, 35.7, side * 2.9);
        det.add(bar);
      }
      /* maintenance lamp boxes + red corner warning lights */
      for (const ly of [16, 30, 44]) {
        const lamp = new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.3), new T.MeshBasicMaterial({ color: 0xffe9c9 }));
        lamp.position.set(10.2, ly, -3.1);
        det.add(lamp);
        const warn = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), new T.MeshBasicMaterial({ color: 0xff5044 }));
        warn.position.set(15.4, ly + 1.2, 3.1);
        det.add(warn);
      }
      g.add(det);
    }
    /* comms dish + slow whip antenna */
    this.dish = new T.Group();
    const dm = new T.Mesh(new T.SphereGeometry(1.7, 16, 10, 0, TAU, 0, Math.PI / 2), this._mStd(0xdde3e8, 0.4, 0.3));
    dm.rotation.x = Math.PI / 2.4;
    this.dish.add(dm);
    this.dish.position.set(15.5, H + 3.4, 3.2);
    /* beacons: red strobe + white anti-collision */
    this.towerBeacon = new T.Mesh(new T.SphereGeometry(0.36, 10, 8), new T.MeshBasicMaterial({ color: 0xff4040 }));
    this.towerBeacon.position.set(15.5, H + 18.2, 0);
    this.towerBeaconGlow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xff5a4a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.towerBeaconGlow.position.copy(this.towerBeacon.position);
    this.towerBeaconGlow.scale.setScalar(6);
    this.towerStrobe = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }));
    this.towerStrobe.position.set(15.5, H + 3.2, -3.9);
    /* mid-tower vent nozzle (small periodic venting) */
    this.towerVent = new T.Vector3(12.6, 34, -3.4);
    /* pad floods (kept as gentle fills; sunL doubles as INDUSTRIAL KEY) */
    this.padLightA = new T.PointLight(0xbfd8ff, 0, 260, 1.6); this.padLightA.position.set(15.5, 42, 8);
    this.padLightB = new T.PointLight(0xffd9a0, 0, 220, 1.6); this.padLightB.position.set(-30, 18, -30);
    g.add(cap, this.capWindow, mast, this.dish, this.towerBeacon, this.towerBeaconGlow, this.towerStrobe, this.padLightA, this.padLightB);
    this.tower = g;
    this.gSurface.add(g);
    void mT2; void legPos;
  }

  /* SG-01 — the mission guide: a small hovering unit, never in the way (§9).
     States: IDLE (bob) · GUIDE (LED points toward the next objective) ·
     SCAN (short reaction on important discoveries) · MISSION (contact). */
  _bSG01() {
    const g = new T.Group();
    const mBody = this._mStd(0xd7dde3, 0.4, 0.55, { envMapIntensity: 1.2 });
    const mDark = this._mStd(0x232b33, 0.6, 0.4);
    const core = new T.Mesh(new T.SphereGeometry(0.34, 14, 10), mBody);
    const belt = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 8, 22), mDark);
    belt.rotation.x = Math.PI / 2;
    const eye = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: 0x35d6ff }));
    eye.position.set(0, 0.05, -0.31);
    const fin = new T.Mesh(new T.BoxGeometry(0.06, 0.22, 0.16), mDark);
    fin.position.set(0, 0.36, 0.12);
    const thr = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0x74e4ff, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
    thr.scale.setScalar(0.5);
    thr.position.y = -0.42;
    g.add(core, belt, eye, fin, thr);
    g.position.set(-19, 2.1, 21);          /* by the crew path — off-axis (§9) */
    g.userData = { eye, thr, baseY: 2.1, reactT: 0, seed: Math.random() * TAU };
    this._sg01 = g;
    this.gSurface.add(g);
    /* scanner target — hotspots and scanner are ONE language (§21) */
    this.targets.push({
      id: 'sg01', kind: 'info', range: 220, scanTime: 1.4,
      getPos: () => this._sg01 ? this._sg01.getWorldPosition(new T.Vector3()) : null,
      valid: () => this.chapter === 'facility' && !this.save.sg01Contacted,
      label: () => t('sg01_label'),
    });
  }
  _reticleNearTarget() {
    const fwd = this.cam.getWorldDirection(this._tmpV3 || (this._tmpV3 = new T.Vector3()));
    for (const tg of this.targets) {
      try {
        if (tg.kind !== 'core' || !tg.valid()) continue;
        const p = tg.getPos();
        if (!p) continue;
        const to = p.clone().sub(this.cam.position);
        if (to.length() > (tg.range || 600)) continue;
        if (fwd.angleTo(to.normalize()) < 0.14) return true;
      } catch (e) { continue; }
    }
    return false;
  }
  _sg01Tick(dt) {
    const d = this._sg01;
    if (!d || this.chapter !== 'facility') return;
    const u = d.userData;
    u.seed += dt;
    d.position.y = u.baseY + Math.sin(u.seed * 1.6) * 0.12;
    u.thr.material.opacity = 0.28 + Math.sin(u.seed * 5) * 0.06;
    /* face the visitor's camera softly — a presence, not a mascot */
    const toCam = this._tmpV.set(this.cam.position.x - d.position.x, 0, this.cam.position.z - d.position.z);
    const ty = Math.atan2(toCam.x, toCam.z);
    d.rotation.y += (ty - d.rotation.y) * Math.min(1, dt * 2.2);
    if (u.reactT > 0) {                       /* SCAN reaction */
      u.reactT -= dt;
      d.rotation.y += dt * 9;
      u.eye.material.color.setHex((u.reactT * 10 | 0) % 2 ? 0xffffff : 0x35d6ff);
      if (u.reactT <= 0) { u.eye.material.color.setHex(0x35d6ff); this._sg01State = this.save.sg01Contacted ? 'GUIDE' : 'IDLE'; }
    } else if (this._sg01State === 'GUIDE') {
      /* LED pulse cadence points attention toward the pad / next objective */
      u.eye.material.color.setHex(Math.sin(u.seed * 3.2) > 0.4 ? 0x9ff0ff : 0x35d6ff);
    }
    /* CONTACT without the scanner: close + looked-at for ~1.5 s (§12) */
    if (!this.save.sg01Contacted) {
      const dp = d.getWorldPosition(this._tmpV2).sub(this.cam.position);
      const dist = dp.length();
      const fwd = this.cam.getWorldDirection(this._tmpV3 || (this._tmpV3 = new T.Vector3()));
      const ang = fwd.angleTo(dp.normalize());
      if (dist < 46 && ang < 0.11) {
        this._sg01Gaze += dt;
        if (this._sg01Gaze > 1.5) this._sg01Contact();
      } else this._sg01Gaze = Math.max(0, this._sg01Gaze - dt * 2);
    }
  }
  _bGroundProps() {
    const g = this.gSurface;
    const mTank = this._mStd(0xdfe5ea, 0.32, 0.6, { envMapIntensity: 1.1 });
    const mPipe = this._mStd(0x5a646d, 0.6, 0.5);
    /* fuel farm + frost, valve wheels, tank beacon */
    this.fuelFarm = new T.Group();
    for (let i = 0; i < 3; i++) {
      const tk = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(3, 3, 9, 18), mTank);
      const capT = new T.Mesh(new T.SphereGeometry(3, 18, 10, 0, TAU, 0, Math.PI / 2), mTank);
      capT.position.y = 4.5;
      const capB = capT.clone(); capB.rotation.x = Math.PI; capB.position.y = -4.5;
      body.castShadow = true;
      const valve = new T.Mesh(new T.TorusGeometry(0.5, 0.08, 6, 14), this._mStd(0xb8412e, 0.6, 0.4));
      valve.position.set(0, -1.4, 3.15);
      tk.add(body, capT, capB, valve);
      tk.position.set(-52 + i * 9, 5.6, -44);
      this.fuelFarm.add(tk);
      this._contact(g, -52 + i * 9, 0.08, -44, 4.2, 0.4);
    }
    this.tankBeacon = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: 0xff9a3a }));
    this.tankBeacon.position.set(-43, 12.2, -44);
    /* SG ARCHIVE FRAGMENT (§23): a small artifact tucked behind the tanks */
    this.archiveFrag = new T.Mesh(new T.OctahedronGeometry(0.5, 0),
      this._mStd(0x9b6bff, 0.35, 0.7, { emissive: new T.Color(0x2a1a4a), envMapIntensity: 1.6 }));
    this.archiveFrag.position.set(-58, 0.7, -52);
    this.archiveFrag.rotation.z = 0.5;
    g.add ? g.add(this.archiveFrag) : this.gSurface.add(this.archiveFrag);
    g.add(this.tankBeacon);
    const pipe = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 52, 8), mPipe);
    pipe.rotation.z = Math.PI / 2; pipe.rotation.y = 0.6;
    pipe.position.set(-24, 1.1, -22);
    /* pipe supports so it doesn't float */
    for (let i = 0; i < 5; i++) {
      const sup = new T.Mesh(new T.BoxGeometry(0.24, 1.1, 0.24), mPipe);
      const k = i / 4;
      sup.position.set(lerp(-46, -2, k), 0.55, lerp(-34, -10, k));
      g.add(sup);
    }
    /* water towers */
    for (let i = 0; i < 2; i++) {
      const wt = new T.Group();
      const tank = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 6, 14), mTank);
      tank.position.y = 16;
      const legM = this._mStd(0x6d7378, 0.7, 0.4);
      for (let l = 0; l < 3; l++) {
        const leg = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 14, 6), legM);
        const a = l / 3 * TAU;
        leg.position.set(Math.cos(a) * 1.6, 7, Math.sin(a) * 1.6);
        wt.add(leg);
      }
      wt.add(tank);
      wt.position.set(-58, 0, 30 + i * 18);
      g.add(wt);
      this._contact(g, -58, 0.08, 30 + i * 18, 3.2, 0.35);
    }
    /* weather mast */
    this.mast = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.16, 0.26, 22, 8), mPipe);
    pole.position.y = 11;
    this.anemo = new T.Group();
    for (let i = 0; i < 3; i++) {
      const cup = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), this._mStd(0xe8cf9e, 0.5, 0.4));
      const a = i / 3 * TAU;
      cup.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
      this.anemo.add(cup);
    }
    this.anemo.position.y = 22.4;
    this.vane = new T.Mesh(new T.ConeGeometry(0.24, 1.6, 6), this._mStd(0x35d6ff, 0.4, 0.4));
    this.vane.rotation.z = -Math.PI / 2;
    this.vane.position.y = 20.6;
    this.mastBeacon = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xff4040 }));
    this.mastBeacon.position.y = 22.9;
    this.mast.add(pole, this.anemo, this.vane, this.mastBeacon);
    this.mast.position.set(48, 0.2, 52);
    this._contact(g, 48, 0.08, 52, 1.1, 0.35);
    /* V3.4 §69: lightning-protection mast — taller than the vehicle, thin,
       red aviation light, guy-wires, off the hero axis */
    const lm = new T.Group();
    const lmPole = new T.Mesh(new T.CylinderGeometry(0.22, 0.42, 62, 8), mPipe);
    lmPole.position.y = 31;
    const lmTip = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), this._mStd(0xb8c1c9, 0.4, 0.7));
    lmTip.position.y = 62.4;
    this.lmBeacon = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), new T.MeshBasicMaterial({ color: 0xff4040 }));
    this.lmBeacon.position.y = 61.2;
    lm.add(lmPole, lmTip, this.lmBeacon);
    const mWire = this._mStd(0x1c2127, 0.8, 0.2);
    for (const wa of [0.4, 2.5, 4.6]) {
      const gx = Math.cos(wa) * 16, gz = Math.sin(wa) * 16;
      const wire = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, Math.hypot(16, 46), 4), mWire);
      wire.position.set(gx / 2, 23, gz / 2);
      wire.lookAt(gx, 0, gz);
      wire.rotateX(Math.PI / 2);
      lm.add(wire);
    }
    lm.position.set(64, 0, -36);
    g.add(lm);
    this._contact(g, 64, 0.08, -36, 1.4, 0.4);
    /* cones / crates / extinguishers / electrical boxes / floodlight posts */
    const mCone = this._mStd(0xff7a2a, 0.8);
    for (let i = 0; i < 10; i++) {
      const cn = new T.Mesh(new T.ConeGeometry(0.5, 1.3, 10), mCone);
      const a = rand(0, TAU), r = rand(60, 100);
      cn.position.set(Math.cos(a) * r, 0.75, Math.sin(a) * r);
      g.add(cn);
      this._contact(g, cn.position.x, 0.08, cn.position.z, 0.8, 0.3);
    }
    /* SERVICE ROAD — the axis that organizes the yard (spec P0 §14):
       a dark strip from the ops cabin toward the pad, everything staged
       along its shoulders so the rocket + tower stay the clear hero */
    const roadM = this._mStd(0x22262c, 0.92, 0, { envMapIntensity: 0.35 });
    const road = new T.Mesh(new T.PlaneGeometry(8, 118), roadM);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = 0.47;                        /* aims at the pad centre */
    road.position.set(-16, 0.045, 30);
    road.receiveShadow = true;
    g.add(road);
    const edgeM = new T.MeshBasicMaterial({ color: 0x5a6470 });
    const roadGrp = new T.Group();
    roadGrp.position.copy(road.position);
    roadGrp.rotation.y = -0.47;
    for (const sgn of [-1, 1]) {
      const edge = new T.Mesh(new T.PlaneGeometry(0.22, 118), edgeM);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(3.9 * sgn, 0.006, 0);
      roadGrp.add(edge);
    }
    g.add(roadGrp);
    /* crates: one staged depot on the road's west shoulder */
    const mCrate = this._mStd(0x7c8a4a, 0.9);
    const crateSpots = [[-44, 46], [-41, 42.6], [-46.5, 41.5], [-43, 38], [-48, 47.5], [-39, 47]];
    for (let i = 0; i < 6; i++) {
      const cr = new T.Mesh(new T.BoxGeometry(rand(2, 3.4), rand(1.4, 2.4), rand(2, 3)), mCrate);
      cr.position.set(crateSpots[i][0], cr.geometry.parameters.height / 2, crateSpots[i][1]);
      cr.rotation.y = rand(-0.5, 0.5) - 0.47;
      cr.castShadow = true;
      g.add(cr);
      this._contact(g, cr.position.x, 0.08, cr.position.z, 2.2, 0.35);
    }
    for (let i = 0; i < 3; i++) {
      const ext = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.7, 8), this._mStd(0xc23a2a, 0.5, 0.3));
      ext.position.set(rand(-40, 40), 0.35, rand(30, 60));
      g.add(ext);
    }
    for (let i = 0; i < 2; i++) {
      const box = new T.Mesh(new T.BoxGeometry(1.2, 1.6, 0.6), this._mStd(0x39525e, 0.6, 0.4));
      box.position.set(-18 + i * 8, 0.8, 44);
      const lamp = new T.Mesh(new T.SphereGeometry(0.07, 6, 5), new T.MeshBasicMaterial({ color: 0x66ff9a }));
      lamp.position.set(box.position.x + 0.4, 1.42, 44.32);
      g.add(box, lamp);
    }
    /* free-standing floodlight posts feeding the cyan / amber fills */
    const mkPost = (x, z, headColor) => {
      const post = new T.Mesh(new T.CylinderGeometry(0.14, 0.2, 14, 8), mPipe);
      post.position.set(x, 7, z);
      const head = new T.Mesh(new T.BoxGeometry(1.3, 0.5, 0.7), this._mStd(0x2c333c, 0.5, 0.5));
      head.position.set(x, 14.2, z);
      const face = new T.Mesh(new T.PlaneGeometry(1.1, 0.4), new T.MeshBasicMaterial({ color: headColor }));
      face.position.set(x, 14.2, z + 0.36);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: headColor, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, 14.2, z + 0.5);
      glow.scale.setScalar(5.5);
      /* V3.4 §74/§169: soft volumetric light cone aimed at the yard (night) */
      const cone = new T.Mesh(
        new T.ConeGeometry(6.5, 14, 18, 1, true),
        new T.MeshBasicMaterial({ color: headColor, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })
      );
      cone.position.set(x, 7.2, z);
      const aim = Math.atan2(-x, -z);
      cone.rotation.z = Math.sin(aim) * 0.35;
      cone.rotation.x = Math.cos(aim) * 0.35;
      cone.renderOrder = 2;
      g.add(post, head, face, glow, cone);
      this._contact(g, x, 0.08, z, 1, 0.3);
      return { face, glow, cone };
    };
    this.floodHeads = [
      mkPost(-48, -38, 0x9fe0ff),
      mkPost(-30, 50, 0xf2f7ff),
      mkPost(-74, 14, 0xffc27a),
      mkPost(-6, 14, 0xffd9a0),                    /* over the service road */
    ];
    /* service truck v2: headlights + rear beacon */
    this.truck = new T.Group();
    const cab = new T.Mesh(new T.BoxGeometry(2.2, 1.8, 2), this._mStd(0xe8cf9e, 0.5, 0.2));
    cab.position.set(0, 1.6, 1.6);
    const bed = new T.Mesh(new T.BoxGeometry(2.4, 1.2, 4), this._mStd(0x39424c, 0.7, 0.3));
    bed.position.set(0, 1.3, -1.4);
    const wM = this._mStd(0x14181d, 0.9);
    [[-1.2, 1.9], [1.2, 1.9], [-1.2, -2.4], [1.2, -2.4]].forEach(([x, z]) => {
      const wh = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.4, 10), wM);
      wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.5, z);
      this.truck.add(wh);
    });
    this.truckHeads = [];
    for (const hx of [-0.7, 0.7]) {
      const hd = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xfff2cf, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      hd.position.set(hx, 1.1, 2.72);
      hd.scale.setScalar(1.6);
      this.truck.add(hd);
      this.truckHeads.push(hd);
    }
    this.truckBeacon = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: 0xffa03a }));
    this.truckBeacon.position.set(0, 2.7, 1.6);
    this.truck.add(cab, bed, this.truckBeacon);
    this._contact(this.truck, 0, 0.09, 0, 2.6, 0.42);
    this.truckT = 0;
    /* service cart (parked) */
    const cart = new T.Group();
    const cbed = new T.Mesh(new T.BoxGeometry(1.5, 0.7, 2.4), this._mStd(0x4a5560, 0.7, 0.3));
    cbed.position.y = 0.8;
    cart.add(cbed);
    [[-0.7, 0.9], [0.7, 0.9], [-0.7, -0.9], [0.7, -0.9]].forEach(([x, z]) => {
      const wh = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.24, 8), wM);
      wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.28, z);
      cart.add(wh);
    });
    cart.position.set(-25, 0, 49);                 /* shoulder of the service road */
    cart.rotation.y = -0.47 + Math.PI / 2;
    g.add(cart);
    this._contact(g, 30, 0.08, 40, 1.8, 0.35);
    /* puddles (env-lit when wet) */
    this.puddles = [];
    const pm = new T.MeshStandardMaterial({ color: 0x1c2c40, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0, envMapIntensity: 1.6 });
    for (let i = 0; i < 5; i++) {
      const pd = new T.Mesh(new T.CircleGeometry(rand(2.4, 5.2), 20), pm.clone());
      pd.rotation.x = -Math.PI / 2;
      const a = rand(0, TAU), r = rand(34, 92);
      pd.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
      this.puddles.push(pd);
      g.add(pd);
    }
    this.cloudShadow = new T.Mesh(new T.CircleGeometry(320, 24), new T.MeshBasicMaterial({ map: this.texCloud, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    this.cloudShadow.rotation.x = -Math.PI / 2;
    this.cloudShadow.position.y = 0.4;
    g.add(this.fuelFarm, pipe, this.mast, this.truck, this.cloudShadow);
    /* city bounce glow sprites over the valley ridges */
    this.cityGlows = [];
    for (const [dx, dz, s] of [[0.42, -0.9, 2600], [-0.5, 0.86, 2100]]) {
      const gl = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: 0xdf9a4e, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      gl.position.set(dx * 3600, 520, dz * 3600);
      gl.scale.set(s, s * 0.32, 1);
      this.cityGlows.push(gl);
      this.gSurface.add(gl);
    }
  }
  _bOpsCabin() {
    /* small operations building: emissive windows, door, roof gear — a place
       the technical-white fill visibly comes from */
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(10, 3.6, 5.4), this._mStd(0x8d959c, 0.85, 0.1));
    body.position.y = 1.8; body.castShadow = true;
    this.cabinWin = new T.Mesh(new T.PlaneGeometry(7.6, 1.1), new T.MeshBasicMaterial({ color: 0xffe0b0 }));
    this.cabinWin.position.set(0, 2.2, 2.72);
    const door = new T.Mesh(new T.PlaneGeometry(1.1, 2.2), this._mStd(0x39424c, 0.7, 0.2));
    door.position.set(-3.4, 1.1, 2.71);
    const ac = new T.Mesh(new T.BoxGeometry(1.4, 0.8, 1.2), this._mStd(0xb9c1c8, 0.6, 0.4));
    ac.position.set(2.6, 4.0, 0);
    this.cabinWhip = new T.Mesh(new T.CylinderGeometry(0.03, 0.05, 3.4, 6), this._mStd(0x2c333c, 0.6, 0.5));
    const whip = this.cabinWhip;
    whip.position.set(-3.6, 5.3, -1.2);
    const sign = new T.Mesh(new T.PlaneGeometry(3.4, 0.8), new T.MeshBasicMaterial({ map: textTex(['SG OPS // ZONA 01'], '#35d6ff', '#0d1626', 256, 48, 22) }));
    sign.position.set(0, 3.35, 2.73);
    /* CLASSIFIED DOOR (§23): sealed hatch, red keypad — scanner says no */
    this.secretDoor = new T.Mesh(new T.PlaneGeometry(1.2, 2.2), this._mStd(0x1c232b, 0.55, 0.35));
    this.secretDoor.position.set(3.4, 1.1, -2.71);
    this.secretDoor.rotation.y = Math.PI;
    const pad2 = new T.Mesh(new T.PlaneGeometry(0.22, 0.3), new T.MeshBasicMaterial({ color: 0xff5044 }));
    pad2.position.set(2.6, 1.35, -2.72);
    pad2.rotation.y = Math.PI;
    const stripe = new T.Mesh(new T.PlaneGeometry(1.2, 0.16), new T.MeshBasicMaterial({ map: hazardTex() }));
    stripe.position.set(3.4, 2.35, -2.72);
    stripe.rotation.y = Math.PI;
    g.add(body, this.cabinWin, door, ac, whip, sign, this.secretDoor, pad2, stripe);
    g.position.set(-30, 0, 58);
    g.rotation.y = Math.PI;
    this.opsCabin = g;
    this.gSurface.add(g);
    this._contact(this.gSurface, -30, 0.08, 58, 7, 0.4);
    this.cabinLight = new T.PointLight(0xffdca8, 0, 40, 1.8);
    this.cabinLight.position.set(-30, 2.6, 54);
    this.gSurface.add(this.cabinLight);
  }
  /* HUMAN SCALE — 6 workers max, simple natural loops: walker, pair at a
     station, catwalk crosser, operator by the truck, tablet checker (spec §6) */
  _bCrew() {
    this.crew = [];
    const suit = this._mStd(0xf2f4f6, 0.7);
    const visor = this._mStd(0x2a3947, 0.3, 0.6);
    const vest = this._mStd(0xff7a2a, 0.8);
    const mkPerson = (vested) => {
      const p = new T.Group();
      const bodyM = new T.Mesh(new T.CylinderGeometry(0.34, 0.4, 1.15, 10), vested ? vest : suit);
      bodyM.position.y = 0.95;
      const head = new T.Mesh(new T.SphereGeometry(0.26, 10, 8), suit);
      head.position.y = 1.75;
      const vz = new T.Mesh(new T.SphereGeometry(0.27, 10, 8, 0, Math.PI), visor);
      vz.position.y = 1.75; vz.rotation.y = Math.PI;
      const armL = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.9, 6), vested ? vest : suit);
      armL.position.set(0.46, 1.05, 0);
      const armR = armL.clone(); armR.position.x = -0.46;
      p.add(bodyM, head, vz, armL, armR);
      p.userData.arms = [armL, armR];
      this._contact(p, 0, 0.02, 0, 0.55, 0.4);
      return p;
    };
    const roles = [
      { role: 'walk', a: rand(0, TAU), r: 62, sp: 0.11 },
      { role: 'walk', a: rand(0, TAU), r: 84, sp: 0.08 },
      { role: 'station', x: -46, z: -36, face: 0.6 },
      { role: 'station', x: -44.4, z: -37.6, face: -2.4 },
      { role: 'catwalk', y: 24, t: rand(0, 1), sp: 0.05 },
      { role: 'operator', t: 0 },
    ];
    roles.forEach((u, i) => {
      const p = mkPerson(i >= 4);
      p.userData = Object.assign(p.userData, u, { ph: rand(0, TAU) });
      if (u.role === 'station') { p.position.set(u.x, 0, u.z); p.rotation.y = u.face; }
      if (u.role === 'catwalk') p.position.set(15.5, u.y, 0);
      this.crew.push(p);
      if (u.role === 'catwalk') this.tower.add(p);
      else this.gSurface.add(p);
    });
  }
  _bCloudsRain() {
    const pre = this._preset();
    const low = pre.clouds;
    this.clouds = [];
    const mk = (n, yMin, yMax, sMin, sMax, baseOp, band) => {
      for (let i = 0; i < n; i++) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: this.texCloud, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        const a = rand(0, TAU), r = rand(200, 3600);
        sp.position.set(Math.cos(a) * r, rand(yMin, yMax), Math.sin(a) * r);
        const s = rand(sMin, sMax);
        sp.scale.set(s, s * rand(0.42, 0.6), 1);
        sp.userData = { baseOp, band, ph: rand(0, TAU), depth: rand(0.72, 1) };
        this.clouds.push(sp);
        this.gSurface.add(sp);
      }
    };
    mk(low, 950, 1550, 340, 620, 0.85, 'low');
    mk(Math.round(low * 0.5), 3100, 3500, 700, 1100, 0.4, 'high');
    const rn = this._tierN({ ultra: 3000, high: 2400, perf: 1600, mobile: 1100 });
    this.rain = new RainField(rn, this.texBlob);
    this.gSurface.add(this.rain.points);
  }
  _bCity() {
    /* distant urban light concentrations behind the ridges — signals of life,
       never a full city (spec §5). Clusters instead of a uniform ring. */
    const N = this._tierN({ ultra: 560, high: 460, perf: 320, mobile: 230 });
    const pos = [];
    const clusters = [
      [0.42, -0.9, 2600, 700], [0.30, -0.95, 3200, 500],
      [-0.5, 0.86, 2500, 650], [-0.62, 0.78, 3300, 520],
      [0.95, 0.2, 3400, 420],
    ];
    let guard = 0;
    while (pos.length / 3 < N && guard++ < N * 40) {
      const cl = clusters[(Math.random() * clusters.length) | 0];
      const cx = cl[0] * cl[2] + rand(-cl[3], cl[3]);
      const cz = cl[1] * cl[2] + rand(-cl[3], cl[3]);
      const r = Math.hypot(cx, cz);
      if (r < 1400 || r > 3800) continue;
      const h = this.terrainH(cx, cz);
      if (h < 520) pos.push(cx, h + rand(2, 10), cz);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    geo.boundingSphere = new T.Sphere(new T.Vector3(), 6000);
    this.cityMat = new T.PointsMaterial({ map: this.texBlob, color: 0xffca7a, size: 7, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    this.city = new T.Points(geo, this.cityMat);
    this.city.frustumCulled = false;
    this.gSurface.add(this.city);
  }
  /* ============================ SPACE / ORBIT ============================ */
  queueSpace() {
    if (this._spaceQueued) return;
    this._spaceQueued = true;
    /* FACILITY FIRST: every space task is cheap; heavy Earth pixels go to a
       Worker (or a time-sliced fallback) and never touch this queue (P0 §2/§3) */
    this._q('earthCore', () => this._bEarthCore());
    this._q('earthUpgrade', () => this._bEarthUpgrade());
    this._q('miniRocket', () => this._bMiniRocket());
    this._q('ship', () => this._bShip());
    this._q('satellites', () => this._bSatellites());
    this._q('spaceReady', () => {
      this.builtSpace = true;
      this._heroSwap('ship', this.ship, []);
    });
  }
  /* EARTH v2 — real geography (celestial.js canvases: true coastlines, real
     city lights), layered SURFACE / OCEAN SPECULAR+GLINT / NIGHT LIGHTS /
     CLOUD SHELL / ATMOSPHERIC SCATTERING APPROX / THIN AIRGLOW.
     Optional NASA imagery in assets/earth/ upgrades it automatically. */
  _bEarthCore() {
    this.earthCenter = new T.Vector3(0, -1620, -180);
    const R = this.earthR = 1400;
    const pre = this._preset();
    /* instant 2×1 placeholders — geometry + shaders are ready this frame;
       real geographic maps stream in behind (LOD0 sliced → HI worker) */
    const px = (r, g, b, a) => {
      const c = document.createElement('canvas'); c.width = 2; c.height = 1;
      const g2 = c.getContext('2d');
      g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (a == null ? 1 : a) + ')';
      g2.fillRect(0, 0, 2, 1);
      return c;
    };
    const mkTex = (cv, srgb) => {
      const tx = new T.CanvasTexture(cv);
      if (srgb) tx.colorSpace = T.SRGBColorSpace;
      tx.anisotropy = pre.aniso;
      return tx;
    };
    this._mkEarthTex = mkTex;
    this._earthTexSrc = { day: 'stub', night: 'stub', clouds: 'stub', spec: 'stub' };
    this.earthU = {
      uSun: { value: new T.Vector3(1, 0, 0) },
      uDay: { value: mkTex(px(6, 26, 58), true) },
      uNight: { value: mkTex(px(0, 0, 0), true) },
      uSpec: { value: mkTex(px(255, 255, 255), false) },
    };
    const mat = new T.ShaderMaterial({
      fog: false,
      uniforms: this.earthU,
      vertexShader: [
        'varying vec3 vN; varying vec3 vW; varying vec2 vUv;',
        'void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal);',
        ' vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;',
        ' gl_Position=projectionMatrix*viewMatrix*w; }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vN; varying vec3 vW; varying vec2 vUv;',
        'uniform vec3 uSun; uniform sampler2D uDay,uNight,uSpec;',
        'void main(){',
        ' vec3 N=normalize(vN); vec3 S=normalize(uSun);',
        ' vec3 V=normalize(cameraPosition-vW);',
        ' float d=dot(N,S);',
        ' float day=smoothstep(-0.10,0.16,d);',
        ' vec3 alb=texture2D(uDay,vUv).rgb;',
        ' float oc=texture2D(uSpec,vUv).r;',
        ' /* diffuse surface */',
        ' vec3 col=alb*(0.030+1.28*max(d,0.0));',
        ' col+=vec3(0.012,0.026,0.050)*(1.0-day);   /* earthshine floor */',
        ' /* OCEAN RESPONSE: broad specular + tight sun glint, never plastic */',
        ' vec3 H=normalize(S+V);',
        ' float spec=pow(max(dot(N,H),0.0),42.0)*oc*day*0.55;',
        ' float glint=pow(max(dot(N,H),0.0),340.0)*oc*day*1.6;',
        ' col+=vec3(1.0,0.95,0.85)*(spec+glint);',
        ' /* NIGHT LIGHTS — real cities, only on the night side */',
        ' vec3 nl=texture2D(uNight,vUv).rgb;',
        ' float nightK=1.0-smoothstep(-0.14,0.02,d);',
        ' col+=nl*nightK*1.55;',
        ' /* warm terminator band */',
        ' col+=vec3(0.9,0.42,0.18)*pow(max(0.0,1.0-abs(d)),16.0)*0.30;',
        ' gl_FragColor=vec4(col,1.0);',
        '}',
      ].join('\n'),
    });
    this.earth = new T.Mesh(new T.SphereGeometry(R, 84, 56), mat);
    this.earth.position.copy(this.earthCenter);
    /* CLOUD SHELL — geographic canvas alpha, independent drift, sun-lit */
    this.earthCloudU = {
      uSun: { value: new T.Vector3(1, 0, 0) },
      uMap: { value: mkTex(px(255, 255, 255, 0), false) },
    };
    const cm = new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: this.earthCloudU,
      vertexShader: [
        'varying vec3 vN; varying vec2 vUv;',
        'void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal);',
        ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vN; varying vec2 vUv; uniform vec3 uSun; uniform sampler2D uMap;',
        'void main(){',
        ' vec4 tx=texture2D(uMap,vUv);',
        ' /* PNG/canvas carry real alpha; NASA-derived luminance JPG carries the',
        '    cloud density in .r with alpha == 1 — support both (V3.4) */',
        ' float a=(tx.a<0.995)?tx.a:tx.r;',
        ' float d=dot(normalize(vN),normalize(uSun));',
        ' float day=smoothstep(-0.06,0.18,d);',
        ' vec3 c=vec3(0.99)*(0.055+1.05*day);',
        ' c+=vec3(0.9,0.45,0.2)*pow(max(0.0,1.0-abs(d)),14.0)*0.35;',
        ' gl_FragColor=vec4(c,a*0.92);',
        '}',
      ].join('\n'),
    });
    this.earthClouds = new T.Mesh(new T.SphereGeometry(R + 11, 72, 48), cm);
    this.earthClouds.position.copy(this.earthCenter);
    /* ATMOSPHERE — Rayleigh/Mie-flavoured rim: blue day limb, warm sunset ring,
       forward Mie brightening toward the sun, extinction into night */
    const am = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending, fog: false,
      uniforms: { uSun: this.earthU.uSun },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'varying vec3 vN; varying vec3 vW; uniform vec3 uSun;',
        'void main(){',
        ' vec3 V=normalize(cameraPosition-vW);',
        ' vec3 S=normalize(uSun);',
        ' float rim=pow(max(0.0,1.0-abs(dot(vN,V))),3.0);',
        ' float d=dot(vN,S);',
        ' float day=smoothstep(-0.22,0.24,d);',
        ' float term=pow(max(0.0,1.0-abs(d)),7.0);',
        ' float mie=pow(max(dot(V,-S),0.0),9.0);',
        ' vec3 ray=mix(vec3(0.06,0.16,0.45),vec3(0.30,0.62,1.0),day);',
        ' vec3 sunset=vec3(1.0,0.42,0.16)*term*0.9;',
        ' vec3 c=ray*(0.22+0.9*day)+sunset+vec3(1.0,0.8,0.55)*mie*0.5;',
        ' gl_FragColor=vec4(c,rim*(0.16+0.84*max(day,term*0.7)));',
        '}',
      ].join('\n'),
    });
    this.earthAtmo = new T.Mesh(new T.SphereGeometry(R + 44, 56, 36), am);
    this.earthAtmo.position.copy(this.earthCenter);
    /* AIRGLOW — extremely thin cyan-green line just above the limb */
    const gm = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending, fog: false,
      uniforms: {},
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'varying vec3 vN; varying vec3 vW;',
        'void main(){',
        ' vec3 V=normalize(cameraPosition-vW);',
        ' float f=1.0-abs(dot(vN,V));',
        ' float line=smoothstep(0.965,0.992,f)*(1.0-smoothstep(0.992,1.0,f));',
        ' gl_FragColor=vec4(vec3(0.30,0.72,0.55),line*0.07);',
        '}',
      ].join('\n'),
    });
    this.earthGlow = new T.Mesh(new T.SphereGeometry(R + 74, 48, 30), gm);
    this.earthGlow.position.copy(this.earthCenter);
    this.gSpace.add(this.earth, this.earthClouds, this.earthAtmo, this.earthGlow);
    /* TRUE EARTH upgrade (V3.4 §9-§13): real NASA-derived imagery from the
       local hosting, resolution by tier, cache-busted, applied per-map the
       moment it decodes. The ocean/specular mask is derived from the REAL day
       texture so glint matches the imagery. Fail-safe: procedural remains. */
    try {
      const tier = this._tier();
      const res = (tier === 'perf' || tier === 'mobile' || this.safeMode) ? '2k' : '4k';
      CEL.loadOptionalTextures(T, () => {}, {
        res, v: this.buildId, aniso: pre.aniso,
        onEach: (key, tex) => {
          try {
            if (key === 'day') {
              this.earthU.uDay.value = tex; this._earthTexSrc.day = 'file';
              this._earthFileRes = this._earthFileRes || {};
              this._earthFileRes.day = tex.image ? tex.image.width : 0;
              const mask = CEL.deriveOceanMask(tex.image, res === '2k' ? 512 : 1024);
              const mtx = new T.CanvasTexture(mask);
              mtx.anisotropy = pre.aniso;
              this.earthU.uSpec.value = mtx;
              /* mark as 'file' so no later procedural pass can replace it */
              this._earthTexSrc.spec = 'file';
            } else if (key === 'night') {
              this.earthU.uNight.value = tex; this._earthTexSrc.night = 'file';
              (this._earthFileRes = this._earthFileRes || {}).night = tex.image ? tex.image.width : 0;
            } else if (key === 'clouds') {
              this.earthCloudU.uMap.value = tex; this._earthTexSrc.clouds = 'file';
              (this._earthFileRes = this._earthFileRes || {}).clouds = tex.image ? tex.image.width : 0;
            } else if (key === 'moon') {
              tex.colorSpace = T.SRGBColorSpace;
              this.moonU.uMap.value = tex;
            }
          } catch (e) { /* each map independent; procedural covers any miss */ }
        },
      });
    } catch (e) { /* placeholders remain until procedural maps land */ }
    /* sea-of-clouds layer for the punch-through beat */
    this.cloudSea = [];
    for (let i = 0; i < 40; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: this.texCloud, color: 0xe9eef4, transparent: true, opacity: 0, depthWrite: false }));
      const a = rand(0, TAU), r = rand(160, 2400);
      sp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const s = rand(320, 720);
      sp.scale.set(s, s * 0.4, 1);
      sp.userData = { ph: rand(0, TAU) };
      this.cloudSea.push(sp);
      this.gSpace.add(sp);
    }
  }
  _applyEarthMaps(maps, tag, isBitmap) {
    const apply = (key, uniform, srgb) => {
      if (this._earthTexSrc[key] === 'file') return;      /* real imagery wins */
      const src = maps[key];
      if (!src) return;
      let tx;
      if (isBitmap) {
        tx = new T.Texture(src);
        tx.needsUpdate = true;
        if (srgb) tx.colorSpace = T.SRGBColorSpace;
        tx.anisotropy = this._preset().aniso;
      } else {
        tx = this._mkEarthTex(src, srgb);
      }
      uniform.value = tx;
      this._earthTexSrc[key] = tag;
    };
    apply('day', this.earthU.uDay, true);
    apply('night', this.earthU.uNight, true);
    apply('spec', this.earthU.uSpec, false);
    apply('clouds', this.earthCloudU.uMap, false);
  }
  /* LOD ladder that never blocks the main thread (P0 §3):
     sliced 256 immediately → full preset res in a module Worker
     (OffscreenCanvas) → if Workers unavailable, sliced ≤1024 fallback. */
  _bEarthUpgrade() {
    try {
      CEL.makeEarthMapsSliced(256, null, (maps) => {
        try { this._applyEarthMaps(maps, 'lod0', false); } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthLod0', e); }
      });
    } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthLod0', e); }
    if (this.safeMode) { this.earthWorkerState = 'skipped-safe'; return; }   /* LOD0 only (P0.1 §25) */
    /* V3.4 §130: if the REAL imagery already owns every slot, the expensive
       procedural HI pass is wasted work — give the files a moment to land,
       then only run the worker for slots still procedural. */
    setTimeout(() => { try { this._bEarthUpgradeHi(); } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthHiDefer', e); } }, 2600);
  }
  _bEarthUpgradeHi() {
    const src = this._earthTexSrc || {};
    if (src.day === 'file' && src.night === 'file' && src.clouds === 'file') {
      this.earthWorkerState = 'skipped-file-assets';
      return;
    }
    const target = Math.min(this._preset().earthTex, 1024);
    const slicedFallback = (why) => {
      this.earthWorkerState = 'fallback:' + why;
      try {
        CEL.makeEarthMapsSliced(target, null, (maps) => {
          try { this._applyEarthMaps(maps, 'hi', false); } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthHi', e); }
        });
      } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthHi', e); }
    };
    let worker = null;
    try {
      const workerAllowed = !this._fail.has('worker');
      if (workerAllowed && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
        worker = new Worker('js/earthworker.js' + (this.buildId ? '?v=' + this.buildId : ''), { type: 'module' });
      }
    } catch (e) { worker = null; }
    if (!worker) { slicedFallback(this._fail.has('worker') ? 'injected-worker-failure' : 'unsupported'); return; }
    this.earthWorkerState = 'active';
    const bail = setTimeout(() => { try { worker.terminate(); } catch (e) {} worker = null; slicedFallback('timeout'); }, 15000);
    worker.onerror = (e) => {
      clearTimeout(bail);
      console.warn('[SG WORKER] earthworker failed — using sliced fallback', (e && e.message) || '');
      try { worker.terminate(); } catch (e2) {}
      worker = null;
      slicedFallback('onerror');
    };
    worker.onmessage = (ev) => {
      clearTimeout(bail);
      try {
        if (ev.data && ev.data.ok) { this._applyEarthMaps(ev.data.maps, 'hi', true); this.earthWorkerState = 'done'; }
        else slicedFallback('worker-reported:' + (ev.data && ev.data.error));
      } catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE] earthHi', e); }
      try { worker.terminate(); } catch (e) {}
    };
    worker.postMessage({ size: target });
  }
  _bMiniRocket() {
    /* V3.3 STAGING: SG-L1 in flight is a REAL two-stage vehicle — separate
       groups from birth (no fake pieces spawned only for the cinematic):
       mStage1 (booster + 5 engines + interstage) · mUpper (second stage +
       vacuum nozzle) · mFairL/mFairR (half-shell + half-nose enclosing the
       payload bay). Coherent with the pad vehicle's own geometry. */
    const g = new T.Group();
    const hull = hullTex(); hull.repeat.set(2, 4);
    const m = new T.MeshStandardMaterial({ map: hull, roughnessMap: this.texRough, roughness: 0.55, metalness: 0.35, envMapIntensity: 1.1 });
    const mDark = this._mStd(0x2c333c, 0.6, 0.4);
    /* ---- STAGE 1 ---- */
    this.mStage1 = new T.Group();
    const s1 = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, 17, 18), m);
    s1.position.y = -8.5;
    const inter = new T.Mesh(new T.CylinderGeometry(2.64, 2.64, 1.1, 18), mDark);
    inter.position.y = 0.4;
    const engs = new T.Group();
    for (const [ex, ez] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) {
      const nz = new T.Mesh(new T.CylinderGeometry(0.32, 0.62, 1.3, 10, 1, true), mDark);
      nz.position.set(ex, -17.6, ez);
      engs.add(nz);
    }
    const s1Lights = new T.Group();
    for (const lz of [1.9, -1.9]) {
      const lp = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xff6a4a }));
      lp.position.set(0, -14, lz * 1.34);
      s1Lights.add(lp);
    }
    this.mStage1.add(s1, inter, engs, s1Lights);
    /* ---- UPPER STAGE ---- */
    this.mUpper = new T.Group();
    const s2 = new T.Mesh(new T.CylinderGeometry(2.45, 2.55, 8, 18), m);
    s2.position.y = 5;
    const vacNz = new T.Mesh(new T.CylinderGeometry(0.5, 1.15, 1.6, 12, 1, true), mDark);
    vacNz.position.y = 0.4;
    this.mGlow2 = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xbfe0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.mGlow2.position.y = -0.4; this.mGlow2.scale.setScalar(5);
    this.mUpper.add(s2, vacNz, this.mGlow2);
    /* ---- FAIRING (half shell + half nose each) ---- */
    const mkHalf = (flip) => {
      const grp = new T.Group();
      const shell = new T.Mesh(new T.CylinderGeometry(2.62, 2.62, 8, 18, 1, false, 0, Math.PI), m);
      const noseH = new T.Mesh(new T.ConeGeometry(2.62, 5.2, 18, 1, false, 0, Math.PI), m);
      noseH.position.y = 6.6;
      grp.add(shell, noseH);
      if (flip) grp.rotation.y = Math.PI;
      grp.position.y = 13.2;
      return grp;
    };
    this.mFairL = mkHalf(false);
    this.mFairR = mkHalf(true);
    /* stage-1 main-plume glow */
    const glow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xffc070, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.y = -18.2; glow.scale.setScalar(9);
    this.mGlow = glow;
    g.add(this.mStage1, this.mUpper, this.mFairL, this.mFairR, glow);
    g.visible = false;
    this.miniRocket = g;
    this.gSpace.add(g);
  }
  /* SG SHIP v2 — never black in orbit: sun key (real direction), Earth-blue
     rim fill, PMREM environment, emissive nav lights / panels / engine
     indicators, RCS ports, micro-events (spec §46–48) */
  _bShip() {
    const g = new T.Group();
    const mBody = this._mStd(0xc9d2da, 0.32, 0.78, { envMapIntensity: 1.35 });
    const mDark = this._mStd(0x232a33, 0.45, 0.7, { envMapIntensity: 1.1 });
    const mPanel = this._mStd(0x9aa6b2, 0.5, 0.6, { envMapIntensity: 1.1 });
    const hullC = new T.Mesh(new T.CylinderGeometry(2.0, 2.9, 9.5, 20), mBody);
    hullC.rotation.x = Math.PI / 2;
    const nose = new T.Mesh(new T.ConeGeometry(2.0, 4.4, 20), mBody);
    nose.rotation.x = -Math.PI / 2; nose.position.z = -6.9;
    const tail = new T.Mesh(new T.SphereGeometry(2.9, 18, 12), mDark);
    tail.position.z = 4.9; tail.scale.z = 0.5;
    const canopy = new T.Mesh(new T.SphereGeometry(1.5, 16, 10), this._mStd(0x0d2333, 0.12, 0.9, { envMapIntensity: 1.8 }));
    canopy.position.set(0, 1.3, -2.6); canopy.scale.set(1, 0.62, 1.4);
    /* seam panels for readable surface detail */
    for (let i = 0; i < 5; i++) {
      const p = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 1.6), mPanel);
      const a = i / 5 * TAU;
      p.position.set(Math.cos(a) * 2.35, Math.sin(a) * 2.35, -1 + (i % 3));
      p.lookAt(0, 0, p.position.z);
      g.add(p);
    }
    const mkWing = (s) => {
      const w = new T.Mesh(new T.BoxGeometry(8.5, 0.28, 3.4), mBody);
      w.position.set(s * 5.2, -0.3, 2.4);
      w.rotation.y = s * -0.42; w.rotation.z = s * 0.06;
      w.castShadow = false;
      return w;
    };
    const fin = new T.Mesh(new T.BoxGeometry(0.26, 3.4, 2.6), mBody);
    fin.position.set(0, 2.1, 3.8); fin.rotation.x = -0.25;
    /* emissive strips + engine indicator panel */
    this.shipStrips = [];
    const stripMat = new T.MeshBasicMaterial({ color: 0x35d6ff });
    for (const sx of [2.2, -2.2]) {
      const strip = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 8), stripMat.clone());
      strip.position.set(sx, 0.6, -0.5);
      g.add(strip);
      this.shipStrips.push(strip);
    }
    const engPanel = new T.Mesh(new T.PlaneGeometry(1.6, 0.5), new T.MeshBasicMaterial({ color: 0x66ffd0 }));
    engPanel.position.set(0, -1.2, 4.2); engPanel.rotation.x = Math.PI / 2.4;
    this.shipEngPanel = engPanel;
    g.add(engPanel);
    /* nav strobes: red port / green starboard / white tail */
    this.navLights = [];
    const mkNav = (x, y, z, color) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      sp.position.set(x, y, z);
      sp.scale.setScalar(1.5);
      g.add(sp);
      this.navLights.push(sp);
      return sp;
    };
    mkNav(-8.6, -0.3, 3.4, 0xff4040);
    mkNav(8.6, -0.3, 3.4, 0x40ff70);
    mkNav(0, 2.4, 4.6, 0xffffff);
    /* RCS ports (visible thruster blocks) */
    this.rcsPorts = [];
    for (const [x, y, z] of [[1.6, 1.1, -5.2], [-1.6, 1.1, -5.2], [2.2, -1.0, 3.6], [-2.2, -1.0, 3.6]]) {
      const port = new T.Mesh(new T.BoxGeometry(0.34, 0.34, 0.34), mDark);
      port.position.set(x, y, z);
      g.add(port);
      this.rcsPorts.push(port);
    }
    /* engine glows */
    this.shipGlows = [];
    for (const sx of [-1.1, 1.1]) {
      const gl = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0x66ecff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      gl.position.set(sx, 0, 5.8); gl.scale.setScalar(3.2);
      this.shipGlows.push(gl); g.add(gl);
    }
    /* Earth-blue rim fill travels with the ship */
    this.shipRim = new T.PointLight(0x4f8fe6, 0, 60, 1.6);
    this.shipRim.position.set(0, -6, 0);
    g.add(this.shipRim);
    this.shipCabin = new T.PointLight(0x9b6bff, 0, 40, 1.6);
    this.shipCabin.position.set(0, 4, -6);
    g.add(this.shipCabin);
    /* V3 §25/§26: antennas, sensor pod, thermal discoloration near engines,
       maintenance panel outlines, hull seam bump, SG marking */
    if (this._detailHero()) {
      const mAnt = this._mStd(0x9aa6b2, 0.4, 0.7);
      for (const [ax, ay, az, len] of [[1.2, 1.9, 1.5, 1.6], [-1.6, 1.6, 2.6, 1.1]]) {
        const ant = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, len, 6), mAnt);
        ant.position.set(ax, ay + len / 2, az);
        const tip = new T.Mesh(new T.SphereGeometry(0.07, 6, 5), new T.MeshBasicMaterial({ color: 0xff7a5a }));
        tip.position.set(ax, ay + len, az);
        g.add(ant, tip);
      }
      const pod = new T.Mesh(new T.BoxGeometry(0.6, 0.4, 0.9), mDark);
      pod.position.set(0, -1.6, -4.6);
      const lens = new T.Mesh(new T.SphereGeometry(0.14, 8, 6), this._mStd(0x0d2333, 0.15, 0.9, { envMapIntensity: 1.8 }));
      lens.position.set(0, -1.6, -5.12);
      g.add(pod, lens);
      /* thermal discoloration ring near the engines (§26) */
      const heat = new T.Mesh(new T.CylinderGeometry(2.75, 2.95, 1.6, 20, 1, true),
        this._mStd(0x6b5546, 0.55, 0.65, { transparent: true, opacity: 0.55, depthWrite: false }));
      heat.rotation.x = Math.PI / 2;
      heat.position.z = 3.9;
      g.add(heat);
      /* maintenance panel outlines */
      const mOutline = this._mStd(0x2b333c, 0.6, 0.4);
      for (const [mx, my, mz] of [[1.7, 0.9, -1.4], [-1.7, 0.6, 0.6], [0.8, -1.5, 1.8]]) {
        const mp = new T.Mesh(new T.BoxGeometry(0.9, 0.05, 1.2), mOutline);
        mp.position.set(mx, my, mz);
        mp.lookAt(0, my, mz);
        g.add(mp);
      }
      /* hull seam bump + SG mark */
      try {
        const sc = document.createElement('canvas'); sc.width = 128; sc.height = 128;
        const c2 = sc.getContext('2d');
        c2.fillStyle = '#808080'; c2.fillRect(0, 0, 128, 128);
        c2.strokeStyle = '#707070'; c2.lineWidth = 2;
        for (let yy = 12; yy < 128; yy += 26) { c2.beginPath(); c2.moveTo(0, yy); c2.lineTo(128, yy); c2.stroke(); }
        for (let xx = 16; xx < 128; xx += 34) { c2.beginPath(); c2.moveTo(xx, 0); c2.lineTo(xx, 128); c2.stroke(); }
        const bump = new T.CanvasTexture(sc);
        bump.wrapS = bump.wrapT = T.RepeatWrapping; bump.repeat.set(3, 2);
        mBody.bumpMap = bump; mBody.bumpScale = 0.02; mBody.needsUpdate = true;
      } catch (e) { /* seams optional */ }
      const mark = new T.Mesh(new T.PlaneGeometry(1.8, 0.9), new T.MeshBasicMaterial({ map: textTex(['SG'], '#35d6ff', null, 96, 48, 34), transparent: true }));
      mark.position.set(2.05, 0.2, -2.2);
      mark.rotation.y = Math.PI / 2;
      const mark2 = mark.clone(); mark2.position.x = -2.05; mark2.rotation.y = -Math.PI / 2;
      g.add(mark, mark2);
    }
    g.add(hullC, nose, tail, canopy, mkWing(1), mkWing(-1), fin);
    g.visible = false;
    this.ship = g;
    this.gSpace.add(g);
    this._rcsT = rand(5, 11);
  }
  /* SG WORLD OBJECTS — no real orbital data available offline, so these are
     explicitly fictional SG relays (clearly classified, spec §49). 1–2 only,
     different depths, one crossing near the ship for parallax. */
  _bSatellites() {
    if (this.safeMode) { console.log('[SG SAFE] satellites skipped'); this.sats = []; return; }
    if (this._fail.has('satellites')) throw new Error('injected satellite service failure');
    this.sats = [];
    const mk = (name, orbitR, speed, tilt, phase, scale) => {
      const s = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 2.2), this._mStd(0xb9c2cc, 0.4, 0.7, { envMapIntensity: 1.3 }));
      const panelM = this._mStd(0x1c3a66, 0.35, 0.6, { envMapIntensity: 1.4 });
      const pL = new T.Mesh(new T.BoxGeometry(4.6, 0.06, 1.6), panelM);
      pL.position.x = -3;
      const pR = pL.clone(); pR.position.x = 3;
      const dish = new T.Mesh(new T.SphereGeometry(0.7, 10, 7, 0, TAU, 0, Math.PI / 2), this._mStd(0xe6ebf0, 0.4, 0.4));
      dish.position.z = -1.4; dish.rotation.x = -Math.PI / 2;
      const led = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0x35d6ff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
      led.scale.setScalar(1.1); led.position.y = 1;
      s.add(body, pL, pR, dish, led);
      s.scale.setScalar(scale);
      s.visible = false;
      s.userData = { name, orbitR, speed, tilt, phase, led };
      this.gSpace.add(s);
      this.sats.push(s);
    };
    mk('SG RELAY-01', 210, 0.045, 0.18, rand(0, TAU), 1.0);   /* near, crosses view */
    mk('SG RELAY-02', 460, 0.02, -0.3, rand(0, TAU), 1.6);    /* far, slow parallax */
    /* register their scanner targets now that the objects exist — target
       registration must never assume the space assets are built (P0 root
       cause: _registerTargets read this.sats before _bSatellites ran) */
    if (!this._satTargetsDone) {
      this._satTargetsDone = true;
      this.sats.forEach((sat) => {
        this.targets.push({
          id: 'info-' + sat.userData.name, kind: 'info',
          getPos: () => sat.getWorldPosition(new T.Vector3()),
          valid: () => (this.chapter === 'orbit' || this.chapter === 'charge') && sat.visible,
          range: 1e9, scanTime: 0.9,
          label: () => sat.userData.name,
          cls: 'SG',
        });
      });
    }
  }

  /* ============================== WARP / HUB ============================= */
  /* FTL v2 — three streak populations (close/mid/far) + central distortion
     handled by post uniforms (spec §55/§56) */
  _bWarp() {
    if (this.warpPops) return;
    this.warpPops = [];
    const mkPop = (N, rMin, rMax, colNear, colFar, alpha, stretch) => {
      const pos = new Float32Array(N * 2 * 3);
      const off = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) {
        const a = rand(0, TAU), r = rand(rMin, rMax);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const z = rand(-900, -40);
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z - 1;
        off[i * 2] = 0; off[i * 2 + 1] = 1;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('aEnd', new T.BufferAttribute(off, 1));
      geo.boundingSphere = new T.Sphere(new T.Vector3(), 5000);
      const U = { uSpeed: { value: 0 }, uScroll: { value: 0 } };
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
        uniforms: U,
        vertexShader: [
          'attribute float aEnd; varying float vE; uniform float uSpeed,uScroll;',
          'void main(){ vE=aEnd;',
          ' vec3 p=position;',
          ' float z=mod(p.z+uScroll,860.0)-900.0;',
          ' p.z=z - aEnd*uSpeed*mix(4.0,' + stretch.toFixed(1) + ',uSpeed);',
          ' gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);',
          '}',
        ].join('\n'),
        fragmentShader: [
          'varying float vE; uniform float uSpeed;',
          'void main(){',
          ' vec3 c=mix(vec3(' + colNear + '),vec3(' + colFar + '),vE);',
          ' gl_FragColor=vec4(c,(' + alpha + ')*(0.10+0.9*uSpeed));',
          '}',
        ].join('\n'),
      });
      const lines = new T.LineSegments(geo, mat);
      lines.frustumCulled = false;
      this.gWarp.add(lines);
      this.warpPops.push({ lines, U });
    };
    const pre = this._preset();
    const k = pre.part;
    mkPop(Math.round(240 * k), 3, 30, '0.85,0.97,1.0', '0.55,0.9,1.0', 0.9, 150);   /* close: fast, bright */
    mkPop(Math.round(520 * k), 22, 90, '0.55,0.85,1.0', '0.7,0.6,1.0', 0.6, 90);    /* mid */
    mkPop(Math.round(700 * k), 70, 190, '0.45,0.6,1.0', '0.62,0.5,0.95', 0.35, 40); /* far star streaks */
    /* subtle corridor core glow */
    this.warpCore = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: 0x9fd8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    this.warpCore.position.set(0, 0, -640);
    this.warpCore.scale.setScalar(420);
    this.gWarp.add(this.warpCore);
    /* FTL rim planes so the ship is lit by the streaks (spec §54) */
    this.ftlRims = [];
    for (const [color, x] of [[0x66e4ff, -2.6], [0x9b6bff, 2.6]]) {
      const rim = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      rim.scale.set(3.2, 9.5, 1);
      rim.position.set(x, 0, 0);
      this.ftlRims.push(rim);
    }
  }
  queueHub() {
    if (this._hubQueued) return;
    this._hubQueued = true;
    this._q('hubGalaxy0', () => this._bHubGalaxy(0));
    this._q('hubGalaxy1', () => this._bHubGalaxy(1));
    this._q('hubGalaxy2', () => this._bHubGalaxy(2));
    this._q('hubSpace', () => this._bHubSpace());
  }
  /* ======================= GALAXY HUB V3.4 REDESIGN ======================
     Three destinations, three RADICALLY different bodies (adicional §7-§17):
       G01 CONÓCEME  — energetic elongated twin-stream, pulse rings, orbital
                       lines, fast. Speed made visible.
       G02 SEBAS     — THE hero: grand deep 4-arm spiral, bulge, halo stars,
                       star-forming magenta regions, carved dust, majestic.
       G03 STAR MARK — golden BARRED spiral: central bar, two ordered arms,
                       node network, subtle rings. Structure made visible.
     Placed in real X/Y/Z with distinct tilts, scales and depths — never a
     menu row (adicional §3). Distinguishable in silhouette alone (§39/§40). */
  _bHubGalaxy(gi) {
    if (!this.galaxyGroups) this.galaxyGroups = [];
    const per = this._tierN({ ultra: 6400, high: 5200, perf: 3400, mobile: 2400 });
    const centers = [
      new T.Vector3(-470, 170, -640),        /* G01: high left, closer */
      new T.Vector3(30, -70, -1060),         /* G02: deep centre, dominant */
      new T.Vector3(460, 60, -500),          /* G03: right, nearest, tilted */
    ];
    const gal = GALAXIES[gi];
    const grp = new T.Group();
    const c1 = new T.Color(0xffffff), c2 = new T.Color(gal.color), c3 = new T.Color(gal.color2);
    const hotC = new T.Color(0xbfe8ff), warmC = new T.Color(gi === 2 ? 0xffe9c4 : 0xffd9a8);
    const sfC = new T.Color(0xff9ad4);       /* star-forming pink (G02) */
    const tmp = new T.Color();
    let R, n;
    if (gi === 0) { R = 100; n = Math.round(per * 0.85); }
    else if (gi === 1) { R = 250; n = Math.round(per * 1.35); }
    else { R = 122; n = Math.round(per * 0.95); }
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    const extras = {};
    let i = 0, guard = 0;
    if (gi === 0) {
      /* -------- G01: ENERGETIC TWIN-STREAM (elongated, fast) -------- */
      while (i < n && guard++ < n * 30) {
        const t = Math.pow(Math.random(), 0.72);
        const stream = Math.random() < 0.5 ? 0 : Math.PI;
        const a = stream + t * 2.1 + rand(-0.16, 0.16) * (1 - t * 0.5);
        const rr = t * R * 1.5;
        const x = Math.cos(a) * rr * 1.3;
        const z = Math.sin(a) * rr * 0.5;
        const y = gauss2() * (1.6 + (1 - t) * 4.5);
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        tmp.copy(c1).lerp(c2, sstep(0.02, 0.4, t)).lerp(c3, sstep(0.5, 1, t));
        const roll = Math.random();
        if (roll < 0.10) tmp.lerp(hotC, 0.9);
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
        sz[i] = rand(1.0, 2.9) * (t < 0.08 ? 2.1 : 1);
        i++;
      }
      /* thin orbital lines + a pulse ring animated in the hub update (§8) */
      extras.rings = [];
      for (const rk of [0.5, 0.82]) {
        const ring = new T.Mesh(new T.RingGeometry(R * rk * 0.985, R * rk, 72),
          new T.MeshBasicMaterial({ color: 0x7fe4ff, transparent: true, opacity: 0.075, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(1.3, 0.5, 1);
        grp.add(ring);
        extras.rings.push(ring);
      }
      extras.pulse = new T.Mesh(new T.RingGeometry(0.96, 1, 64),
        new T.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
      extras.pulse.rotation.x = Math.PI / 2;
      grp.add(extras.pulse);
      /* radial energy streaks near the core, spun fast in the update */
      const sn = 26;
      const spos = new Float32Array(sn * 2 * 3);
      for (let s2 = 0; s2 < sn; s2++) {
        const a = rand(0, TAU), r0 = rand(4, 12), r1 = r0 + rand(10, 26);
        spos[s2 * 6] = Math.cos(a) * r0 * 1.3; spos[s2 * 6 + 1] = rand(-1, 1); spos[s2 * 6 + 2] = Math.sin(a) * r0 * 0.5;
        spos[s2 * 6 + 3] = Math.cos(a) * r1 * 1.3; spos[s2 * 6 + 4] = rand(-1, 1); spos[s2 * 6 + 5] = Math.sin(a) * r1 * 0.5;
      }
      const sgeo = new T.BufferGeometry();
      sgeo.setAttribute('position', new T.BufferAttribute(spos, 3));
      sgeo.boundingSphere = new T.Sphere(new T.Vector3(), R);
      extras.streaks = new T.LineSegments(sgeo, new T.LineBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false }));
      grp.add(extras.streaks);
    } else if (gi === 1) {
      /* -------- G02: GRAND DEEP SPIRAL — the hub's hero object -------- */
      const ARMS = 4;
      /* star-forming seeds ON the arms + blue clusters */
      const sf = [];
      for (let s2 = 0; s2 < 6; s2++) {
        const rr = rand(0.34, 0.9) * R;
        const arm = (Math.random() * ARMS) | 0;
        const a = (arm / ARMS) * TAU + rr * 0.011;
        sf.push([Math.cos(a) * rr, Math.sin(a) * rr, rand(9, 18)]);
      }
      const clusters = [];
      for (let s2 = 0; s2 < 5; s2++) {
        const rr = rand(0.3, 0.85) * R, a = rand(0, TAU);
        clusters.push([Math.cos(a) * rr, Math.sin(a) * rr, rand(8, 15)]);
      }
      while (i < n && guard++ < n * 30) {
        const roll0 = Math.random();
        let x, y, z, rr, tint = 0;
        if (roll0 < 0.17) {                          /* BULGE — deep core */
          rr = Math.abs(gauss2()) * R * 0.15;
          const a = rand(0, TAU);
          x = Math.cos(a) * rr; z = Math.sin(a) * rr;
          y = gauss2() * R * 0.055;
        } else if (roll0 < 0.24) {                   /* STELLAR HALO */
          const v = new T.Vector3().randomDirection().multiplyScalar(Math.pow(Math.random(), 0.6) * R * 1.3);
          x = v.x; z = v.z; y = v.y * 0.62;
          rr = Math.hypot(x, z);
          tint = 3;
        } else if (roll0 < 0.30 && sf.length) {      /* STAR-FORMING REGION */
          const s2 = sf[(Math.random() * sf.length) | 0];
          x = s2[0] + gauss2() * s2[2]; z = s2[1] + gauss2() * s2[2];
          y = gauss2() * 3.2; rr = Math.hypot(x, z);
          tint = 1;
        } else if (roll0 < 0.36 && clusters.length) {/* BLUE CLUSTER */
          const s2 = clusters[(Math.random() * clusters.length) | 0];
          x = s2[0] + gauss2() * s2[2]; z = s2[1] + gauss2() * s2[2];
          y = gauss2() * 3.2; rr = Math.hypot(x, z);
          tint = 2;
        } else {                                     /* SPIRAL ARMS */
          rr = Math.sqrt(Math.random()) * R;
          const arm = (Math.random() * ARMS) | 0;
          const spread = rand(-0.30, 0.30) * (1 - rr / R * 0.55);
          const a = (arm / ARMS) * TAU + rr * 0.011 + spread + fbm2(rr * 0.02, arm * 7.7) * 0.42;
          x = Math.cos(a) * rr; z = Math.sin(a) * rr;
          y = gauss2() * (2.2 + (1 - rr / R) * 9);
          /* carved dust lanes riding the arm inner edge */
          const lane = Math.exp(-Math.pow((rr / R - 0.5) / 0.16, 2)) * (0.5 + 0.5 * Math.sin(a * ARMS + rr * 0.045 + 1.2));
          if (Math.random() < lane * 0.85) continue;
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const k = clamp(rr / R, 0, 1);
        tmp.copy(c1).lerp(c2, sstep(0.03, 0.42, k)).lerp(c3, sstep(0.5, 1, k));
        if (tint === 1) tmp.lerp(sfC, 0.75);
        else if (tint === 2) tmp.lerp(hotC, 0.8);
        else if (tint === 3) tmp.multiplyScalar(0.55);
        else {
          const roll = Math.random();
          if (roll < 0.05) tmp.lerp(hotC, 0.85);
          else if (roll > 0.94) tmp.lerp(warmC, 0.7);
        }
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
        sz[i] = rand(1.1, 3.2) * (k < 0.05 ? 1.9 : 1) * (tint === 1 ? 1.35 : 1);
        i++;
      }
    } else {
      /* -------- G03: GOLDEN BARRED SPIRAL (order / network) -------- */
      const BAR = 0.55;                          /* bar orientation */
      const nodes = [];
      while (i < n && guard++ < n * 30) {
        const roll0 = Math.random();
        let x, y, z, rr;
        if (roll0 < 0.30) {                         /* CENTRAL BAR */
          const t = gauss2() * 0.4;
          const bx = t * R * 1.05;
          const bz = gauss2() * R * 0.065;
          x = Math.cos(BAR) * bx - Math.sin(BAR) * bz;
          z = Math.sin(BAR) * bx + Math.cos(BAR) * bz;
          y = gauss2() * (1.8 + (1 - Math.abs(t)) * 3.4);
          rr = Math.hypot(x, z);
        } else if (roll0 < 0.42) {                  /* SUBTLE OUTER RING */
          const a = rand(0, TAU);
          rr = R * (0.92 + gauss2() * 0.04);
          x = Math.cos(a) * rr; z = Math.sin(a) * rr;
          y = gauss2() * 1.8;
        } else {                                    /* TWO ORDERED ARMS from bar ends */
          const end = Math.random() < 0.5 ? 0 : Math.PI;
          const t = Math.pow(Math.random(), 0.8);
          const a = BAR + end + t * 2.4 + rand(-0.09, 0.09);
          rr = R * (0.42 + t * 0.56);
          x = Math.cos(a) * rr; z = Math.sin(a) * rr;
          y = gauss2() * (1.6 + (1 - t) * 3);
          if (Math.random() < 0.02 && nodes.length < 14) nodes.push([x, y, z]);
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const k = clamp(rr / R, 0, 1);
        tmp.copy(c1).lerp(c2, sstep(0.02, 0.4, k)).lerp(c3, sstep(0.5, 1, k));
        const roll = Math.random();
        if (roll < 0.04) tmp.lerp(hotC, 0.6);
        else if (roll > 0.9) tmp.lerp(warmC, 0.8);
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
        sz[i] = rand(1.0, 2.8) * (k < 0.06 ? 1.9 : 1);
        i++;
      }
      /* NODE NETWORK (abstract: projects/brands) — bright golden nodes with
         faint momentary connections, animated in the hub update (§15) */
      extras.nodes = [];
      const npos = new Float32Array(nodes.length * 3);
      nodes.forEach((nd, ni) => { npos[ni * 3] = nd[0]; npos[ni * 3 + 1] = nd[1]; npos[ni * 3 + 2] = nd[2]; });
      const ngeo = new T.BufferGeometry();
      ngeo.setAttribute('position', new T.BufferAttribute(npos, 3));
      ngeo.boundingSphere = new T.Sphere(new T.Vector3(), R * 1.2);
      extras.nodePts = new T.Points(ngeo, new T.PointsMaterial({
        map: this.texBlob, color: 0xfff2d0, size: 7, transparent: true, opacity: 0.9,
        depthWrite: false, blending: T.AdditiveBlending,
      }));
      grp.add(extras.nodePts);
      extras.nodeList = nodes;
      const lgeo = new T.BufferGeometry();
      lgeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6 * 4), 3));
      lgeo.boundingSphere = new T.Sphere(new T.Vector3(), R * 1.2);
      extras.nodeLines = new T.LineSegments(lgeo, new T.LineBasicMaterial({ color: 0xf2d9a4, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      grp.add(extras.nodeLines);
      extras.nodeT = rand(3, 7);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new T.BufferAttribute(sz, 1));
    geo.boundingSphere = new T.Sphere(new T.Vector3(), R * 1.6);
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, fog: false,
      uniforms: { uOp: { value: 0.9 } },
      vertexShader: [
        'attribute float aSize; varying vec3 vC;',
        'void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);',
        ' gl_PointSize=aSize*(560.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vC; uniform float uOp;',
        'void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.06,length(q));',
        ' gl_FragColor=vec4(vC,a*uOp); if(gl_FragColor.a<0.01) discard; }',
      ].join('\n'),
    });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    /* DARK DUST — the darkness also shapes the galaxy (§28) */
    const dustK = gi === 1 ? 5 : 9;
    const dn = Math.round(n / dustK);
    const dpos = new Float32Array(dn * 3);
    let di = 0; guard = 0;
    while (di < dn && guard++ < dn * 40) {
      const rr = (0.42 + rand(-0.12, 0.24)) * R;
      const arm = Math.floor(Math.random() * (gi === 1 ? 4 : 2));
      const a = (arm / (gi === 1 ? 4 : 2)) * TAU + rr * (gi === 1 ? 0.011 : 0.016) + rand(-0.14, 0.14) + (gi === 2 ? 0.55 : 0);
      dpos[di * 3] = Math.cos(a) * rr * (gi === 0 ? 1.3 : 1);
      dpos[di * 3 + 1] = rand(-2.4, 2.4);
      dpos[di * 3 + 2] = Math.sin(a) * rr * (gi === 0 ? 0.5 : 1);
      di++;
    }
    const dgeo = new T.BufferGeometry();
    dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
    dgeo.boundingSphere = new T.Sphere(new T.Vector3(), R * 1.3);
    const dust = new T.Points(dgeo, new T.PointsMaterial({
      map: this.texSoft, color: gi === 2 ? 0x171006 : 0x0c0910, size: gi === 1 ? 16 : 12,
      transparent: true, opacity: gi === 1 ? 0.55 : 0.42, depthWrite: false, blending: T.NormalBlending,
    }));
    dust.frustumCulled = false;
    dust.renderOrder = 3;
    /* CORE STACK + HALO */
    const coreA = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xffffff, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
    coreA.scale.setScalar(R * (gi === 0 ? 0.20 : 0.14));
    const coreB = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: gal.color, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
    coreB.scale.setScalar(R * 0.5);
    const coreC = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: gal.color2, transparent: true, opacity: gi === 1 ? 0.5 : 0.3, blending: T.AdditiveBlending, depthWrite: false }));
    coreC.scale.setScalar(R * 1.0);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: gal.color2, transparent: true, opacity: gi === 1 ? 0.2 : 0.13, blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(R * (gi === 1 ? 2.7 : 2.2));
    if (gi === 2) {                      /* keep the gold from burning */
      coreA.material.opacity *= 0.68;
      coreB.material.opacity *= 0.62;
      coreC.material.opacity *= 0.66;
      halo.material.opacity *= 0.7;
    }
    const collider = new T.Mesh(new T.SphereGeometry(R * 0.72, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    collider.scale.set(gi === 0 ? 1.45 : 1, gi === 0 ? 0.45 : 0.5, gi === 0 ? 0.62 : 1);
    collider.userData.galaxy = gi;
    grp.add(pts, dust, coreA, coreB, coreC, halo, collider);
    grp.position.copy(centers[gi]);
    /* distinct tilts — silhouettes must differ even in greyscale (§39/§40) */
    if (gi === 0) { grp.rotation.x = 0.60; grp.rotation.z = -0.34; }
    else if (gi === 1) { grp.rotation.x = 0.46; grp.rotation.z = 0.10; }
    else { grp.rotation.x = -0.52; grp.rotation.z = 0.22; }
    /* distinct motion — fast / majestic / precise (§41) */
    grp.userData = {
      spin: gi === 0 ? 0.055 : gi === 1 ? 0.011 : -0.02,
      R, pts, core: coreB, halo, collider, baseScale: 1,
      haloK: gi === 2 ? 0.62 : 1, extras,
    };
    this.galaxyGroups.push(grp);
    this.gHub.add(grp);
  }
  _bHubSpace() {
    /* HUB SPACE ALIVE (spec §58): far/mid starfields, few near motes,
       interstellar dust, low-contrast nebula veil — nothing competes */
    const mkField = (N, rMin, rMax, size, op) => {
      const p = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const v = new T.Vector3().randomDirection().multiplyScalar(rand(rMin, rMax));
        p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z;
      }
      const gg2 = new T.BufferGeometry();
      gg2.setAttribute('position', new T.BufferAttribute(p, 3));
      gg2.boundingSphere = new T.Sphere(new T.Vector3(), rMax * 1.2);
      const pts = new T.Points(gg2, new T.PointsMaterial({ map: this.texBlob, color: 0xcfe0ff, size, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: false }));
      pts.frustumCulled = false;
      this.gHub.add(pts);
      return pts;
    };
    this.hubFar = mkField(1400, 2600, 4200, 1.4, 0.5);
    this.hubMid = mkField(520, 1100, 2200, 2.2, 0.6);
    /* near motes drift slowly */
    const nm = 46;
    const np = new Float32Array(nm * 3);
    for (let i = 0; i < nm; i++) { np[i * 3] = rand(-260, 260); np[i * 3 + 1] = rand(-160, 160); np[i * 3 + 2] = rand(-500, -40); }
    const ng = new T.BufferGeometry();
    ng.setAttribute('position', new T.BufferAttribute(np, 3));
    ng.boundingSphere = new T.Sphere(new T.Vector3(), 900);
    this.hubMotes = new T.Points(ng, new T.PointsMaterial({ map: this.texSoft, color: 0x8fb4ff, size: 2.4, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending }));
    this.hubMotes.frustumCulled = false;
    /* ---- V3.4 DEPTH LAYERS (adicional §18-§22) ----
       CAPA 1 FOREGROUND: sparse near dust that crosses the frame on any
       camera movement — the strongest parallax cue. */
    const fgN = this._tierN({ ultra: 40, high: 34, perf: 22, mobile: 14 });
    const fgp = new Float32Array(fgN * 3);
    for (let i = 0; i < fgN; i++) {
      fgp[i * 3] = rand(-320, 320); fgp[i * 3 + 1] = rand(-200, 200); fgp[i * 3 + 2] = rand(-190, -26);
    }
    const fgg = new T.BufferGeometry();
    fgg.setAttribute('position', new T.BufferAttribute(fgp, 3));
    fgg.boundingSphere = new T.Sphere(new T.Vector3(), 600);
    this.hubForeground = new T.Points(fgg, new T.PointsMaterial({
      map: this.texSoft, color: 0x6f8fc0, size: 5.5, transparent: true, opacity: 0.28,
      depthWrite: false, blending: T.AdditiveBlending,
    }));
    this.hubForeground.frustumCulled = false;
    this.gHub.add(this.hubForeground);
    /* CAPA 3.5 NEBULA FIELDS: big procedural gas bodies, edge-faded texture,
       identity per region (cyan / violet / amber) but placed at MIXED depths —
       some IN FRONT of the galaxies so they read as gas you look through. */
    this.hubDust = new T.Group();
    const NEB = [
      [0x2a6a8f, -560, 240, -880, 1300, 620],     /* cyan   — near Conóceme  */
      [0x3fc0e0, -380, 60, -420, 520, 300],       /* cyan   — foreground gas */
      [0x4a3a8a, 140, -120, -1350, 1900, 900],    /* violet — around Sebas   */
      [0x6a4a9a, -40, 40, -760, 800, 420],        /* violet — mid drift      */
      [0x8a6a3a, 560, 140, -760, 1000, 520],      /* amber  — behind StarMark*/
    ];
    for (const [colr, x, y, z, sx, sy] of NEB) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: this.texNebula, color: colr, transparent: true, opacity: rand(0.07, 0.11), blending: T.AdditiveBlending, depthWrite: false }));
      sp.position.set(x, y, z);
      sp.scale.set(sx, sy, 1);
      this.hubDust.add(sp);
    }
    const veil = new T.Sprite(new T.SpriteMaterial({ map: this.texNebula, color: 0x4a3a7a, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false }));
    veil.position.set(120, 60, -2100);
    veil.scale.set(3200, 1500, 1);
    this.hubDust.add(veil);
    /* CAPA 4 DEEP SPACE: distant background galaxies — small, varied
       (face-on / edge-on / elliptical / irregular), never competing (§38) */
    this.bgGalaxies = new T.Group();
    const bgN = this._tierN({ ultra: 10, high: 8, perf: 5, mobile: 3 });
    for (let i = 0; i < bgN; i++) {
      const kind = i % 3;                          /* 0 spiral 1 edge-on 2 elliptical */
      const g2 = new T.Group();
      const hue = [0x9fb8e8, 0xc8b8e8, 0xe8d4b0][i % 3];
      const s = rand(46, 120);
      if (kind === 1) {
        const disc = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: hue, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false }));
        disc.scale.set(s, s * 0.13, 1);            /* edge-on sliver */
        const bulge = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: hue, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
        bulge.scale.setScalar(s * 0.22);
        g2.add(disc, bulge);
      } else if (kind === 2) {
        const el = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: hue, transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false }));
        el.scale.set(s * 0.8, s * 0.6, 1);
        g2.add(el);
      } else {
        const arms = new T.Sprite(new T.SpriteMaterial({ map: this.texNebula, color: hue, transparent: true, opacity: 0.20, blending: T.AdditiveBlending, depthWrite: false }));
        arms.scale.set(s, s * rand(0.5, 0.9), 1);
        const core = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xffffff, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false }));
        core.scale.setScalar(s * 0.16);
        g2.add(arms, core);
      }
      const a = rand(0, TAU);
      g2.position.set(Math.cos(a) * rand(900, 2200), rand(-700, 900), rand(-4200, -2400));
      this.bgGalaxies.add(g2);
    }
    this.gHub.add(this.bgGalaxies);
    /* BLACK HOLE — one, far, ambient secret (adicional §34-§36). Dark disc,
       thin hot accretion ring, tiny glow. No fourth destination, no link. */
    this.blackHole = new T.Group();
    const bhCore = new T.Mesh(new T.SphereGeometry(16, 24, 16), new T.MeshBasicMaterial({ color: 0x000000 }));
    const bhRing = new T.Mesh(new T.RingGeometry(19, 26, 64),
      new T.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.55, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    bhRing.rotation.x = 1.18; bhRing.rotation.y = 0.4;
    const bhRing2 = new T.Mesh(new T.RingGeometry(17.2, 18.4, 64),
      new T.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0.7, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    bhRing2.rotation.x = 1.18; bhRing2.rotation.y = 0.4;
    const bhGlow = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: 0xcc8844, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false }));
    bhGlow.scale.setScalar(90);
    this.blackHole.add(bhCore, bhRing, bhRing2, bhGlow);
    this.blackHole.position.set(-860, 320, -1750);
    this.blackHole.userData = { ring: bhRing, ring2: bhRing2 };
    this.gHub.add(this.blackHole);
    if (!this._bhTargetDone) {
      this._bhTargetDone = true;
      this.targets.push({
        id: 's-blackhole', kind: 'secret', range: 1e9, scanTime: 1.8,
        getPos: () => this.blackHole ? this.blackHole.getWorldPosition(new T.Vector3()) : null,
        valid: () => this.chapter === 'hub',
        label: () => 'ANOMALY DETECTED — CLASSIFICATION // UNKNOWN',
        cls: 'SG',
      });
    }
    /* deep space beacon */
    this.beacon = new T.Mesh(new T.OctahedronGeometry(7), new T.MeshBasicMaterial({ color: 0xf2d9a4 }));
    this.beacon.position.set(560, 170, -1050);
    this.beaconGlow = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xf2d9a4, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }));
    this.beaconGlow.position.copy(this.beacon.position);
    this.beaconGlow.scale.setScalar(30);
    this.gHub.add(this.hubMotes, this.hubDust, this.beacon, this.beaconGlow);
    /* rare hub events pool (one at a time, 20–45 s apart — spec §60/§61) */
    this._hubEvent = null;
    this._hubEventT = rand(20, 45);
    this.evSprite = new T.Sprite(new T.SpriteMaterial({ map: this.texBlob, color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.evSprite.scale.setScalar(6);
    const evg = new T.BufferGeometry();
    evg.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
    this.evLine = new T.Line(evg, new T.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.evLine.frustumCulled = false;
    this.evRing = new T.Mesh(new T.RingGeometry(0.96, 1, 48), new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    this.gHub.add(this.evSprite, this.evLine, this.evRing);
    /* V3.3 hub polish: thin selection ring around the chosen galaxy */
    this.selRing = new T.Mesh(
      new T.RingGeometry(1, 1.045, 64),
      new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })
    );
    this.selRing.visible = false;
    this.gHub.add(this.selRing);
    this.builtHub = true;
  }

  /* ============================ SCAN TARGETS ============================= */
  _registerTargets() {
    const V = (x, y, z) => new T.Vector3(x, y, z);
    /* LAZY TARGETS (P0.1 §31): capture the property NAME, resolve at scan
       time, return null while the object does not exist yet (or failed) */
    const dyn = (key, dy) => () => {
      const obj = this[key];
      return obj ? obj.getWorldPosition(new T.Vector3()).add(V(0, dy || 0, 0)) : null;
    };
    const fix = (v) => () => v;
    const ch = (name) => () => this.chapter === name;
    const reg = (id, getPos, valid, range) => {
      const def = DISCOVERIES.find((d) => d.id === id);
      this.targets.push({
        id, kind: 'core', getPos, valid, range: range || 600,
        scanTime: def.scanTime,
        label: () => (getLanguage() === 'es' ? def.titleES : def.titleEN),
      });
    };
    reg('d-pad-placard', dyn('placard'), ch('facility'), 260);
    reg('d-flame-trench', dyn('deflector', 1), ch('facility'), 320);
    reg('d-weather-mast', dyn('mast', 20), ch('facility'), 420);
    reg('d-fuel-farm', dyn('fuelFarm', 6), ch('facility'), 460);
    reg('d-ground-crew', () => (this.crew && this.crew[0])
      ? this.crew[0].getWorldPosition(new T.Vector3()).add(V(0, 1.4, 0)) : null, ch('facility'), 300);
    reg('d-service-truck', dyn('truck', 1.5), ch('facility'), 380);
    /* re-timed ascent windows (16.6 s liftoff→orbit) */
    reg('d-cloud-deck', fix(V(260, 1250, -420)), () => this.chapter === 'ascent' && this.mt < 6.4, 1e9);
    reg('d-mach-diamonds', () => this.miniRocket
      ? this.miniRocket.getWorldPosition(new T.Vector3()).add(V(0, -18, 0)) : null, () => this.chapter === 'ascentSpace' && this.mt > 7.5 && this.mt < 15.2, 1e9);
    reg('d-stratos-star', () => this.cam.position.clone().add(V(-260, 460, -700)), () => this.chapter === 'ascentSpace' && this.mt > 12.4, 1e9);
    reg('d-terminator', () => this.orbitPts ? this.orbitPts.term : V(0, 0, -1), () => this.chapter === 'orbit', 1e9);
    reg('d-limb', () => this.orbitPts ? this.orbitPts.limb : V(0, 0, -1), () => this.chapter === 'orbit', 1e9);
    reg('d-sunrise-point', () => this.orbitPts ? this.orbitPts.sunrise : V(0, 0, -1), () => this.chapter === 'orbit', 1e9);
    reg('d-sg-ship', dyn('ship', 0), () => this.chapter === 'orbit' && !!(this.ship && this.ship.visible), 1e9);
    ['d-core-01', 'd-core-02', 'd-core-03'].forEach((id, i) => {
      reg(id, () => (this.galaxyGroups && this.galaxyGroups[i])
        ? this.galaxyGroups[i].getWorldPosition(new T.Vector3())
        : V(0, 0, -1), ch('hub'), 1e9);
    });
    reg('d-beacon', () => this.beacon ? this.beacon.position : V(0, 0, -1), ch('hub'), 1e9);
    /* SECRETS (§23) — scanner-detectable, optional, never blocking (§49) */
    this.targets.push({
      id: 's-door', kind: 'secret', range: 240, scanTime: 1.6,
      getPos: () => this.secretDoor ? this.secretDoor.getWorldPosition(new T.Vector3()) : null,
      valid: () => this.chapter === 'facility' && !this.save.secretsFound.includes('door'),
      label: () => (getLanguage() === 'es' ? 'PUERTA CLASIFICADA' : 'CLASSIFIED DOOR'),
    });
    this.targets.push({
      id: 's-fragment', kind: 'secret', range: 260, scanTime: 1.8,
      getPos: () => this.archiveFrag ? this.archiveFrag.getWorldPosition(new T.Vector3()) : null,
      valid: () => this.chapter === 'facility' && !this.save.secretsFound.includes('fragment'),
      label: () => (getLanguage() === 'es' ? 'FRAGMENTO DE ARCHIVO SG' : 'SG ARCHIVE FRAGMENT'),
    });
    /* SG relay targets are registered by _bSatellites when they exist */
  }
  _celestialTargets() {
    this.targets = this.targets.filter((tg) => tg.kind !== 'sky');
    const mk = (name, alt, az, sub) => {
      if (alt <= 2) return;
      const dir = ASTRO.azAltToDir(az, alt);
      const v = new T.Vector3(dir[0], dir[1], dir[2]);
      this.targets.push({
        id: 'sky-' + name, kind: 'sky',
        getPos: () => this.cam.position.clone().add(v.clone().multiplyScalar(6000)),
        valid: () => this.chapter === 'facility' || this.chapter === 'orbit',
        range: 1e9, scanTime: 1.0,
        label: () => name + (sub ? ' — ' + sub : ''),
        sight: name,
        cls: 'REAL',
      });
    };
    const m = this.w.moon;
    mk('MOON', m.alt, m.az, 'ILLUM ' + Math.round(m.illum * 100) + '%');
    this.w.planets.forEach((p) => mk(p.name.toUpperCase(), p.alt, p.az, null));
    /* brightest catalog stars become identifiable when up (spec §68) */
    try {
      const now = this._astroNow || new Date();
      for (let i = 0; i < 10; i++) {
        const [nm, ra, dec, mag] = CEL.STAR_CATALOG[i];
        const aa = ASTRO.raDecToAltAz(ra, dec, now, MEDELLIN.lat, MEDELLIN.lon);
        if (aa.alt > 6) mk(nm, aa.alt, aa.az, 'MAG ' + mag.toFixed(1));
      }
    } catch (e) { /* catalog optional — never blocks (P0 §10) */ }
  }

  /* =============================== INPUT ================================= */
  _bindInput() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      this._idle = 0;
      if (e.isPrimary === false) { this._pointer.pinch = 0; this._p2 = { x: e.clientX, y: e.clientY }; return; }
      this._pointer.down = true; this._pointer.id = e.pointerId;
      this._userDragged = true;
      this._pointer.x = this._pointer.sx = e.clientX;
      this._pointer.y = this._pointer.sy = e.clientY;
      this._pointer.t = performance.now(); this._pointer.moved = 0;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this._pointer.down || e.pointerId !== this._pointer.id) {
        if (this._p2 && e.isPrimary === false) this._p2 = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - this._pointer.x, dy = e.clientY - this._pointer.y;
      this._pointer.x = e.clientX; this._pointer.y = e.clientY;
      this._pointer.moved += Math.abs(dx) + Math.abs(dy);
      this._idle = 0;
      this._dragLook(dx, dy);
      if (this._p2) {
        const d = Math.hypot(e.clientX - this._p2.x, e.clientY - this._p2.y);
        if (this._pointer.pinch) this._zoom((this._pointer.pinch - d) * 0.35);
        this._pointer.pinch = d;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.chapter !== 'hub' || this._pointer.down || this.confirming) return;
      const now = performance.now();
      if (now - (this._rayT || 0) < 90) return;   /* throttle hover raycast */
      this._rayT = now;
      const hit = this._galaxyRayHit(e.clientX, e.clientY);
      this.galaxyHover(hit);
    });
    const up = (e) => {
      if (e.pointerId !== this._pointer.id) { this._p2 = null; this._pointer.pinch = 0; return; }
      const wasTap = this._pointer.moved < 8 && performance.now() - this._pointer.t < 350;
      this._pointer.down = false; this._pointer.id = -1;
      if (wasTap) this._tap(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => {
      if (this.chapter !== 'hub' || this.confirming) return;
      const hit = this._galaxyRayHit(e.clientX, e.clientY);
      if (hit >= 0) this.galaxyConfirm(hit, 'dbl');
    });
    cv.addEventListener('wheel', (e) => { this._zoom(e.deltaY * 0.06); e.preventDefault(); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys[e.code] = true;
      this._idle = 0;
      const k = e.key.toLowerCase();
      if (k === 'f') { this.toggleScanner(); e.preventDefault(); }
      else if (k === 'c') { this.cycleCamera(); }
      else if (k === 'p') { this.togglePhoto(); }
      else if (k === 'x') { this.focusEarth(); }
      else if (k === 'r' && !e.ctrlKey && !e.metaKey) { this.resetOrbitView(); }
      else if (k === 'h') { this.locateHome(); }
      else if (e.code === 'Space' && this.photo) { this.capture(); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('gamepadconnected', () => {
      this.gpIndex = 0;
      this.ui.sgos('SG.OS // ' + t('gamepad_on'));
    });
  }
  _dragLook(dx, dy) {
    const s = this.photo ? 0.005 : 0.0042;
    if (this.photo) {
      this.orb.theta -= dx * s;
      this.orb.phi = clamp(this.orb.phi - dy * s, 0.08, 1.45);
      return;
    }
    if (this.chapter === 'facility') {
      if (this.camMode === 'free') {
        this.free.vyaw -= dx * s * 0.9;
        this.free.vpitch -= dy * s * 0.9;
      } else {
        if (this.camMode === 'director') this._setCamMode('orbit', true); /* grabbing the view hands you the orbit */
        this.orb.theta -= dx * s;
        this.orb.phi = clamp(this.orb.phi - dy * s, 0.06, 1.5);
      }
    } else if (this.chapter === 'orbit' || this.chapter === 'charge') {
      if (this.camMode === 'free') {
        this.free.vyaw -= dx * s * 0.9;
        this.free.vpitch -= dy * s * 0.9;
        this._focusGoal = null;
      } else if (this.camMode === 'orbit') {
        /* EARTH ORBIT: drag orbits the planet (velocity-damped) */
        this.free.vyaw -= dx * s * 0.55;
        this.free.vpitch += dy * s * 0.55;
      } else {
        /* full look — no tiny yaw window (spec §51) */
        this.aim.yaw = this.aim.yaw - dx * s * 1.2;
        this.aim.pitch = clamp(this.aim.pitch - dy * s * 1.2, -1.25, 1.25);
      }
    } else if (this.chapter === 'hub') {
      this.aim.yaw = this.aim.yaw - dx * s * 1.2;
      this.aim.pitch = clamp(this.aim.pitch - dy * s * 1.2, -1.3, 1.35);
    } else if (this.chapter === 'ascent' || this.chapter === 'ascentSpace') {
      this.aim.yaw = clamp(this.aim.yaw - dx * s, -0.3, 0.3);
      this.aim.pitch = clamp(this.aim.pitch - dy * s, -0.25, 0.25);
    }
  }
  _zoom(d) {
    if (this.photo) { this.orb.radius = clamp(this.orb.radius + d, 10, 420); return; }
    if (this.chapter === 'facility') {
      if (this.camMode === 'free') this.free.fov = clamp(this.free.fov + d * 0.35, 34, 78);
      else this.orb.radius = clamp(this.orb.radius + d, 26, 240);
    } else if (this.chapter === 'orbit' || this.chapter === 'charge') {
      if (this.camMode === 'orbit' && this.orbEarth) {
        const o = this.orbEarth;
        o.radius = clamp(o.radius + d * Math.max(6, o.radius * 0.012), (this.earthR || 1400) + 90, (this.earthR || 1400) * 5.5);
      } else if (this.camMode === 'free') this.free.fov = clamp(this.free.fov + d * 0.35, 34, 80);
    }
  }
  _galaxyRayHit(x, y) {
    if (!this.galaxyGroups || !this.galaxyGroups.length) return -1;
    const ndc = new T.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    const rc = new T.Raycaster();
    rc.setFromCamera(ndc, this.cam);
    const colliders = this.galaxyGroups.map((g) => g.userData.collider).filter(Boolean);
    const hits = rc.intersectObjects(colliders, false);
    this._lastRayHit = hits.length ? hits[0].object.userData.galaxy : -1;
    return this._lastRayHit;
  }
  _tap(x, y) {
    if (this.chapter !== 'hub' || this.confirming) return;
    if (!this._arrivalDone) {                 /* any tap after 2 s skips arrival */
      if ((this._arrivalDur - this._arrivalT) > 2) this._arrivalRelease();
      return;
    }
    const hit = this._galaxyRayHit(x, y);
    this._lastDomHit = -1;
    if (hit >= 0) this._galaxyTap(hit);
    else this._galaxyDeselect();              /* click en vacío = deselección */
  }
  /* V3.3 P0: authoritative single/double logic — independent of DOM anchors
     drifting a few pixels between clicks. Works identically for touch
     (second tap on the SAME galaxy) and mouse (real double click ≤ ~420 ms).
     A DOM dblclick listener exists as backup, but THIS decides. */
  _galaxyTap(hit) {
    const now = performance.now();
    const dbl = hit === this.selectedIdx && this._gTapI === hit && (now - (this._gTapT || 0)) < 420;
    this._gTapI = hit; this._gTapT = now;
    if (dbl) this.galaxyConfirm(hit, 'dbl');
    else this.galaxyActivate(hit);
  }
  _galaxyDeselect() {
    if (this.selectedIdx < 0) return;
    this.selectedIdx = -1;
    this.hoverIdx = -1;
    this._selPushT = 0;                      /* preview dolly eases home */
    this._gTapI = -1;
    this.audio.uiHover();
  }
  _pollGamepad(dt) {
    if (this.gpIndex < 0 || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[this.gpIndex];
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.14 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx || ry) {
      this._idle = 0;
      this._dragLook(rx * 620 * dt, ry * 620 * dt);
    }
    if (this.chapter === 'hub' && (lx || ly)) {
      this.hubStrafe.x = clamp(this.hubStrafe.x + lx * 90 * dt, -70, 70);
      this.hubStrafe.y = clamp(this.hubStrafe.y - ly * 60 * dt, -44, 44);
      this._idle = 0;
    }
    const press = (i) => {
      const now = !!(gp.buttons[i] && gp.buttons[i].pressed);
      const was = !!this._gpPrev[i];
      this._gpPrev[i] = now;
      return now && !was;
    };
    if (press(0)) {
      if (this.chapter === 'facility' && this.ctaMode === 'launch') this.handleCTA();
      else if (this.chapter === 'charge' && this.ctaMode === 'warp') this.handleCTA();
      else if (this.chapter === 'hub') {
        const pick = this.hoverIdx >= 0 ? this.hoverIdx : (this.selectedIdx + 1) % 3;
        this.galaxyActivate(pick);
        this._gpHold = 0;
      }
    }
    /* holding the primary button on the current selection confirms (§39) */
    if (this.chapter === 'hub' && this.selectedIdx >= 0 && gp.buttons[0] && gp.buttons[0].pressed) {
      this._gpHold = (this._gpHold || 0) + dt;
      if (this._gpHold > 0.55 && !this.confirming) this.galaxyConfirm(this.selectedIdx);
    } else this._gpHold = 0;
    if (press(2)) this.toggleScanner();
    if (press(4) || press(5)) this.cycleCamera();
    if (press(9)) this.ui.togglePanel('settings');
  }
  _haptic(strong, weak, dur) {
    if (!this.motionOK) return;
    try {
      if (navigator.vibrate) navigator.vibrate(Math.min(200, dur));
      if (this.gpIndex >= 0 && navigator.getGamepads) {
        const gp = navigator.getGamepads()[this.gpIndex];
        const act = gp && gp.vibrationActuator;
        if (act && act.playEffect) act.playEffect('dual-rumble', { duration: dur, strongMagnitude: strong, weakMagnitude: weak });
      }
    } catch (e) {}
  }

  /* ============================== CHAPTERS =============================== */
  /* §56: jump safely to comparable framings by AUTOMATING the real path —
     no state is faked, so production behaviour is untouched. */
  _applyShotMode() {
    const shot = this._shot;
    if (!shot) return;
    const auto = (fn, ms) => setTimeout(() => { try { fn(); } catch (e) {} }, ms);
    /* §67 intro: hold at the fully-readable multilingual moment */
    if (shot === 'intro') return;                 /* hold handled per-frame */
    const LAUNCH_SHOTS = ['maxq', 'stageSep', 'stage2', 'fairing',
      'earthDeparture25', 'earthDeparture50', 'earthDeparture100', 'galaxySelected'];
    if (LAUNCH_SHOTS.indexOf(shot) >= 0) {        /* real path, then hold */
      auto(() => this.skipIntro(), 400);
      auto(() => { if (this.chapter === 'facility') this.handleCTA(); }, 1200);
      return;
    }
    if (shot === 'facility') auto(() => this.skipIntro(), 400);
    if (shot === 'ignition' || shot === 'ascent' || shot === 'orbit') {
      auto(() => this.skipIntro(), 400);
      auto(() => { if (this.chapter === 'facility') this.handleCTA(); }, 1400);
    }
    if (shot === 'hub') {
      auto(() => this.skipIntro(), 400);
      auto(() => { if (this.chapter === 'facility') this.skipFlight(); }, 1400);
    }
  }
  start(opts) {
    this.orb = { theta: -0.7, phi: 0.42, radius: 95, target: new T.Vector3(0, 26, 0) };
    this.orbShip = { theta: 0.6, phi: 0.12, radius: 42 };
    this.aim = { yaw: 0, pitch: 0 };
    this.hubStrafe = { x: 0, y: 0 };
    this._astroTick(true);
    this._weatherTick();
    this.queueFacility();
    if (opts && opts.skip) this._skipToFacility();
    else this._beginIntro();
    this._applyShotMode();
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  _beginIntro() {
    this._setChapter('intro');
    this.ui.showSkipIntro(true);
    this.ui.letterbox(true);
    this.cam.position.set(0, 24, 70);
    this.cam.lookAt(0, 24, 0);
    this._spawnGreetings();
    this.events = [
      { at: 0.2, fn: () => { this.dot.material.opacity = 0.9; } },
      { at: 3.8, fn: () => this._convergeGreetings() },
      { at: 4.4, fn: () => { this.introU.uMode.value = 0; this._introPhase = 'converge'; this._introT0 = this.mt; } },
      { at: 5.0, fn: () => { this.introPts.visible = false; this.dot.scale.setScalar(0.5); } },
      {
        at: 5.4, fn: () => {
          this._introPhase = 'bang'; this._introT0 = this.mt;
          this.introPts.visible = true; this.introU.uMode.value = 1;
          this.ui.flash('#ffffff', 1, 900);
          this.audio.ignitionBoom();
          this._haptic(0.9, 0.5, 320);
          this.dot.material.opacity = 0;
        },
      },
      { at: 6.4, fn: () => { this._showIntroTitle(true); } },
      { at: 9.2, fn: () => { this._showIntroTitle(false); this._beginApproach(); } },
    ];
  }
  /* script classifier (§10): tracking must respect each writing system */
  _greetScript(txt) {
    if (/[\u0600-\u06FF]/.test(txt)) return 'arabic';
    if (/[\u0900-\u097F]/.test(txt)) return 'devanagari';
    if (/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(txt)) return 'cjk';
    if (/[\u0370-\u03FF\u0400-\u04FF]/.test(txt)) return 'grcy';
    return 'latin';
  }
  /* RADIAL / ORBITAL CONTROLLED COMPOSITION (§6): three rings around the
     singularity, golden-angle order, jitter, safe margins, reserved UI
     zones, minimum-separation relaxation. Nothing off-screen, nothing on
     top of the HUD, nothing crowding the centre. */
  _greetLayout(n, W, H) {
    const mobile = W < 640;
    const cx = W / 2, cy = H / 2;
    const marginX = W * 0.055, marginTop = H * 0.13, marginBot = H * 0.15;
    const rings = mobile
      ? [{ r: 0.30, k: 0.42 }, { r: 0.44, k: 0.34 }]
      : [{ r: 0.26, k: 0.46 }, { r: 0.40, k: 0.36 }, { r: 0.52, k: 0.30 }];
    const GA = Math.PI * (3 - Math.sqrt(5));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ring = rings[i % rings.length];
      const a = i * GA + ring.r * 7;                 /* deterministic spread */
      const rr = ring.r * Math.min(W, H) * (1 + Math.sin(i * 2.7) * 0.06);
      pts.push({
        x: cx + Math.cos(a) * rr * (W > H ? 1.28 : 0.98),
        y: cy + Math.sin(a) * rr * 0.92,
        depth: ring.k + Math.abs(Math.sin(i * 1.3)) * 0.5,
        ring: i % rings.length,
      });
    }
    /* relaxation: keep words apart and inside the safe frame */
    const minSep = mobile ? 62 : 96;
    for (let it = 0; it < 24; it++) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pts[j].x - pts[i].x, dy = (pts[j].y - pts[i].y) * 1.7;
        const d = Math.hypot(dx, dy) || 1;
        if (d < minSep) {
          const push = (minSep - d) / d * 0.5;
          pts[i].x -= dx * push; pts[i].y -= dy * push * 0.6;
          pts[j].x += dx * push; pts[j].y += dy * push * 0.6;
        }
      }
      for (const p of pts) {
        p.x = clamp(p.x, marginX + 60, W - marginX - 60);
        p.y = clamp(p.y, marginTop, H - marginBot);
        /* keep the singularity core clear */
        const dx = p.x - cx, dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        const rMin = Math.min(W, H) * 0.15;
        if (d < rMin) { p.x = cx + dx / d * rMin; p.y = cy + dy / d * rMin; }
      }
    }
    return pts;
  }
  _spawnGreetings() {
    const host = this.ui.el.greetings;
    host.innerHTML = '';
    this.greetEls = [];
    const W = window.innerWidth, H = window.innerHeight;
    const mobile = W < 640;
    const n = Math.min(GREETINGS.length, mobile ? 14 : 22);   /* §5/§11 */
    const pts = this._greetLayout(n, W, H);
    const TRACK = { latin: '.2em', grcy: '.09em', cjk: '.04em', devanagari: '0', arabic: '0' };
    for (let i = 0; i < n; i++) {
      const txt = GREETINGS[i];
      const p = pts[i];
      const depth = clamp(p.depth, 0.35, 1);
      const s = document.createElement('span');
      s.className = 'greet greet-' + this._greetScript(txt) + ' ring' + p.ring;
      s.textContent = txt;
      s.style.left = p.x + 'px';
      s.style.top = p.y + 'px';
      const base = mobile ? 15 + depth * 11 : 17 + depth * 21;   /* §11 */
      s.style.fontSize = base.toFixed(0) + 'px';
      s.style.letterSpacing = TRACK[this._greetScript(txt)];
      s.style.opacity = '0';
      /* §9: depth cue ≤0.5px — words stay readable */
      s.style.filter = 'blur(' + ((1 - depth) * 0.5).toFixed(2) + 'px)';
      s.style.transition =
        'opacity .55s ease ' + (i * 0.028).toFixed(2) + 's, transform 1.25s cubic-bezier(.3,.6,.2,1), filter 1s, letter-spacing 1.2s';
      host.appendChild(s);
      /* §8: primary words 0.85–1.0, никогда < ~0.62 */
      const op = 0.62 + depth * 0.38;
      requestAnimationFrame(() => { s.style.opacity = op.toFixed(2); });
      this.greetEls.push(s);
    }
    /* §7/§8: particles dim ~30 % while the words hold, via intro uniform */
    if (this.introU && this.introU.uDim) this.introU.uDim.value = 0.7;
  }
  /* CONVERGENCE (§13): each word curves toward the core, stretches along its
     arc, fragments into a short trail of dots, then hands over to particles */
  _convergeGreetings() {
    if (this.introU && this.introU.uDim) this.introU.uDim.value = 1.0;
    const host = this.ui.el.greetings;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    this.greetEls.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const dx = cx - x0, dy = cy - y0;
      const ang = Math.atan2(dy, dx);
      const bend = (i % 2 ? 1 : -1) * 34;             /* slight curve */
      const mx = dx * 0.45 - Math.sin(ang) * bend;
      const my = dy * 0.45 + Math.cos(ang) * bend;
      s.style.transition = 'transform 1.15s cubic-bezier(.5,.05,.2,1), opacity 1.1s ease, filter 1.1s, letter-spacing 1.1s';
      s.style.letterSpacing = '0em';
      /* two-stage: readable curve first, absorption after (§13) */
      s.style.transform = 'translate(' + mx + 'px,' + my + 'px) rotate(' + (bend * 0.25) + 'deg) scaleX(1.35) scaleY(0.92)';
      setTimeout(() => {
        s.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (bend * 0.6) + 'deg) scale(0.08)';
        s.style.opacity = '0';
        s.style.filter = 'blur(2px)';
      }, 480);
      /* fragmentation: a short trail of dots per word */
      for (let d2 = 0; d2 < 5; d2++) {
        const dot = document.createElement('span');
        dot.className = 'greet-dot';
        dot.style.left = (x0 + rand(-r.width * 0.4, r.width * 0.4)) + 'px';
        dot.style.top = (y0 + rand(-8, 8)) + 'px';
        host.appendChild(dot);
        const dd = 0.15 + d2 * 0.07;
        setTimeout(() => {
          dot.style.transform = 'translate(' + (cx - parseFloat(dot.style.left)) + 'px,' + (cy - parseFloat(dot.style.top)) + 'px) scale(0.2)';
          dot.style.opacity = '0';
        }, 60 + dd * 500);
        setTimeout(() => dot.remove(), 1700);
      }
    });
  }
  _showIntroTitle(on) {
    this.ui.el.introTitle.classList.toggle('show', on);
  }
  _beginApproach() {
    this._setChapter('approach');
    this.gIntro.visible = false;
    this.ui.el.greetings.innerHTML = '';
    this.approach = { from: new T.Vector3(1800, 5200, 3400), to: new T.Vector3(-40, 46, 150) };
    this.events = [
      { at: 0.1, fn: () => this.ui.bootSeq([
        ['SG AEROSPACE NETWORK', true],
        ['IDENTITY UNKNOWN', false],
        ['VISITOR SIGNAL DETECTED', false],
        ['LOCATION LINK — MEDELLÍN // COLOMBIA', false],
        ['SYNC COMPLETE', true],
      ], 300, 500) },
      { at: 0.2, fn: () => this.ui.setChapter('EARTH // AMÉRICA DEL SUR') },
      { at: 3.1, fn: () => {
        const es = getLanguage() === 'es';
        this.ui.bootSeq(es
          ? [['VISITANTE DETECTADO', true], ['AUTORIZACIÓN — INVITADO', false], ['SESIÓN — 001', false]]
          : [['VISITOR DETECTED', true], ['CLEARANCE — GUEST', false], ['SESSION — 001', false]], 300, 600);
      } },
      { at: 3.2, fn: () => this._obj('obj_reach') },
      { at: 2.4, fn: () => this.ui.setChapter('COLOMBIA // ANDES') },
      { at: 4.4, fn: () => this.ui.setChapter('MEDELLÍN // VALLE DE ABURRÁ') },
      { at: 6.2, fn: () => this.ui.banner('SG AEROSPACE LAUNCH FACILITY', 2600) },
      { at: 7.6, fn: () => this._enterFacility() },
    ];
    this.gSurface.visible = true;
  }
  _skipToFacility() {
    this.gIntro.visible = false;
    this._showIntroTitle(false);
    /* FAILSAFE (P0 §9): only the facility is required — space streams later */
    this._drain(() => this.builtFacility);
    if (!this.builtFacility) { this._facilityMinimum(); this.builtFacility = true; }
    this.gSurface.visible = true;
    this._enterFacility(true);
  }
  _enterFacility(instant) {
    if (!this.builtFacility) this._drain(() => this.builtFacility);
    if (!this._targetsDone) {
      try { this._registerTargets(); this._celestialTargets(); } catch (e) { console.error('[SG TARGETS]', e); }
      this._targetsDone = true;
    }
    this._setChapter('facility');
    this.events = [];
    this._setEnv('night');
    this.ui.showSkipIntro(false);
    this.ui.letterbox(false);
    this.ui.cinematic(false);
    this.ui.setChapter('SG AEROSPACE LAUNCH FACILITY — MEDELLÍN');
    this.ui.setSystemsDefault();
    this.ui.showSystems(!this.isTouchSmall());
    /* HUD reduction on first visit (§28-§33): MISSION + SCAN + MENU lead;
       CAM/PHOTO/MAP arrive contextually. Returning visitors get everything. */
    if (this._firstVisit) {
      this.ui.hideActionButtons(['scan']);
      this._revealed = { cam: false, photo: false, sky: false };
    } else {
      this.ui.hideActionButtons(['scan', 'cam', 'photo', 'sky']);
      this._revealed = { cam: true, photo: true, sky: true };
    }
    this.ui.setCTA('launch');
    this.ctaMode = 'launch';
    /* MISSION 001 objective flow at arrival (§11/§12/§13) */
    if (this._objKey === 'obj_reach') this._objDone();
    setTimeout(() => {
      if (this.chapter !== 'facility') return;
      if (!this.save.sg01Contacted) this._obj('obj_contact');
      else this._obj('obj_prepare');
    }, 1600);
    this.ui.setHint(this.isTouch ? t('hint_facility_touch') : t('hint_facility'));
    this.ui.setDiscoveries(this.save.discoveries.length);
    this.ui.setSightings(this.save.celestialSightings.length);
    this.queueSpace();
    this.camMode = 'director';
    this._sysLights = 0;
    this.dirState = { t: 0, seg: 0, skyLook: 0 };
    if (instant) { this.orb.theta = -0.7; this.orb.phi = 0.42; this.orb.radius = 95; }
    else { this.orb.radius = 118; }
    this.audio.setPad(0.12);
    this.audio.setMachinery(0.6);
  }
  /* single entry point for chapter changes — resets the monotonic chapter
     clock, arms the watchdog and feeds the autotest chain (P0 §1/§5/§7) */
  _setChapter(name, base) {
    const prev = this.chapter;
    const chain = ['intro', 'approach', 'facility', 'countdown', 'ascent', 'ascentSpace', 'orbit', 'charge', 'warp', 'hub'];
    if (this._autotest) {
      const i = chain.indexOf(name);
      if (i === 0) console.log('[SG TEST] BOOT PASS');
      if (i > 0 && prev === chain[i - 1]) console.log('[SG TEST] ' + chain[i - 1].toUpperCase() + ' PASS');
    }
    this._lastTransition = prev + ' → ' + name + ' @' + new Date().toISOString().slice(11, 19);
    this.chapter = name;
    this._chBase = base || 0;
    this._chStart = performance.now();
    this.mt = this._chBase;
    this._wdFired = false;
  }
  /* dev watchdog: automatic phases must hand over within budget (P0 §5) */
  _watchdog() {
    if (!(this.debugOn || this._autotest) || this._wdFired) return;
    const WD = { intro: 12.5, approach: 11, countdown: 10, ascent: 9, ascentSpace: 16, orbit: 15.5, charge: 6.5, warp: 6 };
    const NEXT = { intro: 'approach', approach: 'facility', countdown: 'ascent', ascent: 'ascentSpace', ascentSpace: 'orbit', orbit: 'charge', charge: 'warp', warp: 'hub' };
    const max = WD[this.chapter];
    const inChapter = this.mt - this._chBase;   /* mt may start at a base (ascentSpace: 6.4) */
    if (!max || inChapter <= max) return;
    this._wdFired = true;
    console.error('[SG CHAPTER WATCHDOG]', {
      chapter: this.chapter,
      elapsed: +inChapter.toFixed(1),
      expectedNext: NEXT[this.chapter],
      buildQueue: this.buildQueue.map((t) => t.name),
      camMode: this.camMode,
      quality: this._tier(),
      weather: this.w.weatherSrc,
    });
    if (this._autotest) console.error('[SG TEST] FAIL — chapter stuck: ' + this.chapter);
    if (this.debugOn) this._showRecoverBtn(NEXT[this.chapter]);
  }
  _showRecoverBtn(next) {
    if (this._recoverBtn || !next) return;
    const b = document.createElement('button');
    b.textContent = 'RECOVER TO NEXT SAFE STATE (' + next.toUpperCase() + ')';
    b.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:999;padding:8px 14px;font:600 11px monospace;background:#3a0d0d;color:#ffd0d0;border:1px solid #ff6a6a;border-radius:6px;cursor:pointer';
    b.onclick = () => { b.remove(); this._recoverBtn = null; this._recoverNext(); };
    document.body.appendChild(b);
    this._recoverBtn = b;
  }
  _recoverNext() {
    const ch = this.chapter;
    try {
      if (ch === 'intro') this._beginApproach();
      else if (ch === 'approach') this._enterFacility();
      else if (ch === 'countdown') this._liftoff();
      else if (ch === 'ascent') this._whiteoutToSpace();
      else if (ch === 'ascentSpace') this._enterOrbit();
      else if (ch === 'orbit') this._beginCharge();
      else if (ch === 'charge') this._engageWarp();
      else if (ch === 'warp') this._enterHub();
    } catch (e) { console.error('[SG RECOVER FAIL]', e); }
  }
  isTouchSmall() { return this.isTouch && Math.min(window.innerWidth, window.innerHeight) < 760; }

  handleCTA() {
    if (this.ctaMode === 'launch' && this.chapter === 'facility') this._startCountdown();
    else if (this.ctaMode === 'warp' && this.chapter === 'charge') this._engageWarp();
    this.audio.uiBeep();
  }

  /* COUNTDOWN v2 — a visible event every second (spec §26) */
  _startCountdown() {
    this._setChapter('countdown');
    this.ctaMode = null;
    this.ui.setCTA(null);
    this.ui.setHint('');
    this.ui.sgosSuppress(true);
    this.ui.letterbox(true);
    this.ui.cinematic(true);
    this.ui.showTelemetry(false);
    this.scanOff();
    this.audio.setPad(0);
    this._ventRate = 0;
    /* V3.4 §53-§57: the digits are BIG and someone SAYS them. Visual first
       (the count can never depend on audio), voice on top when available. */
    const say = (n) => {
      this.ui.setCount(String(n), true);
      this.audio.countdownSay(t('v_' + n), getLanguage(), n);
    };
    if (this._objKey === 'obj_prepare') this._objDone();
    this._obj('obj_launch');
    this.events = [
      { at: 0.0, fn: () => {
        this.ui.banner('LAUNCH SEQUENCE INITIATED', 1800);
        this.audio.missionLine(t('mc_cleared'), getLanguage());
      } },
      {
        at: 1.0, fn: () => { /* T-5: system lights */
          say(5);
          this.ui.sgos('SG.OS // TOWER SYSTEMS ACTIVE');
          this._sysLights = 1;
          for (const l of this.towerLamps) l.glow.material.opacity = 0.9;
          this.ui.flash('#9fd8ff', 0.12, 260);
        },
      },
      {
        at: 2.0, fn: () => { /* T-4: pressurization vents */
          say(4);
          this.ui.sgos('SG.OS // PRESSURIZATION');
          this._ventRate = 12;
          for (let i = 0; i < 10; i++) this.pSteam.spawn(rand(-3, 3), this.rocketBaseY + 30 + rand(-2, 2), rand(-3, 3), rand(-4, 4), rand(2, 5), rand(-4, 4), rand(1, 1.8), rand(3, 6));
          this.audio.uiHover();
        },
      },
      {
        at: 3.0, fn: () => { /* T-3: more vapor + arm 2 */
          say(3);
          this.ui.sgos('SG.OS // CRYOGENIC VENT INCREASE');
          this._ventRate = 26;
          this._armSwing(this.arm2);
        },
      },
      {
        at: 4.0, fn: () => { /* T-2: arm 1 retracts */
          say(2);
          this.ui.sgos('SG.OS // PAD LIGHTING · UMBILICAL PREP');
          for (const el of this.edgeLights || []) { el.scale.setScalar(1.4); el.material.color.setHex(0x9ff0ff); }
          this._armSwing(this.arm1);
          this.audio.radioBlip();
        },
      },
      {
        at: 5.0, fn: () => { /* T-1: water suppression + pre-ignition + HERO CAM */
          say(1);
          this._cdHero = true;                 /* §15: the last second, up close */
          this.ui.hideObjective();             /* §14: HUD breathes for ignition */
          this._deluge(true);
          this.audio.setWater(1);
          for (let i = 0; i < 8; i++) this.pCore.spawn(rand(-2, 2), 3.4, rand(-2, 2), rand(-2, 2), rand(2, 6), rand(-2, 2), rand(0.25, 0.4), rand(2, 4));
        },
      },
      {
        at: 6.0, fn: () => { /* T-0: IGNITION */
          this._atPass('IGNITION');
          this.ui.setCount('IGNITION');
          this.audio.ignitionBoom();
          this.audio.speak(t('v_ignition'), getLanguage(), { rate: 1.02 });
          this.engineOn = 0.5;
          this.trauma = Math.max(this.trauma, 0.4);
          this._haptic(1, 0.6, 500);
          this.ui.flash('#ffd9a0', 0.30, 460);   /* §19: keep rocket/tower detail */
          /* V3.4 §77: hold-down sparks + dust ring — the pad answers */
          for (let i = 0; i < 26; i++) {
            const a = rand(0, TAU), r = rand(4, 14);
            this.pBurst.spawn(Math.cos(a) * r, 2.6, Math.sin(a) * r,
              Math.cos(a) * rand(8, 26), rand(1, 7), Math.sin(a) * rand(8, 26), rand(0.3, 0.7), rand(1.5, 3.4));
          }
        },
      },
      { at: 7.0, fn: () => this._liftoff() },
    ];
    SAVE.completeMission('launch');
    this.save = SAVE.loadSave();
  }
  _armSwing(arm) {
    if (!arm) return;
    arm.userData.swing = 0;
    if (arm.userData.led) arm.userData.led.material.color.set(0xffa03a);
    this.audio.uiHover();
    for (let i = 0; i < 6; i++) {
      const p = arm.getWorldPosition(new T.Vector3());
      this.pBurst.spawn(p.x - 9, p.y, p.z, rand(-2, 2), rand(-1, 2), rand(-2, 2), rand(0.3, 0.6), rand(2, 4));
    }
  }
  _deluge(on) { this.delugeOn = on; }

  /* LIFTOFF v2 — shot list: PAD LOW → ENGINE CLOSE → TOWER SIDE (surface),
     then TRACKING TELE → CHASE → NEARBODY → STRATO (space). Slow heavy first
     metres, MACH 1 with condensation, brief spectacular MAX-Q, total
     liftoff→orbit ≈ 16.6 s (spec §30–35). */
  _liftoff() {
    this._setChapter('ascent');
    this._atPass('LIFTOFF');
    this.ui.setCount(null);
    this.ui.banner('LIFTOFF', 1900);
    this.audio.speak(t('v_liftoff'), getLanguage(), { rate: 1.0, interrupt: false });
    this.engineOn = 1;
    this.trauma = Math.max(this.trauma, 0.34);
    this._haptic(0.8, 0.9, 900);
    this.audio.setEngine(1);
    this.audio.setWater(1);
    this.camRig = 'PADHERO';
    this._cdHero = false;
    this.userCamLock = false;
    this.ui.showSkipFlight(true);
    this.ui.showTelemetry(true);
    this.ui.showSystems(false);
    this.events = [
      { at: 1.9, fn: () => { if (!this.userCamLock) this.camRig = 'ENGINE'; } },
      { at: 3.4, fn: () => { if (!this.userCamLock) this.camRig = 'TOWERSIDE'; this.audio.setWater(0.4); } },
      { at: 5.1, fn: () => { if (!this.userCamLock) this.camRig = 'TELE'; } },   /* §20 telephoto */
      { at: 5.7, fn: () => this.ui.sgos('SG.OS // CLOUD DECK AHEAD') },
      { at: 6.4, fn: () => this._whiteoutToSpace() },
    ];
  }
  _whiteoutToSpace() {
    this.audio.setEngine(0.8);   /* §61: clouds soak the highs */
    this._atPass('CLOUD BREAK');
    this._ensureSpaceMinimum();
    /* punch through the deck: warm interior flash from the engines, then out
       above a sea of clouds (spec §32) */
    const cloudy = this.w.cloudLow > 0.12;
    /* V3 §21: the punch-through is a BEAT, not a blackout — ~0.35 s peak,
       silhouette + engine glow stay readable through the cloud sea */
    /* V3.4 §87: the punch is a BEAT — peak lower and shorter, never a washout */
    this.ui.flash(cloudy ? '#f2e4cf' : '#e2ebf3', cloudy ? 0.52 : 0.32, cloudy ? 360 : 280);
    this._haptic(0.2, 0.5, 300);
    this.gSurface.visible = false;
    this.gSpace.visible = true;
    this.miniRocket.visible = true;
    this.pSteam.clear();
    this.pSmoke.clear();
    this.pPlume.clear();
    this.pOuter.clear();
    /* V3.4 P0 (§67/§191): the local heat-haze post uniform was only updated by
       _surfaceUpdate, so it stayed FROZEN over the screen after leaving the
       surface — a static refraction disc that visually BENT the rocket at
       Mach 1. Kill it the moment we hand over to space. */
    if (this.post && this.postOK) { this.post.compU.uHeat.value = 0; }
    this.audio.setWater(0);
    this.audio.setMachinery(0);
    /* V3.3 ORIENTACIÓN: the journey is born in Medellín — the reveal shows
       the western hemisphere, sunlit, terminator crossing the frame. SG-world
       staging license (the astronomical sky elsewhere stays real). */
    this._orientEarthHero();
    this._setChapter('ascentSpace', 6.4);   /* mission clock continuous */
    this.aim.yaw = 0; this.aim.pitch = 0;
    this.camRig = 'TRACK';
    this._setEnv('space');
    this.events = [
      { at: 7.2, fn: () => this.audio.setEngine(1) },
      { at: 7.6, fn: () => { if (!this.userCamLock) this.camRig = 'CHASE'; } },
      {
        at: 8.2, fn: () => {
          this.ui.banner('MACH 1', 1300);
          this.audio.missionLine(t('mc_mach1'), getLanguage());
          this._haptic(0.5, 0.7, 260);
          this.trauma = Math.max(this.trauma, 0.18);
          this._transonic = 0.0001;    /* condensation ring + vapor cone */
        },
      },
      { at: 9.6, fn: () => this.ui.sgos('SG.OS // MAX-Q APPROACHING') },
      {
        at: 10.3, fn: () => {          /* brief, spectacular (1.9 s) */
          this._atPass('MAX-Q');
          this.ui.banner('MAX-Q', 1500);
          this.audio.missionLine(t('mc_maxq'), getLanguage());
          this.trauma = Math.max(this.trauma, 0.3);
          this._haptic(0.7, 0.8, 700);
          if (!this.userCamLock) this.camRig = 'NEARBODY';
        },
      },
      { at: 12.2, fn: () => this.ui.banner('MAX-Q PASSED', 1300) },
      { at: 13.2, fn: () => { this._atPass('STRATOSPHERE'); this.audio.setEngine(0.62); this.audio.setWind(0); this.ui.setChapter('STRATOSPHERE'); if (!this.userCamLock) this.camRig = 'STRATO'; } },
      { at: 15.2, fn: () => this._meco() },
      { at: 15.8, fn: () => this._stageSep() },
      { at: 16.6, fn: () => this._stage2Ignite() },
      { at: 17.4, fn: () => this._fairingSep() },
      { at: 18.8, fn: () => this._enterOrbit() },
    ];
  }
  /* ORBIT v2 — 1.2 s of clean Earth contemplation, ship reveal, FTL prep
     available by ~3 s (spec §45); Earth is the reward (spec §86). */
  /* SPACE MINIMUM CONTRACT (P0.1 §18): Earth LOD0 + ship + orbit camera.
     Satellites and Earth HI are explicitly optional. */
  _ensureSpaceMinimum() {
    if (!this.earth) {
      try { this._bEarthCore(); console.warn('[SG FALLBACK] earthCore rebuilt on demand'); }
      catch (e) { console.error('[SG BUILD FAILED_RECOVERABLE]', 'earthCore-fallback', e); }
    }
    if (!this.ship) {
      console.warn('[SG FALLBACK] ship → simplified capsule');
      try {
        const g = new T.Group();
        const m = this._mStd(0xc9d2da, 0.4, 0.6);
        const hull = new T.Mesh(new T.CylinderGeometry(2, 2.6, 9, 14), m);
        hull.rotation.x = Math.PI / 2;
        const nose = new T.Mesh(new T.ConeGeometry(2, 4, 14), m);
        nose.rotation.x = -Math.PI / 2; nose.position.z = -6.5;
        g.add(hull, nose);
        g.visible = false;
        this.ship = g;
        this.gSpace.add(g);
      } catch (e) { /* orbit still runs with camera-only framing */ }
    }
  }
  _meco() {
    this._atPass('MECO');
    this.engineOn = 0;
    this.audio.setEngine(0);
    try { this.audio.setWater(0); } catch (e) {}
    this.ui.banner('MECO', 1100);
    /* residual glow + a last breath of exhaust, then coast in near-silence */
    if (this.miniGlow) this.miniGlow.material.opacity = 0.5;
    if (this.miniRocket) {
      const p = this.miniRocket.position;
      for (let i = 0; i < 10; i++) {
        const v = new T.Vector3().randomDirection().multiplyScalar(rand(4, 14));
        this.pBurst.spawn(p.x, p.y - 16, p.z, v.x, v.y - 6, v.z, rand(0.4, 0.9), rand(5, 10));
      }
    }
    this.audio.radioBlip();
  }
  _stageSep() {
    this._atPass('STAGE 1 SEPARATION');
    this._sepT = 0.0001;
    this.ui.quick('STAGE 1 // SEPARATION');
    this.audio.mechClack();          /* golpe seco mecánico, muy corto */
    this.audio.missionLine(t('mc_stagesep'), getLanguage());
    this._haptic(0.35, 0.4, 120);
    if (this.miniRocket) {
      const p = this.miniRocket.position;
      for (let i = 0; i < 6; i++) this.pBurst.spawn(p.x + rand(-1, 1), p.y + 0.4, p.z + rand(-1, 1), rand(-3, 3), rand(-2, 2), rand(-3, 3), rand(0.3, 0.6), rand(3, 6));
    }
  }
  _stage2Ignite() {
    this._atPass('STAGE 2 IGNITION');
    this._eng2On = 1;
    this.ui.quick('STAGE 2 // IGNITION');
    this.audio.setEngine(0.34);           /* §audio: motor más fino */
    if (this.mGlow2) this.mGlow2.material.opacity = 0.85;
    this._haptic(0.25, 0.3, 140);
  }
  _fairingSep() {
    this._atPass('FAIRING SEPARATION');
    this._fairT = 0.0001;
    this.ui.quick('FAIRING // SEPARATION');
    this.audio.uiSelect();
    this._haptic(0.2, 0.3, 90);
  }
  _enterOrbit() {
    this._ensureSpaceMinimum();
    this._setChapter('orbit');
    this.ui.banner('EARTH ORBIT ACHIEVED', 2400);
    this.audio.missionLine(t('mc_orbit'), getLanguage());
    this.ui.setChapter('LOW EARTH ORBIT');
    this.ui.setTelemetry('<b>SG-L1</b>\nALT 402 KM\nV 7.66 KM/S\nORBIT — STABLE');
    this.ui.showSkipFlight(true);
    this.ui.sgosSuppress(false);
    this.ui.cinematic(false);
    this.audio.setPad(0.35);
    this.audio.setWind(0);
    this.audio.setRain(0);
    SAVE.completeMission('orbit');
    this.save = SAVE.loadSave();
    this._computeOrbitPoints();
    this._celestialTargets();
    this.ui.setHint(t('hint_orbit'));
    this._eng2On = 0;
    this.audio.setEngine(0);
    if (this.miniRocket) {
      this.miniRocket.position.set(24, this.cam.position.y + 6, -210);
      this.miniRocket.rotation.set(-Math.PI / 2 * 0.9, 0, 0.2);
    }
    this._vehDrift = 0;
    this.ui.hideActionButtons([]);      /* §49/§51: HUD breathes for Earth */
    this.camMode = 'director';
    this.aim.yaw = 0; this.aim.pitch = 0;
    for (const s of this.sats || []) s.visible = true;
    this._obj('obj_orbit');
    this.ui.cinematic(true);            /* §49: 2-3 s of pure Earth */
    this.events = [
      { at: 2.3, fn: () => {            /* small line, nothing else (§49) */
        this.ui.cinematic(false);
        this.ui.quick(t('orbit_achieved'));
        if (this._objKey === 'obj_orbit') this._objDone();
      } },
      { at: 2.7, fn: () => {            /* §50: ship AFTER the hero shot */
        if (this.ship) { this.ship.visible = true; this._shipSlide = 0.0001; }
        this._atPass('SHIP REVEAL');
      } },
      { at: 2.9, fn: () => this.ui.revealAction('scan') },   /* §52 staggered */
      { at: 3.3, fn: () => this.ui.revealAction('cam') },
      { at: 3.7, fn: () => this.ui.revealAction('photo') },
      { at: 4.4, fn: () => this._beginDeparture() },
    ];
  }
  _computeOrbitPoints() {
    const C = this.earthCenter, R = this.earthR;
    const sun = this.w.sunDirSpace.clone();
    const camP = new T.Vector3(0, -40, 0);
    const toCam = camP.clone().sub(C).normalize();
    let bestT = null, bestS = null, bestScore = -2, sunScore = -2;
    for (let i = 0; i < 220; i++) {
      const n = new T.Vector3().randomDirection();
      if (n.dot(toCam) < 0.15) continue;
      const d = n.dot(sun);
      const p = C.clone().add(n.clone().multiplyScalar(R + 8));
      if (Math.abs(d) < 0.06 && n.dot(toCam) > bestScore) { bestScore = n.dot(toCam); bestT = p; }
      if (d > -0.02 && d < 0.1) {
        const s = n.dot(toCam) + d;
        if (s > sunScore) { sunScore = s; bestS = p; }
      }
    }
    const limbN = toCam.clone().cross(new T.Vector3(0, 1, 0)).normalize().add(toCam.clone().multiplyScalar(0.4)).normalize();
    this.orbitPts = {
      term: bestT || C.clone().add(new T.Vector3(R, 0.3 * R, 0)),
      sunrise: bestS || C.clone().add(sun.clone().multiplyScalar(R)),
      limb: C.clone().add(limbN.multiplyScalar(R + 40)),
    };
  }
  /* PRE-WARP v2: 2.9 s, staged 25/53/81/100 % + LIGHT SPEED READY (spec §52) */
  /* V3.3 SG DEPARTURE BURN: the ship leaves LEO before warp. Frames:
     A 60 % → B 45 % → C ~32 % → D full disc + space around. Only then does
     ACTIVAR WARP appear — never over a thin orange band. */
  _beginDeparture() {
    if (this._depT) return;
    this._depT = 0.0001;
    this._depDone = false;
    this.ui.banner('SG DEPARTURE BURN', 1400);
    this.ui.sgos('SG.OS // DEPARTURE BURN');
    this.audio.setEngine(0.30);
    this.audio.setPad(0.42);              /* §audio: pad musical muy sutil */
    if (this.shipStrips) for (const st of this.shipStrips) st.material && (st.material.color = st.material.color);
  }
  _departureTick(dt) {
    if (!this._depT || this._depDone) return;
    this._depT = Math.min(1, this._depT + dt / 6.8);
    /* thin blue burn from the ship while we climb out */
    if (this.ship && this.ship.visible && Math.random() < dt * 40) {
      const sp = this.ship.getWorldPosition(this._tmpV3 || (this._tmpV3 = new T.Vector3()));
      this.pCore.spawn(sp.x, sp.y - 0.4, sp.z + 3.4, rand(-0.6, 0.6), rand(-2, 0), rand(7, 11), rand(0.14, 0.22), rand(1.6, 2.6));
    }
    if (this._depT >= 1) {
      this._depDone = true;
      this._atPass('EARTH DEPARTURE');
      this.audio.setEngine(0);
      this.ui.banner('EARTH DEPARTURE COMPLETE', 1500);
      this.ui.sgos('SG.OS // INTERSTELLAR DRIVE READY');
      setTimeout(() => { if (this.chapter === 'orbit' && !this._holdCharge) this._beginCharge(); }, 600);
    }
  }
  _beginCharge() {
    this._setChapter('charge');
    this.charge = 0.0;
    this.audio.warpRiser(3.1);
    const tele = (pc) => this.ui.setTelemetry('<b>SG SHIP // PRE-WARP</b>\nINTERSTELLAR DRIVE\nCHARGE ' + pc + '%' + (pc >= 100 ? '\nLIGHT SPEED READY' : ''));
    this.events = [
      { at: 0.0, fn: () => tele(25) },
      { at: 0.9, fn: () => tele(53) },
      { at: 1.8, fn: () => tele(81) },
      {
        at: 2.9, fn: () => {
          tele(100);
          this.charge = 1;
          this.ctaMode = 'warp';
          this.ui.setCTA('warp');
          this._obj('obj_warp');
          this.audio.uiHover();
        },
      },
    ];
  }
  /* WARP v2 — 3.4 s corridor, FTL-only post FX (spec §53/§56) */
  _engageWarp() {
    if (this.chapter !== 'charge') return;
    this.ctaMode = null;
    this.ui.setCTA(null);
    this.ui.setHint('');
    this._bWarp();
    if (this._objKey === 'obj_warp') this._objDone();
    this._setChapter('warp');
    this.ui.sgosSuppress(true);
    this.ui.cinematic(true);
    this.ui.setChapter('FTL CORRIDOR');
    this.ui.setTelemetry('');
    this.ui.showTelemetry(false);
    this.ui.letterbox(true);
    this.ui.flash('#bfe9ff', 0.8, 600);
    this.audio.warpThump();
    this._haptic(1, 1, 600);
    this.trauma = Math.max(this.trauma, 0.3);
    this.gWarp.visible = true;
    if (this.ship) {
      this.scene.attach(this.ship);
      this.ship.rotation.set(0.05, 0, 0);
      this.ship.visible = true;
    }
    for (const rim of this.ftlRims || []) this.ship.add(rim);
    for (const s of this.sats || []) s.visible = false;
    SAVE.completeMission('warp');
    this.save = SAVE.loadSave();
    this.queueHub();
    this.events = [
      { at: 3.4, fn: () => this._enterHub() },
    ];
  }
  _enterHub() {
    setTimeout(() => { if (this.chapter === 'hub') this._obj('obj_choose'); }, 1200);
    setTimeout(() => {
      if (this.chapter === 'hub' && SAVE.markHint('dbl')) {
        this.ui.quick(t(this.isTouch ? 'hint_dbl_touch' : 'hint_dbl'));
      }
    }, 2600);
    this._drain(() => this.builtHub);
    this._setChapter('hub');
    this.gWarp.visible = false;
    this.gSpace.visible = false;
    this.gHub.visible = true;
    this.audio.setEngine(0);
    this.pSteam.clear(); this.pSmoke.clear(); this.pCore.clear(); this.pPlume.clear();
    for (const rim of this.ftlRims || []) { this.ship.remove(rim); rim.material.opacity = 0; }
    this.skyU.uSpace.value = 1;
    this._heroOrient = false;            /* V3.3: staging license ends */
    this.catU.uVis.value = 0.55;
    this.mwU.uVis.value = 0;
    this.mwGlowU.uVis.value = 0;
    this.faintU.uVis.value = 0.5;
    this.moonMesh.visible = false;
    this.moonHalo.material.opacity = 0;
    this._setEnv('hub');
    this.audio.warpThump();
    this.audio.setPad(0.5);
    this.ui.setChapter('SG GALAXY HUB');
    /* V3.4 (adicional §6): telemetry matches the chapter — never stale ASCENT */
    this.ui.setTelemetry('<b>SG-L1 // DEEP SPACE</b>\nNAV // GALAXY HUB\nDRIVE // STANDBY\nSIGNAL // STABLE');
    this.ui.showTelemetry(!this.isTouchSmall());
    this.ui.showSkipFlight(false);
    this.ui.hideActionButtons(['scan', 'photo']);
    this.cam.position.set(0, 0, 0);
    this.aim.yaw = 0; this.aim.pitch = 0;
    this.hubStrafe.x = 0; this.hubStrafe.y = 0;
    this.camMode = 'free';
    /* V3.4 ARRIVAL (adicional §2/§48/§49): exiting warp is a PLACE, not a
       menu. Exposure recovers, the structures reveal, THEN control returns
       and the names fade in. First arrival ~9 s; repeats a short 3 s beat.
       Autotest and reduced-motion keep the instant path. */
    const firstArrival = SAVE.markHint('hubArrival');
    this._arrivalT = (this._autotest || !this.motionOK || this._shot) ? 0
      : (firstArrival ? 9.0 : 3.2);
    this._arrivalDur = this._arrivalT;
    this._arrivalDone = this._arrivalT <= 0;
    if (!this._arrivalDone) {
      this.ui.letterbox(true);
      this.ui.cinematic(true);
      this.ui.flash('#9fd8ff', 0.65, 900);
      this.exposure = 0.42;                        /* eyes adjust after FTL */
      this.ui.anchorsVisible(false);
      this.ui.hideGalaxy();
      this._arrivalYaw0 = rand(-0.3, 0.3);
    } else {
      this.ui.letterbox(false);
      this.ui.cinematic(false);
      this.ui.flash('#9fd8ff', 0.9, 700);
      this.ui.banner('SG GALAXY HUB', 2200);
      this.ui.setHint(t('hint_hub'));
      this.ui.sgos('SG.OS // NAVIGATION ONLINE — 3 DESTINATIONS');
    }
    this.ui.sgosSuppress(!this._arrivalDone);
    if (this.ship) {
      this.cam.attach(this.ship);
      this.ship.position.set(0, -4.4, -13);
      this.ship.rotation.set(0.06, 0, 0);
      this.ship.visible = true;
    }
    if (this.shipCabin) {
      this.shipCabin.intensity = 6;    /* cockpit stays readable (spec §66) */
      this.shipRim.intensity = 2.2;
      this.shipRim.color.set(0x7a5bd0);
    }
    this.hoverIdx = -1; this.selectedIdx = -1; this.confirming = false;
    this._panelIdx = -1; this._selPush = 0; this._selPushT = 0;
    this._hubEventT = rand(8, 20);
  }
  /* V3.4 ARRIVAL → CONTROL RELEASE (adicional §2): names, hint, interaction */
  _arrivalRelease() {
    if (this._arrivalDone) return;
    this._arrivalDone = true;
    this._arrivalT = 0;
    this.ui.letterbox(false);
    this.ui.cinematic(false);
    this.ui.sgosSuppress(false);
    this.ui.banner('SG GALAXY HUB', 2200);
    this.ui.setHint(t('hint_hub'));
    this.ui.sgos('SG.OS // NAVIGATION ONLINE — 3 DESTINATIONS');
    this.audio.uiHover();
    this._atPass('HUB ARRIVAL RELEASE');
  }

  /* SALTAR INTRO — atomic failsafe (P0.1 §5): cancel intro events, clear
     intro UI, guarantee the facility minimum, then a single clean entry into
     FACILITY with CTA + action buttons. It can never end anywhere else. */
  skipIntro() {
    if (this.chapter !== 'intro' && this.chapter !== 'approach') return;
    try {
      this.events = [];
      this.ui.el.greetings.innerHTML = '';
      this._showIntroTitle(false);
      this.ui.setCount(null);
      this._skipToFacility();
    } catch (e) {
      /* even a mid-skip failure must land in facility, not Lite */
      console.error('[SG SKIP] recovered from', e);
      try { this._facilityMinimum(); this.builtFacility = true; this.gIntro.visible = false; this.gSurface.visible = true; this._enterFacility(true); }
      catch (e2) { console.error('[SG SKIP] hard fallback failed', e2); }
    }
    this.audio.uiBeep();
  }
  skipFlight() {
    if (['facility', 'ascent', 'ascentSpace', 'orbit', 'charge', 'countdown'].includes(this.chapter)) {
      this.engineOn = 0;
      this.audio.setEngine(0);
      this.audio.setWater(0);
      this.ui.sgosSuppress(false);
      this.ui.setCount(null);
      this.ui.setCTA(null);
      this.ctaMode = null;
      /* V3.4 fix: SKIP FLIGHT from 'facility' or 'countdown' (before _liftoff
         ever ran) previously left the FACILITY systems readout (UMBILICAL
         CONNECTED, FLIGHT COMPUTER READY…) stuck on screen all the way into
         the Galaxy Hub — _liftoff() is the only place that normally hides it. */
      this.ui.showSystems(false);
      this.gSurface.visible = false;
      this._bWarp();
      SAVE.completeMission('orbit'); SAVE.completeMission('warp');
      this.save = SAVE.loadSave();
      this.queueHub();
      this._enterHub();
      this.audio.uiBeep();
    }
  }
  escape() {
    if (this.photo) { this.togglePhoto(); return; }
    if (this.scanOn) { this.scanOff(); return; }
    if (this.chapter === 'hub' && this.selectedIdx >= 0 && !this.confirming) {
      this._galaxyDeselect();
    }
  }

  /* ---------------- galaxies (V3 §34-§45 selection model) ----------------
     hoverIdx    → panel PREVIEW, always, for any galaxy (§36)
     selectedIdx → set by first click; freely switchable (§37/§38)
     confirming  → ONLY the panel CTA starts navigation (§39)              */
  galaxyHover(i) {
    if (this.chapter !== 'hub' || this.confirming || !this._arrivalDone) return;
    this.hoverIdx = (typeof i === 'number' ? i : -1);
  }
  galaxyFocus(i) { this.galaxyHover(i); }       /* legacy alias */
  galaxyActivate(i) {
    if (this.chapter !== 'hub' || this.confirming) return;
    if (!this._arrivalDone) { this._arrivalRelease(); return; }   /* tap skips arrival */
    if (i == null || i < 0 || i > 2) return;
    const switching = this.selectedIdx !== i;
    this.selectedIdx = i;
    this.hoverIdx = i;
    if (this._objKey === 'obj_choose') this._objDone();
    if (switching) {
      /* SELECT (never navigate, never block the others): soft preview push */
      this._selPushT = 0.0001;                   /* §40 dolly-in 0.8–1.4 s */
      this.audio.lockTone();
      this._haptic(0.25, 0.4, 90);
      /* V3.4 (adicional §30): RCS answers — the ship starts its slow align */
      if (this.ship && this.rcsPorts && this.rcsPorts.length) {
        const port = this.rcsPorts[(Math.random() * this.rcsPorts.length) | 0];
        const wp = port.getWorldPosition(new T.Vector3());
        for (let s2 = 0; s2 < 6; s2++) this.pBurst.spawn(wp.x, wp.y, wp.z, rand(-2.5, 2.5), rand(0.5, 3), rand(-2.5, 2.5), rand(0.2, 0.45), rand(1.2, 2.4));
      }
      this.ui.quick((getLanguage() === 'es' ? 'SELECCIONADA // ' : 'SELECTED // ') + GALAXIES[i].key.toUpperCase());
    }
  }
  galaxyConfirm(i, src) {
    if (this.chapter !== 'hub' || this.confirming || !this._arrivalDone) return;
    if (typeof i === 'number' && i >= 0 && i <= 2) this.selectedIdx = i;
    if (this.selectedIdx < 0) return;
    const gi = this.selectedIdx;
    const gal = GALAXIES[gi];
    this.confirming = true;
    SAVE.recordDestination(gal.key);
    this.save = SAVE.loadSave();
    if (this._autotest) {            /* §63: verify instantly, never navigate */
      console.log('[SG TEST] GALAXY ' + (src === 'dbl' ? 'DBLCLICK' : 'CTA') + ' PASS (navigation suppressed)');
      this.confirming = false;
      this._confirmT = 0;
      return;
    }
    let navigated = false;
    const go = () => {
      navigated = true;
      try { window.location.assign(gal.url); } catch (e) { window.location.href = gal.url; }
    };
    /* FAILSAFE (V3.3): if for any reason the page did not unload in ~2 s,
       fully restore the Hub — CTA back, interaction back, discreet notice.
       The Galaxy Hub can never stay blocked. */
    setTimeout(() => {
      if (document.hidden || !this.confirming) return;
      this.confirming = false;
      this._confirmT = 0;
      this.ui.enableCTA();
      this.ui.quick(getLanguage() === 'es' ? 'NAVEGACIÓN PENDIENTE — USA EL PANEL' : 'NAVIGATION PENDING — USE THE PANEL');
      void navigated;
    }, 2100);
    if (!this.motionOK) { go(); return; }
    /* CONFIRM CINEMATIC (§42, V3.3: fast — 700-1000 ms felt response) */
    this._confirmT = 0.0001;
    this.audio.warpRiser(1.0);
    this.ui.disableCTA();
    this.ui.banner((getLanguage() === 'es' ? 'RUMBO A ' : 'HEADING TO ') + (getLanguage() === 'es' ? gal.nameES : gal.nameEN), 1000);
    const skip = () => go();
    window.addEventListener('pointerdown', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    setTimeout(go, src === 'dbl' ? 820 : 980);
  }
  /* one place decides what the info panel shows every frame (§36/§38) */
  _galaxyPanelSync() {
    const want = this.confirming ? this.selectedIdx
      : this.hoverIdx >= 0 ? this.hoverIdx
      : this.selectedIdx;
    if (want === this._panelIdx && want >= 0) {
      /* state may still flip preview↔selected on the same index */
      const st = want === this.selectedIdx ? 'selected' : 'preview';
      if (st !== this._panelState) { this._panelState = st; this.ui.showGalaxy(want, st); }
      return;
    }
    this._panelIdx = want;
    if (want < 0) { this._panelState = null; this.ui.hideGalaxy(); return; }
    this._panelState = want === this.selectedIdx ? 'selected' : 'preview';
    this.ui.showGalaxy(want, this._panelState);
  }

  /* ------------------------------- scanner ------------------------------ */
  toggleScanner() {
    if (!['facility', 'ascent', 'ascentSpace', 'orbit', 'charge', 'hub'].includes(this.chapter)) return;
    this.scanOn = !this.scanOn;
    this.ui.scannerShow(this.scanOn);
    if (this.scanOn) { this.audio.radarPing(); this.scanState = { lockT: 0, prog: 0, target: null }; }
    else this.ui.scanBrackets(null);
  }
  scanOff() {
    if (!this.scanOn) return;
    this.scanOn = false;
    this.ui.scannerShow(false);
    this.ui.scanBrackets(null);
  }
  _scanUpdate(dt) {
    if (!this.scanOn) { return; }
    const fwd = new T.Vector3(); this.cam.getWorldDirection(fwd);
    const cp = this.cam.position;
    let best = null, bestAng = 0.23, bestDist = 0;
    for (const tg of this.targets) {
      let pos = null;
      try {
        if (!tg.valid()) continue;
        if (tg.kind === 'core' && this.save.discoveries.includes(tg.id)) continue;
        if (tg.kind === 'sky' && this.save.celestialSightings.includes(tg.sight)) continue;
        pos = tg.getPos();
      } catch (e) { continue; }                /* not-ready targets are ignored */
      if (!pos) continue;
      const to = pos.clone().sub(cp);
      const dist = to.length();
      if (dist > tg.range) continue;
      const ang = fwd.angleTo(to.normalize());
      if (ang < bestAng) { bestAng = ang; best = tg; bestDist = dist; }
    }
    const st = this.scanState;
    if (!best) {
      st.lockT = 0; st.prog = 0; st.target = null;
      this.ui.scanStatus({ state: 'none' });
      this.ui.scanBrackets(null);
      this._scanGlowOff();
      return;
    }
    if (st.target !== best) { st.target = best; st.lockT = 0; st.prog = 0; }
    const signal = 1 - bestAng / 0.23;
    /* HUD brackets on the target: screen pos + distance + class (spec §67/68) */
    let wp = null;
    try { wp = best.getPos(); } catch (e) { wp = null; }
    if (!wp) { this.ui.scanBrackets(null); this._scanGlowOff(); return; }
    const pr = wp.clone().project(this.cam);
    const onScreen = pr.z < 1 && Math.abs(pr.x) < 1 && Math.abs(pr.y) < 1;
    const distTxt = best.kind === 'sky' ? '—' : (bestDist >= 1000 ? (bestDist / 1000).toFixed(1) + ' KM' : Math.round(bestDist) + ' M');
    const cls = best.cls === 'REAL' || best.kind === 'sky' ? 'REAL CELESTIAL OBJECT' : 'SG WORLD OBJECT';
    this.ui.scanBrackets(onScreen ? {
      x: (pr.x * 0.5 + 0.5) * window.innerWidth,
      y: (-pr.y * 0.5 + 0.5) * window.innerHeight,
      dist: distTxt, cls, sig: signal, lock: bestAng < 0.085,
    } : null);
    this._scanGlowAt(wp, bestAng < 0.085);
    if (bestAng < 0.085) {
      st.lockT += dt;
      if (st.lockT < 0.35) {
        this.ui.scanStatus({ state: 'lock', label: best.label(), pct: 0.12 });
        if (st.lockT - dt <= 0) { this.audio.lockTone(); this._scanWave(wp); }
      } else {
        st.prog += dt / best.scanTime;
        if (st.prog >= 1) { this._scanComplete(best); st.target = null; st.prog = 0; st.lockT = 0; }
        else this.ui.scanStatus({ state: 'scanning', pct: st.prog, label: best.label() });
      }
    } else {
      st.lockT = 0;
      st.prog = Math.max(0, st.prog - dt * 0.8);
      this.ui.scanStatus({ state: 'signal', pct: signal, label: best.label() });
    }
  }
  /* temporary rim glow on the scanned object */
  _scanGlowAt(wp, locked) {
    if (!this.scanGlow) {
      this.scanGlow = new T.Sprite(new T.SpriteMaterial({ map: this.texSoft, color: 0x66e4ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
      this.scene.add(this.scanGlow);
    }
    this.scanGlow.position.copy(wp);
    const d = this.cam.position.distanceTo(wp);
    this.scanGlow.scale.setScalar(clamp(d * 0.045, 2.5, 220));
    this.scanGlow.material.opacity = damp(this.scanGlow.material.opacity, locked ? 0.34 : 0.14, 6, 1 / 60);
  }
  _scanGlowOff() {
    if (this.scanGlow) this.scanGlow.material.opacity = damp(this.scanGlow.material.opacity, 0, 8, 1 / 60);
  }
  /* expanding scan wave ring at lock */
  _scanWave(wp) {
    if (!this.scanWaveMesh) {
      this.scanWaveMesh = new T.Mesh(new T.RingGeometry(0.94, 1, 48), new T.MeshBasicMaterial({ color: 0x66e4ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
      this.scene.add(this.scanWaveMesh);
    }
    this.scanWaveMesh.position.copy(wp);
    this._scanWaveT = 0.0001;
    this._scanWaveBase = clamp(this.cam.position.distanceTo(wp) * 0.02, 1.5, 90);
  }
  _scanComplete(tg) {
    this.audio.discoveryChime();
    this._haptic(0.25, 0.5, 160);
    const p = tg.getPos() || this.cam.position.clone();
    for (let i = 0; i < 26; i++) {
      const v = new T.Vector3().randomDirection().multiplyScalar(rand(4, 16));
      this.pBurst.spawn(p.x, p.y, p.z, v.x, v.y, v.z, rand(0.5, 1), rand(4, 9));
    }
    this._scanWave(p);
    this.ui.scanStatus({ state: 'complete', pct: 1, label: tg.label() });
    if (tg.id === 'sg01') {                 /* §12: contact via scanner */
      this._sg01Contact();
      return;
    }
    if (tg.kind === 'secret') {             /* §23: memorable, optional */
      if (tg.id === 's-door') this._secretFound('door', 'secret_door');
      else if (tg.id === 's-fragment') this._secretFound('fragment', 'secret_frag');
      else if (tg.id === 's-blackhole') {
        /* V3.4 (adicional §36): curiosity only — no link, no page, no mission */
        this.ui.sgos('SG.OS // ANOMALY DETECTED — CLASSIFICATION // UNKNOWN');
      }
      return;
    }
    if (tg.kind === 'info') {
      this.ui.sgos('SG.OS // SG WORLD OBJECT — ' + tg.label());
      return;
    }
    if (tg.kind === 'sky') {
      if (SAVE.addSighting(tg.sight)) {
        this.save = SAVE.loadSave();
        this.ui.setSightings(this.save.celestialSightings.length);
        this.ui.sgos('SG.OS // SIGHTING LOGGED — ' + tg.sight);
      }
      return;
    }
    if (SAVE.addDiscovery(tg.id)) {
      this.save = SAVE.loadSave();
      const n = this.save.discoveries.length;
      this.ui.setDiscoveries(n);
      this.ui.sgos('SG.OS // DISCOVERY REGISTERED — ' + String(n).padStart(2, '0') + ' / ' + TOTAL_DISCOVERIES);
      if (n === 3 || n === 8 || n === 13) this._sg01React();
      const INFO = {
        'd-fuel-farm': getLanguage() === 'es'
          ? ['SISTEMA DE COMBUSTIBLE', 'Tres tanques criogénicos alimentan la etapa principal.\nLa escarcha marca el nivel de LOX en tiempo real.']
          : ['FUEL SYSTEM', 'Three cryogenic tanks feed the main stage.\nFrost lines track the live LOX level.'],
        'd-flame-trench': getLanguage() === 'es'
          ? ['DEFLECTOR DE LLAMA', 'Redirige 900 m/s de gases de escape lejos del vehículo.\nEl diluvio de agua protege el hormigón.']
          : ['FLAME DEFLECTOR', 'Redirects 900 m/s of exhaust away from the vehicle.\nThe water deluge protects the concrete.'],
        'd-weather-mast': getLanguage() === 'es'
          ? ['MÁSTIL METEOROLÓGICO', 'Viento, techo de nubes y visibilidad reales de Medellín\nalimentan la decisión GO / NO-GO.']
          : ['WEATHER MAST', 'Real Medellín wind, ceiling and visibility\nfeed the GO / NO-GO decision.'],
      };
      if (INFO[tg.id]) {
        const [ti, bo] = INFO[tg.id];
        setTimeout(() => { if (this.chapter === 'facility') this.ui.infoCard(ti, bo); }, 700);
      }
      if (n >= TOTAL_DISCOVERIES) {
        SAVE.unlockArchive();
        this.save = SAVE.loadSave();
        setTimeout(() => this.ui.banner('SG ARCHIVE UNLOCKED', 2600, true), 900);
      }
    }
  }

  /* ------------------------------ photo mode ---------------------------- */
  setPhotoPreset(k) {
    this._photoPreset = ['natural', 'film', 'deep'].includes(k) ? k : 'natural';
    this.ui.setPhotoPreset(this._photoPreset);
  }
  _photoPresetGrade(g2) {
    /* applied on top of the scene grade ONLY while framing (§40) */
    const k = this._photoPreset || 'natural';
    if (k === 'film') {
      g2.sat *= 1.06;
      g2.gain.multiplyScalar(1.045);
      g2.lift.addScalar(-0.008);
      g2.thresh = Math.max(0.6, g2.thresh - 0.08);
    } else if (k === 'deep') {
      g2.sat *= 0.96;
      g2.lift.b += 0.02;
      g2.gain.r *= 0.985;
      g2.bloom = Math.min(1.2, g2.bloom + 0.08);
    }
    return g2;
  }
  togglePhoto() {
    if (!['facility', 'orbit', 'hub', 'charge'].includes(this.chapter) && !this.photo) return;
    this.photo = !this.photo;
    this.ui.photoMode(this.photo);
    this.timeScale = this.photo ? 0.25 : 1;
    if (this.photo) {
      this._photoSaved = { theta: this.orb.theta, phi: this.orb.phi, radius: this.orb.radius, yaw: this.aim.yaw, pitch: this.aim.pitch };
      this.scanOff();
    } else if (this._photoSaved) {
      this.orb.theta = this._photoSaved.theta; this.orb.phi = this._photoSaved.phi; this.orb.radius = this._photoSaved.radius;
      this.aim.yaw = this._photoSaved.yaw; this.aim.pitch = this._photoSaved.pitch;
    }
    this.audio.uiBeep();
  }
  /* capture v2: no permanent preserveDrawingBuffer — render one frame
     synchronously and read it in the same task (spec §74) */
  capture() {
    SAVE.bumpPhoto();
    this.save = SAVE.loadSave();
    try {
      this._renderFrame();
      const src = this.canvas;
      const out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const g = out.getContext('2d');
      g.drawImage(src, 0, 0);
      const pad = Math.round(out.width * 0.014);
      g.font = Math.round(out.width * 0.013) + 'px monospace';
      g.textAlign = 'right';
      g.fillStyle = 'rgba(234,244,255,0.8)';
      g.fillText('CAPTURED IN UNIVERSO SG', out.width - pad, out.height - pad);
      if (!this.save.lastDestination) {
        g.fillStyle = 'rgba(53,214,255,0.75)';
        g.fillText(t('mission_tag'), out.width - pad, out.height - pad - Math.round(out.width * 0.018));
      }
      const a = document.createElement('a');
      a.download = 'universo-sg-capture.png';
      a.href = out.toDataURL('image/png');
      a.click();
      this.audio.discoveryChime();
      this.ui.flash('#ffffff', 0.5, 400);
    } catch (e) {
      this.ui.sgos('SG.OS // CAPTURE UNAVAILABLE');
    }
  }
  /* CAM v2 — DIRECTOR / ORBIT / FREE with soft blends (spec §11/§12) */
  cycleCamera() {
    if (this.chapter === 'ascent' || this.chapter === 'ascentSpace') {
      const rigs = this.chapter === 'ascent' ? ['PADHERO', 'ENGINE', 'TOWERSIDE', 'TELE'] : ['TRACK', 'CHASE', 'NEARBODY', 'STRATO'];
      this.camRig = rigs[(rigs.indexOf(this.camRig) + 1) % rigs.length];
      this.userCamLock = true;
      this.ui.quick('CAMERA // ' + this.camRig);
      this.audio.uiHover();
      return;
    }
    if (this.chapter === 'facility' || this.chapter === 'orbit' || this.chapter === 'charge') {
      const order = ['director', 'orbit', 'free'];
      const next = order[(order.indexOf(this.camMode) + 1) % order.length];
      this._setCamMode(next);
      /* mode-appropriate control hints (V3.4) */
      if (this.chapter !== 'facility') {
        if (next === 'free') this.ui.setHint(t('hint_free_space'));
        else if (next === 'orbit') this.ui.setHint(t('hint_earth_orbit'));
        else this.ui.setHint(t('hint_orbit'));
      }
      this.audio.uiHover();
      return;
    }
    if (this.chapter === 'hub') {
      this._setCamMode(this.camMode === 'free' ? 'director' : 'free');
      this.audio.uiHover();
    }
  }
  _setCamMode(mode, silent) {
    if (this.camMode === mode) return;
    /* seed FREE from the current camera so the blend lands naturally */
    if (mode === 'free') {
      this.free.pos.copy(this.cam.position);
      const e = new T.Euler().setFromQuaternion(this.cam.quaternion, 'YXZ');
      this.free.yaw = e.y; this.free.pitch = clamp(e.x, -1.396, 1.484);
      this.free.vyaw = 0; this.free.vpitch = 0;
      this.free.fov = this.cam.fov;
    }
    if (mode === 'orbit' && (this.chapter === 'orbit' || this.chapter === 'charge')) {
      /* seed the EARTH orbit from the camera's real position (no jump cut) */
      const C = this.earthCenter || new T.Vector3();
      const dx = this.cam.position.x - C.x, dy = this.cam.position.y - C.y, dz = this.cam.position.z - C.z;
      const d = Math.max((this.earthR || 1400) + 90, Math.hypot(dx, dy, dz));
      this.orbEarth = {
        theta: Math.atan2(dx, dz),
        phi: clamp(Math.asin(dy / (Math.hypot(dx, dy, dz) || 1)), -1.42, 1.42),
        radius: Math.min(d, (this.earthR || 1400) * 5.5),
      };
      this.free.vyaw = 0; this.free.vpitch = 0;
    }
    this.camMode = mode;
    this.camBlend.t = 0;
    this.camBlend.dur = rand(0.45, 0.85);
    this.camBlend.fromPos.copy(this.cam.position);
    this.camBlend.fromQuat.copy(this.cam.quaternion);
    this.camBlend.fromFov = this.cam.fov;
    const label = (mode === 'orbit' && (this.chapter === 'orbit' || this.chapter === 'charge'))
      ? t('cam_earth_orbit') : mode.toUpperCase();
    if (!silent) this.ui.quick('CAMERA // ' + label);
  }

  /* ============================ WORLD DIRECTOR =========================== */
  _astroTick(force) {
    const now = new Date();
    this._astroNow = now;
    const s = ASTRO.sunPosition(now, MEDELLIN.lat, MEDELLIN.lon);
    const m = ASTRO.moonPosition(now, MEDELLIN.lat, MEDELLIN.lon);
    this.w.sun = s; this.w.moon = m;
    const sd = ASTRO.azAltToDir(s.az, s.alt);
    const md = ASTRO.azAltToDir(m.az, m.alt);
    this.w.sunDir.set(sd[0], sd[1], sd[2]);
    this.w.moonDir.set(md[0], md[1], md[2]);
    const ef = ASTRO.sunDirEarthFixed(now);
    this.w.sunDirSpace = new T.Vector3(ef[0], ef[1], ef[2]);
    /* rigid sky rotation: equatorial → SG world (spec §13/§17) */
    const M = ASTRO.equatorialToWorldMatrix(now, MEDELLIN.lat, MEDELLIN.lon);
    const m4 = this._tmpM.set(
      M[0], M[3], M[6], 0,
      M[1], M[4], M[7], 0,
      M[2], M[5], M[8], 0,
      0, 0, 0, 1
    );
    this._skyQTarget.setFromRotationMatrix(m4);
    if (force) this.skyRot.quaternion.copy(this._skyQTarget);
    /* Moon sun-direction in world space for the real terminator */
    const sunOnMoon = this.w.sunDir.clone().sub(this.w.moonDir.clone().multiplyScalar(this.w.sunDir.dot(this.w.moonDir) * 0)).normalize();
    this._moonSunDir = sunOnMoon;
    if (force || this._planetT <= 0) {
      this.w.planets = ASTRO.planetPositions(now, MEDELLIN.lat, MEDELLIN.lon);
      this._planetT = 120;
      if (this._targetsDone) this._celestialTargets();
    }
    this._userPanelCache = null; /* refresh USER OBSERVER panel next open */
    if (s.alt < -4 && m.alt < 0 && !this._sgosFlags.moonDown) {
      this._sgosFlags.moonDown = true;
      this.ui.sgos('SG.OS // MOON BELOW HORIZON');
    }
    if (s.alt < -4 && this.w.planets.some((p) => p.alt > 8) && !this._sgosFlags.planetUp) {
      this._sgosFlags.planetUp = true;
      this.ui.sgos('SG.OS // CELESTIAL OBJECT ON HORIZON — SCANNER READY');
    }
    /* §45: small context for real celestial events — never interrupts */
    try {
      const M = this.w && this.w.moon;
      if (M && M.alt > 4 && M.illum > 0.97 && !this._celNoted.fullmoon) {
        this._celNoted.fullmoon = true;
        this.ui.sgos('SG.OS // CELESTIAL EVENT DETECTED — ' + (getLanguage() === 'es' ? 'LUNA LLENA' : 'FULL MOON'));
      }
      const P = this.w && this.w.planets;
      if (P) for (const pl of P) {
        if (pl.alt > 28 && !this._celNoted['p' + pl.name]) {
          this._celNoted['p' + pl.name] = true;
          this.ui.sgos('SG.OS // ' + (getLanguage() === 'es' ? 'PLANETA VISIBLE — ' : 'VISIBLE PLANET — ') + pl.name.toUpperCase());
          break;
        }
      }
    } catch (e) { /* notes only */ }

  }
  async _weatherTick() {
    this._weatherT = 600;
    try {
      if (this._fail.has('weather')) throw new Error('injected weather service failure');
      const res = await getWeather(MEDELLIN.lat, MEDELLIN.lon);
      this._weatherT = res.retryIn || 600;   /* OFFLINE retries fast, upgrades to LIVE */
      const d = res.data;
      this.w.weather = d;
      this.w.weatherSrc = res.status;
      const key = weatherStatusKey(d);
      this.w.statusKey = key;
      SAVE.setLastWeather(key);
      this.save = SAVE.loadSave();
      this.ui.setWeather({ temp: d.temp, cloud: d.cloud, windSpeed: d.windSpeed, windDir: d.windDir, humidity: d.humidity, src: res.status });
      this.w.cloudLowT = clamp(d.cloudLow + d.cloudMid * 0.4, 0, 1);
      this.w.cloudHighT = clamp(d.cloudHigh, 0, 1);
      this.w.hazeT = clamp(1 - d.visibility / 24000, 0.06, 0.95);
      const rainAmt = key === 'storm' ? 1 : key === 'rain' ? clamp(0.35 + d.precip * 0.4, 0.3, 0.9) : 0;
      this.w.rainT = rainAmt;
      const wRad = (d.windDir + 180) * Math.PI / 180;
      const wMs = d.windSpeed / 3.6;
      this.w.windXT = Math.sin(wRad) * wMs;
      this.w.windZT = -Math.cos(wRad) * wMs;
      this.w.gust = d.windGusts;
      if (d.pastPrecip > 0.2) this.w.wet = Math.max(this.w.wet, clamp(d.pastPrecip / 6, 0.25, 0.9));
      if (key === 'storm') this.w.nextBolt = this.elapsed + rand(4, 14);
      else this.w.nextBolt = 1e9;
      if (d.windGusts > 28 && !this._sgosFlags.gust) {
        this._sgosFlags.gust = true;
        this.ui.sgos('SG.OS // CROSSWIND DETECTED — ' + Math.round(d.windGusts) + ' KM/H GUSTS');
      }
      if (rainAmt > 0 && !this._sgosFlags.rain) {
        this._sgosFlags.rain = true;
        this.ui.sgos('SG.OS // PRECIPITATION ON PAD — SURFACES WET');
      }
    } catch (e) { this._weatherT = 90; }
  }

  _worldUpdate(dt) {
    const w = this.w;
    w.cloudLow = damp(w.cloudLow, w.cloudLowT, 0.25, dt);
    w.cloudHigh = damp(w.cloudHigh, w.cloudHighT, 0.25, dt);
    w.haze = damp(w.haze, w.hazeT, 0.3, dt);
    w.rain = damp(w.rain, w.rainT, 0.5, dt);
    w.windX = damp(w.windX, w.windXT, 0.4, dt);
    w.windZ = damp(w.windZ, w.windZT, 0.4, dt);
    if (w.rain > 0.08) w.wet = clamp(w.wet + dt / 55 * w.rain, 0, 1);
    else w.wet = clamp(w.wet - dt / 620, 0, 1);

    const sunAlt = w.sun.alt;
    const dayK = sstep(-8, 10, sunAlt);
    const duskK = sstep(-8, 4, sunAlt) * (1 - sstep(4, 18, sunAlt));
    const nightK = 1 - sstep(-10, -2, sunAlt);
    const space = this.skyU.uSpace.value;
    this._dayK = dayK; this._nightK = nightK;

    /* rigid sky rotation eased toward the latest astro solution */
    this.skyRot.quaternion.slerp(this._skyQTarget, 1 - Math.exp(-0.6 * dt));

    /* sky uniforms */
    this.skyU.uSunDir.value.copy(w.sunDir).normalize();
    this.skyU.uDay.value = dayK;
    this.skyU.uCloud.value = w.cloudLow;
    this.skyU.uHaze.value = w.haze;
    this.skyU.uCityI.value = nightK * (0.5 + w.haze * 0.5) * (this.gSurface.visible ? 1 : 0);

    /* star / Milky Way visibility — Sun, clouds, haze and Moon glare all gate
       it; the band never shows through an overcast sky (spec §18/§19) */
    const moonGlare = w.moon.alt > 0 ? w.moon.illum * 0.45 : 0;
    const starVis = clamp((1 - dayK) * (1 - w.cloudLow * 0.9) * (1 - w.haze * 0.5) * (1 - moonGlare), 0, 1);
    if (this.chapter !== 'hub') {
      this.catU.uVis.value = Math.max(space, starVis);
      this.faintU.uVis.value = Math.max(space * 0.9, starVis * 0.85);
      const mwVis = space > 0.5 ? 0.65 : Math.pow(starVis, 1.7) * Math.pow(1 - w.cloudLow, 1.6) * (1 - moonGlare * 1.2);
      this.mwU.uVis.value = clamp(mwVis, 0, 1);
      this.mwGlowU.uVis.value = clamp(mwVis, 0, 1);
    }
    this.catU.uTime.value = this.elapsed;
    this.mwU.uTime.value = this.elapsed;
    this.faintU.uTime.value = this.elapsed;

    /* MOON disc: real position, phase-lit, occluded by clouds, halo only near
       the horizon with haze; below horizon → gone (spec §14) */
    if (!this.gHub.visible) {
      const up = w.moon.alt > -0.6 && space < 0.5 && this.gSurface.visible;
      this.moonMesh.visible = up || (space > 0.5 && this.gSpace.visible && w.moon.alt > -30);
      if (this.moonMesh.visible) {
        this._moonDirS.lerp(w.moonDir, 1 - Math.exp(-1.2 * dt)).normalize();
        this.moonMesh.position.copy(this._moonDirS).multiplyScalar(8400).add(this.cam.position.clone().multiplyScalar(space > 0.5 ? 1 : 0));
        if (space <= 0.5) this.moonMesh.position.copy(this._moonDirS).multiplyScalar(8400);
        this.moonMesh.scale.setScalar(clamp((w.moon.angDiam || 0.52) / 0.53, 0.9, 1.12));
        this.moonMesh.lookAt(this.cam.position);
        this.moonMesh.rotateY(Math.PI);
        this.moonU.uSunDir.value.copy(w.sunDir);
        this.moonU.uDim.value = clamp((1 - w.cloudLow * 0.92) * (1 - w.haze * 0.35), 0.04, 1) * (space > 0.5 ? 1 : 1);
        const nearHorizon = sstep(14, 2, w.moon.alt);
        this.moonHalo.position.copy(this.moonMesh.position);
        this.moonHalo.material.opacity = nearHorizon * w.haze * 0.4 * (1 - w.cloudLow) * (1 - space) * (0.3 + w.moon.illum * 0.7);
      } else {
        this.moonHalo.material.opacity = 0;
      }
    }

    /* LIGHTS — motivated hierarchy (spec §1/§2/§25) */
    const cloudCut = 1 - w.cloudLow * 0.62;
    if (dayK > 0.32 || space > 0.5) {
      /* real sun key */
      this.sunL.intensity = (0.15 + 2.3 * dayK) * cloudCut * (1 - space) + (space > 0.5 ? 2.6 : 0);
      /* ONE sun (V3.4 §171): while the Earth-hero staging is active the ship,
         Earth, clouds and key light all answer to the same _heroSun */
      const spaceSun = (this._heroOrient && this._heroSun) ? this._heroSun : (this.w.sunDirSpace || w.sunDir);
      this.sunL.position.copy(space > 0.5 ? spaceSun : w.sunDir).multiplyScalar(1200);
      this.sunL.color.setHSL(0.09 + 0.02 * dayK, 0.6, 0.55 + 0.25 * dayK);
      if (duskK > 0.3) this.sunL.color.setRGB(1, 0.6 + 0.3 * dayK, 0.4);
      if (this.sunTarget) this.sunTarget.position.set(0, 10, 0);
    } else {
      /* INDUSTRIAL KEY: at night the same shadow light becomes the tower
         flood — fixed direction from the tower head toward the pad */
      this.sunL.intensity = 1.0 * (this.gSurface.visible ? 1 : 0);
      this.sunL.position.set(150, 240, 70);
      this.sunL.color.setRGB(1.0, 0.93, 0.82);   /* warm industrial white */
      if (this.sunTarget) this.sunTarget.position.set(0, 6, 0);
    }
    this.moonL.intensity = (w.moon.alt > 0 ? 0.30 * w.moon.illum : 0) * nightK * (1 - w.cloudLow * 0.75) * (1 - space);
    this.moonL.position.copy(w.moonDir).multiplyScalar(1000);
    /* SKY AMBIENT: deep blue at night; ground picks up faint amber city bounce */
    this.hemi.intensity = (0.24 + dayK * 0.84) * (1 - space * 0.9);   /* deeper night ambient */
    this.hemi.color.setRGB(lerp(0.16, 0.75, dayK), lerp(0.22, 0.83, dayK), lerp(0.42, 1, dayK));
    this.hemi.groundColor.setRGB(lerp(0.10, 0.35, dayK) + nightK * 0.05, lerp(0.09, 0.34, dayK) + nightK * 0.032, lerp(0.10, 0.30, dayK));
    /* industrial fills */
    const fillK = (1 - dayK * 0.85) * (this.gSurface.visible ? 1 : 0);
    this.fillCyan.intensity = 34 * fillK;
    this.fillTech.intensity = 30 * fillK;
    this.fillAmber.intensity = 22 * fillK;
    if (this.cabinLight) this.cabinLight.intensity = 8 * fillK;

    /* fog / haze — humidity & visibility drive aerial perspective (spec §22) */
    if (this.gSurface.visible) {
      const f = this.scene.fog;
      const fogD = 0.00016 + w.haze * 0.00075 + w.rain * 0.0006 + (w.statusKey === 'fog' ? 0.0028 : 0);
      f.density = damp(f.density, fogD, 0.5, dt);
      const fc = new T.Color().setRGB(lerp(0.030, 0.62, dayK), lerp(0.042, 0.7, dayK), lerp(0.085, 0.8, dayK));
      if (duskK > 0.4) fc.lerp(new T.Color(0.9, 0.55, 0.4), 0.35);
      fc.lerp(new T.Color(0.35, 0.24, 0.12), nightK * 0.10 * (0.5 + w.haze));
      f.color.lerp(fc, 1 - Math.exp(-dt * 2));
    } else {
      this.scene.fog.density = damp(this.scene.fog.density, 0.000001, 2, dt);
    }

    /* LOOK GRADING targets — EARTH NIGHT / ORBIT / GALAXY HUB (spec §82) */
    const G = this.grade;
    if (this.gHub.visible) {
      G.tLift.set(0.006, 0.004, 0.013); G.tGain.set(1.03, 0.98, 1.10);
      G.tSat = 1.08; G.tThresh = 0.8; G.tBloom = 0.95;
    } else if (this.gSpace.visible || this.gWarp.visible) {
      G.tLift.set(0.003, 0.005, 0.010); G.tGain.set(1.0, 1.02, 1.06);
      G.tSat = 1.04; G.tThresh = 0.9; G.tBloom = 0.8;
    } else {
      const nn = nightK;
      G.tLift.set(lerp(0.004, 0.010, nn), lerp(0.005, 0.015, nn), lerp(0.007, 0.028, nn));
      G.tGain.set(lerp(1.0, 0.92, nn), lerp(1.0, 1.01, nn), lerp(1.0, 1.12, nn));
      G.tSat = 1.02; G.tThresh = lerp(1.2, 0.85, nn); G.tBloom = lerp(0.55, 0.9, nn);
    }
    G.lift.lerp(G.tLift, 1 - Math.exp(-1.2 * dt));
    G.gain.lerp(G.tGain, 1 - Math.exp(-1.2 * dt));
    G.sat = damp(G.sat, G.tSat, 1.2, dt);
    G.thresh = damp(G.thresh, G.tThresh, 1.2, dt);
    G.bloom = damp(G.bloom, G.tBloom, 1.2, dt);

    /* exposure adaptation (kept subtle; grading does the heavy lifting) */
    const fwd = new T.Vector3(); this.cam.getWorldDirection(fwd);
    const facingSun = clamp(fwd.dot(w.sunDir), 0, 1) * dayK * (1 - space);
    this.exposureT = space > 0.5 ? 1.02 : lerp(nightK > 0.5 ? 1.16 : 1.0, 0.78, facingSun);
    const rate = this.exposureT < this.exposure ? 2.2 : 0.7;
    this.exposure = damp(this.exposure, this.exposureT, rate, dt);

    /* lightning */
    w.lightning = Math.max(0, w.lightning - dt * 3.4);
    if (this.elapsed > w.nextBolt && this.gSurface.visible && w.statusKey === 'storm') {
      w.nextBolt = this.elapsed + rand(14, 44);
      w.lightning = 1;
      this.ui.flash('#dfe9ff', 0.7, 300);
      this.audio.thunder(rand(0.4, 2.2));
      this.trauma = Math.max(this.trauma, 0.12);
    }
    this.hemi.intensity += w.lightning * 1.6;

    /* ambience audio */
    const windLevel = clamp(Math.hypot(w.windX, w.windZ) / 12, 0.06, 1) * (this.gSurface.visible ? 1 : 0);
    this.audio.setWind(windLevel * (1 - space));
    this.audio.setRain(w.rain * (this.gSurface.visible ? 1 : 0));
    /* distant ground-control radio at the facility (spec §70) */
    if (this.chapter === 'facility') {
      /* V3.2 §16 AMBIENT: quiet motion while the visitor rests */
      if (this.cabinWhip) this.cabinWhip.rotation.z = Math.sin(this.elapsed * 1.1) * 0.05 + Math.sin(this.elapsed * 3.7) * 0.015;
      this._cryoT = (this._cryoT || 0) - dt;
      if (this._cryoT <= 0) {
        this._cryoT = rand(0.5, 1.1);
        const tx = -52 + ((Math.random() * 3) | 0) * 9;
        for (let ci = 0; ci < 3; ci++) this.pSteam.spawn(tx + rand(-0.6, 0.6), 10.4, -44 + rand(-0.6, 0.6), rand(-1.5, 1.5), rand(1.2, 2.4), rand(-1.5, 1.5), rand(1.4, 2.4), rand(2, 4));
      }
      this._sg01Tick(dt);
      /* first-visit contextual HUD (§29-§33): controls appear when useful */
      if (this._firstVisit) {
        if (!this._revealed.sky && this.mt > 6) { this._revealed.sky = true; this.ui.revealAction('sky'); }
        if (!this._revealed.cam && (this.mt > 10 || this._userDragged)) {
          this._revealed.cam = true;
          this.ui.revealAction('cam');
          this.ui.quick(this.isTouch ? 'CAM' : 'C // CAM');
        }
        if (!this._revealed.photo && this.mt > 14) { this._revealed.photo = true; this.ui.revealAction('photo'); }
      }
      /* teach SCAN once, exactly when it becomes useful (§51) */
      if (!this._hotHintDone && !this.scanner && this.mt > 4 && this._reticleNearTarget()) {
        this._hotHintDone = true;
        if (SAVE.markHint('scan')) this.ui.quick(t('scan_available') + (this.isTouch ? '' : ' · F'));
      }
      this._radioT -= dt;
      if (this._radioT <= 0) {
        this._radioT = rand(22, 55);
        this.audio.radioBlip();
        /* UNKNOWN TRANSMISSION (§23): rare, once, purely narrative */
        if (!this.save.secretsFound.includes('transmission') && Math.random() < 0.22) {
          this._secretFound('transmission', 'secret_trans');
          SAVE.bumpRareEvent();
          this.save = SAVE.loadSave();
        }
      }
    }

    if (this.gSurface.visible) this._surfaceUpdate(dt);
    else if (this.post && this.postOK && this.post.compU.uHeat.value > 0) {
      /* belt & braces for the frozen-heat bug: off-surface, heat always decays */
      this.post.compU.uHeat.value = damp(this.post.compU.uHeat.value, 0, 8, dt);
    }
    if (this.gSpace.visible) this._spaceEnvUpdate(dt);
  }

  _orientEarthHero() {
    if (!this.earth) return;
    /* local direction of (lat,lon) under three r161 SphereGeometry mapping:
       x=-cosφ·sinθ, y=cosθ, z=sinφ·sinθ with θ=(90-lat), φ=(lon+180)/360·2π
       — the same equirectangular convention the canvas maps use. */
    const lat = 6.2442 * Math.PI / 180, lon = -75.5812;
    const th = Math.PI / 2 - lat, ph = (lon + 180) / 360 * TAU;
    const pl = new T.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).normalize();
    const target = new T.Vector3(0, 0.92, 0.39).normalize();  /* faces the rigs */
    this._heroQ = new T.Quaternion().setFromUnitVectors(pl, target);
    this._heroSun = new T.Vector3(0.46, 0.60, 0.66).normalize(); /* day + visible terminator */
    this._heroOrient = true;
  }
  _spaceEnvUpdate(dt) {
    if (this._heroOrient) {
      /* V3.3 cinematic staging: América sunlit under the rigs; clouds keep an
         independent slow drift on top of the hero orientation */
      this.earthU.uSun.value.copy(this._heroSun);
      this.earthCloudU.uSun.value.copy(this._heroSun);
      this.earth.quaternion.copy(this._heroQ);
      this.earth.rotation.x = this.earth.rotation.z = 0;
      this.earthClouds.quaternion.copy(this._heroQ);
      this.earthClouds.rotateY(this.elapsed * 0.0035);
    } else {
      /* Earth rotates with real GMST; clouds drift independently (spec §44) */
      this.earthU.uSun.value.copy(this.w.sunDirSpace);
      this.earthCloudU.uSun.value.copy(this.w.sunDirSpace);
      const rotY = ASTRO.gmstDeg(new Date()) * Math.PI / 180;
      this.earth.rotation.y = rotY;
      this.earthClouds.rotation.y = rotY + this.elapsed * 0.0035;
    }
    void dt;
  }

  _surfaceUpdate(dt) {
    const w = this.w;
    const dayK = this._dayK, nightK = 1 - sstep(-6, 4, w.sun.alt);
    const drift = 1 + Math.hypot(w.windX, w.windZ) * 0.5;
    for (const sp of this.clouds || []) {
      const u = sp.userData;
      const k = u.band === 'low' ? w.cloudLow : w.cloudHigh;
      const frac = u.band === 'low' ? this.cloudFrac : 1;
      sp.material.opacity = damp(sp.material.opacity, u.baseOp * sstep(0.06, 0.85, k) * frac * 0.8 * u.depth, 0.6, dt);
      sp.position.x += w.windX * drift * dt * 2.2 * u.depth;
      sp.position.z += w.windZ * drift * dt * 2.2 * u.depth;
      const r = Math.hypot(sp.position.x, sp.position.z);
      if (r > 3900) { sp.position.x *= -0.96; sp.position.z *= -0.96; }
      sp.material.color.setRGB(lerp(0.10, 1, dayK) + nightK * 0.03, lerp(0.115, 1, dayK) + nightK * 0.032, lerp(0.16, 1, dayK) + nightK * 0.05);
    }
    if (this.cloudShadow) {
      this.cloudShadow.material.opacity = w.cloudLow * 0.32 * sstep(-2, 12, w.sun.alt);
      this.cloudShadow.position.x = (this.cloudShadow.position.x + w.windX * dt * 2.4 + 4000) % 800 - 400;
      this.cloudShadow.position.z = (this.cloudShadow.position.z + w.windZ * dt * 2.4 + 4000) % 800 - 400;
    }
    if (this.rain) {
      this.rain.mat.opacity = w.rain * 0.55;
      if (w.rain > 0.02) this.rain.update(dt, w.windX, w.windZ, this.cam.position.x, this.cam.position.z);
    }
    /* wet ground: progressive roughness / reflections / limited puddles */
    if (this.matAsphalt) {
      this.matAsphalt.roughness = lerp(0.95, 0.22, w.wet);
      this.matAsphalt.envMapIntensity = lerp(0.4, 1.5, w.wet);
      this.matConcrete.roughness = lerp(0.9, 0.3, w.wet);
      const dark = lerp(1, 0.6, w.wet);
      this.matAsphalt.color.setRGB(0.169 * dark, 0.192 * dark, 0.22 * dark);
      for (const pd of this.puddles || []) pd.material.opacity = sstep(0.25, 0.8, w.wet) * 0.85;
    }
    /* frost band breathes on the cryo section */
    if (this.frostBand) this.frostBand.material.opacity = 0.18 + 0.1 * Math.sin(this.elapsed * 0.7) + w.wet * 0.06;
    /* city clusters + valley glow */
    if (this.cityMat) this.cityMat.opacity = nightK * (1 - w.haze * 0.4) * 0.9;
    for (const gl of this.cityGlows || []) gl.material.opacity = nightK * (0.10 + w.haze * 0.16);
    /* floods, lamps, cabin windows, edge lights */
    const nOn = nightK;
    if (this.padLightA) {
      this.padLightA.intensity = nOn * 22;
      this.padLightB.intensity = nOn * 14;
    }
    for (const l of this.towerLamps || []) {
      l.head.material.color.setRGB(0.55 + nOn * 0.45, 0.72 + nOn * 0.28, 0.85 + nOn * 0.15);
      l.glow.material.opacity = (this._sysLights ? 0.9 : nOn * 0.55);
    }
    for (const f of this.floodHeads || []) {
      f.glow.material.opacity = nOn * 0.7;
      if (f.cone) f.cone.material.opacity = nOn * (0.045 + w.haze * 0.05);   /* V3.4: readable beams, never fog soup */
    }
    if (this.capWindow) this.capWindow.material.color.setRGB(1, 0.85, 0.62).multiplyScalar(0.25 + nOn * 0.9);
    if (this.cabinWin) this.cabinWin.material.color.setRGB(1, 0.87, 0.66).multiplyScalar(0.25 + nOn * 0.9);
    for (const el of this.edgeLights || []) el.material.color.setRGB(0.2 + nOn * 0.28, 0.6 + nOn * 0.36, 0.75 + nOn * 0.35);
    for (const hd of this.truckHeads || []) hd.material.opacity = nOn * 0.8;
    if (this.truckBeacon) this.truckBeacon.material.color.setRGB(1, 0.55 + 0.45 * Math.sin(this.elapsed * 6), 0.15);
    if (this.tankBeacon) this.tankBeacon.material.color.setScalar(0.4 + 0.6 * (Math.sin(this.elapsed * 2.4) > 0.4 ? 1 : 0.1));
    if (this.mastBeacon) this.mastBeacon.material.color.setRGB(0.5 + 0.5 * Math.sin(this.elapsed * 3.1 + 1), 0.06, 0.06);
    if (this.lmBeacon) this.lmBeacon.material.color.setRGB(0.4 + 0.6 * (Math.sin(this.elapsed * 2.0 + 2.4) > 0.5 ? 1 : 0.1), 0.05, 0.05);
    /* beacon strobe patterns */
    if (this.towerBeacon) {
      const bl = 0.5 + 0.5 * Math.sin(this.elapsed * 4);
      this.towerBeacon.material.color.setRGB(0.4 + bl * 0.6, 0.05, 0.05);
      this.towerBeaconGlow.material.opacity = bl * 0.55 * (0.4 + nOn * 0.6);
    }
    if (this.towerStrobe) {
      const st = (this.elapsed % 2.2) < 0.08 ? 1 : 0;
      this.towerStrobe.material.color.setScalar(0.15 + st * 0.85);
    }
    if (this.dish) this.dish.rotation.y += dt * 0.35;
    if (this.anemo) {
      this.anemo.rotation.y += dt * (1 + Math.hypot(w.windX, w.windZ) * 1.6);
      this.vane.rotation.y = Math.atan2(w.windX, -w.windZ);
    }
    /* umbilical retract sequence */
    for (const arm of [this.arm1, this.arm2]) {
      if (arm && arm.userData.swing != null && arm.userData.swing < 1) {
        arm.userData.swing = Math.min(1, arm.userData.swing + dt / 1.2);
        arm.rotation.y = -1.9 * sstep(0, 1, arm.userData.swing);
      }
    }
    /* CREW roles: walker / station pair / catwalk / operator — idle life */
    for (const p of this.crew || []) {
      const u = p.userData;
      if (u.role === 'walk') {
        u.a += dt * u.sp * (0.6 + 0.4 * Math.sin(this.elapsed * 0.3 + u.ph));
        p.position.x = Math.cos(u.a) * u.r;
        p.position.z = Math.sin(u.a) * u.r;
        p.rotation.y = -u.a;
        p.position.y = Math.abs(Math.sin(this.elapsed * 6 + u.ph)) * 0.06;
        if (u.arms) { u.arms[0].rotation.x = Math.sin(this.elapsed * 6 + u.ph) * 0.5; u.arms[1].rotation.x = -Math.sin(this.elapsed * 6 + u.ph) * 0.5; }
      } else if (u.role === 'station') {
        /* inspection sway + occasional tablet check */
        p.position.y = Math.sin(this.elapsed * 0.9 + u.ph) * 0.02;
        const tablet = (Math.sin(this.elapsed * 0.23 + u.ph) > 0.55) ? 0.9 : 0.15;
        if (u.arms) { u.arms[0].rotation.x = damp(u.arms[0].rotation.x, -tablet, 2, dt); u.arms[1].rotation.x = damp(u.arms[1].rotation.x, -tablet, 2, dt); }
      } else if (u.role === 'catwalk') {
        u.t += dt * u.sp * (Math.sin(this.elapsed * 0.11 + u.ph) > 0 ? 1 : -1);
        u.t = clamp(u.t, 0, 1);
        p.position.set(lerp(12.4, 18.6, u.t), u.y + 0.55, 3.1);
        p.rotation.y = Math.PI / 2;
        p.position.y += Math.abs(Math.sin(this.elapsed * 5 + u.ph)) * 0.05;
      } else if (u.role === 'operator') {
        /* stands by the moving truck, checks it as it passes */
        const tp = this.truck.position;
        p.position.set(tp.x + Math.cos(this.truckT) * -3, 0, tp.z + Math.sin(this.truckT) * -3);
        p.rotation.y = -this.truckT + Math.PI / 2;
      }
    }
    if (this.truck) {
      this.truckT += dt * 0.1;
      const r = 96;
      this.truck.position.set(Math.cos(this.truckT) * r, 0, Math.sin(this.truckT) * r);
      this.truck.rotation.y = -this.truckT + Math.PI / 2;
    }
    /* ambient vents: rocket cryo boil-off + tower mid vent */
    const ventBase = this.chapter === 'countdown' ? (this._ventRate || 8) : 8;
    if (this.rocket && Math.random() < dt * ventBase && this.chapter !== 'ascent') {
      const wp = new T.Vector3(2.6, this.rocket.position.y + 30, 1.5);
      this.pSteam.spawn(wp.x, wp.y, wp.z, rand(1, 3), rand(2.5, 4), rand(-0.5, 0.5), rand(1.2, 2), rand(2.5, 5));
    }
    if (Math.random() < dt * 0.5 && this.towerVent) {
      for (let i = 0; i < 5; i++) this.pSteam.spawn(this.towerVent.x, this.towerVent.y, this.towerVent.z, rand(-4, -1), rand(0.5, 2), rand(-1, 1), rand(0.8, 1.4), rand(2, 4));
    }
    /* deluge water → huge steam volumes (spec §29) */
    if (this.delugeOn && Math.random() < dt * 60) {
      for (const sx of [-16, 16]) {
        this.pSteam.spawn(sx, 3, rand(-14, 14), -sx * 1.6 + rand(-3, 3), rand(6, 12), rand(-3, 3), rand(0.8, 1.4), rand(4, 8));
      }
    }
    /* ENGINE EXHAUST v2 — layered core / plume / smoke / steam, wind-aware,
       lit from the ignition point; IGNITION is the hero light (spec §27/§28) */
    if (this.engineOn > 0 && this.rocket) {
      const nzY = this.rocket.position.y - 1.2;
      const rate = 260 * this.engineOn;
      const n = Math.min(22, Math.floor(rate * dt) + (Math.random() < rate * dt % 1 ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const ox = rand(-1.6, 1.6), oz = rand(-1.6, 1.6);
        /* CORE (§19): tiny, near-white, blinding, short-lived */
        this.pCore.spawn(ox * 0.6, nzY, oz * 0.6, ox * 2 + rand(-2, 2), rand(-78, -62), oz * 2 + rand(-2, 2), rand(0.14, 0.26), rand(3.5, 6));
        /* PRIMARY PLUME: white → amber, turbulent, varied life/size */
        if (i % 2 === 0) this.pPlume.spawn(ox * 1.4, nzY - 1.5, oz * 1.4, ox * 5 + rand(-6, 6), rand(-54, -30), oz * 5 + rand(-6, 6), rand(0.4, 1.0), rand(6, 13));
        /* OUTER GAS: blue-grey, very transparent, expanding */
        if (i % 3 === 0) this.pOuter.spawn(ox * 2.2, nzY - 2.2, oz * 2.2, ox * 7 + rand(-8, 8), rand(-30, -12), oz * 7 + rand(-8, 8), rand(1.0, 1.9), rand(9, 16));
        if (i % 2 === 0) this.pSmoke.spawn(ox * 2, Math.max(2.4, nzY - 3), oz * 2, rand(-6, 6), rand(-24, -10), rand(-6, 6), rand(1.8, 3.2), rand(10, 20));
      }
      const flick = 0.85 + 0.15 * Math.sin(this.elapsed * 40) + 0.05 * Math.sin(this.elapsed * 173);
      this.engineL.intensity = 320 * this.engineOn * flick;
      this.engineL.position.set(this.rocket.position.x, Math.max(4, nzY - 4), this.rocket.position.z);
      this.trenchL.intensity = 180 * this.engineOn * flick;
      this.trenchL.position.set(22, 4, 0);
      this.nozzleGlow.material.opacity = 0.85 * this.engineOn;
      /* smoke & steam pick up the warm key */
      const lp = this.engineL.position, lc = new T.Color(1, 0.55, 0.22);
      this.pSmoke.setLight(lp, lc, 120, 0.9 * this.engineOn);
      this.pSteam.setLight(lp, lc, 110, 0.7 * this.engineOn);
      this.pPlume.setLight(lp, lc, 90, 0.4 * this.engineOn);
      this.pOuter.setLight(lp, lc, 120, 0.5 * this.engineOn);
      this.audio.setEngine(this.engineOn);
    } else {
      this.engineL.intensity = damp(this.engineL.intensity, 0, 4, dt);
      this.trenchL.intensity = damp(this.trenchL.intensity, 0, 4, dt);
      if (this.nozzleGlow) this.nozzleGlow.material.opacity = damp(this.nozzleGlow.material.opacity, 0, 4, dt);
      this.pSmoke.setLight(this._tmpV.set(0, -9999, 0), this._blackC, 60, 0);
    }
    this.pSteam.update(dt, w.windX * 0.6, w.windZ * 0.6, 0.3, 30);
    this.pCore.update(dt, w.windX * 0.2, w.windZ * 0.2, 2.2, 90);
    this.pPlume.update(dt, w.windX * 0.35, w.windZ * 0.35, 2.0, 80);
    this.pOuter.update(dt, w.windX * 0.8, w.windZ * 0.8, 0.9, 60);
    this.pSmoke.update(dt, w.windX, w.windZ, 1.6, 70);
    /* §21 heat-haze driver: engine screen-position + intensity per tier */
    if (this.post && this.postOK) {
      const U = this.post.compU;
      const tier = this._tier();
      const heatK = this.safeMode ? 0 : tier === 'ultra' ? 0.016 : tier === 'high' ? 0.010 : 0;
      let heat = 0;
      if (heatK > 0 && this.engineOn > 0 && this.rocket && this.chapter !== 'ascentSpace') {
        this._tmpV.set(this.rocket.position.x, Math.max(2, this.rocket.position.y - 3), this.rocket.position.z);
        const p = this._tmpV.project(this.cam);
        if (p.z < 1) {
          U.uHeatC.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
          U.uHeatR.value = clamp(34 / Math.max(6, this.cam.position.distanceTo(this.rocket.position)), 0.10, 0.30);
          heat = heatK * this.engineOn;
        }
      }
      U.uHeat.value = damp(U.uHeat.value, heat, 6, dt);
      U.uHeatT.value = this.elapsed;
    }
    /* occasional atmospheric meteor on clear nights (spec §61 allows it here) */
    if (this.safeMode) return;
    this._meteorT -= dt;
    if (this._meteorT <= 0 && nightK > 0.6 && w.cloudLow < 0.35 && this.chapter === 'facility') {
      this._meteorT = rand(70, 190);
      this._meteorLife = 1;
      const a = rand(0, TAU);
      const s = new T.Vector3(Math.cos(a) * 5200, rand(2600, 4200), Math.sin(a) * 5200);
      const d = s.clone().add(new T.Vector3(rand(-1600, 1600), rand(-1400, -700), rand(-1600, 1600)));
      const pa = this.meteor.geometry.attributes.position.array;
      pa[0] = s.x; pa[1] = s.y; pa[2] = s.z; pa[3] = d.x; pa[4] = d.y; pa[5] = d.z;
      this.meteor.geometry.attributes.position.needsUpdate = true;
    }
    if (this._meteorLife > 0) {
      this._meteorLife -= dt * 1.6;
      this.meteor.material.opacity = clamp(this._meteorLife, 0, 1) * 0.8;
    } else this.meteor.material.opacity = 0;
  }

  /* ============================== CAMERAS ================================ */
  /* Per-frame GOAL (pos/quat/fov) from the active mode, then a global soft
     blend between mode switches: 0.45–0.85 s pos+quaternion+FOV (spec §12). */
  _cameraUpdate(dt) {
    const c = this.cam;
    /* V3.4 DEPTH PRECISION (root cause of the "missing cloud blocks" on the
       far Earth): near=0.1 with far=30000 leaves ~15 world-units of depth
       quantization at 6000 units out — MORE than the 11 units separating the
       cloud shell from the surface, so cloud fragments randomly lost the
       depth test in quantized patches. On the surface chapters the camera
       gets close to railings (near stays tight); in space the closest object
       is metres away, so the near plane widens and precision recovers ~20×. */
    const wantNear = this.gSurface.visible ? 0.1 : 2.0;
    if (c.near !== wantNear) { c.near = wantNear; }
    this._camGoal(dt);
    const b = this.camBlend;
    if (b.t < 1) {
      b.t = Math.min(1, b.t + dt / b.dur);
      const k = b.t * b.t * (3 - 2 * b.t);
      c.position.lerpVectors(b.fromPos, this._goalPos, k);
      c.quaternion.slerpQuaternions(b.fromQuat, this._goalQuat, k);
      c.fov = lerp(b.fromFov, this._goalFov, k);
    } else {
      c.position.copy(this._goalPos);
      c.quaternion.copy(this._goalQuat);
      c.fov = damp(c.fov, this._goalFov, 5, dt);
    }
    /* trauma shake — only when justified (spec §31) */
    this.trauma = Math.max(0, this.trauma - dt * 0.55);
    const sh = this.trauma * this.trauma * (this.motionOK ? 1 : 0.15);
    if (sh > 0.0001) {
      c.rotation.x += (vnoise2(this.elapsed * 31, 3.7) - 0.5) * sh * 0.06;
      c.rotation.y += (vnoise2(this.elapsed * 29, 8.1) - 0.5) * sh * 0.06;
      c.rotation.z += (vnoise2(this.elapsed * 27, 1.3) - 0.5) * sh * 0.03;
    }
    c.updateProjectionMatrix();
  }
  _lookGoal(pos, look, fov) {
    this._goalPos.copy(pos);
    this._tmpM.lookAt(pos, look, this._up);
    this._goalQuat.setFromRotationMatrix(this._tmpM);
    this._goalFov = fov;
  }
  /* V3.4 P0 FIX (root cause of "Earth reduced to a strip", §25/§189/§192):
     several call sites pass `this._tmpV` itself as `pos` (e.g.
     `this._yawPitchGoal(this._tmpV.set(x,y,z), ...)`). The old body wrote the
     look-target INTO `this._tmpV` before calling lookAt(pos, target, up) —
     since pos WAS that same object, eye and target collapsed to one point,
     Matrix4.lookAt degenerated to identity, and the intended pitch (e.g. the
     −24.7° tilt that frames the Earth Hero limb at 55% of frame) silently
     became 0. Copy the eye into the dedicated `_goalPos` FIRST and do all
     subsequent math from that stable copy — never from the possibly-aliased
     `pos` again. */
  _yawPitchGoal(pos, yaw, pitch, fov) {
    this._goalPos.copy(pos);
    const cp = Math.cos(pitch);
    this._tmpV.set(this._goalPos.x + Math.sin(yaw) * cp, this._goalPos.y + Math.sin(pitch), this._goalPos.z - Math.cos(yaw) * cp);
    this._tmpM.lookAt(this._goalPos, this._tmpV, this._up);
    this._goalQuat.setFromRotationMatrix(this._tmpM);
    this._goalFov = fov;
  }
  _camGoal(dt) {
    const c = this.cam;
    if (this.photo) {
      const o = this.orb;
      const tgt = this.chapter === 'hub' ? this._tmpV2.set(0, 0, -620) :
        (this.chapter === 'orbit' || this.chapter === 'charge') ? this.ship.getWorldPosition(this._tmpV2) : o.target;
      const x = tgt.x + o.radius * Math.cos(o.phi) * Math.sin(o.theta);
      const z = tgt.z + o.radius * Math.cos(o.phi) * Math.cos(o.theta);
      const y = tgt.y + o.radius * Math.sin(o.phi);
      const gy = this.gSurface.visible ? this.terrainHSafe(x, z) + 1.6 : -1e9;
      this._lookGoal(this._tmpV.set(x, Math.max(y, gy), z), tgt, 55);
      return;
    }
    if (this.chapter === 'intro') {
      this._lookGoal(this._tmpV.set(0, 24, lerp(70, 52, sstep(0, 6, this.mt))), this._tmpV2.set(0, 24, 0), this._introPhase === 'bang' ? 74 : 60);
      return;
    }
    if (this.chapter === 'approach') {
      const k = sstep(0, 7.4, this.mt);
      const p = this.approach.from.clone().lerp(this.approach.to, k * k * (3 - 2 * k));
      p.y = Math.max(p.y, this.terrainHSafe(p.x, p.z) + 30);
      this._lookGoal(p, this._tmpV2.set(0, lerp(500, 30, k), 0), lerp(70, 58, k));
      return;
    }
    if (this.chapter === 'facility' || this.chapter === 'countdown') {
      if (this.chapter === 'countdown') {
        if (this._cdHero) {
          /* §15 HERO: low, close, rocket body + tower + engines + vapour */
          const p = this._tmpV.set(-13, 3.0, 33);
          p.x += Math.sin(this.elapsed * 0.8) * 0.35;
          p.y += Math.sin(this.elapsed * 1.1) * 0.22;
          this._lookGoal(p, this._tmpV2.set(2, 22, 0), 40);
          return;
        }
        const o = this.orb;
        o.radius = damp(o.radius, 78, 0.9, dt);
        o.theta = damp(o.theta, -2.15, 0.6, dt);
        o.phi = damp(o.phi, 0.34, 0.8, dt);
        this._orbGoal(o, 56);
        return;
      }
      if (this.camMode === 'free') { this._freeGoal(dt, true); return; }
      if (this.camMode === 'director') { this._directorFacilityGoal(dt); return; }
      /* ORBIT: damped orbit, full 360°, never through terrain */
      const o = this.orb;
      if (this._idle > 9 && !this._pointer.down) o.theta += dt * 0.02;
      this._orbGoal(o, 58);
      return;
    }
    if (this.chapter === 'ascent') {
      const rY = this.rocket ? this.rocket.position.y : this.rocketBaseY || 3;
      let p, look, fov;
      if (this.camRig === 'PADHERO' || this.camRig === 'PADLOW') { p = this._tmpV.set(-24, 2.8, 46); look = this._tmpV2.set(0, rY + 16, 0); fov = 42; }
      else if (this.camRig === 'ENGINE') { p = this._tmpV.set(11, 3.4, 17); look = this._tmpV2.set(0, Math.min(rY + 2, 40), 0); fov = 52; }
      else if (this.camRig === 'TELE') { p = this._tmpV.set(-205, 9, 128); look = this._tmpV2.set(0, rY + 24, 0); fov = 14; }
      else { p = this._tmpV.set(16.5, 47, 11); look = this._tmpV2.set(0, rY + 12, 0); fov = 47; }
      /* rig with hand-held weight + user aim offset */
      const held = this._tmpV.copy(p);
      held.x += Math.sin(this.elapsed * 0.7) * 0.4;
      held.y += Math.sin(this.elapsed * 0.9) * 0.3;
      this._lookGoal(held, look, fov);
      const e = new T.Euler().setFromQuaternion(this._goalQuat, 'YXZ');
      e.y += this.aim.yaw; e.x += this.aim.pitch;
      this._goalQuat.setFromEuler(e);
      return;
    }
    if (this.chapter === 'ascentSpace') {
      const k = this.mt;
      const camY = lerpTable([[6.4, -160], [9, -60], [12, 130], [15.2, 380], [18.8, 520]], k);
      let pitch, fov, px = 0, pz = 0;
      /* V3.3 P0: EARTH-AWARE framing — every rig asks the sphere where its
         limb is and places it at a scripted screen fraction. No magic pitch.
         TRACK .10 · CHASE .16 · MAX-Q(NEARBODY) .22 · STRATO .34 */
      let frac;
      if (this.camRig === 'TRACK') { fov = 16; px = 40; pz = 30; frac = 0.10; }
      else if (this.camRig === 'CHASE') { fov = 40; px = 12; pz = -46; frac = 0.16; }  /* V3.4 §148: closer chase — rocket reads big at Mach 1 */
      else if (this.camRig === 'NEARBODY') { fov = 72; px = 4; pz = 8; frac = 0.22; }
      else { fov = 82; px = -14; pz = 6; frac = 0.34; }
      pitch = this._pitchForLimb(this._tmpV2.set(px, camY, pz), fov, frac);
      const pos = this._tmpV.set(px, camY, pz);
      this._yawPitchGoal(pos, this.aim.yaw, pitch + this.aim.pitch, fov);
      return;
    }
    if (this.chapter === 'orbit' || this.chapter === 'charge') {
      if (this.camMode === 'orbit') {
        /* EARTH ORBIT CAMERA (V3.4 P0 §31/§32): the user orbits THE PLANET.
           Drag = orbit, wheel = dolly, damped, never through the surface. */
        const o = this.orbEarth || (this.orbEarth = { theta: 0, phi: -0.55, radius: (this.earthR || 1400) + 320 });
        const C = this.earthCenter;
        o.theta += this.free.vyaw * 1.5;
        o.phi = clamp(o.phi + this.free.vpitch * 1.5, -1.42, 1.42);
        this.free.vyaw *= Math.exp(-6 * dt); this.free.vpitch *= Math.exp(-6 * dt);
        o.radius = clamp(o.radius, (this.earthR || 1400) + 90, (this.earthR || 1400) * 5.5);
        const cph = Math.cos(o.phi);
        const x = C.x + o.radius * cph * Math.sin(o.theta);
        const z = C.z + o.radius * cph * Math.cos(o.theta);
        const y = C.y + o.radius * Math.sin(o.phi);
        this._lookGoal(this._tmpV.set(x, y, z), C, 54);
        return;
      }
      if (this.camMode === 'free') { this._freeGoal(dt, false); return; }
      /* DIRECTOR (V3.3): Earth-aware — the sphere tells us the pitch.
         Hero: limb at 55 % (Earth 50-65 % of the frame, cropped below).
         DEPARTURE: the camera climbs a real path away from the planet;
         while the disc is bigger than the frame we keep limb-framing,
         and once it fits we frame the full disc with space around it. */
      const dep = this._depDone ? 1 : (this._depT ? sstep(0, 1, this._depT) : 0);
      /* V3.4 §41/§151: the climb-out goes FAR enough that the planet becomes a
         complete disc with real space around it (60% → 45% → 32% → full disc) */
      const pos = this._tmpV.set(0, -40 + dep * 1500, dep * 3450);
      const fov = this.confirming ? 66 : lerp(58, 52, dep);
      const ang = this._earthAngRadius(pos);
      let basePitch;
      if (ang * 2 < (fov * Math.PI / 180) * 0.82) {
        /* full disc fits: centre it slightly low, sky above (Frame D) */
        const C = this.earthCenter;
        const d = Math.hypot(C.x - pos.x, C.y - pos.y, C.z - pos.z);
        const el = Math.asin((C.y - pos.y) / d);
        basePitch = clamp(el + (fov * Math.PI / 180) * 0.06, -1.25, 0.6);
      } else {
        basePitch = this._pitchForLimb(pos, fov, lerp(0.55, 0.46, dep));
      }
      this._yawPitchGoal(pos, this.aim.yaw, basePitch + this.aim.pitch, fov);
      return;
    }
    if (this.chapter === 'warp') {
      const j = this.motionOK ? 0.004 : 0;
      const pos = this._tmpV.set(0, 0, 0);
      this._lookGoal(pos, this._tmpV2.set(Math.sin(this.elapsed * 13) * j * 100, Math.cos(this.elapsed * 11) * j * 100, -100), lerp(60, 86, sstep(0.2, 2.6, this.mt)));
      return;
    }
    if (this.chapter === 'hub') {
      /* ARRIVAL CINEMATIC (V3.4): a slow decelerating drift while exposure
         recovers and the structures reveal — control returns at release */
      if (!this._arrivalDone && this._arrivalDur) {
        const k = sstep(0, 1, 1 - this._arrivalT / this._arrivalDur);
        const yaw = (this._arrivalYaw0 || 0) * (1 - k) + Math.sin(k * 2.4) * 0.30 - 0.10 + k * 0.10;
        const pitch = -0.10 + k * 0.13;
        this._yawPitchGoal(this._tmpV.set(0, 0, (1 - k) * 46), yaw, pitch, lerp(72, 60, k));
        return;
      }
      /* free exploration (adicional §47): WASD moves, Q/E vertical — with
         sane bounds and never through a galaxy core */
      const kx = (this.keys.KeyA || this.keys.ArrowLeft ? -1 : 0) + (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0);
      const kz = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) + (this.keys.KeyS || this.keys.ArrowDown ? -1 : 0);
      const kyv = (this.keys.KeyE ? 1 : 0) - (this.keys.KeyQ ? 1 : 0);
      if (this.hubStrafe.z == null) this.hubStrafe.z = 0;
      if (kx || kz || kyv) {
        this._idle = 0;
        this.hubStrafe.x = clamp(this.hubStrafe.x + kx * 110 * dt, -220, 220);
        this.hubStrafe.y = clamp(this.hubStrafe.y + kyv * 80 * dt, -150, 150);
        /* W = fly toward where you look */
        this.hubStrafe.z = clamp(this.hubStrafe.z - Math.cos(this.aim.yaw) * kz * 130 * dt, -560, 70);
        this.hubStrafe.x = clamp(this.hubStrafe.x + Math.sin(this.aim.yaw) * kz * 130 * dt, -260, 260);
      } else if (this._idle > 4 && this.selectedIdx < 0) {
        this.hubStrafe.x = damp(this.hubStrafe.x, 0, 0.4, dt);
        this.hubStrafe.y = damp(this.hubStrafe.y, 0, 0.4, dt);
        this.hubStrafe.z = damp(this.hubStrafe.z, 0, 0.4, dt);
      }
      let yaw = this.aim.yaw, pitch = this.aim.pitch;
      if (this.camMode === 'director' && this._idle > 1.5 && this.selectedIdx < 0) {
        /* gentle auto pan across the three galaxies (wider — real X/Y/Z now) */
        yaw = Math.sin(this.elapsed * 0.055) * 0.82;
        pitch = -0.02 + Math.sin(this.elapsed * 0.045) * 0.13;
        this.aim.yaw = damp(this.aim.yaw, yaw, 0.8, dt);
        this.aim.pitch = damp(this.aim.pitch, pitch, 0.8, dt);
      }
      if (this.selectedIdx >= 0) {
        const gp = this.galaxyGroups[this.selectedIdx].position;
        const ty = Math.atan2(gp.x - this.hubStrafe.x, -(gp.z));
        const tp = Math.atan2(gp.y - this.hubStrafe.y, Math.hypot(gp.x - this.hubStrafe.x, gp.z));
        this.aim.yaw = damp(this.aim.yaw, ty, 1.6, dt);
        this.aim.pitch = damp(this.aim.pitch, clamp(tp, -0.6, 0.6), 1.6, dt);
        yaw = this.aim.yaw; pitch = this.aim.pitch;
      }
      /* PREVIEW DOLLY (§40/§41): ease 10–18 % toward the selected core; any
         switch retargets the same eased values — no snap, no broken states.
         CONFIRM (§42) extends the same push toward the core. */
      const selDir = this.selectedIdx >= 0 && this.galaxyGroups[this.selectedIdx] ? this.galaxyGroups[this.selectedIdx].position : null;
      const pushGoal = this.confirming ? 300 : (this.selectedIdx >= 0 ? sstep(0, 1, this._selPushT) * 96 : 0);
      this._selPush = damp(this._selPush, pushGoal, this.confirming ? 2.6 : 3.2, dt);
      let px = this.hubStrafe.x, py = this.hubStrafe.y, pz = this.hubStrafe.z || 0;
      if (selDir && this._selPush > 0.01) {
        const L = selDir.length() || 1;
        px += selDir.x / L * this._selPush;
        py += selDir.y / L * this._selPush;
        pz += selDir.z / L * this._selPush;
      }
      /* never inside a galaxy core — the trick stays hidden (adicional §47) */
      for (const gg of this.galaxyGroups || []) {
        const gp2 = gg.position;
        const minD = gg.userData.R * 1.05;
        const ddx = px - gp2.x, ddy = py - gp2.y, ddz = pz - gp2.z;
        const dd = Math.hypot(ddx, ddy, ddz);
        if (dd < minD && dd > 0.001) {
          const kk = minD / dd;
          px = gp2.x + ddx * kk; py = gp2.y + ddy * kk; pz = gp2.z + ddz * kk;
        }
      }
      const fov = this.confirming ? lerp(60, 74, sstep(0, 1, this._confirmT || 0)) : (this.selectedIdx >= 0 ? 56 : 60);
      this._yawPitchGoal(this._tmpV.set(px, py, pz), yaw, pitch, fov);
      return;
    }
    /* fallback */
    this._lookGoal(c.position, this._tmpV2.set(0, 0, -100).add(c.position), 58);
  }
  _orbGoal(o, fov) {
    const x = o.target.x + o.radius * Math.cos(o.phi) * Math.sin(o.theta);
    const z = o.target.z + o.radius * Math.cos(o.phi) * Math.cos(o.theta);
    let y = o.target.y + o.radius * Math.sin(o.phi);
    const gy = this.terrainHSafe(x, z) + 2.2;
    y = Math.max(y, gy);
    this._lookGoal(this._tmpV.set(x, y, z), o.target, fov);
  }
  /* FACILITY DIRECTOR: slow curated drift — pad → tower → sky tilt → wide,
     each vantage held long enough to read; any drag hands over to ORBIT. */
  _directorFacilityGoal(dt) {
    const d = this.dirState;
    d.t += dt;
    const segs = [
      { dur: 16, th: [-0.9, -0.35], ph: [0.30, 0.42], r: [96, 78], ty: 26 },
      { dur: 13, th: [0.5, 1.0], ph: [0.22, 0.30], r: [64, 56], ty: 34 },
      { dur: 12, th: [1.9, 2.35], ph: [0.5, 0.62], r: [130, 150], ty: 22 },
      { dur: 14, th: [-2.5, -2.1], ph: [0.14, 0.2], r: [46, 52], ty: 18 },
    ];
    const sgm = segs[d.seg % segs.length];
    const k = sstep(0, sgm.dur, d.t);
    if (d.t >= sgm.dur) { d.t = 0; d.seg++; d.skyLook = (d.seg % 3 === 2) ? 6 : 0; }
    const theta = lerp(sgm.th[0], sgm.th[1], k);
    const phi = lerp(sgm.ph[0], sgm.ph[1], k) + (d.skyLook > 0 ? sstep(0, 2, d.skyLook) * 0.5 : 0);
    if (d.skyLook > 0) d.skyLook -= dt;
    const radius = lerp(sgm.r[0], sgm.r[1], k);
    const o = { theta, phi, radius, target: this._tmpV2.set(0, sgm.ty, 0) };
    this._orbGoal(o, 55);
    /* keep the ORBIT rig synced so a takeover doesn't jump */
    this.orb.theta = theta; this.orb.phi = phi; this.orb.radius = radius;
  }
  /* FREE CAMERA (V3.4 P0 §33-§38): yaw 360°, pitch −80..+85°, inertia, wheel
     FOV. On the surface: WASD inside the facility, terrain-clamped. In SPACE
     the old ±70 local box is GONE — this is a real flight camera around the
     planet: fly-where-you-look, SHIFT boost, a safe sphere that will not let
     you enter the Earth, and an outer envelope wide enough to see the whole
     disc with space around it. FOCUS EARTH (X) eases the view toward the
     planet without teleporting; H eases toward HOME // MEDELLÍN. */
  _freeGoal(dt, onSurface) {
    const f = this.free;
    f.yaw += f.vyaw; f.pitch = clamp(f.pitch + f.vpitch, -1.396, 1.484);
    f.vyaw *= Math.exp(-5.2 * dt); f.vpitch *= Math.exp(-5.2 * dt);
    /* FOCUS EARTH / LOCATE HOME: converge yaw+pitch toward the stored goal —
       an interpolation of the real orientation, never a teleport (§37) */
    if (this._focusGoal) {
      const g = this._focusGoal;
      const dy = ((g.yaw - f.yaw + Math.PI * 3) % TAU) - Math.PI;
      f.yaw += dy * Math.min(1, dt * 3.2);
      f.pitch = lerp(f.pitch, g.pitch, Math.min(1, dt * 3.2));
      if (Math.abs(dy) < 0.02 && Math.abs(f.pitch - g.pitch) < 0.02) this._focusGoal = null;
      if (Math.abs(this._pointer.moved) > 30 && this._pointer.down) this._focusGoal = null;
    }
    const kf = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0);
    const ks = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
    const ku = (this.keys.KeyE ? 1 : 0) - (this.keys.KeyQ ? 1 : 0);
    if (kf || ks || ku) { this._idle = 0; this._focusGoal = null; }
    if (onSurface) {
      const sp = 26;
      const fwdX = Math.sin(f.yaw), fwdZ = -Math.cos(f.yaw);
      f.pos.x += (fwdX * kf + Math.cos(f.yaw) * ks) * sp * dt;
      f.pos.z += (fwdZ * kf + Math.sin(f.yaw) * ks) * sp * dt;
      f.pos.y += ku * 14 * dt;
      const rr = Math.hypot(f.pos.x, f.pos.z);
      if (rr > 300) { f.pos.x *= 300 / rr; f.pos.z *= 300 / rr; }
      f.pos.y = clamp(f.pos.y, this.terrainHSafe(f.pos.x, f.pos.z) + 2.0, 190);
    } else {
      /* SPACE FLIGHT — full 3D, fly along the view direction */
      const boost = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 3.0 : 1.0;
      const sp = 120 * boost;
      const cp = Math.cos(f.pitch);
      const fx = Math.sin(f.yaw) * cp, fy = Math.sin(f.pitch), fz = -Math.cos(f.yaw) * cp;
      const rx = Math.cos(f.yaw), rz = Math.sin(f.yaw);
      f.pos.x += (fx * kf + rx * ks) * sp * dt;
      f.pos.y += (fy * kf + ku) * sp * dt;
      f.pos.z += (fz * kf + rz * ks) * sp * dt;
      const C = this.earthCenter || this._tmpV2.set(0, -1620, -180);
      const R = this.earthR || 1400;
      const dx = f.pos.x - C.x, dy2 = f.pos.y - C.y, dz = f.pos.z - C.z;
      const d = Math.hypot(dx, dy2, dz) || 1;
      const safeR = R + 60;                    /* never inside the planet (§35) */
      const maxR = R * 6;                      /* full disc + deep space (§36) */
      if (d < safeR) { const k = safeR / d; f.pos.set(C.x + dx * k, C.y + dy2 * k, C.z + dz * k); }
      else if (d > maxR) { const k = maxR / d; f.pos.set(C.x + dx * k, C.y + dy2 * k, C.z + dz * k); }
    }
    this._yawPitchGoal(f.pos, f.yaw, f.pitch, f.fov);
  }
  /* yaw/pitch that would look from `pos` toward world point `p` */
  _yawPitchToward(pos, p) {
    const dx = p.x - pos.x, dy = p.y - pos.y, dz = p.z - pos.z;
    const yaw = Math.atan2(dx, -dz);
    const pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.396, 1.484);
    return { yaw, pitch };
  }
  /* FOCUS EARTH (V3.4 §37): keep position, ease orientation to the planet */
  focusEarth() {
    if (!this.earthCenter || !(this.chapter === 'orbit' || this.chapter === 'charge')) return;
    if (this.camMode !== 'free') this._setCamMode('free', true);
    this._focusGoal = this._yawPitchToward(this.free.pos, this.earthCenter);
    this.ui.quick('FOCUS // EARTH');
    this.audio.uiHover();
  }
  /* RESET VIEW (V3.4 §38): back to the director hero orbit, no reload */
  resetOrbitView() {
    if (!(this.chapter === 'orbit' || this.chapter === 'charge')) return;
    this.aim.yaw = 0; this.aim.pitch = 0;
    this._focusGoal = null;
    this._setCamMode('director');
    this.ui.quick('RESET VIEW');
  }
  /* LOCATE HOME (V3.4 §24): world position of Medellín on the real sphere */
  latLonToEarthVector(lat, lon, radius) {
    const th = Math.PI / 2 - lat * Math.PI / 180;
    const ph = (lon + 180) / 360 * TAU;
    const v = new T.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    if (this.earth) v.applyQuaternion(this.earth.quaternion);
    return v.multiplyScalar(radius || ((this.earthR || 1400) + 6)).add(this.earthCenter || new T.Vector3());
  }
  locateHome() {
    if (!this.earth || !(this.chapter === 'orbit' || this.chapter === 'charge')) return;
    const hp = this.latLonToEarthVector(MEDELLIN.lat, MEDELLIN.lon);
    if (!this.homeMarker) {
      const grp = new T.Group();
      const ring = new T.Mesh(new T.RingGeometry(9, 10.5, 40),
        new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.85, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
      const dot = new T.Mesh(new T.SphereGeometry(2.2, 10, 8), new T.MeshBasicMaterial({ color: 0xdff4ff }));
      const label = new T.Mesh(new T.PlaneGeometry(64, 12),
        new T.MeshBasicMaterial({ map: textTex([t('home_marker')], '#bfeaff', null, 256, 48, 26), transparent: true, depthWrite: false }));
      label.position.y = 18;
      grp.add(ring, dot, label);
      grp.userData = { ring, label };
      this.homeMarker = grp;
      this.gSpace.add(grp);
    }
    this.homeMarker.position.copy(hp);
    this.homeMarker.visible = true;
    this._homeT = 14;                            /* discreet: fades back out */
    if (this.camMode === 'free') this._focusGoal = this._yawPitchToward(this.free.pos, hp);
    else if (this.camMode === 'orbit' || this.camMode === 'director') {
      this._setCamMode('free', true);
      this._focusGoal = this._yawPitchToward(this.free.pos, hp);
    }
    this.ui.quick(t('home_marker'));
    this.audio.uiHover();
  }
  terrainHSafe(x, z) { return this.builtFacility ? this.terrainH(x, z) : 0; }

  /* ============================ CHAPTER STEP ============================= */
  _chapterUpdate(dt) {
    const mtPrev = this.mt;
    /* CINEMATIC CLOCK: monotonic real time — a slow frame can no longer
       stretch a 7 s sequence into minutes (P0 §1) */
    this.mt = this._chBase + (performance.now() - this._chStart) / 1000;
    for (const ev of this.events) {
      if (!ev.done && mtPrev <= ev.at && this.mt > ev.at) { ev.done = true; ev.fn(); }
    }
    if (this.chapter === 'intro') {
      const ph = this._introPhase;
      if (ph === 'converge') this.introU.uT.value = clamp((this.mt - this._introT0) / 1.3, 0, 1);
      if (ph === 'bang') this.introU.uT.value = clamp((this.mt - this._introT0) / 2.6, 0, 1);
      this.ring.material.opacity = ph === 'bang' ? clamp(1 - (this.mt - this._introT0) / 1.2, 0, 1) * 0.8 : 0;
      if (ph === 'bang') this.ring.scale.setScalar(1 + (this.mt - this._introT0) * 120);
      this.dot.material.opacity = ph === 'bang' ? 0 : this.dot.material.opacity;
    } else if (this.chapter === 'ascent') {
      /* slow, heavy first metres (spec §31) */
      const y = lerpTable([[0, 0], [0.6, 0.5], [1.4, 3.2], [2.4, 14], [3.4, 44], [4.4, 108], [5.4, 236], [6.4, 470]], this.mt);
      if (this.rocket) {
        this.rocket.position.y = this.rocketBaseY + y;
        this.rocket.rotation.z = Math.sin(this.mt * 0.7) * 0.004;
      }
      /* rocket contact shadow fades as it climbs */
      if (this.rocketContact) this.rocketContact.material.opacity = 0.55 * clamp(1 - y / 60, 0, 1);
      const alt = lerpTable([[0, 0], [2.5, 0.05], [4.5, 0.35], [6.4, 1.8]], this.mt);
      const mach = lerpTable([[0, 0], [3.5, 0.25], [6.4, 0.8]], this.mt);
      this.ui.setTelemetry('<b>SG-L1 // ASCENT</b>\nALT ' + alt.toFixed(2) + ' KM\nMACH ' + mach.toFixed(2) + '\nTHROTTLE 100%');
      this.trauma = Math.max(this.trauma, 0.1);
    } else if (this.chapter === 'ascentSpace') {
      const alt = lerpTable([[6.4, 1.8], [8.2, 7], [10.3, 12], [12.2, 18], [14, 34], [15.2, 55], [16.6, 86]], this.mt);
      const mach = lerpTable([[6.4, 0.8], [8.2, 1.0], [10.3, 1.75], [12.2, 2.4], [14, 4.6], [15.2, 7.7], [16.6, 8.3]], this.mt);
      const maxq = this.mt > 10.3 && this.mt < 12.2;
      this.ui.setTelemetry('<b>SG-L1 // ASCENT</b>\nALT ' + alt.toFixed(1) + ' KM\nMACH ' + mach.toFixed(2) + (maxq ? '\nDYNAMIC PRESSURE MAX' : this.mt < 15.2 ? '\nTHROTTLE 100%' : '\nMECO'));
      if (maxq) this.trauma = Math.max(this.trauma, 0.14);
      /* sky→space blend + haze wash-out */
      this.skyU.uSpace.value = sstep(8.6, 13.2, this.mt);   /* §30: stars begin */
      /* V3.4 §85/§94/§95: the AIR THINS — the dome itself darkens and the
         cloud-grey wash dies with altitude, so MACH 1 never reads white */
      const altK = sstep(6.8, 12.4, this.mt);
      this.skyU.uDay.value = this._dayK * (1 - altK * 0.92);
      this.skyU.uCloud.value = this.w.cloudLow * (1 - altK);
      /* §30 SKY GRADIENT: blue → cobalt → navy → near-black → space black */
      if (!this._skyCol) { this._skyCol = new T.Color(); this._skyA = new T.Color(); this._skyB = new T.Color(); }
      /* V3.4 §85/§94: deeper blues sooner so MACH 1 keeps contrast — the
         rocket must stay legible against the sky, never a white screen */
      const SKY = [
        [6.4, 0x7ea9d2], [8.2, 0x315c9f], [10.4, 0x16305f],
        [12.4, 0x0a152c], [14.4, 0x05080f], [18.8, 0x04070d],
      ];
      let si = 0;
      while (si < SKY.length - 2 && this.mt > SKY[si + 1][0]) si++;
      const [t0, c0] = SKY[si], [t1, c1] = SKY[si + 1];
      const sk = clamp((this.mt - t0) / Math.max(0.001, t1 - t0), 0, 1);
      this._skyCol.copy(this._skyA.setHex(c0)).lerp(this._skyB.setHex(c1), sk);
      this.renderer.setClearColor(this._skyCol, 1);
      this.skyU.uHaze.value = lerp(this.w.haze, 0, sstep(8, 12, this.mt));
      /* sea of clouds under the camera right after punch-through (spec §32) */
      const seaK = sstep(6.5, 7.4, this.mt) * (1 - sstep(11.5, 13.5, this.mt));
      for (const sp of this.cloudSea || []) {
        sp.position.y = this.cam.position.y - 380 + Math.sin(this.elapsed * 0.2 + sp.userData.ph) * 12;
        sp.material.opacity = seaK * 0.8 * clamp(this.w.cloudLow * 2.2, 0.25, 1);
      }
      /* mini rocket relative to camera path */
      const wobble = Math.sin(this.mt * 1.3) * 3;
      if (this.miniRocket) {
        this.miniRocket.position.set(wobble, this.cam.position.y + lerpTable([[6.4, -40], [10.5, 6], [18.8, 62]], this.mt), -170);
        this.miniRocket.rotation.z = 0.05 * Math.sin(this.mt * 0.8);
      }
      if (this.engineOn > 0 && this.miniRocket) {
        const p = this.miniRocket.position;
        for (let i = 0; i < 3; i++) this.pCore.spawn(p.x + rand(-1, 1), p.y - 18, p.z + rand(-1, 1), rand(-2, 2), rand(-60, -46), rand(-2, 2), rand(0.2, 0.35), rand(4, 7));
        this.mGlow.material.opacity = 0.9;
      } else if (this.mGlow) this.mGlow.material.opacity = damp(this.mGlow.material.opacity, 0, 3, dt);
      /* V3.3 STAGE 1 SEPARATION: the booster falls behind, drifts, tumbles
         slowly, keeps its minimal lights, never explodes, leaves the frame */
      if (this._sepT && this.mStage1) {
        this._sepT += dt;
        const st = this._sepT;
        this.mStage1.position.y = -st * st * 10 - st * 6;
        this.mStage1.position.z = st * 3.2;
        this.mStage1.position.x = st * 1.4;
        this.mStage1.rotation.x = st * 0.16;
        this.mStage1.rotation.z = st * 0.11;
        if (st > 3.4) this.mStage1.visible = false;
      }
      /* STAGE 2 vacuum engine: smaller, cleaner, blue-white */
      if (this._eng2On && this.miniRocket) {
        const p = this.miniRocket.position;
        if (Math.random() < dt * 90) this.pCore.spawn(p.x + rand(-0.4, 0.4), p.y + 0.2, p.z + rand(-0.4, 0.4), rand(-1, 1), rand(-34, -26), rand(-1, 1), rand(0.12, 0.2), rand(2, 3.5));
        this.mGlow2.material.opacity = 0.7 + Math.sin(this.elapsed * 30) * 0.12;
      }
      /* FAIRING SEPARATION: opposite lateral impulse, slow rotation, cull —
         nothing keeps floating over the ship afterwards */
      if (this._fairT && this.mFairL) {
        this._fairT += dt;
        const ft = this._fairT;
        const off = 3 + ft * 16;
        this.mFairL.position.x = -off; this.mFairR.position.x = off;
        this.mFairL.position.y = 13.2 - ft * 7; this.mFairR.position.y = 13.2 - ft * 7;
        this.mFairL.rotation.z = 0.35 + ft * 0.7; this.mFairR.rotation.z = -0.35 - ft * 0.7;
        this.mFairL.rotation.x = ft * 0.4; this.mFairR.rotation.x = -ft * 0.3;
        if (ft > 2.6) { this.mFairL.visible = false; this.mFairR.visible = false; }
      }
      /* transonic condensation: expanding ring + brief vapor cone (spec §33) */
      if (this._transonic) {
        this._transonic = Math.min(1, this._transonic + dt / 0.7);
        if (!this.transRing) {
          this.transRing = new T.Mesh(new T.RingGeometry(0.9, 1, 40), new T.MeshBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
          this.gSpace.add(this.transRing);
        }
        const p = this.miniRocket.position;
        this.transRing.position.set(p.x, p.y - 4, p.z);
        this.transRing.rotation.x = Math.PI / 2;
        this.transRing.scale.setScalar(4 + this._transonic * 26);
        this.transRing.material.opacity = (1 - this._transonic) * 0.7;
        for (let i = 0; i < 2; i++) this.pSteam.spawn(p.x + rand(-2, 2), p.y - rand(2, 8), p.z + rand(-1.5, 1.5), rand(-3, 3), rand(-6, -2), rand(-2, 2), 0.4, rand(3, 5));
        if (this._transonic >= 1) this._transonic = 0;
      }
      this.pCore.update(dt, 0, 0);
      this.pSmoke.update(dt, 0, 0);
      this.pSteam.update(dt, 0, 0);
    } else if (this.chapter === 'orbit' || this.chapter === 'charge') {
      this._departureTick(dt);
      /* HOME // MEDELLÍN marker: billboard label, discreet, fades out (§24) */
      if (this.homeMarker && this.homeMarker.visible) {
        this._homeT -= dt;
        const u = this.homeMarker.userData;
        this.homeMarker.lookAt(this.cam.position);
        const pulse = 0.55 + 0.3 * Math.sin(this.elapsed * 2.4);
        u.ring.material.opacity = clamp(this._homeT, 0, 1) * pulse;
        u.label.material.opacity = clamp(this._homeT, 0, 1) * 0.9;
        u.label.material.transparent = true;
        if (this._homeT <= 0) this.homeMarker.visible = false;
      }
      /* ORBITAL SUNRISE (V3.4 §44): night → thin red edge → orange → blue rim
         → white sun → surface reveal. Runs on the shared _heroSun so surface,
         clouds, atmosphere, ship and key light all turn together. */
      if (this._sunriseT) {
        this._sunriseT = Math.min(1, this._sunriseT + dt / 14);
        const k = sstep(0, 1, this._sunriseT);
        this._heroSun.copy(this._sunriseFrom).lerp(this._sunriseTo, k).normalize();
        this.exposureT = lerp(0.78, 1.02, sstep(0.3, 0.85, this._sunriseT));
        if (this._sunriseT >= 1) { this._sunriseT = 0; this.ui.sgos('SG.OS // ORBITAL SUNRISE COMPLETE'); }
      } else if (this.chapter === 'charge' && this.ctaMode === 'warp' && this.mt > 21 && !this._sunriseDone) {
        this.startSunrise();                      /* reward for staying (§44) */
      }
      /* V3.3 ORBIT CLEANUP: the spent upper stage drifts away and culls —
         the hero shot is ship + Earth + space, nothing floating around */
      if (this.miniRocket && this.miniRocket.visible) {
        this._vehDrift = (this._vehDrift || 0) + dt;
        const p = this.miniRocket.position;
        p.x += 5 * dt; p.y += 2 * dt; p.z -= 26 * dt;
        this.miniRocket.rotation.x += dt * 0.05;
        this.miniRocket.rotation.z += dt * 0.03;
        if (this.mGlow2) this.mGlow2.material.opacity = damp(this.mGlow2.material.opacity, 0, 2, dt);
        if (this._vehDrift > 4.5) this.miniRocket.visible = false;
      }
      if (this._shipSlide && this.ship) {
        this._shipSlide = Math.min(1, this._shipSlide + dt / 2.2);
        const k = sstep(0, 1, this._shipSlide);
        const depZ = (this._depT ? sstep(0, 1, this._depT) : 0) * -34;
        this.ship.position.set(0, this.cam.position.y - 15 + k * 3, -120 + k * 58 + depZ);
        this.ship.rotation.y = Math.PI * (1 - k * 0.06);
        this.ship.rotation.x = Math.sin(this.elapsed * 0.5) * 0.03;
      }
      /* SHIP ALIVE in orbit: sun-key handled globally; here rim/emissives,
         nav strobes, RCS micro-events, wandering glint (spec §46–48) */
      if (this.shipRim) {
        this.shipRim.intensity = 3.2;
        this.shipRim.color.set(0x4f8fe6);
        this.shipCabin.intensity = 0.8;
      }
      for (const gl of this.shipGlows || []) gl.material.opacity = 0.5 + 0.25 * Math.sin(this.elapsed * 3.1);
      const strobe = (this.elapsed % 1.4) < 0.07 ? 1 : ((this.elapsed + 0.7) % 1.4) < 0.07 ? 0.7 : 0;
      (this.navLights || []).forEach((nl, i) => { nl.material.opacity = i === 2 ? ((this.elapsed % 2.1) < 0.06 ? 1 : 0.06) : strobe; });
      if (this.shipEngPanel) this.shipEngPanel.material.color.setRGB(0.3, 1, 0.75).multiplyScalar(0.6 + 0.4 * Math.sin(this.elapsed * 2.2));
      this._rcsT -= dt;
      if (this._rcsT <= 0 && this.ship && this.ship.visible && this.rcsPorts) {
        this._rcsT = rand(6, 14);
        const port = this.rcsPorts[(Math.random() * this.rcsPorts.length) | 0];
        const wp = port.getWorldPosition(new T.Vector3());
        for (let i = 0; i < 8; i++) this.pBurst.spawn(wp.x, wp.y, wp.z, rand(-3, 3), rand(1, 4), rand(-3, 3), rand(0.25, 0.5), rand(1.5, 3));
        this.ship.rotation.z += rand(-0.015, 0.015);
        this.ship.rotation.x += rand(-0.008, 0.008);
      }
      this.ship.rotation.z = damp(this.ship.rotation.z, 0, 0.5, dt);
      /* SG relays: parallax orbits, one crossing near the ship (spec §50) */
      for (const s of this.sats || []) {
        const u = s.userData;
        u.phase += dt * u.speed;
        const cx = Math.cos(u.phase) * u.orbitR;
        const cz = Math.sin(u.phase) * u.orbitR;
        s.position.set(cx * Math.cos(u.tilt), -40 + Math.sin(u.phase * 1.3) * 22 + cx * Math.sin(u.tilt) * 0.4, -60 + cz * 0.4 - u.orbitR * 0.4);
        s.rotation.y += dt * 0.2;
        u.led.material.opacity = (this.elapsed % 1.8) < 0.09 ? 1 : 0.15;
      }
      if (this.chapter === 'charge') {
        this.charge = Math.min(1, this.charge + dt / 2.9);
        for (const gl of this.shipGlows) gl.material.opacity = 0.5 + this.charge * 0.5;
      }
      this.pCore.update(dt, 0, 0);
      this.pBurst.update(dt, 0, 0);
    } else if (this.chapter === 'warp') {
      const k = sstep(0.15, 1.5, this.mt);
      this.ftl = k;
      for (const pop of this.warpPops) {
        pop.U.uSpeed.value = k;
        pop.U.uScroll.value += dt * (60 + 980 * k);
      }
      this.warpCore.material.opacity = 0.14 + k * 0.3;
      this.audio.setEngine(k * 0.4);
      /* ship lit by the corridor: cyan/violet rims + engine core (spec §54) */
      if (this.ship) this.ship.position.set(Math.sin(this.elapsed * 2.2) * 0.25, -4.4 + Math.sin(this.elapsed * 1.7) * 0.2, -13);
      for (const rim of this.ftlRims || []) rim.material.opacity = 0.22 + k * 0.5 + Math.sin(this.elapsed * 9 + rim.position.x) * 0.08;
      for (const gl of this.shipGlows || []) gl.material.opacity = 0.7 + k * 0.3;
      if (this.shipRim) { this.shipRim.intensity = 4 + k * 5; this.shipRim.color.set(0x7a9bff); }
      this.trauma = Math.max(this.trauma, 0.05 + k * 0.06);
    } else if (this.chapter === 'hub') {
      this.ftl = damp(this.ftl, 0, 4, dt);
      /* ARRIVAL: tick the reveal, hold exposure low → recovered, release */
      if (!this._arrivalDone && this._arrivalDur) {
        this._arrivalT -= dt;
        const k = 1 - this._arrivalT / this._arrivalDur;
        this.exposureT = lerp(0.45, 1.02, sstep(0.12, 0.82, k));
        if (this._arrivalT <= 0) this._arrivalRelease();
      }
      if (this._selPushT) this._selPushT = Math.min(1, this._selPushT + dt / 1.1);
      if (this.confirming && this._confirmT != null) this._confirmT = Math.min(1, this._confirmT + dt / 1.1);
      for (const g of this.galaxyGroups || []) {
        g.rotation.y += g.userData.spin * dt;
        const gi2 = this.galaxyGroups.indexOf(g);
        const isHover = gi2 === this.hoverIdx;
        const isSel = gi2 === this.selectedIdx;
        const target = this.confirming && isSel ? 1.55 : isSel ? 1.07 : isHover ? 1.04 : 1;   /* V3.3: +7 % select */
        g.userData.baseScale = damp(g.userData.baseScale, target, 3, dt);
        g.scale.setScalar(g.userData.baseScale);
        const opT = this.confirming ? (isSel ? 1.0 : 0.35) : (this.selectedIdx >= 0 && !isSel && !isHover ? 0.72 : 0.9);
        g.userData.pts.material.uniforms.uOp.value = damp(g.userData.pts.material.uniforms.uOp.value, opT, 3, dt);
        if (g.userData.halo) g.userData.halo.material.opacity = damp(g.userData.halo.material.opacity, (isSel ? 0.30 : 0.16) * (this.confirming && isSel ? 2.2 : 1) * (g.userData.haloK || 1), 3, dt);
      }
      /* selection ring: hugs the chosen disc, soft pulse, camera-facing */
      if (this.selRing) {
        const si = this.selectedIdx;
        if (si >= 0 && this.galaxyGroups[si]) {
          const gg = this.galaxyGroups[si];
          this.selRing.visible = true;
          this.selRing.position.copy(gg.position);
          this.selRing.scale.setScalar(gg.userData.R * 1.42 * gg.userData.baseScale);
          this.selRing.lookAt(this.cam.position);
          const pulse = 0.22 + 0.10 * Math.sin(this.elapsed * 2.6);
          this.selRing.material.opacity = damp(this.selRing.material.opacity, this.confirming ? 0.5 : pulse, 4, dt);
        } else {
          this.selRing.material.opacity = damp(this.selRing.material.opacity, 0, 5, dt);
          if (this.selRing.material.opacity < 0.01) this.selRing.visible = false;
        }
      }
      if (this._arrivalDone) this._galaxyPanelSync();
      else this.ui.hideGalaxy();
      if (this.beacon) {
        const pl = 0.5 + 0.5 * Math.sin(this.elapsed * 2.2);
        this.beaconGlow.material.opacity = 0.25 + pl * 0.6;
        this.beacon.rotation.y += dt * 0.8;
      }
      if (this.hubDust) this.hubDust.rotation.z += dt * 0.0015;
      if (this.hubMotes) this.hubMotes.position.x = Math.sin(this.elapsed * 0.03) * 20;
      if (this.hubForeground) this.hubForeground.position.x = Math.sin(this.elapsed * 0.05) * 8;
      /* V3.4 — per-galaxy personality animation (adicional §8/§15/§16) */
      const g0 = this.galaxyGroups && this.galaxyGroups[0];
      if (g0 && g0.userData.extras.pulse) {
        const ex = g0.userData.extras;
        const pk = (this.elapsed % 2.4) / 2.4;
        ex.pulse.scale.setScalar(g0.userData.R * (0.22 + pk * 1.2));
        ex.pulse.material.opacity = (1 - pk) * (this.hoverIdx === 0 || this.selectedIdx === 0 ? 0.34 : 0.20);
        ex.streaks.rotation.y += dt * (this.selectedIdx === 0 ? 0.9 : 0.45);
      }
      const g2x = this.galaxyGroups && this.galaxyGroups[2];
      if (g2x && g2x.userData.extras.nodeLines) {
        const ex = g2x.userData.extras;
        ex.nodeT -= dt * (this.selectedIdx === 2 ? 2.2 : 1);
        if (ex.nodeT <= 0 && ex.nodeList.length > 3) {
          ex.nodeT = rand(2.2, 5.5);
          ex.nodeAlpha = 1;
          const pa = ex.nodeLines.geometry.attributes.position.array;
          for (let li = 0; li < 4; li++) {
            const a2 = ex.nodeList[(Math.random() * ex.nodeList.length) | 0];
            const b2 = ex.nodeList[(Math.random() * ex.nodeList.length) | 0];
            pa[li * 6] = a2[0]; pa[li * 6 + 1] = a2[1]; pa[li * 6 + 2] = a2[2];
            pa[li * 6 + 3] = b2[0]; pa[li * 6 + 4] = b2[1]; pa[li * 6 + 5] = b2[2];
          }
          ex.nodeLines.geometry.attributes.position.needsUpdate = true;
        }
        ex.nodeAlpha = Math.max(0, (ex.nodeAlpha || 0) - dt * 0.7);
        ex.nodeLines.material.opacity = ex.nodeAlpha * (this.selectedIdx === 2 ? 0.3 : 0.16);
        if (ex.nodePts) ex.nodePts.material.size = 7 + Math.sin(this.elapsed * 1.7) * 1.2 + (this.selectedIdx === 2 ? 2 : 0);
      }
      /* black hole: slow accretion rotation — a quiet anomaly (adicional §35) */
      if (this.blackHole) {
        this.blackHole.userData.ring.rotation.z += dt * 0.16;
        this.blackHole.userData.ring2.rotation.z -= dt * 0.24;
      }
      /* cockpit companion: breathing + NOSE ALIGN toward the selection
         (adicional §29/§30) — the ship keeps telling the story */
      if (this.ship) {
        this.ship.position.y = -4.4 + Math.sin(this.elapsed * 1.1) * 0.12;
        this.ship.rotation.z = damp(this.ship.rotation.z, -this.aim.yaw * 0.22, 3, dt);
        let alignYaw = 0, alignPitch = 0.06;
        const ai = this._alignPreview != null ? this._alignPreview : this.selectedIdx;
        if (ai >= 0 && this.galaxyGroups && this.galaxyGroups[ai]) {
          const lp = this._tmpV.copy(this.galaxyGroups[ai].position);
          this.cam.worldToLocal(lp);
          alignYaw = clamp(Math.atan2(lp.x - this.ship.position.x, -(lp.z - this.ship.position.z)), -0.5, 0.5);
          alignPitch = clamp(0.06 + Math.atan2(lp.y - this.ship.position.y, 13) * 0.4, -0.3, 0.4);
        }
        this.ship.rotation.y = damp(this.ship.rotation.y, alignYaw, 1.4, dt);
        this.ship.rotation.x = damp(this.ship.rotation.x, alignPitch, 1.4, dt);
        /* ROUTE LINE: forms while a destination is held / confirmed */
        if (!this.routeLine) {
          const rg2 = new T.BufferGeometry();
          rg2.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
          rg2.boundingSphere = new T.Sphere(new T.Vector3(), 4000);
          this.routeLine = new T.Line(rg2, new T.LineBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
          this.routeLine.frustumCulled = false;
          this.gHub.add(this.routeLine);
        }
        const routeOn = this.selectedIdx >= 0 && this._arrivalDone;
        const rOp = damp(this.routeLine.material.opacity, routeOn ? (this.confirming ? 0.4 : 0.16) : 0, 3, dt);
        this.routeLine.material.opacity = rOp;
        if (routeOn && this.galaxyGroups[this.selectedIdx]) {
          const sw = this.ship.getWorldPosition(this._tmpV2);
          const gw = this.galaxyGroups[this.selectedIdx].position;
          const pa2 = this.routeLine.geometry.attributes.position.array;
          pa2[0] = sw.x; pa2[1] = sw.y; pa2[2] = sw.z;
          pa2[3] = gw.x; pa2[4] = gw.y; pa2[5] = gw.z;
          this.routeLine.geometry.attributes.position.needsUpdate = true;
        }
      }
      const strobe = (this.elapsed % 1.6) < 0.07 ? 1 : 0;
      (this.navLights || []).forEach((nl, i) => { nl.material.opacity = i === 2 ? strobe : strobe * 0.6; });
      /* RARE EVENTS — one at a time, 20–45 s (spec §60/§61) */
      this._hubEventUpdate(dt);
      this.pBurst.update(dt, 0, 0);
      if (this._arrivalDone) this._anchorsUpdate();
      else this.ui.anchorsVisible(false);
    }
    if (this.chapter === 'facility') {
      this.pBurst.update(dt, this.w.windX * 0.3, this.w.windZ * 0.3);
    }
    /* scan wave animation (any chapter) */
    if (this._scanWaveT) {
      this._scanWaveT += dt;
      const k = this._scanWaveT / 0.8;
      if (k >= 1) { this._scanWaveT = 0; this.scanWaveMesh.material.opacity = 0; }
      else {
        this.scanWaveMesh.lookAt(this.cam.position);
        this.scanWaveMesh.scale.setScalar(this._scanWaveBase * (1 + k * 6));
        this.scanWaveMesh.material.opacity = (1 - k) * 0.6;
      }
    }
  }
  /* hub ambient events: COMET / INTERSTELLAR STREAK / SG ANOMALY /
     PULSAR FLASH / DEEP SPACE PROBE / LENS PULSE — never "shooting star" */
  _hubEventUpdate(dt) {
    if (this.safeMode) return;                 /* rare events off in SAFE */
    if (this._hubEvent) {
      const e = this._hubEvent;
      e.t += dt;
      const k = e.t / e.dur;
      if (k >= 1) {
        this._hubEvent = null;
        this.evSprite.material.opacity = 0;
        this.evLine.material.opacity = 0;
        this.evRing.material.opacity = 0;
        this._hubEventT = rand(20, 45);
        return;
      }
      if (e.kind === 'comet') {
        const p = e.a.clone().lerp(e.b, k);
        this.evSprite.position.copy(p);
        this.evSprite.material.opacity = Math.sin(k * Math.PI) * 0.8;
        const pa = this.evLine.geometry.attributes.position.array;
        const tail = e.a.clone().lerp(e.b, Math.max(0, k - 0.08));
        pa[0] = p.x; pa[1] = p.y; pa[2] = p.z; pa[3] = tail.x; pa[4] = tail.y; pa[5] = tail.z;
        this.evLine.geometry.attributes.position.needsUpdate = true;
        this.evLine.material.opacity = Math.sin(k * Math.PI) * 0.5;
      } else if (e.kind === 'streak' || e.kind === 'probe') {
        const p = e.a.clone().lerp(e.b, k);
        this.evSprite.position.copy(p);
        this.evSprite.material.opacity = Math.sin(k * Math.PI) * (e.kind === 'streak' ? 0.9 : 0.5);
      } else if (e.kind === 'pulsar') {
        const on = (e.t % 0.9) < 0.06 || (e.t % 0.9) > 0.82 && (e.t % 0.9) < 0.88;
        this.evSprite.material.opacity = on ? 0.9 : 0.05;
      } else if (e.kind === 'anomaly') {
        this.evSprite.material.opacity = Math.sin(k * Math.PI) * 0.6;
        this.evSprite.scale.setScalar(6 + Math.sin(e.t * 7) * 2);
      } else if (e.kind === 'lens') {
        this.evRing.lookAt(this.cam.position);
        this.evRing.scale.setScalar(8 + k * 90);
        this.evRing.material.opacity = Math.sin(k * Math.PI) * 0.35;
      }
      return;
    }
    this._hubEventT -= dt;
    if (this._hubEventT > 0) return;
    SAVE.bumpRareEvent();
    this.save = SAVE.loadSave();
    const kinds = ['comet', 'streak', 'anomaly', 'pulsar', 'probe', 'lens'];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const far = () => new T.Vector3(rand(-900, 900), rand(-280, 320), rand(-1600, -700));
    const e = { kind, t: 0, dur: kind === 'pulsar' ? rand(3, 5) : kind === 'lens' ? 2.2 : kind === 'comet' ? rand(7, 10) : rand(3.5, 6), a: far(), b: far() };
    if (kind === 'streak') { e.dur = 1.4; e.b = e.a.clone().add(new T.Vector3(rand(-500, 500), rand(-200, 200), rand(-160, 160))); }
    if (kind === 'probe') { e.b = e.a.clone().add(new T.Vector3(rand(-260, 260), rand(-80, 80), rand(-60, 60))); }
    this._hubEvent = e;
    this.evSprite.position.copy(e.a);
    this.evSprite.scale.setScalar(kind === 'comet' ? 9 : kind === 'anomaly' ? 6 : 5);
    this.evSprite.material.color.set(kind === 'anomaly' ? 0x9b6bff : kind === 'probe' ? 0xf2d9a4 : 0xdff2ff);
    if (kind === 'lens') this.evRing.position.copy(e.a);
    const names = { comet: 'COMET', streak: 'INTERSTELLAR STREAK', anomaly: 'SG ANOMALY', pulsar: 'PULSAR FLASH', probe: 'DEEP SPACE PROBE', lens: 'GRAVITATIONAL LENS PULSE' };
    if (Math.random() < 0.6) this.ui.sgos('SG.OS // ' + names[kind] + ' DETECTED');
  }
  _anchorsUpdate() {
    const half = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.galaxyGroups.forEach((g, i) => {
      const p = g.position.clone().project(this.cam);
      const visible = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 && !this.photo;
      this.ui.setGalaxyAnchor(i, p.x * half.x + half.x, -p.y * half.y + half.y, visible, i === this.selectedIdx);
    });
  }

  /* ================================ LOOP ================================= */
  _loop(ts) {
    this._raf = requestAnimationFrame((t2) => this._loop(t2));
    if (this._lastTs == null) this._lastTs = ts;
    let dt = Math.min(0.1, (ts - this._lastTs) / 1000);
    this._lastTs = ts;
    if (this._hidden) return;
    dt *= this.timeScale;
    this.elapsed += dt;
    this._idle += dt;
    try {
      let buildBudget = 6;
      while (this.buildQueue.length && buildBudget > 0) {
        const bt0 = performance.now();
        this._runTask(this.buildQueue.shift());
        buildBudget -= performance.now() - bt0;
      }
      const sec = Math.floor(this.elapsed);
      if (sec !== this._lastSec) {
        this._lastSec = sec;
        this.ui.setClock(MEDELLIN.name + ' // ' + this._clockFmt.format(new Date()));
        if (this.debugOn) this._debug();
      }
      this._astroT -= dt; this._weatherT -= dt; this._planetT -= dt;
      if (this._astroT <= 0) { this._astroT = 30; this._astroTick(); }
      if (this._weatherT <= 0) { this._weatherT = 600; this._weatherTick(); }

      /* ---- QA V3.4 runner (BEFORE the chapter step so pins clamp the clock
         ahead of event dispatch — SwiftShader frame hiccups can't skip a beat) */
      if (this._qaSteps && this._qaSteps.length) {
        const s = this._qaSteps[0];
        let ok = false;
        try { ok = s.if(); } catch (e) { ok = false; }
        if (ok) { this._qaSteps.shift(); try { s.do(); } catch (e) { console.error('[SG QA]', e); } }
      }
      if (this._qaPin && this.chapter === this._qaPin.chapter) {
        const nowMt = this._chBase + (performance.now() - this._chStart) / 1000;
        if (nowMt > this._qaPin.mt) this._chStart = performance.now() - (this._qaPin.mt - this._chBase) * 1000;
        if (this._qaPin.sep && this._sepT > this._qaPin.sep) this._sepT = this._qaPin.sep;
        if (this._qaPin.fair && this._fairT > this._qaPin.fair) this._fairT = this._qaPin.fair;
      }
      if (this._qaDep != null && this.chapter === 'orbit') {
        if (!this._depT && this.mt > 0.8) this._beginDeparture();
        if (this._depT) {
          this._depT = Math.min(this._depT, this._qaDep);
          if (this._qaDep < 1 && this._depT >= this._qaDep) this._depDone = false;
        }
        if (this._qaDep >= 1 && this._depDone) this._holdCharge = true;
      }

      this._worldUpdate(dt);
      this._chapterUpdate(dt);
      this._cameraUpdate(dt);
      this._scanUpdate(dt);
      this._pollGamepad(dt);
      this._autoQuality(dt, ts);
      this._watchdog();
      /* §67-§71 art-shot holds — clock pinned, everything else alive */
      if (this._shot === 'intro' && this.chapter === 'intro' && this.mt > 2.4) {
        this._chStart = performance.now() - (2.4 - this._chBase) * 1000;
      }
      const PIN = { maxq: 10.6, stageSep: 15.95, stage2: 16.9, fairing: 17.6 };
      const pin = PIN[this._shot];
      if (pin && this.chapter === 'ascentSpace' && this.mt > pin) {
        this._chStart = performance.now() - (pin - this._chBase) * 1000;
        /* keep the separation mid-flight for review */
        if (this._shot === 'stageSep' && this._sepT > 1.1) this._sepT = 1.1;
        if (this._shot === 'fairing' && this._fairT > 1.0) this._fairT = 1.0;
      }
      if (this._shot && this._shot.indexOf('earthDeparture') === 0 && this.chapter === 'orbit') {
        const frac = this._shot === 'earthDeparture25' ? 0.25 : this._shot === 'earthDeparture50' ? 0.5 : 1;
        if (!this._depT && this.mt > 1.2) this._beginDeparture();
        if (this._depT) {
          this._depT = Math.min(this._depT, frac);
          if (frac < 1 && this._depT >= frac) this._depDone = false;   /* hold pre-complete */
          if (frac >= 1) this._depT = 1;                               /* full disc hold */
        }
        if (frac >= 1 && this._depDone) this._holdCharge = true;       /* pause before warp CTA */
      }
      if (this._holdCharge && this.chapter === 'orbit') {
        this._chStart = performance.now() - (Math.min(this.mt, 12.5) - this._chBase) * 1000;
      }
      if (this._shot === 'galaxySelected' && this.chapter === 'hub' && this.selectedIdx < 0 && this.mt > 1.4 && !this._shotSel) {
        this._shotSel = true;
        this.galaxyActivate(0);
      }
      if (this._autotest) this._autotestTick();

      if (!this._ctxLost) this._renderFrame();
      this.fatalCount = 0;
    } catch (err) {
      this.fatalCount++;
      /* NEVER swallow the first error (P0 §6) */
      if (this.fatalCount === 1 || this.debugOn || this._autotest) {
        console.error('[SG ERROR]', err);
        console.error('[SG STATE]', this._stateDump());
      }
      if (this.debugOn) this._showRuntimeErrorScreen(err);
      this._degrade(err);
    }
  }
  _stateDump() {
    return {
      build: SG_BUILD_ID,
      chapter: this.chapter,
      chapterElapsed: +this.mt.toFixed(2),
      lastTransition: this._lastTransition,
      buildQueue: this.buildQueue.map((t) => t.name),
      camMode: this.camMode,
      quality: this._tier() + (this.safeMode ? '+safe' : ''),
      dpr: this.dpr,
      postOK: this.postOK,
      worker: this.earthWorkerState,
      weather: this.w.weatherSrc,
      gl: this._gpuInfo ? this._gpuInfo.gl : '',
      gpu: this._gpuInfo ? this._gpuInfo.gpu : '',
      renderer: this.renderer && this.renderer.info ? this.renderer.info.render : null,
    };
  }
  /* DEGRADE LADDER (P0.1 §27): identical loop errors first disable post,
     then force safe visuals; only if the minimal pipeline itself keeps
     failing does control return to main (restart offer → maybe Lite). */
  _degrade(err) {
    const key = String((err && err.message) || err).slice(0, 140);
    const now = performance.now();
    this._errLadder = this._errLadder.filter((e) => now - e.t < 30000);
    this._errLadder.push({ t: now, key });
    const same = this._errLadder.filter((e) => e.key === key).length;
    if (this._degradeStage === 0 && same >= 3) {
      this._degradeStage = 1;
      if (this.postOK) {
        this.postOK = false;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        console.warn('[SG DEGRADE] postprocessing disabled after repeated error:', key);
      }
      this._errLadder = [];
      return;
    }
    if (this._degradeStage === 1 && same >= 3) {
      this._degradeStage = 2;
      this._applySafeVisuals();
      console.warn('[SG DEGRADE] SAFE 3D visuals engaged after repeated error:', key);
      this._errLadder = [];
      return;
    }
    if (this._degradeStage >= 2 && same >= 5) {
      cancelAnimationFrame(this._raf);
      this.onFatal(err);
    }
  }
  _applySafeVisuals() {
    try {
      this.safeMode = true;
      this.renderer.shadowMap.enabled = false;
      this.postOK = false;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.cloudFrac = 0.4;
      this.dpr = Math.min(this.dpr, 1.5);
      this.renderer.setPixelRatio(this.dpr);
      this._resize();
    } catch (e) { /* even safe application must not throw */ }
  }
  /* SG RUNTIME ERROR screen — debug only, hides nothing (P0.1 §3) */
  _showRuntimeErrorScreen(err) {
    if (this._errScreen) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;max-height:60vh;overflow:auto;z-index:998;background:rgba(20,4,8,.96);color:#ffd9d9;border:1px solid #ff6a6a;border-radius:10px;padding:14px;font:11px/1.6 monospace;white-space:pre-wrap';
    const st = this._stateDump();
    d.textContent = [
      'SG RUNTIME ERROR',
      '',
      'BUILD:          ' + st.build + '  (v' + SG_VERSION + ')',
      'CHAPTER:        ' + st.chapter,
      'CHAPTER TIME:   ' + st.chapterElapsed + 's',
      'ERROR:          ' + ((err && err.name) || 'Error'),
      'MESSAGE:        ' + ((err && err.message) || String(err)),
      'STACK:          ' + ((err && err.stack) || '—'),
      'LAST TRANSITION:' + st.lastTransition,
      'BUILD QUEUE:    ' + (st.buildQueue.join(', ') || '—'),
      'RENDERER:       ' + JSON.stringify(st.renderer),
      'WEBGL VERSION:  ' + st.gl,
      'GPU:            ' + st.gpu,
      'DPR:            ' + st.dpr,
      'QUALITY:        ' + st.quality,
      'POSTPROCESSING: ' + (st.postOK ? 'ON' : 'OFF'),
      'WORKER:         ' + st.worker,
      'WEATHER:        ' + st.weather,
    ].join('\n');
    const x = document.createElement('button');
    x.textContent = 'CERRAR';
    x.style.cssText = 'margin-top:10px;padding:6px 12px;font:600 11px monospace;background:#331014;color:#ffb3b3;border:1px solid #ff6a6a;border-radius:6px;cursor:pointer';
    x.onclick = () => { d.remove(); this._errScreen = null; };
    d.appendChild(x);
    document.body.appendChild(d);
    this._errScreen = d;
  }
  /* ?autotest=1 — drives the whole mission hands-free and logs PASS lines
     for every transition; ends with FULL MISSION PASS at the hub (P0 §7) */
  _autotestTick() {
    const A = this._atState;
    if (this._autotestSkip && !A.skipped && (this.chapter === 'intro' || this.chapter === 'approach') && this.elapsed > 2) {
      A.skipped = true;
      this.skipIntro();                    /* exactly the real button callback */
      if (this.chapter === 'facility') console.log('[SG TEST] SKIP → FACILITY PASS');
      else console.error('[SG TEST] SKIP FAILED — landed in ' + this.chapter);
    }
    if (this.chapter === 'facility' && !A.sg01 && this.mt > 0.4) {
      A.sg01 = true;
      try { this._sg01Contact(); } catch (e) {}
    }
    if (this.chapter === 'facility' && this.ctaMode === 'launch' && !A.launched && this.mt > 0.9) {
      A.launched = true;
      console.log('[SG TEST] CTA LAUNCH → pressed');
      this.handleCTA();
    }
    if (this.chapter === 'charge' && this.ctaMode === 'warp' && !A.warped) {
      A.warped = true;
      console.log('[SG TEST] CTA WARP → pressed');
      this.handleCTA();
    }
    if (this.chapter === 'hub' && this.builtHub && !A.done) {
      A.done = true;
      const g3 = this.galaxyGroups && this.galaxyGroups.length === 3;
      console.log(g3 ? '[SG TEST] GALAXIES ×3 PASS' : '[SG TEST] GALAXIES FAIL');
      /* §63 GALAXY UX TEST — free switching, CTA-only navigation */
      try {
        this.galaxyActivate(0);
        console.log(this.selectedIdx === 0 && !this.confirming ? '[SG TEST] GALAXY 01 SELECT PASS' : '[SG TEST] GALAXY 01 SELECT FAIL');
        this.galaxyActivate(1);
        console.log(this.selectedIdx === 1 && !this.confirming ? '[SG TEST] GALAXY 02 SWITCH PASS' : '[SG TEST] GALAXY 02 SWITCH FAIL');
        this.galaxyActivate(2);
        console.log(this.selectedIdx === 2 && !this.confirming ? '[SG TEST] GALAXY 03 SWITCH PASS' : '[SG TEST] GALAXY 03 SWITCH FAIL');
        this.galaxyActivate(0);
        console.log(this.selectedIdx === 0 && !this.confirming ? '[SG TEST] GALAXY 01 RESELECT PASS' : '[SG TEST] GALAXY 01 RESELECT FAIL');
        this._galaxyPanelSync();
        this.galaxyConfirm(0, 'dbl'); /* logs GALAXY DBLCLICK PASS, suppressed */
        this.galaxyConfirm(0);        /* logs GALAXY CTA PASS, never navigates */
      } catch (e) { console.error('[SG TEST] GALAXY UX FAIL', e); }
      console.log('[SG TEST] HUB PASS');
      if (A.skipped) console.log('[SG TEST] SKIP INTRO PASS');
      if (this.safeMode) console.log('[SG TEST] SAFE MODE PASS');
      if (this._fail.has('worker')) console.log('[SG TEST] WORKER FAILURE PASS');
      if (this._fail.has('post')) console.log('[SG TEST] POST FAILURE PASS');
      if (this._fail.has('satellites')) console.log('[SG TEST] SATELLITE FAILURE PASS');
      if (this._fail.has('weather')) console.log('[SG TEST] WEATHER FAILURE PASS');
      console.log('[SG TEST] FULL MISSION PASS');
    }
  }
  /* single place that actually draws — the loop and capture() share it */
  _renderFrame() {
    if (this.postOK && this.post) {
      const U = this.post.compU;
      let G = this.grade;
      if (this.photo) {
        /* photo presets are a viewing lens, never a scene mutation (§40) */
        G = {
          lift: this.grade.lift.clone(), gain: this.grade.gain.clone(),
          sat: this.grade.sat, bloom: this.grade.bloom, thresh: this.grade.thresh,
        };
        this._photoPresetGrade(G);
      }
      U.uExposure.value = this.exposure;
      U.uLift.value.copy(G.lift);
      U.uGain.value.copy(G.gain);
      U.uSat.value = G.sat;
      U.uVig.value = this.photo && this._photoPreset === 'film' ? 0.4 : 0.32;
      U.uBloomStr.value = G.bloom;
      U.uHasBloom.value = this.post.bloomOn ? 1 : 0;
      this.post.brightU.uThresh.value = G.thresh;
      /* FTL-only lens language (spec §56) */
      U.uCA.value = this.ftl * 0.012;
      U.uDistort.value = this.ftl * 0.10;
      const pulse = this.chapter === 'warp'
        ? Math.max(sstep(0, 0.35, this.mt) * (1 - sstep(0.35, 0.9, this.mt)) * 0.35, sstep(3.0, 3.35, this.mt) * 0.4)
        : 0;
      U.uPulse.value = pulse;
      const px = this.dpr;
      this.pSteam.setPx(px); this.pCore.setPx(px); this.pPlume.setPx(px); this.pOuter.setPx(px); this.pSmoke.setPx(px); this.pBurst.setPx(px);
      this.post.render(this.scene, this.cam);
    } else {
      this.renderer.toneMappingExposure = this.exposure;
      this.renderer.render(this.scene, this.cam);
    }
  }
  /* AUTO quality: DPR first, then cloud density, then bloom, then post off —
     imperceptible steps, no restarts (spec §76/§77) */
  _autoQuality(dt, ts) {
    const f = this._fps;
    const frame = ts - (f.prev || ts);
    f.prev = ts;
    f.ema = lerp(f.ema, clamp(frame, 4, 80), 0.04);
    f.t += dt;
    if (f.t < 3 || this.qualityPref !== 'auto') return;
    f.t = 0;
    if (f.ema > 60 && this.dpr > 0.85) {         /* emergency: big drop first */
      this.dpr = Math.max(0.85, this.dpr - 0.5);
      this.renderer.setPixelRatio(this.dpr);
      this._resize();
    } else if (f.ema > 26 && this.dpr > 0.85) {
      this.dpr = Math.max(0.85, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this._resize();
    } else if (f.ema > 30 && this.cloudFrac > 0.4) {
      this.cloudFrac -= 0.2;
    } else if (f.ema > 34 && this.post && this.post.bloomOn) {
      this.post.bloomOn = false;
    } else if (f.ema > 44 && this.postOK) {
      this.postOK = false;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
    }
  }
  _debug() {
    this.ui.debug(
      'UNIVERSO SG v' + SG_VERSION + ' BUILD ' + SG_BUILD_ID + (this.safeMode ? ' [SAFE]' : '') +
      '\nfps~' + Math.round(1000 / this._fps.ema) +
      ' dpr ' + this.dpr.toFixed(2) +
      '\nch ' + this.chapter + ' mt ' + this.mt.toFixed(1) + ' cam ' + this.camMode +
      '\ncloud ' + this.w.cloudLow.toFixed(2) + ' rain ' + this.w.rain.toFixed(2) + ' wet ' + this.w.wet.toFixed(2) +
      '\nsun ' + this.w.sun.alt.toFixed(1) + '° src ' + this.w.weatherSrc +
      (this._earthTexSrc
        ? '\nEARTH DAY=' + (this._earthTexSrc.day || '—').toUpperCase() +
          ' NIGHT=' + (this._earthTexSrc.night || '—').toUpperCase() +
          ' CLOUDS=' + (this._earthTexSrc.clouds || '—').toUpperCase() +
          (this._earthFileRes ? ' RES=' + (this._earthFileRes.day || 0) : '')
        : '') +
      (this.gSpace.visible && this.earth
        ? '\nEARTH R=' + this.earthR +
          ' DIST=' + Math.round(this.cam.position.distanceTo(this.earthCenter)) +
          ' COVERAGE=' + Math.round(this._earthScreenCoverage() * 100) + '%' +
          ' CAM=' + this.camMode
        : '') +
      (this.chapter === 'hub'
        ? '\nHOVER ' + this.hoverIdx + ' SELECTED ' + this.selectedIdx +
          ' RAY ' + (this._lastRayHit == null ? '—' : this._lastRayHit) +
          ' DOM ' + (this._lastDomHit == null ? '—' : this._lastDomHit)
        : '')
    );
  }

  /* V3.3 QA controls (?debug=1 panel): jump the REAL clock to a beat or
     drive the hub — never a fake state, always the same code paths. */
  qa(action) {
    const jump = (mtTarget) => {
      if (this.chapter !== 'ascentSpace') return;
      this._chStart = performance.now() - (mtTarget - this._chBase) * 1000;
    };
    if (action === 'stagesep') jump(15.7);
    else if (action === 'stage2') jump(16.5);
    else if (action === 'fairing') jump(17.3);
    else if (action === 'hero') {
      if (this.chapter === 'orbit') { this.aim.yaw = 0; this.aim.pitch = 0; this.camMode = 'director'; }
    } else if (action === 'departure') {
      if (this.chapter === 'orbit') this._beginDeparture();
    } else if (action === 'selg1') {
      if (this.chapter === 'hub') this.galaxyActivate(0);
    } else if (action === 'dblg1') {
      if (this.chapter === 'hub') this.galaxyConfirm(0, 'dbl');
    }
  }

  /* ===================== QA V3.4 (?qa=v34, spec §139-§143) ================
     Every destination drives the REAL mission path (skip → CTA → chapter
     events) and then pins the real chapter clock on the beat. Nothing is
     faked — these are the same code paths production runs. */
  _qaJump(mt) { this._chStart = performance.now() - (mt - this._chBase) * 1000; }
  _qaClear() {
    this._qaSteps = [];
    this._qaPin = null;
    this._qaDep = null;
    this._holdCharge = false;
  }
  qaV34(action) {
    const S = [];
    const step = (cond, run) => S.push({ if: cond, do: run });
    const toFacility = () => step(
      () => true,
      () => { if (this.chapter === 'intro' || this.chapter === 'approach') this.skipIntro(); }
    );
    const launch = () => {
      toFacility();
      step(() => this.chapter === 'facility' && this.ctaMode === 'launch', () => this.handleCTA());
    };
    const cdJump = (mt2) => { launch(); step(() => this.chapter === 'countdown', () => this._qaJump(mt2)); };
    const ascJump = (mt2) => { cdJump(6.92); step(() => this.chapter === 'ascent', () => this._qaJump(mt2)); };
    const spaceJump = (mt2, pin) => {
      ascJump(6.36);
      step(() => this.chapter === 'ascentSpace', () => {
        this._qaJump(mt2);
        if (pin) this._qaPin = Object.assign({ chapter: 'ascentSpace' }, pin);
      });
    };
    const toOrbit = (hold) => {
      spaceJump(18.75);
      step(() => this.chapter === 'orbit', () => { if (hold) { this._holdCharge = true; this._qaPin = { chapter: 'orbit', mt: 2.6 }; } });
    };
    const toHub = () => {
      toFacility();
      step(() => this.chapter === 'facility', () => this.skipFlight());
    };
    this._qaClear();
    switch (action) {
      case 'facility': toFacility(); step(() => this.chapter === 'facility' && this.builtFacility, () => {
        /* HERO composition (§166): rocket dominates, tower frames, road leads */
        this._setCamMode('orbit', true);
        this.orb.theta = -0.62; this.orb.phi = 0.15; this.orb.radius = 60;
        this.orb.target.set(0, 24, 0);
        this.camBlend.t = 1;
      }); break;
      case 'countdown5': launch(); step(() => this.chapter === 'countdown', () => { this._qaJump(0.96); this._qaPin = { chapter: 'countdown', mt: 1.55 }; }); break;
      case 'countdown1': launch(); step(() => this.chapter === 'countdown', () => { this._qaJump(4.9); this._qaPin = { chapter: 'countdown', mt: 5.55 }; }); break;
      case 'voicees': ['v_5', 'v_4', 'v_3', 'v_2', 'v_1', 'v_ignition'].forEach((k, i2) =>
        setTimeout(() => this.audio.speak(t(k), 'es', { interrupt: false }), i2 * 900)); break;
      case 'voiceen': ['Five.', 'Four.', 'Three.', 'Two.', 'One.', 'Ignition.'].forEach((w, i2) =>
        setTimeout(() => this.audio.speak(w, 'en', { interrupt: false }), i2 * 900)); break;
      case 'ignition': launch(); step(() => this.chapter === 'countdown', () => { this._qaJump(5.92); this._qaPin = { chapter: 'countdown', mt: 6.6 }; }); break;
      case 'liftoff': launch(); step(() => this.chapter === 'countdown', () => { this._qaJump(6.92); this._qaPin = { chapter: 'ascent', mt: 1.6 }; }); break;
      case 'cloudbreak': launch(); step(() => this.chapter === 'countdown', () => { this._qaJump(6.92); }); step(() => this.chapter === 'ascent', () => { this._qaJump(6.36); this._qaPin = { chapter: 'ascentSpace', mt: 7.3 }; }); break;
      case 'mach1': spaceJump(8.16, { mt: 8.95 }); break;
      case 'maxq': spaceJump(10.35, { mt: 11.6 }); break;
      case 'strato': spaceJump(13.25, { mt: 14.6 }); break;
      case 'meco': spaceJump(15.16, { mt: 15.65 }); break;
      case 'stagesep': spaceJump(15.82, { mt: 16.5, sep: 1.1 }); break;
      case 'stage2': spaceJump(16.62, { mt: 17.25 }); break;
      case 'fairing': spaceJump(17.42, { mt: 18.3, fair: 1.0 }); break;
      case 'earthhero': toOrbit(true); step(() => this.chapter === 'orbit', () => { this.aim.yaw = 0; this.aim.pitch = 0; this.camMode = 'director'; }); break;
      case 'earthnight': toOrbit(true); step(() => this.chapter === 'orbit', () => {
        if (!this._heroQ) this._orientEarthHero();
        this._heroOrient = true;
        /* the surface facing this camera has normal ≈ (0, 0.996, 0.11) —
           put the sun OPPOSITE it so the visible hemisphere is deep night
           (city lights + airglow), with a lit crescent on the left (§45) */
        this._heroSun.set(-0.42, -0.86, -0.28).normalize();
      }); break;
      case 'sunrise': toOrbit(true); step(() => this.chapter === 'orbit', () => this.startSunrise()); break;
      case 'orbitcam': toOrbit(true); step(() => this.chapter === 'orbit', () => this._setCamMode('orbit')); break;
      case 'freespace': toOrbit(true); step(() => this.chapter === 'orbit', () => this._setCamMode('free')); break;
      case 'freefar': toOrbit(true); step(() => this.chapter === 'orbit', () => {
        this._setCamMode('free', true);
        const C = this.earthCenter, R = this.earthR;
        this.free.pos.set(C.x + R * 1.4, C.y + R * 2.4, C.z + R * 3.6);
        const g2 = this._yawPitchToward(this.free.pos, C);
        this.free.yaw = g2.yaw; this.free.pitch = g2.pitch;
        this.camBlend.t = 1;
      }); break;
      case 'focusearth': step(() => this.chapter === 'orbit' || this.chapter === 'charge', () => this.focusEarth()); break;
      case 'resetview': step(() => this.chapter === 'orbit' || this.chapter === 'charge', () => this.resetOrbitView()); break;
      case 'home': toOrbit(true); step(() => this.chapter === 'orbit', () => this.locateHome()); break;
      case 'dep25': toOrbit(false); step(() => this.chapter === 'orbit', () => { this._qaDep = 0.25; }); break;
      case 'dep50': toOrbit(false); step(() => this.chapter === 'orbit', () => { this._qaDep = 0.5; }); break;
      case 'depfull': toOrbit(false); step(() => this.chapter === 'orbit', () => { this._qaDep = 1; }); break;
      case 'prewarp': toOrbit(false); step(() => this.chapter === 'charge' && this.ctaMode === 'warp', () => { this._qaPin = { chapter: 'charge', mt: 3.4 }; }); break;
      case 'warp': toOrbit(false);
        step(() => this.chapter === 'charge' && this.ctaMode === 'warp', () => this._engageWarp());
        step(() => this.chapter === 'warp', () => { this._qaPin = { chapter: 'warp', mt: 1.8 }; });
        break;
      case 'hub': toHub(); break;
      case 'arrival': toHub(); step(() => this.chapter === 'hub', () => {
        this._arrivalDur = 9; this._arrivalT = 9; this._arrivalDone = false;
        this.ui.letterbox(true); this.ui.cinematic(true);
        this.ui.anchorsVisible(false); this.ui.hideGalaxy();
        this.exposure = 0.42; this._arrivalYaw0 = rand(-0.3, 0.3);
      }); break;
      case 'g1': case 'g2': case 'g3': {
        const gi2 = { g1: 0, g2: 1, g3: 2 }[action];
        toHub();
        step(() => this.chapter === 'hub' && this.builtHub, () => {
          this._arrivalRelease();
          this.galaxyActivate(gi2);
        });
        break;
      }
      case 'scan1': case 'scan2': case 'scan3': {
        const gi2 = { scan1: 0, scan2: 1, scan3: 2 }[action];
        toHub();
        step(() => this.chapter === 'hub' && this.builtHub, () => {
          this._arrivalRelease();
          this.galaxyActivate(gi2);
          const g2 = this._yawPitchToward(new T.Vector3(this.hubStrafe.x, this.hubStrafe.y, 0), this.galaxyGroups[gi2].position);
          this.aim.yaw = g2.yaw; this.aim.pitch = g2.pitch;
          if (!this.scanOn) this.toggleScanner();
        });
        break;
      }
      case 'blackhole': toHub(); step(() => this.chapter === 'hub' && this.blackHole, () => {
        this._arrivalRelease();
        const g2 = this._yawPitchToward(new T.Vector3(0, 0, 0), this.blackHole.position);
        this.aim.yaw = g2.yaw; this.aim.pitch = clamp(g2.pitch, -1.3, 1.35);
        if (!this.scanOn) this.toggleScanner();
      }); break;
      case 'event': toHub(); step(() => this.chapter === 'hub' && this.builtHub, () => { this._arrivalRelease(); this._hubEventT = 0.1; }); break;
      case 'perf': this.debugOn = !this.debugOn; if (!this.debugOn) this.ui.debug(null); break;
      case 'reset': break;                       /* _qaClear above already ran */
      default: break;
    }
    this._qaSteps = S;
    this.ui.quick('QA // ' + action.toUpperCase());
  }
  /* ------------------------------ external ------------------------------ */
  refreshLang() {
    if (this.ctaMode) this.ui.setCTA(this.ctaMode);
    if (this.chapter === 'facility') this.ui.setHint(this.isTouch ? t('hint_facility_touch') : t('hint_facility'));
    else if (this.chapter === 'hub') this.ui.setHint(t('hint_hub'));
    else if (this.chapter === 'orbit' || this.chapter === 'charge') this.ui.setHint(t('hint_orbit'));
  }
  setMotion(on) { this.motionOK = on; }
  /* REAL quality presets — switching changes shadows, dpr cap, bloom, cloud
     budget immediately (star/texture counts apply on reload; spec §75) */
  setQuality(q) {
    this.qualityPref = q;
    const pre = this._preset();
    this.dpr = clamp(window.devicePixelRatio || 1, 1, pre.dprCap);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = pre.shadows;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (this.post) {
      this.post.bloomOn = pre.bloom;
      this.post.iters = pre.iters;
    }
    this.cloudFrac = q === 'performance' ? 0.55 : 1;
    this._resize();
  }
  /* USER OBSERVER (spec §15/§69): geolocation feeds a second observer for the
     LOCAL SKY panel. The 3D world stays anchored to Medellín — the SG base. */
  setUserObserver(lat, lon) {
    this.userObs = { lat, lon };
    this._userPanelCache = null;
  }
  setSkyObserver(which) {
    this.skyObserver = (which === 'user' && this.userObs) ? 'user' : 'base';
    this._userPanelCache = null;
  }
  getPanelState() {
    const now = new Date();
    if (this.skyObserver === 'user' && this.userObs) {
      const c = this._userPanelCache;
      if (c && (now.getTime() - c.at) < 30000) return c.state;
      const { lat, lon } = this.userObs;
      const sunPath = [];
      const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
      for (let h = 0; h <= 24; h++) {
        sunPath.push(ASTRO.sunPosition(new Date(d0.getTime() + h * 3600000), lat, lon));
      }
      const state = {
        weather: this.w.weather,
        sun: ASTRO.sunPosition(now, lat, lon),
        moon: ASTRO.moonPosition(now, lat, lon),
        planets: ASTRO.planetPositions(now, lat, lon),
        sunPath,
        observer: 'USER OBSERVER ' + lat.toFixed(1) + '°, ' + lon.toFixed(1) + '°',
      };
      this._userPanelCache = { at: now.getTime(), state };
      return state;
    }
    if (!this._sunPath || this._sunPathDay !== now.getUTCDate()) {
      this._sunPathDay = now.getUTCDate();
      this._sunPath = [];
      const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
      for (let h = 0; h <= 24; h++) {
        const d = new Date(d0.getTime() + h * 3600000);
        this._sunPath.push(ASTRO.sunPosition(d, MEDELLIN.lat, MEDELLIN.lon));
      }
    }
    return {
      weather: this.w.weather,
      sun: this.w.sun,
      moon: this.w.moon,
      planets: this.w.planets,
      sunPath: this._sunPath,
      observer: 'MEDELLÍN // BASE OBSERVER',
    };
  }
}
