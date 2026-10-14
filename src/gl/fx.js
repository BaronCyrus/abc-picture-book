// Little paper particles: bursts of stars, hearts, leaves, drops, bubbles ...
import { Sprite } from './sprite.js';
import { shapes } from './shapes.js';
import { rand, pick } from '../core/util.js';

const CONFETTI = ['#E9523C', '#F28B30', '#F4B81F', '#6FB34A', '#2FAE9E', '#3F93D6', '#9C60C6', '#E5619F'];

export class Particles {
  constructor(parent, order = 600) {
    this.parent = parent;
    this.order = order;
    this.items = [];
  }

  /**
   * @param p { tex, x, y, vx, vy, g, drag, life, size, grow, rot, spin, sway, order, aspect }
   *   g: gravity (units/s^2, positive pulls down), grow: size multiplier reached at end of life
   */
  emit(p) {
    const sprite = new Sprite(p.tex, { w: p.size ?? 40, shadow: p.shadow ?? false, order: p.order ?? this.order });
    sprite.at(p.x, p.y);
    sprite.rot = p.rot ?? 0;
    sprite.opacity = 0;
    this.parent.add(sprite);
    this.items.push({
      sprite,
      vx: p.vx ?? 0,
      vy: p.vy ?? 0,
      g: p.g ?? 0,
      drag: p.drag ?? 0,
      life: p.life ?? 1,
      age: -(p.delay ?? 0),
      spin: p.spin ?? 0,
      grow: p.grow ?? 1,
      sway: p.sway ?? 0,
      swayF: rand(2, 4),
      phase: rand(6.28),
      alpha: p.alpha ?? 1,
      x0: p.x,
    });
    return sprite;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age < 0) continue;
      const k = it.age / it.life;
      if (k >= 1) {
        this.kill(it.sprite);
        this.items.splice(i, 1);
        continue;
      }
      const s = it.sprite;
      it.vy -= it.g * dt;
      if (it.drag) {
        const d = Math.exp(-it.drag * dt);
        it.vx *= d;
        it.vy *= d;
      }
      s.position.x += it.vx * dt + Math.cos(it.age * it.swayF + it.phase) * it.sway * dt;
      s.position.y += it.vy * dt;
      s.rot += it.spin * dt;
      const sc = 1 + (it.grow - 1) * k;
      const pop = Math.min(1, it.age / 0.12);
      s.scale.set(sc * (0.4 + 0.6 * pop), sc * (0.4 + 0.6 * pop), 1);
      s.opacity = it.alpha * Math.min(1, it.age / 0.08) * Math.min(1, (1 - k) / 0.3);
    }
  }

  get active() {
    return this.items.length > 0;
  }

  kill(sprite) {
    if (sprite.parent) sprite.parent.remove(sprite);
    sprite.mesh.geometry.dispose();
    sprite.mesh.material.dispose();
    if (sprite.shadowMesh) {
      sprite.shadowMesh.geometry.dispose();
      sprite.shadowMesh.material.dispose();
    }
  }

  clear() {
    for (const it of this.items) this.kill(it.sprite);
    this.items.length = 0;
  }

  // ---------------------------------------------------------- recipes ----

  /** celebratory pop of stars and twinkles */
  sparkle(x, y, n = 10, { spread = 260, size = 44, colors = ['#ffd23f', '#ffffff', '#ffb347'] } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0.5);
      const v = spread * rand(0.55, 1);
      this.emit({
        tex: i % 2 ? shapes.star(pick(colors)) : shapes.spark(pick(colors)),
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v + 80,
        g: 260, drag: 1.6, life: rand(0.7, 1.1), size: size * rand(0.6, 1.1),
        spin: rand(-220, 220), rot: rand(360),
      });
    }
  }

  hearts(x, y, n = 5, { size = 50, color = '#ef5b78' } = {}) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.heart(color),
        x: x + rand(-50, 50), y: y + rand(-10, 20),
        vx: rand(-30, 30), vy: rand(110, 180),
        life: rand(1.2, 1.8), size: size * rand(0.6, 1.1), sway: 40, delay: i * 0.12,
        rot: rand(-15, 15), grow: 1.25,
      });
    }
  }

  leaves(x, y, n = 8, { spreadX = 200, color = ['#5fae3f', '#86c765', '#3f8f36'] } = {}) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.leaf(pick(color)),
        x: x + rand(-spreadX, spreadX), y: y + rand(-40, 40),
        vx: rand(-40, 40), vy: rand(-60, 20), g: 150, drag: 0.8,
        life: rand(1.6, 2.4), size: rand(36, 56), spin: rand(-160, 160), rot: rand(360),
        sway: 90, delay: rand(0.25), shadow: {},
      });
    }
  }

  drops(x, y, n = 10, { color = '#7fcdf3', power = 420, angle = 90, cone = 70, size = 26, g = 900 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = ((angle + rand(-cone, cone) / 2) * Math.PI) / 180;
      const v = power * rand(0.55, 1);
      this.emit({
        tex: shapes.drop(color),
        x: x + rand(-10, 10), y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, g,
        life: rand(0.7, 1.1), size: size * rand(0.7, 1.2), rot: rand(-20, 20),
      });
    }
  }

  bubbles(x, y, n = 6, { spreadX = 60, size = 34 } = {}) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.bubble(),
        x: x + rand(-spreadX, spreadX), y: y + rand(-20, 20),
        vy: rand(90, 170), life: rand(1.6, 2.6), size: size * rand(0.5, 1.2),
        sway: 50, delay: i * 0.14, grow: 1.3,
      });
    }
  }

  puffs(x, y, n = 5, { color = '#ffffff', size = 70, vx = 0, vy = 60, spread = 60, alpha = 0.9 } = {}) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.puff(color),
        x: x + rand(-spread, spread) * 0.4, y: y + rand(-10, 10),
        vx: vx + rand(-spread, spread), vy: vy + rand(-20, 40), drag: 1.5,
        life: rand(0.6, 1.0), size: size * rand(0.6, 1.1), grow: 1.7, rot: rand(-20, 20),
        delay: i * 0.04, alpha,
      });
    }
  }

  confetti(x, y, n = 26, { power = 620 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0.15, 0.85) * Math.PI;
      const v = power * rand(0.5, 1);
      this.emit({
        tex: i % 3 ? shapes.rect(pick(CONFETTI), 64, 36, 6) : shapes.disc(pick(CONFETTI)),
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 620, drag: 1.2,
        life: rand(1.4, 2.2), size: rand(18, 32), spin: rand(-420, 420), rot: rand(360), sway: 60,
      });
    }
  }

  notes(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.note(pick(['#6470d2', '#E5619F', '#2FAE9E'])),
        x: x + rand(-30, 30), y,
        vx: rand(-40, 60), vy: rand(110, 170),
        life: rand(1.2, 1.7), size: rand(38, 52), sway: 50, delay: i * 0.18, rot: rand(-15, 15),
      });
    }
  }

  zzz(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      this.emit({
        tex: shapes.zed('#ffffff'),
        x: x + i * 26, y: y + i * 30,
        vx: 28, vy: 60, life: 1.8, size: 34 + i * 12, delay: i * 0.4, sway: 20, rot: -8,
      });
    }
  }
}
