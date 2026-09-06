#!/usr/bin/env node
/* A tab is navigation. If it does not reach the URL, the back button leaves the
   site, a reload loses your place, and nothing can be linked to. Found by an
   audit walking the running site, so it is asserted here. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const clickTab = async (label) => {
  await p.evaluate((t) => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t))?.click(), label);
  await w(650);
};
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.setItem('forge-progress-v2', JSON.stringify({ version: 2, prefs: { rolePicked: { value: true, at: Date.now() } } })));

console.log('\npractice tabs reach the URL');
await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(600);
for (const [label, expect] of [['Rapid fire', 'rapid'], ['Patterns', 'patterns'], ['Drills', 'drills']]) {
  await clickTab(label);
  ok(`${label.padEnd(11)} -> ?tab=${expect}`, p.url().includes(`tab=${expect}`), p.url().replace(B, ''));
}

console.log('\nreload keeps your place');
await p.reload({ waitUntil: 'networkidle0' }); await w(700);
ok('still on Drills after reload', (await p.evaluate(() => document.body.innerText)).includes('Bug hunts'));

console.log('\nback moves between tabs, not off the site');
await p.goBack({ waitUntil: 'networkidle0' }); await w(700);
ok('back goes to Patterns', p.url().includes('tab=patterns'), p.url().replace(B, ''));
await p.goBack({ waitUntil: 'networkidle0' }); await w(700);
ok('back again goes to Rapid fire', p.url().includes('tab=rapid'), p.url().replace(B, ''));
ok('still inside /practice', new URL(p.url()).pathname === '/practice');

console.log('\nselecting a problem is linkable');
await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(700);
/* Problem rows carry data-active; the filter chips above them do not. */
await p.evaluate(() => document.querySelectorAll('.wb-list button[data-active]')[4]?.click()); await w(700);
const withProblem = p.url();
ok('URL carries the problem', /[?&]problem=\d+/.test(withProblem), withProblem.replace(B, ''));
const title = await p.$eval('h1', (e) => e.textContent.trim()).catch(() => '');
ok('it is not just the default problem', title !== 'Partition Equal Subset Sum', title);
await p.goto(withProblem, { waitUntil: 'networkidle0' }); await w(800);
ok('the link reopens the same problem', (await p.$eval('h1', (e) => e.textContent.trim()).catch(() => '')) === title, title);

console.log('\nlearn tabs');
await p.goto(`${B}/learn`, { waitUntil: 'networkidle0' }); await w(700);
await clickTab('Guides');
ok('Guides -> ?tab=guides', p.url().includes('tab=guides'), p.url().replace(B, ''));
await p.reload({ waitUntil: 'networkidle0' }); await w(700);
ok('reload keeps the Guides tab', (await p.evaluate(() => document.body.innerText)).includes('Library'));

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mnavigation is linkable and reversible\x1b[0m\n');
process.exit(fails ? 1 : 0);
