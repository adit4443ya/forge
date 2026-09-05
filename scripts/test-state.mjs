#!/usr/bin/env node
/* Property tests for the sync merge. Merging must be commutative, associative
   and idempotent, or two devices can diverge permanently. */
import { normalize, merge, isEmptyState, streak, dailyMinutes, weekNumber } from "../src/lib/progress/state.js";
let fails = 0;
const ok = (label, cond) => { if (!cond) { fails++; console.log("FAIL " + label); } else console.log("ok   " + label); };
const J = JSON.stringify;

const rnd = (seed) => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function randomState(r) {
  const s = { updatedAt: Math.floor(r() * 100), startDate: r() > .5 ? "2026-01-0" + (1 + Math.floor(r() * 9)) : null,
    role: ["compiler", "hft", "quant", "systems"][Math.floor(r() * 4)], labs: {}, dsa: {}, sessions: [], notes: {},
    reviews: {}, evidence: {}, bookmarks: {}, prefs: {} };
  for (let i = 0; i < Math.floor(r() * 5); i++) s.labs["lab-" + Math.floor(r() * 6)] = { done: true, at: Math.floor(r() * 100) };
  for (let i = 0; i < Math.floor(r() * 5); i++) {
    const id = Math.floor(r() * 5);
    (s.dsa[id] ||= { attempts: [] }).attempts.push({ date: "2026-01-0" + (1 + Math.floor(r() * 9)),
      minutes: Math.floor(r() * 40), result: ["solved", "hint", "failed"][Math.floor(r() * 3)],
      note: "", mode: ["drill", "study", "mock"][Math.floor(r() * 3)], revealed: [], at: Math.floor(r() * 100) });
  }
  for (let i = 0; i < Math.floor(r() * 4); i++) s.sessions.push({ date: "2026-01-0" + (1 + Math.floor(r() * 9)),
    kind: "A", minutes: Math.floor(r() * 60), at: Math.floor(r() * 100) });
  for (let i = 0; i < Math.floor(r() * 3); i++) s.notes["n" + Math.floor(r() * 4)] = { text: "t" + Math.floor(r() * 3), at: Math.floor(r() * 100) };
  // exercise per-field scalar stamps, including the "newer document, null value" case
  s.stamps = { startDate: Math.floor(r() * 100), role: Math.floor(r() * 100), session: Math.floor(r() * 100) };
  return normalize(s);
}

const r = rnd(20260905);
let comm = 0, assoc = 0, idem = 0, absorb = 0;
for (let i = 0; i < 400; i++) {
  const A = randomState(r), B = randomState(r), C = randomState(r);
  if (J(merge(A, B)) === J(merge(B, A))) comm++;
  if (J(merge(merge(A, B), C)) === J(merge(A, merge(B, C)))) assoc++;
  if (J(merge(A, A)) === J(normalize(A))) idem++;
  const M = merge(A, B);
  if (J(merge(M, A)) === J(M) && J(merge(M, B)) === J(M)) absorb++;
}
ok("commutative  (400 random pairs)", comm === 400);
ok("associative  (400 random triples)", assoc === 400);
ok("idempotent   (400 random states)", idem === 400);
ok("absorbing    (merging a parent back changes nothing)", absorb === 400);

ok("no data is lost on merge", (() => {
  const A = normalize({ updatedAt: 1, labs: { a: { done: true, at: 1 } }, sessions: [{ date: "2026-01-01", kind: "A", minutes: 10 }] });
  const B = normalize({ updatedAt: 2, labs: { b: { done: true, at: 2 } }, sessions: [{ date: "2026-01-02", kind: "B", minutes: 20 }] });
  const M = merge(A, B);
  return M.labs.a && M.labs.b && M.sessions.length === 2;
})());
ok("v1 document upgrades", normalize({ version: 1, notes: { k: "plain" } }).notes.k.text === "plain");
ok("garbage normalizes", J(normalize(null)) === J(normalize(undefined)) && normalize("nope").version === 2);
ok("isEmptyState", isEmptyState({}) && isEmptyState(normalize({})) && !isEmptyState(normalize({ startDate: "2026-01-01" })));

const t = new Date().toISOString().slice(0, 10);
const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
ok("streak counts today+yesterday", streak([{ date: t }, { date: y }]) === 2);
ok("streak tolerates today unlogged", streak([{ date: y }]) === 1);
ok("streak of nothing is 0", streak([]) === 0);
ok("dailyMinutes sums a day", dailyMinutes([{ date: t, minutes: 20 }, { date: t, minutes: 25 }], 7).at(-1).minutes === 45);
ok("dailyMinutes length", dailyMinutes([], 28).length === 28);
ok("weekNumber", weekNumber("2026-01-01", new Date("2026-01-08T00:00:00")) === 2 && weekNumber(null) === null);

console.log(fails ? `\n${fails} FAILED` : "\nstate: all properties hold");
process.exit(fails ? 1 : 0);
