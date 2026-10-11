// Paper sprites: a textured quad plus its own soft drop shadow, so stacked pieces
// read as layers of cut paper. The mesh can bend (wind, wobble) and ripple (tails,
// fins, tentacles) in the vertex shader.
import * as THREE from 'three';
import { DEG } from '../core/util.js';

const VERT = /* glsl */ `
uniform vec2 uAnchor;
uniform float uBend;
uniform vec4 uWave;      // amp, freq, phase, -
uniform vec4 uWaveDir;   // phase axis (uv).xy, displacement (local).zw
uniform vec4 uWaveMask;  // mask = pow(clamp(dot(uv, xy) + z, 0, 1), w)
uniform vec2 uShadowOff;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float t = uv.y - uAnchor.y;
  p.x += uBend * t * abs(t);
  if (uWave.x != 0.0) {
    float m = pow(clamp(dot(uv, uWaveMask.xy) + uWaveMask.z, 0.0, 1.0), uWaveMask.w);
    float s = sin(dot(uv, uWaveDir.xy) * uWave.y * 6.2831853 + uWave.z);
    p.xy += uWaveDir.zw * (uWave.x * m * s);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += uShadowOff;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
uniform vec3 uTint;
uniform float uFlash;
uniform vec4 uCrop;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  float inside = step(uCrop.x, vUv.x) * step(vUv.x, uCrop.z) * step(uCrop.y, vUv.y) * step(vUv.y, uCrop.w);
  c *= inside;
  c.rgb = c.rgb * uTint + vec3(uFlash) * c.a;
  gl_FragColor = c * uOpacity;
}`;

