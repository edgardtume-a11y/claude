/* UNIVERSO SEBAS GRANDA — local astronomy service (no network, no keys).
   Real positions for Sun, Moon and bright planets. Angles returned in DEGREES.
   Azimuth is compass-style: 0 = North, 90 = East. Accuracy ≈ arcminutes,
   more than enough for perceived realism. */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function toJulian(date) { return date.getTime() / 86400000 + 2440587.5; }
function daysJ2000(date) { return toJulian(date) - 2451545.0; }

function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

function obliquity(d) { return (23.4397 - 0.00000036 * d) * DEG; }

/* Greenwich mean sidereal time, degrees. */
export function gmstDeg(date) {
  return norm360(280.16 + 360.9856235 * daysJ2000(date));
}

function eclipticToEquatorial(lam, bet, e) {
  const sinL = Math.sin(lam), cosL = Math.cos(lam);
  const ra = Math.atan2(sinL * Math.cos(e) - Math.tan(bet) * Math.sin(e), cosL);
  const dec = Math.asin(Math.sin(bet) * Math.cos(e) + Math.cos(bet) * Math.sin(e) * sinL);
  return { ra, dec };
}

function altAz(ra, dec, date, latDeg, lonDeg) {
  const lat = latDeg * DEG;
  const H = (gmstDeg(date) + lonDeg) * DEG - ra; /* hour angle */
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  const azimuth = norm360(azS * RAD + 180); /* from South-based to compass N=0 */
  return { alt: alt * RAD, az: azimuth };
}

/* ---- SUN ---- */
function sunEcliptic(d) {
  const M = norm360(357.5291 + 0.98560028 * d) * DEG;
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * DEG;
  const P = 102.9372 * DEG;
  const lam = M + C + P + Math.PI; /* ecliptic longitude */
  return { lam, M };
}

export function sunPosition(date, lat, lon) {
  const d = daysJ2000(date);
  const e = obliquity(d);
  const s = sunEcliptic(d);
  const eq = eclipticToEquatorial(s.lam, 0, e);
  const aa = altAz(eq.ra, eq.dec, date, lat, lon);
  return { alt: aa.alt, az: aa.az, ra: eq.ra * RAD, dec: eq.dec * RAD, eclLon: norm360(s.lam * RAD) };
}

/* Sun direction in an Earth-fixed frame (Y = north pole, X toward Greenwich meridian).
   Used to light the orbital Earth with the real terminator. */
export function sunDirEarthFixed(date) {
  const d = daysJ2000(date);
  const e = obliquity(d);
  const s = sunEcliptic(d);
  const eq = eclipticToEquatorial(s.lam, 0, e);
  const A = eq.ra - gmstDeg(date) * DEG; /* east longitude of subsolar point */
  const cd = Math.cos(eq.dec);
  return [cd * Math.cos(A), Math.sin(eq.dec), -cd * Math.sin(A)];
}

/* ---- MOON ----
   Truncated Meeus (Astronomical Algorithms ch. 47): principal periodic terms.
   Accuracy ≈ a few arcminutes in longitude/latitude — visually exact. */
