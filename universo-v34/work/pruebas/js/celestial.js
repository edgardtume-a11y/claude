/* ============================================================================
   UNIVERSO SEBAS GRANDA — celestial.js
   Real sky + real Earth building blocks (no network required).
   · STAR_CATALOG: ~85 brightest stars with true RA/Dec/magnitude/colour.
   · Milky Way: points sampled in real galactic coordinates, rotated rigidly
     with the sky via astronomy.equatorialToWorldMatrix.
   · Moon: equirect texture with the real near-side maria + Tycho rays.
   · Earth: geographic day / night-lights / clouds / ocean-mask canvases with
     real continent silhouettes and real major-city light clusters.
   All canvases are fallbacks: if optional NASA imagery is placed under
   assets/earth/ (see assets/README.txt) it is loaded and used instead.
   ============================================================================ */

import { raDecToVec } from './astronomy.js';

const TAU = Math.PI * 2;

/* canvas factory: main thread by default, OffscreenCanvas inside Workers */
function defaultCreate(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);

/* ----------------------------- STAR CATALOG ------------------------------ */
/* name, RA°, Dec°, visual magnitude, effective temperature (K, capped). */
export const STAR_CATALOG = [
  ['SIRIUS', 101.287, -16.716, -1.46, 9900], ['CANOPUS', 95.988, -52.696, -0.74, 7300],
  ['RIGIL KENT', 219.899, -60.834, -0.27, 5800], ['ARCTURUS', 213.915, 19.182, -0.05, 4300],
  ['VEGA', 279.235, 38.784, 0.03, 9600], ['CAPELLA', 79.172, 45.998, 0.08, 5700],
  ['RIGEL', 78.634, -8.202, 0.13, 11500], ['PROCYON', 114.826, 5.225, 0.34, 6550],
  ['ACHERNAR', 24.429, -57.237, 0.46, 14500], ['BETELGEUSE', 88.793, 7.407, 0.50, 3500],
  ['HADAR', 210.956, -60.373, 0.61, 14000], ['ALTAIR', 297.696, 8.868, 0.77, 7800],
  ['ACRUX', 186.650, -63.099, 0.76, 14000], ['ALDEBARAN', 68.980, 16.509, 0.86, 3900],
  ['ANTARES', 247.352, -26.432, 0.96, 3600], ['SPICA', 201.298, -11.161, 0.97, 13500],
  ['POLLUX', 116.329, 28.026, 1.14, 4700], ['FOMALHAUT', 344.413, -29.622, 1.16, 8600],
  ['DENEB', 310.358, 45.280, 1.25, 8500], ['MIMOSA', 191.930, -59.689, 1.25, 14000],
  ['REGULUS', 152.093, 11.967, 1.35, 12000], ['ADHARA', 104.656, -28.972, 1.50, 13500],
  ['CASTOR', 113.650, 31.888, 1.58, 10300], ['GACRUX', 187.791, -57.113, 1.63, 3600],
  ['SHAULA', 263.402, -37.104, 1.62, 14000], ['BELLATRIX', 81.283, 6.350, 1.64, 13000],
  ['ELNATH', 81.573, 28.607, 1.65, 13000], ['MIAPLACIDUS', 138.300, -69.717, 1.69, 8900],
  ['ALNILAM', 84.053, -1.202, 1.69, 14500], ['ALNAIR', 332.058, -46.961, 1.74, 13500],
  ['ALNITAK', 85.190, -1.943, 1.77, 14500], ['ALIOTH', 193.507, 55.960, 1.77, 9400],
  ['DUBHE', 165.932, 61.751, 1.79, 4650], ['MIRFAK', 51.081, 49.861, 1.80, 6350],
  ['WEZEN', 107.098, -26.393, 1.84, 6200], ['SARGAS', 264.330, -42.998, 1.87, 7300],
  ['KAUS AUSTRALIS', 276.043, -34.385, 1.85, 9900], ['AVIOR', 125.628, -59.510, 1.86, 4600],
  ['ALKAID', 206.885, 49.313, 1.86, 13500], ['MENKALINAN', 89.882, 44.947, 1.90, 9200],
  ['ATRIA', 252.166, -69.028, 1.91, 4200], ['ALHENA', 99.428, 16.399, 1.92, 9300],
  ['PEACOCK', 306.412, -56.735, 1.94, 13500], ['ALSEPHINA', 131.176, -54.709, 1.96, 9000],
  ['MIRZAM', 95.675, -17.956, 1.98, 14000], ['ALPHARD', 141.897, -8.658, 1.98, 4100],
  ['POLARIS', 37.955, 89.264, 1.98, 6000], ['HAMAL', 31.793, 23.462, 2.00, 4500],
  ['DIPHDA', 10.897, -17.987, 2.02, 4800], ['NUNKI', 283.816, -26.297, 2.06, 13500],
  ['MENKENT', 211.671, -36.370, 2.06, 4900], ['MIRACH', 17.433, 35.620, 2.05, 3800],
  ['ALPHERATZ', 2.097, 29.090, 2.06, 13000], ['RASALHAGUE', 263.734, 12.560, 2.07, 8500],
  ['KOCHAB', 222.676, 74.156, 2.08, 4000], ['SAIPH', 86.939, -9.670, 2.09, 14000],
  ['DENEBOLA', 177.265, 14.572, 2.13, 8500], ['ALGOL', 47.042, 40.956, 2.12, 12500],
  ['TIAKI', 340.667, -46.885, 2.10, 3500], ['MUHLIFAIN', 190.379, -48.960, 2.17, 9100],
  ['ASPIDISKE', 139.273, -59.275, 2.21, 7500], ['SUHAIL', 136.999, -43.433, 2.21, 4200],
  ['ALPHECCA', 233.672, 26.715, 2.23, 9700], ['MIZAR', 200.981, 54.926, 2.23, 9000],
  ['SADR', 305.557, 40.257, 2.23, 6100], ['SCHEDAR', 10.127, 56.537, 2.24, 4550],
  ['ELTANIN', 269.152, 51.489, 2.23, 3900], ['MINTAKA', 83.002, -0.299, 2.25, 14500],
  ['CAPH', 2.295, 59.150, 2.28, 7000], ['DSCHUBBA', 240.083, -22.622, 2.29, 14000],
  ['LARAWAG', 252.541, -34.293, 2.29, 4600], ['EPS CENTAURI', 204.972, -53.466, 2.30, 14000],
  ['ALPHA LUPI', 220.482, -47.388, 2.30, 14000], ['ETA CENTAURI', 218.877, -42.158, 2.31, 14000],
  ['MERAK', 165.460, 56.383, 2.37, 9500], ['IZAR', 221.247, 27.074, 2.37, 4600],
  ['ENIF', 326.046, 9.875, 2.39, 4400], ['ANKAA', 6.571, -42.306, 2.38, 4400],
  ['GIRTAB', 265.622, -39.030, 2.39, 13500], ['PHECDA', 178.458, 53.695, 2.44, 9400],
  ['SABIK', 257.595, -15.725, 2.43, 8900], ['SCHEAT', 345.944, 28.083, 2.42, 3700],
  ['ALDERAMIN', 319.645, 62.585, 2.45, 7700], ['ALUDRA', 111.024, -29.303, 2.45, 13500],
  ['MARKAB', 346.190, 15.205, 2.49, 10100], ['MENKAR', 45.570, 4.090, 2.54, 3800],
];

