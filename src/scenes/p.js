// P - pig - "The pig jumps in the mud."
import { shapes } from '../gl/shapes.js';
import { rand } from '../core/util.js';
import { clouds, plants, trot, wiggle, squash, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_y'],
  backdrop: 'meadow',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', -420, 200], ['grass', 430, 150, 29], ['flower_y', -300, 58, 31, -10]]);

    // a lovely big mud puddle (its front lip is drawn again over the pig)
    const px = 150;
    const py = ground - 30;
    S.paper(shapes.ellipse('#7a4c31', 512, 150), { w: 500, order: 30, shadow: false }).at(px, py);
    S.paper(shapes.ellipse('#9a6441', 512, 150), { w: 400, order: 31, shadow: false }).at(px + 8, py + 8);
    const lip = S.paper(shapes.ellipse('#7a4c31', 512, 150), { w: 500, order: 70, shadow: false }).at(px, py);
    lip.crop(0, 0, 1, 0.42);

    const pig = S.sprite('pig', { w: 330, anchor: [0.5, 0.04], seg: 6, order: 60 }).at(-740, ground - 6);
    trot(tl, pig, 0.1, -280, 1.25, { hops: 4, height: 22, rock: 4 });
    tl.call(() => { sfx.pop(0.5); sfx.pop(0.45, 0.14); }, null, 0.4);

    // ready ... JUMP
    const T = 1.6;
    S.say(1.25);
    squash(tl, pig, T - 0.22, 0.14, 0.2);
    tl.to(pig, { x: px - 10, duration: 0.6, ease: 'none' }, T);
    tl.to(pig, { y: ground + 300, rot: -14, duration: 0.3, ease: 'power2.out' }, T);
    tl.to(pig, { y: py - 28, rot: 10, duration: 0.3, ease: 'power2.in' }, T + 0.3);
    tl.call(() => sfx.boing(), null, T);

    // SPLAT
    const L = T + 0.6;
    const mud = ['#7a4c31', '#9a6441', '#6b4029'];
    tl.call(() => {
      sfx.splash();
      sfx.thud();
      for (const c of mud) fx.drops(px, py + 30, 7, { color: c, power: 620, cone: 150, size: 34, g: 1100 });
      for (let i = 0; i < 6; i++) {
        fx.emit({
          tex: shapes.disc(mud[i % 3]), x: px + rand(-180, 180), y: py + 20, vx: rand(-320, 320), vy: rand(280, 560),
          g: 1100, life: 0.9, size: rand(26, 50),
        });
      }
    }, null, L);
    tl.to(pig, { rot: 0, duration: 0.1 }, L);
    squash(tl, pig, L, 0.22, 0.7);
    tl.to(lip.scale, { x: 1.14, y: 1.25, duration: 0.1, ease: 'power2.out' }, L);
    tl.to(lip.scale, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' }, L + 0.1);

    // happy as a pig in mud
    const E = L + 0.8;
    wiggle(tl, pig, E, 7, 6, 0.12);
    tl.call(() => { sfx.pop(0.5); sfx.pop(0.45, 0.16); fx.hearts(px + 60, ground + 300, 4, { size: 46 }); }, null, E);
    tl.call(() => fx.drops(px, py + 30, 8, { color: '#9a6441', power: 320, cone: 160, size: 24 }), null, E + 0.3);
    tl.call(() => sfx.splash(), null, E + 0.3);
    rest(tl, 1.4);
  },
};