export function moonPosition(date, lat, lon) {
  const d = daysJ2000(date);
  const T = d / 36525;
  const e = obliquity(d);
  const Lp = norm360(218.3164477 + 481267.88123421 * T) * DEG; /* mean longitude */
  const D  = norm360(297.8501921 + 445267.1114034  * T) * DEG; /* mean elongation */
  const Ms = norm360(357.5291092 + 35999.0502909   * T) * DEG; /* sun mean anomaly */
  const Mp = norm360(134.9633964 + 477198.8675055  * T) * DEG; /* moon mean anomaly */
  const F  = norm360(93.2720950  + 483202.0175233  * T) * DEG; /* argument of latitude */

  const S = Math.sin, C = Math.cos;
  /* longitude terms (deg) */
  let dL =
      6.288774 * S(Mp)
    + 1.274027 * S(2 * D - Mp)
    + 0.658314 * S(2 * D)
    + 0.213618 * S(2 * Mp)
    - 0.185116 * S(Ms)
    - 0.114332 * S(2 * F)
    + 0.058793 * S(2 * D - 2 * Mp)
    + 0.057066 * S(2 * D - Ms - Mp)
    + 0.053322 * S(2 * D + Mp)
    + 0.045758 * S(2 * D - Ms)
    - 0.040923 * S(Ms - Mp)
    - 0.034720 * S(D)
    - 0.030383 * S(Ms + Mp)
    + 0.015327 * S(2 * D - 2 * F)
    - 0.012528 * S(2 * F + Mp)
    - 0.010980 * S(2 * F - Mp)
    + 0.010675 * S(4 * D - Mp)
    + 0.010034 * S(3 * Mp)
    + 0.008548 * S(4 * D - 2 * Mp)
    - 0.007888 * S(2 * D + Ms - Mp)
    - 0.006766 * S(2 * D + Ms)
    - 0.005163 * S(D - Mp);
  /* latitude terms (deg) */
  let dB =
      5.128122 * S(F)
    + 0.280602 * S(Mp + F)
    + 0.277693 * S(Mp - F)
    + 0.173237 * S(2 * D - F)
    + 0.055413 * S(2 * D + F - Mp)
    + 0.046271 * S(2 * D - F - Mp)
    + 0.032573 * S(2 * D + F)
    + 0.017198 * S(2 * Mp + F)
    + 0.009266 * S(2 * D + Mp - F)
    + 0.008822 * S(2 * Mp - F);
  /* distance terms (km) */
  let dR =
    - 20905.355 * C(Mp)
    -  3699.111 * C(2 * D - Mp)
    -  2955.968 * C(2 * D)
    -   569.925 * C(2 * Mp)
    +    48.888 * C(Ms)
    -     3.149 * C(2 * F)
    +   246.158 * C(2 * D - 2 * Mp)
    -   152.138 * C(2 * D - Ms - Mp)
    -   170.733 * C(2 * D + Mp)
    -   204.586 * C(2 * D - Ms)
    -   129.620 * C(Ms - Mp)
    +   108.743 * C(D)
    +   104.755 * C(Ms + Mp)
    +    79.661 * C(2 * F - Mp);

  const lam = Lp + dL * DEG;
  const bet = dB * DEG;
  const dist = 385000.56 + dR; /* km */
  const eq = eclipticToEquatorial(lam, bet, e);
  const aa = altAz(eq.ra, eq.dec, date, lat, lon);
  const sun = sunEcliptic(d);
  const diff = lam - sun.lam;
  const illum = (1 - Math.cos(diff)) / 2;            /* 0 new .. 1 full */
  const phase = norm360(diff * RAD) / 360;           /* 0 new, 0.5 full, waxing < 0.5 */
  const angDiam = 2 * Math.asin(1737.4 / dist) * RAD; /* degrees */
  return { alt: aa.alt, az: aa.az, phase, illum, dist, angDiam, ra: eq.ra * RAD, dec: eq.dec * RAD };
}

/* ---- PLANETS (Venus, Mars, Jupiter, Saturn) ---- */
/* J2000 mean elements + centennial rates (Standish, JPL approx). */
const ELEMENTS = {
  earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], i: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] },
  venus:   { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], i: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], w: [131.60246718, 0.00268329], O: [76.67984255, -0.27769418] },
  mars:    { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882],  i: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499],  w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] },
  jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], i: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775],  w: [14.72847983, 0.21252668],  O: [100.47390909, 0.20469106] },
  saturn:  { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], i: [2.48599187, 0.00193609],  L: [49.95424423, 1222.49362201],  w: [92.59887831, -0.41897216], O: [113.66242448, -0.28867794] },
};
const PLANET_MAG = { venus: -4.2, mars: 0.7, jupiter: -2.3, saturn: 0.7 };
const PLANET_NAMES = { venus: 'VENUS', mars: 'MARS', jupiter: 'JUPITER', saturn: 'SATURN' };

