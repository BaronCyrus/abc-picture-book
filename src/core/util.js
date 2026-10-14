export const BASE = import.meta.env.BASE_URL;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const DEG = Math.PI / 180;

/** Tiny hyperscript helper: h('button.btn', {onclick}, child, ...) */
export function h(spec, props, ...kids) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  next: '<path d="M5 12h13"/><path d="m12.5 6 6 6-6 6"/>',
  prev: '<path d="M19 12H6"/><path d="m11.5 6-6 6 6 6"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4 4.5v4.2h4.2"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  mic: '<rect x="8.5" y="3" width="7" height="11.5" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
};

/** Pointing hand with a tap ring, used for "tap here" hints. */
export const HAND_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring" cx="24" cy="20" r="15" fill="none" stroke="#fff" stroke-width="4"/><path d="M24 20v22l-6-5c-3-2-7 1-4 5l11 14c2 3 5 4 9 4h8c6 0 10-4 10-10V40c0-5-7-6-8-1v-3c0-5-7-6-8-1v-2c0-5-8-5-8 0V20c0-6-4-6-4 0z" fill="#fffaf0" stroke="#3b3355" stroke-width="3" stroke-linejoin="round"/></svg>';

export function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Resolves on the next animation frame (or after n frames). */
export const nextFrame = (n = 1) =>
  new Promise((res) => {
    const step = () => (--n <= 0 ? res() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

export const wait = (ms) => new Promise((res) => setTimeout(res, ms));

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

/** Mix two hex colours, returns hex. */
export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t) * 255));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
