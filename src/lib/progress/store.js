"use client";
/* ════════════════════════════════════════════════════════════════════════════
   The progress store: local-first, cloud-optional.

   Writes go to memory and localStorage immediately, so the app is fully usable
   signed out, offline, or with no Supabase project configured at all. When a
   user is signed in, changes are additionally pushed to Postgres on a debounce,
   and pulled on sign-in and on focus. Both directions go through merge(), which
   is a CRDT join, so a device that was offline never loses work and never wins
   by clobbering.
   ════════════════════════════════════════════════════════════════════════════ */
import { useSyncExternalStore } from "react";
import { EMPTY, VERSION, normalize, merge, isEmptyState, today, SCALARS } from "./state.js";
import { supabaseBrowser } from "../supabase/client.js";

const KEY = "forge-progress-v2";
const LEGACY_KEYS = ["cp-progress-v1"];
const PUSH_DEBOUNCE_MS = 1200;

let state = { ...EMPTY };
let user = null;
let sync = { status: "local", at: 0, error: null };   // local | syncing | synced | error
const listeners = new Set();
const syncListeners = new Set();
let pushTimer = null;
let booted = false;

const emit = () => listeners.forEach((l) => l());
const emitSync = () => syncListeners.forEach((l) => l());
const now = () => Date.now();

function readLocal() {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    for (const k of LEGACY_KEYS) {          // one-time upgrade from the Vite app
      const old = window.localStorage.getItem(k);
      if (old) return normalize(JSON.parse(old));
    }
  } catch { /* private mode, quota, corrupt JSON: start clean */ }
  return { ...EMPTY };
}

function writeLocal(s) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* keep in memory */ }
}

/** Apply a change, persist locally, schedule a cloud push. */
function commit(next, { push = true } = {}) {
  state = normalize({ ...next, version: VERSION, updatedAt: now() });
  writeLocal(state);
  emit();
  if (push) schedulePush();
}

/* ── cloud ────────────────────────────────────────────────────────────── */
function setSync(status, extra = {}) { sync = { ...sync, status, ...extra }; emitSync(); }

function schedulePush() {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
}

let lastPushed = "";
async function pushNow() {
  const sb = supabaseBrowser();
  if (!sb || !user) return;
  const payload = JSON.stringify(state);
  if (payload === lastPushed) { setSync("synced"); return; }   // canonical doc: nothing changed
  setSync("syncing");
  try {
    const { error } = await sb.from("progress").upsert(
      { user_id: user.id, data: state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    lastPushed = payload;
    setSync("synced", { at: now(), error: null });
  } catch (e) {
    setSync("error", { error: e?.message || String(e) });
  }
}

async function pull() {
  const sb = supabaseBrowser();
  if (!sb || !user) return null;
  const { data, error } = await sb.from("progress").select("data").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

/** Sign-in path: join the remote document with whatever this device holds. */
async function adopt(nextUser) {
  user = nextUser;
  if (!user) { setSync("local"); emitSync(); return; }
  setSync("syncing");
  try {
    const remote = await pull();
    const joined = remote ? merge(state, remote) : state;
    state = normalize({ ...joined, updatedAt: now() });
    writeLocal(state);
    emit();
    lastPushed = "";
    if (!isEmptyState(state)) await pushNow(); else setSync("synced", { at: now() });
  } catch (e) {
    setSync("error", { error: e?.message || String(e) });
  }
}

/** Called once from the client shell. Safe to call repeatedly. */
export function bootProgress() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  state = readLocal();
  emit();

  const sb = supabaseBrowser();
  if (!sb) return;
  sb.auth.getSession().then(({ data }) => adopt(data?.session?.user ?? null));
  sb.auth.onAuthStateChange((_e, session) => {
    const next = session?.user ?? null;
    if (next?.id !== user?.id) adopt(next);
  });
  // Coming back to the tab is the cheapest moment to notice another device's work.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && user) refresh();
  });
  window.addEventListener("beforeunload", () => { if (pushTimer) { clearTimeout(pushTimer); pushNow(); } });
}

/** Pull and join without changing who is signed in. */
export async function refresh() {
  if (!user) return;
  try {
    setSync("syncing");
    const remote = await pull();
    if (remote) {
      const joined = merge(state, remote);
      if (JSON.stringify(joined) !== JSON.stringify(state)) { state = joined; writeLocal(state); emit(); }
    }
    setSync("synced", { at: now() });
  } catch (e) { setSync("error", { error: e?.message || String(e) }); }
}