/* Blackbody-ish star tint. */
export function starColor(tempK) {
  const t = clamp((tempK - 3200) / (11000 - 3200), 0, 1);
  const r = lerp(1.0, 0.72, Math.pow(t, 1.2));
  const g = lerp(0.62, 0.82, Math.sqrt(t)) + 0.12;
  const b = lerp(0.42, 1.0, Math.pow(t, 0.7));
  return [Math.min(1, r), Math.min(1, g), Math.min(1, b)];
}

/* Build catalog-star buffers. Positions are UNIT EQUATORIAL vectors; the
   experience rotates the whole group with equatorialToWorldMatrix each tick. */
export function buildCatalogStars() {
  const n = STAR_CATALOG.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const siz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [, ra, dec, mag, temp] = STAR_CATALOG[i];
    const v = raDecToVec(ra, dec);
    pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2];
    const c = starColor(temp);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    siz[i] = clamp(3.4 - mag * 0.62, 1.15, 4.4);
  }
  return { pos, col, siz, n };
}

/* ------------------------------ MILKY WAY -------------------------------- */
/* Galactic->equatorial via three real anchor directions. */
const GAL_X = raDecToVec(266.405, -28.936);  /* l=0,  b=0  (galactic centre) */
const GAL_Y = raDecToVec(318.004, 48.330);   /* l=90, b=0                    */
const GAL_Z = raDecToVec(192.859, 27.128);   /* b=90 (north galactic pole)   */
function galToEq(lDeg, bDeg) {
  const l = lDeg * Math.PI / 180, b = bDeg * Math.PI / 180;
  const cb = Math.cos(b);
  const gx = cb * Math.cos(l), gy = cb * Math.sin(l), gz = Math.sin(b);
  return [
    gx * GAL_X[0] + gy * GAL_Y[0] + gz * GAL_Z[0],
    gx * GAL_X[1] + gy * GAL_Y[1] + gz * GAL_Z[1],
    gx * GAL_X[2] + gy * GAL_Y[2] + gz * GAL_Z[2],
  ];
}
function gauss() { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) / 1.05; }

/* Band brightness profile along galactic longitude (bulge at l≈0). */
function mwProfile(l) {
  const dl = Math.min(Math.abs(l), 360 - Math.abs(l));
  return 0.32 + 0.68 * Math.exp(-Math.pow(dl / 78, 2)) + 0.25 * Math.exp(-Math.pow((Math.abs(l - 285)) / 30, 2));
}
/* Great-Rift style dark lane mask (1 = keep, 0 = dust-blocked). */
function mwLane(l, b) {
  const inLane = Math.exp(-Math.pow(b / 2.1, 2)) *
    (0.75 * Math.exp(-Math.pow(((l + 360) % 360 - 12) / 36, 2)) +
     0.55 * Math.exp(-Math.pow(((l + 360) % 360 - 318) / 26, 2)));
  return 1 - clamp(inLane, 0, 0.92);
}

export function buildMilkyWay(countStars, countGlow) {
  const sp = new Float32Array(countStars * 3);
  const sc = new Float32Array(countStars * 3);
  const ss = new Float32Array(countStars);
  let i = 0, guard = 0;
  while (i < countStars && guard++ < countStars * 40) {
    const l = rand(0, 360);
    const prof = mwProfile(l);
    if (Math.random() > prof) continue;
    const b = gauss() * lerp(9.5, 5.0, prof) + gauss() * 1.6;
    if (Math.random() > mwLane(l, b)) continue;
    const v = galToEq(l, b);
    sp[i * 3] = v[0]; sp[i * 3 + 1] = v[1]; sp[i * 3 + 2] = v[2];
    const warm = Math.exp(-Math.pow(Math.min(Math.abs(l), 360 - l) / 60, 2));
    sc[i * 3] = lerp(0.72, 1.0, warm);
    sc[i * 3 + 1] = lerp(0.80, 0.86, warm);
    sc[i * 3 + 2] = lerp(1.0, 0.72, warm * 0.8);
    ss[i] = rand(0.55, 1.5);
    i++;
  }
  const gp = new Float32Array(countGlow * 3);
  const gc = new Float32Array(countGlow * 3);
  const gs = new Float32Array(countGlow);
  i = 0; guard = 0;
  while (i < countGlow && guard++ < countGlow * 60) {
    const l = rand(0, 360);
    const prof = mwProfile(l);
    if (Math.random() > prof) continue;
    const b = gauss() * lerp(7.5, 4.2, prof);
    if (Math.random() > mwLane(l, b) * 0.9 + 0.1) continue;
    const v = galToEq(l, b);
    gp[i * 3] = v[0]; gp[i * 3 + 1] = v[1]; gp[i * 3 + 2] = v[2];
    const warm = Math.exp(-Math.pow(Math.min(Math.abs(l), 360 - l) / 55, 2));
    gc[i * 3] = lerp(0.55, 0.95, warm);
    gc[i * 3 + 1] = lerp(0.66, 0.78, warm);
    gc[i * 3 + 2] = lerp(0.95, 0.62, warm);
    gs[i] = rand(26, 64) * lerp(1, 1.7, prof);
    i++;
  }
  return { starPos: sp, starCol: sc, starSize: ss, nStars: countStars, glowPos: gp, glowCol: gc, glowSize: gs, nGlow: countGlow };
}

/* -------------------------------- MOON ----------------------------------- */
export function makeMoonTexture(size) {
  const w = size || 512, h = w / 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#b9b6b0'; g.fillRect(0, 0, w, h);
  /* regolith mottling */
  for (let i = 0; i < w * 3; i++) {
    g.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,253,248' : '60,58,54') + ',' + rand(0.015, 0.05).toFixed(3) + ')';
    const r = rand(1, 8);
    g.beginPath(); g.arc(rand(0, w), rand(0, h), r, 0, TAU); g.fill();
  }
  const U = (lon) => (0.5 + lon / 360) * w;
  const V = (lat) => (0.5 - lat / 180) * h;
  const mare = (lon, lat, rx, ry, rot, a) => {
    g.save(); g.translate(U(lon), V(lat)); g.rotate(rot || 0);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grd.addColorStop(0, 'rgba(66,66,74,' + a + ')');
    grd.addColorStop(0.75, 'rgba(74,74,82,' + a * 0.85 + ')');
    grd.addColorStop(1, 'rgba(74,74,82,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
    g.restore();
  };
  const S = w / 512; /* scale */
  mare(-16, 33, 46 * S, 34 * S, 0.2, 0.55);       /* Imbrium */
  mare(-55, 18, 78 * S, 52 * S, -0.15, 0.42);     /* Oceanus Procellarum */
  mare(18, 26, 34 * S, 30 * S, 0, 0.5);           /* Serenitatis */
  mare(31, 9, 34 * S, 28 * S, 0.2, 0.5);          /* Tranquillitatis */
  mare(59, 17, 22 * S, 18 * S, 0, 0.55);          /* Crisium */
  mare(51, -8, 26 * S, 24 * S, 0, 0.45);          /* Fecunditatis */
  mare(28, -20, 20 * S, 16 * S, 0, 0.4);          /* Nectaris */
  mare(-17, -21, 26 * S, 20 * S, 0, 0.42);        /* Nubium */
  mare(-39, -24, 18 * S, 15 * S, 0, 0.42);        /* Humorum */
  mare(0, 56, 90 * S, 12 * S, 0, 0.35);           /* Frigoris band */
  /* Tycho + rays */
  const tx = U(-11), ty = V(-43);
  g.strokeStyle = 'rgba(235,233,228,0.10)';
  for (let i = 0; i < 26; i++) {
    const a = rand(0, TAU), L = rand(30, 150) * S;
    g.lineWidth = rand(0.6, 1.6);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L * 0.6); g.stroke();
  }
  g.fillStyle = 'rgba(240,238,232,0.85)';
  g.beginPath(); g.arc(tx, ty, 4 * S, 0, TAU); g.fill();
  /* Copernicus, Kepler bright spots */
  [[-20, 10], [-38, 8], [37, -3]].forEach(([lo, la]) => {
    g.fillStyle = 'rgba(238,236,230,0.6)';
    g.beginPath(); g.arc(U(lo), V(la), 3 * S, 0, TAU); g.fill();
  });
  return c;
}

