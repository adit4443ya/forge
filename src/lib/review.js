// ════════════════════════════════════════════════════════════════════
//  Review queue — spaced repetition on top of the local progress store.
//  Scheduler: FSRS (ts-fsrs). Cards live in progress.reviews[id]:
//    { id, kind: "q"|"dsa"|"lab", ref, question, answer, module, title,
//      card: <ts-fsrs Card with dates as ISO strings>, history: [{date, rating}], added }
//  Kinds: "q" = a Prep Q&A (answer stored on the card), "dsa" = a problem
//  (rated automatically from the attempt logger), "lab" = a lab's evidence question.
// ════════════════════════════════════════════════════════════════════
import { fsrs, createEmptyCard, Rating, State } from "ts-fsrs";
import { progressStore, today } from "@/lib/progress/store.js";

const scheduler = fsrs({ enable_fuzz: false });

export const RATINGS = [
  { key: "again", rating: Rating.Again, label: "Again", hint: "could not recall" },
  { key: "hard",  rating: Rating.Hard,  label: "Hard",  hint: "recalled with effort / needed a hint" },
  { key: "good",  rating: Rating.Good,  label: "Good",  hint: "recalled" },
  { key: "easy",  rating: Rating.Easy,  label: "Easy",  hint: "trivial, push it out" },
];

export const cardId = (kind, ref) => `${kind}:${ref}`;
export function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
const hydrate = (c) => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });
const dehydrate = (c) => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null });

export const allCards = () => progressStore.get().reviews || {};
export const hasCard = (id) => !!allCards()[id];

export function addCard({ kind, ref, question, answer = "", module = "", title = "" }) {
  const id = cardId(kind, ref);
  if (hasCard(id)) return id;
  progressStore.setReview(id, { id, kind, ref, question, answer, module, title, card: dehydrate(createEmptyCard(new Date())), history: [], added: today() });
  return id;
}
export const removeCard = (id) => progressStore.deleteReview(id);

export function dueCards(now = new Date()) {
  return Object.values(allCards()).filter((e) => new Date(e.card.due) <= now).sort((a, b) => new Date(a.card.due) - new Date(b.card.due));
}
export function nextDue() {
  const dues = Object.values(allCards()).map((e) => new Date(e.card.due)).sort((a, b) => a - b);
  return dues.length ? dues[0] : null;
}
export function describeInterval(from, to) {
  const ms = to - from;
  const m = Math.round(ms / 60000); if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.round(ms / 3600000); if (h < 48) return `${h}h`;
  const d = Math.round(ms / 86400000); if (d < 60) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
/* What each rating would schedule: { again: "10m", hard: "1d", good: "3d", easy: "7d" } */
export function preview(entry, now = new Date()) {
  const r = scheduler.repeat(hydrate(entry.card), now);
  return Object.fromEntries(RATINGS.map((x) => [x.key, describeInterval(now, r[x.rating].card.due)]));
}
export function rate(id, ratingKey, now = new Date()) {
  const e = allCards()[id]; if (!e) return;
  const R = RATINGS.find((x) => x.key === ratingKey)?.rating ?? Rating.Good;
  const { card } = scheduler.next(hydrate(e.card), now, R);
  progressStore.setReview(id, { ...e, card: dehydrate(card), history: [...(e.history || []), { date: now.toISOString().slice(0, 10), rating: ratingKey }] });
}
/* DSA attempts feed the queue automatically: solved -> Good, hint -> Hard, failed -> Again. */
export function fromAttempt(problemId, result, title) {
  const id = addCard({ kind: "dsa", ref: String(problemId), question: title, title });
  rate(id, result === "solved" ? "good" : result === "hint" ? "hard" : "again");
}
export function stats(now = new Date()) {
  const all = Object.values(allCards());
  const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
  const byKind = { q: 0, dsa: 0, lab: 0 };
  for (const e of all) {
    const s = e.card.state;
    if (s === State.New) byState.new++; else if (s === State.Learning) byState.learning++; else if (s === State.Review) byState.review++; else byState.relearning++;
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  }
  return { total: all.length, due: all.filter((e) => new Date(e.card.due) <= now).length, byState, byKind };
}
