// Procedural cut-paper backdrops. A "sky" pass fills the screen (gradient, sunburst
// rays, glow, stars, rain, rainbow, wallpaper dots); "strips" are layered paper edges
// (hills, waves, floors) that each cast a soft shadow on whatever lies behind them.
// Everything is anchored in stage units, so it lines up with sprites on any screen.
import * as THREE from 'three';
import { shared, backLayer, clearLayer } from './engine.js';
import { hexToRgb } from '../core/util.js';

const COMMON = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uPx;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
// Hand-painted paper: dry-brush streaks along 'ang', uneven wash, fine grain.
vec3 paper(vec3 col, vec2 q, float ang, float amt) {
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  float streak = fbm(vec2(dot(q, dir) * 0.0030, dot(q, nrm) * 0.034));
  float wash = fbm(q * 0.0040 + 9.7);
  float grain = hash21(floor(gl_FragCoord.xy));
  col *= 1.0 + amt * ((streak - 0.5) * 0.24 + (wash - 0.5) * 0.24);
  col += (grain - 0.5) * 0.028;
  return col;
}
`;

const FULL_VERT = /* glsl */ `
uniform float uTopClip;
void main() {
  vec2 p = position.xy;
  p.y = mix(-1.0, uTopClip, p.y * 0.5 + 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uTop;
uniform vec3 uBot;
uniform vec2 uGrad;     // stage y of bottom / top colour
uniform vec4 uGlow;     // x, y, radius, amount
uniform vec3 uGlowCol;
uniform vec4 uRays;     // x, y, amount, count
uniform vec3 uRayCol;
uniform float uRaySpin;
uniform float uStars;
uniform float uRain;
uniform vec4 uBow;      // x, y, radius, reveal 0..1
uniform float uDots;
uniform vec3 uDotCol;
uniform float uVig;

vec3 bowColor(float i) {
  if (i < 0.5) return vec3(0.914, 0.322, 0.235);
  if (i < 1.5) return vec3(0.949, 0.545, 0.188);
  if (i < 2.5) return vec3(0.957, 0.722, 0.122);
  if (i < 3.5) return vec3(0.435, 0.702, 0.290);
  if (i < 4.5) return vec3(0.247, 0.576, 0.839);
  if (i < 5.5) return vec3(0.392, 0.439, 0.824);
  return vec3(0.612, 0.376, 0.776);
}

void main() {
  vec2 q = (gl_FragCoord.xy - uOrigin) / uPx;
  float t = clamp((q.y - uGrad.x) / (uGrad.y - uGrad.x), 0.0, 1.0);
  vec3 col = mix(uBot, uTop, t * t * (3.0 - 2.0 * t));

  if (uDots > 0.0) {
    vec2 g = q / 130.0;
    g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
    float d = length(fract(g) - 0.5);
    col = mix(col, uDotCol, smoothstep(0.17, 0.15, d) * uDots);
  }

  if (uRays.z > 0.0) {
    vec2 d = q - uRays.xy;
    float r = length(d) + 0.001;
    float w = fract(atan(d.y, d.x) / 6.2831853 * uRays.w + uTime * uRaySpin);
    float ew = clamp(uRays.w / (6.2831853 * r * uPx) * 1.5, 0.0005, 0.25);
    float ray = smoothstep(0.0, ew, w) * (1.0 - smoothstep(0.5, 0.5 + ew, w));
    col = mix(col, uRayCol, ray * uRays.z * smoothstep(40.0, 160.0, r));
  }

  if (uGlow.w > 0.0) {
    float g = 1.0 - smoothstep(0.0, uGlow.z, length(q - uGlow.xy));
    col = mix(col, uGlowCol, g * g * uGlow.w);
  }

  if (uStars > 0.0) {
    vec2 g = q / 95.0;
    vec2 id = floor(g);
    float rnd = hash21(id);
    vec2 off = (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5) * 0.7;
    float d = length(fract(g) - 0.5 - off);
    float tw = 0.62 + 0.38 * sin(uTime * (1.2 + rnd * 2.4) + rnd * 40.0);
    float size = 0.035 + 0.055 * rnd;
    float s = smoothstep(size, size * 0.35, d) * step(0.42, rnd) * tw;
    col = mix(col, vec3(1.0, 0.96, 0.78), s * uStars);
  }

  if (uBow.w > 0.0) {
    vec2 d = q - uBow.xy;
    float r = length(d);
    float band = (uBow.z - r) / (uBow.z * 0.34);
    float ang = atan(d.y, d.x);
    float aa = 1.2 / uPx / (uBow.z * 0.34);
    float inBand = smoothstep(0.0, aa, band) * (1.0 - smoothstep(1.0 - aa, 1.0, band));
    float sweep = smoothstep(0.0, 0.03, ang - 3.14159265 * (1.0 - uBow.w)) * step(0.0, d.y);
    vec3 bc = bowColor(floor(clamp(band, 0.0, 0.999) * 7.0));
    float edge = fract(clamp(band, 0.0, 0.999) * 7.0);
    bc *= 0.94 + 0.10 * smoothstep(0.0, 0.5, edge);
    col = mix(col, bc, inBand * sweep);
  }

  if (uRain > 0.0) {
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      float cw = 58.0 - fk * 20.0;
      float u = q.x + q.y * 0.16 + fk * 23.0;
      float c = floor(u / cw);
      float rnd = hash21(vec2(c, fk * 9.1));
      float fall = fract((q.y + uTime * (1100.0 + 500.0 * rnd)) / 340.0 + rnd * 7.0);
      float len = smoothstep(0.0, 0.03, fall) * (1.0 - smoothstep(0.17, 0.2, fall));
      float xx = abs(fract(u / cw) - 0.5 - (rnd - 0.5) * 0.6);
      float wid = 1.0 - smoothstep(1.4 / cw, 2.6 / cw, xx);
      col = mix(col, vec3(0.93, 0.97, 1.0), len * wid * uRain * (0.75 - fk * 0.3));
    }
  }

  col = paper(col, q, 0.12, 0.34);
  vec2 uv = gl_FragCoord.xy / uRes;
  float v = smoothstep(0.95, 0.3, length(uv - 0.5));
  col *= mix(1.0 - uVig, 1.0, v);
  gl_FragColor = vec4(col, 1.0);
}`;

const STRIP_FRAG = /* glsl */ `
${COMMON}
uniform vec4 uShape;   // baseY, amplitude, frequency, seed
uniform vec3 uCol;
uniform vec3 uCol2;
uniform float uSpeed;
uniform float uShadow;
uniform float uStroke;
uniform float uFoam;
uniform float uFlat;   // 1 = straight edge
uniform float uOpacity;

float height(float x) {
  float t = uTime * uSpeed;
  float f = uShape.z;
  float s = uShape.w;
  return uShape.x + uShape.y * (1.0 - uFlat) * (
    0.55 * sin(x * f + s + t) +
    0.28 * sin(x * f * 2.17 + s * 1.7 - t * 0.6) +
    0.42 * sin(x * f * 0.43 + s * 2.9 + t * 0.3));
}

void main() {
  vec2 q = (gl_FragCoord.xy - uOrigin) / uPx;
  float d = q.y - height(q.x);
  float aa = 0.9 / uPx;
  float inside = smoothstep(aa, -aa, d);
  float sh = uShadow * exp(-max(d, 0.0) / 15.0) * (1.0 - inside);
  vec3 col = mix(uCol, uCol2, clamp(-d / 460.0, 0.0, 1.0));
  col *= 1.0 + 0.06 * smoothstep(-110.0, 0.0, d);
  col = paper(col, q, uStroke, 1.0);
  col = mix(col, vec3(1.0), uFoam * smoothstep(-16.0, -3.0, d));
  vec3 shadowCol = vec3(0.14, 0.10, 0.24);
  float a = inside + sh;
  gl_FragColor = vec4(col * inside + shadowCol * sh, a) * uOpacity;
}`;

const quad = new THREE.PlaneGeometry(2, 2);
quad.userData.shared = true;

const v3 = (hex) => new THREE.Vector3(...hexToRgb(hex));

const DEFAULT_SKY = {
  top: '#8fd0f5',
  bot: '#e4f5fc',
  y0: -200,
  y1: 620,
  glow: null, // { x, y, r, a, color }
  rays: null, // { x, y, a, n, color, spin }
  stars: 0,
  rain: 0,
  bow: null, // { x, y, r, reveal }
  dots: null, // { a, color }
  vig: 0.14,
};

export class Backdrop {
  constructor(config = {}) {
    const s = { ...DEFAULT_SKY, ...(config.sky || {}) };
    this.u = {
      ...shared,
      uTopClip: { value: 1 },
      uTop: { value: v3(s.top) },
      uBot: { value: v3(s.bot) },
      uGrad: { value: new THREE.Vector2(s.y0, s.y1) },
      uGlow: { value: new THREE.Vector4(s.glow?.x ?? 0, s.glow?.y ?? 0, s.glow?.r ?? 400, s.glow?.a ?? 0) },
      uGlowCol: { value: v3(s.glow?.color ?? '#fff6c8') },
      uRays: { value: new THREE.Vector4(s.rays?.x ?? 0, s.rays?.y ?? 0, s.rays?.a ?? 0, s.rays?.n ?? 12) },
      uRayCol: { value: v3(s.rays?.color ?? '#ffffff') },
      uRaySpin: { value: s.rays?.spin ?? 0.012 },
      uStars: { value: s.stars },
      uRain: { value: s.rain },
      uBow: { value: new THREE.Vector4(s.bow?.x ?? 0, s.bow?.y ?? -300, s.bow?.r ?? 620, s.bow?.reveal ?? 0) },
      uDots: { value: s.dots?.a ?? 0 },
      uDotCol: { value: v3(s.dots?.color ?? '#ffffff') },
      uVig: { value: s.vig },
    };
    this.sky = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        vertexShader: FULL_VERT,
        fragmentShader: SKY_FRAG,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    backLayer.add(this.sky);

    this.strips = (config.strips || []).map((c, i) => this.addStrip(c, i));
  }

  /**
   * @param c { y, amp, freq, seed, color, color2, speed, shadow, stroke, foam, order, flat }
   */
  addStrip(c, i = this.strips ? this.strips.length : 0) {
    const u = {
      ...shared,
      uTopClip: { value: 1 },
      uShape: { value: new THREE.Vector4(c.y, c.amp ?? 40, c.freq ?? 0.004, c.seed ?? i * 2.7 + 1) },
      uCol: { value: v3(c.color) },
      uCol2: { value: v3(c.color2 ?? c.color) },
      uSpeed: { value: c.speed ?? 0 },
      uShadow: { value: c.shadow ?? 0.26 },
      uStroke: { value: c.stroke ?? 0.2 + i * 0.5 },
      uFoam: { value: c.foam ?? 0 },
      uFlat: { value: c.flat ? 1 : 0 },
      uOpacity: { value: 1 },
    };
    const mesh = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: FULL_VERT,
        fragmentShader: STRIP_FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = c.order ?? -900 + i * 10;
    mesh.onBeforeRender = () => {
      // Only shade the part of the screen this strip can touch.
      const top = u.uShape.value.x + Math.abs(u.uShape.value.y) * 1.3 + 70;
      const clip = ((shared.uOrigin.value.y + top * shared.uPx.value) / shared.uRes.value.y) * 2 - 1;
      u.uTopClip.value = Math.min(1, Math.max(-1, clip));
    };
    backLayer.add(mesh);
    const strip = { mesh, u, shape: u.uShape.value };
    if (this.strips) this.strips.push(strip);
    return strip;
  }

  // Tweenable handles ------------------------------------------------------
  get glow() { return this.u.uGlow.value; }       // .x .y .z(radius) .w(amount)
  get rays() { return this.u.uRays.value; }       // .z = amount
  get bow() { return this.u.uBow.value; }         // .w = reveal
  get top() { return this.u.uTop.value; }         // .x .y .z = r g b
  get bot() { return this.u.uBot.value; }
  get glowColor() { return this.u.uGlowCol.value; }
  get stars() { return this.u.uStars.value; }
  set stars(v) { this.u.uStars.value = v; }
  get rain() { return this.u.uRain.value; }
  set rain(v) { this.u.uRain.value = v; }

  static clear() {
    clearLayer(backLayer);
  }
}

/** { r, g, b } target for tweening a colour uniform (a Vector3): gsap.to(bd.top, rgb('#123456')) */
export function rgb(hex) {
  const [x, y, z] = hexToRgb(hex);
  return { x, y, z };
}

// ------------------------------------------------------------- presets ----

export const SCENES = {
  meadow: () => ({
    sky: { top: '#86cdf5', bot: '#e6f6fd', y0: -260, y1: 640 },
    strips: [
      { y: -150, amp: 70, freq: 0.0030, seed: 1.3, color: '#bfe39a', color2: '#a9d884', shadow: 0.16 },
      { y: -235, amp: 46, freq: 0.0044, seed: 4.1, color: '#9cd476', color2: '#86c765', shadow: 0.2 },
      { y: -300, amp: 16, freq: 0.0060, seed: 7.7, color: '#7fc45c', color2: '#69b24c', shadow: 0.24, order: -100 },
    ],
  }),
  park: () => ({
    sky: { top: '#8fd3f6', bot: '#eaf8fd', y0: -260, y1: 640 },
    strips: [
      { y: -170, amp: 52, freq: 0.0034, seed: 2.2, color: '#c9e8a4', color2: '#b5dd8d', shadow: 0.15 },
      { y: -300, amp: 12, freq: 0.0050, seed: 5.5, color: '#8ccb68', color2: '#74b955', shadow: 0.22, order: -100 },
    ],
  }),
  room: (wall = '#fbe3c4', floor = '#d9a066', floor2 = '#c98d56') => ({
    sky: { top: wall, bot: wall, dots: { a: 0.42, color: '#ffffff' }, vig: 0.16 },
    strips: [
      { y: -196, flat: true, color: '#fff6e6', shadow: 0.12 },
      { y: -232, flat: true, color: floor, color2: floor2, shadow: 0.2, stroke: 0.02, order: -100 },
    ],
  }),
  night: () => ({
    sky: { top: '#1b2452', bot: '#3f4f96', y0: -260, y1: 620, stars: 1, vig: 0.22 },
    strips: [
      { y: -160, amp: 64, freq: 0.0032, seed: 3.1, color: '#34447f', color2: '#2c3a70', shadow: 0.25 },
      { y: -245, amp: 40, freq: 0.0046, seed: 6.4, color: '#2a3769', color2: '#243060', shadow: 0.28 },
      { y: -300, amp: 14, freq: 0.0060, seed: 8.8, color: '#27405f', color2: '#1f3350', shadow: 0.3, order: -100 },
    ],
  }),
  sea: () => ({
    sky: { top: '#8fd3f6', bot: '#eefaff', y0: -200, y1: 640 },
    strips: [
      { y: -150, amp: 15, freq: 0.012, seed: 1.1, color: '#7cc6e8', color2: '#5fb0d8', speed: 0.9, shadow: 0.14, foam: 0.5 },
      { y: -215, amp: 17, freq: 0.010, seed: 3.3, color: '#55aee0', color2: '#3f97cf', speed: -1.1, shadow: 0.18, foam: 0.5, order: -100 },
      { y: -290, amp: 19, freq: 0.009, seed: 5.2, color: '#3d95d2', color2: '#2a7fc0', speed: 1.3, shadow: 0.2, foam: 0.5, order: 200 },
      { y: -372, amp: 20, freq: 0.008, seed: 7.9, color: '#2b80c2', color2: '#1f6aa8', speed: -1.0, shadow: 0.22, foam: 0.45, order: 210 },
    ],
  }),
  underwater: () => ({
    sky: {
      top: '#58b9e6', bot: '#1f6fae', y0: -420, y1: 520,
      rays: { x: -160, y: 1500, a: 0.11, n: 26, color: '#ffffff', spin: 0.004 },
      vig: 0.24,
    },
    strips: [
      { y: -140, amp: 44, freq: 0.0036, seed: 2.5, color: '#2f8fc4', color2: '#2780b6', shadow: 0.14 },
      { y: -246, amp: 20, freq: 0.0050, seed: 6.1, color: '#f2d79a', color2: '#e3c07d', shadow: 0.22, order: -100 },
    ],
  }),
  savanna: () => ({
    sky: { top: '#ffcf7a', bot: '#fff1c9', y0: -260, y1: 640, glow: { x: 260, y: 300, r: 620, a: 0.5, color: '#fff3c4' } },
    strips: [
      { y: -160, amp: 46, freq: 0.0026, seed: 1.9, color: '#f3c56f', color2: '#e9b85f', shadow: 0.15 },
      { y: -240, amp: 30, freq: 0.0040, seed: 4.6, color: '#e9b257', color2: '#dca548', shadow: 0.2 },
      { y: -300, amp: 12, freq: 0.0055, seed: 7.3, color: '#d9a044', color2: '#c98f38', shadow: 0.24, order: -100 },
    ],
  }),
  rainy: () => ({
    sky: { top: '#8ea4bd', bot: '#cfdbe6', y0: -260, y1: 640, rain: 1, vig: 0.2 },
    strips: [
      { y: -170, amp: 56, freq: 0.0032, seed: 2.8, color: '#a9c9a2', color2: '#98bd92', shadow: 0.16 },
      { y: -300, amp: 12, freq: 0.0050, seed: 5.9, color: '#86b57c', color2: '#74a56c', shadow: 0.22, order: -100 },
    ],
  }),
  road: () => ({
    sky: { top: '#86cdf5', bot: '#e6f6fd', y0: -260, y1: 640 },
    strips: [
      { y: -120, amp: 60, freq: 0.0030, seed: 1.3, color: '#bfe39a', color2: '#a9d884', shadow: 0.16 },
      { y: -205, amp: 30, freq: 0.0044, seed: 4.1, color: '#9cd476', color2: '#86c765', shadow: 0.2 },
      { y: -262, flat: true, color: '#8a8f9c', color2: '#787d8a', shadow: 0.2, stroke: 0.02, order: -100 },
      { y: -400, flat: true, color: '#7fc45c', color2: '#69b24c', shadow: 0.18, order: 205 },
    ],
  }),
  /** flat coloured page with a soft paper sunburst (word pages) */
  burst: (bg, ray, dark = false) => ({
    sky: {
      top: bg, bot: bg,
      rays: { x: 0, y: 0, a: dark ? 0.16 : 0.5, n: 14, color: ray, spin: 0.01 },
      glow: { x: 0, y: 0, r: 520, a: dark ? 0.28 : 0.75, color: dark ? '#6f7fd0' : '#ffffff' },
      stars: dark ? 0.9 : 0,
      vig: dark ? 0.3 : 0.16,
    },
    strips: [],
  }),
};
