"use client";
import { useMemo, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Stat, Bar, Ring, Note, Empty } from "@/ui/kit.jsx";
import { useNow } from "@/ui/hooks.js";
import { useNav } from "@/shell/nav.js";
import { useProgress, progressStore, weekNumber, sessionsThisWeek, streak, isSolved } from "@/lib/progress/store.js";
import { SESSION_TEMPLATES, TEMPLATE_BY_ID, MODE_LIST, MODES, suggestSession, templateForRole } from "@/data/sessions.js";
import { PHASES, phaseForWeek } from "@/data/roadmap.js";
import { TIERS } from "@/data/dsaCurriculum.js";
import { dueCards, stats as reviewStats } from "@/lib/review.js";
import LABS from "@/data/labs.json";

/* ══════════════════════════════════════════════════════════════════════════
   TODAY — the only screen that answers "what do I do right now".
   Picks a session, lets you set the mode, then runs it step by step and
   launches each step into the surface that owns it.
   ══════════════════════════════════════════════════════════════════════════ */

/* Small, high-contrast glyphs: anything ornate turns to mush at 13px. */
const STEP_ICON = { review: "↻", problem: "▸", log: "✓", lab: "⌬", note: "✓", guide: "◫", flash: "⚡", drill: "◈", mock: "◉" };

function ModePicker({ value, onChange }) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-2)", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
      {MODE_LIST.map((m, i) => {
        const on = m.id === value;
        return (
          <Panel key={m.id} i={i} hue={on ? "accent" : "neutral"} active={on} onClick={() => onChange(m.id)} style={{ padding: "var(--sp-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: on ? tk.accent : tk.faint, fontSize: "var(--fs-md)" }}>{m.icon}</span>
              <span style={{ color: on ? tk.text : tk.dim, fontWeight: 650, fontSize: "var(--fs-sm)" }}>{m.name}</span>
            </div>
            <div style={{ color: tk.faint, fontSize: "var(--fs-xs)", lineHeight: 1.55 }}>{m.blurb}</div>
          </Panel>
        );
      })}
    </div>
  );
}

function RunningSession({ session, nav, prog, role }) {
  const now = useNow(15000);
  const t = templateForRole(TEMPLATE_BY_ID[session.templateId], role?.id);
  const mode = MODES[session.mode];
  const elapsedMin = Math.max(0, Math.round((now - session.startedAt) / 60000));
  const doneCount = session.done.length;
  const tier = TIERS.find((x) => x.groups.flatMap((g) => g.ids).some((id) => !isSolved(prog.dsa[id]))) || TIERS[0];
  const nextUnsolved = tier.groups.flatMap((g) => g.ids).find((id) => !isSolved(prog.dsa[id]));
  const due = useMemo(() => dueCards(new Date(now)).length, [now]);

  const launch = (step) => {
    if (step.kind === "problem") nav.openProblem(nextUnsolved);
    else if (step.kind === "review") nav.go("learn", { kind: "review" });
    else if (step.kind === "lab") nav.go("labs");
    else if (step.kind === "guide" || step.kind === "flash") nav.go("learn");
    else if (step.kind === "drill") nav.go("practice", { kind: "tab", id: "drills" });
    else if (step.kind === "mock") nav.go("practice", { kind: "tab", id: "mocks" });
  };

  return (
    <>
      <Section title="Session in progress" hue="accent" right={
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Button size="sm" onClick={() => progressStore.endSession(elapsedMin || t.minutes)} hue="ok" variant="solid">Finish · log {elapsedMin || t.minutes} min</Button>
          <Button size="sm" onClick={() => progressStore.cancelSession()}>Discard</Button>
        </div>
      }>
        <Panel hue="accent" active style={{ padding: "var(--sp-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-4)", flexWrap: "wrap" }}>
            <Ring value={doneCount} max={t.steps.length} size={54} stroke={4}>{doneCount}/{t.steps.length}</Ring>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--fs-xl)", fontWeight: 700, color: tk.text }}>{t.icon} Session {t.id} · {t.name}</span>
                <Tag hue="accent">{mode.icon} {mode.name}</Tag>
              </div>
              <Mono style={{ display: "block", marginTop: 3 }}>{elapsedMin} of {t.minutes} min elapsed · {t.purpose}</Mono>
            </div>
          </div>

          {t.steps.map((s, i) => {
            const done = session.done.includes(i);
            const current = !done && session.done.length === i;
            return (
              <div key={i} className="anim-slide" style={{ "--i": i, display: "flex", gap: "var(--sp-3)", alignItems: "flex-start",
                padding: "var(--sp-3)", borderRadius: "var(--r-2)", marginBottom: 6,
                background: current ? tk.bg2 : "transparent",
                border: `1px solid ${current ? tk.accentLine : "transparent"}`,
                opacity: done ? .5 : 1, transition: "opacity var(--dur-2), background var(--dur-2)" }}>
                <button className="press" onClick={() => progressStore.markStep(i)} title={done ? "Mark not done" : "Mark done"}
                  style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, borderRadius: "var(--r-1)",
                    border: `1px solid ${done ? tk.ok : tk.line2}`, background: done ? tk.okBg : "transparent",
                    color: tk.ok, display: "grid", placeItems: "center", fontSize: 12 }}>{done ? "✓" : ""}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: tk.faint }}>{STEP_ICON[s.kind]}</span>
                    <span style={{ color: tk.text, fontWeight: 600, fontSize: "var(--fs-sm)", textDecoration: done ? "line-through" : "none" }}>{s.label}</span>
                    <Mono dim>{s.minutes} min</Mono>
                    {s.kind === "review" && due > 0 && <Tag hue="warn">{due} due</Tag>}
                  </div>
                  <div style={{ color: tk.faint, fontSize: "var(--fs-xs)", marginTop: 2, lineHeight: 1.55 }}>{s.detail}</div>
                </div>
                {!done && <Button size="sm" hue="accent" onClick={() => launch(s)}>Open →</Button>}
              </div>
            );
          })}
        </Panel>
      </Section>
      <Note hue="accent" title="while the session runs">
        The mode is <strong style={{ color: tk.text }}>{mode.name}</strong>: {mode.detail} Every problem you open takes this mode, and every attempt records it.
      </Note>
    </>
  );
}