/* -------------------------------- EARTH ----------------------------------- */
/* Continent silhouettes: confident coastlines as polygons, complex regions as
   robust shape unions, seas subtracted. Recognisable at globe scale. */
const SOUTH_AMERICA = [[-77.9, 7.2], [-75.5, 10.6], [-72, 12.3], [-70, 11.6], [-68, 10.6], [-64, 10.6], [-61.8, 9.7], [-60, 8.5], [-57, 6], [-53, 5.4], [-51.5, 4.4], [-50, 1.8], [-49.9, 0.3], [-48.5, -1.5], [-44.5, -2.4], [-41.8, -2.9], [-38.5, -3.7], [-35.2, -5.5], [-34.8, -7.5], [-35.5, -9.5], [-37, -11], [-38.9, -13], [-39, -15.5], [-39.7, -18.3], [-40.9, -21.2], [-42, -22.9], [-44.7, -23.3], [-47, -24.4], [-48.6, -26.5], [-48.6, -28.5], [-51.2, -30.5], [-52.2, -32.2], [-53.4, -33.7], [-56.5, -34.7], [-58.4, -34.0], [-57.2, -36.2], [-57.4, -38.1], [-59.8, -38.9], [-61.8, -38.9], [-62.3, -40.5], [-65.1, -40.8], [-64.3, -42.4], [-65.3, -43.6], [-65.6, -45.0], [-67.6, -46.0], [-67.3, -47.8], [-68.9, -50.3], [-69.2, -51.6], [-68.4, -52.3], [-70.8, -53.8], [-73.6, -52.8], [-73.4, -50.0], [-74.5, -48.0], [-74.2, -45.8], [-73.0, -43.4], [-73.7, -41.8], [-73.2, -39.4], [-73.6, -37.2], [-72.6, -35.2], [-71.6, -33.0], [-71.5, -30.0], [-70.4, -26.5], [-70.6, -23.5], [-70.3, -21.4], [-70.3, -18.3], [-71.3, -17.3], [-75.1, -15.4], [-76.3, -13.8], [-77.2, -12.1], [-79.7, -8.0], [-81.2, -6.1], [-81.0, -4.4], [-80.0, -3.4], [-80.9, -1.0], [-80.0, 0.7], [-77.7, 2.5], [-77.3, 4.2], [-77.5, 6.2]];
const AFRICA = [[-17.0, 14.7], [-16.6, 12.5], [-13.3, 9.2], [-10.0, 6.4], [-7.5, 4.4], [-4.0, 5.3], [-1.0, 5.0], [2.5, 6.3], [4.5, 6.3], [8.5, 4.5], [9.7, 3.7], [9.3, 1.0], [9.0, -1.5], [11.8, -3.9], [13.4, -5.9], [13.0, -8.6], [13.6, -10.7], [12.0, -13.4], [12.5, -17.2], [14.5, -22.1], [14.5, -26.6], [16.5, -28.6], [18.4, -31.7], [20.0, -34.8], [22.6, -34.0], [25.6, -34.0], [27.9, -33.0], [30.0, -31.3], [32.6, -28.5], [35.3, -23.8], [34.7, -19.8], [36.5, -17.8], [40.5, -15.5], [40.5, -12.5], [39.5, -10.0], [39.2, -6.9], [38.8, -6.0], [40.1, -3.0], [41.5, -1.7], [43.0, 0.3], [46.0, 3.5], [49.0, 7.0], [51.3, 10.4], [50.8, 11.9], [47.5, 11.1], [44.2, 10.5], [43.4, 11.5], [42.7, 13.0], [41.8, 15.0], [39.7, 17.5], [38.5, 19.0], [37.2, 21.2], [35.6, 23.9], [34.2, 27.8], [32.6, 29.9], [32.3, 31.2], [29.9, 31.2], [25.2, 31.6], [22.0, 32.8], [19.6, 32.2], [15.3, 32.4], [13.4, 32.9], [11.1, 33.5], [10.2, 36.8], [8.6, 36.9], [5.3, 36.7], [2.9, 36.8], [-0.5, 35.8], [-2.9, 35.3], [-5.9, 35.8], [-6.8, 34.0], [-9.2, 32.6], [-9.8, 31.4], [-9.6, 30.4], [-11.5, 28.3], [-13.1, 27.7], [-14.5, 26.2], [-15.9, 23.7], [-16.5, 22.3], [-16.1, 20.8], [-16.5, 19.4], [-16.3, 16.5]];
const AUSTRALIA = [[113.6, -22.2], [114.1, -26.6], [115.1, -30.0], [115.7, -33.2], [117.9, -35.1], [121.9, -33.8], [124.0, -32.9], [129.0, -31.7], [132.6, -31.9], [135.9, -34.9], [137.7, -35.1], [139.8, -37.4], [143.5, -38.8], [146.4, -39.0], [149.0, -37.5], [150.3, -35.9], [151.3, -33.9], [153.1, -30.3], [153.6, -28.2], [152.9, -25.3], [150.9, -23.5], [149.3, -21.1], [147.4, -19.3], [146.3, -18.9], [145.3, -16.9], [144.5, -14.2], [143.6, -13.7], [142.6, -10.9], [141.5, -12.5], [140.9, -17.6], [139.2, -17.7], [137.0, -15.9], [136.4, -12.2], [134.2, -12.0], [132.5, -11.3], [130.9, -12.4], [129.6, -14.9], [127.4, -14.0], [125.9, -14.5], [124.4, -16.4], [122.2, -17.0], [120.9, -19.6], [118.7, -20.3], [116.7, -20.6], [114.6, -21.8]];
const INDIA = [[68.1, 23.6], [72.6, 21.0], [72.8, 19.0], [74.4, 14.8], [76.0, 10.3], [77.5, 8.1], [79.9, 10.3], [80.3, 13.5], [80.0, 15.8], [82.2, 17.0], [84.7, 19.3], [87.0, 21.7], [89.0, 22.0], [91.8, 22.6], [92.6, 24.5], [95.0, 27.0], [92.0, 27.5], [88.0, 27.9], [84.0, 28.6], [80.0, 29.8], [76.0, 31.5], [74.0, 33.5], [71.0, 34.0], [69.5, 31.0], [67.0, 27.5], [66.5, 25.4]];
const ARABIA = [[34.9, 29.5], [36.6, 25.0], [38.5, 21.0], [40.0, 18.0], [42.7, 14.7], [43.5, 12.7], [45.0, 13.0], [48.8, 14.0], [52.2, 15.6], [55.1, 17.0], [57.8, 18.9], [58.8, 20.4], [58.5, 22.5], [56.4, 24.5], [56.1, 26.3], [54.3, 26.5], [51.6, 25.3], [50.8, 26.8], [48.9, 27.6], [48.4, 29.4], [47.7, 30.1], [44.7, 29.2], [41.0, 31.1], [38.0, 32.0], [36.5, 32.4], [35.5, 31.0]];
const INDOCHINA = [[92.3, 21.5], [94.2, 18.0], [94.6, 16.0], [96.3, 15.4], [97.6, 16.5], [98.5, 13.5], [99.2, 9.3], [100.4, 7.2], [101.5, 6.0], [103.2, 4.0], [103.5, 1.4], [101.3, 2.1], [100.4, 3.8], [99.7, 6.5], [98.4, 8.4], [98.7, 11.7], [97.8, 14.9], [97.7, 16.6], [95.4, 19.7], [93.5, 20.0]];
const VIETNAM = [[102.1, 22.4], [106.7, 22.8], [108.0, 21.5], [106.6, 20.2], [105.7, 18.9], [106.5, 17.6], [107.8, 16.4], [109.3, 13.7], [109.2, 11.6], [108.0, 10.6], [106.5, 9.6], [104.8, 8.6], [104.9, 10.2], [103.5, 10.7], [102.5, 12.1], [101.0, 12.6], [100.0, 13.5], [100.9, 15.3], [101.2, 17.7], [101.0, 19.6], [100.2, 20.4], [101.5, 21.6]];