function helio(name, T) {
  const el = ELEMENTS[name];
  const a = el.a[0] + el.a[1] * T;
  const ec = el.e[0] + el.e[1] * T;
  const inc = (el.i[0] + el.i[1] * T) * DEG;
  const Lm = norm360(el.L[0] + el.L[1] * T) * DEG;
  const wb = (el.w[0] + el.w[1] * T) * DEG;   /* longitude of perihelion */
  const Om = (el.O[0] + el.O[1] * T) * DEG;
  const w = wb - Om;
  let M = Lm - wb;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  let E = M + ec * Math.sin(M);
  for (let k = 0; k < 6; k++) {
    E = E - (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E));
  }
  const xv = a * (Math.cos(E) - ec);
  const yv = a * Math.sqrt(1 - ec * ec) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const x = (cw * cO - sw * sO * ci) * xv + (-sw * cO - cw * sO * ci) * yv;
  const y = (cw * sO + sw * cO * ci) * xv + (-sw * sO + cw * cO * ci) * yv;
  const z = (sw * si) * xv + (cw * si) * yv;
  return [x, y, z];
}

export function planetPositions(date, lat, lon) {
  const d = daysJ2000(date);
  const T = d / 36525;
  const e = obliquity(d);
  const E = helio('earth', T);
  const out = [];
  for (const name of ['venus', 'mars', 'jupiter', 'saturn']) {
    const P = helio(name, T);
    const gx = P[0] - E[0], gy = P[1] - E[1], gz = P[2] - E[2];
    const lam = Math.atan2(gy, gx);
    const bet = Math.atan2(gz, Math.sqrt(gx * gx + gy * gy));
    const eq = eclipticToEquatorial(lam, bet, e);
    const aa = altAz(eq.ra, eq.dec, date, lat, lon);
    out.push({ id: name, name: PLANET_NAMES[name], alt: aa.alt, az: aa.az, mag: PLANET_MAG[name] });
  }
  return out;
}

/* Convert compass az/alt (degrees) to a world direction.
   World frame: +X east, +Y up, -Z north. */
export function azAltToDir(azDeg, altDeg) {
  const az = azDeg * DEG, al = altDeg * DEG;
  const c = Math.cos(al);
  return [Math.sin(az) * c, Math.sin(al), -Math.cos(az) * c];
}
/* Local sidereal time, degrees. */
export function lstDeg(date, lonDeg) { return norm360(gmstDeg(date) + lonDeg); }

/* Equatorial (RA/Dec, degrees) -> horizontal alt/az (degrees) for an observer. */
export function raDecToAltAz(raDeg, decDeg, date, lat, lon) {
  return altAz(raDeg * DEG, decDeg * DEG, date, lat, lon);
}

/* 3x3 rotation (column-major, ready for THREE.Matrix3.fromArray) mapping unit
   equatorial vectors (x->RA0/Dec0, z->celestial north) into the SG world frame
   (+X east, +Y up, -Z north) at the given instant/observer. Lets whole star
   fields rotate rigidly with the real sky. */
export function equatorialToWorldMatrix(date, lat, lon) {
  const basis = (ra, dec) => {
    const aa = altAz(ra, dec, date, lat, lon);
    return azAltToDir(aa.az, aa.alt);
  };
  const X = basis(0, 0);
  const Y = basis(90 * DEG, 0);
  const Z = basis(0, 90 * DEG);
  return [X[0], X[1], X[2], Y[0], Y[1], Y[2], Z[0], Z[1], Z[2]];
}

/* Unit equatorial vector for RA/Dec in degrees. */
export function raDecToVec(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}
