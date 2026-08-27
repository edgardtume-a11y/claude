/* UNIVERSO SEBAS GRANDA — configuration (single source of truth) */

export const SG_VERSION = '1.4.0';
export const SG_BUILD_ID = '20260827-V34-01';   /* changes on EVERY delivery */
export const SAVE_KEY = 'sg-mission-save';
export const WEATHER_CACHE_KEY = 'sg-weather-cache';
export const SAVE_VERSION = 1;

/* Canonical narrative location: SG AEROSPACE LAUNCH FACILITY — Medellín, Colombia */
export const MEDELLIN = {
  lat: 6.2442,
  lon: -75.5812,
  tz: 'America/Bogota',
  name: 'MEDELLÍN',
};

/* Optional flags (no secrets, nothing required). Real-terrain provider is prepared
   but OFF by default; the SG procedural valley is the primary provider. */
export const FLAGS = {
  ENABLE_REAL_TERRAIN: false,     // set true + provide a Cesium ion token at runtime to extend
  CESIUM_ION_TOKEN: '',           // never ship a real token in this file
};

/* Immutable navigation map — the three galaxies and their REAL destinations. */
export const SG_DESTINATIONS = {
  intro: {
    id: 'galaxy-01',
    url: 'https://sebasgrandamanager.starmarkagencia.com/inicio',
  },
  sebas: {
    id: 'galaxy-02',
    url: 'https://sebasgrandamanager.starmarkagencia.com/sebas',
  },
  agency: {
    id: 'galaxy-03',
    url: 'https://starmarkagencia.com',
  },
};

export const GALAXIES = [
  {
    key: 'intro',
    id: SG_DESTINATIONS.intro.id,
    url: SG_DESTINATIONS.intro.url,
    nameES: 'CONÓCEME EN 60 SEGUNDOS',
    nameEN: 'MEET ME IN 60 SECONDS',
    subES: 'RECORRIDO RÁPIDO',
    subEN: 'QUICK PROFILE',
    ctaES: 'INICIAR RECORRIDO',
    ctaEN: 'START JOURNEY',
    nav: ['DESTINATION 01', 'QUICK PROFILE', 'ESTIMATED JOURNEY: 60 SEC'],
    color: 0x35d6ff,
    color2: 0x2f7dff,
    accent: '#35d6ff',
    size: 0.72,
  },
  {
    key: 'sebas',
    id: SG_DESTINATIONS.sebas.id,
    url: SG_DESTINATIONS.sebas.url,
    nameES: 'SEBAS GRANDA',
    nameEN: 'SEBAS GRANDA',
    subES: 'MI MUNDO COMPLETO',
    subEN: 'MY COMPLETE WORLD',
    ctaES: 'ENTRAR A MI MUNDO',
    ctaEN: 'ENTER MY WORLD',
    nav: ['DESTINATION 02', 'SEBAS GRANDA', 'PERSONAL UNIVERSE'],
    color: 0x9b6bff,
    color2: 0x3a49ff,
    accent: '#a97dff',
    size: 1.0,
  },
  {
    key: 'agency',
    id: SG_DESTINATIONS.agency.id,
    url: SG_DESTINATIONS.agency.url,
    nameES: 'STAR MARK AGENCY',
    nameEN: 'STAR MARK AGENCY',
    subES: 'UNIVERSO EMPRESARIAL',
    subEN: 'BUSINESS UNIVERSE',
    ctaES: 'CONOCER LA AGENCIA',
    ctaEN: 'EXPLORE THE AGENCY',
    nav: ['DESTINATION 03', 'STAR MARK AGENCY', 'BUSINESS UNIVERSE'],
    color: 0xf2d9a4,
    color2: 0xc9a24b,
    accent: '#e8cf9e',
    size: 0.82,
  },
];

/* 17 core discoveries. Fixed registry, chapter-distributed:
   facility 6 · ascent 3 · orbit 4 · hub 4. Live celestial sightings are separate. */
