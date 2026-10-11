// The child: a jointed paper puppet built from separate cut-out pieces
// (head x3 expressions, torso, upper arm, forearm + hand, leg). Limbs pivot on
// shoulders / elbows / hips / neck, so every scene can pose the same character.
import { Node2D, Sprite } from './sprite.js';
import { tex, artSize } from './assets.js';
import { shapes } from './shapes.js';
import { DEG } from '../core/util.js';

export const KID_ART = ['kid_head_a', 'kid_head_b', 'kid_head_c', 'kid_torso', 'kid_upperarm', 'kid_forearm', 'kid_leg'];

// Joint positions measured on the artwork, normalised with y pointing DOWN (image space).
const RIG = {
  torso: { hip: [0.5, 0.8], neck: [0.5, 0.075], shoulder: [0.185, 0.215], hipJoint: [0.305, 0.8] },
  upperarm: { pivot: [0.6, 0.24], end: [0.36, 0.76] },
  forearm: { pivot: [0.32, 0.16], end: [0.62, 0.72] },
  leg: { pivot: [0.33, 0.14], sole: 0.93 },
  head: { pivot: [0.5, 0.894] },
};

/** Height of the puppet in art pixels (sole to top of hair), used to size it in stage units. */
const ART_HEIGHT = 985;

const px = (name) => artSize(name);

/** Angle (deg) that rotates the art's pivot->end vector to point straight down. */
function restAngle(name, pivot, end) {
  const { w, h } = px(name);
  const vx = (end[0] - pivot[0]) * w;
  const vy = -(end[1] - pivot[1]) * h; // to y-up
  const len = Math.hypot(vx, vy);
  return { rest: -90 - Math.atan2(vy, vx) / DEG, len };
}

