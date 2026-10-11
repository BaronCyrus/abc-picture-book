// L - lion - "The lion roars."
import { shapes } from '../gl/shapes.js';
import { plants, squash, rest } from './kit.js';

export default {
  art: ['lion_roar', 'grass', 'bird', 'bush'],
  backdrop: 'savanna',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    const greens = plants(S, [['grass', -400, 170, 29], ['grass', 400, 190, 29], ['bush', 330, 170, 20, 20]]);

    const bird = S.sprite('bird', { w: 90, order: 40 }).at(322, ground + 170);
    S.loop(bird, { y: bird.y + 6, duration: 0.5 });

    const base = ground - 14;
    const lion = S.sprite('lion', { w: 400, anchor: [0.5, 0.02], seg: 10, order: 60 }).at(-40, base);
    const roar = S.sprite('lion_roar', { w: 410, anchor: [0.5, 0.02], seg: 10, order: 61 }).at(-40, base);
    roar.opacity = 0;
    const both = [lion, roar];
    S.loop(lion.scale, { y: 1.02, duration: 1.4 });

    // a big breath in ...
    const T = 1.0;
    S.say(T - 0.25);
    for (const p of both) {
      tl.to(p.scale, { x: 0.94, y: 1.09, duration: 0.55, ease: 'power2.inOut' }, T - 0.1);
      tl.to(p, { rot: 4, duration: 0.55, ease: 'power2.inOut' }, T - 0.1);
    }
    tl.call(() => sfx.slide(true), null, T - 0.1);

    // ROAR!
    const R = T + 0.5;
    tl.call(() => {
      lion.opacity = 0;
      roar.opacity = 1;
      sfx.rumble(0, 1.0);
      fx.leaves(-40, base + 60, 10, { spreadX: 320, color: ['#d9a044', '#c98f38', '#86c765'] });
    }, null, R);
    for (const p of both) {
      tl.to(p.scale, { x: 1.16, y: 1.1, duration: 0.12, ease: 'power3.out' }, R);
      tl.to(p, { rot: -5, duration: 0.12, ease: 'power3.out' }, R);
    }
    tl.to(roar, { x: '+=7', duration: 0.045, yoyo: true, repeat: 17, ease: 'none' }, R + 0.08);
    for (let i = 0; i < 4; i++) {
      tl.call(() => {
        for (const side of [1, -1]) {
          const a = fx.emit({
            tex: shapes.arc('#fff3cf'), x: -40 + side * 210, y: base + 320, vx: side * 430, vy: 30,
            life: 0.7, size: 60, grow: 2.6, drag: 0.6, alpha: 0.95,
          });
          a.scale.x *= side;
          a.rot = side > 0 ? 0 : 180;
        }
      }, null, R + 0.05 + i * 0.2);
    }
    greens.forEach((g) => tl.fromTo(g, { bend: 60 }, { bend: 0, duration: 1.4, ease: 'elastic.out(1.2, 0.25)' }, R + 0.05));
    // the little bird is off!
    tl.to(bird, { x: 620, y: 520, rot: 30, duration: 0.8, ease: 'power2.in' }, R + 0.1);
    tl.call(() => sfx.pop(2), null, R + 0.12);

    // ... and a proud smile
    const E = R + 1.05;
    tl.call(() => { lion.opacity = 1; roar.opacity = 0; }, null, E);
    for (const p of both) {
      tl.to(p.scale, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)' }, E);
      tl.to(p, { rot: 0, duration: 0.5, ease: 'back.out(2)' }, E);
    }
    tl.call(() => { fx.sparkle(-40, base + 330, 10, { spread: 380, size: 46 }); sfx.sparkle(); }, null, E + 0.25);
    squash(tl, lion, E + 0.7, 0.05, 0.5);
    rest(tl, 1.0);
  },
};
