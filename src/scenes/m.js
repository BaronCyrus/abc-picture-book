// M - moon - "I see the moon."
import { shapes } from '../gl/shapes.js';
import { rand } from '../core/util.js';
import { rest } from './kit.js';

export default {
  art: ['bush', 'grass'],
  kid: true,
  backdrop: (P) => {
    const c = P.night();
    c.sky.glow = { x: 190, y: -420, r: 560, a: 0, color: '#fff2b0' };
    return c;
  },
  build(S) {
    const { tl, fx, sfx, ground, bd } = S;
    const bush = S.sprite('bush', { w: 210, anchor: [0.5, 0.05], order: 30 }).at(400, ground - 26);
    const grass = S.sprite('grass', { w: 150, anchor: [0.5, 0.05], order: 30 }).at(-420, ground - 24);
    for (const p of [bush, grass]) p.tint(0.5, 0.62, 0.86);

    const kid = S.kid({ height: 430 }).at(-210, ground);
    kid.tint(0.8, 0.84, 1);
    kid.j.head = -4;

    // the moon climbs out from behind the hills, with a soft halo
    const moon = S.sprite('moon', { w: 270, order: -905, shadow: false }).at(190, -420);
    moon.rot = 24;
    S.each(() => {
      bd.glow.x = moon.x;
      bd.glow.y = moon.y;
    });
    tl.to(moon, { y: 270, rot: 0, duration: 2.3, ease: 'power2.out' }, 0.35);
    tl.to(bd.glow, { w: 0.55, duration: 1.6, ease: 'sine.out' }, 0.6);
    tl.call(() => sfx.slide(true), null, 0.5);
    for (const t of [0.9, 1.3, 1.7]) tl.call(() => sfx.note(9 + Math.round(t * 3), 0, 0.14), null, t);

    // fireflies
    const firefly = () =>
      fx.emit({
        tex: shapes.spark('#fff6a8'), x: rand(-460, 460), y: rand(-280, -60), vx: rand(-20, 20), vy: rand(14, 44),
        life: rand(1.6, 2.6), size: rand(16, 28), sway: 40, alpha: 0.9,
      });
    for (let i = 0; i < 9; i++) tl.call(firefly, null, 0.3 + i * 0.33);

    // "I see the moon."
    const T = 1.55;
    tl.to(kid.j, { head: 10, duration: 0.4, ease: 'sine.out' }, T - 0.5);
    tl.call(() => { kid.face = 'c'; }, null, T - 0.15);
    S.say(T);
    tl.to(kid.j, { armR: 138, foreR: 8, armL: 30, foreL: 20, duration: 0.45, ease: 'back.out(1.8)' }, T);
    tl.to(kid, { lift: 26, duration: 0.15, ease: 'sine.out', yoyo: true, repeat: 1 }, T + 0.05);

    const E = T + 1.3;
    tl.call(() => { sfx.sparkle(); fx.sparkle(190, 270, 12, { spread: 300, size: 40, colors: ['#fff6a8', '#ffffff'] }); }, null, E);
    tl.to(moon.scale, { x: 1.08, y: 1.08, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, E);
    tl.to(bd.glow, { w: 0.7, duration: 0.3, yoyo: true, repeat: 1 }, E);
    kid.blink(tl, E + 0.5);
    rest(tl, 1.4);
  },
};
