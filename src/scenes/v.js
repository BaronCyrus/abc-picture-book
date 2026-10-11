// V - van - "The van goes vroom!"
import { shapes } from '../gl/shapes.js';
import { rand } from '../core/util.js';
import { clouds, plants, squash, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'tree'],
  backdrop: 'road',
  build(S) {
    const { tl, fx, sfx, ground, bd } = S;
    clouds(S);
    S.sprite('tree', { h: 330, anchor: [0.5, 0.02], order: -150 }).at(-330, -212);
    S.sprite('tree', { h: 260, anchor: [0.5, 0.02], order: -150 }).at(360, -196);
    plants(S, [['bush', 150, 150, -140, 78]]);
    // dashes on the road
    const dashes = [];
    for (let i = 0; i < 7; i++) {
      dashes.push(S.paper(shapes.rect('#fff6d6', 128, 24, 8), { w: 120, order: -90, shadow: false }).at(-720 + i * 240, ground - 34));
    }

    const road = ground - 4;
    const van = S.sprite('van', { w: 460, anchor: [0.5, 0.04], seg: 4, order: 60 }).at(-1000, road);
    const puff = () => fx.puffs(van.x - 250, road + 60, 1, { size: 56, vx: -160, vy: 50, alpha: 0.75, color: '#f4f4f4' });
    const whizz = () =>
      fx.emit({ tex: shapes.dash('#ffffff'), x: van.x - 260, y: road + rand(90, 250), vx: -700, life: 0.3, size: rand(90, 150), alpha: 0.85 });

    // vroooom in from the left
    tl.call(() => { sfx.rumble(0, 1.5); }, null, 0.15);
    tl.to(van, { x: 40, duration: 1.7, ease: 'power2.out' }, 0.2);
    tl.to(van, { y: road + 12, duration: 0.09, ease: 'sine.inOut', yoyo: true, repeat: 15 }, 0.2);
    tl.fromTo(van, { rot: 3 }, { rot: 0, duration: 1.2, ease: 'power2.out' }, 0.2);
    for (let i = 0; i < 9; i++) tl.call(puff, null, 0.25 + i * 0.15);
    for (let i = 0; i < 10; i++) tl.call(whizz, null, 0.3 + i * 0.1);
    // the world scrolls by
    bd.strips.slice(0, 2).forEach((s, i) => tl.to(s.shape, { w: `+=${1.6 + i}`, duration: 1.9, ease: 'power2.out' }, 0.2));
    dashes.forEach((d) => tl.to(d, { x: '-=300', duration: 1.9, ease: 'power2.out' }, 0.2));
    S.say(0.75);

    // screech - stop
    const T = 1.9;
    tl.to(van, { rot: -4, duration: 0.14, ease: 'power2.out' }, T);
    tl.to(van, { rot: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' }, T + 0.14);
    squash(tl, van, T + 0.05, 0.05, 0.5);
    tl.call(() => fx.puffs(van.x + 60, road + 30, 5, { size: 60, spread: 160, vy: 40, alpha: 0.7, color: '#efe6d2' }), null, T);

    // beep beep!
    const B = T + 0.8;
    for (const dt of [0, 0.28]) {
      tl.call(() => { sfx.note(4, 0, 0.4); sfx.note(7, 0, 0.3); fx.notes(van.x + 210, road + 240, 1); }, null, B + dt);
      squash(tl, van, B + dt, 0.04, 0.22);
    }
    tl.call(() => { sfx.sparkle(); fx.sparkle(van.x, road + 320, 10, { spread: 380, size: 44 }); }, null, B + 0.7);
    rest(tl, 1.4);
  },
};