export default function Today({ role }) {
  const nav = useNav();
  const prog = useProgress();
  const now = useNow(60000);
  const [mode, setMode] = useState("drill");
  const [pick, setPick] = useState(null);

  const week = useMemo(() => weekNumber(prog.startDate, new Date(now)), [prog.startDate, now]);
  const phase = phaseForWeek(week);
  const thisWeek = useMemo(() => sessionsThisWeek(prog.sessions, new Date(now)), [prog.sessions, now]);
  const suggested = useMemo(() => suggestSession(thisWeek), [thisWeek]);
  const chosen = templateForRole(pick ? TEMPLATE_BY_ID[pick] : suggested, role?.id);
  const rs = useMemo(() => reviewStats(new Date(now)), [now]);
  const labsDone = LABS.labs.filter((l) => prog.labs[l.id]).length;
  const allIds = useMemo(() => TIERS.flatMap((t) => t.groups.flatMap((g) => g.ids)), []);
  const solved = allIds.filter((id) => isSolved(prog.dsa[id])).length;
  const totalProblems = allIds.length;
  const st = useMemo(() => streak(prog.sessions), [prog.sessions]);

  if (prog.session) return <div className="pane-pad"><RunningSession session={prog.session} nav={nav} prog={prog} role={role} /></div>;

  return (
    <div className="pane-pad">
      {/* ── hero ─────────────────────────────────────────────── */}
      <div className="anim-rise" style={{ marginBottom: "var(--sp-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ color: H(role.hue).fg, fontSize: "var(--fs-lg)" }}>{role.icon}</span>
          <Label hue={role.hue}>{role.name}</Label>
          <span style={{ color: tk.line2 }}>·</span>
          <Mono dim>{role.tag}</Mono>
        </div>
        <H1>
          {week == null ? "Set a start date to begin week 1"
            : week === 0 ? "Your plan starts soon"
            : <>Week {week} <span style={{ color: tk.faint, fontWeight: 400 }}>·</span> <span style={{ color: tk.accent }}>{phase.name}</span></>}
        </H1>
        <Muted style={{ marginTop: 8, maxWidth: "68ch" }}>{week == null ? "Three sessions a week. Everything on this site is ordered around them." : phase.goal}</Muted>
        {week == null && (
          <div style={{ marginTop: "var(--sp-4)", display: "flex", alignItems: "center", gap: 10 }}>
            <Label>Start date</Label>
            <input type="date" value={prog.startDate || ""} onChange={(e) => progressStore.setStartDate(e.target.value)}
              className="mono" style={{ padding: "6px 10px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`, background: tk.bg1, color: tk.text, fontSize: "var(--fs-sm)" }} />
          </div>
        )}
      </div>

      {/* ── the one thing to do ──────────────────────────────── */}
      <Section title="Next session" hue="accent" i={1} right={
        <div style={{ display: "flex", gap: 4 }}>
          {SESSION_TEMPLATES.map((t) => (
            <button key={t.id} className="press" onClick={() => setPick(t.id)} title={`${t.name} · ${t.minutes} min`}
              style={{ width: 30, height: 26, borderRadius: "var(--r-1)", fontSize: "var(--fs-xs)", fontWeight: 700,
                fontFamily: "monospace",
                color: chosen.id === t.id ? tk.accent : tk.faint,
                background: chosen.id === t.id ? tk.accentBg : tk.bg2,
                border: `1px solid ${chosen.id === t.id ? tk.accentLine : tk.line}` }}>{t.id}</button>
          ))}
        </div>
      }>
        <Panel hue="accent" style={{ padding: "var(--sp-5)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(900px 220px at 12% -30%, ${tk.accentBg}, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: tk.text, letterSpacing: "-0.02em" }}>
                {chosen.icon} Session {chosen.id} · {chosen.name}
              </span>
              <Tag hue="accent">{chosen.minutes} min</Tag>
              {chosen.id === suggested.id && <Tag hue="ok">suggested</Tag>}
            </div>
            <Muted style={{ marginBottom: "var(--sp-4)" }}>{chosen.purpose}</Muted>

            <div style={{ display: "grid", gap: 2, marginBottom: "var(--sp-5)" }}>
              {chosen.steps.map((s, i) => (
                <div key={i} className="anim-slide" style={{ "--i": i, display: "flex", alignItems: "baseline", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${tk.line}` : "none" }}>
                  <span className="mono" style={{ color: tk.faint, fontSize: "var(--fs-micro)", width: 16 }}>{i + 1}</span>
                  <span style={{ color: tk.faint }}>{STEP_ICON[s.kind]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 550 }}>{s.label}</span>
                    {/* The detail is where the role-specific instruction lives. */}
                    {s.detail && <span style={{ display: "block", color: tk.faint, fontSize: "var(--fs-sm)", lineHeight: 1.6, marginTop: 2 }}>{s.detail}</span>}
                  </span>
                  <Mono dim>{s.minutes}m</Mono>
                </div>
              ))}
            </div>

            <Label style={{ display: "block", marginBottom: "var(--sp-2)" }}>Mode · decides how much you may see</Label>
            <ModePicker value={mode} onChange={setMode} />

            <div style={{ marginTop: "var(--sp-5)" }}>
              <Button hue="accent" variant="solid" size="lg" full
                onClick={() => progressStore.startSession(chosen.id, chosen.mode === "mock" ? "mock" : mode)}>
                ▶ Start session {chosen.id}
              </Button>
            </div>
          </div>
        </Panel>
      </Section>

      {/* ── at a glance ──────────────────────────────────────── */}
      <Section title="Where you are" i={2} right={<button className="press" onClick={() => nav.go("progress")} style={{ fontSize: "var(--fs-xs)", color: tk.accent, fontWeight: 600 }}>full progress →</button>}>
        <div className="grid-auto">
          <Stat label="Streak" value={st} sub={st === 1 ? "day" : "days"} hue={st > 0 ? "ok" : "neutral"} i={0} />
          <Stat label="This week" value={thisWeek.length} sub="of 3 sessions" hue={thisWeek.length >= 3 ? "ok" : "accent"} i={1} onClick={() => nav.go("progress")} />
          <Stat label="Due to review" value={rs.due} sub={`${rs.total} cards`} hue={rs.due > 0 ? "warn" : "neutral"} i={2} onClick={() => nav.go("learn", { kind: "review" })} />
          <Stat label="Problems solved" value={solved} sub={`of ${totalProblems}`} hue="warn" i={3} onClick={() => nav.go("practice")} />
          <Stat label="Labs done" value={labsDone} sub={`of ${LABS.labs.length}`} hue="ok" i={4} onClick={() => nav.go("labs")} />
        </div>
      </Section>

      {/* ── the plan ─────────────────────────────────────────── */}
      <Section title="The plan" i={3}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          {PHASES.map((p, i) => {
            const cur = phase && phase.id === p.id;
            const past = week != null && week > p.weeks[1];
            return (
              <Panel key={p.id} i={i} hue={cur ? "accent" : "neutral"} active={cur} style={{ padding: "var(--sp-3) var(--sp-4)", opacity: past ? .55 : 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <Mono style={{ color: cur ? tk.accent : tk.faint, minWidth: 76 }}>WK {p.weeks[0]}–{p.weeks[1]}</Mono>
                  <span style={{ color: tk.text, fontWeight: 650, fontSize: "var(--fs-sm)" }}>{p.name}</span>
                  {cur && <Tag hue="accent">you are here</Tag>}
                  {past && <Tag hue="ok">done</Tag>}
                </div>
                <div style={{ color: tk.faint, fontSize: "var(--fs-xs)", marginTop: 4, lineHeight: 1.6 }}>{p.milestone}</div>
              </Panel>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
