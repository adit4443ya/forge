/* ════════════════════════════════════════════════════════════════════════════
   The state shape and the pure functions over it. No storage, no React.
   Kept separate so the merge logic can be unit-tested in plain node.
   ════════════════════════════════════════════════════════════════════════════ */

export const VERSION = 2;

export const EMPTY = Object.freeze({
  version: VERSION,
  updatedAt: 0,
  startDate: null,
  role: "compiler",
  labs: {},       // labId  -> { done, date, note, at }
  dsa: {},        // problemId -> { attempts: [{ date, minutes, result, note, mode, revealed, at }] }
  sessions: [],   // [{ date, kind, minutes, mode, at }]
  notes: {},      // key -> { text, at }
  reviews: {},    // cardId -> { ...fsrsCard, at }
  evidence: {},   // labId -> { claim, evidence, surprise, date, at }
  session: null,  // { templateId, mode, startedAt, done: [] }
  bookmarks: {},  // "kind:id" -> { at }
  prefs: {},      // { theme, density, ... }
  stamps: {},     // scalar field -> ms when it was last set (see SCALARS)
});

/* Scalar fields are last-write-wins REGISTERS: each carries its own stamp in
   `stamps` so a merge can pick a winner per field. Using one document-level
   updatedAt instead would not be associative — a newer document holding null
   would let an older document's value resurface depending on merge order. */
export const SCALARS = ["startDate", "role", "session"];

export const today = () => new Date().toISOString().slice(0, 10);

const stampOf = (v) => (v && typeof v === "object" && Number(v.at)) || 0;

/* Merging must be commutative: signing in must give the same document whether
   the local or the remote copy happened to load first. Every tie is therefore
   broken on content, never on argument order. */
const canon = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
const byContent = (x, y) => (canon(x) < canon(y) ? -1 : canon(x) > canon(y) ? 1 : 0);

/* Key order is normalized everywhere so the serialized document is canonical.
   Two devices that hold the same information then produce byte-identical JSON,
   which lets the sync layer skip writes that would change nothing. */
function sortedMap(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

/* One total order for attempts and one for sessions, used by BOTH normalize and
   merge so that normalize is the canonicaliser and merge is a lattice join over
   canonical documents: merge(A, A) === normalize(A) exactly. */
const byAt = (x, y) => (x.at || 0) - (y.at || 0) || String(x.date).localeCompare(String(y.date)) || byContent(x, y);
const byDate = (x, y) => String(x.date).localeCompare(String(y.date)) || (x.at || 0) - (y.at || 0) || byContent(x, y);
const dedupe = (list, cmp) => {
  const seen = new Map();
  for (const x of list) if (!seen.has(canon(x))) seen.set(canon(x), x);
  return [...seen.values()].sort(cmp);
};

/** Accept anything, return a well-formed state. Upgrades v1 documents. */
export function normalize(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const s = { ...EMPTY, ...raw };
  for (const k of ["labs", "dsa", "notes", "reviews", "evidence", "bookmarks", "prefs"]) {
    s[k] = raw[k] && typeof raw[k] === "object" ? sortedMap(raw[k]) : {};
  }
  s.sessions = dedupe(Array.isArray(raw.sessions) ? raw.sessions : [], byDate);
  for (const [id, e] of Object.entries(s.dsa)) {
    s.dsa[id] = { attempts: dedupe(Array.isArray(e?.attempts) ? e.attempts : [], byAt) };
  }
  // v1 stored notes as bare strings; v2 stamps them so merges can pick a winner.
  for (const [k, v] of Object.entries(s.notes)) {
    if (typeof v === "string") s.notes[k] = { text: v, at: 0 };
  }
  s.stamps = {};
  for (const k of SCALARS) {
    const at = Number(raw.stamps?.[k]);
    // A v1 document has no stamps: fall back to its document-level time so its
    // values still compete sensibly against a stamped document.
    s.stamps[k] = Number.isFinite(at) ? at : (Number(raw.updatedAt) || 0);
  }
  s.version = VERSION;
  s.updatedAt = Number(raw.updatedAt) || 0;
  return s;
}

/** Newest-wins union of two record maps; equal stamps resolve on content. */
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!(k in out)) { out[k] = v; continue; }
    const d = stampOf(v) - stampOf(out[k]);
    if (d > 0 || (d === 0 && byContent(v, out[k]) > 0)) out[k] = v;
  }
  return sortedMap(out);
}

/** Union of two attempt lists, de-duplicated and totally ordered. */
const mergeAttempts = (a = [], b = []) => dedupe([...a, ...b], byAt);

/* Merge two independently-edited states. Used when a device signs in holding
   local work and the server already has a document: neither side is discarded.
   Scalars follow the document with the newer updatedAt; collections are unioned. */
export function merge(local, remote) {
  const a = normalize(local), b = normalize(remote);
  /* Per-field register merge: highest stamp wins, content breaks exact ties. */
  const scalars = {}, stamps = {};
  for (const k of SCALARS) {
    const d = (b.stamps[k] || 0) - (a.stamps[k] || 0);
    const win = d > 0 || (d === 0 && byContent(b[k], a[k]) > 0) ? b : a;
    scalars[k] = win[k];
    stamps[k] = Math.max(a.stamps[k] || 0, b.stamps[k] || 0);
  }

  const dsa = {};
  for (const id of [...new Set([...Object.keys(a.dsa), ...Object.keys(b.dsa)])].sort()) {
    dsa[id] = { attempts: mergeAttempts(a.dsa[id]?.attempts, b.dsa[id]?.attempts) };
  }

  const sessions = dedupe([...a.sessions, ...b.sessions], byDate);

  return {
    ...EMPTY,
    version: VERSION,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    ...scalars,
    stamps,
    labs: mergeMap(a.labs, b.labs),
    evidence: mergeMap(a.evidence, b.evidence),
    reviews: mergeMap(a.reviews, b.reviews),
    notes: mergeMap(a.notes, b.notes),
    bookmarks: mergeMap(a.bookmarks, b.bookmarks),
    prefs: mergeMap(a.prefs, b.prefs),
    dsa,
    sessions,
  };
}

/** True when the document holds nothing worth syncing. */
export function isEmptyState(s) {
  const n = normalize(s);
  return !n.startDate && !n.sessions.length &&
    ![n.labs, n.dsa, n.notes, n.reviews, n.evidence, n.bookmarks].some((m) => Object.keys(m).length);
}

/* ── derived helpers (pure) ─────────────────────────────────────────────── */
export function weekNumber(startDate, now = new Date()) {
  if (!startDate) return null;
  const days = Math.floor((now - new Date(startDate + "T00:00:00")) / 86400000);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}
export const isSolved = (e) => !!e?.attempts?.some((a) => a.result === "solved");
export const isSolvedIn = (e, mode) => !!e?.attempts?.some((a) => a.result === "solved" && (!mode || a.mode === mode));
export const attemptCount = (e) => e?.attempts?.length || 0;
export const lastAttempt = (e) => (e?.attempts?.length ? e.attempts[e.attempts.length - 1] : null);

export function streak(sessions) {
  const days = new Set(sessions.map((s) => s.date));
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    n++; d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dailyMinutes(sessions, days = 28) {
  const byDay = new Map();
  for (const s of sessions) byDay.set(s.date, (byDay.get(s.date) || 0) + (s.minutes || 0));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, minutes: byDay.get(key) || 0 });
  }
  return out;
}

export function sessionsThisWeek(sessions, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // back to Monday
  const monday = d.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= monday);
}
