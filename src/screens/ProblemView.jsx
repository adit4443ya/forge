"use client";
import { useEffect, useMemo, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Tag, Button, Panel, Code, ExtLink, Note, TimerChip, useTimer, mmss } from "@/ui/kit.jsx";
import { MODES, MODE_LIST, STAGES, TIER_BUDGET, gateSchedule } from "@/data/sessions.js";
import { leetcodeUrl, setsForSection, JUDGES } from "@/data/externalLinks.js";
import { PROMPTS } from "@/data/prompts.js";
import { progressStore, useProgress, lastAttempt, isSolved } from "@/lib/progress/store.js";
import { fromAttempt } from "@/lib/review.js";
import { tierOf } from "@/data/dsaCurriculum.js";

/* ══════════════════════════════════════════════════════════════════════════
   PROBLEM VIEW — the trainer's screen.

   You get the statement and a clock. Nothing else, until the mode says so.
   The pattern label is treated as a spoiler, because it is one: knowing a
   problem is "monotonic stack" is most of the work. It unlocks with the
   approach, not with the title.
   ══════════════════════════════════════════════════════════════════════════ */

const DIFF_HUE = { Easy: "ok", Medium: "warn", Hard: "bad" };

function Gate({ stage, unlocked, unlockAt, elapsed, onUnlock, allowEarly, children, i }) {
  const [justOpened, setJustOpened] = useState(false);
  const [open, setOpen] = useState(false);
  const [wasUnlocked, setWasUnlocked] = useState(unlocked);
  if (unlocked !== wasUnlocked) { setWasUnlocked(unlocked); if (unlocked) setJustOpened(true); }   // the sweep fires once, on the transition
  useEffect(() => {
    if (!justOpened) return undefined;
    const t = setTimeout(() => setJustOpened(false), 950);
    return () => clearTimeout(t);
  }, [justOpened]);

  const wait = unlockAt != null ? Math.max(0, unlockAt - elapsed) : 0;
  const locked = !unlocked;

  return (
    <div className={`anim-riseSm${justOpened ? " sweep" : ""}`} style={{ "--i": i,
      border: `1px solid ${open && !locked ? tk.accentLine : tk.line}`, borderRadius: "var(--r-2)", marginBottom: "var(--sp-2)",
      background: open && !locked ? tk.bg1 : "transparent", transition: "border-color var(--dur-2), background var(--dur-2)" }}>
      <button onClick={() => { if (!locked) setOpen((o) => !o); }} disabled={locked} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "11px 14px", textAlign: "left",
          cursor: locked ? "default" : "pointer" }}>
        <span className={locked ? "breathe" : ""} style={{ color: locked ? tk.faint : tk.accent, fontSize: "var(--fs-sm)",
          transform: open && !locked ? "rotate(90deg)" : "none", transition: "transform var(--dur-2) var(--ease-out)", display: "inline-block", width: 12 }}>
          {locked ? "🔒" : "▸"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", color: locked ? tk.faint : tk.text, fontSize: "var(--fs-sm)", fontWeight: 600 }}>{stage.label}</span>
          <span className="mono" style={{ display: "block", color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 1 }}>{stage.note}</span>
        </span>
        {locked && unlockAt != null && (
          <Mono dim style={{ flexShrink: 0 }}>{wait > 0 ? `unlocks in ${mmss(wait)}` : "unlocking…"}</Mono>
        )}
        {locked && unlockAt == null && <Mono dim style={{ flexShrink: 0 }}>after the timer</Mono>}
      </button>
      {locked && allowEarly && (
        <div style={{ padding: "0 14px 11px 40px" }}>
          <button className="press" onClick={onUnlock}
            style={{ fontSize: "var(--fs-micro)", fontFamily: "monospace", color: tk.faint, letterSpacing: ".06em", textDecoration: "underline", textUnderlineOffset: 3 }}>
            I&apos;M STUCK — UNLOCK NOW
          </button>
        </div>
      )}
      <div className={`reveal${open && !locked ? " open" : ""}`}>
        <div className="reveal-inner"><div style={{ padding: "0 14px 14px 40px" }}>{children}</div></div>
      </div>
    </div>
  );
}

