// Small cut-paper shapes drawn on a canvas (hearts, stars, drops, puddles ...).
// They get the same speckled, brushed look as the illustrated art.
import * as THREE from 'three';
import { canvasTexture } from './assets.js';

const cache = new Map();
let speckle = null;

function speckleCanvas() {
  if (speckle) return speckle;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const light = Math.random() < 0.5;
    const v = light ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * (light ? 30 : 22);
  }
  ctx.putImageData(img, 0, 0);
  speckle = c;
  return c;
}

function paperize(ctx, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  // dry-brush streaks
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const light = i % 2 === 0;
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.10)' : 'rgba(40,20,60,0.06)';
    ctx.lineWidth = (0.08 + Math.random() * 0.14) * Math.min(w, h);
    const y = Math.random() * h * 1.2 - h * 0.1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, y);
    ctx.lineTo(w * 1.1, y + (Math.random() - 0.5) * h * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = ctx.createPattern(speckleCanvas(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Cached canvas texture. `draw(ctx, w, h)` paints the shape; the paper finish is added on top.
 */
export function shape(key, w, h, draw, { paper = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  if (paper) paperize(ctx, c.width, c.height);
  const tex = canvasTexture(c);
  cache.set(key, tex);
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // older Safari / WebViews
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function starPath(ctx, cx, cy, spikes, outer, inner, round = 0) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (round) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = round;
    ctx.stroke();
  }
}

export const shapes = {
  disc: (color) =>
    shape(`disc:${color}`, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
    }),

  ellipse: (color, w = 256, h = 96) =>
    shape(`ell:${color}:${w}:${h}`, w, h, (ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }),

  /** soft blob for ground contact shadows (no paper finish) */
  blob: () =>
    shape(
      'blob',
      256,
      96,
      (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(40,28,64,0.55)');
        g.addColorStop(0.6, 'rgba(40,28,64,0.28)');
        g.addColorStop(1, 'rgba(40,28,64,0)');
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(1, h / w);
        ctx.translate(-w / 2, -h / 2);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
      { paper: false },
    ),

  rect: (color, w = 256, h = 128, r = 18) =>
    shape(`rect:${color}:${w}:${h}:${r}`, w, h, (ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      roundRect(ctx, 3, 3, w - 6, h - 6, r);
      ctx.fill();
    }),

  heart: (color = '#ef5b78') =>
    shape(`heart:${color}`, 128, 120, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.94);
      ctx.bezierCurveTo(w * -0.12, h * 0.52, w * 0.12, h * -0.06, w / 2, h * 0.26);
      ctx.bezierCurveTo(w * 0.88, h * -0.06, w * 1.12, h * 0.52, w / 2, h * 0.94);
      ctx.fill();
    }),

  star: (color = '#ffd23f') =>
    shape(`star:${color}`, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      starPath(ctx, w / 2, h / 2 + 3, 5, 52, 25, 12);
      ctx.fill();
    }),

  /** four-point twinkle */
  spark: (color = '#ffffff') =>
    shape(
      `spark:${color}`,
      96,
      96,
      (ctx, w, h) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        const c = w / 2;
        ctx.moveTo(c, 2);
        ctx.quadraticCurveTo(c + 6, c - 6, w - 2, c);
        ctx.quadraticCurveTo(c + 6, c + 6, c, h - 2);
        ctx.quadraticCurveTo(c - 6, c + 6, 2, c);
        ctx.quadraticCurveTo(c - 6, c - 6, c, 2);
        ctx.fill();
      },
      { paper: false },
    ),

  drop: (color = '#6cc4f0') =>
    shape(`drop:${color}`, 80, 112, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(w / 2, 4);
      ctx.bezierCurveTo(w * 0.95, h * 0.5, w * 0.98, h * 0.98, w / 2, h - 3);
      ctx.bezierCurveTo(w * 0.02, h * 0.98, w * 0.05, h * 0.5, w / 2, 4);
      ctx.fill();
    }),

  leaf: (color = '#5fae3f') =>
    shape(`leaf:${color}`, 112, 64, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(4, h / 2);
      ctx.quadraticCurveTo(w * 0.45, -h * 0.25, w - 4, h / 2);
      ctx.quadraticCurveTo(w * 0.45, h * 1.25, 4, h / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(12, h / 2);
      ctx.lineTo(w - 14, h / 2);
      ctx.stroke();
    }),

  /** round puff (dust, smoke, steam) */
  puff: (color = '#ffffff') =>
    shape(`puff:${color}`, 128, 112, (ctx, w, h) => {
      ctx.fillStyle = color;
      for (const [x, y, r] of [
        [0.33, 0.58, 0.26],
        [0.55, 0.42, 0.3],
        [0.72, 0.6, 0.24],
        [0.5, 0.68, 0.26],
      ]) {
        ctx.beginPath();
        ctx.arc(w * x, h * y, w * r, 0, Math.PI * 2);
        ctx.fill();
      }
    }),

  bubble: () =>
    shape(
      'bubble',
      96,
      96,
      (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.ellipse(w * 0.36, h * 0.34, 9, 6, -0.6, 0, Math.PI * 2);
        ctx.fill();
      },
      { paper: false },
    ),

  note: (color = '#6470d2') =>
    shape(`note:${color}`, 96, 128, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(w * 0.36, h * 0.78, 22, 16, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.56, h * 0.76);
      ctx.lineTo(w * 0.56, h * 0.14);
      ctx.quadraticCurveTo(w * 0.8, h * 0.2, w * 0.82, h * 0.42);
      ctx.stroke();
    }),

  zed: (color = '#ffffff') =>
    shape(`zed:${color}`, 96, 96, (ctx, w, h) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(22, 24);
      ctx.lineTo(74, 24);
      ctx.lineTo(22, 72);
      ctx.lineTo(74, 72);
      ctx.stroke();
    }),

  /** short curved "sound" arc, opening to the right */
  arc: (color = '#ffffff') =>
    shape(
      `arc:${color}`,
      64,
      128,
      (ctx, w, h) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-w * 0.9, h / 2, w * 1.6, -0.55, 0.55);
        ctx.stroke();
      },
      { paper: false },
    ),

  /** speed line */
  dash: (color = '#ffffff') =>
    shape(
      `dash:${color}`,
      128,
      16,
      (ctx, w, h) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(8, h / 2);
        ctx.lineTo(w - 8, h / 2);
        ctx.stroke();
      },
      { paper: false },
    ),
};

