// A - apple - "Pick an apple."
// The child walks up to the apple tree, jumps, and picks an apple.
export default {
  art: ['tree', 'cloud1', 'cloud2', 'bush', 'flower_r', 'flower_y'],
  kid: true,
  backdrop: 'meadow',
  build(S) {
    const { tl, fx, sfx, ground } = S;

    const c1 = S.sprite('cloud1', { w: 250, order: -940, shadow: { alpha: 0.1 } }).at(-330, 360);
    const c2 = S.sprite('cloud2', { w: 200, order: -940, shadow: { alpha: 0.1 } }).at(330, 420);
    S.loop(c1, { x: -290, duration: 5 });
    S.loop(c2, { x: 300, duration: 6 });

    const tree = S.sprite('tree', { h: 730, anchor: [0.5, 0.02], seg: 16, order: 20 }).at(118, ground - 22);
    S.loop(tree, { bend: 12, duration: 2.6 });
    S.sprite('bush', { w: 200, anchor: [0.5, 0.05], order: 30 }).at(-410, ground - 30);
    S.sprite('flower_r', { w: 70, anchor: [0.5, 0.02], order: 31 }).at(-300, ground - 52);
    S.sprite('flower_y', { w: 64, anchor: [0.5, 0.02], order: 31 }).at(430, ground - 60);

    // the apple to pick hangs low on the left side of the crown
    const apple = S.sprite('apple', { w: 104, order: 25 }).at(-112, 112);
    apple.rot = -6;

    const kid = S.kid({ height: 430 }).at(-640, ground);
    kid.walk(tl, 0.15, -236, 1.15, { steps: 4 });

    // notices the apple
    tl.to(kid.j, { head: 9, duration: 0.25, ease: 'power2.out' }, 1.35);
    tl.to(apple, { rot: 10, duration: 0.14, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.35);
    tl.call(() => fx.sparkle(-112, 112, 6, { spread: 190, size: 34 }), null, 1.42);
    tl.call(() => sfx.sparkle(), null, 1.42);
    kid.blink(tl, 1.6);

    // jump and reach
    const T = 2.0;
    S.say(T - 0.12);
    tl.to(kid.j, { armR: -20, foreR: -10, armL: 30, duration: 0.14, ease: 'power2.out' }, T);
    tl.call(() => { kid.face = 'c'; sfx.boing(); }, null, T + 0.12);
    const top = kid.jump(tl, T, 86, { rise: 0.3, fall: 0.26 });
    tl.to(kid.j, { armR: 168, foreR: 6, armL: 62, foreL: 30, head: 4, duration: 0.3, ease: 'power3.out' }, T + 0.14);

    // grab it at the top of the jump
    tl.call(() => {
      kid.handR.attach(apple);
      apple.order = kid.baseOrder + 7;
      sfx.pop(1.2);
      fx.leaves(60, 190, 9, { spreadX: 240 });
      fx.sparkle(-112, 134, 7, { spread: 230, size: 36 });
    }, null, top);
    tl.to(apple, { x: 0, y: -14, rot: 180, duration: 0.12, ease: 'power2.out' }, top);
    tl.fromTo(tree, { bend: -30 }, { bend: 0, duration: 1.3, ease: 'elastic.out(1.3, 0.2)' }, top);

    // land, hold the apple up proudly
    tl.to(kid.j, { armR: 118, foreR: 44, armL: 20, foreL: 10, head: 0, duration: 0.5, ease: 'back.out(1.6)' }, top + 0.26);
    tl.to(apple, { rot: 172, duration: 0.5, ease: 'back.out(1.6)' }, top + 0.26);
    tl.call(() => sfx.thud(), null, top + 0.28);
    tl.call(() => {
      const p = apple.getWorldPosition(apple.position.clone());
      fx.sparkle(p.x, p.y, 12, { spread: 300, size: 46 });
      sfx.chime();
    }, null, top + 0.95);
    tl.to(kid, { lift: 26, duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.out' }, top + 0.95);
    tl.to(kid.j, { head: -6, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, top + 1.0);
    tl.to({}, { duration: 0.9 });
  },
};
