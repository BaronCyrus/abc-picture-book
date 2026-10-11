// Dev-only playground: #/lab/<backdrop preset>
import { h } from '../core/util.js';
import { Backdrop, SCENES } from '../gl/backdrop.js';
import { world, setStageRect, hold, clearLayer, onFrame, invalidate } from '../gl/engine.js';
import { loadAll, tex } from '../gl/assets.js';
import { Sprite } from '../gl/sprite.js';
import { Kid, KID_ART } from '../gl/kid.js';
import { Particles } from '../gl/fx.js';
import gsap from 'gsap';

export async function create(root, preset = 'meadow') {
  const page = h('div.page');
  root.append(page);
  await loadAll([...KID_ART, 'tree', 'apple', 'cloud1', 'cloud2', 'bush', 'flower_r']);
  const bd = new Backdrop((SCENES[preset] || SCENES.meadow)());
  const layout = () => setStageRect(page.getBoundingClientRect());
  layout();

  const cloud = new Sprite(tex('cloud1'), { w: 260, order: -500, shadow: { alpha: 0.12 } }).at(-260, 330).addTo(world);
  const tree = new Sprite(tex('tree'), { h: 760, anchor: [0.5, 0.02], seg: 14, order: 20 }).at(190, -318).addTo(world);
  const kid = new Kid({ height: 430, order: 100 }).at(-170, -300).addTo(world);
  const apple = new Sprite(tex('apple'), { w: 110, order: 60 }).at(-40, 40).addTo(world);
  const fx = new Particles(world);
  const off = onFrame((dt) => fx.update(dt));
  const release = hold();
  window.__lab = { kid, tree, bd, apple, cloud, fx, gsap, world, invalidate };
  return {
    layout,
    destroy() {
      off();
      release();
      fx.clear();
      clearLayer(world);
      Backdrop.clear();
    },
  };
}
