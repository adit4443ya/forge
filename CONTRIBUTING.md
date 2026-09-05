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