const CITIES = [
  /* lon, lat, weight  — real major urban glows */
  [-75.58, 6.24, 1.0], [-74.07, 4.71, 1.2], [-76.5, 3.4, 0.8], [-74.8, 11.0, 0.7], [-66.9, 10.5, 0.9],
  [-79.9, -2.2, 0.7], [-77.03, -12.04, 1.1], [-70.65, -33.45, 1.1], [-58.38, -34.6, 1.3], [-56.2, -34.9, 0.6],
  [-46.63, -23.55, 1.5], [-43.2, -22.9, 1.2], [-47.9, -15.8, 0.8], [-38.5, -12.97, 0.7], [-34.9, -8.05, 0.7],
  [-60.02, -3.1, 0.5], [-57.6, -25.3, 0.5], [-68.1, -16.5, 0.5], [-78.5, -0.2, 0.7], [-72.3, 7.9, 0.5],
  [-99.13, 19.43, 1.5], [-103.35, 20.67, 0.9], [-100.3, 25.67, 0.9], [-90.5, 14.6, 0.5], [-84.1, 9.9, 0.5],
  [-79.5, 8.98, 0.6], [-82.4, 23.1, 0.7], [-66.1, 18.4, 0.6],
  [-118.24, 34.05, 1.5], [-122.42, 37.77, 1.1], [-117.16, 32.71, 0.9], [-112.07, 33.45, 0.9], [-104.99, 39.74, 0.9],
  [-95.37, 29.76, 1.2], [-96.8, 32.78, 1.2], [-97.5, 35.5, 0.6], [-90.2, 38.63, 0.8], [-87.63, 41.88, 1.4],
  [-93.27, 44.98, 0.8], [-94.58, 39.1, 0.7], [-84.39, 33.75, 1.1], [-80.19, 25.76, 1.1], [-81.38, 28.54, 0.8],
  [-77.04, 38.9, 1.2], [-75.16, 39.95, 1.0], [-74.0, 40.71, 1.6], [-71.06, 42.36, 1.0], [-79.38, 43.65, 1.1],
  [-73.57, 45.5, 0.9], [-123.12, 49.28, 0.8], [-114.07, 51.05, 0.6], [-97.14, 49.9, 0.5], [-75.7, 45.4, 0.6],
  [-149.9, 61.2, 0.35],
  [-0.13, 51.51, 1.4], [-3.7, 40.42, 1.1], [-8.6, 41.15, 0.6], [-9.14, 38.72, 0.8], [2.35, 48.86, 1.4],
  [4.9, 52.37, 0.9], [4.35, 50.85, 0.8], [6.96, 50.94, 0.9], [13.4, 52.52, 1.1], [11.58, 48.14, 0.9],
  [9.19, 45.46, 1.0], [12.5, 41.9, 1.0], [14.27, 40.85, 0.8], [2.17, 41.39, 1.0], [-6.26, 53.35, 0.7],
  [18.06, 59.33, 0.8], [10.75, 59.91, 0.7], [12.57, 55.68, 0.8], [24.94, 60.17, 0.7], [21.0, 52.23, 0.9],
  [19.04, 47.5, 0.8], [16.37, 48.21, 0.9], [23.72, 37.98, 0.9], [28.98, 41.01, 1.3], [30.52, 50.45, 0.9],
  [37.62, 55.75, 1.4], [30.31, 59.94, 1.0], [44.5, 40.18, 0.4], [49.87, 40.38, 0.6],
  [31.24, 30.04, 1.3], [3.4, 6.45, 1.2], [7.49, 9.06, 0.6], [-17.45, 14.69, 0.6], [-4.03, 5.33, 0.6],
  [-0.19, 5.6, 0.7], [13.19, -8.84, 0.6], [18.42, -33.93, 0.8], [28.05, -26.2, 1.1], [31.05, -29.86, 0.7],
  [36.82, -1.29, 0.8], [39.28, -6.82, 0.6], [38.75, 9.02, 0.7], [32.58, 15.6, 0.5], [10.18, 36.8, 0.6],
  [3.05, 36.75, 0.7], [-7.6, 33.57, 0.8], [45.34, 2.04, 0.4], [47.5, -18.9, 0.4],
  [35.5, 33.9, 0.6], [35.21, 31.77, 0.6], [44.36, 33.31, 0.8], [51.42, 35.69, 1.2], [46.72, 24.63, 1.0],
  [55.27, 25.2, 1.0], [58.4, 23.6, 0.4], [67.0, 24.86, 1.2], [74.34, 31.55, 1.0], [77.21, 28.61, 1.6],
  [72.88, 19.08, 1.6], [77.59, 12.97, 1.2], [78.49, 17.38, 1.1], [80.27, 13.08, 1.1], [88.36, 22.57, 1.3],
  [85.32, 27.7, 0.5], [90.41, 23.81, 1.2], [96.17, 16.87, 0.7], [100.5, 13.76, 1.3], [104.9, 11.56, 0.5],
  [106.7, 10.78, 1.1], [105.85, 21.03, 0.9], [103.82, 1.35, 1.1], [101.69, 3.14, 1.0], [106.85, -6.21, 1.5],
  [110.36, -7.8, 0.7], [112.75, -7.25, 0.9], [120.98, 14.6, 1.3], [121.05, 25.03, 1.0], [114.06, 22.54, 1.5],
  [113.26, 23.13, 1.5], [121.47, 31.23, 1.7], [116.4, 39.9, 1.6], [117.2, 39.08, 1.0], [120.16, 30.29, 1.0],
  [118.79, 32.06, 1.0], [104.07, 30.67, 1.1], [106.55, 29.56, 1.0], [108.94, 34.34, 0.9], [113.65, 34.75, 0.9],
  [126.98, 37.57, 1.5], [129.07, 35.18, 0.9], [139.69, 35.69, 1.8], [135.5, 34.69, 1.4], [136.9, 35.18, 1.1],
  [130.4, 33.59, 0.9], [141.35, 43.06, 0.7], [121.56, 38.94, 0.7],
  [151.21, -33.87, 1.1], [144.96, -37.81, 1.1], [153.03, -27.47, 0.8], [115.86, -31.95, 0.7], [138.6, -34.93, 0.6],
  [174.76, -36.85, 0.6], [174.78, -41.29, 0.4],
];

