// Shared moves for the story scenes.
import gsap from 'gsap';

/** A couple of drifting clouds high in the sky. */
export function clouds(S, spots = [[-330, 360, 250], [330, 420, 200]], speed = 1) {
  spots.forEach(([x, y, w], i) => {
    const c = S.sprite(i % 2 ? 'cloud2' : 'cloud1', { w, order: -940, shadow: { alpha: 0.1 } }).at(x, y);
    S.loop(c, { x: x + (i % 2 ? -34 : 40), duration: (5 + i) / speed });
  });
}

/** Planted decor (bush, flower, grass, seaweed ...) that sways gently. [name, x, w, order?, dy?] */
export function plants(S, items) {
  return items.map(([name, x, w, order = 30, dy = 0]) => {
    const p = S.sprite(name, { w, anchor: [0.5, 0.04], order, seg: 8 }).at(x, S.ground - 26 + dy);
    S.loop(p, { bend: w * 0.045, duration: 2 + ((x * 13) % 7) * 0.12 });
    return p;
  });
}

/** Scale a node in from nothing with a bouncy overshoot. */
export function popIn(tl, node, at, duration = 0.5, to = 1) {
  const sign = Math.sign(node.scale.x || 1);
  node.scale.set(0.0001 * sign, 0.0001, 1);
  tl.to(node.scale, { x: to * sign, y: to, duration, ease: 'back.out(2)' }, at);
}

/** Squash on impact, spring back. */
export function squash(tl, node, at, amount = 0.16, settle = 0.6) {
  const sx = node.scale.x;
  const sy = node.scale.y;
  tl.to(node.scale, { x: sx * (1 + amount), y: sy * (1 - amount), duration: 0.08, ease: 'power2.out' }, at);
  tl.to(node.scale, { x: sx, y: sy, duration: settle, ease: 'elastic.out(1.1, 0.35)' }, at + 0.08);
}

/** One hop: up and down in place (y is restored). */
export function hop(tl, node, at, height = 40, duration = 0.36) {
  tl.to(node, { y: `+=${height}`, duration: duration / 2, ease: 'power2.out' }, at);
  tl.to(node, { y: `-=${height}`, duration: duration / 2, ease: 'power2.in' }, at + duration / 2);
}

/**
 * Four-legged trot for a single cut-out: slides to `toX` while hopping and rocking.
 */
export function trot(tl, node, at, toX, duration, { hops = 4, height = 26, rock = 5 } = {}) {
  const step = duration / hops;
  tl.to(node, { x: toX, duration, ease: 'sine.inOut' }, at);
  for (let i = 0; i < hops; i++) {
    const t = at + i * step;
    tl.to(node, { y: `+=${height}`, rot: rock, duration: step * 0.45, ease: 'sine.out' }, t);
    tl.to(node, { y: `-=${height}`, rot: -rock * 0.6, duration: step * 0.45, ease: 'sine.in' }, t + step * 0.45);
  }
  tl.to(node, { rot: 0, duration: 0.18, ease: 'sine.out' }, at + duration);
}

/** Quick side-to-side wiggle (happy shake, wobble before a crack ...). */
export function wiggle(tl, node, at, deg = 8, times = 3, each = 0.12) {
  const r0 = node.rot;
  for (let i = 0; i < times; i++) {
    tl.to(node, { rot: r0 + (i % 2 ? -deg : deg), duration: each, ease: 'sine.inOut' }, at + i * each);
  }
  tl.to(node, { rot: r0, duration: each, ease: 'sine.inOut' }, at + times * each);
}

/** Pause at the end so the last pose can settle before the page goes still. */
export const rest = (tl, seconds = 0.8) => tl.to({}, { duration: seconds });

/** World position of a node as { x, y }. */
export function worldPos(node) {
  node.updateWorldMatrix(true, false);
  const e = node.matrixWorld.elements;
  return { x: e[12], y: e[13] };
}

export { gsap };
