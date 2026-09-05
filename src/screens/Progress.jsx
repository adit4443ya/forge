"use client";
import { useMemo, useRef, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Bar, Ring, Note, Empty, Stat } from "@/ui/kit.jsx";
import { useNav } from "@/shell/nav.js";
import { useProgress, progressStore, weekNumber, sessionsThisWeek, streak, dailyMinutes, isSolved, isSolvedIn, attemptCount } from "@/lib/progress/store.js";
import { TIERS } from "@/data/dsaCurriculum.js";
import { ROLES } from "@/data/roles.js";
import { PHASES, phaseForWeek } from "@/data/roadmap.js";
import { stats as reviewStats } from "@/lib/review.js";
import { PROBLEMS } from "@/dsaData.jsx";
import LABS from "@/data/labs.json";

/* ══════════════════════════════════════════════════════════════════════════
   PROGRESS — the evidence that you are getting better, and the one number
   that is allowed to be honest about it.
   ══════════════════════════════════════════════════════════════════════════ */

/* Readiness is deliberately hard to move. Each component is capped and the
   coding component only counts problems solved in MOCK mode: nothing else
   simulates the thing being measured. */
function readiness(prog) {
  const ids = TIERS.flatMap((t) => t.groups.flatMap((g) => g.ids));
  const solvedMock = ids.filter((id) => isSolvedIn(prog.dsa[id], "mock")).length;
  const solvedAny = ids.filter((id) => isSolved(prog.dsa[id])).length;
  const labs = LABS.labs.filter((l) => prog.labs[l.id]).length;
  const evidence = Object.values(prog.evidence || {}).filter((e) => e?.claim).length;
  const mocks = prog.sessions.filter((s) => s.kind === "D" || s.kind === "mock").length;
  const weeks = new Set(prog.sessions.map((s) => { const d = new Date(s.date); const y = d.getFullYear(); const w = Math.floor((d - new Date(y, 0, 1)) / 604800000); return `${y}-${w}`; })).size;

  const parts = [
    { id: "coding",     label: "Coding under mock conditions", value: Math.min(1, solvedMock / 40), weight: 30, detail: `${solvedMock} problems solved in mock mode (40 for full marks)` },
    { id: "coverage",   label: "Pattern coverage",             value: Math.min(1, solvedAny / ids.length), weight: 15, detail: `${solvedAny} of ${ids.length} problems solved in any mode` },
    { id: "labs",       label: "Labs completed",               value: Math.min(1, labs / LABS.labs.length), weight: 20, detail: `${labs} of ${LABS.labs.length} labs` },
    { id: "evidence",   label: "Evidence notes written",       value: Math.min(1, evidence / 20), weight: 10, detail: `${evidence} notes (20 for full marks)` },
    { id: "mocks",      label: "Full mocks run",               value: Math.min(1, mocks / 8), weight: 15, detail: `${mocks} mock sessions (8 for full marks)` },
    { id: "consistency",label: "Weeks with any work",          value: Math.min(1, weeks / 20), weight: 10, detail: `${weeks} distinct weeks` },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0));
  return { score, parts };
}

function Heatmap({ days }) {
  const max = Math.max(60, ...days.map((d) => d.minutes));
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {days.map((d, i) => {
        const t = d.minutes / max;
        return (
          <div key={d.date} title={`${d.date} · ${d.minutes} min`} className="anim-fade"
            style={{ "--i": Math.min(i, 20), width: 15, height: 15, borderRadius: 3,
              background: d.minutes === 0 ? tk.bg2 : `color-mix(in srgb, ${tk.accent} ${Math.round(22 + t * 78)}%, ${tk.bg2})`,
              border: `1px solid ${d.minutes ? tk.accentLine : tk.line}` }} />
        );
      })}
    </div>
  );
}

