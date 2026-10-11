// Cartoon iris wipe between pages: a coloured circle grows from where the child
// tapped until it fills the screen, then a hole opens onto the next page.
import gsap from 'gsap';

const svg = document.getElementById('wipe');
const path = svg.querySelector('path');
const state = { r: 0, x: 0, y: 0 };

const circle = (x, y, r) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

function reach(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 24;
}

export function cover({ x, y, color = '#fff8ea' } = {}) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.x = x ?? w / 2;
  state.y = y ?? h / 2;
  state.r = 0;
  path.setAttribute('fill', color);
  svg.style.display = 'block';
  const R = reach(state.x, state.y);
  return gsap.to(state, {
    r: R,
    duration: 0.48,
    ease: 'power2.in',
    onUpdate: () => path.setAttribute('d', circle(state.x, state.y, state.r)),
  });
}

export function reveal({ x, y } = {}) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.x = x ?? w / 2;
  state.y = y ?? h / 2;
  state.r = 0;
  const R = reach(state.x, state.y);
  const frame = `M0 0H${w}V${h}H0Z`;
  return gsap.to(state, {
    r: R,
    duration: 0.55,
    ease: 'power2.out',
    onUpdate: () => path.setAttribute('d', frame + circle(state.x, state.y, Math.max(0.01, state.r))),
    onComplete: () => {
      svg.style.display = 'none';
      path.setAttribute('d', '');
    },
  });
}

/** Screen fully covered right now (used on first load). */
export function coverNow(color = '#cfeaf9') {
  path.setAttribute('fill', color);
  path.setAttribute('d', `M0 0H${window.innerWidth}V${window.innerHeight}H0Z`);
  svg.style.display = 'block';
}
