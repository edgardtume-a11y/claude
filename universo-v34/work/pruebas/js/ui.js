/* UNIVERSO SEBAS GRANDA — UI layer (DOM/HUD). No Three.js here. */

import { GALAXIES, TOTAL_DISCOVERIES, DISCOVERIES, MEDELLIN } from './config.js';
import { t, getLanguage } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function cardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

export class UI {
  constructor(cb) {
    this.cb = cb || {};
    this.isTouch = window.matchMedia('(pointer:coarse)').matches;

    this.el = {
      intro: $('intro-layer'), greetings: $('greetings'),
      introTitle: $('intro-title'), introPre: $('intro-pre'),
      chapter: $('chapter-label'), clock: $('clock-chip'),
      weather: $('weather-chip'), wMain: null, wSub: null, wSrc: null,
      loc: $('loc-chip'),
      systems: $('systems'), telemetry: $('telemetry'),
      hint: $('hint'), ctaWrap: $('cta-wrap'), ctaTop: $('cta-top'), cta: $('cta'),
      countBig: $('count-big'), banner: $('banner'),
      sgos: $('sgos'), discChip: $('discovery-chip'), sightChip: $('sighting-chip'),
      scanner: $('scanner'), scanLabel: $('scan-label'), scanRing: document.querySelector('#scan-ring circle'),
      letterbox: $('letterbox'), flash: $('flash'),
      anchors: $('galaxy-anchors'),
      objective: $('objective'), objTag: $('obj-tag'), objText: $('obj-text'),
      bootseq: $('bootseq'),
      infoCard: $('info-card'), infoTitle: $('info-title'), infoBody: $('info-body'), infoClose: $('info-close'),
      photoPresets: $('photo-presets'),
      welcomeActions: $('welcome-actions'), wContinue: $('w-continue'), wReplay: $('w-replay'), wHub: $('w-hub'),
      gPanel: $('galaxy-panel'), gpEyebrow: $('gp-eyebrow'), gpTitle: $('gp-title'),
      gpSub: $('gp-sub'), gpNav: $('gp-nav'), gpCta: $('gp-cta'),
      panels: { settings: $('panel-settings'), log: $('panel-log'), sky: $('panel-sky') },
      logBody: $('log-body'), btnArchive: $('btn-archive'),
      archiveBody: $('archive-body'), archiveTitle: $('archive-title'), archiveText: $('archive-text'),
      cvMap: $('cv-map'), cvSky: $('cv-sky'),
      photoUi: $('photo-ui'),
      welcome: $('welcome'),
      quick: $('quick'), scanBr: $('scan-brackets'),
      loader: $('loader-line'),
      debug: $('debug'),
      lite: $('lite'),
      btns: {
        lang: $('btn-lang'), sound: $('btn-sound'), log: $('btn-log'), settings: $('btn-settings'),
        scan: $('btn-scan'), cam: $('btn-cam'), photo: $('btn-photo'), sky: $('btn-sky'),
        skipIntro: $('btn-skip-intro'), skipFlight: $('btn-skip-flight'),
        capture: $('btn-capture'), photoExit: $('btn-photo-exit'),
        syncloc: $('btn-syncloc'), liteBtn: $('btn-lite'), reset: $('btn-reset'),
        archive: $('btn-archive'), full: $('btn-full'),
      },
    };
    this.el.wMain = this.el.weather.querySelector('.w-main');
    this.el.wSub = this.el.weather.querySelector('.w-sub');
    this.el.wSrc = this.el.weather.querySelector('.src');

    this._sgosQueue = [];
    this._sgosBusy = false;
    this._sgosLast = 0;
    this._sgosSuppress = false;
    this._bannerTimer = 0;
    this._openPanel = null;
    this.galaxyAnchorEls = [];

    this._buildGalaxyAnchors();
    this._wire();
  }

