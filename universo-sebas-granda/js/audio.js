/* UNIVERSO SEBAS GRANDA — SG AUDIO DIRECTOR.
   100% procedural Web Audio (no copyrighted material, works offline).
   Audio starts only after a valid user gesture (unlock()). */

export class SGAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.unlocked = false;
    this._layers = {};
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0.0;
      this.master.connect(this.ctx.destination);
      this._buildLayers();
      this.unlocked = true;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { /* audio unavailable — continue silently */ }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0.0, this._now(), 0.08);
    }
  }

  _noiseBuffer(seconds, brown) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
      else data[i] = white;
    }
    return buf;
  }

  _loopLayer(brown, filterType, freq, q) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3, brown);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType; filter.frequency.value = freq; filter.Q.value = q || 0.7;
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
    return { src, filter, gain };
  }

  _buildLayers() {
    /* base wind */
    this._layers.wind = this._loopLayer(true, 'lowpass', 420, 0.6);
    /* rain crackle */
    this._layers.rain = this._loopLayer(false, 'bandpass', 2600, 0.4);
    /* engine rumble */
    this._layers.engine = this._loopLayer(true, 'lowpass', 130, 0.8);
    /* engine mid crackle (Brownian band ≈ combustion tearing) */
    this._layers.crackle = this._loopLayer(false, 'bandpass', 900, 0.9);
    /* structural resonance during high load */
    this._layers.reso = this._loopLayer(true, 'bandpass', 62, 6);
    /* water-suppression / deluge steam roar */
    this._layers.water = this._loopLayer(false, 'bandpass', 1500, 0.5);
    /* facility machinery: ventilation hum + transformer buzz */
    const mach = this.ctx.createGain(); mach.gain.value = 0; mach.connect(this.master);
    const hum = this.ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
    const humF = this.ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 240;
    const humG = this.ctx.createGain(); humG.gain.value = 0.05;
    hum.connect(humF); humF.connect(humG); humG.connect(mach); hum.start();
    const vent = this.ctx.createBufferSource(); vent.buffer = this._noiseBuffer(3, true); vent.loop = true;
    const ventF = this.ctx.createBiquadFilter(); ventF.type = 'bandpass'; ventF.frequency.value = 340; ventF.Q.value = 1.1;
    const ventG = this.ctx.createGain(); ventG.gain.value = 0.5;
    vent.connect(ventF); ventF.connect(ventG); ventG.connect(mach); vent.start();
    this._layers.mach = { gain: mach };
    /* engine sub */
    const sub = this.ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = 42;
    const subGain = this.ctx.createGain(); subGain.gain.value = 0;
    sub.connect(subGain); subGain.connect(this.master); sub.start();
    this._layers.sub = { osc: sub, gain: subGain };
    /* interior space pad (soft detuned chord) */
    const padGain = this.ctx.createGain(); padGain.gain.value = 0; padGain.connect(this.master);
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 700; padFilter.connect(padGain);
    [110, 164.8, 220.9].forEach((f) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      o.connect(g); g.connect(padFilter); o.start();
    });
    this._layers.pad = { gain: padGain };
  }

  _set(layer, v, tc) {
    if (!this.unlocked || !this._layers[layer]) return;
    this._layers[layer].gain.gain.setTargetAtTime(Math.max(0, v), this._now(), tc || 0.4);
  }

  setWind(v)   { this._set('wind', v * 0.30, 0.8); }
  setRain(v)   { this._set('rain', v * 0.16, 0.8); }
  setMachinery(v) { this._set('mach', v * 0.22, 1.4); }
  setWater(v)  { this._set('water', v * 0.20, 0.25); }
  setEngine(v) {
    this._set('engine', v * 0.85, 0.15);
    this._set('crackle', v * 0.30, 0.15);
    this._set('reso', v > 0.5 ? (v - 0.5) * 0.5 : 0, 0.3);
    if (this._layers.sub) this._layers.sub.gain.gain.setTargetAtTime(v * 0.5, this._now(), 0.15);
  }
  setPad(v) { this._set('pad', v * 0.9, 1.2); }

  /* distant ground-control radio squelch + murmur (fully procedural) */
  radioBlip() {
    if (!this.unlocked) return;
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5, false);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.03);
    g.gain.setTargetAtTime(0.012, t + 0.08, 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    this._blip(1900, 0.05, 'square', 0.02, 0.44);
  }

  _blip(freq, dur, type, vol, when) {
    if (!this.unlocked) return;
    const t = this._now() + (when || 0);
    const o = this.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  uiBeep()  { this._blip(1180, 0.07, 'sine', 0.05); }
  uiHover() { this._blip(760, 0.05, 'sine', 0.03); }
  countdownTick(n) {
    if (n <= 1) { this._blip(1320, 0.12, 'square', 0.06); this._blip(1320, 0.12, 'square', 0.06, 0.16); }
    else this._blip(880, 0.1, 'square', 0.05);
  }
  discoveryChime() { this._blip(659, 0.16, 'sine', 0.08); this._blip(987, 0.3, 'sine', 0.08, 0.12); }
  lockTone() { this._blip(520, 0.1, 'triangle', 0.05); }
  radarPing() { this._blip(1480, 0.25, 'sine', 0.03); }

  ignitionBoom() {
    if (!this.unlocked) return;
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2.5, true);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 2.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  thunder(delay) {
    if (!this.unlocked) return;
    const t = this._now() + (delay || 0.8);
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3, true);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  warpRiser(dur) {
    if (!this.unlocked) return;
    const t = this._now(); const d = dur || 5;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(d + 1, false);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(3800, t + d);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + d * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + d + 0.6);
  }

  mechClack() {
    if (!this.unlocked) return;
    const t = this._now();
    /* transient click */
    const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = this.ctx.createBufferSource(); src.buffer = n;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const gn = this.ctx.createGain(); gn.gain.setValueAtTime(0.5, t);
    src.connect(hp); hp.connect(gn); gn.connect(this.master);
    src.start(t);
    /* low knock body */
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }
  warpThump() {
    if (!this.unlocked) return;
    const t = this._now();
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.8);
  }
}
