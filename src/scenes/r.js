// R - rainbow - "Look, a rainbow!"
import { rgb } from '../gl/backdrop.js';
import { plants, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_r', 'flower_y'],
  kid: true,
  backdrop: (P) => {
    const c = P.rainy();
    c.sky.bow = { x: 60, y: -300, r: 560, reveal: 0 };
    c.sky.glow = { x: 380, y: 430, r: 560, a: 0, color: '#fff7c2' };
    return c;
  },
  build(S) {
    const { tl, fx, sfx, ground, bd } = S;
    plants(S, [['bush', 420, 200], ['grass', -420, 150, 29], ['flower_r', 290, 62, 31, -8], ['flower_y', -300, 56, 31, -12]]);
    const c1 = S.sprite('cloud1', { w: 330, order: -940, shadow: { alpha: 0.12 } }).at(-170, 390);
    const c2 = S.sprite('cloud2', { w: 300, order: -940, shadow: { alpha: 0.12 } }).at(220, 430);
    for (const c of [c1, c2]) c.tint(0.78, 0.8, 0.88);

    const kid = S.kid({ height: 430 }).at(-230, ground);
    kid.j.head = -5;
    kid.j.armL = 4;
    kid.j.armR = 4;
    tl.call(() => fx.drops(-230, ground + 420, 3, { power: 60, cone: 60, angle: 270, size: 18 }), null, 0.2);

    // the rain stops and the sun peeks out
    const T = 0.9;
    tl.to(bd.u.uRain, { value: 0, duration: 0.8, ease: 'power1.in' }, T - 0.5);
    tl.to(bd.top, { ...rgb('#7cc8f4'), duration: 1.2 }, T - 0.2);
    tl.to(bd.bot, { ...rgb('#e9f8fe'), duration: 1.2 }, T - 0.2);
    tl.to(bd.strips[0].u.uCol.value, { ...rgb('#c4e7a0'), duration: 1.2 }, T - 0.2);
    tl.to(bd.strips[0].u.uCol2.value, { ...rgb('#aedb88'), duration: 1.2 }, T - 0.2);
    tl.to(bd.strips[1].u.uCol.value, { ...rgb('#8ccb68'), duration: 1.2 }, T - 0.2);
    tl.to(bd.strips[1].u.uCol2.value, { ...rgb('#74b955'), duration: 1.2 }, T - 0.2);
    tl.to(bd.glow, { w: 0.8, duration: 1.2 }, T);
    for (const c of [c1, c2]) tl.to(c.u.uTint.value, { x: 1, y: 1, z: 1, duration: 1 }, T - 0.2);
    tl.to(c1, { x: -420, duration: 2.6, ease: 'sine.inOut' }, T - 0.2);
    tl.to(c2, { x: 470, duration: 2.6, ease: 'sine.inOut' }, T - 0.2);
    tl.to(kid.j, { head: 8, duration: 0.4 }, T);

    // a rainbow paints itself across the sky
    const R = T + 0.6;
    S.say(R - 0.05);
    tl.to(bd.bow, { w: 1, duration: 1.5, ease: 'sine.inOut' }, R);
    tl.call(() => { sfx.sparkle(); [5, 6, 7, 8, 9, 10, 12].forEach((n, i) => sfx.note(n, i * 0.18, 0.2)); }, null, R);
    tl.call(() => { kid.face = 'c'; }, null, R + 0.1);
    tl.to(kid.j, { armR: 140, foreR: 6, armL: 34, foreL: 20, head: 12, duration: 0.4, ease: 'back.out(1.8)' }, R + 0.1);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (1 - (i + 0.5) / 6);
      tl.call(() => fx.sparkle(60 + Math.cos(a) * 470, -300 + Math.sin(a) * 470, 3, { spread: 130, size: 30 }), null, R + 0.15 + i * 0.24);
    }

    // hooray!
    const E = R + 1.6;
    tl.to(kid.j, { armL: 150, foreL: 14, armR: 150, foreR: 14, head: 6, duration: 0.3, ease: 'back.out(2)' }, E);
    tl.to(kid, { lift: 50, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 3 }, E);
    tl.call(() => { sfx.chime(); fx.sparkle(-230, ground + 470, 10, { spread: 300, size: 42 }); }, null, E + 0.1);
    tl.to(kid.j, { armL: 34, foreL: 20, armR: 140, foreR: 6, head: 12, duration: 0.4, ease: 'sine.inOut' }, E + 0.9);
    rest(tl, 1.0);
  },
};
