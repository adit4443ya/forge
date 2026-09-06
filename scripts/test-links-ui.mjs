#!/usr/bin/env node
/* Nothing in the UI may name a problem without linking somewhere. The failure
   this guards is a chip that looks clickable and is not. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('\npatterns tab');
await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(600);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('Patterns'))?.click());
await w(700);

/* Open every pattern and inspect each problem chip. */
const report = await p.evaluate(async () => {
  const heads = [...document.querySelectorAll('.pat-head')];
  for (const h of heads) h.click();
  await new Promise((r) => setTimeout(r, 400));
  const chips = [...document.querySelectorAll('.pat-prob')];
  return {
    total: chips.length,
    dead: chips.filter((c) => c.tagName !== 'A' && c.tagName !== 'BUTTON').map((c) => c.textContent.trim()),
    links: chips.filter((c) => c.tagName === 'A').map((c) => c.getAttribute('href')),
    buttons: chips.filter((c) => c.tagName === 'BUTTON').length,
  };
});
ok(`every problem chip is clickable (${report.total} chips)`, report.dead.length === 0, report.dead.slice(0, 4).join(', '));
ok(`${report.buttons} link into the bank, ${report.links.length} go to a judge`, report.total > 0);
ok('no link points at a list or a search',
   !report.links.some((h) => /\/problemset\/?$|search=|\/practice$/.test(h)),
   report.links.filter((h) => /\/problemset\/?$|search=/.test(h))[0] || '');
ok('every external link is an exact problem page',
   report.links.every((h) => /leetcode\.com\/problems\/[a-z0-9-]+\/$|cses\.fi\/problemset\/task\/\d+$/.test(h)),
   report.links.find((h) => !/leetcode\.com\/problems\/[a-z0-9-]+\/$|cses\.fi\/problemset\/task\/\d+$/.test(h)) || '');

console.log('\nproblem page');
await p.goto(`${B}/practice?problem=1`, { waitUntil: 'networkidle0' }); await w(900);
const drill = await p.evaluate(() => [...document.querySelectorAll('a[href]')]
  .map((a) => a.getAttribute('href')).filter((h) => /cses\.fi|leetcode\.com/.test(h)));
ok(`drill links present (${drill.length})`, drill.length > 0);
ok('none is a list page', !drill.some((h) => /list\/?$|problemset\/?$/.test(h)), drill.find((h) => /list\/?$/.test(h)) || '');

console.log('\nlearn: drill chips navigate');
await p.goto(`${B}/learn`, { waitUntil: 'networkidle0' }); await w(800);
await p.evaluate(() => document.querySelector('.cm-row')?.click()); await w(800);
const secChips = await p.$$eval('.sec-chip', (e) => e.length).catch(() => 0);
if (secChips > 0) {
  await p.evaluate(() => document.querySelector('.sec-chip')?.click()); await w(900);
  ok('a section chip navigates to filtered problems', new URL(p.url()).search.includes('section='), p.url());
} else {
  ok('section chips rendered', false, 'none found');
}

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mevery named problem is clickable and exact\x1b[0m\n');
process.exit(fails ? 1 : 0);
