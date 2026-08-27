/* UNIVERSO SEBAS GRANDA — Earth texture worker (P0.1).
   Runs the geographic generators off the main thread. The worker is 100%
   OPTIONAL: any failure here is absorbed by the main thread's sliced
   fallback (never fatal, never LITE — P0.1 §29).
   Build-coherent imports: the worker URL carries ?v=BUILD and re-applies it
   to its own dependency graph (import maps do not reach module workers). */
const V = (() => {
  try { return new URL(self.location.href).searchParams.get('v') || ''; } catch (e) { return ''; }
})();
const dep = (p) => import(p + (V ? '?v=' + V : ''));

let _mod = null;
async function mod() {
  if (!_mod) _mod = await dep('./celestial.js');
  return _mod;
}

self.onmessage = async (e) => {
  try {
    const { makeEarthMaps } = await mod();
    const size = e.data && e.data.size ? e.data.size : 1024;
    const maps = makeEarthMaps(size, (w, h) => new OffscreenCanvas(w, h));
    const bmp = async (c) => await createImageBitmap(c);
    const out = {
      day: await bmp(maps.day),
      night: await bmp(maps.night),
      clouds: await bmp(maps.clouds),
      spec: await bmp(maps.spec),
    };
    self.postMessage({ ok: true, maps: out }, [out.day, out.night, out.clouds, out.spec]);
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