/** A paper string between two points that can sag (kite line, yo-yo string, leash, noodle). */
export class Rope extends THREE.Mesh {
  constructor({ color = '#ffffff', width = 5, segments = 18, order = 0 } = {}) {
    const geo = new THREE.BufferGeometry();
    const n = (segments + 1) * 2;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    super(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.segments = segments;
    this.width = width;
    this.frustumCulled = false;
    this.renderOrder = order;
  }

  /** Quadratic curve from a to b; `sag` pulls the middle down (stage units). */
  set(ax, ay, bx, by, sag = 0, sideways = 0) {
    const pos = this.geometry.attributes.position;
    const mx = (ax + bx) / 2 + sideways;
    const my = (ay + by) / 2 - sag;
    const hw = this.width / 2;
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const u = 1 - t;
      const x = u * u * ax + 2 * u * t * mx + t * t * bx;
      const y = u * u * ay + 2 * u * t * my + t * t * by;
      let dx = 2 * u * (mx - ax) + 2 * t * (bx - mx);
      let dy = 2 * u * (my - ay) + 2 * t * (by - my);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      pos.setXYZ(i * 2, x - dy * hw, y + dx * hw, 0);
      pos.setXYZ(i * 2 + 1, x + dy * hw, y - dx * hw, 0);
    }
    pos.needsUpdate = true;
  }
}
