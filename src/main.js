import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/base.css';

// Little hands press long and pinch: keep the browser from reacting.
// (Double-tap zoom is already off through `touch-action: manipulation`.)
for (const ev of ['contextmenu', 'gesturestart', 'gesturechange', 'dragstart', 'selectstart']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}

function unsupported() {
  const box = document.createElement('div');
  box.className = 'unsupported';
  box.innerHTML =
    '<b>ABC Picture Book</b><span>This picture book needs a newer browser.<br>请使用较新的浏览器（如 Chrome、Safari、Edge）打开。</span>';
  document.body.append(box);
}

async function boot() {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) {
    unsupported();
    return;
  }
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  try {
    const [{ route, start }, home] = await Promise.all([
      import('./core/router.js'),
      import('./pages/home.js'),
      import('./gl/engine.js'),
      import('./core/audio.js'),
    ]);
    route(/^$/, async () => home);
    route(/^([a-z])$/, () => import('./pages/word.js'));
    route(/^([a-z])\/story$/, () => import('./pages/story.js'));
    if (import.meta.env.DEV) route(/^lab(?:\/(.*))?$/, () => import('./pages/lab.js'));

    if (document.fonts) {
      await Promise.race([
        Promise.all([document.fonts.load('600 40px Fredoka'), document.fonts.load('700 40px Fredoka')]),
        new Promise((res) => setTimeout(res, 1800)),
      ]);
    }
    start();
  } catch (err) {
    console.error(err);
    unsupported();
  }
}

boot();
