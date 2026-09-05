"use client";
import { useMemo, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Bar, Note, Empty, Code } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";
import { useTargetChange } from "@/ui/hooks.js";
import LABS from "@/data/labs.json";

/* ══════════════════════════════════════════════════════════════════════════
   LABS — the execution arena. The site cannot run these; your machine does.
   A lab counts as done when you have its evidence note, not when you read it.
   ══════════════════════════════════════════════════════════════════════════ */

const TRACK_HUE = {
  debug: "bad", ir: "warn", cross_level: "info", perf: "ok", cache: "info",
  codegen: "accent", concurrency: "warn", systems: "ok", aarch64: "bad", bigcode: "info", capstones: "accent",
};
const Dots = ({ n }) => (
  <span className="mono" style={{ color: tk.faint, fontSize: "var(--fs-micro)", letterSpacing: 1 }}>
    <span style={{ color: tk.accent }}>{"●".repeat(n)}</span>{"○".repeat(Math.max(0, 4 - n))}
  </span>
);

function EvidenceForm({ labId, existing, onClose }) {
  const [f, setF] = useState(existing || { claim: "", evidence: "", surprise: "" });
  const field = (k, ph, rows = 2) => (
    <label style={{ display: "block", marginBottom: "var(--sp-3)" }}>
      <Label style={{ display: "block", marginBottom: 5 }}>{k}</Label>
      <textarea rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph}
        style={{ width: "100%", padding: "9px 11px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`,
          background: tk.bg, color: tk.text, fontSize: "var(--fs-sm)", lineHeight: 1.6, resize: "vertical" }} />
    </label>
  );
  return (
    <div className="anim-riseSm" style={{ marginTop: "var(--sp-3)", padding: "var(--sp-4)", background: tk.bg, border: `1px solid ${tk.line2}`, borderRadius: "var(--r-2)" }}>
      {field("claim", "One sentence: what this lab showed you on your machine.")}
      {field("evidence", "The numbers or output that support it. Paste the line that matters.", 3)}
      {field("surprise", "The thing you did not expect. If there was none, you did not look hard enough.")}
      <div className="row">
        <Button hue="ok" onClick={() => { progressStore.setEvidence(labId, f); onClose(); }}>Save note</Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function Labs({ role, target }) {
  const prog = useProgress();
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [onlyRole, setOnlyRole] = useState(false);

  useTargetChange(target, (t) => { if (t.kind === "lab") setOpen(t.id); });

  const roleLabIds = useMemo(() => {
    const prefixes = role.competencies.flatMap((c) => c.labs || []);
    return new Set(LABS.labs.filter((l) => prefixes.some((p) => l.id === p || l.id.startsWith(p))).map((l) => l.id));
  }, [role]);

  const tracks = useMemo(() => [...LABS.tracks].sort((a, b) => a.order - b.order), []);
  const byTrack = useMemo(() => {
    const m = {};
    LABS.labs.forEach((l) => { if (!onlyRole || roleLabIds.has(l.id)) (m[l.track] = m[l.track] || []).push(l); });
    return m;
  }, [onlyRole, roleLabIds]);

  const shown = Object.values(byTrack).flat();
  const done = shown.filter((l) => prog.labs[l.id]).length;
  const withEvidence = shown.filter((l) => prog.evidence?.[l.id]?.claim).length;

  return (
    <div className="pane-pad">
      <div className="anim-rise">
        <H1>Labs</H1>
        <Muted style={{ marginTop: 8, maxWidth: "72ch" }}>
          Sixty-one runnable labs in the <span className="mono" style={{ color: tk.accent }}>debug_lab</span> repository. Every number in
          their headers was produced on the machine that wrote them; your job is to reproduce it and explain any difference. A lab is
          finished when you can write its evidence note, not when you have read it.
        </Muted>
      </div>

      <div className="row" style={{ margin: "var(--sp-5) 0" }}>
        <Panel hue="ok" style={{ padding: "var(--sp-3) var(--sp-4)", flex: 1, minWidth: 200 }}>
          <div className="row">
            <Label hue="ok">completed</Label>
            <div style={{ flex: 1 }} />
            <Mono>{done} / {shown.length}</Mono>
          </div>
          <div style={{ marginTop: 8 }}><Bar value={done} max={shown.length} hue="ok" height={5} /></div>
        </Panel>
        <Panel hue="accent" style={{ padding: "var(--sp-3) var(--sp-4)", flex: 1, minWidth: 200 }}>
          <div className="row">
            <Label hue="accent">with an evidence note</Label>
            <div style={{ flex: 1 }} />
            <Mono>{withEvidence} / {shown.length}</Mono>
          </div>
          <div style={{ marginTop: 8 }}><Bar value={withEvidence} max={shown.length} hue="accent" height={5} /></div>
        </Panel>
        <Button hue={onlyRole ? "accent" : "neutral"} onClick={() => setOnlyRole((v) => !v)}>
          {onlyRole ? `✓ ${role.name} only` : `Filter to ${role.name}`}
        </Button>
      </div>

      {tracks.map((t, ti) => {
        const labs = byTrack[t.id] || [];
        if (!labs.length) return null;
        const d = labs.filter((l) => prog.labs[l.id]).length;
        return (
          <Section key={t.id} i={ti} title={t.title} hue={TRACK_HUE[t.id] || "neutral"}
            right={<div className="row" style={{ minWidth: 150 }}><Mono dim>{d}/{labs.length}</Mono><Bar value={d} max={labs.length} hue={TRACK_HUE[t.id] || "accent"} /></div>}>
            <Muted style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--sp-3)" }}>{t.summary}</Muted>
            <Code label="// run it">{t.run}</Code>
            <div style={{ display: "grid", gap: 2, marginTop: "var(--sp-3)" }}>
              {labs.map((l, i) => {
                const isDone = !!prog.labs[l.id];
                const ev = prog.evidence?.[l.id];
                const isOpen = open === l.id;
                return (
                  <div key={l.id} className="anim-slide" style={{ "--i": Math.min(i, 10),
                    border: `1px solid ${isOpen ? tk.line2 : "transparent"}`, borderRadius: "var(--r-2)",
                    background: isOpen ? tk.bg1 : "transparent", transition: "background var(--dur-2), border-color var(--dur-2)" }}>
                    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 11px" }}>
                      <button className="press" onClick={() => progressStore.toggleLab(l.id)} title={isDone ? "Mark not done" : "Mark done"}
                        style={{ width: 19, height: 19, marginTop: 2, flexShrink: 0, borderRadius: "var(--r-1)",
                          border: `1px solid ${isDone ? tk.ok : tk.line2}`, background: isDone ? tk.okBg : "transparent",
                          color: tk.ok, display: "grid", placeItems: "center", fontSize: 11 }}>{isDone ? "✓" : ""}</button>
                      <button onClick={() => setOpen(isOpen ? null : l.id)} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div className="row" style={{ gap: 8 }}>
                          <Mono dim>{l.id}</Mono>
                          <span style={{ color: isDone ? tk.faint : tk.text, fontSize: "var(--fs-sm)", fontWeight: 550, textDecoration: isDone ? "line-through" : "none" }}>{l.title}</span>
                          <Dots n={l.difficulty} />
                          {ev?.claim && <Tag hue="accent">note</Tag>}
                        </div>
                        <Mono dim style={{ display: "block", marginTop: 2 }}>{l.file}</Mono>
                      </button>
                    </div>
                    <div className={`reveal${isOpen ? " open" : ""}`}><div className="reveal-inner">
                      <div style={{ padding: "0 11px 12px 41px" }}>
                        <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.7, marginBottom: "var(--sp-2)" }}>
                          <span style={{ color: H(TRACK_HUE[t.id] || "accent").fg }}>evidence to leave with: </span>{l.evidence}
                        </div>
                        <div className="row">{(l.skills || []).map((s) => <Tag key={s}>{s}</Tag>)}</div>
                        {l.prereqs?.length > 0 && <Mono dim style={{ display: "block", marginTop: 8 }}>after: {l.prereqs.join(", ")}</Mono>}
                        {ev?.claim && !editing && (
                          <div style={{ marginTop: "var(--sp-3)", padding: "var(--sp-3)", background: tk.bg, border: `1px solid ${tk.line}`, borderRadius: "var(--r-2)" }}>
                            {["claim", "evidence", "surprise"].map((k) => ev[k] ? (
                              <div key={k} style={{ marginBottom: 8 }}>
                                <Label>{k}</Label>
                                <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ev[k]}</div>
                              </div>
                            ) : null)}
                            <Mono dim>saved {ev.date}</Mono>
                          </div>
                        )}
                        {editing === l.id
                          ? <EvidenceForm labId={l.id} existing={ev} onClose={() => setEditing(null)} />
                          : <div style={{ marginTop: "var(--sp-3)" }}><Button size="sm" hue="accent" onClick={() => setEditing(l.id)}>{ev?.claim ? "Edit evidence note" : "Write the evidence note"}</Button></div>}
                      </div>
                    </div></div>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      {shown.length === 0 && <Empty icon="⌬" title="No labs for this filter">Turn off the role filter to see all {LABS.labs.length}.</Empty>}

      <Note hue="info" title="where the labs live">
        Clone or open <span className="mono" style={{ color: tk.text }}>~/debug_lab</span> and follow each file&apos;s STEP commands. The
        AArch64 track needs one setup run first: <span className="mono" style={{ color: tk.text }}>tools/a64-setup.sh</span>, which needs no root.
      </Note>
    </div>
  );
}
