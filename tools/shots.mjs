// Headless screenshot harness (dev only). Drives the local dev server with the
// system Chrome and writes frames to a folder.
//
//   node tools/shots.mjs <outDir> [--size 900x700] <job> [<job> ...]
//
// job formats:
//   story:b@0.7,1.5,end      story scene for letter b, frozen at those times
//   page:#/a@4               any route, screenshot after 4 seconds
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outDir = args.shift();
let size = [900, 700];
let dpr = 1;
const jobs = [];
while (args.length) {
  const a = args.shift();
  if (a === '--size') size = args.shift().split('x').map(Number);
  else if (a === '--dpr') dpr = Number(args.shift());
  else jobs.push(a);
}
mkdirSync(outDir, { recursive: true });
const BASE = process.env.SHOTS_BASE || 'http://localhost:5183/';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: dpr });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text());
});

await page.goto(BASE + '?autostart#/lab/meadow', { waitUntil: 'load' });
await page.waitForTimeout(1500);

for (const job of jobs) {
  const [target, spec = ''] = job.split('@');
  const [kind, arg] = [target.slice(0, target.indexOf(':')), target.slice(target.indexOf(':') + 1)];
  if (kind === 'story') {
    await page.evaluate((id) => { location.hash = `#/${id}/story`; }, arg);
    await page.waitForFunction((id) => window.__story && window.__story.id === id, arg, { timeout: 20000 });
    await page.waitForTimeout(900);
    const dur = await page.evaluate(() => window.__story.tl.duration());
    for (const tRaw of spec.split(',').filter(Boolean)) {
      const t = tRaw === 'end' ? dur : Number(tRaw);
      await page.evaluate((tt) => window.__story.at(tt), t);
      await page.waitForTimeout(140);
      const file = join(outDir, `${arg}_${tRaw === 'end' ? 'end' : t.toFixed(2)}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    }
    console.log(`story ${arg}: ${dur.toFixed(2)}s`);
  } else if (kind === 'play') {
    // real-time playback: play:a@0.3x12 -> 12 frames, one every 0.3 s, from the moment the page opens
    const [every, count] = spec.split('x').map(Number);
    await page.evaluate((id) => { location.hash = `#/${id}/story`; }, arg);
    await page.waitForFunction((id) => window.__story && window.__story.id === id, arg, { timeout: 20000 });
    for (let i = 0; i < count; i++) {
      await page.screenshot({ path: join(outDir, `${arg}_rt${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 80 });
      await page.waitForTimeout(every * 1000);
    }
    console.log(`play ${arg}`);
  } else {
    await page.evaluate((h) => { location.hash = h; }, arg);
    await page.waitForTimeout((Number(spec) || 4) * 1000);
    const name = arg.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
    await page.screenshot({ path: join(outDir, `page_${name}_${size[0]}x${size[1]}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`page ${arg}`);
  }
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await browser.close();
