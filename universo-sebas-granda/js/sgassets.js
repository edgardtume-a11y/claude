/* ============================================================================
   UNIVERSO SEBAS GRANDA — sgassets.js (V3 §3/§49/§50)
   Local hero-asset pipeline. 100% OPTIONAL at runtime:
     · probes assets/models/<slot>/<slot>.glb (same-origin, no hotlinking)
     · parses standard glTF 2.0 BINARY (.glb) with embedded buffers —
       positions/normals/uvs/indices + baseColor/metallic/roughness factors
     · if vendor/three-addons/GLTFLoader.js (+DRACO/KTX2/Meshopt) is present,
       it is preferred automatically, enabling compressed assets
     · any failure → the procedural hero built in experience.js stays (§2)
   Nothing here may ever block Mission State (P0 §10 / P0.1 §4).
   ========================================================================== */

const SLOTS = ['rocket', 'tower', 'ship', 'ground', 'vehicles', 'props'];

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch (e) { return false; }
}

/* ------------------------- minimal GLB (glTF 2.0) ------------------------- */
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not GLB');
  const len = dv.getUint32(8, true);
  let off = 12, json = null, bin = null;
  while (off < len) {
    const clen = dv.getUint32(off, true);
    const ctype = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (ctype === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, clen)));
    else if (ctype === 0x004E4942) bin = buf.slice(start, start + clen);
    off = start + clen + (clen % 4 ? 4 - (clen % 4) : 0);
  }
  if (!json) throw new Error('GLB without JSON chunk');
  return { json, bin };
}

function accessorArray(gltf, bin, idx) {
  const acc = gltf.accessors[idx];
  const bv = gltf.bufferViews[acc.bufferView];
  const Arr = COMP[acc.componentType];
  const n = acc.count * SIZE[acc.type];
  const byteOff = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  return new Arr(bin, byteOff, n);
}

/* Build a THREE.Group from a parsed GLB (triangles only, factors-only PBR —
   textures inside GLB are intentionally skipped: hero textures ship as
   material factors or are added when the official GLTFLoader is present). */
function glbToGroup(T, glb) {
  const { json: g, bin } = glb;
  if (!bin) throw new Error('GLB without BIN (external buffers unsupported)');
  const root = new T.Group();
  const meshGroups = (g.meshes || []).map((mesh) => {
    const mg = new T.Group();
    for (const prim of mesh.primitives || []) {
      if (prim.mode != null && prim.mode !== 4) continue;
      const geo = new T.BufferGeometry();
      const pos = accessorArray(g, bin, prim.attributes.POSITION);
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      if (prim.attributes.NORMAL != null) geo.setAttribute('normal', new T.BufferAttribute(accessorArray(g, bin, prim.attributes.NORMAL), 3));
      else geo.computeVertexNormals();
      if (prim.attributes.TEXCOORD_0 != null) geo.setAttribute('uv', new T.BufferAttribute(accessorArray(g, bin, prim.attributes.TEXCOORD_0), 2));
      if (prim.indices != null) {
        const idx = accessorArray(g, bin, prim.indices);
        geo.setIndex ? geo.setIndex(new T.BufferAttribute(idx, 1)) : (geo.index = new T.BufferAttribute(idx, 1));
      }
      let mat = new T.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.6, metalness: 0.3 });
      if (prim.material != null && g.materials && g.materials[prim.material]) {
        const m = g.materials[prim.material];
        const p = m.pbrMetallicRoughness || {};
        const bc = p.baseColorFactor || [0.8, 0.8, 0.8, 1];
        mat = new T.MeshStandardMaterial({
          color: new T.Color(bc[0], bc[1], bc[2]),
          roughness: p.roughnessFactor == null ? 0.6 : p.roughnessFactor,
          metalness: p.metallicFactor == null ? 0.3 : p.metallicFactor,
        });
        if (m.emissiveFactor) mat.emissive = new T.Color(m.emissiveFactor[0], m.emissiveFactor[1], m.emissiveFactor[2]);
      }
      const mesh3 = new T.Mesh(geo, mat);
      mesh3.castShadow = true;
      mesh3.receiveShadow = true;
      mg.add(mesh3);
    }
    return mg;
  });
  const nodes = g.nodes || [];
  const build = (ni) => {
    const n = nodes[ni];
    const o = new T.Group();
    if (n.mesh != null && meshGroups[n.mesh]) o.add(meshGroups[n.mesh].clone ? meshGroups[n.mesh].clone() : meshGroups[n.mesh]);
    if (n.translation) o.position.set(n.translation[0], n.translation[1], n.translation[2]);
    if (n.scale) o.scale.set(n.scale[0], n.scale[1], n.scale[2]);
    if (n.rotation) o.quaternion && o.quaternion.set && Object.assign(o.quaternion, { x: n.rotation[0], y: n.rotation[1], z: n.rotation[2], w: n.rotation[3] });
    for (const c of n.children || []) o.add(build(c));
    return o;
  };
  const scene = g.scenes && g.scenes[g.scene || 0];
  for (const ni of (scene && scene.nodes) || []) root.add(build(ni));
  if (!root.children.length && meshGroups.length) meshGroups.forEach((m) => root.add(m));
  return root;
}

