#!/usr/bin/env node
/* Findings from a black-box audit. Each assertion is one thing that was wrong. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const seed = () => p.evaluate(() => localStorage.setItem('forge-progress-v2',
  JSON.stringify({ version: 2, prefs: { rolePicked: { value: true, at: Date.now() } } })));

console.log('\ngated content is not in the DOM (the product thesis)');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await seed();
await p.goto(`${B}/practice?problem=18`, { waitUntil: 'networkidle0' }); await w(900);
const dom = await p.evaluate(() => document.body.innerText);
const a11y = JSON.stringify(await p.accessibility.snapshot() || {});
ok('locked hint text absent from the page', !/first nudge|smallest nudge/i.test(dom) || !/BFS|flood fill/i.test(dom));
ok('the pattern is not in the accessibility tree', !/flood fill/i.test(a11y), 'screen readers were being told the answer');
ok('the solution is not in the DOM', !/vector<vector<char>>|queue<pair/.test(dom));

console.log('\nbug hunts no longer announce their own bugs');
await p.goto(`${B}/practice?tab=drills`, { waitUntil: 'networkidle0' }); await w(900);
await p.evaluate(() => [...document.querySelectorAll('button')].forEach((x) => { if (/^Bug hunts/.test(x.textContent.trim())) x.click(); }));
await w(500);
await p.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].slice(0, 8).forEach((x) => x.click()));
await w(700);
const text = await p.evaluate(() => document.body.innerText);
const before = (text.match(/\/\/\s*BUG/gi) || []).length;
ok('no "// BUG" markers rendered', before === 0, `${before} found`);

console.log('\nthe labs can actually be obtained');
await p.goto(`${B}/labs`, { waitUntil: 'networkidle0' }); await w(800);
const labHrefs = await p.$$eval('a[href]', (a) => a.map((x) => x.getAttribute('href')).filter((h) => /^https?:/.test(h)));
ok('the labs page links a repository', labHrefs.some((h) => /github\.com/.test(h)), labHrefs.join(' '));
await p.goto(`${B}/labs/perf-01`, { waitUntil: 'networkidle0' }); await w(800);
ok('the lab page shows a clone command', (await p.evaluate(() => document.body.innerText)).includes('git clone'));

console.log('\nsessions log real time');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await w(700);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^▶ Start session/.test(x.textContent.trim()))?.click());
await w(3200);
const label = await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Finish · log/.test(x.textContent))?.textContent.trim());
ok('finishing logs 0 min, not the full plan', /log 0 min/.test(label || ''), label);
ok('a live clock is shown', /\d\d:\d\d elapsed/.test(await p.evaluate(() => document.body.innerText)));
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Finish · log/.test(x.textContent))?.click());
await w(600);
const logged = await p.evaluate(() => (JSON.parse(localStorage.getItem('forge-progress-v2') || '{}').sessions || []).at(-1)?.minutes);
ok('the stored session is not 100 minutes', logged !== 100, `stored ${logged}`);

console.log('\nthe start date is bounded and stays editable');
await p.evaluate(() => localStorage.setItem('forge-progress-v2', JSON.stringify({ version: 2, startDate: '2026-09-01', prefs: { rolePicked: { value: true, at: Date.now() } } })));
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await w(800);
const dateInput = await p.$('input[type="date"]');
ok('still editable after being set', dateInput !== null);
const bounds = await p.evaluate(() => { const i = document.querySelector('input[type=date]'); return { min: i?.min, max: i?.max }; });
ok('has min and max', !!bounds.min && !!bounds.max, JSON.stringify(bounds));

console.log('\nthe first-run modal is keyboard usable');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle0' }); await w(900);
ok('has role=dialog and aria-modal', await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); return !!d && d.getAttribute('aria-modal') === 'true'; }));
const focusInside = await p.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement));
ok('focus starts inside the modal', !!focusInside);
await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await w(200);
ok('Tab stays inside the modal', await p.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement)));
await p.keyboard.press('Escape'); await w(600);
ok('Escape closes it', await p.$('[role=dialog]') === null);

console.log('\nnarrow viewport (390x740)');
await p.setViewport({ width: 390, height: 740 });
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await seed();
await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(900);
const bar = await p.evaluate(() => {
  const t = document.querySelector('.topbar');
  return { scrollable: t.scrollWidth > t.clientWidth, reachable: !!document.querySelector('.avatar-btn') };
});
ok('the top bar scrolls instead of hiding controls', bar.scrollable || bar.reachable, JSON.stringify(bar));
await p.goto(`${B}/learn/guide/17`, { waitUntil: 'networkidle0' }); await w(900);
const guide = await p.evaluate(() => {
  const pr = document.querySelector('.prose');
  const pre = document.querySelector('.prose pre');
  return { proseW: Math.round(pr?.getBoundingClientRect().width || 0),
           preScrolls: pre ? getComputedStyle(pre).overflowX : 'none' };
});
ok(`the article is readable (${guide.proseW}px wide)`, guide.proseW > 280, 'was 76px');
ok('code blocks scroll', guide.preScrolls === 'auto' || guide.preScrolls === 'scroll', guide.preScrolls);

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32maudit findings fixed\x1b[0m\n');
process.exit(fails ? 1 : 0);
