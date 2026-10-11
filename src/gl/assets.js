import * as THREE from 'three';
import ART from '../data/art.json';
import { BASE } from '../core/util.js';

const loader = new THREE.TextureLoader();
const cache = new Map(); // name -> { promise, tex, pinned }

function prepare(tex) {
  tex.premultiplyAlpha = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Pixel size of a sprite as shipped (known before it loads). */
export const artSize = (name) => ART[name] || { w: 256, h: 256 };
export const hasArt = (name) => !!ART[name];
export const artUrl = (name) => `${BASE}art/${name}.webp`;
export const thumbUrl = (name) => `${BASE}art/thumb/${name}.webp`;

export function loadTex(name, pinned = false) {
  let entry = cache.get(name);
  if (!entry) {
    entry = { tex: null, pinned };
    entry.promise = loader
      .loadAsync(artUrl(name))
      .then((tex) => {
        entry.tex = prepare(tex);
        return entry.tex;
      })
      .catch((err) => {
        cache.delete(name);
        throw new Error(`art "${name}" failed to load: ${err?.message || err}`);
      });
    cache.set(name, entry);
  }
  if (pinned) entry.pinned = true;
  return entry.promise;
}

export const loadAll = (names, pinned = false) => Promise.all(names.map((n) => loadTex(n, pinned)));

/** Synchronous access once loaded. */
export function tex(name) {
  const entry = cache.get(name);
  if (!entry || !entry.tex) throw new Error(`art "${name}" is not loaded`);
  return entry.tex;
}

/** Free GPU memory for art that is not shared between pages. */
export function release(names) {
  for (const name of names) {
    const entry = cache.get(name);
    if (!entry || entry.pinned) continue;
    cache.delete(name);
    entry.promise.then((t) => t.dispose()).catch(() => {});
  }
}

export function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  return prepare(tex);
}
