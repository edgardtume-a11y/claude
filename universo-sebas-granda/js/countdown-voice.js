/* ============================================================================
   UNIVERSO SEBAS GRANDA — countdown-voice.js (V3.4)
   Voz de control de misión para la cuenta regresiva. Prioridad (brief §14):
     1. clips locales bajo assets/audio/voice/<es|en>/<key>.(ogg|mp3) — solo si
        assets/audio/voice/manifest.json existe y los declara;
     2. SpeechSynthesis (ES → es-CO preferente, es-419/es-US/es-MX/es-ES
        fallback; EN → en-US);
     3. nada — el llamador conserva beep + texto. NUNCA bloquea el lanzamiento.
   Sin servicios TTS externos en runtime; no se envía ningún dato del visitante.
   ============================================================================ */

const WORDS = {
  es: { 5: 'cinco', 4: 'cuatro', 3: 'tres', 2: 'dos', 1: 'uno', ignition: 'ignición', liftoff: 'despegue' },
  en: { 5: 'five', 4: 'four', 3: 'three', 2: 'two', 1: 'one', ignition: 'ignition', liftoff: 'liftoff' },
};

/* preferencia de acento por locale (minúsculas, prefix-match sobre voice.lang) */
const LANG_PREF = {
  es: ['es-co', 'es-419', 'es-us', 'es-mx', 'es-es', 'es'],
  en: ['en-us', 'en'],
};

export function createCountdownVoice() {
  const state = {
    clips: null,          /* {es:{5:'url',...}, en:{...}} desde manifest.json */
    clipsTried: false,
    voices: [],
    chosen: {},           /* locale → SpeechSynthesisVoice|null(=sin voz) */
    enabled: true,
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };

  const refreshVoices = () => {
    try { state.voices = window.speechSynthesis.getVoices() || []; } catch (e) { state.voices = []; }
    state.chosen = {};   /* re-elegir cuando el navegador cargue voces tarde */
  };
  if (state.supported) {
    refreshVoices();
    try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch (e) {}
  }

  const pickVoice = (locale) => {
    if (locale in state.chosen) return state.chosen[locale];
    let found = null;
    const prefs = LANG_PREF[locale] || [locale];
    for (const pref of prefs) {
      found = state.voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').indexOf(pref) === 0) || null;
      if (found) break;
    }
    state.chosen[locale] = found;
    return found;
  };

  /* clips locales: un solo fetch del manifest — sin 404 por archivo */
  const loadClips = async () => {
    if (state.clipsTried) return state.clips;
    state.clipsTried = true;
    try {
      const r = await fetch('assets/audio/voice/manifest.json', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && (j.es || j.en)) state.clips = j;
      }
    } catch (e) { /* sin clips locales — SpeechSynthesis decide */ }
    return state.clips;
  };
  loadClips();

  return {
    setEnabled(on) { state.enabled = !!on; },
    /* true si alguna vía de voz habló; false → el llamador mantiene beep+texto */
    say(locale, key) {
      if (!state.enabled) return false;
      const loc = locale === 'en' ? 'en' : 'es';
      const word = WORDS[loc][key];
      if (!word) return false;
      /* 1 — clip local */
      const clips = state.clips;
      if (clips && clips[loc] && clips[loc][key]) {
        try {
          const a = new Audio('assets/audio/voice/' + clips[loc][key]);
          a.volume = 0.9;
          const p = a.play();
          if (p && p.catch) p.catch(() => {});
          return true;
        } catch (e) { /* clip roto → seguir al TTS */ }
      }
      /* 2 — Web Speech */
      if (!state.supported) return false;
      try {
        if (!state.voices.length) refreshVoices();
        const voice = pickVoice(loc);
        if (!voice && !state.voices.some((v) => (v.lang || '').toLowerCase().indexOf(loc) === 0)) {
          /* navegador sin voz para este idioma → beep + texto (brief §14) */
          if (state.voices.length) return false;
        }
        const u = new SpeechSynthesisUtterance(word);
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : (loc === 'es' ? 'es-CO' : 'en-US');
        u.rate = 1.0;
        u.pitch = 0.92;         /* levemente grave: launch-control feel */
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    },
    /* secuencia QA: 5-4-3-2-1 con cadencia 1 s */
    sayCountdown(locale) {
      [5, 4, 3, 2, 1].forEach((n, i) => setTimeout(() => this.say(locale, n), i * 1000));
    },
  };
}
