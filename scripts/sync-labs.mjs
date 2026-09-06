#!/usr/bin/env node
/* SUPERSEDED by scripts/build-labs.mjs.
   This copied debug_lab's manifest into src/data/labs.json, which then drifted
   from what build-labs.mjs generates (61 labs against 64) and gave two files
   claiming to be the lab list. There is now one: src/data/generated/labs.js. */
console.log('sync-labs.mjs is superseded — run `npm run build:content` instead.');
console.log('The lab index is generated from the source files by scripts/build-labs.mjs.');
process.exit(1);
