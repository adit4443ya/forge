"use client";
import { useMemo, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Bar, Note, Empty, Code } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";
import { useTargetChange } from "@/ui/hooks.js";
import { LAB_INDEX, LAB_TRACKS } from "@/data/generated/labs.js";
import { REPO } from "@/data/links.js";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function Labs({ role, target }) {
  const prog = useProgress();
  /* Default to the role: the top-bar switch is a real filter, not decoration. */
  const [onlyRole, setOnlyRole] = useState(true);

  /* A ?lab=ID deep link opens the runner directly. */
  const router = useRouter();
  useTargetChange(target, (t) => { if (t.kind === "lab") router.push(`/labs/${t.id}`); });

  const roleLabIds = useMemo(() => {
    const prefixes = role.competencies.flatMap((c) => c.labs || []);
    return new Set(LAB_INDEX.filter((l) => prefixes.some((p) => l.id === p || l.id.startsWith(p))).map((l) => l.id));
  }, [role]);

  const tracks = useMemo(() => [...LAB_TRACKS].sort((a, b) => a.order - b.order), []);
  const byTrack = useMemo(() => {
    const m = {};
    LAB_INDEX.forEach((l) => { if (!onlyRole || roleLabIds.has(l.id)) (m[l.track] = m[l.track] || []).push(l); });
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
          {onlyRole ? `✓ ${role.name} only` : `Showing all ${LAB_INDEX.length}`}
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
            <div className="lab-cards">
              {labs.map((l, i) => {
                const isDone = !!prog.labs[l.id];
                const ev = prog.evidence?.[l.id];
                return (
                  <div key={l.id} className="lab-card anim-slide" data-done={isDone ? "1" : undefined} style={{ "--i": Math.min(i, 10) }}>
                    <button className="press lab-card-check" onClick={() => progressStore.toggleLab(l.id)}
                      title={isDone ? "Mark not done" : "Mark done"} aria-label={isDone ? "Mark not done" : "Mark done"}>
                      {isDone ? "✓" : ""}
                    </button>
                    <Link href={`/labs/${l.id}`} className="lab-card-link">
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <Mono dim>{l.id}</Mono>
                        <span className="lab-card-title">{l.title}</span>
                        <Dots n={l.difficulty} />
                        {ev?.claim && <Tag hue="ok">note written</Tag>}
                      </div>
                      <div className="lab-card-meta">
                        {l.steps > 0 && <span>{l.steps} steps</span>}
                        <span>~{l.minutes} min</span>
                        {(l.skills || []).slice(0, 3).map((sk) => <span key={sk} className="lab-card-skill">{sk}</span>)}
                      </div>
                      {l.evidence && (
                        <div className="lab-card-ev">
                          <span style={{ color: H(TRACK_HUE[t.id] || "accent").fg }}>leave with: </span>{l.evidence}
                        </div>
                      )}
                    </Link>
                    <Link href={`/labs/${l.id}`} className="press lab-card-go" aria-label={`Open ${l.title}`}>→</Link>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      {shown.length === 0 && <Empty icon="⌬" title="No labs for this filter">Turn off the role filter to see all {LAB_INDEX.length}.</Empty>}

      <Note hue="info" title="how a lab works">
        Open a lab and it walks you through it: what it teaches, the build line, then each step with the command to copy and the
        output that step produced on the machine that wrote the lab — so you compare against a real number instead of guessing.
        Clone the labs and run the commands in a terminal:{" "}
        <a href={REPO.labs} target="_blank" rel="noopener noreferrer"
           style={{ color: tk.accent, fontFamily: "var(--font-mono)" }}>{REPO.labs.replace("https://", "")} ↗</a>.
        The AArch64 track needs one setup run first, <span className="mono" style={{ color: tk.text }}>tools/a64-setup.sh</span>, which needs no root.
      </Note>
    </div>
  );
}