export default function Progress() {
  const prog = useProgress();
  const nav = useNav();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");

  const week = weekNumber(prog.startDate);
  const phase = phaseForWeek(week);
  const r = useMemo(() => readiness(prog), [prog]);
  const days = useMemo(() => dailyMinutes(prog.sessions, 56), [prog.sessions]);
  const st = streak(prog.sessions);
  const thisWeek = sessionsThisWeek(prog.sessions);
  const rs = reviewStats();
  const totalMin = prog.sessions.reduce((a, s) => a + (s.minutes || 0), 0);

  const tierStats = TIERS.map((t) => {
    const ids = t.groups.flatMap((g) => g.ids);
    return { t, total: ids.length,
      solved: ids.filter((id) => isSolved(prog.dsa[id])).length,
      mock: ids.filter((id) => isSolvedIn(prog.dsa[id], "mock")).length,
      tried: ids.filter((id) => attemptCount(prog.dsa[id]) > 0).length };
  });

  const weakest = useMemo(() => {
    const bySection = {};
    PROBLEMS.forEach((p) => {
      const e = prog.dsa[p.id];
      const n = attemptCount(e);
      if (!n) return;
      const s = bySection[p.section] || (bySection[p.section] = { fails: 0, total: 0 });
      s.total += n;
      s.fails += (e.attempts || []).filter((a) => a.result !== "solved").length;
    });
    return Object.entries(bySection).filter(([, v]) => v.total >= 2)
      .map(([k, v]) => ({ section: k, rate: v.fails / v.total, total: v.total }))
      .sort((a, b) => b.rate - a.rate).slice(0, 5);
  }, [prog.dsa]);

  const exportJson = () => {
    const blob = new Blob([progressStore.exportJson()], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `forge-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (file) => {
    if (!file) return;
    try { progressStore.importJson(await file.text()); setMsg("Imported."); }
    catch (e) { setMsg("Import failed: " + e.message); }
  };

  return (
    <div className="pane-pad">
      <div className="anim-rise"><H1>Progress</H1>
        <Muted style={{ marginTop: 8, maxWidth: "72ch" }}>
          Everything here is stored in this browser only. Export it before you clear site data or move machines.
        </Muted>
      </div>

      {/* ── readiness ────────────────────────────────────────── */}
      <Section title="Readiness" hue="accent" i={0} style={{ marginTop: "var(--sp-6)" }}>
        <Panel hue="accent" style={{ padding: "var(--sp-5)" }}>
          <div style={{ display: "flex", gap: "var(--sp-5)", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <Ring value={r.score} max={100} size={100} stroke={6} hue={r.score >= 70 ? "ok" : r.score >= 35 ? "accent" : "neutral"}>
                <span style={{ fontSize: "var(--fs-2xl)", fontWeight: 700 }}>{r.score}</span>
              </Ring>
              <Mono dim style={{ display: "block", marginTop: 8 }}>{r.score === 0 ? "not started" : r.score < 35 ? "early" : r.score < 70 ? "building" : "interview ready"}</Mono>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <Muted style={{ fontSize: "var(--fs-sm)" }}>
                One number, weighted so it is hard to fake. The coding component counts only problems solved in
                <span style={{ color: tk.accent }}> mock mode</span>, because that is the only mode that resembles the thing being measured.
              </Muted>
              <div style={{ display: "grid", gap: "var(--sp-3)", marginTop: "var(--sp-4)" }}>
                {r.parts.map((p, i) => (
                  <div key={p.id} className="anim-slide" style={{ "--i": i }}>
                    <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                      <span style={{ color: tk.dim, fontSize: "var(--fs-xs)", flex: 1 }}>{p.label}</span>
                      <Mono dim>{Math.round(p.value * p.weight)}/{p.weight}</Mono>
                    </div>
                    <Bar value={p.value} max={1} hue={p.value >= .9 ? "ok" : p.value >= .4 ? "accent" : "neutral"} height={4} />
                    <Mono dim style={{ display: "block", marginTop: 4, fontSize: "var(--fs-micro)" }}>{p.detail}</Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </Section>

      {/* ── activity ─────────────────────────────────────────── */}
      <Section title="Activity" i={1} right={<Mono dim>last 8 weeks</Mono>}>
        <Panel style={{ padding: "var(--sp-4)" }}>
          <div className="row" style={{ marginBottom: "var(--sp-4)", gap: "var(--sp-5)" }}>
            <div><Label>streak</Label><div className="mono" style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: st ? tk.ok : tk.faint }}>{st}<span style={{ fontSize: "var(--fs-sm)", color: tk.faint }}> d</span></div></div>
            <div><Label>this week</Label><div className="mono" style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: thisWeek.length >= 3 ? tk.ok : tk.accent }}>{thisWeek.length}<span style={{ fontSize: "var(--fs-sm)", color: tk.faint }}>/3</span></div></div>
            <div><Label>sessions</Label><div className="mono" style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: tk.text }}>{prog.sessions.length}</div></div>
            <div><Label>hours logged</Label><div className="mono" style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: tk.text }}>{(totalMin / 60).toFixed(1)}</div></div>
            <div style={{ flex: 1 }} />
            {week != null && <div style={{ textAlign: "right" }}><Label>phase</Label><div style={{ color: tk.accent, fontWeight: 650 }}>{phase.name}</div></div>}
          </div>
          <Heatmap days={days} />
          <Mono dim style={{ display: "block", marginTop: "var(--sp-2)" }}>each square is one day; darker is more minutes</Mono>
        </Panel>
      </Section>

      {/* ── curriculum ───────────────────────────────────────── */}
      <Section title="Curriculum" i={2} right={<button className="press" onClick={() => nav.go("practice")} style={{ fontSize: "var(--fs-xs)", color: tk.accent, fontWeight: 600 }}>practice →</button>}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          {tierStats.map(({ t, total, solved, mock, tried }, i) => (
            <Panel key={t.id} i={i} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
              <div className="row" style={{ gap: 10 }}>
                <Mono style={{ color: tk.accent, fontWeight: 700, minWidth: 46 }}>TIER {t.id}</Mono>
                <span style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 600, flex: 1, minWidth: 0 }}>{t.name}</span>
                <Mono dim>≤ {t.budgetMin} min</Mono>
              </div>
              <div className="row" style={{ marginTop: 9, gap: "var(--sp-3)" }}>
                <div style={{ flex: 1 }}><Bar value={solved} max={total} hue="ok" height={5} /></div>
                <Mono dim style={{ minWidth: 128, textAlign: "right" }}>{solved} solved · {mock} in mock · {tried - solved} open</Mono>
              </div>
            </Panel>
          ))}
        </div>
      </Section>

      {/* ── weak areas ───────────────────────────────────────── */}
      <Section title="Where you are losing" i={3}>
        {weakest.length === 0 ? (
          <Empty icon="◌" title="Not enough attempts yet">Log a few problems and this fills in with the patterns that cost you the most.</Empty>
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            {weakest.map((w, i) => (
              <Panel key={w.section} i={i} hue={w.rate > .5 ? "bad" : "warn"} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 600, flex: 1 }}>{w.section}</span>
                  <Mono dim>{w.total} attempts</Mono>
                  <Mono style={{ color: w.rate > .5 ? tk.bad : tk.warn, fontWeight: 700 }}>{Math.round(w.rate * 100)}% not solved</Mono>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      {/* ── review ───────────────────────────────────────────── */}
      <Section title="Review queue" i={4} right={<button className="press" onClick={() => nav.go("learn", { kind: "review" })} style={{ fontSize: "var(--fs-xs)", color: tk.accent, fontWeight: 600 }}>open →</button>}>
        <div className="grid-auto">
          <Stat label="due now" value={rs.due} hue={rs.due ? "warn" : "neutral"} i={0} />
          <Stat label="total cards" value={rs.total} hue="accent" i={1} />
          <Stat label="in review state" value={rs.byState.review} hue="ok" i={2} />
          <Stat label="still learning" value={rs.byState.learning + rs.byState.relearning} hue="info" i={3} />
        </div>
      </Section>

      {/* ── roles ────────────────────────────────────────────── */}
      <Section title="Role coverage" i={5}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          {ROLES.map((role, i) => {
            const prefixes = role.competencies.flatMap((c) => c.labs || []);
            const labs = LABS.labs.filter((l) => prefixes.some((p) => l.id === p || l.id.startsWith(p)));
            const done = labs.filter((l) => prog.labs[l.id]).length;
            return (
              <Panel key={role.id} i={i} hue={role.id === prog.role ? role.hue : "neutral"} active={role.id === prog.role}
                onClick={() => { progressStore.setRole(role.id); nav.go("learn"); }} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ color: H(role.hue).fg }}>{role.icon}</span>
                  <span style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 600, flex: 1 }}>{role.name}</span>
                  <Mono dim>{role.competencies.length} competencies</Mono>
                  <div style={{ width: 90 }}><Bar value={done} max={Math.max(1, labs.length)} hue={role.hue} /></div>
                  <Mono dim style={{ minWidth: 48, textAlign: "right" }}>{done}/{labs.length}</Mono>
                </div>
              </Panel>
            );
          })}
        </div>
      </Section>

      {/* ── data ─────────────────────────────────────────────── */}
      <Section title="Your data" i={6}>
        <div className="row">
          <Button hue="accent" onClick={exportJson}>Export JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>Import</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
          <Button hue="bad" onClick={() => { if (window.confirm("Erase all local progress? This cannot be undone.")) { progressStore.reset(); setMsg("Reset."); } }}>Reset everything</Button>
          {msg && <Mono style={{ color: tk.ok }}>{msg}</Mono>}
        </div>
        <Note hue="info" title="how this is stored">
          One localStorage key in this browser. Nothing is sent anywhere, there is no account, and clearing site data deletes it.
          Export before you switch machines.
        </Note>
      </Section>
    </div>
  );
}