export class Kid extends Node2D {
  /**
   * @param o { height: stage units, order: base render order }
   * Origin = the ground between the feet.
   */
  constructor(o = {}) {
    super();
    const height = o.height ?? 430;
    const k = height / ART_HEIGHT;
    const order = o.order ?? 100;
    this.baseOrder = order;
    this.k = k;

    // contact shadow on the ground (stays put while the body lifts)
    this.groundShadow = new Sprite(shapes.blob(), { w: 300 * k * 2.1, shadow: false, order: order - 2 });
    this.groundShadow.opacity = 0.55;
    this.add(this.groundShadow);

    this.rigRoot = new Node2D();
    this.rigRoot.scale.set(k, k, 1);
    this.add(this.rigRoot);

    const T = px('kid_torso');
    const L = px('kid_leg');
    const legLen = (RIG.leg.sole - RIG.leg.pivot[1]) * L.h;

    // body: origin at the hip centre
    this.body = new Node2D().at(0, legLen).addTo(this.rigRoot);
    const fromHip = ([x, y]) => [(x - RIG.torso.hip[0]) * T.w, (RIG.torso.hip[1] - y) * T.h];

    // --- legs
    const [hx] = fromHip(RIG.torso.hipJoint);
    const mkLeg = (side) => {
      const joint = new Node2D().at(side * Math.abs(hx), 0).addTo(this.body);
      joint.scale.x = side < 0 ? -1 : 1; // art's shoe points right; mirror for the left leg
      const s = new Sprite(tex('kid_leg'), {
        w: L.w, anchor: [RIG.leg.pivot[0], 1 - RIG.leg.pivot[1]], order: order + (side < 0 ? 0 : 1),
      });
      joint.add(s);
      return { joint, sprite: s };
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

    // --- torso
    this.torso = new Sprite(tex('kid_torso'), {
      w: T.w, anchor: [RIG.torso.hip[0], 1 - RIG.torso.hip[1]], order: order + 4,
    });
    this.body.add(this.torso);

    // --- arms (art shows the screen-left arm; the right one is mirrored)
    const UA = px('kid_upperarm');
    const FA = px('kid_forearm');
    const ua = restAngle('kid_upperarm', RIG.upperarm.pivot, RIG.upperarm.end);
    const fa = restAngle('kid_forearm', RIG.forearm.pivot, RIG.forearm.end);
    const [sx, sy] = fromHip(RIG.torso.shoulder);
    const mkArm = (side) => {
      const mount = new Node2D().at(side * Math.abs(sx), sy).addTo(this.body);
      mount.scale.x = side < 0 ? 1 : -1;
      const shoulder = new Node2D().addTo(mount);
      const upper = new Sprite(tex('kid_upperarm'), {
        w: UA.w, anchor: [RIG.upperarm.pivot[0], 1 - RIG.upperarm.pivot[1]], order: order + 2,
      });
      upper.rot = ua.rest;
      shoulder.add(upper);
      const elbow = new Node2D().at(0, -ua.len).addTo(shoulder);
      const fore = new Sprite(tex('kid_forearm'), {
        w: FA.w, anchor: [RIG.forearm.pivot[0], 1 - RIG.forearm.pivot[1]], order: order + 8,
      });
      fore.rot = fa.rest;
      elbow.add(fore);
      const hand = new Node2D().at(0, -fa.len).addTo(elbow);
      return { mount, shoulder, elbow, upper, fore, hand };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    /** Attach things here so they travel with the hands. */
    this.handL = this.armL.hand;
    this.handR = this.armR.hand;

    // --- head
    const H = px('kid_head_a');
    const [, ny] = fromHip(RIG.torso.neck);
    this.neck = new Node2D().at(0, ny).addTo(this.body);
    this.head = new Sprite(tex('kid_head_a'), {
      w: H.w, anchor: [RIG.head.pivot[0], 1 - RIG.head.pivot[1]], order: order + 6,
    });
    this.neck.add(this.head);
    this._face = 'a';
    /** Things worn on the head (hats) go here; origin = top of the forehead. */
    this.crown = new Node2D().at(0, H.h * 0.6).addTo(this.neck);

    this.parts = [this.legL.sprite, this.legR.sprite, this.torso, this.armL.upper, this.armR.upper, this.armL.fore, this.armR.fore, this.head];

    // Tweenable joint angles in degrees. Arms: 0 = hanging down, 90 = straight out
    // sideways, 180 = straight up; negative swings across the body. Elbow adds to it.
    const kid = this;
    const j = { armL: 0, foreL: 0, armR: 0, foreR: 0, legL: 0, legR: 0, head: 0, lean: 0 };
    this.j = {
      get armL() { return j.armL; },
      set armL(v) { j.armL = v; kid.armL.shoulder.rot = -v; },
      get foreL() { return j.foreL; },
      set foreL(v) { j.foreL = v; kid.armL.elbow.rot = -v; },
      get armR() { return j.armR; },
      set armR(v) { j.armR = v; kid.armR.shoulder.rot = -v; },
      get foreR() { return j.foreR; },
      set foreR(v) { j.foreR = v; kid.armR.elbow.rot = -v; },
      get legL() { return j.legL; },
      set legL(v) { j.legL = v; kid.legL.joint.rot = -v; },
      get legR() { return j.legR; },
      set legR(v) { j.legR = v; kid.legR.joint.rot = v; },
      /** head tilt, positive tips toward screen-right */
      get head() { return j.head; },
      set head(v) { j.head = v; kid.neck.rot = -v; },
      /** whole body lean from the hips, positive toward screen-right */
      get lean() { return j.lean; },
      set lean(v) { j.lean = v; kid.body.rot = -v; },
    };
    this.j.armL = 8;
    this.j.armR = 8;
    this._lift = 0;
    this._legLen = legLen;
  }

  /** Height of the feet above the ground (the contact shadow stays below). */
  get lift() { return this._lift; }
  set lift(v) {
    this._lift = v;
    this.rigRoot.position.y = v;
    const f = Math.max(0.35, 1 - v / 420);
    this.groundShadow.scale.set(f, f, 1);
    this.groundShadow.opacity = 0.55 * f;
  }

  /** 'a' smile, 'b' eyes closed, 'c' big laugh */
  get face() { return this._face; }
  set face(v) {
    this._face = v;
    this.head.texture = tex(`kid_head_${v}`);
  }

  set opacity(v) {
    for (const p of this.parts) p.opacity = v;
    this.groundShadow.opacity = 0.55 * v;
  }

  /** Multiply the colour of every piece (night scenes). */
  tint(r, g, b) {
    for (const p of this.parts) p.tint(r, g, b);
    return this;
  }

  /**
   * Pose an arm while keeping whatever the hand holds upright.
   * side 'L' | 'R'; item is a node attached to that hand; tilt = extra lean in degrees.
   */
  carry(tl, side, item, arm, fore, duration = 0.4, at, ease = 'power2.inOut', tilt = 0) {
    tl.to(this.j, { [`arm${side}`]: arm, [`fore${side}`]: fore, duration, ease }, at);
    tl.to(item, { rot: arm + fore + tilt, duration, ease }, at);
    return this;
  }

  /** Put a node in a hand right now (no tween), upright. Offsets are in hand space (art px). */
  give(side, item, { x = 0, y = 0, tilt = 0, order = 7 } = {}) {
    const hand = side === 'L' ? this.handL : this.handR;
    hand.add(item);
    item.position.set(x, y, 0);
    item.rot = this.j[`arm${side}`] + this.j[`fore${side}`] + tilt;
    if (item.order !== undefined) item.order = this.baseOrder + order;
    return this;
  }

  /** Move forearms in front of / behind things by shifting their render order. */
  foreOrder(side, offset) {
    (side === 'L' ? this.armL : this.armR).fore.order = this.baseOrder + offset;
  }

  /** Adds a quick blink to a timeline. */
  blink(tl, at) {
    tl.call(() => { if (this._face === 'a') this.head.texture = tex('kid_head_b'); }, null, at);
    tl.call(() => { if (this._face === 'a') this.head.texture = tex('kid_head_a'); }, null, at + 0.13);
    return this;
  }

  /**
   * Paper-puppet walk: slides to `toX` with alternating leg swings and little hops.
   * Leaves the arms free unless `swing` is true.
   */
  walk(tl, at, toX, duration = 1, { steps = 4, swing = true, hop = 14 } = {}) {
    const step = duration / steps;
    tl.to(this, { x: toX, duration, ease: 'sine.inOut' }, at);
    for (let i = 0; i < steps; i++) {
      const a = i % 2 === 0 ? 1 : -1;
      const t = at + i * step;
      const target = { legL: -13 * a, legR: 13 * a, lean: 3 * a };
      if (swing) Object.assign(target, { armL: 12 + 14 * a, armR: 12 - 14 * a });
      tl.to(this.j, { ...target, duration: step * 0.9, ease: 'sine.inOut' }, t);
      tl.to(this, { lift: hop, duration: step * 0.45, ease: 'sine.out' }, t);
      tl.to(this, { lift: 0, duration: step * 0.45, ease: 'sine.in' }, t + step * 0.45);
    }
    const rest = { legL: 0, legR: 0, lean: 0 };
    if (swing) Object.assign(rest, { armL: 8, armR: 8 });
    tl.to(this.j, { ...rest, duration: 0.2, ease: 'sine.out' }, at + duration);
    return this;
  }

  /** Squash down then spring up into the air and land again. `up` = jump height. */
  jump(tl, at, up = 70, { rise = 0.26, fall = 0.24 } = {}) {
    tl.to(this.scale, { y: 0.9, x: 1.07, duration: 0.14, ease: 'power2.out' }, at);
    tl.to(this.scale, { y: 1.06, x: 0.96, duration: 0.1, ease: 'power2.out' }, at + 0.14);
    tl.to(this, { lift: up, duration: rise, ease: 'power2.out' }, at + 0.14);
    tl.to(this, { lift: 0, duration: fall, ease: 'power2.in' }, at + 0.14 + rise);
    tl.to(this.scale, { y: 0.9, x: 1.08, duration: 0.08, ease: 'power2.out' }, at + 0.14 + rise + fall);
    tl.to(this.scale, { y: 1, x: 1, duration: 0.55, ease: 'elastic.out(1.1, 0.4)' }, at + 0.22 + rise + fall);
    return at + 0.14 + rise; // time of the highest point
  }

  /** Adds a pose tween to a timeline: kid.pose(tl, { armL: 150, foreL: 10 }, 0.4, '<', 'back.out') */
  pose(tl, target, duration = 0.4, at, ease = 'power2.inOut') {
    tl.to(this.j, { ...target, duration, ease }, at);
    return this;
  }
}
