// One shared WebGL canvas behind the DOM. Pages put a "stage" on it: a 1000x1000
// design box (origin at its centre, y up) that is fitted into a DOM slot. The world
// keeps going outside the box, so backdrops bleed to the screen edges on any aspect.
import * as THREE from 'three';
import gsap from 'gsap';

THREE.ColorManagement.enabled = false; // 2D paper art: colours pass straight through

const canvas = document.getElementById('gl');

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0xcfeaf9, 1);

export const scene = new THREE.Scene();
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.z = 10;

/** Screen-space layers (sky, hills). */
export const backLayer = new THREE.Group();
/** Everything positioned in stage units. */
export const world = new THREE.Group();
scene.add(backLayer, world);

export const BOX = 1000;

/** Current stage mapping, in CSS pixels: screenX = cx + x*scale, screenY = cy - y*scale */
export const view = { w: 1, h: 1, dpr: 1, cx: 0, cy: 0, scale: 1 };

/** Uniforms shared by every screen-space shader. */
export const shared = {
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(1, 1) },
  uOrigin: { value: new THREE.Vector2(0, 0) }, // stage origin in device px, from bottom-left
  uPx: { value: 1 }, // device px per stage unit
};

let stageRect = null;
let clock = 0;
let last = performance.now();
let holds = 0;
let dirty = true;
const frameSubs = new Set();
const resizeSubs = new Set();

function applyStage() {
  const r = stageRect || { left: 0, top: 0, width: view.w, height: view.h };
  view.scale = Math.min(r.width, r.height) / BOX;
  view.cx = r.left + r.width / 2;
  view.cy = r.top + r.height / 2;
  if (r.anchorBottom != null) {
    // tall slot: rest the design box near the bottom so the action sits by the text
    const size = BOX * view.scale;
    view.cy = Math.max(view.cy, r.top + r.height - size / 2 - r.anchorBottom * size);
  }
  camera.left = -view.cx / view.scale;
  camera.right = (view.w - view.cx) / view.scale;
  camera.top = view.cy / view.scale;
  camera.bottom = -(view.h - view.cy) / view.scale;
  camera.updateProjectionMatrix();
  shared.uRes.value.set(view.w * view.dpr, view.h * view.dpr);
  shared.uOrigin.value.set(view.cx * view.dpr, (view.h - view.cy) * view.dpr);
  shared.uPx.value = view.scale * view.dpr;
  dirty = true;
}

/**
 * Fit the design box into a DOM rect (getBoundingClientRect-like).
 * anchorBottom (fraction of the box size): keep the box that far above the rect's bottom
 * edge instead of centring it vertically (only matters when the rect is taller than wide).
 */
export function setStageRect(rect, { anchorBottom = null } = {}) {
  stageRect = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, anchorBottom }
    : null;
  applyStage();
}

/** Visible world bounds in stage units. */
export function bounds() {
  return { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
}

function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(view.dpr);
  renderer.setSize(view.w, view.h, false);
  for (const fn of resizeSubs) fn();
  applyStage();
}

let resizeTimer = 0;
function queueResize() {
  cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(resize);
}
window.addEventListener('resize', queueResize);
window.addEventListener('orientationchange', queueResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', queueResize);

/** Keep rendering every frame until the returned function is called. */
export function hold() {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    dirty = true; // one last frame so the final pose is on screen
  };
}

export const invalidate = () => {
  dirty = true;
};

export function onFrame(fn) {
  frameSubs.add(fn);
  return () => frameSubs.delete(fn);
}

export function onResize(fn) {
  resizeSubs.add(fn);
  return () => resizeSubs.delete(fn);
}

export const now = () => clock;

// We drive GSAP ourselves so tweens, shaders and particles share one clock that
// simply pauses (instead of jumping) when the tab is hidden.
gsap.ticker.remove(gsap.updateRoot);

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  clock += dt;
  gsap.updateRoot(clock);
  if (holds > 0 || dirty) {
    shared.uTime.value = clock;
    for (const fn of frameSubs) fn(dt, clock);
    renderer.render(scene, camera);
    dirty = false;
  }
}

/** Remove and dispose everything a page put on the canvas. */
export function clearLayer(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material && !o.material.userData.shared) o.material.dispose();
      }
    });
  }
  dirty = true;
}

resize();
requestAnimationFrame(frame);

// Dev hook for poking at things from the console.
if (import.meta.env.DEV) window.__gl = { renderer, scene, camera, world, backLayer, view, shared };
