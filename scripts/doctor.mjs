#!/usr/bin/env node
/* Verifies a deployment is actually wired up: env vars present, Supabase
   reachable, schema applied, RLS enforced. Run after each setup step.
   Reads .env.local if present, so it works locally and on a server. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const RAW_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();

/* The dashboard shows several URLs; only the origin is the project URL. */
const normalize = (v) => {
  if (!v) return '';
  try { return new URL(v).origin; }
  catch { return v.replace(/\/(rest|auth|storage|realtime|functions)\/v\d.*$/, '').replace(/\/+$/, ''); }
};
const URL_ = normalize(RAW_URL);
const trimmedPath = RAW_URL && URL_ && RAW_URL.replace(/\/+$/, '') !== URL_;

let bad = 0;
const ok   = (m, d = '') => console.log(`  \x1b[32m✓\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`);
const fail = (m, fix)     => { bad++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); if (fix) console.log(`      \x1b[33m→ ${fix}\x1b[0m`); };
const info = (m)          => console.log(`  \x1b[90m·\x1b[0m \x1b[90m${m}\x1b[0m`);

console.log('\n\x1b[1mForge setup check\x1b[0m\n');

console.log('\x1b[1m1. Environment\x1b[0m');
const placeholder = /YOUR-PROJECT|your-anon-key/i;
if (!URL_) fail('NEXT_PUBLIC_SUPABASE_URL is not set', 'Supabase → Project Settings → API → Project URL');
else if (placeholder.test(URL_)) fail('NEXT_PUBLIC_SUPABASE_URL is still the placeholder', 'paste your real project URL');
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_)) {
  fail(`NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL: ${RAW_URL}`,
       'expected exactly https://<ref>.supabase.co — the dashboard also shows a REST endpoint, which is not this');
} else if (trimmedPath) {
  // The app normalises this, so it works — but the .env is misleading. Say so once, loudly.
  ok('NEXT_PUBLIC_SUPABASE_URL', URL_);
  console.log(`      \x1b[33m→ your .env has "${RAW_URL}" — that is the REST endpoint, not the project URL.\x1b[0m`);
  console.log(`      \x1b[33m  The app strips it, but edit .env.local to just ${URL_} to avoid confusion.\x1b[0m`);
} else ok('NEXT_PUBLIC_SUPABASE_URL', URL_);

if (!KEY) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set', 'Supabase → Project Settings → API → anon public key');
else if (placeholder.test(KEY)) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is still the placeholder');
else if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(KEY) && !/^sb_publishable_/.test(KEY)) {
  fail('NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like an anon key',
       'it should be a long JWT starting eyJ… (or a sb_publishable_… key). The service_role key must NEVER be used here.');
} else ok('NEXT_PUBLIC_SUPABASE_ANON_KEY', KEY.slice(0, 12) + '…' + ` (${KEY.length} chars)`);

if (SITE) ok('NEXT_PUBLIC_SITE_URL', SITE);
else info('NEXT_PUBLIC_SITE_URL not set — OAuth will use the request origin. Fine locally; set it in production.');

if (!URL_ || !KEY || placeholder.test(URL_ + KEY)) {
  console.log('\n\x1b[33mCloud is OFF.\x1b[0m The app still runs and saves progress in the browser.');
  console.log('Set the two variables above to enable Google sign-in and cross-device sync.\n');
  process.exit(bad ? 1 : 0);
}

const base = URL_.replace(/\/$/, '');
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

console.log('\n\x1b[1m2. Reachability\x1b[0m');
let keyAccepted = false;
try {
  const r = await fetch(`${base}/auth/v1/health`, { headers, signal: timeout(8000) });
  if (r.ok) { keyAccepted = true; ok('Supabase auth is reachable and the key is accepted'); }
  else if (r.status === 401) fail('the project is reachable but rejected the key', 'copy the anon / public key again from Project Settings → API');
  else if (r.status === 404) fail(`auth health 404 at ${base}/auth/v1/health`, 'the URL is not a project origin — strip any /rest/v1/ or /auth/v1/ suffix');
  else fail(`auth health returned HTTP ${r.status}`, 'check the project URL and that the project is not paused');
} catch (e) {
  fail(`cannot reach ${base}`, e.name === 'AbortError' ? 'timed out — is the project paused?' : e.message);
}

console.log('\n\x1b[1m3. Schema\x1b[0m');
for (const table of ['progress', 'attempts']) {
  try {
    const r = await fetch(`${base}/rest/v1/${table}?select=user_id&limit=1`, { headers, signal: timeout(8000) });
    const body = await r.text();
    if (r.status === 200) {
      // Anonymous + RLS should return an empty set, never other users' rows.
      const rows = JSON.parse(body || '[]');
      if (rows.length === 0) ok(`table "${table}" exists and RLS hides other users' rows`);
      else fail(`table "${table}" returned ${rows.length} row(s) to an anonymous caller`, 'RLS is not enabled — re-run supabase/schema.sql');
    } else if (r.status === 401 || r.status === 403) {
      // A rejected key produces 401 whether or not the table exists, so this
      // only means something once the key is known good.
      if (keyAccepted) ok(`table "${table}" exists and is protected`, `HTTP ${r.status}`);
      else fail(`cannot check table "${table}" — the key was rejected`, 'fix the anon key first, then re-run');
    } else if (/does not exist|schema cache/i.test(body)) {
      fail(`table "${table}" does not exist`, 'run supabase/schema.sql in the Supabase SQL editor');
    } else {
      fail(`table "${table}": HTTP ${r.status} ${body.slice(0, 120)}`);
    }
  } catch (e) { fail(`table "${table}": ${e.message}`); }
}

console.log('\n\x1b[1m4. Google provider\x1b[0m');
try {
  const r = await fetch(`${base}/auth/v1/settings`, { headers, signal: timeout(8000) });
  const s = await r.json();
  const google = s?.external?.google;
  if (google) ok('Google sign-in is enabled');
  else if (!keyAccepted) fail('cannot read auth settings — the key was rejected', 'fix the anon key first, then re-run');
  else fail('Google provider is NOT enabled', 'Supabase → Authentication → Providers → Google → enable, paste Client ID + Secret');
  const enabled = Object.entries(s?.external || {}).filter(([, v]) => v).map(([k]) => k);
  if (enabled.length) info(`providers enabled: ${enabled.join(', ')}`);
} catch (e) { fail(`could not read auth settings: ${e.message}`); }

console.log('\n\x1b[1m5. Redirect URLs to allowlist\x1b[0m');
info('Supabase cannot be asked what is on this list, so it is not checked — but it is');
info('the most common reason sign-in "works" and then dumps you somewhere unexpected:');
info('an unlisted redirect is silently replaced by your Site URL.');
info('Supabase → Authentication → URL Configuration → Redirect URLs must include:');
console.log(`      http://localhost:3000/auth/callback`);
if (SITE) console.log(`      ${SITE.replace(/\/$/, '')}/auth/callback`);
else console.log(`      https://<your-domain>/auth/callback`);
info('Google Cloud → Credentials → your OAuth client → Authorized redirect URIs must include:');
console.log(`      ${base}/auth/v1/callback`);
info('And Site URL should be where you are testing right now — set it to');
info('http://localhost:3000 while developing, the deployed domain once live.');

console.log(bad ? `\n\x1b[31m${bad} problem(s) to fix.\x1b[0m\n` : '\n\x1b[32mAll checks passed. Sign-in and sync should work.\x1b[0m\n');
process.exit(bad ? 1 : 0);