function drawPoly(g, pts, U, V) {
  g.beginPath();
  pts.forEach(([lon, lat], i) => { const x = U(lon), y = V(lat); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath(); g.fill();
}
function blob(g, U, V, lon, lat, rx, ry, rot) {
  g.save(); g.translate(U(lon), V(lat)); g.rotate(rot || 0);
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); g.restore();
}

/* Land mask canvas (white = land). */
export function makeLandMask(w, create) {
  const h = w / 2;
  const c = (create || defaultCreate)(w, h);
  const g = c.getContext('2d');
  const U = (lon) => (lon + 180) / 360 * w;
  const V = (lat) => (90 - lat) / 180 * h;
  const kx = w / 360, ky = h / 180;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  drawPoly(g, SOUTH_AMERICA, U, V);
  drawPoly(g, AFRICA, U, V);
  drawPoly(g, AUSTRALIA, U, V);
  drawPoly(g, INDIA, U, V);
  drawPoly(g, ARABIA, U, V);
  drawPoly(g, INDOCHINA, U, V);
  drawPoly(g, VIETNAM, U, V);
  /* Central America bridge */
  drawPoly(g, [[-77.9, 7.2], [-79.4, 9.4], [-82.2, 8.3], [-83.6, 9.6], [-84.9, 10.9], [-86.8, 12.2], [-87.9, 13.2], [-90.8, 13.9], [-92.3, 14.8], [-93.9, 16.1], [-95.9, 16.3], [-94.5, 18.2], [-91.4, 18.9], [-90.4, 21.0], [-87.6, 21.5], [-88.3, 18.5], [-88.2, 15.7], [-85.5, 15.9], [-83.4, 15.0], [-83.2, 12.2], [-83.7, 11.0], [-82.5, 9.4], [-79.9, 9.5]], U, V);
  /* North America mainland (shape union, seas subtracted after) */
  drawPoly(g, [[-124.4, 48.4], [-124.2, 43.4], [-124.4, 40.4], [-122.4, 37.8], [-120.6, 34.6], [-117.2, 32.7], [-114.8, 32.5], [-111.0, 31.4], [-108.2, 31.8], [-106.4, 31.8], [-104.9, 30.6], [-103.1, 29.0], [-101.4, 29.8], [-99.5, 27.5], [-97.1, 25.9], [-97.5, 27.9], [-96.6, 28.7], [-93.8, 29.7], [-90.1, 29.1], [-89.1, 30.4], [-85.4, 29.9], [-84.0, 30.1], [-82.7, 29.0], [-81.5, 30.8], [-80.9, 32.0], [-79.2, 33.2], [-77.9, 34.2], [-75.5, 35.2], [-75.9, 36.9], [-74.0, 40.5], [-70.9, 41.5], [-70.0, 43.7], [-66.9, 44.8], [-64.2, 45.9], [-61.0, 45.5], [-64.5, 47.0], [-64.9, 49.2], [-59.9, 50.3], [-57.1, 51.5], [-55.7, 52.6], [-58.9, 54.4], [-60.4, 55.8], [-61.7, 57.3], [-64.6, 58.5], [-67.7, 58.4], [-69.6, 59.2], [-77.7, 62.4], [-82.2, 62.6], [-86.9, 64.0], [-90.7, 65.9], [-96.3, 67.4], [-102.5, 68.4], [-108.4, 68.3], [-115.2, 69.3], [-124.4, 69.7], [-128.9, 70.1], [-135.5, 69.3], [-141.0, 69.6], [-149.5, 70.5], [-156.5, 71.3], [-161.9, 70.3], [-166.2, 68.9], [-164.5, 66.6], [-161.0, 64.3], [-165.4, 63.5], [-165.9, 61.0], [-162.4, 58.8], [-158.5, 57.7], [-153.3, 57.5], [-151.2, 59.5], [-146.3, 60.4], [-140.0, 59.7], [-136.4, 58.2], [-132.3, 55.9], [-130.4, 54.2], [-127.4, 51.5], [-125.2, 50.1]], U, V);
  /* Florida */
  drawPoly(g, [[-82.7, 29.0], [-81.9, 26.6], [-80.4, 25.2], [-80.1, 26.9], [-81.0, 29.2]], U, V);
  /* Baja */
  drawPoly(g, [[-117.2, 32.7], [-114.9, 30.2], [-112.9, 27.5], [-110.3, 24.5], [-109.6, 22.9], [-110.9, 23.6], [-112.4, 26.2], [-114.3, 28.5], [-115.9, 30.6]], U, V);
  /* Eurasia core band via blobs (robust) */
  blob(g, U, V, 95, 58, 88 * kx, 14 * ky, 0);            /* Siberia core */
  blob(g, U, V, 60, 55, 42 * kx, 12 * ky, 0);            /* Urals→Kazakh */
  blob(g, U, V, 30, 52, 26 * kx, 9 * ky, 0);             /* E Europe */
  blob(g, U, V, 135, 61, 34 * kx, 10 * ky, 0.1);         /* E Siberia */
  blob(g, U, V, 160, 63, 18 * kx, 7 * ky, 0.35);         /* Chukotka */
  blob(g, U, V, 104, 34, 30 * kx, 12 * ky, 0);           /* China interior */
  blob(g, U, V, 116, 30, 16 * kx, 11 * ky, 0);           /* E China */
  blob(g, U, V, 121, 44, 12 * kx, 8 * ky, 0.3);          /* NE China */
  blob(g, U, V, 88, 46, 22 * kx, 8 * ky, 0);             /* Mongolia/Xinjiang */
  blob(g, U, V, 78, 40, 16 * kx, 7 * ky, 0);             /* C Asia */
  blob(g, U, V, 54, 34, 14 * kx, 8 * ky, 0.2);           /* Iran */
  blob(g, U, V, 35, 39, 10 * kx, 4.5 * ky, 0);           /* Anatolia */
  blob(g, U, V, 44, 42, 6 * kx, 3.5 * ky, 0);            /* Caucasus */
  /* Europe west */
  drawPoly(g, [[-9.3, 43.3], [-8.9, 41.8], [-9.5, 38.7], [-8.9, 37.0], [-7.4, 37.1], [-6.3, 36.5], [-5.4, 36.1], [-4.4, 36.7], [-2.1, 36.7], [-0.3, 38.9], [0.2, 40.6], [3.2, 41.9], [3.0, 42.5], [6.2, 43.1], [7.6, 43.7], [9.5, 44.3], [10.2, 42.9], [12.6, 41.4], [15.6, 40.0], [16.5, 38.9], [15.7, 38.0], [16.1, 37.9], [17.1, 39.0], [18.4, 40.3], [15.9, 41.9], [13.6, 43.6], [13.8, 45.6], [12.3, 45.4], [8.9, 44.4], [7.5, 43.8], [4.8, 43.3], [3.1, 43.0], [-1.5, 43.6], [-1.2, 46.0], [-2.5, 47.3], [-4.6, 48.3], [-1.6, 49.6], [1.6, 50.9], [4.0, 51.4], [6.6, 53.4], [8.6, 54.0], [8.1, 56.5], [10.4, 57.6], [12.5, 56.2], [12.9, 55.4], [14.2, 55.4], [16.9, 54.6], [19.6, 54.5], [21.1, 55.7], [21.0, 56.9], [24.4, 57.9], [24.3, 59.4], [27.8, 59.4], [28.5, 60.9], [31.5, 62.5], [30.0, 64.0], [25.4, 65.0], [24.5, 65.7], [21.5, 65.3], [21.5, 63.6], [19.0, 62.5], [18.4, 60.4], [16.5, 58.6], [16.4, 56.7], [14.7, 56.2], [12.9, 55.8], [11.9, 57.4], [11.4, 59.0], [9.6, 59.1], [7.0, 58.0], [5.5, 58.8], [5.0, 60.4], [4.9, 61.9], [7.0, 63.0], [10.5, 64.5], [12.6, 65.9], [14.5, 67.3], [17.0, 68.5], [20.0, 69.6], [25.5, 70.7], [29.0, 70.5], [30.9, 69.6], [33.1, 68.9], [37.3, 67.9], [40.4, 66.3], [37.0, 64.6], [40.5, 64.6], [44.2, 66.0], [46.7, 66.7], [50.8, 68.4], [54.0, 68.2], [58.0, 68.9], [63.0, 69.2], [66.0, 68.9], [66.0, 66.0], [61.0, 60.0], [50.0, 55.0], [40.0, 50.0], [36.0, 45.0], [33.6, 44.5], [36.5, 45.5], [38.2, 47.1], [37.5, 46.7], [34.7, 46.1], [33.6, 46.2], [31.5, 46.6], [30.7, 46.5], [29.6, 45.2], [28.8, 44.9], [28.0, 43.4], [27.5, 42.5], [26.0, 40.7], [23.7, 40.5], [22.6, 40.0], [23.3, 39.0], [22.9, 37.4], [21.8, 36.8], [21.1, 38.3], [20.0, 39.7], [19.4, 41.9], [17.5, 43.0], [15.0, 44.3], [13.6, 45.1]], U, V);
  /* islands & extras */
  blob(g, U, V, -2.5, 53.8, 3.4 * kx, 4.6 * ky, 0.12);   /* Great Britain */
  blob(g, U, V, -8.0, 53.3, 1.9 * kx, 2.1 * ky, 0);      /* Ireland */
  blob(g, U, V, -18.8, 64.9, 3.2 * kx, 1.6 * ky, 0);     /* Iceland */
  blob(g, U, V, 9.0, 40.1, 1.1 * kx, 2.1 * ky, 0);       /* Sardinia */
  blob(g, U, V, 14.2, 37.5, 1.6 * kx, 1.0 * ky, 0);      /* Sicily */
  blob(g, U, V, 25.0, 35.2, 1.6 * kx, 0.55 * ky, 0);     /* Crete */
  blob(g, U, V, 78.5, 7.7, 0.9 * kx, 1.5 * ky, 0.2); /* Sri Lanka */
  blob(g, U, V, 47.1, -19.5, 2.3 * kx, 6.3 * ky, 0.12);  /* Madagascar */
  blob(g, U, V, 101.5, 0.2, 3.0 * kx, 6.5 * ky, 0.7);    /* Sumatra */
  blob(g, U, V, 110.0, -7.3, 6.4 * kx, 1.3 * ky, 0.06);  /* Java */
  blob(g, U, V, 114.0, 0.5, 5.2 * kx, 4.4 * ky, 0.15);   /* Borneo */
  blob(g, U, V, 121.2, -1.8, 2.2 * kx, 3.4 * ky, -0.4);  /* Sulawesi */
  blob(g, U, V, 141.5, -5.5, 8.4 * kx, 3.4 * ky, 0.12);  /* New Guinea */
  blob(g, U, V, 122.0, 13.0, 1.8 * kx, 3.6 * ky, 0.15);  /* Philippines N */
  blob(g, U, V, 125.2, 8.0, 1.9 * kx, 2.4 * ky, 0.2);    /* Mindanao */
  blob(g, U, V, 121.0, 23.7, 0.9 * kx, 1.7 * ky, 0.1);   /* Taiwan */
  blob(g, U, V, 140.2, 37.5, 1.5 * kx, 4.6 * ky, 0.42);  /* Honshu */
  blob(g, U, V, 142.8, 43.3, 1.9 * kx, 1.9 * ky, 0);     /* Hokkaido */
  blob(g, U, V, 131.5, 33.0, 1.5 * kx, 1.1 * ky, 0.3);   /* Kyushu/Shikoku */
  blob(g, U, V, 127.8, 36.4, 1.7 * kx, 3.0 * ky, 0.12);  /* Korea */
  blob(g, U, V, 143.0, 50.5, 1.2 * kx, 4.2 * ky, 0.1);   /* Sakhalin */
  blob(g, U, V, 158.5, 55.5, 2.2 * kx, 5.4 * ky, -0.15); /* Kamchatka */
  blob(g, U, V, -41.5, 74.5, 9.5 * kx, 9.5 * ky, 0.2);   /* Greenland N */
  blob(g, U, V, -45.5, 64.5, 5.5 * kx, 5.5 * ky, 0.3);   /* Greenland S */
  blob(g, U, V, 172.8, -41.5, 1.4 * kx, 3.2 * ky, 0.35); /* NZ S */
  blob(g, U, V, 175.6, -38.3, 1.2 * kx, 2.6 * ky, 0.3);  /* NZ N */
  blob(g, U, V, 147.0, -42.0, 1.3 * kx, 1.4 * ky, 0);    /* Tasmania */
  blob(g, U, V, -78.0, 21.8, 4.6 * kx, 0.9 * ky, 0.12);  /* Cuba */
  blob(g, U, V, -71.3, 18.9, 2.4 * kx, 1.0 * ky, 0.05);  /* Hispaniola */
  blob(g, U, V, 105.0, 76.0, 24 * kx, 3.4 * ky, 0);      /* Arctic Siberia coast */
  blob(g, U, V, 25.0, 78.5, 5.5 * kx, 2.4 * ky, 0);      /* Svalbard */
  blob(g, U, V, -95.0, 74.0, 14 * kx, 3.6 * ky, 0);      /* Canadian Arctic */
  /* Antarctica */
  g.fillRect(0, V(-64), w, h - V(-64));
  blob(g, U, V, -60, -66, 10 * kx, 4 * ky, 0.5);         /* Peninsula */
  /* --- subtract inland seas / bays --- */
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  blob(g, U, V, -84.5, 59.5, 8.2 * kx, 7.0 * ky, 0);     /* Hudson Bay */
  blob(g, U, V, -86.5, 44.5, 2.0 * kx, 3.6 * ky, 0.1);   /* L. Michigan */
  blob(g, U, V, -82.5, 45.0, 3.6 * kx, 2.1 * ky, 0.4);   /* Huron/Superior-ish */
  blob(g, U, V, -87.5, 47.6, 4.6 * kx, 1.4 * ky, 0.15);
  blob(g, U, V, 15.0, 36.6, 14 * kx, 3.4 * ky, 0.1); /* Mediterranean W-E */
  blob(g, U, V, 27.5, 34.4, 8.5 * kx, 2.6 * ky, 0.05);
  blob(g, U, V, 34.5, 43.4, 5.6 * kx, 2.6 * ky, 0);      /* Black Sea */
  blob(g, U, V, 50.6, 41.5, 2.6 * kx, 5.4 * ky, 0.1);    /* Caspian */
  blob(g, U, V, 60.0, 45.0, 2.5 * kx, 1.4 * ky, 0);      /* Aral remnant */
  blob(g, U, V, 19.5, 58.5, 3.4 * kx, 4.4 * ky, 0.5);    /* Baltic */
  blob(g, U, V, 38.0, 20.0, 1.9 * kx, 6.5 * ky, -0.35);  /* Red Sea */
  blob(g, U, V, 51.0, 27.3, 3.4 * kx, 1.3 * ky, 0.45);   /* Persian Gulf */
  blob(g, U, V, 89.0, 16.5, 5.5 * kx, 4.5 * ky, 0);      /* Bay of Bengal */
  blob(g, U, V, 63.0, 20.0, 6.5 * kx, 4.0 * ky, 0);      /* Arabian Sea bite */
  blob(g, U, V, 113.0, 15.0, 6.5 * kx, 5.0 * ky, 0);     /* South China Sea */
  blob(g, U, V, 122.5, 38.6, 2.4 * kx, 1.8 * ky, 0); /* Bohai */
  blob(g, U, V, -113.0, 28.5, 1.4 * kx, 4.6 * ky, -0.5); /* Gulf of California */
  g.globalCompositeOperation = 'source-over';
  return c;
}

/* Desert mask for biome colouring. */
function desertFactor(lon, lat) {
  const d = (clon, clat, rl, rt) => Math.exp(-(Math.pow((lon - clon) / rl, 2) + Math.pow((lat - clat) / rt, 2)));
  return clamp(
    d(10, 22, 26, 8) +            /* Sahara */
    d(45, 23, 12, 8) +            /* Arabia */
    d(60, 42, 16, 8) * 0.8 +      /* C-Asia */
    d(103, 41, 14, 6) * 0.8 +     /* Gobi */
    d(133, -25, 20, 9) * 0.9 +    /* Australia */
    d(-110, 33, 8, 6) * 0.7 +     /* SW USA / N Mexico */
    d(-69.5, -24, 4, 8) * 0.8 +   /* Atacama */
    d(21, -24, 8, 6) * 0.7 +      /* Kalahari/Namib */
    d(-42, 72, 14, 10) * 0 +      0, 0, 1);
}
function snowFactor(lon, lat) {
  let s = clamp((Math.abs(lat) - 58) / 12, 0, 1);
  s = Math.max(s, Math.exp(-(Math.pow((lon + 42) / 14, 2) + Math.pow((lat - 72) / 9, 2))));        /* Greenland */
  if (lat < -62) s = 1;                                                                            /* Antarctica */
  s = Math.max(s, 0.7 * Math.exp(-(Math.pow((lon - 86) / 10, 2) + Math.pow((lat - 32) / 3.2, 2))));/* Himalaya */
  return clamp(s, 0, 1);
}

const en2 = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
function efbm(x, y) {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < 4; o++) {
    const xi = Math.floor(x * f), yi = Math.floor(y * f);
    const xf = x * f - xi, yf = y * f - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const q = lerp(lerp(en2(xi, yi), en2(xi + 1, yi), u), lerp(en2(xi, yi + 1), en2(xi + 1, yi + 1), u), v);
    s += a * q; a *= 0.5; f *= 2.1;
  }
  return s;
}
/* one row of the day-albedo + ocean-mask images */
function fillDaySpecRow(y, w, h, landAt, dd, sd) {
  const lat = 90 - (y + 0.5) / h * 180;
  for (let x = 0; x < w; x++) {
    const lon = (x + 0.5) / w * 360 - 180;
    const i = (y * w + x) * 4;
    const land = landAt(x, y);
    const rel = efbm(x / w * 34, y / h * 17);
    let r, gg, b, sp = 0;
    if (land) {
      const des = desertFactor(lon, lat);
      const snow = snowFactor(lon, lat);
      const trop = Math.exp(-Math.pow(lat / 26, 2));
      let R = lerp(0.16, 0.46, des), G = lerp(0.33, 0.38, des), B = lerp(0.12, 0.22, des);
      R = lerp(R, 0.10, trop * (1 - des) * 0.5); G = lerp(G, 0.30, trop * (1 - des) * 0.4);
      const bor = clamp((Math.abs(lat) - 46) / 14, 0, 1) * (1 - snow);
      R = lerp(R, 0.10, bor * 0.5); G = lerp(G, 0.22, bor * 0.4); B = lerp(B, 0.10, bor * 0.4);
      const rv = 0.85 + rel * 0.3;
      R *= rv; G *= rv; B *= rv;
      R = lerp(R, 0.93, snow); G = lerp(G, 0.95, snow); B = lerp(B, 0.97, snow);
      r = R; gg = G; b = B; sp = 0.06 + snow * 0.2;
    } else {
      const near = landAt(x + 3, y) || landAt(x - 3, y) || landAt(x, y + 3) || landAt(x, y - 3);
      const shal = near ? 0.55 : 0;
      const cold = clamp((Math.abs(lat) - 45) / 35, 0, 1);
      r = lerp(0.012, 0.05, shal) + rel * 0.008;
      gg = lerp(0.085, 0.24, shal) * lerp(1, 0.75, cold) + rel * 0.012;
      b = lerp(0.19, 0.34, shal) * lerp(1, 0.85, cold) + rel * 0.02;
      sp = 1;
      const ice = Math.abs(lat) > 71 ? clamp((Math.abs(lat) - 71) / 6, 0, 1) : 0;
      r = lerp(r, 0.92, ice); gg = lerp(gg, 0.95, ice); b = lerp(b, 0.97, ice); sp = lerp(sp, 0.25, ice);
    }
    dd[i] = r * 255; dd[i + 1] = gg * 255; dd[i + 2] = b * 255; dd[i + 3] = 255;
    sd[i] = sd[i + 1] = sd[i + 2] = sp * 255; sd[i + 3] = 255;
  }
}
/* one row of the cloud-alpha image */
function fillCloudRow(y, w, h, cd) {
  const lat = 90 - (y + 0.5) / h * 180;
  const band =
    0.55 * Math.exp(-Math.pow((lat - 5) / 9, 2)) +
    0.42 * Math.exp(-Math.pow((Math.abs(lat) - 48) / 14, 2)) +
    0.10;
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const swirl = efbm(x / w * 9 + Math.sin(y / h * 6.28) * 0.7, y / h * 4.5);
    const det = efbm(x / w * 26, y / h * 13 + 7.7);
    let a = clamp((swirl * 0.75 + det * 0.45) * band * 2.1 - 0.42, 0, 1);
    a = Math.pow(a, 1.35);
    cd[i] = cd[i + 1] = cd[i + 2] = 255;
    cd[i + 3] = a * 255;
  }
}
/* real-city night lights, clamped to land */
function paintNightLights(w, h, mask, create) {
  const night = (create || defaultCreate)(w, h);
  const ng = night.getContext('2d');
  ng.fillStyle = '#000'; ng.fillRect(0, 0, w, h);
  const U = (lon) => (lon + 180) / 360 * w;
  const V = (lat) => (90 - lat) / 180 * h;
  const dot = (lon, lat, wgt) => {
    const x = U(lon), y = V(lat);
    const r = (2.2 + wgt * 4.2) * (w / 2048);
    const grd = ng.createRadialGradient(x, y, 0, x, y, r * 3);
    grd.addColorStop(0, 'rgba(255,214,150,' + Math.min(1, 0.75 + wgt * 0.2) + ')');
    grd.addColorStop(0.35, 'rgba(255,190,120,' + (0.30 * wgt).toFixed(2) + ')');
    grd.addColorStop(1, 'rgba(255,170,90,0)');
    ng.fillStyle = grd;
    ng.beginPath(); ng.arc(x, y, r * 3, 0, TAU); ng.fill();
  };
  CITIES.forEach(([lon, lat, wgt]) => dot(lon, lat, wgt));
  const stroke = (pts, width, alpha) => {
    ng.strokeStyle = 'rgba(255,200,130,' + alpha + ')';
    ng.lineWidth = width * (w / 2048); ng.lineCap = 'round';
    ng.beginPath();
    pts.forEach(([lo, la], k) => { const x = U(lo), y = V(la); k ? ng.lineTo(x, y) : ng.moveTo(x, y); });
    ng.stroke();
  };
  stroke([[-77.2, 38.8], [-75.2, 39.9], [-74.0, 40.7], [-71.1, 42.4]], 7, 0.5);
  stroke([[0.1, 51.5], [3.5, 51.0], [4.9, 52.4], [6.9, 51.4], [8.7, 50.1], [11.6, 48.1]], 6, 0.4);
  stroke([[77.2, 28.6], [80.9, 26.8], [83.0, 25.3], [85.1, 25.6], [88.4, 22.6]], 7, 0.5);
  stroke([[113.3, 23.1], [114.1, 22.6]], 8, 0.6);
  stroke([[118.8, 32.1], [120.2, 31.5], [121.5, 31.2]], 8, 0.55);
  stroke([[31.2, 30.0], [31.3, 27.2], [32.6, 25.7], [32.9, 24.1]], 4, 0.5);
  stroke([[106.8, -6.2], [108.2, -6.9], [110.4, -7.0], [112.7, -7.3]], 5, 0.45);
  stroke([[-46.6, -23.6], [-45.9, -23.3], [-44.1, -22.9], [-43.2, -22.9]], 6, 0.5);
  stroke([[139.7, 35.7], [137.0, 35.1], [135.5, 34.7]], 8, 0.6);
  stroke([[-75.6, 6.24], [-75.5, 6.1]], 5, 0.6);
  ng.globalCompositeOperation = 'destination-in';
  ng.drawImage(mask, 0, 0);
  ng.globalCompositeOperation = 'source-over';
  return night;
}

