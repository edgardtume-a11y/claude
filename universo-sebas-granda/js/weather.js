/* UNIVERSO SEBAS GRANDA — WeatherService (Open-Meteo, free, no key).
   Never blocks the experience: timeout + cache + graceful OFFLINE fallback. */

import { WEATHER_CACHE_KEY } from './config.js';

const TIMEOUT_MS = 8000;
const CACHE_MAX_AGE = 1000 * 60 * 60 * 6; /* accept cache up to 6 h old */

function cacheRead() {
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.at || !obj.data) return null;
    return obj;
  } catch (e) { return null; }
}

function cacheWrite(data) {
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch (e) { /* ignore */ }
}

function num(v, fallback) {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

/* Normalize an Open-Meteo response into SG world inputs. Exported for testing. */
export function parseOpenMeteo(json) {
  const c = (json && json.current) || {};
  const h = (json && json.hourly) || {};
  let visibility = 20000;
  let pastPrecip = 0;
  try {
    const times = h.time || [];
    const vis = h.visibility || [];
    const pr = h.precipitation || [];
    const nowKey = (c.time || '').slice(0, 13);
    let idx = -1;
    for (let i = 0; i < times.length; i++) {
      if (String(times[i]).slice(0, 13) === nowKey) { idx = i; break; }
    }
    if (idx < 0) idx = Math.min(times.length - 1, 24);
    if (idx >= 0) {
      visibility = num(vis[idx], visibility);
      for (let k = 1; k <= 3; k++) {
        const j = idx - k;
        if (j >= 0) pastPrecip += num(pr[j], 0);
      }
    }
  } catch (e) { /* keep defaults */ }

  const code = num(c.weather_code, 2);
  return {
    temp: num(c.temperature_2m, 19),
    humidity: num(c.relative_humidity_2m, 78),
    precip: num(c.precipitation, 0),
    rain: num(c.rain, 0) + num(c.showers, 0),
    cloud: num(c.cloud_cover, 55) / 100,
    cloudLow: num(c.cloud_cover_low, 45) / 100,
    cloudMid: num(c.cloud_cover_mid, 35) / 100,
    cloudHigh: num(c.cloud_cover_high, 25) / 100,
    windSpeed: num(c.wind_speed_10m, 8),
    windDir: num(c.wind_direction_10m, 220),
    windGusts: num(c.wind_gusts_10m, 12),
    isDay: num(c.is_day, 1) === 1,
    code,
    visibility,
    pastPrecip,
  };
}

/* Plausible Andean-afternoon fallback used only when nothing else exists (status OFFLINE — never labeled LIVE). */
export function fallbackData() {
  return {
    temp: 19, humidity: 80, precip: 0, rain: 0,
    cloud: 0.6, cloudLow: 0.5, cloudMid: 0.35, cloudHigh: 0.25,
    windSpeed: 9, windDir: 210, windGusts: 14,
    isDay: true, code: 2, visibility: 18000, pastPrecip: 0,
  };
}

export function weatherStatusKey(data) {
  if (!data) return 'cloudy';
  const code = data.code;
  if (code === 45 || code === 48 || data.visibility < 2500) return 'fog';
  if (code >= 95) return 'storm';
  if (data.precip > 0.1 || data.rain > 0.1 || (code >= 51 && code <= 82)) return 'rain';
  if (data.cloud > 0.72) return 'cloudy';
  return 'clear';
}

async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* status: 'live' | 'cached' | 'offline'. retryIn (s) hints the caller how soon a
   re-attempt is worthwhile — short after failures, long after success. Never
   labels anything LIVE unless the API answered right now. */
export async function getWeather(lat, lon) {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + encodeURIComponent(lat) +
    '&longitude=' + encodeURIComponent(lon) +
    '&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,weather_code,' +
    'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,' +
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&hourly=visibility,precipitation&past_days=1&forecast_days=1&timezone=auto';

  const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (!offlineNow) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = await fetchOnce(url, TIMEOUT_MS + attempt * 4000);
        const data = parseOpenMeteo(json);
        cacheWrite(data);
        return { status: 'live', at: Date.now(), data, retryIn: 600 };
      } catch (e) {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
  const cached = cacheRead();
  if (cached && (Date.now() - cached.at) < CACHE_MAX_AGE) {
    return { status: 'cached', at: cached.at, data: cached.data, retryIn: 90 };
  }
  return { status: 'offline', at: Date.now(), data: fallbackData(), retryIn: 60 };
}