export default function ProblemView({ problem: p, mode: modeProp, onMode }) {
  const prog = useProgress();
  const tier = tierOf(p.id);
  const budget = TIER_BUDGET[tier?.id ?? 1];
  const mode = MODES[modeProp] || MODES.drill;
  const timer = useTimer(budget);
  const [forced, setForced] = useState([]);          // stages unlocked early
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [logged, setLogged] = useState(false);

  /* A different problem (or a mode change) resets the attempt: adjust state
     during render rather than in an effect, so nothing renders stale first. */
  const [seen, setSeen] = useState(`${p.id}:${modeProp}`);
  if (seen !== `${p.id}:${modeProp}`) {
    setSeen(`${p.id}:${modeProp}`);
    setForced([]); setLogged(false); setMinutes(""); setNote("");
    timer.reset();
  }

  const schedule = useMemo(() => gateSchedule(mode.id, budget), [mode.id, budget]);
  const isUnlocked = (id) => {
    if (!schedule) return true;                                   // study: everything open
    if (forced.includes(id)) return true;
    if (mode.id === "mock") return timer.left === 0;
    return timer.elapsed >= (schedule[id] ?? 0);
  };
  const revealed = STAGES.filter((s) => isUnlocked(s.id)).map((s) => s.id);
  const hidePattern = mode.id !== "study" && !isUnlocked("approach");

  const entry = prog.dsa[p.id];
  const last = lastAttempt(entry);
  const solved = isSolved(entry);
  const sets = setsForSection(p.section);
  const lc = leetcodeUrl(p.leetcode, p.title);
  const prompt = PROMPTS[p.id];

  const log = (result) => {
    const mins = minutes ? Number(minutes) : Math.max(1, Math.round(timer.elapsed / 60));
    progressStore.logAttempt(p.id, { minutes: mins, result, note, mode: mode.id, revealed });
    fromAttempt(p.id, result, p.title);
    setLogged(true); timer.pause();
  };

  return (
    <div className="pane-pad pane-narrow" key={p.id}>
      {/* ── header ───────────────────────────────────────────── */}
      <div className="anim-rise" style={{ marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
          <Tag hue={DIFF_HUE[p.difficulty] || "neutral"}>{p.difficulty}</Tag>
          {tier && <Tag>tier {tier.id}</Tag>}
          {hidePattern ? <Tag title="Hidden: the pattern is a spoiler in this mode">pattern hidden</Tag>
                       : <Tag hue="info">{p.section}</Tag>}
          {solved && <Tag hue="ok">solved</Tag>}
          <div style={{ flex: 1 }} />
          <TimerChip timer={timer} />
        </div>

        <h1 style={{ margin: 0, fontSize: "var(--fs-2xl)", fontWeight: 700, letterSpacing: "-0.022em", color: tk.text, lineHeight: 1.2 }}>{p.title}</h1>

        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap", marginTop: "var(--sp-3)" }}>
          <Button size="sm" hue="accent" variant={timer.running ? "ghost" : "solid"} onClick={timer.toggle}>
            {timer.running ? "❚❚ pause" : timer.elapsed ? "▶ resume" : "▶ start"}
          </Button>
          <Button size="sm" onClick={timer.reset}>reset</Button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 3 }}>
            {MODE_LIST.map((m) => (
              <button key={m.id} className="press" onClick={() => onMode?.(m.id)} title={m.detail}
                style={{ padding: "4px 10px", borderRadius: "var(--r-1)", fontSize: "var(--fs-micro)", fontWeight: 700,
                  fontFamily: "monospace", letterSpacing: ".06em", textTransform: "uppercase",
                  color: m.id === mode.id ? tk.accent : tk.faint,
                  background: m.id === mode.id ? tk.accentBg : "transparent",
                  border: `1px solid ${m.id === mode.id ? tk.accentLine : tk.line}` }}>
                {m.icon} {m.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "var(--sp-2)" }}>
          <div style={{ height: 2, background: tk.bg3, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${timer.frac * 100}%`, height: "100%", background: timer.frac > .8 ? tk.warn : tk.accent, transition: "width 1s linear, background var(--dur-3)" }} />
          </div>
        </div>
      </div>

      {/* ── statement ────────────────────────────────────────── */}
      <div className="anim-rise" style={{ "--i": 1, marginBottom: "var(--sp-5)" }}>
        <Label style={{ display: "block", marginBottom: "var(--sp-2)" }}>The problem</Label>
        {prompt ? (
          <p style={{ margin: 0, color: tk.text, fontSize: "var(--fs-md)", lineHeight: 1.75 }}>{prompt}</p>
        ) : (
          <p style={{ margin: 0, color: tk.dim, fontSize: "var(--fs-md)", lineHeight: 1.75 }}>
            Read the full statement on the judge, then solve it here.
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginTop: "var(--sp-3)" }}>
          {lc && <ExtLink href={lc} hue="warn" note="the full statement, examples and constraints">LeetCode{p.leetcode ? ` ${p.leetcode}` : ""}</ExtLink>}
        </div>
      </div>

      {/* ── the ladder ───────────────────────────────────────── */}
      <div className="anim-rise" style={{ "--i": 2, marginBottom: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
          <Label>Work it out</Label>
          <Mono dim>{mode.icon} {mode.name} · {mode.blurb}</Mono>
        </div>

        {mode.id === "mock" && timer.left > 0 && (
          <Note hue="bad" title="mock conditions">
            Nothing unlocks until the clock runs out. That is the point: this is the only mode the readiness number on Progress trusts.
          </Note>
        )}

        <Gate i={0} stage={STAGES[0]} unlocked={isUnlocked("hint1")} unlockAt={schedule?.hint1} elapsed={timer.elapsed}
          allowEarly={mode.allowEarly} onUnlock={() => setForced((f) => [...f, "hint1"])}>
          <p style={{ margin: 0, color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.75 }}>
            {(p.intuition || "").split(/(?<=\.)\s/)[0]}
          </p>
        </Gate>

        <Gate i={1} stage={STAGES[1]} unlocked={isUnlocked("hint2")} unlockAt={schedule?.hint2} elapsed={timer.elapsed}
          allowEarly={mode.allowEarly} onUnlock={() => setForced((f) => [...f, "hint2"])}>
          <p style={{ margin: 0, color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.75 }}>{p.keyInsight}</p>
        </Gate>

        <Gate i={2} stage={STAGES[2]} unlocked={isUnlocked("approach")} unlockAt={schedule?.approach} elapsed={timer.elapsed}
          allowEarly={mode.allowEarly} onUnlock={() => setForced((f) => [...f, "approach"])}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
            <Tag hue="info">{p.section}</Tag>
            <Tag hue="accent">{p.pattern}</Tag>
          </div>
          <p style={{ margin: "0 0 var(--sp-3)", color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.75 }}>{p.intuition}</p>
          <p style={{ margin: 0, color: tk.text, fontSize: "var(--fs-sm)", lineHeight: 1.75 }}>{p.approach}</p>
          <Mono style={{ display: "block", marginTop: "var(--sp-3)", color: tk.accent }}>{p.complexity}</Mono>
        </Gate>

        <Gate i={3} stage={STAGES[3]} unlocked={isUnlocked("solution")} unlockAt={schedule?.solution} elapsed={timer.elapsed}
          allowEarly={mode.allowEarly} onUnlock={() => setForced((f) => [...f, "solution"])}>
          {p.memoCode && <Code label="// top-down · memoization" hue="info">{p.memoCode}</Code>}
          <Code label={p.memoCode ? "// bottom-up · tabulation" : "// C++ solution"} hue="accent">{p.tabCode}</Code>
        </Gate>
      </div>

      {/* ── go wider ─────────────────────────────────────────── */}
      {sets.length > 0 && (
        <div className="anim-rise" style={{ "--i": 3, marginBottom: "var(--sp-5)" }}>
          <Label style={{ display: "block", marginBottom: "var(--sp-2)" }}>Drill this pattern elsewhere</Label>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            {sets.map((s, i) => {
              const j = JUDGES[s.judge] || {};
              return (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="lift"
                  style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "10px 13px", textDecoration: "none",
                    border: `1px solid ${tk.line}`, borderRadius: "var(--r-2)", background: tk.bg1 }}>
                  <Tag hue={j.color || "neutral"}>{j.name || s.judge}</Tag>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 550 }}>{s.label}</span>
                    {s.note && <span className="mono" style={{ display: "block", color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 1 }}>{s.note}</span>}
                  </span>
                  <span style={{ color: tk.faint, fontSize: "var(--fs-sm)" }}>↗</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── log the attempt ──────────────────────────────────── */}
      <div className="anim-rise" style={{ "--i": 4 }}>
        <Panel hue={logged ? "ok" : "neutral"} style={{ padding: "var(--sp-4)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--sp-3)", flexWrap: "wrap", gap: 8 }}>
            <Label hue={logged ? "ok" : "neutral"}>{logged ? "logged · scheduled for review" : "How did it go?"}</Label>
            {last && <Mono dim>last: {last.date} · {last.result}{last.mode ? ` · ${last.mode}` : ""}{last.minutes ? ` · ${last.minutes}m` : ""}</Mono>}
          </div>
          {!logged ? (
            <>
              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center" }}>
                <Button hue="ok" onClick={() => log("solved")}>Solved</Button>
                <Button hue="warn" onClick={() => log("hint")}>Needed a hint</Button>
                <Button hue="bad" onClick={() => log("failed")}>Did not get it</Button>
                <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={String(Math.max(1, Math.round(timer.elapsed / 60)))} inputMode="numeric" className="mono"
                  style={{ width: 62, padding: "7px 9px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`, background: tk.bg, color: tk.text, fontSize: "var(--fs-sm)" }} />
                <Mono dim>min</Mono>
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line: what went wrong, or the insight you missed."
                style={{ width: "100%", marginTop: "var(--sp-3)", padding: "9px 11px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`, background: tk.bg, color: tk.text, fontSize: "var(--fs-sm)" }} />
              <Mono dim style={{ display: "block", marginTop: "var(--sp-2)" }}>
                recorded with mode <span style={{ color: tk.accent }}>{mode.name}</span>
                {revealed.length > 0 && <> and {revealed.length} of 4 stages revealed</>}
              </Mono>
            </>
          ) : (
            <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: tk.ok, fontSize: "var(--fs-sm)" }}>✓ Attempt saved. The scheduler will bring it back.</span>
              <Button size="sm" onClick={() => { setLogged(false); timer.reset(); setForced([]); }}>log another attempt</Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
