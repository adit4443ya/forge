import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:4310';
const errors = [];
let cur = 'boot';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => errors.push(`[${cur}] PAGEERROR: ${e.message.slice(0, 260)}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${cur}] CONSOLE: ${m.text().slice(0, 260)}`); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `/tmp/forge-${n}.png` });
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

/* ── surfaces ─────────────────────────────────────────────────────────── */
for (const [path, name] of [['/today','today'],['/practice','practice'],['/learn','learn'],['/labs','labs'],['/progress','progress']]) {
  cur = name;
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(600);
  const t = await text();
  console.log(`${name.padEnd(9)} ${String(t.length).padStart(6)} chars  ${t.slice(0, 62)}`);
  if (t.length < 200) errors.push(`[${name}] page is nearly empty`);
  await shot(name);
}

/* ── keyboard navigation changes the URL ─────────────────────────────── */
cur = 'keys';
await page.goto(BASE + '/today', { waitUntil: 'networkidle0' });
await wait(400);
await page.keyboard.press('Digit2'); await wait(700);
console.log('key 2 ->', new URL(page.url()).pathname);
if (!page.url().includes('/practice')) errors.push('keyboard nav did not route');

/* ── command palette ─────────────────────────────────────────────────── */
cur = 'palette';
await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
await wait(400);
await page.keyboard.type('timer wheel'); await wait(500);
const n = await page.$$eval('[data-i]', (e) => e.length).catch(() => 0);
console.log('palette "timer wheel":', n, 'results');
if (!n) errors.push('palette returned nothing');
await shot('palette');
await page.keyboard.press('Enter'); await wait(900);
console.log('opened ->', new URL(page.url()).search, '|', (await text()).slice(0, 48));
const gates = await page.$$eval('button[aria-expanded]', (e) => e.length).catch(() => 0);
console.log('gates on problem page:', gates);
if (gates < 4) errors.push(`expected 4 gates, saw ${gates}`);
await shot('problem');

/* ── deep link survives a reload (real URLs) ─────────────────────────── */
cur = 'deeplink';
const deep = page.url();
await page.goto(deep, { waitUntil: 'networkidle0' }); await wait(700);
const stillThere = (await text()).includes('Timer Wheel');
console.log('deep link survives reload:', stillThere);
if (!stillThere) errors.push('deep link did not restore after reload');

/* ── guides: every one over HTTP (cheap), a sample in the browser ────── */
cur = 'guides';
const { GUIDES } = await import('../src/data/generated/guides.js');
let httpOk = 0;
for (const g of GUIDES) {
  const res = await fetch(`${BASE}/learn/guide/${g.num}`);
  const html = await res.text();
  if (res.status !== 200) { errors.push(`[guide ${g.num}] HTTP ${res.status}`); continue; }
  // Server-rendered: the guide's own title must be in the HTML before any JS runs.
  if (!html.includes(g.title.slice(0, 28).replace(/&/g, '&amp;'))) { errors.push(`[guide ${g.num}] title missing from SSR html`); continue; }
  if (html.length < 8000) { errors.push(`[guide ${g.num}] SSR html only ${html.length} bytes`); continue; }
  httpOk++;
}
console.log(`guides server-rendered: ${httpOk}/${GUIDES.length}`);

for (const g of ['01', '07', '17', '22']) {
  cur = `guide ${g}`;
  const before = errors.length;
  await page.goto(`${BASE}/learn/guide/${g}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(900);
  const len = await page.evaluate(() => document.querySelector('.prose')?.innerText.length || 0);
  const code = await page.$$eval('pre, code', (e) => e.length).catch(() => 0);
  console.log(`  guide ${g}: ${len} chars, ${code} code blocks${errors.length > before ? '  <-- error' : ''}`);
  if (len < 500) errors.push(`[guide ${g}] rendered body only ${len} chars`);
}
await shot('guide');

/* ── progress persists across reloads ────────────────────────────────── */
cur = 'persist';
await page.goto(BASE + '/labs', { waitUntil: 'networkidle0' }); await wait(600);
await page.evaluate(() => document.querySelector('button[title="Mark done"]')?.click());
await wait(400);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('forge-progress-v2') || '{}'));
const labCount = Object.keys(saved.labs || {}).length;
await page.reload({ waitUntil: 'networkidle0' }); await wait(700);
const after = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('forge-progress-v2') || '{}').labs || {}).length);
console.log(`progress persisted: ${labCount} lab(s) marked, ${after} after reload`);
if (!labCount || labCount !== after) errors.push('progress did not persist across reload');

/* ── theme toggle persists ───────────────────────────────────────────── */
cur = 'theme';
await page.evaluate(() => document.querySelector('[title^="Switch to"]')?.click());
await wait(400);
const mode = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
const mode2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log(`theme: ${mode} -> after reload ${mode2}`);
if (mode !== mode2) errors.push('theme did not persist');
await shot('light');

await browser.close();
console.log(`\n=== ERRORS (${errors.length}) ===`);
errors.slice(0, 20).forEach((e) => console.log(' ', e));
process.exit(errors.length ? 1 : 0);
