#!/usr/bin/env node
/* The four follow-ups from the audit: pass-work track, session context that
   survives navigation, scratchpad notes you can find again, and a review queue
   that says how it fills. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 950 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const seed = () => p.evaluate(() => localStorage.setItem('forge-progress-v2',
  JSON.stringify({ version: 2, role: 'compiler', stamps: { role: Date.now() }, prefs: { rolePicked: { value: true, at: Date.now() } } })));

console.log('\n1 · the pass-work track');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await seed();
for (const id of ['passwork-01', 'passwork-02', 'passwork-03']) {
  const r = await fetch(`${B}/labs/${id}`);
  ok(`/labs/${id} renders`, r.status === 200, `HTTP ${r.status}`);
}
await p.goto(`${B}/labs/passwork-01`, { waitUntil: 'networkidle0' }); await w(800);
const lab = await p.evaluate(() => ({ steps: document.querySelectorAll('.lab-step').length, t: document.body.innerText }));
ok(`bisect lab has steps (${lab.steps})`, lab.steps >= 4);
ok('it teaches opt-bisect-limit', /opt-bisect-limit/.test(lab.t));
ok('and llvm-reduce / FileCheck exist in the track', await (await fetch(`${B}/labs/passwork-03`)).text().then((t) => /llvm-reduce/.test(t) && /FileCheck/.test(t)));

console.log('\n2 · the session follows you');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await w(700);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^▶ Start session/.test(x.textContent.trim()))?.click());
await w(900);
ok('no bar on Today (the runner is already there)', await p.$('.sess-bar') === null);
await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(900);
const bar = await p.evaluate(() => {
  const el = document.querySelector('.sess-bar');
  return el ? el.innerText.replace(/\n/g, ' | ') : null;
});
ok('the bar appears on other surfaces', bar !== null, bar || '');
ok('it shows the step counter', /step \d+ of \d+/.test(bar || ''), bar || '');
ok('it shows a clock', /\d\d:\d\d/.test(bar || ''));
ok('it offers a way back', /back to session/.test(bar || ''));
await p.evaluate(() => [...document.querySelectorAll('.sess-btn')].find((x) => /finish/.test(x.textContent))?.click());
await w(600);
ok('finishing clears it', await p.$('.sess-bar') === null);

console.log('\n3 · scratchpad notes are findable');
await p.goto(`${B}/practice?problem=1`, { waitUntil: 'networkidle0' }); await w(800);
await p.keyboard.press('KeyN'); await w(500);
await p.type('.pad-area', 'invariant: dp[s] means a subset sums to s'); await w(900);
await p.goto(`${B}/labs`, { waitUntil: 'networkidle0' }); await w(700);
await p.keyboard.press('KeyN'); await w(500);
const count = await p.evaluate(() => [...document.querySelectorAll('.pad-btn')].find((x) => /note/.test(x.textContent))?.textContent.trim());
ok('the pad shows how many notes exist', /\d+ note/.test(count || ''), count || '');
await p.evaluate(() => [...document.querySelectorAll('.pad-btn')].find((x) => /note/.test(x.textContent))?.click());
await w(500);
const rows = await p.$$eval('.pad-index-row', (e) => e.map((x) => x.innerText.replace(/\n/g, ' · ')));
ok(`the index lists notes from other pages (${rows.length})`, rows.length > 0, rows[0] || '');
ok('it names where each came from', /problem 1/.test(rows.join(' ')), rows.join(' | ').slice(0, 80));

console.log('\n4 · the review queue explains itself');
await p.goto(`${B}/learn?tab=review`, { waitUntil: 'networkidle0' }); await w(900);
const rev = await p.evaluate(() => document.body.innerText);
ok('no longer points at an invisible button', !/Open any answer in a guide or module/.test(rev));
ok('lists the ways cards arrive', (await p.$$eval('.rev-way', (e) => e.length).catch(() => 0)) === 3);
await p.evaluate(() => document.querySelectorAll('.rev-way')[1]?.click()); await w(900);
ok('a route actually navigates', /tab=rapid/.test(p.url()), p.url().replace(B, ''));

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mall four follow-ups work\x1b[0m\n');
process.exit(fails ? 1 : 0);