/* Full Earth texture set from the land mask. Returns canvases.
   Synchronous — use ≤1024 on the main thread, any size inside a Worker. */
export function makeEarthMaps(size, create) {
  const cf = create || defaultCreate;
  const w = size, h = size / 2;
  const mask = makeLandMask(w, cf);
  const mg = mask.getContext('2d');
  const md = mg.getImageData(0, 0, w, h).data;
  const landAt = (x, y) => md[((clamp(y | 0, 0, h - 1)) * w + (clamp(x | 0, 0, w - 1))) * 4] > 127;

  const day = cf(w, h);
  const spec = cf(w, h);
  const dg = day.getContext('2d');
  const sg = spec.getContext('2d');
  const di = dg.createImageData(w, h);
  const si = sg.createImageData(w, h);
  for (let y = 0; y < h; y++) fillDaySpecRow(y, w, h, landAt, di.data, si.data);
  dg.putImageData(di, 0, 0);
  sg.putImageData(si, 0, 0);

  const night = paintNightLights(w, h, mask, cf);

  const clouds = cf(w, h);
  const cg = clouds.getContext('2d');
  const ci = cg.createImageData(w, h);
  for (let y = 0; y < h; y++) fillCloudRow(y, w, h, ci.data);
  cg.putImageData(ci, 0, 0);

  return { day, night, clouds, spec, mask };
}