export const DISCOVERIES = [
  { id: 'd-pad-placard',   chapter: 'facility', type: 'history',     scanTime: 1.1, titleES: 'PLACA SG-01',              titleEN: 'SG-01 PLACARD' },
  { id: 'd-flame-trench',  chapter: 'facility', type: 'technology',  scanTime: 1.4, titleES: 'DEFLECTOR DEL FLAME TRENCH', titleEN: 'FLAME TRENCH DEFLECTOR' },
  { id: 'd-weather-mast',  chapter: 'facility', type: 'technology',  scanTime: 1.2, titleES: 'MÁSTIL METEOROLÓGICO',     titleEN: 'WEATHER MAST' },
  { id: 'd-fuel-farm',     chapter: 'facility', type: 'technology',  scanTime: 1.4, titleES: 'GRANJA CRIOGÉNICA',        titleEN: 'CRYOGENIC FUEL FARM' },
  { id: 'd-ground-crew',   chapter: 'facility', type: 'environment', scanTime: 1.0, titleES: 'EQUIPO DE TIERRA',         titleEN: 'GROUND CREW' },
  { id: 'd-service-truck', chapter: 'facility', type: 'environment', scanTime: 1.0, titleES: 'VEHÍCULO DE SERVICIO',     titleEN: 'SERVICE VEHICLE' },

  { id: 'd-cloud-deck',    chapter: 'ascent',   type: 'environment', scanTime: 0.8, titleES: 'CUBIERTA DE NUBES',        titleEN: 'CLOUD DECK' },
  { id: 'd-mach-diamonds', chapter: 'ascent',   type: 'technology',  scanTime: 0.8, titleES: 'DIAMANTES DE MACH',        titleEN: 'MACH DIAMONDS' },
  { id: 'd-stratos-star',  chapter: 'ascent',   type: 'environment', scanTime: 0.8, titleES: 'PRIMERA ESTRELLA',         titleEN: 'FIRST STAR' },

  { id: 'd-terminator',    chapter: 'orbit',    type: 'environment', scanTime: 1.2, titleES: 'LÍNEA DEL TERMINADOR',     titleEN: 'TERMINATOR LINE' },
  { id: 'd-limb',          chapter: 'orbit',    type: 'environment', scanTime: 1.2, titleES: 'LIMBO ATMOSFÉRICO',        titleEN: 'ATMOSPHERIC LIMB' },
  { id: 'd-sg-ship',       chapter: 'orbit',    type: 'technology',  scanTime: 1.3, titleES: 'NÚCLEO DE LA NAVE SG',     titleEN: 'SG SHIP CORE' },
  { id: 'd-sunrise-point', chapter: 'orbit',    type: 'environment', scanTime: 1.2, titleES: 'PUNTO DE AMANECER ORBITAL', titleEN: 'ORBITAL SUNRISE POINT' },

  { id: 'd-core-01',       chapter: 'hub',      type: 'project',     scanTime: 1.2, titleES: 'NÚCLEO — GALAXIA 01',      titleEN: 'CORE — GALAXY 01' },
  { id: 'd-core-02',       chapter: 'hub',      type: 'project',     scanTime: 1.2, titleES: 'NÚCLEO — GALAXIA 02',      titleEN: 'CORE — GALAXY 02' },
  { id: 'd-core-03',       chapter: 'hub',      type: 'project',     scanTime: 1.2, titleES: 'NÚCLEO — GALAXIA 03',      titleEN: 'CORE — GALAXY 03' },
  { id: 'd-beacon',        chapter: 'hub',      type: 'anomaly',     scanTime: 1.8, titleES: 'SG DEEP SPACE BEACON',     titleEN: 'SG DEEP SPACE BEACON' },
];

export const TOTAL_DISCOVERIES = DISCOVERIES.length; /* 17 */

/* Multilingual greetings for the intro (interface itself stays ES/EN). */
export const GREETINGS = [
  /* V3.2 §5 — 22 saludos verificados; script real donde corresponde */
  'HOLA', 'HELLO', 'BONJOUR', 'CIAO', 'OLÁ', 'HALLO',
  'こんにちは', '안녕하세요', '你好', 'مرحبا', 'ПРИВЕТ', 'ΓΕΙΑ ΣΟΥ',
  'नमस्ते', 'SAWUBONA', 'MERHABA', 'HEJ', 'SALUT', 'AHOJ',
  'JAMBO', 'SHALOM', 'SVEIKI', 'NAMASKAR',
];

/* Data classification helpers (REAL_DATA vs SG_WORLD vs PORTFOLIO_DATA). */
export const DATA_CLASS = {
  REAL: 'REAL_DATA',
  SG: 'SG_WORLD',
  PORTFOLIO: 'PORTFOLIO_DATA',
};
