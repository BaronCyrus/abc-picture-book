// Z - zebra - "The zebra runs fast."
import { shapes } from '../gl/shapes.js';
import { rand } from '../core/util.js';
import { rest } from './kit.js';

export default {
  art: ['grass', 'bush', 'cloud1'],
  backdrop: 'savanna',
  build(S) {
    const { tl, fx, sfx, ground, bd } = S;
    const cloud = S.sprite('cloud1', { w: 230, order: -940, shadow: { alpha: 0.1 } }).at(260, 400);
    cloud.tint(1, 0.95, 0.86);
    // scenery that will streak past
    const props = [['grass', -300, 170], ['bush', 180, 190], ['grass', 620, 150], ['bush', 1000, 170], ['grass', 1380, 190], ['bush', 1800, 180]].map(
      ([n, x, w]) => S.sprite(n, { w, anchor: [0.5, 0.04], order: 30 }).at(x, ground - 26),
    );

    const base = ground - 4;
    const zebra = S.sprite('zebra', { w: 380, anchor: [0.5, 0.04], seg: 6, order: 60 }).at(-860, base);
    const dust = () => fx.puffs(zebra.x - 150, base + 30, 1, { size: 62, vx: -220, vy: 40, alpha: 0.8, color: '#f1dcae' });
    const streak = () =>
      fx.emit({ tex: shapes.dash('#fff6dd'), x: zebra.x - 150 + rand(-40, 40), y: base + rand(90, 330), vx: -900, life: 0.28, size: rand(110, 190), alpha: 0.9 });

    // gallop in ...
    tl.to(zebra, { x: 30, duration: 1.0, ease: 'power2.out' }, 0.15);
    const stride = 0.2;
    const N = 15;
    for (let i = 0; i < N; i++) {
      const t = 0.15 + i * stride;
      tl.to(zebra, { y: base + 40, rot: -7, duration: stride * 0.5, ease: 'sine.out' }, t);
      tl.to(zebra, { y: base, rot: 5, duration: stride * 0.5, ease: 'sine.in' }, t + stride * 0.5);
      tl.call(() => { dust(); sfx.tap(); }, null, t + stride * 0.95);
    }
    for (let i = 0; i < 26; i++) tl.call(streak, null, 0.5 + i * 0.1);
    S.say(0.8);

    // ... and the whole savanna rushes by
    const R = 0.9;
    const run = 2.3;
    props.forEach((p) => tl.to(p, { x: `-=${1500}`, duration: run, ease: 'power1.inOut' }, R));
    bd.strips.forEach((s, i) => tl.to(s.shape, { w: `+=${3 + i * 2.5}`, duration: run, ease: 'power1.inOut' }, R));
    tl.to(cloud, { x: -200, duration: run, ease: 'power1.inOut' }, R);
    tl.call(() => sfx.whoosh(0, 0.2), null, R + 0.3);
    tl.call(() => sfx.whoosh(0, 0.2), null, R + 1.2);

    // phew!
    const E = 0.15 + N * stride;
    tl.to(zebra, { rot: 0, y: base, duration: 0.3, ease: 'back.out(2)' }, E);
    tl.call(() => { fx.puffs(zebra.x - 60, base + 30, 6, { size: 64, spread: 200, color: '#f1dcae' }); sfx.thud(); }, null, E);
    tl.to(zebra, { y: base + 60, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, E + 0.4);
    tl.call(() => { sfx.chime(); fx.sparkle(zebra.x, base + 380, 12, { spread: 380, size: 44 }); }, null, E + 0.45);
    rest(tl, 1.2);
  },
};
