// How each word's picture behaves on its word page: how it arrives (always from
// the left edge of the screen), what it does while waiting, and what it does
// when the child taps it or its word.
//
// The picture sits in three nested nodes so motions never fight each other:
//   mover  - position (arrivals, jumps, dashes)
//   rocker - rotation and squash, pivoting at the feet or at the centre
//   hero   - the sprite itself (bend, ripples, a wagging tail, spins)
import gsap from 'gsap';
import { shapes } from '../gl/shapes.js';
import { rand } from '../core/util.js';

/*
 * pivot  'bottom' (stands on the ground) | 'center' (rolls / spins / floats)
 * enter  run | trot | hop | gallop | roll | bounce | swim | fly | glide | slide | drive | sweep | waddle
 * idle   sway | bob | wobble | swim | flutter | float | tentacles | steam | spin | engine
 * act    hop | hop2 | spin | bounce | wobble | dash | flip | jelly | soar | roar | twinkle | steam
 *        | wave | curtsy | sweep | shine | hug | open | honk | spout | yoyo | gallop
 * tail   [u, v, radius, dx, dy]: a patch of the picture that wags (uv, y up)
 * mouth  [u, v] where puffs / bubbles / sounds come from
 */
export const MOTIONS = {
  a: { pivot: 'center', enter: 'roll', idle: 'bob', act: 'spin' },
  b: { pivot: 'center', enter: 'bounce', idle: 'bob', act: 'bounce' },
  c: { enter: 'trot', idle: 'sway', act: 'hop', tail: [0.87, 0.24, 0.2, 1, 0.2] },
  d: { enter: 'run', idle: 'sway', act: 'hop', tail: [0.1, 0.76, 0.18, 1, 0.35], mouth: [0.86, 0.55] },
  e: { enter: 'waddle', idle: 'wobble', act: 'wobble' },
  f: { pivot: 'center', enter: 'swim', idle: 'swim', act: 'dash', ripple: 'tail-left', mouth: [0.96, 0.5] },
  g: { enter: 'trot', idle: 'sway', act: 'hop', tail: [0.08, 0.67, 0.11, 1, 0.3] },
  h: { pivot: 'center', enter: 'fly', idle: 'sway', act: 'flip' },
  i: { enter: 'slide', idle: 'sway', act: 'jelly' },
  j: { enter: 'slide', idle: 'bob', act: 'jelly', bubbles: [0.22, 0.95] },
  k: { pivot: 'center', enter: 'fly', idle: 'flutter', act: 'soar', ripple: 'hang', hangTop: 0.44 },
  l: { enter: 'trot', idle: 'sway', act: 'roar', tail: [0.86, 0.36, 0.17, 1, 0], extra: 'lion_roar' },
  m: { pivot: 'center', enter: 'glide', idle: 'float', act: 'twinkle' },
  n: { enter: 'slide', idle: 'steam', act: 'steam' },
  o: { pivot: 'center', enter: 'swim', idle: 'tentacles', act: 'wave', ripple: 'hang', hangTop: 0.56 },
  p: { enter: 'trot', idle: 'sway', act: 'hop2', tail: [0.07, 0.72, 0.11, 1, 0.3] },
  q: { enter: 'glide', idle: 'sway', act: 'curtsy' },
  r: { enter: 'sweep', idle: 'bob', act: 'sweep' },
  s: { pivot: 'center', enter: 'roll', idle: 'spin', act: 'shine' },
  t: { enter: 'hop', idle: 'sway', act: 'hug' },
  u: { enter: 'fly', idle: 'sway', act: 'open', extra: 'umbrella_closed' },
  v: { enter: 'drive', idle: 'engine', act: 'honk' },
  w: { pivot: 'center', enter: 'swim', idle: 'swim', act: 'spout', ripple: 'tail-left', blowhole: [0.62, 0.86] },
  x: { enter: 'hop', idle: 'sway', act: 'hop', tail: [0.82, 0.3, 0.25, 1, 0] },
  y: { pivot: 'center', enter: 'hop', idle: 'bob', act: 'yoyo' },
  z: { enter: 'gallop', idle: 'sway', act: 'gallop', tail: [0.1, 0.37, 0.14, 1, 0.3] },
};

const MUD = ['#7a4c31', '#9a6441'];

/**
 * @param id letter id
 * @param r rig: { mover, rocker, hero, extraSprite, w, h, startX, fx, sfx, glow }
 */
