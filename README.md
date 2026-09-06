# Forge

A practice system for engineers targeting **compiler, systems, high-frequency-trading and quant** roles.

Most preparation sites show you the pattern, the approach and the solution on one page. You leave
knowing you *could* have solved it. Forge hides all three behind gates that open on a timer, treats
the pattern label as a spoiler in the problem list as well as the problem page, and records what you
revealed against each attempt — so "solved" means something specific.

```
120 problems · 61 guided labs (113 steps) in 11 tracks · 23 guides (80k words)
239 recall questions · 56 rapid-fire mechanisms · 14 estimation chains
```

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

That is the whole setup. With no configuration the app is fully functional and saves progress in the
browser. Sign-in and cross-device sync are opt-in — see below.

## Optional: Google sign-in and cloud progress

Full runbook in [SETUP.md](SETUP.md). Check your work at any point with:

```bash
npm run doctor
```

It verifies the environment variables, that Supabase is reachable, that the schema is applied, that
row-level security actually hides other users' rows, and that the Google provider is enabled — and
prints the exact redirect URLs to paste into Supabase and Google.

Without those variables `CLOUD_ENABLED` is false, every cloud path is skipped, and the sign-in button
is replaced by an explanation. The app never degrades into a broken state because a backend is missing.

### How sync behaves

Progress is a single JSON document. Writes go to memory and `localStorage` immediately; when signed
in they are also pushed to Postgres on a debounce and pulled on sign-in and on tab focus.

Both directions go through `merge()` in [`src/lib/progress/state.js`](src/lib/progress/state.js),
which is a **CRDT join**: commutative, associative and idempotent, verified by property tests over
random states in [`scripts/test-state.mjs`](scripts/test-state.mjs). Collections are unioned;
scalar fields are last-write-wins registers with their own timestamps. The practical consequence is
that a device which was offline for a week never loses its work and never wins by clobbering — and
merging in a different order cannot produce a different result.

Attempts are additionally appended to their own table, so the record of what you solved outlives any
one browser.

## Layout

```
content/guides/       23 markdown guides — read on the server, never bundled
content/labs.json     61 labs parsed from debug_lab into guided steps (server-side)
src/app/              routes: landing, /today /practice /learn /labs /progress, /learn/guide/[num]
src/screens/          the five surfaces
src/shell/            top bar, command palette, URL-backed navigation
src/data/             roles, curriculum, prompts, external links, sessions
src/data/generated/   built by scripts/build-content.mjs and build-labs.mjs — do not edit
src/lib/progress/     state shape + CRDT merge, and the local-first store
src/lib/supabase/     browser and server clients; both no-op when unconfigured
supabase/schema.sql   tables, row-level security, indexes
```

Guide markdown is read by a server component, so the 532 KB of guide text never reaches the client
bundle. Only the guide you are reading is sent, already rendered.

## Checks

| Command | What it proves |
| --- | --- |
| `npm run lint` | no lint errors, React hook rules included |
| `npm run build` | production build, all 23 guides prerendered |
| `node scripts/test-state.mjs` | the sync merge is commutative, associative, idempotent |
| `./scripts/test-solutions.sh` | every reference solution compiles `-Werror` under ASan+UBSan and passes known-answer and randomized differential tests |
| `node scripts/check-curriculum.mjs` | every problem in the bank is placed in a tier |
| `node scripts/build-content.mjs` | regenerates the content index; fails on duplicate guide numbers |
| `npm run smoke` | headless Chrome walks every surface, the palette, the gates, persistence and the theme |
| `npm run doctor` | the deployment is actually wired up: env, schema, RLS, Google provider |
| `npm run test:scroll` | the landing page scrolls, the app does not, nothing overflows sideways |
| `npm run test:guides` | every guide opens by clicking it, plus legacy links, palette anchors and the back button |
| `npm run test:labs` | every lab page renders, the runner shows copyable commands and reference output, evidence notes persist |
| `npm run check:map` | every competency maps to real rapid-fire domains, guides, labs and problem sections |

Run the smoke test against a built server:

```bash
npm run build && npx next start -p 4310 &
npm run smoke
```

## Deploying

Any Node host works. On Vercel: import the repository, add the two `NEXT_PUBLIC_SUPABASE_*`
environment variables if you want sign-in, and deploy. Add the deployed callback URL to Supabase
and to the Google OAuth client.

## Content conventions

- Guide filenames start with a unique two-digit number; that number is the URL. The content build
  **fails** if two guides share one, because a collision silently hides a guide.
- Reference solutions live in `scripts/gap_problems*.mjs` and are compiled and tested by
  `scripts/test-solutions.sh`. A solution that is not tested does not belong in the bank.
- Numbers on the landing page come from `src/data/generated/stats.js`, which is generated from the
  content itself, so the copy cannot drift away from what is actually there.