/* ── stamped writers ──────────────────────────────────────────────────── */
const stamp = (v) => ({ ...v, at: now() });
function setScalar(key, value) {
  commit({ ...state, [key]: value, stamps: { ...state.stamps, [key]: now() } });
}

export const progressStore = {
  get: () => state,
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getSync: () => sync,
  subscribeSync(l) { syncListeners.add(l); return () => syncListeners.delete(l); },
  getUser: () => user,

  setStartDate(date) { setScalar("startDate", date || null); },
  setRole(role) { setScalar("role", role); },

  toggleLab(id, note = "") {
    const labs = { ...state.labs };
    if (labs[id]) delete labs[id];
    else labs[id] = stamp({ done: true, date: today(), note });
    commit({ ...state, labs });
  },
  setLabNote(id, note) {
    commit({ ...state, labs: { ...state.labs, [id]: stamp({ ...(state.labs[id] || { done: true, date: today() }), note }) } });
  },

  logAttempt(problemId, { minutes = null, result = "solved", note = "", mode = "drill", revealed = [] } = {}) {
    const prev = state.dsa[problemId]?.attempts || [];
    const attempt = { date: today(), minutes, result, note, mode, revealed, at: now() };
    commit({ ...state, dsa: { ...state.dsa, [problemId]: { attempts: [...prev, attempt] } } });
    // Mirror into the append-only table so history outlives any one browser.
    const sb = supabaseBrowser();
    if (sb && user) {
      sb.from("attempts").insert({
        user_id: user.id, problem_id: Number(problemId), minutes, result, mode, revealed, note,
      }).then(({ error }) => { if (error) setSync("error", { error: error.message }); });
    }
  },
  clearAttempts(problemId) {
    const dsa = { ...state.dsa }; delete dsa[problemId]; commit({ ...state, dsa });
  },

  logSession(kind, minutes) {
    commit({ ...state, sessions: [...state.sessions, { date: today(), kind, minutes: Number(minutes) || 0, at: now() }] });
  },
  removeLastSession() { commit({ ...state, sessions: state.sessions.slice(0, -1) }); },

  setNote(key, text) { commit({ ...state, notes: { ...state.notes, [key]: stamp({ text }) } }); },

  startSession(templateId, mode) { setScalar("session", { templateId, mode, startedAt: now(), done: [] }); },
  markStep(i) {
    if (!state.session) return;
    const done = state.session.done.includes(i)
      ? state.session.done.filter((x) => x !== i)
      : [...state.session.done, i];
    setScalar("session", { ...state.session, done });
  },
  endSession(minutes) {
    const s = state.session;
    if (!s) return;
    commit({
      ...state, session: null, stamps: { ...state.stamps, session: now() },
      sessions: [...state.sessions, { date: today(), kind: s.templateId, minutes: Number(minutes) || 0, mode: s.mode, at: now() }],
    });
  },
  cancelSession() { setScalar("session", null); },

  setEvidence(labId, note) { commit({ ...state, evidence: { ...state.evidence, [labId]: stamp({ ...note, date: today() }) } }); },

  setReview(id, entry) { commit({ ...state, reviews: { ...state.reviews, [id]: stamp(entry) } }); },
  deleteReview(id) { const reviews = { ...state.reviews }; delete reviews[id]; commit({ ...state, reviews }); },

  toggleBookmark(key) {
    const b = { ...state.bookmarks };
    if (b[key]) delete b[key]; else b[key] = stamp({});
    commit({ ...state, bookmarks: b });
  },
  setPref(key, value) { commit({ ...state, prefs: { ...state.prefs, [key]: stamp({ value }) } }); },

  exportJson() { return JSON.stringify(state, null, 2); },
  importJson(text) {
    const p = JSON.parse(text);
    if (!p || typeof p !== "object" || !p.version) throw new Error("Not a Forge progress file.");
    commit(merge(state, p));                   // import JOINS, it never destroys
  },
  reset() { lastPushed = ""; commit({ ...EMPTY }); },
  flush: pushNow,
};

export function useProgress() {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, () => EMPTY);
}
export function useSyncState() {
  return useSyncExternalStore(progressStore.subscribeSync, progressStore.getSync, () => ({ status: "local", at: 0, error: null }));
}
export { today, SCALARS };
export * from "./state.js";
