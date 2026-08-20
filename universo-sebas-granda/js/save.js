/* UNIVERSO SEBAS GRANDA — mission persistence (local, versioned, no accounts). */

import { SAVE_KEY, SAVE_VERSION } from './config.js';

let memory = null; /* fallback when storage is unavailable */

function storageGet() {
  try { return window.localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
}
function storageSet(v) {
  try { window.localStorage.setItem(SAVE_KEY, v); return true; } catch (e) { return false; }
}
function storageDel() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export function defaultSave() {
  const now = new Date().toISOString();
  return {
    version: SAVE_VERSION,
    visits: 0,
    firstVisitAt: now,
    lastVisitAt: now,
    lastWeather: null,
    lastDestination: null,          /* { destination, timestamp, missionNumber } */
    missionsCompleted: [],
    discoveries: [],
    celestialSightings: [],
    archiveUnlocked: false,
    /* SG MISSION 001 narrative layer (V3 addendum §26) */
    sg01Contacted: false,
    photoCount: 0,
    rareEventsSeen: 0,
    secretsFound: [],
    classifiedUnlocked: false,
    hintsShown: [],
    settings: {
      language: null,               /* null = auto from browser */
      sound: true,
      motion: null,                 /* null = auto from prefers-reduced-motion */
      quality: 'auto',
      skipIntroOnReturn: false,
    },
  };
}

function migrate(save) {
  if (!save || typeof save !== 'object') return defaultSave();
  if (typeof save.version !== 'number') save.version = 0;
  /* v0 -> v1 */
  if (save.version < 1) {
    const d = defaultSave();
    save = Object.assign(d, save, { version: 1, settings: Object.assign(d.settings, save.settings || {}) });
  }
  /* future migrations chain here */
  if (!Array.isArray(save.missionsCompleted)) save.missionsCompleted = [];
  if (!Array.isArray(save.discoveries)) save.discoveries = [];
  if (!Array.isArray(save.celestialSightings)) save.celestialSightings = [];
  if (!Array.isArray(save.secretsFound)) save.secretsFound = [];
  if (!Array.isArray(save.hintsShown)) save.hintsShown = [];
  if (typeof save.sg01Contacted !== 'boolean') save.sg01Contacted = false;
  if (typeof save.classifiedUnlocked !== 'boolean') save.classifiedUnlocked = false;
  if (typeof save.photoCount !== 'number') save.photoCount = 0;
  if (typeof save.rareEventsSeen !== 'number') save.rareEventsSeen = 0;
  if (!save.settings) save.settings = defaultSave().settings;
  return save;
}

export function loadSave() {
  if (memory) return memory;
  const raw = storageGet();
  let save = null;
  if (raw) {
    try { save = JSON.parse(raw); } catch (e) { save = null; }
  }
  save = migrate(save);
  memory = save;
  return save;
}

export function persist() {
  if (!memory) return;
  storageSet(JSON.stringify(memory));
}

export function registerVisit() {
  const s = loadSave();
  s.visits += 1;
  if (s.visits === 1) s.firstVisitAt = new Date().toISOString();
  s.lastVisitAt = new Date().toISOString();
  persist();
  return s;
}

export function setSetting(key, value) {
  const s = loadSave();
  s.settings[key] = value;
  persist();
  return s;
}

export function completeMission(id) {
  const s = loadSave();
  if (!s.missionsCompleted.includes(id)) { s.missionsCompleted.push(id); persist(); }
  return s;
}

export function addDiscovery(id) {
  const s = loadSave();
  if (!s.discoveries.includes(id)) { s.discoveries.push(id); persist(); return true; }
  return false;
}

export function addSighting(id) {
  const s = loadSave();
  if (!s.celestialSightings.includes(id)) { s.celestialSightings.push(id); persist(); return true; }
  return false;
}

export function setLastWeather(statusKey) {
  const s = loadSave();
  s.lastWeather = statusKey;
  persist();
}

export function recordDestination(destinationKey) {
  const s = loadSave();
  const missionNumber = s.missionsCompleted.filter(m => m.indexOf('flight') === 0).length + 1;
  s.lastDestination = {
    destination: destinationKey,
    timestamp: new Date().toISOString(),
    missionNumber,
  };
  if (!s.missionsCompleted.includes('flight-' + missionNumber)) {
    s.missionsCompleted.push('flight-' + missionNumber);
  }
  persist();
  return s;
}

export function unlockArchive() {
  const s = loadSave();
  s.archiveUnlocked = true;
  persist();
}

export function resetSave() {
  memory = defaultSave();
  storageDel();
  persist();
  return memory;
}

/* ---------------- SG MISSION 001 narrative persistence ---------------- */
export function markSg01Contacted() {
  const s = loadSave();
  if (!s.sg01Contacted) {
    s.sg01Contacted = true;
    if (!s.missionsCompleted.includes('contact-sg01')) s.missionsCompleted.push('contact-sg01');
    persist();
    return true;
  }
  return false;
}
export function bumpPhoto() {
  const s = loadSave();
  s.photoCount += 1;
  persist();
  return s.photoCount;
}
export function bumpRareEvent() {
  const s = loadSave();
  s.rareEventsSeen += 1;
  persist();
  return s.rareEventsSeen;
}
export function addSecret(id) {
  const s = loadSave();
  if (!s.secretsFound.includes(id)) {
    s.secretsFound.push(id);
    persist();
  }
  return s.secretsFound.length;
}
export function unlockClassified() {
  const s = loadSave();
  s.classifiedUnlocked = true;
  persist();
}
export function markHint(id) {
  const s = loadSave();
  if (s.hintsShown.includes(id)) return false;
  s.hintsShown.push(id);
  persist();
  return true;
}