const FRAG_SHADOW = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
uniform float uShadowA;
uniform float uBlur;
uniform vec3 uShadowCol;
uniform vec4 uCrop;
varying vec2 vUv;
void main() {
  float inside = step(uCrop.x, vUv.x) * step(vUv.x, uCrop.z) * step(uCrop.y, vUv.y) * step(vUv.y, uCrop.w);
  float a = texture2D(map, vUv, uBlur).a * inside * uShadowA * uOpacity;
  gl_FragColor = vec4(uShadowCol * a, a);
}`;

const baseMat = {
  transparent: true,
  premultipliedAlpha: true,
  depthTest: false,
  depthWrite: false,
};

export const SHADOW = { dx: 5, dy: -8, alpha: 0.26, blur: 3.2, color: [0.17, 0.12, 0.25] };

/** Group with friendly, tweenable 2D props (degrees, stage units). */
export class Node2D extends THREE.Group {
  get x() { return this.position.x; }
  set x(v) { this.position.x = v; }
  get y() { return this.position.y; }
  set y(v) { this.position.y = v; }
  get rot() { return this.rotation.z / DEG; }
  set rot(v) { this.rotation.z = v * DEG; }
  get sx() { return this.scale.x; }
  set sx(v) { this.scale.x = v; }
  get sy() { return this.scale.y; }
  set sy(v) { this.scale.y = v; }
  /** uniform scale (keeps the sign of sx so mirrored nodes stay mirrored) */
  get s() { return this.scale.y; }
  set s(v) {
    this.scale.x = Math.sign(this.scale.x || 1) * Math.abs(v);
    this.scale.y = v;
  }
  at(x, y) {
    this.position.x = x;
    this.position.y = y;
    return this;
  }
  addTo(parent) {
    parent.add(this);
    return this;
  }
}

export class Sprite extends Node2D {
  /**
   * @param {THREE.Texture} texture
   * @param {object} o  w/h (stage units; give one and the other follows the texture aspect),
   *                    anchor [x, y] 0..1 with y up, order, shadow (false | overrides), seg
   */
  constructor(texture, o = {}) {
    super();
    const img = texture.image;
    const aspect = o.aspect || (img ? img.width / img.height : 1);
    let w = o.w;
    let hgt = o.h;
    if (w == null && hgt == null) w = 200;
    if (w == null) w = hgt * aspect;
    if (hgt == null) hgt = w / aspect;
    this.w = w;
    this.h = hgt;
    const [ax, ay] = o.anchor || [0.5, 0.5];
    const seg = o.seg || 1;
    const geo = new THREE.PlaneGeometry(w, hgt, seg, seg);
    geo.translate((0.5 - ax) * w, (0.5 - ay) * hgt, 0);

    const sh = o.shadow === false ? null : { ...SHADOW, ...(o.shadow || {}) };
    this.u = {
      map: { value: texture },
      uOpacity: { value: o.opacity ?? 1 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uFlash: { value: 0 },
      uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
      uAnchor: { value: new THREE.Vector2(ax, ay) },
      uBend: { value: 0 },
      uWave: { value: new THREE.Vector4(0, 1, 0, 0) },
      uWaveDir: { value: new THREE.Vector4(0, 1, 1, 0) },
      uWaveMask: { value: new THREE.Vector4(0, 0, 1, 1) },
      uShadowOff: { value: new THREE.Vector2(0, 0) },
    };

    if (sh) {
      const su = {
        ...this.u,
        uShadowOff: { value: new THREE.Vector2(sh.dx, sh.dy) },
        uShadowA: { value: sh.alpha },
        uBlur: { value: sh.blur },
        uShadowCol: { value: new THREE.Vector3(...sh.color) },
      };
      this.shadowU = su;
      this.shadowMesh = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({ ...baseMat, uniforms: su, vertexShader: VERT, fragmentShader: FRAG_SHADOW }),
      );
      this.shadowMesh.frustumCulled = false;
      this.add(this.shadowMesh);
    }
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ ...baseMat, uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }),
    );
    this.mesh.frustumCulled = false;
    this.add(this.mesh);
    this.order = o.order ?? 0;
  }

  get order() { return this.mesh.renderOrder; }
  set order(v) {
    this.mesh.renderOrder = v;
    if (this.shadowMesh) this.shadowMesh.renderOrder = v - 0.5;
  }
  get opacity() { return this.u.uOpacity.value; }
  set opacity(v) { this.u.uOpacity.value = v; }
  get bend() { return this.u.uBend.value; }
  set bend(v) { this.u.uBend.value = v; }
  get flash() { return this.u.uFlash.value; }
  set flash(v) { this.u.uFlash.value = v; }
  get waveAmp() { return this.u.uWave.value.x; }
  set waveAmp(v) { this.u.uWave.value.x = v; }
  get wavePhase() { return this.u.uWave.value.z; }
  set wavePhase(v) { this.u.uWave.value.z = v; }
  get shadowAlpha() { return this.shadowU ? this.shadowU.uShadowA.value : 0; }
  set shadowAlpha(v) { if (this.shadowU) this.shadowU.uShadowA.value = v; }

  set texture(t) { this.u.map.value = t; }
  get texture() { return this.u.map.value; }

  tint(r, g, b) {
    this.u.uTint.value.set(r, g, b);
    return this;
  }

  /** Only draw the given uv rectangle (0..1, y up). */
  crop(x0, y0, x1, y1) {
    this.u.uCrop.value.set(x0, y0, x1, y1);
    return this;
  }

  /**
   * Ripple preset.
   *  'tail-left'  body faces right, the left end (tail) flaps up and down  (fish, whale)
   *  'hang'       everything below `top` (0..1) sways sideways             (kite tail, tentacles)
   *  'flag'       whole sprite ripples sideways-moving wave                (grass, water)
   */
  wave(kind, { amp = 10, freq = 1, top = 1, power = 1.4 } = {}) {
    const u = this.u;
    u.uWave.value.set(amp, freq, 0, 0);
    if (kind === 'tail-left') {
      u.uWaveDir.value.set(1, 0, 0, 1);
      u.uWaveMask.value.set(-1, 0, 1, power);
    } else if (kind === 'hang') {
      u.uWaveDir.value.set(0, 1, 1, 0);
      u.uWaveMask.value.set(0, -1 / top, 1, power);
    } else {
      u.uWaveDir.value.set(1, 0, 0, 1);
      u.uWaveMask.value.set(0, 0, 1, 1);
    }
    return this;
  }
}
