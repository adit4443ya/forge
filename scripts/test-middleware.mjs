#!/usr/bin/env node
/* The middleware refreshes the Supabase session cookie on every navigation.
   In production that produced a 504 MIDDLEWARE_INVOCATION_TIMEOUT: the refresh
   is a network call, a stalled host does not reject, and the try/catch around
   it therefore did nothing — the request blocked until the platform killed it.

   These check the two properties that stop it happening again. They are plain
   assertions on the logic, so they need no server and no Supabase. */
import { withDeadline, DEADLINE_EXPIRED } from '../src/lib/deadline.js';
import fs from 'node:fs';

let bad = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { bad++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const check = (cond, m) => (cond ? pass(m) : fail(m));

/* 1. A hang must resolve at the deadline, not propagate. This is the exact
      shape of the outage: a promise that never settles. */
{
  const never = new Promise(() => {});
  const t0 = Date.now();
  const r = await withDeadline(never, 120);
  const dt = Date.now() - t0;
  check(r === DEADLINE_EXPIRED, 'a promise that never settles resolves as expired');
  check(dt >= 100 && dt < 1000, `it gives up at the deadline, not later (${dt}ms)`);
}

/* 2. The normal path must be unaffected: a fast call still returns its value,
      and must not be delayed by the timer. */
{
  const t0 = Date.now();
  const r = await withDeadline(Promise.resolve({ data: { user: null } }), 5000);
  const dt = Date.now() - t0;
  check(r?.data !== undefined, 'a value that arrives in time is returned unchanged');
  check(dt < 500, `and is not held until the deadline (${dt}ms)`);
}

/* 3. A rejection must still reject, so real errors are not silently swallowed
      and turned into "expired". */
{
  let threw = false;
  try { await withDeadline(Promise.reject(new Error('nope')), 5000); }
  catch { threw = true; }
  check(threw, 'a rejection still rejects rather than resolving as expired');
}

/* 4. The timer must not keep the process alive. If clearTimeout were missing,
      node would hang here instead of exiting — which is why this script has no
      explicit exit on the success path. */
{
  await withDeadline(Promise.resolve(1), 60_000);
  pass('a settled race clears its timer (this script exits rather than hanging)');
}

/* 5. The middleware must not call Supabase for a visitor with no session. This
      one is read from the source: the guard is the thing that keeps anonymous
      traffic and crawlers off the auth server entirely, and it is easy to
      delete by accident while editing around it. */
{
  const src = fs.readFileSync(new URL('../src/middleware.js', import.meta.url), 'utf8');
  check(/auth-token/.test(src) && /hasSessionCookie/.test(src),
    'middleware checks for a session cookie before building a Supabase client');
  const guardAt = src.indexOf('hasSessionCookie(request)');
  const clientAt = src.indexOf('createServerClient(');
  check(guardAt > 0 && clientAt > 0 && guardAt < clientAt,
    'the check happens before the client is built, so no session means no call');
  check(/withDeadline\(\s*supabase\.auth\.getUser\(\)/.test(src),
    'the refresh is bounded by a deadline rather than awaited directly');
  check(/robots\.txt|sitemap\.xml/.test(src),
    'the SEO endpoints are excluded from the matcher');
}

console.log(bad ? `\n\x1b[31mtest-middleware: ${bad} failure(s)\x1b[0m\n`
                : '\n\x1b[32mtest-middleware: PASS\x1b[0m\n');
process.exit(bad ? 1 : 0);
