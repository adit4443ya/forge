"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { PROBLEMS } from "@/dsaData.jsx";
import { PREP_INDEX, PREP_MODULE_LABELS } from "@/data/generated/prepIndex.js";
import { GUIDES } from "@/data/generated/guides.js";
import { ROLES, allCompetencies } from "@/data/roles.js";
import { SURFACES } from "./nav.js";
import LABS from "@/data/labs.json";

/* ══════════════════════════════════════════════════════════════════════════
   COMMAND PALETTE — one keystroke to anything.
   Ranks by kind, then by whether the match is a prefix, then by length.
   ══════════════════════════════════════════════════════════════════════════ */

const KIND = {
  action:     { label: "Go",         hue: "accent" },
  problem:    { label: "Problem",    hue: "warn" },
  competency: { label: "Competency", hue: "ok" },
  guide:      { label: "Guide",      hue: "info" },
  lab:        { label: "Lab",        hue: "ok" },
  qa:         { label: "Q&A",        hue: "neutral" },
};

export default function CommandPalette({ open, onClose, nav }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  /* Shell mounts this only while open, so "on mount" is "on open". */
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 20); return () => clearTimeout(t); }, []);

  const index = useMemo(() => {
    const out = [];
    SURFACES.forEach((s) => out.push({ kind: "action", title: s.label, sub: s.hint, run: () => nav.go(s.id), badge: s.key }));
    ROLES.forEach((r) => out.push({ kind: "action", title: `Switch to ${r.name}`, sub: r.tag, run: () => nav.setRole(r.id) }));
    allCompetencies().forEach((c) => out.push({ kind: "competency", title: c.name, sub: `${c.roleName} · ${c.level}`, run: () => nav.openCompetency(c.id) }));
    PROBLEMS.forEach((p) => out.push({ kind: "problem", title: p.title, sub: `${p.section} · ${p.difficulty}`, run: () => nav.openProblem(p.id) }));
    GUIDES.forEach((g) => {
      out.push({ kind: "guide", title: g.title, sub: `Guide ${g.num}`, run: () => nav.openGuide(g.num) });
      g.headings.slice(0, 40).forEach((h) => out.push({ kind: "guide", title: h.text, sub: g.title, run: () => nav.openGuide(g.num, h.id) }));
    });
    LABS.labs.forEach((l) => out.push({ kind: "lab", title: l.title, sub: `${l.id} · ${l.file}`, run: () => nav.openLab(l.id) }));
    PREP_INDEX.forEach((p) => out.push({ kind: "qa", title: p.question, sub: PREP_MODULE_LABELS[p.module] || p.module, run: () => nav.go("learn", { kind: "module", id: p.module }) }));
    return out;
  }, [nav]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return index.filter((x) => x.kind === "action").slice(0, 9);
    const order = { action: 0, competency: 1, problem: 2, lab: 3, guide: 4, qa: 5 };
    return index
      .map((x) => {
        const t = x.title.toLowerCase();
        const i = t.indexOf(needle);
        if (i < 0) return null;
        return { ...x, score: order[x.kind] * 1000 + (i === 0 ? 0 : 400) + Math.min(t.length, 300) };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);
  }, [q, index]);

  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) { setSeenQ(q); setSel(0); }
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;
  const activate = (r) => { if (!r) return; r.run(); onClose(); };

  return (
    <div onClick={onClose} className="anim-fade"
      style={{ position: "fixed", inset: 0, zIndex: 200, background: tk.scrim, backdropFilter: "blur(3px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "11vh", padding: "11vh var(--sp-4) var(--sp-4)" }}>
      <div onClick={(e) => e.stopPropagation()} className="anim-scale"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); activate(results[sel]); }
        }}
        style={{ width: "min(94vw, 640px)", background: tk.bg1, border: `1px solid ${tk.line2}`, borderRadius: "var(--r-4)",
          boxShadow: tk.shadow3, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", borderBottom: `1px solid ${tk.line}` }}>
          <span style={{ color: tk.faint, fontSize: 15 }}>⌕</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Problems, competencies, guides, labs, questions…"
            style={{ flex: 1, background: "transparent", border: "none", color: tk.text, fontSize: "var(--fs-md)" }} />
          <kbd className="mono" style={{ fontSize: "var(--fs-micro)", border: `1px solid ${tk.line}`, borderRadius: 4, padding: "2px 6px", color: tk.faint }}>esc</kbd>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: "var(--sp-6)", textAlign: "center", color: tk.faint, fontSize: "var(--fs-sm)" }}>
              Nothing matches <span className="mono" style={{ color: tk.dim }}>{q}</span>
            </div>
          )}
          {results.map((r, i) => {
            const on = i === sel;
            const k = KIND[r.kind];
            return (
              <button key={i} data-i={i} onClick={() => activate(r)} onMouseMove={() => setSel(i)}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                  padding: "9px 11px", borderRadius: "var(--r-2)", background: on ? tk.bg3 : "transparent",
                  border: `1px solid ${on ? tk.line2 : "transparent"}` }}>
                <span className="mono" style={{ fontSize: "var(--fs-micro)", fontWeight: 700, letterSpacing: ".06em",
                  color: H(k.hue).fg, background: H(k.hue).bg, border: `1px solid ${H(k.hue).line}`,
                  padding: "2px 6px", borderRadius: 4, minWidth: 74, textAlign: "center", flexShrink: 0 }}>{k.label}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="truncate" style={{ display: "block", color: on ? tk.text : tk.dim, fontSize: "var(--fs-sm)", fontWeight: on ? 600 : 450 }}>{r.title}</span>
                  {r.sub && <span className="mono truncate" style={{ display: "block", color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 1 }}>{r.sub}</span>}
                </span>
                {r.badge && <kbd className="mono" style={{ fontSize: "var(--fs-micro)", border: `1px solid ${tk.line}`, borderRadius: 4, padding: "1px 5px", color: tk.faint, flexShrink: 0 }}>{r.badge}</kbd>}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "var(--sp-4)", padding: "8px 16px", borderTop: `1px solid ${tk.line}`, background: tk.bg }}>
          {[["↑↓", "navigate"], ["↵", "open"], ["1-5", "surfaces"], ["esc", "close"]].map(([k, v]) => (
            <span key={k} className="mono" style={{ fontSize: "var(--fs-micro)", color: tk.faint }}>
              <span style={{ color: tk.dim }}>{k}</span> {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