/* ------------------------------ public API ------------------------------- */
export function createAssetPipeline(T, opts) {
  const buildId = (opts && opts.buildId) || '';
  const v = buildId ? '?v=' + buildId : '';
  let officialLoader = null;

  async function tryOfficialLoader() {
    if (officialLoader !== null) return officialLoader;
    officialLoader = false;
    try {
      if (await head('vendor/three-addons/GLTFLoader.js' + v)) {
        const mod = await import(/* @vite-ignore */ './../vendor/three-addons/GLTFLoader.js' + v);
        const loader = new mod.GLTFLoader();
        try {
          if (await head('vendor/three-addons/DRACOLoader.js' + v)) {
            const d = await import(/* @vite-ignore */ './../vendor/three-addons/DRACOLoader.js' + v);
            const dl = new d.DRACOLoader();
            dl.setDecoderPath('vendor/three-addons/draco/');
            loader.setDRACOLoader(dl);
          }
          if (await head('vendor/three-addons/KTX2Loader.js' + v)) {
            const k = await import(/* @vite-ignore */ './../vendor/three-addons/KTX2Loader.js' + v);
            loader.setKTX2Loader(new k.KTX2Loader().setTranscoderPath('vendor/three-addons/basis/'));
          }
          if (await head('vendor/three-addons/meshopt_decoder.module.js' + v)) {
            const mo = await import(/* @vite-ignore */ './../vendor/three-addons/meshopt_decoder.module.js' + v);
            loader.setMeshoptDecoder(mo.MeshoptDecoder);
          }
        } catch (e) { /* compression decoders optional */ }
        officialLoader = loader;
      }
    } catch (e) { officialLoader = false; }
    return officialLoader;
  }

  return {
    /* probe + load one hero slot; resolves a THREE.Group or null (never throws) */
    async load(slot) {
      if (SLOTS.indexOf(slot) < 0) return null;
      const url = 'assets/models/' + slot + '/' + slot + '.glb' + v;
      try {
        if (!(await head(url))) return null;
        const loader = await tryOfficialLoader();
        if (loader) {
          const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
          const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (scene) { scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
          console.log('[SG ASSET] hero ' + slot + ' loaded (GLTFLoader)');
          return scene || null;
        }
        const buf = await (await fetch(url, { cache: 'force-cache' })).arrayBuffer();
        const grp = glbToGroup(T, parseGLB(buf));
        console.log('[SG ASSET] hero ' + slot + ' loaded (built-in GLB parser)');
        return grp;
      } catch (e) {
        console.warn('[SG ASSET] ' + slot + ' unavailable — procedural hero stays:', e && e.message);
        return null;
      }
    },
    slots: SLOTS.slice(),
  };
}
