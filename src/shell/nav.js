"use client";
/* The navigation contract every screen already speaks, backed by real URLs.
   Screens are unchanged: they still call nav.openProblem(id); the difference is
   that doing so now changes the address bar, so every view is shareable and the
   browser's back button works. */
import { createContext, useContext } from "react";

export const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

export const SURFACES = [
  { id: "today",    label: "Today",    key: "1", href: "/today",    hint: "the session to run right now" },
  { id: "practice", label: "Practice", key: "2", href: "/practice", hint: "problems, drills and quizzes" },
  { id: "learn",    label: "Learn",    key: "3", href: "/learn",    hint: "guides and rapid recall, by competency" },
  { id: "labs",     label: "Labs",     key: "4", href: "/labs",     hint: "runnable evidence on your own machine" },
  { id: "progress", label: "Progress", key: "5", href: "/progress", hint: "what you have actually done" },
];

/* A deep link is expressed in the query string, and the whole string is the
   identity a screen compares against to notice "the target changed". */
export function targetFromParams(params) {
  const get = (k) => params?.get?.(k) ?? null;
  if (get("problem")) return { kind: "problem", id: Number(get("problem")), n: `problem:${get("problem")}` };
  if (get("guide")) return { kind: "guide", num: get("guide"), anchor: get("anchor") || null, n: `guide:${get("guide")}:${get("anchor") || ""}` };
  if (get("competency")) return { kind: "competency", id: get("competency"), n: `competency:${get("competency")}` };
  if (get("lab")) return { kind: "lab", id: get("lab"), n: `lab:${get("lab")}` };
  if (get("session")) return { kind: "session", id: get("session"), n: `session:${get("session")}` };
  if (get("tab")) return { kind: "tab", id: get("tab"), n: `tab:${get("tab")}` };
  if (get("module")) return { kind: "module", id: get("module"), n: `module:${get("module")}` };
  return null;
}

export function hrefFor(surface, target) {
  const base = `/${surface}`;
  if (!target) return base;
  const q = new URLSearchParams();
  if (target.kind === "problem") q.set("problem", target.id);
  else if (target.kind === "guide") { q.set("guide", target.num); if (target.anchor) q.set("anchor", target.anchor); }
  else if (target.kind === "competency") q.set("competency", target.id);
  else if (target.kind === "lab") q.set("lab", target.id);
  else if (target.kind === "session") q.set("session", target.id);
  else if (target.kind === "tab") q.set("tab", target.id);
  else if (target.kind === "module") q.set("module", target.id);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