/* Time-sliced variant: same output, but the two heavy per-pixel passes run in
   ≤~8 ms chunks via setTimeout so a cinematic never freezes (P0 fix). */
export function makeEarthMapsSliced(size, create, onDone) {
  const cf = create || defaultCreate;
  const w = size, h = size / 2;
  const mask = makeLandMask(w, cf);
  const md = mask.getContext('2d').getImageData(0, 0, w, h).data;
  const landAt = (x, y) => md[((clamp(y | 0, 0, h - 1)) * w + (clamp(x | 0, 0, w - 1))) * 4] > 127;
  const day = cf(w, h), spec = cf(w, h), clouds = cf(w, h);
  const dg = day.getContext('2d'), sg = spec.getContext('2d'), cg = clouds.getContext('2d');
  const di = dg.createImageData(w, h), si = sg.createImageData(w, h), ci = cg.createImageData(w, h);
  let y = 0, phase = 0;
  function step() {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    while (nowMs() - t0 < 8) {
      if (phase === 0) {
        if (y < h) { fillDaySpecRow(y, w, h, landAt, di.data, si.data); y++; }
        else { dg.putImageData(di, 0, 0); sg.putImageData(si, 0, 0); phase = 1; y = 0; }
      } else if (phase === 1) {
        if (y < h) { fillCloudRow(y, w, h, ci.data); y++; }
        else {
          cg.putImageData(ci, 0, 0);
          const night = paintNightLights(w, h, mask, cf);
          onDone({ day, night, clouds, spec, mask });
          return;
        }
      }
    }
    setTimeout(step, 0);
  }
  setTimeout(step, 0);
}


