#!/usr/bin/env node
/* The callback runs once, on a redirect the user cannot retry. A throw there is
   a blank 500 with no diagnostic, so every failure mode is asserted here. */
const BASE = process.env.BASE || 'http://localhost:4315';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };

const hit = async (qs) => {
  const r = await fetch(`${BASE}/auth/callback${qs}`, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location') || '' };
};

console.log('\nauth callback');
for (const [qs, label] of [
  ['', 'no code at all'],
  ['?code=clearly-not-valid', 'a code Supabase will reject'],
  ['?error=access_denied&error_description=User+denied', 'user cancelled at Google'],
  ['?code=x&next=/labs', 'a next parameter'],
  ['?code=x&next=https://evil.example/steal', 'an absolute next (open-redirect attempt)'],
]) {
  const r = await hit(qs);
  const redirects = r.status >= 300 && r.status < 400;
  ok(`${label.padEnd(38)} → ${r.status}`, redirects, r.location.slice(0, 96));
  if (!redirects) continue;
  if (qs.includes('evil.example')) {
    ok('  never redirects off-origin', !r.location.includes('evil.example'), r.location);
  }
}
ok('nothing returned a 500', true);

console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mcallback never throws\x1b[0m\n');
process.exit(fails ? 1 : 0);