  /* ---------- wiring ---------- */
  _wire() {
    const c = this.cb;
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

    on(this.el.btns.lang, 'click', () => c.onLangToggle && c.onLangToggle());
    on(this.el.btns.sound, 'click', () => c.onSoundToggle && c.onSoundToggle());
    on(this.el.btns.log, 'click', () => this.togglePanel('log'));
    on(this.el.btns.settings, 'click', () => this.togglePanel('settings'));
    on(this.el.btns.sky, 'click', () => this.togglePanel('sky'));
    on(this.el.btns.scan, 'click', () => c.onScanToggle && c.onScanToggle());
    on(this.el.btns.cam, 'click', () => c.onCam && c.onCam());
    on(this.el.btns.photo, 'click', () => c.onPhotoToggle && c.onPhotoToggle());
    on(this.el.btns.skipIntro, 'click', () => c.onSkipIntro && c.onSkipIntro());
    on(this.el.btns.skipFlight, 'click', () => c.onSkipFlight && c.onSkipFlight());
    on(this.el.btns.capture, 'click', () => c.onCapture && c.onCapture());
    on(this.el.btns.photoExit, 'click', () => c.onPhotoToggle && c.onPhotoToggle());
    on(this.el.btns.syncloc, 'click', () => c.onSyncLocation && c.onSyncLocation());
    on(this.el.infoClose, 'click', () => this.hideInfoCard());
    if (this.el.photoPresets) {
      this.el.photoPresets.querySelectorAll('.ps').forEach((b) => {
        b.addEventListener('click', () => {
          this.setPhotoPreset(b.dataset.ps);
          c.onPhotoPreset && c.onPhotoPreset(b.dataset.ps);
        });
      });
    }
    on(this.el.wContinue, 'click', () => { this.hideWelcome(); c.onWelcomeContinue && c.onWelcomeContinue(); });
    on(this.el.wReplay, 'click', () => { this.hideWelcome(); c.onWelcomeReplay && c.onWelcomeReplay(); });
    on(this.el.wHub, 'click', () => { this.hideWelcome(); c.onWelcomeHub && c.onWelcomeHub(); });
    on(this.el.btns.liteBtn, 'click', () => c.onLite && c.onLite());
    on(this.el.btns.reset, 'click', () => c.onReset && c.onReset());
    on(this.el.btns.archive, 'click', () => this._toggleArchive());
    on(this.el.btns.full, 'click', () => { try { window.location.href = window.location.pathname; } catch (e) {} });
    on(this.el.cta, 'click', () => c.onCTA && c.onCTA());
    on(this.el.cta, 'mouseenter', () => c.onCTAHover && c.onCTAHover());

    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => this.closePanels()));

    /* segmented settings */
    this._seg('seg-lang', (v) => c.onLangSet && c.onLangSet(v));
    this._seg('seg-sound', (v) => c.onSoundSet && c.onSoundSet(v === 'on'));
    this._seg('seg-motion', (v) => c.onMotionSet && c.onMotionSet(v === 'on'));
    this._seg('seg-quality', (v) => c.onQualitySet && c.onQualitySet(v));
    this._seg('seg-skipreturn', (v) => c.onSkipReturnSet && c.onSkipReturnSet(v === 'on'));
    this._seg('seg-observer', (v) => c.onSkyObserverSet && c.onSkyObserverSet(v));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._openPanel) { this.closePanels(); e.preventDefault(); return; }
        c.onEscape && c.onEscape();
      }
    });
  }

  _seg(id, fn) {
    const seg = $(id);
    if (!seg) return;
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      this.setSeg(id, b.dataset.v);
      fn(b.dataset.v);
    });
  }

  setSeg(id, value) {
    const seg = $(id);
    if (!seg) return;
    seg.querySelectorAll('button[data-v]').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.v === value ? 'true' : 'false'));
  }

  /* ---------- language ---------- */
  applyLanguage() {
    const b = this.el.btns;
    b.skipIntro.textContent = t('skip_intro');
    b.skipFlight.textContent = t('skip_flight');
    b.sound.textContent = t('sound');
    b.photo.textContent = t('photo');
    b.scan.textContent = t('scan');
    b.capture.textContent = t('photo_capture');
    b.photoExit.textContent = t('photo_exit');
    b.syncloc.textContent = t('sync_location');
    b.liteBtn.textContent = t('lite_mode');
    b.reset.textContent = t('reset_data');
    $('ps-h').textContent = t('settings');
    $('pl-h').textContent = t('mission_log');
    $('pk-h').textContent = t('control_center');
    this.el.introPre.textContent = t('welcome_to');
    $('lite-q').textContent = t('lite_question');
    $('lite-note-txt').textContent = t('lite_note') + ' ';
    b.full.textContent = t('open_full');
    const lblMap = { language: 'language', sound: 'sound', motion: 'motion', quality: 'quality', skip_on_return: 'skip_on_return' };
    document.querySelectorAll('[data-lbl]').forEach((s) => {
      const k = lblMap[s.getAttribute('data-lbl')];
      if (k) s.textContent = t(k);
    });
    this.setSeg('seg-lang', getLanguage());
    this.el.archiveTitle.textContent = t('archive_title');
    this.el.archiveText.textContent = t('archive_body');
    this._renderAnchorLabels();
    if (this._gShown != null) this.showGalaxy(this._gShown, this._gLocked || 'preview');
    this.applyPresetLabels();
  }

  /* ---------- chapter / clock / weather ---------- */
  setChapter(text) { this.el.chapter.textContent = text || ''; }
  setClock(str) { this.el.clock.textContent = str; }
  setLocChip(text) {
    if (!text) { this.el.loc.classList.remove('show'); return; }
    this.el.loc.textContent = text;
    this.el.loc.classList.add('show');
  }

  setWeather(w) {
    if (!w) return;
    this.el.wMain.textContent = MEDELLIN.name + ' ' + Math.round(w.temp) + '°C';
    this.el.wSub.textContent =
      t('clouds_lbl') + ' ' + Math.round(w.cloud * 100) + '% · ' +
      t('wind_lbl') + ' ' + Math.round(w.windSpeed) + ' ' + cardinal(w.windDir) + ' · ' +
      t('hum_lbl') + ' ' + Math.round(w.humidity) + '%';
    this.el.wSrc.textContent = w.src.toUpperCase();
    this.el.wSrc.setAttribute('data-src', w.src);
  }

  /* ---------- systems / telemetry ---------- */
  showSystems(show) { this.el.systems.classList.toggle('hud-hidden', !show); }
  setSystemsDefault() {
    this.el.systems.innerHTML =
      '<b>SG // MISSION CONTROL</b>\n' +
      'NAVIGATION      — <span class="go">GO</span>\n' +
      'WEATHER         — <span class="go">GO</span>\n' +
      'PROPULSION      — <span class="go">GO</span>\n' +
      'GUIDANCE        — <span class="go">GO</span>\n' +
      'COMMUNICATIONS  — <span class="go">GO</span>\n' +
      'UMBILICAL       — CONNECTED\n' +
      'FLIGHT COMPUTER — READY';
  }
  showTelemetry(show) { this.el.telemetry.classList.toggle('hud-hidden', !show); }
  setTelemetry(text) { this.el.telemetry.innerHTML = text; }

  /* ---------- hint / CTA ---------- */
  setHint(text) { this.el.hint.textContent = text || ''; }
  setCTA(mode) {
    const w = this.el.ctaWrap;
    if (!mode) { w.classList.remove('show'); return; }
    if (mode === 'launch') {
      this.el.ctaTop.textContent = t('launch_top');
      this.el.cta.textContent = t('launch_main');
    } else if (mode === 'warp') {
      this.el.ctaTop.textContent = 'LIGHT SPEED READY';
      this.el.cta.textContent = t('engage_warp');
    }
    this.el.cta.disabled = false;
    w.classList.add('show');
  }
  disableCTA() { this.el.cta.disabled = true; }
  enableCTA() { this.el.cta.disabled = false; }

  /* ---------- countdown / banner ---------- */
  /* digit=true → the V3.4 hero countdown: huge, centered, elegant (§53) */
  setCount(text, digit) {
    if (text == null) { this.el.countBig.classList.remove('show', 'digit'); return; }
    this.el.countBig.textContent = text;
    this.el.countBig.classList.toggle('digit', !!digit);
    this.el.countBig.classList.remove('pop');
    void this.el.countBig.offsetWidth;          /* restart the pop animation */
    this.el.countBig.classList.add('show', 'pop');
  }
  banner(text, ms, gold) {
    clearTimeout(this._bannerTimer);
    this.el.banner.textContent = text;
    this.el.banner.classList.toggle('gold', !!gold);
    this.el.banner.classList.add('show');
    this._bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), ms || 2200);
  }

  /* short lower-third confirmation (camera mode, etc.) */
  quick(text) {
    const q = this.el.quick;
    if (!q) return;
    clearTimeout(this._quickTimer);
    q.textContent = text;
    q.classList.add('show');
    this._quickTimer = setTimeout(() => q.classList.remove('show'), 950);
  }
  /* hides secondary HUD during hero beats (countdown, liftoff, warp) */
  cinematic(on) {
    document.body.classList.toggle('cinema', !!on);
  }
  /* scanner target brackets: position + distance + data class */
  scanBrackets(o) {
    const b = this.el.scanBr;
    if (!b) return;
    if (!o) { b.hidden = true; return; }
    b.hidden = false;
    b.style.left = o.x + 'px';
    b.style.top = o.y + 'px';
    b.dataset.lock = o.lock ? '1' : '0';
    const cls = b.querySelector('.sb-cls');
    const dist = b.querySelector('.sb-dist');
    if (cls) cls.textContent = o.cls || '';
    if (dist) dist.textContent = (o.dist || '') + (o.lock ? ' // LOCK' : '');
    b.style.setProperty('--sig', String(Math.round((o.sig || 0) * 100) / 100));
  }
  /* unlocks the YOUR SKY option once geolocation succeeds */
  enableUserObserver() {
    const seg = document.getElementById('seg-observer');
    if (!seg) return;
    seg.querySelectorAll('button[disabled]').forEach((b) => b.removeAttribute('disabled'));
  }

  /* ---------- SG.OS ---------- */
  sgosSuppress(on) { this._sgosSuppress = on; }
  sgos(text, prio) {
    if (this._sgosQueue.some((q) => q.text === text)) return;
    this._sgosQueue.push({ text, prio: prio || 0 });
    this._sgosQueue.sort((a, b) => b.prio - a.prio);
    if (this._sgosQueue.length > 3) this._sgosQueue.length = 3;
    this._sgosPump();
  }
  _sgosPump() {
    if (this._sgosBusy || !this._sgosQueue.length) return;
    if (this._sgosSuppress) { setTimeout(() => this._sgosPump(), 1200); return; }
    const now = performance.now();
    const wait = Math.max(0, 7000 - (now - this._sgosLast));
    this._sgosBusy = true;
    setTimeout(() => {
      const item = this._sgosQueue.shift();
      if (!item) { this._sgosBusy = false; return; }
      this.el.sgos.textContent = item.text;
      this.el.sgos.classList.add('show');
      this._sgosLast = performance.now();
      setTimeout(() => {
        this.el.sgos.classList.remove('show');
        this._sgosBusy = false;
        this._sgosPump();
      }, 3400);
    }, wait);
  }

  setDiscoveries(found) {
    this.el.discChip.textContent = 'DISCOVERIES ' + String(found).padStart(2, '0') + ' / ' + TOTAL_DISCOVERIES;
  }
  setSightings(n) {
    this.el.sightChip.textContent = n > 0 ? 'LIVE CELESTIAL SIGHTINGS ' + String(n).padStart(2, '0') : '';
  }

  /* ---------- scanner ---------- */
  scannerShow(on) {
    this.el.scanner.classList.toggle('on', on);
    this.el.btns.scan.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) this.scanStatus({ state: 'online' });
  }
  scanStatus(s) {
    const ring = this.el.scanRing;
    const L = 427;
    let pct = s.pct || 0;
    ring.style.strokeDashoffset = String(L * (1 - Math.max(0, Math.min(1, pct))));
    let main = 'SG SCANNER // ONLINE';
    let sub = '';
    if (s.state === 'signal') { main = 'SIGNAL ' + Math.round(s.pct * 100) + '%'; sub = s.label || ''; }
    else if (s.state === 'lock') { main = 'LOCK'; sub = s.label || ''; }
    else if (s.state === 'scanning') { main = 'SCANNING ' + Math.round(s.pct * 100) + '%'; sub = s.label || ''; }
    else if (s.state === 'complete') { main = 'SCAN COMPLETE'; sub = s.label || ''; }
    else if (s.state === 'none') { main = 'SG SCANNER // ONLINE'; sub = '—'; }
    this.el.scanLabel.innerHTML = main + (sub ? '<span class="sub">' + sub + '</span>' : '');
  }

  /* ---------- cinematic dressing ---------- */
  letterbox(on) { this.el.letterbox.classList.toggle('on', on); }
  flash(color, peak, dur) {
    const f = this.el.flash;
    f.style.background = color || '#fff';
    f.style.transition = 'opacity .1s';
    f.style.opacity = String(peak == null ? 1 : peak);
    setTimeout(() => {
      f.style.transition = 'opacity ' + ((dur || 600) / 1000) + 's';
      f.style.opacity = '0';
    }, 90);
  }

  /* ---------- galaxies ---------- */
  _buildGalaxyAnchors() {
    GALAXIES.forEach((g, i) => {
      const a = document.createElement('a');
      a.className = 'galaxy-anchor';
      a.href = g.url;
      a.style.color = g.accent;
      a.hidden = true;
      a.dataset.index = String(i);
      const span = document.createElement('span');
      a.appendChild(span);
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return; /* let browser handle */
        e.preventDefault();
        this.cb.onGalaxyTap && this.cb.onGalaxyTap(i);
      });
      /* V3.3 backup path — the authoritative double-tap lives in experience */
      a.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.cb.onGalaxyConfirm && this.cb.onGalaxyConfirm(i, 'dbl');
      });
      a.addEventListener('focus', () => this.cb.onGalaxyHover && this.cb.onGalaxyHover(i));
      a.addEventListener('blur', () => this.cb.onGalaxyHover && this.cb.onGalaxyHover(-1));
      a.addEventListener('pointerenter', () => this.cb.onGalaxyHover && this.cb.onGalaxyHover(i));
      a.addEventListener('pointerleave', () => this.cb.onGalaxyHover && this.cb.onGalaxyHover(-1));
      this.el.anchors.appendChild(a);
      this.galaxyAnchorEls.push(a);
    });
    this._renderAnchorLabels();
    this.el.gpCta.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      /* the CTA always confirms the galaxy the panel is SHOWING (§39/§44) */
      this.cb.onGalaxyConfirm && this.cb.onGalaxyConfirm(this._gShown);
    });
  }
  _renderAnchorLabels() {
    const es = getLanguage() === 'es';
    GALAXIES.forEach((g, i) => {
      const a = this.galaxyAnchorEls[i];
      if (a) a.querySelector('span').textContent = es ? g.nameES : g.nameEN;
    });
  }
  setGalaxyAnchor(i, x, y, visible, selected) {
    const a = this.galaxyAnchorEls[i];
    if (!a) return;
    a.hidden = !visible;
    if (visible) {
      a.style.left = x + 'px';
      a.style.top = y + 'px';
      a.classList.toggle('sel', !!selected);
    }
  }
  anchorsVisible(on) { this.galaxyAnchorEls.forEach((a) => { if (!on) a.hidden = true; }); }

  showGalaxy(i, state) {
    if (state === true) state = 'selected';
    if (!state) state = 'preview';
    this._gShown = i; this._gLocked = state;
    const g = GALAXIES[i];
    const es = getLanguage() === 'es';
    this.el.gPanel.setAttribute('data-k', g.key);
    this.el.gPanel.setAttribute('data-state', state);
    this.el.gpEyebrow.textContent = state === 'selected' ? t('galaxy_selected') : 'SG NAVIGATION // PREVIEW';
    this.el.gpTitle.textContent = es ? g.nameES : g.nameEN;
    this.el.gpSub.textContent = es ? g.subES : g.subEN;
    this.el.gpNav.textContent = 'SG NAVIGATION\n\n' + g.nav.join('\n');
    this.el.gpCta.textContent = es ? g.ctaES : g.ctaEN;
    this.el.gpCta.href = g.url;
    this.el.gPanel.classList.add('show');
  }
  hideGalaxy() {
    this._gShown = null;
    this.el.gPanel.classList.remove('show');
  }

  /* ---------- panels ---------- */
  togglePanel(name) {
    if (this._openPanel === name) { this.closePanels(); return; }
    this.closePanels();
    const p = this.el.panels[name];
    if (!p) return;
    p.classList.add('open');
    this._openPanel = name;
    if (name === 'log' && this.cb.onOpenLog) this.cb.onOpenLog();
    if (name === 'sky' && this.cb.onOpenSky) this.cb.onOpenSky();
  }
  closePanels() {
    Object.values(this.el.panels).forEach((p) => p.classList.remove('open'));
    this._openPanel = null;
    this.el.archiveBody.classList.remove('show');
  }
  get openPanel() { return this._openPanel; }

  renderLog(save) {
    const es = getLanguage() === 'es';
    const fmt = (iso) => {
      try { return new Date(iso).toLocaleString(es ? 'es-CO' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
      catch (e) { return iso; }
    };
    const found = save.discoveries;
    const discHtml = DISCOVERIES.map((d) => {
      const ok = found.includes(d.id);
      const name = ok ? (es ? d.titleES : d.titleEN) : t('locked_item');
      return '<span class="' + (ok ? 'found' : 'locked') + '">' + (ok ? '◈ ' : '◇ ') + name + '</span>';
    }).join('');
    const dest = save.lastDestination
      ? (GALAXIES.find((g) => g.key === save.lastDestination.destination) || {})
      : null;
    const destName = dest ? (es ? dest.nameES : dest.nameEN) : t('none_yet');
    const weather = save.lastWeather ? t('weather_' + save.lastWeather) : t('none_yet');
    const step = (done, esTxt, enTxt) =>
      '<span class="' + (done ? 'found' : 'locked') + '">' + (done ? '◈ ' : '◇ ') + (es ? esTxt : enTxt) + '</span>';
    const flights = save.missionsCompleted.filter((m2) => m2.indexOf('flight') === 0).length;
    const statusHtml =
      step(true, 'INSTALACIÓN VISITADA', 'FACILITY VISITED') +
      step(!!save.sg01Contacted, 'SG-01 CONTACTADO', 'SG-01 CONTACTED') +
      step(flights > 0, 'LANZAMIENTO COMPLETADO', 'LAUNCH COMPLETED') +
      step(flights > 0, 'ÓRBITA BAJA CONSEGUIDA', 'LOW EARTH ORBIT ACHIEVED') +
      step(flights > 0, 'WARP COMPLETADO', 'WARP COMPLETED') +
      step(!!save.lastDestination, 'DESTINO VISITADO', 'DESTINATION VISITED');
    const secretsHtml = (save.secretsFound && save.secretsFound.length
      ? save.secretsFound.length + ' / 3' + (save.classifiedUnlocked ? ' · ' + t('classified_granted') : '')
      : '0 / 3');
    this.el.logBody.innerHTML =
      '<dt>' + t('mission_tag') + ' — STATUS</dt><dd class="disc-list">' + statusHtml + '</dd>' +
      '<dt>' + (es ? 'SECRETOS' : 'SECRETS') + '</dt><dd>' + secretsHtml + '</dd>' +
      '<dt>' + (es ? 'CAPTURAS' : 'CAPTURES') + '</dt><dd>' + String(save.photoCount || 0) + '</dd>' +
      '<dt>' + t('visits') + '</dt><dd>' + save.visits + '</dd>' +
      '<dt>' + t('first_visit') + '</dt><dd>' + fmt(save.firstVisitAt) + '</dd>' +
      '<dt>' + t('last_visit') + '</dt><dd>' + fmt(save.lastVisitAt) + '</dd>' +
      '<dt>' + t('missions') + '</dt><dd>' + (save.missionsCompleted.length ? save.missionsCompleted.join(' · ') : t('none_yet')) + '</dd>' +
      '<dt>' + t('last_weather') + '</dt><dd>' + weather + '</dd>' +
      '<dt>' + t('last_destination') + '</dt><dd>' + destName + '</dd>' +
      '<dt>' + t('sightings') + '</dt><dd>' + (save.celestialSightings.length ? save.celestialSightings.join(' · ') : t('none_yet')) + '</dd>' +
      '<dt>' + t('discoveries') + ' ' + save.discoveries.length + ' / ' + TOTAL_DISCOVERIES + '</dt>' +
      '<dd class="disc-list">' + discHtml + '</dd>';
    const unlocked = save.discoveries.length >= TOTAL_DISCOVERIES || save.archiveUnlocked;
    this.el.btns.archive.hidden = false;
    this.el.btns.archive.textContent = unlocked ? t('archive_open') : t('archive_locked');
    this.el.btns.archive.disabled = !unlocked;
    this.el.btns.archive.style.opacity = unlocked ? '1' : '.45';
    this._archiveUnlocked = unlocked;
  }
  _toggleArchive() {
    if (!this._archiveUnlocked) return;
    this.el.archiveBody.classList.toggle('show');
  }

  /* ---------- sky panel drawing ---------- */
  drawSkyPanel(state) {
    this._drawMap(state);
    this._drawSky(state);
  }
  _drawMap(st) {
    const cv = this.el.cvMap, ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,180,255,.16)';
    /* valley topo rings */
    for (let r = 26; r < 190; r += 26) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, r * 1.5, r * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    /* mountains east/west */
    ctx.fillStyle = 'rgba(90,140,220,.10)';
    ctx.fillRect(0, 0, 26, h); ctx.fillRect(w - 26, 0, 26, h);
    /* trajectory */
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(53,214,255,.6)';
    ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 70, h / 2 - 52); ctx.stroke();
    ctx.setLineDash([]);
    /* facility */
    ctx.fillStyle = '#35d6ff';
    ctx.fillRect(w / 2 - 3, h / 2 - 3, 6, 6);
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(230,244,255,.85)';
    ctx.fillText('SG LAUNCH FACILITY', w / 2 + 8, h / 2 + 3);
    /* wind arrow (direction wind blows TOWARD) */
    if (st && st.weather) {
      const a = ((st.weather.windDir + 180) % 360) * Math.PI / 180;
      const cx = 34, cy = h - 30, L = 16;
      const dx = Math.sin(a) * L, dy = -Math.cos(a) * L;
      ctx.strokeStyle = '#e8cf9e';
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#e8cf9e'; ctx.fill();
      ctx.fillStyle = 'rgba(232,207,158,.8)';
      ctx.fillText('WIND ' + Math.round(st.weather.windSpeed) + ' KM/H', cx - 14, cy + 24);
    }
    /* north */
    ctx.fillStyle = 'rgba(230,244,255,.7)';
    ctx.fillText('N', w - 16, 14);
    ctx.strokeStyle = 'rgba(230,244,255,.5)';
    ctx.beginPath(); ctx.moveTo(w - 12, 26); ctx.lineTo(w - 12, 18); ctx.stroke();
  }
  _drawSky(st) {
    const cv = this.el.cvSky, ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const horizon = h - 22;
    const X = (az) => (az / 360) * w;
    const Y = (alt) => horizon - (Math.max(0, alt) / 90) * (horizon - 10);
    /* active observer (BASE Medellín or synced USER position) */
    if (st && st.observer) {
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(53,214,255,.85)';
      ctx.fillText(st.observer, 6, 12);
    }
    /* horizon + cardinals */
    ctx.strokeStyle = 'rgba(120,180,255,.35)';
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
    ctx.fillStyle = 'rgba(142,169,198,.9)';
    ctx.font = '8px monospace';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270], ['N', 359]].forEach(([c, az]) => {
      ctx.fillText(c, X(az) - 2, h - 8);
    });
    if (!st) return;
    /* sun path (today, hourly) */
    if (st.sunPath) {
      ctx.strokeStyle = 'rgba(255,214,130,.35)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      let started = false;
      st.sunPath.forEach((p) => {
        if (p.alt <= 0) { started = false; return; }
        const x = X(p.az), y = Y(p.alt);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /* sun */
    if (st.sun && st.sun.alt > -2) {
      ctx.fillStyle = '#ffd982';
      ctx.beginPath(); ctx.arc(X(st.sun.az), Y(st.sun.alt), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,217,130,.85)';
      ctx.fillText('SUN', X(st.sun.az) + 8, Y(st.sun.alt) + 3);
    }
    /* moon — only above horizon, phase-shaded */
    if (st.moon && st.moon.alt > 0) {
      const mx = X(st.moon.az), my = Y(st.moon.alt);
      ctx.fillStyle = '#dfe9ff';
      ctx.beginPath(); ctx.arc(mx, my, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#050a14';
      const k = 1 - st.moon.illum;
      ctx.beginPath();
      ctx.ellipse(mx - (st.moon.phase < 0.5 ? 1 : -1) * 2.2 * k, my, 4.4 * k, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(223,233,255,.85)';
      ctx.fillText('MOON', mx + 8, my + 3);
    }
    /* planets */
    if (st.planets) {
      st.planets.forEach((p) => {
        if (p.alt <= 0) return;
        ctx.fillStyle = '#a97dff';
        ctx.beginPath(); ctx.arc(X(p.az), Y(p.alt), 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(169,125,255,.85)';
        ctx.fillText(p.name[0], X(p.az) + 5, Y(p.alt) + 3);
      });
    }
  }

  /* ---------- photo / welcome / loader / debug ---------- */
  photoMode(on) {
    document.body.classList.toggle('photo', on);
    this.el.photoUi.classList.toggle('on', on);
  }
  showWelcome(save, withChoices) {
    const s = save;
    const acts = this.el.welcomeActions;
    const info =
      '<b>SG NETWORK</b>' +
      '<br>EXPLORER IDENTIFIED' +
      '<br>' + t('welcome_back') +
      '<br><span class="dim">MISSIONS ' + String(s.missionsCompleted.length).padStart(2, '0') +
      ' · DISCOVERIES ' + String(s.discoveries.length).padStart(2, '0') + '/' + TOTAL_DISCOVERIES + '</span>';
    /* keep the action buttons element intact while replacing the copy */
    const keep = acts;
    this.el.welcome.innerHTML = info;
    if (keep) this.el.welcome.appendChild(keep);
    if (this.el.wContinue) this.el.wContinue.textContent = t('continue_mission');
    if (this.el.wReplay) this.el.wReplay.textContent = t('replay_arrival');
    if (this.el.wHub) this.el.wHub.textContent = t('go_hub');
    this.el.welcome.classList.add('show');
    this.el.welcome.classList.toggle('choice', !!withChoices);
    if (!withChoices) setTimeout(() => this.el.welcome.classList.remove('show'), 4200);
  }
  /* ---------------- SG MISSION 001 — narrative surface ---------------- */
  setObjective(text) {
    if (!this.el.objective) return;
    this.el.objTag.textContent = t('mission_tag');
    this.el.objText.textContent = text;
    this.el.objective.classList.remove('done');
    this.el.objective.classList.add('show');
  }
  completeObjective(doneText) {
    if (!this.el.objective) return;
    this.el.objText.textContent = doneText || t('obj_done');
    this.el.objective.classList.add('done');
    clearTimeout(this._objT);
    this._objT = setTimeout(() => this.el.objective.classList.remove('show', 'done'), 1900);
  }
  hideObjective() {
    if (!this.el.objective) return;
    clearTimeout(this._objT);
    this.el.objective.classList.remove('show', 'done');
  }
  /* fast diegetic line sequence (boot §4 / visitor §5): total ≤ ~3 s */
  bootSeq(lines, stepMs, holdMs) {
    const bx = this.el.bootseq;
    if (!bx) return;
    bx.innerHTML = '';
    bx.classList.remove('out');
    const els = lines.map(([txt, hi]) => {
      const d = document.createElement('div');
      d.textContent = txt;
      if (hi) d.classList.add('hi');
      bx.appendChild(d);
      return d;
    });
    els.forEach((d, i) => setTimeout(() => d.classList.add('on'), 60 + i * (stepMs || 280)));
    const total = 60 + els.length * (stepMs || 280) + (holdMs == null ? 900 : holdMs);
    clearTimeout(this._bootT);
    this._bootT = setTimeout(() => {
      bx.classList.add('out');
      setTimeout(() => { bx.innerHTML = ''; bx.classList.remove('out'); }, 620);
    }, total);
  }
  infoCard(title, body) {
    if (!this.el.infoCard) return;
    this.el.infoTitle.textContent = title;
    this.el.infoBody.textContent = body;
    this.el.infoCard.hidden = false;
    requestAnimationFrame(() => this.el.infoCard.classList.add('show'));
    clearTimeout(this._infoT);
    this._infoT = setTimeout(() => this.hideInfoCard(), 12000);
  }
  hideInfoCard() {
    if (!this.el.infoCard) return;
    this.el.infoCard.classList.remove('show');
    clearTimeout(this._infoT);
    setTimeout(() => { this.el.infoCard.hidden = true; }, 320);
  }
  setPhotoPreset(k) {
    if (!this.el.photoPresets) return;
    this.el.photoPresets.querySelectorAll('.ps').forEach((b) => b.classList.toggle('on', b.dataset.ps === k));
  }
  applyPresetLabels() {
    if (!this.el.photoPresets) return;
    const map = { natural: t('ps_natural'), film: t('ps_film'), deep: t('ps_deep') };
    this.el.photoPresets.querySelectorAll('.ps').forEach((b) => { b.textContent = map[b.dataset.ps] || b.dataset.ps; });
  }
  revealAction(name) {
    const b = this.el.btns[name];
    if (b) b.classList.remove('hud-hidden');
  }
  hideWelcome() { this.el.welcome.classList.remove('show', 'choice'); }
  loader(text) {
    if (!text) { this.el.loader.classList.remove('show'); return; }
    this.el.loader.textContent = text;
    this.el.loader.classList.add('show');
  }
  debug(text) {
    if (text == null) { this.el.debug.classList.remove('show'); return; }
    this.el.debug.textContent = text;
    this.el.debug.classList.add('show');
  }
  /* V3.3 QA CONTROLS (debug-only): direct jumps to the money shots */
  qaControls(onAction) {
    if (this._qaBar) return;
    const bar = document.createElement('div');
    bar.id = 'qa-controls';
    const BTNS = [
      ['STAGE SEP', 'stagesep'], ['FAIRING SEP', 'fairing'],
      ['EARTH HERO', 'hero'], ['EARTH DEPARTURE', 'departure'],
      ['SELECT GALAXY 1', 'selg1'], ['DOUBLE CLICK GALAXY 1', 'dblg1'],
    ];
    for (const [label, act] of BTNS) {
      const b = document.createElement('button');
      b.className = 'qa-btn hit';
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => onAction(act));
      bar.appendChild(b);
    }
    document.body.appendChild(bar);
    this._qaBar = bar;
  }
  /* V3.4 QA CONTROLS (?qa=v34): every destination of spec §140 + hub §53 */
  qaControlsV34(onAction) {
    if (this._qaBar34) return;
    const bar = document.createElement('div');
    bar.id = 'qa-controls';
    bar.classList.add('v34');
    const BTNS = [
      ['FACILITY HERO', 'facility'], ['COUNTDOWN 5', 'countdown5'], ['COUNTDOWN 1', 'countdown1'],
      ['VOICE ES', 'voicees'], ['VOICE EN', 'voiceen'],
      ['IGNITION', 'ignition'], ['LIFTOFF', 'liftoff'], ['CLOUD BREAK', 'cloudbreak'],
      ['MACH 1', 'mach1'], ['MAX-Q', 'maxq'], ['STRATOSPHERE', 'strato'],
      ['MECO', 'meco'], ['STAGE SEP', 'stagesep'], ['STAGE 2', 'stage2'], ['FAIRING', 'fairing'],
      ['EARTH HERO', 'earthhero'], ['EARTH NIGHT', 'earthnight'], ['ORBITAL SUNRISE', 'sunrise'],
      ['EARTH ORBIT CAM', 'orbitcam'], ['FREE SPACE', 'freespace'], ['FREE FULL DISC', 'freefar'],
      ['FOCUS EARTH', 'focusearth'], ['RESET VIEW', 'resetview'], ['LOCATE MEDELLIN', 'home'],
      ['DEPARTURE 25', 'dep25'], ['DEPARTURE 50', 'dep50'], ['DEPARTURE FULL', 'depfull'],
      ['PRE-WARP', 'prewarp'], ['WARP', 'warp'],
      ['GALAXY HUB', 'hub'], ['HUB ARRIVAL', 'arrival'],
      ['GALAXY 01', 'g1'], ['GALAXY 02', 'g2'], ['GALAXY 03', 'g3'],
      ['SCAN 01', 'scan1'], ['SCAN 02', 'scan2'], ['SCAN 03', 'scan3'],
      ['BLACK HOLE', 'blackhole'], ['SPACE EVENT', 'event'],
      ['PERF', 'perf'], ['RESET QA', 'reset'],
    ];
    for (const [label, act] of BTNS) {
      const b = document.createElement('button');
      b.className = 'qa-btn hit';
      b.type = 'button';
      b.textContent = label;
      b.dataset.qa = act;
      b.addEventListener('click', () => onAction(act));
      bar.appendChild(b);
    }
    document.body.appendChild(bar);
    this._qaBar34 = bar;
  }
  showLite(on) { this.el.lite.classList.toggle('show', on); }

  hideActionButtons(list) {
    ['scan', 'cam', 'photo', 'sky'].forEach((k) => {
      this.el.btns[k].classList.toggle('hud-hidden', !list.includes(k));
    });
  }
  showSkipFlight(on) { this.el.btns.skipFlight.hidden = !on; }
  showSkipIntro(on) { this.el.btns.skipIntro.hidden = !on; }
  soundPressed(on) { this.el.btns.sound.setAttribute('aria-pressed', on ? 'true' : 'false'); }
}