/* TRUE EARTH asset upgrade (V3.4): real NASA-derived imagery served from the
   site's own hosting (never hotlinked). Files:
     assets/earth/day.jpg   4096×2048 · day_2k.jpg 2048×1024   (Blue Marble)
     assets/earth/night.jpg 4096×2048 · night_2k.jpg           (Black Marble)
     assets/earth/clouds.png 2048×1024 luminance = cloud density (Visible Earth)
     assets/moon.jpg        1024×512                            (lunar surface)
   opts: { res: '4k'|'2k', v: buildId, aniso }. Per-key callback so the sphere
   upgrades the moment each map decodes. Missing files silently fall back to
   the procedural pipeline — never a black Earth. */
export function loadOptionalTextures(T, done, opts) {
  const o = opts || {};
  const two = o.res === '2k';
  const q = o.v ? '?v=' + o.v : '';
  const out = {};
  const tl = new T.TextureLoader();
  let pending = 0;
  const finish = () => { if (--pending === 0) done(out); };
  const tryLoad = (key, urls, srgb) => {
    pending++;
    const attempt = (i) => {
      if (i >= urls.length) { finish(); return; }
      tl.load(urls[i] + q, (tex) => {
        if (srgb) tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = o.aniso || 4;
        out[key] = tex;
        if (o.onEach) { try { o.onEach(key, tex); } catch (e) {} }
        finish();
      }, undefined, () => attempt(i + 1));
    };
    attempt(0);
  };
  tryLoad('day', two ? ['assets/earth/day_2k.jpg'] : ['assets/earth/day.jpg', 'assets/earth/day_2k.jpg'], true);
  tryLoad('night', two ? ['assets/earth/night_2k.jpg'] : ['assets/earth/night.jpg', 'assets/earth/night_2k.jpg'], true);
  tryLoad('clouds', two ? ['assets/earth/clouds_1k.png'] : ['assets/earth/clouds.png'], false);
  tryLoad('moon', ['assets/moon.jpg'], true);
  if (pending === 0) done(out);
}

/* Ocean/specular mask derived from the REAL day texture (blue-dominant pixels
   = water), so sun glint lands on oceans that match the imagery instead of the
   procedural coastline. Returns a canvas (r = specular strength). */
export function deriveOceanMask(img, size) {
  const w = size || 1024, h = w / 2;
  const c = defaultCreate(w, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    const lum = (r + gg + b) / 3;
    /* water: blue-dominant and not ice-bright */
    const water = (b > r * 1.12 && b > gg * 0.92 && lum < 150) ? 1 : 0;
    const ice = lum > 210 ? 0.22 : 0;
    const v = Math.round((water ? 235 : 18 + ice * 255));
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}
