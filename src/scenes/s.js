// S - sun - "The sun comes up."
import { rgb } from '../gl/backdrop.js';
import { popIn, rest } from './kit.js';

export default {
  art: ['bird', 'flower_r', 'flower_y', 'grass', 'bush', 'cloud1'],
  backdrop: () => ({
    sky: { top: '#2f3d7e', bot: '#f2a98a', y0: -260, y1: 640, stars: 0.7, glow: { x: 110, y: -420, r: 700, a: 0.25, color: '#ffe9a8' }, vig: 0.2 },
    strips: [
      { y: -150, amp: 70, freq: 0.0030, seed: 1.3, color: '#5e7f86', color2: '#52727a', shadow: 0.2 },
      { y: -235, amp: 46, freq: 0.0044, seed: 4.1, color: '#4d7068', color2: '#43645d', shadow: 0.22 },
      { y: -300, amp: 16, freq: 0.0060, seed: 7.7, color: '#3f6257', color2: '#36564c', shadow: 0.26, order: -100 },
    ],
  }),
  build(S) {
    const { tl, fx, sfx, ground, bd } = S;
    const day = [['#bfe39a', '#a9d884'], ['#9cd476', '#86c765'], ['#7fc45c', '#69b24c']];

    const sun = S.sprite('sun', { w: 330, order: -905, shadow: false }).at(110, -470);
    S.each((dt) => {
      sun.rot += dt * 14;
      bd.glow.x = sun.x;
      bd.glow.y = sun.y;
    });
    const cloud = S.sprite('cloud1', { w: 240, order: -940, shadow: { alpha: 0.1 } }).at(-330, 360);
    cloud.tint(0.72, 0.66, 0.8);

    // sleepy flowers wait for the light
    const blooms = [
      ['flower_r', -360, 84], ['flower_y', -230, 70], ['grass', -90, 150], ['flower_y', 300, 80], ['flower_r', 410, 70], ['bush', 30, 0],
    ].filter(([, , w]) => w)
      .map(([name, x, w]) => {
        const f = S.sprite(name, { w, anchor: [0.5, 0.03], seg: 8, order: 30 }).at(x, ground - 28);
        f.tint(0.55, 0.6, 0.78);
        f.scale.set(1, 0.55, 1);
        f.bend = -18;
        return f;
      });

    // up comes the sun, and night turns into day
    const T = 0.5;
    tl.to(sun, { y: 250, duration: 2.6, ease: 'power2.out' }, T);
    tl.call(() => sfx.slide(true), null, T);
    S.say(T + 0.45);
    tl.to(bd.top, { ...rgb('#86cdf5'), duration: 2.2, ease: 'sine.inOut' }, T + 0.2);
    tl.to(bd.bot, { ...rgb('#e6f6fd'), duration: 2.2, ease: 'sine.inOut' }, T + 0.2);
    tl.to(bd.u.uStars, { value: 0, duration: 1.0 }, T + 0.2);
    tl.to(bd.glow, { w: 0.75, duration: 2.0 }, T + 0.2);
    bd.strips.forEach((s, i) => {
      tl.to(s.u.uCol.value, { ...rgb(day[i][0]), duration: 2.0, ease: 'sine.inOut' }, T + 0.4);
      tl.to(s.u.uCol2.value, { ...rgb(day[i][1]), duration: 2.0, ease: 'sine.inOut' }, T + 0.4);
    });
    tl.to(cloud.u.uTint.value, { x: 1, y: 1, z: 1, duration: 2 }, T + 0.4);
    tl.to(cloud, { x: -280, duration: 4, ease: 'sine.inOut' }, 0);

    // the flowers wake up one by one
    blooms.forEach((f, i) => {
      const t = T + 1.3 + i * 0.16;
      tl.to(f.u.uTint.value, { x: 1, y: 1, z: 1, duration: 0.6 }, t);
      tl.to(f.scale, { y: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.4)' }, t);
      tl.to(f, { bend: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.3)' }, t);
      tl.call(() => sfx.pop(1.2 + i * 0.12), null, t);
    });

    // good morning, little bird!
    const B = T + 2.0;
    const bird = S.sprite('bird', { w: 110, order: 40 }).at(1100, 420);
    bird.scale.x = -1;
    tl.to(bird, { x: 195, duration: 1.0, ease: 'sine.out' }, B);
    tl.to(bird, { y: ground + 86, duration: 1.0, ease: 'sine.inOut' }, B);
    tl.to(bird, { y: `+=${26}`, duration: 0.12, ease: 'sine.out', yoyo: true, repeat: 3 }, B + 1.05);
    tl.call(() => { sfx.pop(2.2); sfx.pop(2.5, 0.14); sfx.pop(2.2, 0.3); fx.notes(190, ground + 150, 3); }, null, B + 1.05);
    tl.call(() => { sfx.chime(); fx.sparkle(110, 250, 12, { spread: 420, size: 46 }); }, null, B + 0.9);
    rest(tl, 1.3);
  },
};
