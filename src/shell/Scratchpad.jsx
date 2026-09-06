"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Label, Mono } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";

/* ══════════════════════════════════════════════════════════════════════════
   SCRATCHPAD — a panel that follows you, so working out a problem never means
   leaving the site.

   Two things make it useful rather than another empty text box. It is SCOPED:
   the pad you get on a problem page is that problem's pad, and it is still
   there when you come back next week. And it is CHEAP to reach — one key,
   never covering the thing you are reading, saved as you type.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY_FOR = (pathname, params) => {
  const p = params?.get?.("problem");
  if (p) return { key: `problem:${p}`, label: `problem ${p}` };
  if (pathname?.startsWith("/labs/")) return { key: `lab:${pathname.slice(6)}`, label: pathname.slice(6) };
  if (pathname?.startsWith("/learn/guide/")) return { key: `guide:${pathname.slice(13)}`, label: `guide ${pathname.slice(13)}` };
  const surface = (pathname || "/").split("/")[1] || "today";
  return { key: `surface:${surface}`, label: surface };
};

export default function Scratchpad() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const prog = useProgress();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef(null);
  const { key, label } = KEY_FOR(pathname, params);
  const noteKey = `pad:${key}`;
  const saved = prog.notes?.[noteKey]?.text || "";

  /* Local while typing so every keystroke is not a store write. */
  const [draft, setDraft] = useState(saved);
  const [seenKey, setSeenKey] = useState(noteKey);
  if (noteKey !== seenKey) { setSeenKey(noteKey); setDraft(saved); }

  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== saved) progressStore.setNote(noteKey, draft);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, saved, noteKey]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {          // toggle from anywhere, typing included
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) setTimeout(() => ref.current?.focus(), 60);
        return;
      }
      if (typing) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => ref.current?.focus(), 60);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Notes were write-only: saved per surface and never surfaced again, so a
     note written while solving was effectively deleted. This is the index. */
  const pads = useMemo(() => Object.entries(prog.notes || {})
    .filter(([k, v]) => k.startsWith("pad:") && v?.text?.trim())
    .map(([k, v]) => {
      const scope = k.slice(4);
      const [kind, id] = scope.split(":");
      const href = kind === "problem" ? `/practice?problem=${id}`
        : kind === "lab" ? `/labs/${id}`
        : kind === "guide" ? `/learn/guide/${id}`
        : `/${id || "today"}`;
      return { key: k, scope, kind, id, href, text: v.text.trim(), at: v.at || 0, current: k === noteKey };
    })
    .sort((a, b) => b.at - a.at), [prog.notes, noteKey]);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <>
      {!open && (
        <button className="press pad-fab" onClick={() => { setOpen(true); setTimeout(() => ref.current?.focus(), 60); }}
          title="Scratchpad (n)">
          <span>✎</span>
          {pads.length > 0 && <span className="pad-fab-dot" />}
        </button>
      )}

      {open && (
        <aside className="pad anim-riseSm" data-wide={wide ? "1" : undefined}>
          <header className="pad-head">
            <Label hue="accent">scratchpad</Label>
            <Mono dim>{label}</Mono>
            <div style={{ flex: 1 }} />
            {words > 0 && <Mono dim>{words}w</Mono>}
            <button className="press pad-btn" onClick={() => setWide((w) => !w)} title={wide ? "Narrow" : "Widen"}>{wide ? "▸" : "◂"}</button>
            <button className="press pad-btn" onClick={() => setOpen(false)} title="Close (esc)">✕</button>
          </header>

          <textarea ref={ref} className="pad-area" value={draft} spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"Invariant, then the code.\n\nWhat is the state?\nWhat does each step preserve?\nWhat is the case I have not handled?"} />

          {showAll && (
            <div className="pad-index">
              {pads.length === 0 && <Mono dim>No notes yet. Anything you type here is kept per page.</Mono>}
              {pads.map((n) => (
                <button key={n.key} className="press pad-index-row" data-current={n.current ? "1" : undefined}
                  onClick={() => { setShowAll(false); if (!n.current) router.push(n.href); }}>
                  <Mono dim>{n.kind === "surface" ? n.id : `${n.kind} ${n.id}`}</Mono>
                  <span className="pad-index-text">{n.text.split("\n")[0].slice(0, 90)}</span>
                </button>
              ))}
            </div>
          )}

          <footer className="pad-foot">
            <Mono dim>saved automatically · scoped to this page</Mono>
            <div style={{ flex: 1 }} />
            <button className="press pad-btn" data-on={showAll ? "1" : undefined} onClick={() => setShowAll((v) => !v)}>
              {pads.length} note{pads.length === 1 ? "" : "s"}
            </button>
            <button className="press pad-btn" title="Copy" onClick={() => navigator.clipboard?.writeText(draft).catch(() => {})}>copy</button>
          </footer>
        </aside>
      )}
    </>
  );
}
