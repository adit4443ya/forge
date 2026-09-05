#!/usr/bin/env node
/* Scrolling is easy to break globally and invisible in a screenshot: the landing
   page must scroll the document, and the app must NOT (its panes scroll instead). */
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:4310';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };

const metrics = async (url) => {
  await p.goto(BASE + url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  return p.evaluate(() => {
    const de = document.documentElement;
    const before = window.scrollY;
    window.scrollTo(0, 4000);
    const moved = window.scrollY;
    window.scrollTo(0, 0);
    return {
      scrollH: de.scrollHeight, clientH: de.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      moved: moved - before,
      pane: (() => { const el = document.querySelector('.pane'); return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null; })(),
      hOverflow: de.scrollWidth - de.clientWidth,
    };
  });
};

console.log('\nlanding page');
{
  const m = await metrics('/');
  ok('document is taller than the viewport', m.scrollH > m.clientH + 400, `${m.scrollH}px vs ${m.clientH}px`);
  ok('body does not clip overflow', m.bodyOverflow !== 'hidden', `overflow-y: ${m.bodyOverflow}`);
  ok('the page actually scrolls', m.moved > 400, `moved ${m.moved}px`);
  ok('no horizontal overflow', m.hOverflow <= 0, `${m.hOverflow}px`);
}

console.log('\nlogin page');
{
  const m = await metrics('/login');
  ok('no horizontal overflow', m.hOverflow <= 0, `${m.hOverflow}px`);
  ok('fits or scrolls, never clipped', m.bodyOverflow !== 'hidden');
}

console.log('\napp surfaces (must NOT scroll the document)');
for (const url of ['/today', '/practice', '/learn', '/labs', '/progress']) {
  const m = await metrics(url);
  const pageScrolls = m.moved > 4;
  ok(`${url.padEnd(10)} document stays put`, !pageScrolls, pageScrolls ? `moved ${m.moved}px` : '');
  if (m.pane) ok(`${url.padEnd(10)} inner pane owns scrolling`, m.pane.ch > 200, `pane ${m.pane.ch}px tall`);
}

console.log('\nguide page');
{
  const m = await metrics('/learn/guide/17');
  ok('document stays put', m.moved <= 4, m.moved > 4 ? `moved ${m.moved}px` : '');
  const inner = await p.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === 'auto');
    if (!el) return null;
    const b4 = el.scrollTop; el.scrollTop = 3000; const after = el.scrollTop; el.scrollTop = 0;
    return after - b4;
  });
  ok('guide body scrolls internally', inner !== null && inner > 400, `moved ${inner}px`);
}

/* Small viewport: the app must not become unusable. */
console.log('\nnarrow viewport (390x740)');
await p.setViewport({ width: 390, height: 740 });
for (const url of ['/', '/practice']) {
  const m = await metrics(url);
  ok(`${url.padEnd(10)} no horizontal overflow`, m.hOverflow <= 1, `${m.hOverflow}px`);
}

await b.close();
console.log(fails ? `\n\x1b[31m${fails} scroll problem(s)\x1b[0m\n` : '\n\x1b[32mscroll behaviour correct\x1b[0m\n');
process.exit(fails ? 1 : 0);
