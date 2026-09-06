# Working on Forge

## Adding a problem

1. Append it to `scripts/gap_problems_3.mjs` (or a new `gap_problems_N.mjs`, wired into
   `scripts/add-gap-problems.mjs`). Required fields: `id, section, title, difficulty, frequency,
   leetcode, pattern, intuition, keyInsight, approach, complexity, tabCode`.
2. Add a spoiler-free statement to `src/data/prompts.js` under the same id. It should be enough to
   start thinking and never enough to hint.
3. Place the id in a tier in `src/data/dsaCurriculum.js`. `check-curriculum.mjs` fails otherwise.
4. If it has a judge, add the slug to `LC_SLUG` in `src/data/externalLinks.js`.
5. Add cases to `scripts/cpp/gap3_solutions_test.cpp` and run `./scripts/test-solutions.sh`.
   Prefer a randomized differential test against a brute-force implementation over hand-written
   expectations — a hand-written expectation has already been wrong once.
6. `node scripts/add-gap-problems.mjs` appends it to `src/dsaData.jsx` (idempotent by id).

## Adding a guide

Drop a markdown file in `content/guides/` named `NN_slug.md` with a unique `NN`, and an HTML comment
header:

```
<!--
category: Systems & Low Latency
tags: comma, separated
difficulty: Advanced
readTime: 45 min
-->

# Title
```

Then `node scripts/build-content.mjs`. The number becomes the URL at `/learn/guide/NN`.

## Changing the state shape

`src/lib/progress/state.js` is the only file that defines what progress is. If you add a field:

- a **collection** keyed by id → add it to the merge as a `mergeMap`, and stamp writes with `at`
- a **scalar** → add it to `SCALARS` so it becomes a last-write-wins register

Then run `node scripts/test-state.mjs`. If the properties stop holding, two devices can diverge
permanently — that is not a test to skip.

## House rules

- No claim about what a specific company asks. Describe mechanisms.
- No invented benchmark numbers. Ranges, or measure it.
- The pattern is a spoiler. Nothing outside a gate may name it.

## Adding a lab

Labs are not authored here — they are parsed out of the `debug_lab` repository by
`scripts/build-labs.mjs`, which reads the header comment of each source file:

```c
/* ============================================================
 * PERF LAB #01: The title
 * TRACK: perf | DIFFICULTY: 1 | NEEDS: tools/pin.sh
 * ------------------------------------------------------------
 * WHAT THIS TEACHES:
 *   ...
 *
 * BUILD:  (cd perf && ./build.sh)   -> perf/bin/01_thing
 *
 * STEP 1 — WHAT YOU ARE DOING:
 *   $ ./bin/01_thing
 *   the output it produced on the machine that wrote the lab
 *   Then a paragraph explaining what the output means.
 *
 * TRY THIS YOURSELF:
 *   ...
 */
```

The parser turns `$ ` lines into copyable commands, the lines under them into
reference output, and a trailing paragraph of prose into the analysis shown
below the output. Write labs in that shape and they render as guided sessions
with no further work.

Regenerate with `npm run build:content`, which also fails on duplicate guide
numbers. The result is vendored into `content/labs.json`, so the site builds and
deploys without `debug_lab` present.

## Adding a rapid-fire question

`src/data/rapidfire.js`. Each entry needs `q`, `a` (two or three sentences you
could actually say), and `edge` — the follow-up where most people come apart.
That third field is the point of the format; an entry without a real one is
trivia, and trivia does not belong here.

## Trading-track material

`src/data/mentalmath.js` and `src/data/marketmaking.js` back two drills that are
**not** part of a software-engineering loop. Both screens say so before you
start, and that framing is not decoration — a candidate who spends weeks on
mental math instead of C++ and systems has been actively misled. Keep the
scoping note if you touch them.

Mental math is generated, not a bank, so it never repeats; every answer carries
the technique, because drilling arithmetic without a method makes you slower
more confidently.

The market-making counterparty is deliberately informed: it trades only when
your quote is wrong relative to fair value. Every fill is therefore adverse.
That is the lesson, not a bug — do not "balance" it.

## Linking to problems

Never point at a problem list or a search page. Every problem named anywhere in
the content must resolve to one of two things:

- a problem in the local bank, linked internally, or
- an **exact** page on a judge — `leetcode.com/problems/<slug>/` or
  `cses.fi/problemset/task/<id>`

Add the mapping to `EXTERNAL_PROBLEMS` in `src/data/externalLinks.js`, and
verify it rather than guessing the slug:

```bash
curl -s -X POST https://leetcode.com/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query{question(titleSlug:\"your-slug\"){questionFrontendId title isPaidOnly}}"}'
curl -s https://cses.fi/problemset/task/1643 | grep -o '<title>[^<]*'
```

The recorded id and title come from that call, so `npm run check:links --verify`
catches a renamed or removed problem. Mark `paid: true` for anything behind
LeetCode Premium — the UI says so rather than sending someone to a paywall.

`npm run check:links` fails if a name resolves to nothing, and
`npm run test:links` fails if the UI renders a chip that is not clickable.

## What the role switch must do

The role is the product's organising idea, so a surface that ignores it is a
bug. `src/data/roleScope.js` is the single definition of "does this belong to my
role" — use it rather than reimplementing the check.

It **sorts and highlights; it never hides by default.** A compiler candidate
still does the whole coding bar. Filtering the bank down to one role would be
worse advice than not having roles at all, which is why the role filter on the
problem list is opt-in and the labs filter is a visible, reversible toggle.

If you add a surface, decide what the role changes there and assert it in
`scripts/test-role.mjs`. If the honest answer is "nothing", say so in the UI
rather than leaving the switch looking like it did something.