export function createMotion(id, r) {
  const M = MOTIONS[id] || { enter: 'slide', idle: 'bob', act: 'jelly' };
  const { mover, rocker, hero, fx, sfx } = r;
  const w = r.w;
  const h = r.h;
  const center = M.pivot === 'center';
  // a point on the picture (uv, y up) in the coordinates of the particles layer
  const at = (u, v) => ({ x: r.baseX + mover.x + (u - 0.5) * w, y: r.baseY + mover.y + v * h });

  // ------------------------------------------------- continuous effects ----
  const live = { wagSpeed: 5, wagAmp: 0, ripple: 0, rippleSpeed: 0, spin: 0, steam: 0, engine: 0 };
  if (M.tail) {
    const [u, v, rad, dx, dy] = M.tail;
    hero.tail(u, v, rad, dx, dy);
  }
  if (M.ripple === 'tail-left') hero.wave('tail-left', { amp: 0, freq: 0.9, power: 1.7 });
  if (M.ripple === 'hang') hero.wave('hang', { amp: 0, freq: 1.2, top: M.hangTop, power: 1.15 });
  let steamClock = 0;
  let engineClock = 0;

  function update(dt, t) {
    if (M.tail) {
      hero.wagPhase += dt * live.wagSpeed;
      hero.wagAmp += (live.wagAmp - hero.wagAmp) * Math.min(1, dt * 6);
    }
    if (M.ripple) {
      hero.wavePhase += dt * (M.ripple === 'tail-left' ? -live.rippleSpeed : live.rippleSpeed);
      hero.waveAmp += (live.ripple - hero.waveAmp) * Math.min(1, dt * 4);
    }
    if (live.spin) hero.rot -= live.spin * dt;
    if (live.steam) {
      steamClock -= dt;
      if (steamClock <= 0) {
        steamClock = 1.1;
        const p = at(rand(0.38, 0.62), 0.82);
        fx.puffs(p.x, p.y, 2, { size: 70, vy: 80, spread: 20, alpha: 0.5 });
      }
    }
    if (live.engine) {
      engineClock -= dt;
      if (engineClock <= 0) {
        engineClock = 1.4;
        const p = at(0.02, 0.18);
        fx.puffs(p.x, p.y, 1, { size: 60, vx: -90, vy: 30, alpha: 0.55, color: '#f2f2f2' });
      }
    }
  }

  // ------------------------------------------------------------ helpers ----
  function squash(tl, t, amount = 0.14, settle = 0.5) {
    tl.to(rocker.scale, { x: 1 + amount, y: 1 - amount, duration: 0.08, ease: 'power2.out' }, t);
    tl.to(rocker.scale, { x: 1, y: 1, duration: settle, ease: 'elastic.out(1.1, 0.35)' }, t + 0.08);
  }

  /** squash, leap, land: returns the landing time */
  function leap(tl, t, height = 90, up = 0.22, down = 0.2) {
    tl.to(rocker.scale, { x: 1.12, y: 0.88, duration: 0.09, ease: 'power2.out' }, t);
    tl.to(rocker.scale, { x: 0.94, y: 1.08, duration: 0.1 }, t + 0.09);
    tl.to(mover, { y: height, duration: up, ease: 'power2.out' }, t + 0.09);
    tl.to(mover, { y: 0, duration: down, ease: 'power2.in' }, t + 0.09 + up);
    squash(tl, t + 0.09 + up + down, 0.12, 0.45);
    return t + 0.09 + up + down;
  }

  function wagBurst(tl, t, seconds = 1.2) {
    if (!M.tail) return;
    tl.call(() => { live.wagSpeed = 26; live.wagAmp = w * 0.045; }, null, t);
    tl.call(() => { live.wagSpeed = 6; live.wagAmp = w * 0.016; }, null, t + seconds);
  }

  /** a series of hops across the arrival: n hops, height, lean */
  function hops(tl, t, D, n, height, lean, dust = false) {
    const step = D / n;
    for (let i = 0; i < n; i++) {
      const s = t + i * step;
      tl.to(mover, { y: height, duration: step * 0.45, ease: 'sine.out' }, s);
      tl.to(mover, { y: 0, duration: step * 0.45, ease: 'sine.in' }, s + step * 0.45);
      tl.to(rocker, { rot: i % 2 ? lean * 0.5 : -lean, duration: step * 0.9, ease: 'sine.inOut' }, s);
      if (dust) tl.call(() => { const p = at(0.2, 0.02); fx.puffs(p.x, p.y, 1, { size: 70, vx: -160, vy: 30, alpha: 0.6, color: '#fff8ea' }); }, null, s + step * 0.9);
      if (i % 2 === 0) tl.call(() => sfx.tap(), null, s + step * 0.9);
    }
    tl.to(rocker, { rot: 0, duration: 0.25, ease: 'sine.out' }, t + D);
  }

  // ------------------------------------------------------------ arrivals ----
  const ENTER = {
    run(tl, t) {
      const D = 1.15;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      hops(tl, t, D, 5, 40, 7, true);
      wagBurst(tl, t, D + 0.4);
      squash(tl, t + D, 0.14);
      return D + 0.3;
    },
    trot(tl, t) {
      const D = 1.4;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'sine.out' }, t);
      hops(tl, t, D, 4, 28, 5);
      wagBurst(tl, t, D);
      return D + 0.2;
    },
    gallop(tl, t) {
      const D = 1.05;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      hops(tl, t, D, 6, 32, 8, true);
      wagBurst(tl, t, D);
      squash(tl, t + D, 0.1);
      return D + 0.3;
    },
    hop(tl, t) {
      const D = 1.35;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power1.inOut' }, t);
      for (let i = 0; i < 3; i++) {
        const s = t + i * (D / 3);
        tl.to(mover, { y: 90, duration: D / 6, ease: 'power2.out' }, s);
        tl.to(mover, { y: 0, duration: D / 6, ease: 'power2.in' }, s + D / 6);
        squash(tl, s + D / 3, 0.12, 0.3);
        tl.call(() => sfx.pop(1 + i * 0.12), null, s + D / 3);
      }
      wagBurst(tl, t, D);
      return D + 0.3;
    },
    roll(tl, t) {
      const D = 1.35;
      const turns = (-r.startX / (Math.min(w, h) * 0.5)) * (180 / Math.PI);
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      tl.fromTo(rocker, { rot: turns }, { rot: 0, duration: D, ease: 'power2.out' }, t);
      tl.to(rocker, { rot: -9, duration: 0.18, ease: 'sine.out' }, t + D);
      tl.to(rocker, { rot: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, t + D + 0.18);
      return D + 0.5;
    },
    waddle(tl, t) {
      const D = 1.4;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      for (let i = 0; i < 6; i++) {
        tl.to(rocker, { rot: i % 2 ? 16 : -16, duration: D / 6, ease: 'sine.inOut' }, t + (i * D) / 6);
      }
      tl.to(rocker, { rot: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' }, t + D);
      return D + 0.4;
    },
    bounce(tl, t) {
      const D = 1.5;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power1.out' }, t);
      tl.fromTo(rocker, { rot: 300 }, { rot: 0, duration: D, ease: 'power1.out' }, t);
      const arcs = [[0, 300, 0.42], [1, 170, 0.36], [2, 70, 0.26]];
      let s = t;
      tl.set(mover, { y: 300 }, t);
      tl.to(mover, { y: 0, duration: 0.32, ease: 'power2.in' }, s);
      s += 0.32;
      for (const [, hgt, dur] of arcs.slice(1)) {
        squash(tl, s, 0.18, 0.2);
        tl.call(() => sfx.boing(), null, s);
        tl.to(mover, { y: hgt, duration: dur / 2, ease: 'power2.out' }, s + 0.04);
        tl.to(mover, { y: 0, duration: dur / 2, ease: 'power2.in' }, s + 0.04 + dur / 2);
        s += 0.04 + dur;
      }
      squash(tl, s, 0.12, 0.4);
      return Math.max(D, s - t) + 0.3;
    },
    swim(tl, t) {
      const D = 1.7;
      tl.call(() => { live.ripple = Math.max(w, h) * 0.03; live.rippleSpeed = 11; }, null, t);
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'sine.out' }, t);
      tl.fromTo(mover, { y: 60 }, { y: -40, duration: D / 3, ease: 'sine.inOut' }, t);
      tl.to(mover, { y: 40, duration: D / 3, ease: 'sine.inOut' }, t + D / 3);
      tl.to(mover, { y: 0, duration: D / 3, ease: 'sine.inOut' }, t + (2 * D) / 3);
      tl.to(rocker, { rot: -8, duration: D / 3, ease: 'sine.inOut' }, t);
      tl.to(rocker, { rot: 8, duration: D / 3, ease: 'sine.inOut' }, t + D / 3);
      tl.to(rocker, { rot: 0, duration: D / 3, ease: 'sine.inOut' }, t + (2 * D) / 3);
      for (let i = 0; i < 4; i++) {
        tl.call(() => { const p = at(M.mouth ? M.mouth[0] : 0.9, M.mouth ? M.mouth[1] : 0.6); fx.bubbles(p.x, p.y, 2, { size: 30, spreadX: 20 }); sfx.drip(); }, null, t + 0.3 + i * 0.35);
      }
      return D + 0.2;
    },
    fly(tl, t) {
      const D = 1.6;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      tl.fromTo(mover, { y: 260 }, { y: 0, duration: D, ease: 'sine.inOut' }, t);
      tl.fromTo(rocker, { rot: 18 }, { rot: -12, duration: D * 0.5, ease: 'sine.inOut' }, t);
      tl.to(rocker, { rot: 0, duration: D * 0.5, ease: 'back.out(2)' }, t + D * 0.5);
      if (M.ripple) tl.call(() => { live.ripple = h * 0.05; live.rippleSpeed = 9; }, null, t);
      tl.call(() => sfx.whoosh(0, 0.18), null, t + 0.1);
      return D + 0.2;
    },
    glide(tl, t) {
      const D = 1.6;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power3.out' }, t);
      for (let i = 0; i < 4; i++) {
        tl.to(mover, { y: 14, duration: 0.18, ease: 'sine.out', yoyo: true, repeat: 1 }, t + i * 0.36);
      }
      if (M.act === 'curtsy') for (let i = 0; i < 4; i++) tl.call(() => { const p = at(0.5, 0.05); fx.sparkle(p.x, p.y, 2, { spread: 120, size: 26 }); }, null, t + i * 0.36);
      return D + 0.2;
    },
    slide(tl, t) {
      const D = 1.05;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power3.out' }, t);
      tl.fromTo(rocker, { rot: 8 }, { rot: -10, duration: D * 0.85, ease: 'power2.out' }, t);
      tl.to(rocker, { rot: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' }, t + D * 0.85);
      tl.call(() => sfx.swish(), null, t + 0.05);
      return D + 0.45;
    },
    drive(tl, t) {
      const D = 1.5;
      tl.fromTo(mover, { x: r.startX }, { x: 0, duration: D, ease: 'power2.out' }, t);
      tl.to(mover, { y: 8, duration: 0.08, ease: 'sine.inOut', yoyo: true, repeat: 15 }, t);
      for (let i = 0; i < 7; i++) {
        tl.call(() => { const p = at(0.0, 0.2); fx.puffs(p.x, p.y, 1, { size: 70, vx: -200, vy: 30, alpha: 0.7, color: '#f4f4f4' }); }, null, t + i * 0.17);
      }
      tl.call(() => sfx.rumble(0, 1.1), null, t);
      tl.to(rocker, { rot: -5, duration: 0.15, ease: 'power2.out' }, t + D - 0.1);
      tl.to(rocker, { rot: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' }, t + D + 0.05);
      return D + 0.4;
    },
    sweep(tl, t) {
      tl.set(mover, { x: 0 }, t);
      tl.fromTo(hero, { cropRight: 0 }, { cropRight: 1, duration: 1.2, ease: 'sine.inOut' }, t);
      for (let i = 0; i < 6; i++) {
        tl.call(() => { const p = at((i + 0.5) / 6, 0.75 - Math.abs(i - 2.5) * 0.08); fx.sparkle(p.x, p.y, 2, { spread: 90, size: 24 }); }, null, t + (i * 1.2) / 6);
      }
      tl.call(() => [5, 6, 7, 8, 9, 10, 12].forEach((n, i) => sfx.note(n, i * 0.16, 0.18)), null, t);
      return 1.4;
    },
  };

  // ------------------------------------------------------------- idling ----
  let idleTl = null;
  let current = null;
  function startIdle() {
    stopIdle(false);
    idleTl = gsap.timeline();
    const loop = (target, vars) => idleTl.to(target, { ...vars, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
    if (M.tail) { live.wagSpeed = 6; live.wagAmp = w * 0.016; }
    switch (M.idle) {
      case 'bob':
        loop(mover, { y: 14, duration: 1.1 });
        loop(rocker.scale, { y: 1.03, x: 0.98, duration: 1.1 });
        break;
      case 'sway':
        idleTl.fromTo(rocker, { rot: -4.5 }, { rot: 4.5, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        loop(mover, { y: 6, duration: 0.8 });
        break;
      case 'wobble':
        idleTl.fromTo(rocker, { rot: -5 }, { rot: 5, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        break;
      case 'swim':
        live.ripple = Math.max(w, h) * 0.018;
        live.rippleSpeed = 6;
        loop(mover, { y: 16, duration: 1.3 });
        idleTl.fromTo(rocker, { rot: -3 }, { rot: 3, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        break;
      case 'flutter':
        live.ripple = h * 0.035;
        live.rippleSpeed = 7;
        idleTl.fromTo(rocker, { rot: -7 }, { rot: 7, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        loop(mover, { y: 16, duration: 1.1 });
        break;
      case 'float':
        loop(mover, { y: 16, duration: 1.6 });
        idleTl.fromTo(rocker, { rot: -4 }, { rot: 4, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        break;
      case 'tentacles':
        live.ripple = w * 0.02;
        live.rippleSpeed = 4;
        loop(mover, { y: 18, duration: 1.4 });
        break;
      case 'steam':
        live.steam = 1;
        loop(mover, { y: 6, duration: 0.9 });
        break;
      case 'spin':
        live.spin = 14;
        loop(mover, { y: 10, duration: 1.4 });
        break;
      case 'engine':
        live.engine = 1;
        loop(mover, { y: 3, duration: 0.07 });
        break;
      default:
        loop(mover, { y: 12, duration: 1.1 });
    }
  }

  /** stop idling; settle back to the rest pose unless told not to */
  function stopIdle(settle = true) {
    if (idleTl) idleTl.kill();
    idleTl = null;
    live.steam = 0;
    live.engine = 0;
    if (settle) {
      gsap.to(mover, { y: 0, duration: 0.15, overwrite: 'auto' });
      gsap.to(rocker, { rot: 0, duration: 0.15, overwrite: 'auto' });
      gsap.to(rocker.scale, { x: 1, y: 1, duration: 0.15, overwrite: 'auto' });
    }
  }

  // ------------------------------------------------------------ actions ----
  const ACT = {
    hop(tl) {
      wagBurst(tl, 0, 1.4);
      leap(tl, 0.02, 110);
      if (M.mouth) tl.call(() => { const p = at(...M.mouth); fx.puffs(p.x + 30, p.y, 2, { size: 46, vx: 120, vy: 20, alpha: 0.7 }); }, null, 0.3);
      tl.call(() => sfx.boing(), null, 0.05);
    },
    hop2(tl) {
      wagBurst(tl, 0, 1.6);
      const l1 = leap(tl, 0.02, 90);
      const l2 = leap(tl, l1 + 0.12, 70);
      for (const t of [l1, l2]) {
        tl.call(() => { const p = at(0.5, 0.02); for (const c of MUD) fx.drops(p.x, p.y, 5, { color: c, power: 360, cone: 140, size: 22 }); sfx.splash(); }, null, t);
      }
    },
    spin(tl) {
      const land = leap(tl, 0.02, 120, 0.3, 0.26);
      tl.to(rocker, { rot: '-=360', duration: 0.56, ease: 'power1.inOut' }, 0.1);
      tl.set(rocker, { rot: 0 }, land);
      tl.call(() => { const p = at(0.5, 0.6); fx.sparkle(p.x, p.y, 10, { spread: 320, size: 44 }); sfx.sparkle(); }, null, 0.4);
    },
    bounce(tl) {
      let s = 0;
      for (const [hgt, dur] of [[200, 0.46], [110, 0.34]]) {
        squash(tl, s, 0.18, 0.18);
        tl.call(() => sfx.boing(), null, s);
        tl.to(mover, { y: hgt, duration: dur / 2, ease: 'power2.out' }, s + 0.05);
        tl.to(mover, { y: 0, duration: dur / 2, ease: 'power2.in' }, s + 0.05 + dur / 2);
        tl.to(rocker, { rot: '-=120', duration: dur, ease: 'none' }, s + 0.05);
        s += 0.05 + dur;
      }
      squash(tl, s, 0.14, 0.45);
      tl.call(() => sfx.thud(), null, s);
    },
    wobble(tl) {
      for (let i = 0; i < 6; i++) tl.to(rocker, { rot: i % 2 ? -13 : 13, duration: 0.09, ease: 'sine.inOut' }, i * 0.09);
      tl.to(rocker, { rot: 0, duration: 0.4, ease: 'elastic.out(1, 0.35)' }, 0.54);
      tl.call(() => sfx.crack(), null, 0.1);
      tl.call(() => sfx.crack(), null, 0.36);
      leap(tl, 0.6, 50, 0.16, 0.14);
      tl.call(() => { const p = at(0.5, 0.9); fx.sparkle(p.x, p.y, 8, { spread: 260, size: 40 }); }, null, 0.7);
    },
    dash(tl) {
      tl.call(() => { live.ripple = Math.max(w, h) * 0.05; live.rippleSpeed = 18; }, null, 0);
      tl.to(mover, { x: 150, duration: 0.35, ease: 'power2.out' }, 0);
      tl.to(mover, { x: 0, duration: 0.6, ease: 'power2.inOut' }, 0.4);
      tl.to(rocker, { rot: 10, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0);
      tl.call(() => { const p = at(...(M.mouth || [0.95, 0.5])); fx.bubbles(p.x, p.y, 6, { size: 34, spreadX: 30 }); sfx.drip(); sfx.drip(0.15); }, null, 0.3);
      tl.call(() => { live.ripple = Math.max(w, h) * 0.018; live.rippleSpeed = 6; }, null, 1.0);
    },
    flip(tl) {
      const land = leap(tl, 0.02, 150, 0.3, 0.28);
      tl.to(rocker, { rot: '-=360', duration: 0.6, ease: 'power1.inOut' }, 0.1);
      tl.set(rocker, { rot: 0 }, land);
      tl.call(() => { sfx.chime(); const p = at(0.5, 0.7); fx.sparkle(p.x, p.y, 12, { spread: 340, size: 44 }); }, null, land);
    },
    jelly(tl) {
      tl.to(rocker.scale, { x: 1.2, y: 0.82, duration: 0.09, ease: 'power2.out' }, 0);
      tl.to(rocker.scale, { x: 0.86, y: 1.16, duration: 0.12, ease: 'power2.out' }, 0.09);
      tl.to(rocker.scale, { x: 1, y: 1, duration: 0.9, ease: 'elastic.out(1.2, 0.25)' }, 0.21);
      tl.fromTo(hero, { bend: 50 }, { bend: 0, duration: 1.2, ease: 'elastic.out(1.2, 0.22)' }, 0);
      tl.call(() => sfx.boing(), null, 0);
      tl.call(() => { const p = at(0.5, 0.75); fx.sparkle(p.x, p.y, 9, { spread: 280, size: 40 }); }, null, 0.15);
      if (M.bubbles) tl.call(() => { const p = at(...M.bubbles); fx.bubbles(p.x, p.y, 7, { size: 28, spreadX: 30 }); sfx.drip(); sfx.drip(0.2); }, null, 0.1);
    },
    soar(tl) {
      tl.call(() => { live.ripple = h * 0.09; live.rippleSpeed = 14; sfx.whoosh(); }, null, 0);
      tl.to(mover, { y: 130, x: 40, duration: 0.5, ease: 'power2.out' }, 0);
      tl.to(rocker, { rot: -18, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0);
      tl.to(mover, { y: 0, x: 0, duration: 0.7, ease: 'sine.inOut' }, 0.6);
      tl.call(() => { live.ripple = h * 0.035; live.rippleSpeed = 7; }, null, 1.3);
    },
    roar(tl) {
      const roar = r.extraSprite;
      tl.to(rocker.scale, { x: 0.95, y: 1.06, duration: 0.25, ease: 'power2.inOut' }, 0);
      tl.call(() => { if (roar) { hero.opacity = 0; roar.opacity = 1; } sfx.rumble(0, 0.9); }, null, 0.25);
      tl.to(rocker.scale, { x: 1.14, y: 1.1, duration: 0.12, ease: 'power3.out' }, 0.25);
      tl.to(mover, { x: '+=8', duration: 0.04, yoyo: true, repeat: 13, ease: 'none' }, 0.3);
      for (let i = 0; i < 3; i++) {
        tl.call(() => {
          for (const side of [1, -1]) {
            const p = at(0.5 + side * 0.32, 0.72);
            const a = fx.emit({ tex: shapes.arc('#ffffff'), x: p.x, y: p.y, vx: side * 420, vy: 20, life: 0.7, size: 70, grow: 2.4, drag: 0.6 });
            a.scale.x *= side;
          }
        }, null, 0.3 + i * 0.2);
      }
      wagBurst(tl, 0.25, 1.0);
      tl.call(() => { if (roar) { hero.opacity = 1; roar.opacity = 0; } }, null, 1.2);
      tl.to(rocker.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1.1, 0.4)' }, 1.2);
    },
    twinkle(tl) {
      tl.to(rocker, { rot: -12, duration: 0.18, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0);
      tl.to(rocker.scale, { x: 1.12, y: 1.12, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      if (r.glow) tl.to(r.glow, { w: 0.95, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      for (let i = 0; i < 3; i++) tl.call(() => { const p = at(rand(0.2, 0.8), rand(0.3, 0.9)); fx.sparkle(p.x, p.y, 5, { spread: 220, size: 40, colors: ['#fff6a8', '#ffffff'] }); }, null, i * 0.2);
      tl.call(() => sfx.sparkle(), null, 0);
    },
    steam(tl) {
      tl.to(rocker, { rot: 6, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0);
      tl.call(() => { const p = at(0.5, 0.85); fx.puffs(p.x, p.y, 6, { size: 90, vy: 110, spread: 60, alpha: 0.6 }); sfx.slide(true); sfx.slide(true, 0.22); }, null, 0.05);
      tl.call(() => { const p = at(0.5, 0.95); fx.hearts(p.x, p.y, 3, { size: 44 }); }, null, 0.45);
    },
    wave(tl) {
      tl.call(() => { live.ripple = w * 0.07; live.rippleSpeed = 9; }, null, 0);
      for (let i = 0; i < 6; i++) tl.to(rocker, { rot: i % 2 ? -12 : 12, duration: 0.16, ease: 'sine.inOut' }, i * 0.16);
      tl.to(rocker, { rot: 0, duration: 0.3, ease: 'sine.out' }, 0.96);
      tl.call(() => { const p = at(0.5, 0.9); fx.bubbles(p.x, p.y, 6, { size: 32, spreadX: 120 }); fx.hearts(p.x, p.y + 40, 2, { size: 40 }); }, null, 0.2);
      tl.call(() => { live.ripple = w * 0.02; live.rippleSpeed = 4; }, null, 1.3);
    },
    curtsy(tl) {
      tl.to(rocker.scale, { y: 0.9, x: 1.05, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      tl.to(rocker, { rot: 5, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      tl.call(() => { sfx.chime(); const p = at(0.5, 0.93); fx.sparkle(p.x, p.y, 12, { spread: 260, size: 40 }); }, null, 0.2);
    },
    sweep(tl) {
      tl.fromTo(hero, { cropRight: 0 }, { cropRight: 1, duration: 0.8, ease: 'sine.inOut' }, 0);
      tl.call(() => [5, 6, 7, 8, 9, 10, 12].forEach((n, i) => sfx.note(n, i * 0.1, 0.18)), null, 0);
      for (let i = 0; i < 5; i++) tl.call(() => { const p = at((i + 0.5) / 5, 0.7); fx.sparkle(p.x, p.y, 3, { spread: 120, size: 30 }); }, null, i * 0.16);
    },
    shine(tl) {
      tl.call(() => { live.spin = 200; }, null, 0);
      tl.call(() => { live.spin = 14; }, null, 0.9);
      tl.to(rocker.scale, { x: 1.15, y: 1.15, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
      tl.call(() => { const p = at(0.5, 0.5); fx.sparkle(p.x, p.y, 16, { spread: 420, size: 46 }); sfx.chime(); }, null, 0.2);
    },
    hug(tl) {
      for (let i = 0; i < 2; i++) {
        tl.to(rocker.scale, { x: 1.14, y: 0.88, duration: 0.14, ease: 'power2.out' }, i * 0.42);
        tl.to(rocker.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2)' }, i * 0.42 + 0.14);
      }
      tl.call(() => { const p = at(0.5, 0.8); fx.hearts(p.x, p.y, 6, { size: 50 }); sfx.pop(0.8); sfx.sparkle(0.2); }, null, 0.1);
    },
    open(tl) {
      const closed = r.extraSprite;
      tl.call(() => { if (closed) { hero.opacity = 0; closed.opacity = 1; } sfx.swish(); }, null, 0);
      tl.call(() => { if (closed) { closed.opacity = 0; hero.opacity = 1; } sfx.whoosh(); sfx.pop(0.8, 0.1); }, null, 0.4);
      tl.fromTo(rocker.scale, { x: 0.3 }, { x: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.35)', immediateRender: false }, 0.4);
      for (let i = 0; i < 5; i++) {
        tl.call(() => { const p = at(rand(0.1, 0.9), 0.85); fx.drops(p.x, p.y, 2, { color: '#bfe0f7', power: 220, cone: 120, size: 18, g: 700 }); }, null, 0.6 + i * 0.15);
      }
    },
    honk(tl) {
      for (const t of [0, 0.3]) {
        squash(tl, t, 0.06, 0.2);
        tl.call(() => { sfx.note(4, 0, 0.35); sfx.note(7, 0, 0.25); const p = at(0.96, 0.5); fx.notes(p.x, p.y, 1); }, null, t);
      }
      tl.to(mover, { x: 40, duration: 0.25, ease: 'power2.out' }, 0.6);
      tl.to(mover, { x: 0, duration: 0.5, ease: 'back.out(2)' }, 0.85);
      tl.call(() => { const p = at(0.0, 0.2); fx.puffs(p.x, p.y, 3, { size: 70, vx: -160, vy: 30, alpha: 0.7, color: '#f4f4f4' }); }, null, 0.6);
    },
    spout(tl) {
      squash(tl, 0, 0.08, 0.4);
      for (let i = 0; i < 18; i++) {
        tl.call(() => {
          const p = at(...(M.blowhole || [0.6, 0.85]));
          for (let k = 0; k < 2; k++) {
            fx.emit({
              tex: shapes.drop(k ? '#ffffff' : '#bfe6fb'), x: p.x + rand(-8, 8), y: p.y,
              vx: rand(-140, 140), vy: rand(520, 760), g: 1300, life: rand(0.8, 1.1), size: rand(22, 36), rot: rand(-20, 20),
            });
          }
        }, null, 0.05 + i * 0.05);
      }
      tl.call(() => { sfx.whoosh(0, 0.3); sfx.splash(0.6); }, null, 0);
      tl.to(mover, { y: 20, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
    },
    yoyo(tl) {
      // down and up on its string (no full spins: the painted string would flail about)
      for (let i = 0; i < 2; i++) {
        const s = i * 0.7;
        tl.to(mover, { y: -150, duration: 0.32, ease: 'power1.in' }, s);
        tl.to(rocker, { rot: 14, duration: 0.16, ease: 'sine.inOut', yoyo: true, repeat: 3 }, s);
        tl.to(mover, { y: 0, duration: 0.32, ease: 'power1.out' }, s + 0.34);
        tl.call(() => { sfx.slide(false); sfx.slide(true, 0.34); }, null, s);
      }
      tl.to(rocker, { rot: 0, duration: 0.2 }, 1.36);
    },
    gallop(tl) {
      tl.to(rocker, { rot: 14, duration: 0.2, ease: 'power2.out' }, 0);
      tl.to(rocker, { rot: 0, duration: 0.25, ease: 'power2.in' }, 0.3);
      for (let i = 0; i < 3; i++) {
        tl.to(mover, { y: 40, duration: 0.12, ease: 'sine.out', yoyo: true, repeat: 1 }, 0.55 + i * 0.26);
        tl.call(() => { sfx.tap(); sfx.tap(0.08); const p = at(0.25, 0.02); fx.puffs(p.x, p.y, 1, { size: 60, vx: -120, vy: 30, alpha: 0.6, color: '#fff8ea' }); }, null, 0.79 + i * 0.26);
      }
      wagBurst(tl, 0, 1.4);
    },
  };

  return {
    update,
    /** adds the arrival to `tl` at time `t`; returns its length */
    enter(tl, t) {
      return (ENTER[M.enter] || ENTER.slide)(tl, t);
    },
    startIdle,
    stopIdle,
    /** the signature move, as its own timeline (a new tap restarts it) */
    act() {
      stopIdle(false);
      if (current) current.kill();
      gsap.killTweensOf([mover, rocker, rocker.scale]);
      gsap.set(mover, { x: 0, y: 0 });
      gsap.set(rocker, { rot: 0 });
      gsap.set(rocker.scale, { x: 1, y: 1 });
      if (r.extraSprite) {
        r.extraSprite.opacity = 0;
        hero.opacity = 1;
      }
      const tl = gsap.timeline({ onComplete: startIdle });
      (ACT[M.act] || ACT.jelly)(tl);
      current = tl;
      return tl;
    },
    kill() {
      stopIdle(false);
      if (current) current.kill();
    },
  };
}
