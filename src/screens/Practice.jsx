"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RapidFire from "./RapidFire.jsx";
import Estimation from "./Estimation.jsx";
import MentalMath from "./MentalMath.jsx";
import MarketMaking from "./MarketMaking.jsx";
import Patterns from "./Patterns.jsx";
import { PATTERNS_2 } from "@/data/patterns.js";
import { roleSections, sortForRole } from "@/data/roleScope.js";
import { RAPID } from "@/data/rapidfire.js";
import { ESTIMATES } from "@/data/estimation.js";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Tabs, Accordion, Code, Note, Empty, ExtLink } from "@/ui/kit.jsx";
import { useNav } from "@/shell/nav.js";
import { useTargetChange } from "@/ui/hooks.js";
import { useProgress, isSolved, attemptCount, lastAttempt } from "@/lib/progress/store.js";
import { ALL_PROBLEMS as PROBLEMS, CPP_CONCEPTS, CHEATSHEET, TIPS, BUG_HUNTS, OUTPUT_QUIZZES } from "@/dsaData.jsx";
import { CPP_CONCEPTS_2 } from "@/data/cppConcepts.js";
import { OUTPUT_QUIZZES_2, BUG_HUNTS_2 } from "@/data/drills.js";
import { content as LEGACY, NavCtx as LegacyNavCtx } from "@/legacyLibrary.jsx";
import { tierOf, GAPS } from "@/data/dsaCurriculum.js";
import { LADDERS, JUDGES } from "@/data/externalLinks.js";
import ProblemView from "./ProblemView.jsx";

/* ══════════════════════════════════════════════════════════════════════════
   PRACTICE — one bank for everything you do rather than read.
   Problems live in a two-pane workbench; drills and concepts are lists.
   ══════════════════════════════════════════════════════════════════════════ */

const DIFF_HUE = { Easy: "ok", Medium: "warn", Hard: "bad" };
const STATUS = [
  { id: "all", label: "All" },
  { id: "todo", label: "Not started" },
  { id: "wip", label: "Attempted" },
  { id: "done", label: "Solved" },
];

/* The section name is the same spoiler the detail page hides, so the list only
   shows it once you have solved the problem (or you asked to see it). */
function ProblemRow({ p, active, onClick, prog, i, reveal, forRole }) {
  const entry = prog.dsa[p.id];
  const solved = isSolved(entry);
  const tried = attemptCount(entry) > 0;
  const last = lastAttempt(entry);
  const tier = tierOf(p.id);
  const sub = (reveal || solved) ? p.section : `tier ${tier?.id ?? "?"} · ${tried ? `${attemptCount(entry)} attempt${attemptCount(entry) > 1 ? "s" : ""}` : "not started"}`;
  return (
    <button onClick={onClick} data-active={active} className="anim-slide"
      style={{ "--i": Math.min(i, 12), display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "9px 13px",
        borderLeft: `2px solid ${active ? tk.accent : "transparent"}`,
        background: active ? tk.bg2 : "transparent",
        borderBottom: `1px solid ${tk.line}`,
        transition: "background var(--dur-1) var(--ease-out)" }}
      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = tk.bg1; }}
      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ width: 14, flexShrink: 0, marginTop: 2, color: solved ? tk.ok : tried ? tk.warn : tk.line2, fontSize: 12 }}>
        {solved ? "●" : tried ? "◐" : "○"}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="truncate" style={{ display: "block", color: active ? tk.text : tk.dim, fontSize: "var(--fs-sm)", fontWeight: active ? 600 : 450 }}>{p.title}</span>
        <span className="mono truncate" style={{ display: "block", color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 1 }}>
          {sub}{last?.mode === "mock" && solved ? " · mock ✓" : ""}
        </span>
      </span>
      {forRole && <span className="role-dot" title="a section your role names" />}
      <span className="mono" style={{ flexShrink: 0, fontSize: "var(--fs-micro)", color: H(DIFF_HUE[p.difficulty] || "neutral").fg, marginTop: 2 }}>
        {p.difficulty?.[0]}
      </span>
    </button>
  );
}

function ProblemsTab({ target, role }) {
  const router = useRouter();
  const prog = useProgress();
  const [q, setQ] = useState(() => (target?.kind === "section" ? target.id : ""));
  const [tierF, setTierF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [roleF, setRoleF] = useState(false);   // highlight, never hides by default
  const [mode, setMode] = useState(prog.session?.mode || "drill");
  const [reveal, setReveal] = useState(false);
  const [sel, setSel] = useState(() => target?.kind === "problem" ? target.id : PROBLEMS[0]?.id);
  const [showList, setShowList] = useState(true);

  useTargetChange(target, (t) => { if (t.kind === "problem" && t.id) { setSel(t.id); setShowList(false); } });
  const [seenMode, setSeenMode] = useState(prog.session?.mode || null);
  /* A ?section= deep link filters the list to that section. */
  const [seenSection, setSeenSection] = useState(target?.kind === "section" ? target.n : null);
  if (target?.kind === "section" && target.n !== seenSection) { setSeenSection(target.n); setQ(target.id); }
  if (prog.session?.mode && prog.session.mode !== seenMode) { setSeenMode(prog.session.mode); setMode(prog.session.mode); }

  const secs = useMemo(() => roleSections(role), [role]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = PROBLEMS.filter((p) => {
      if (roleF && !secs.has(p.section)) return false;
      const t = tierOf(p.id);
      if (tierF !== "all" && String(t?.id) !== tierF) return false;
      const e = prog.dsa[p.id];
      const solved = isSolved(e), tried = attemptCount(e) > 0;
      if (statusF === "todo" && tried) return false;
      if (statusF === "wip" && (!tried || solved)) return false;
      if (statusF === "done" && !solved) return false;
      if (!needle) return true;
      return p.title.toLowerCase().includes(needle) || p.section.toLowerCase().includes(needle) || (p.pattern || "").toLowerCase().includes(needle);
    });
    /* Role sorts, it does not hide: the whole coding bar still matters. */
    return roleF ? filtered : sortForRole(filtered, role);
  }, [q, tierF, statusF, roleF, secs, role, prog.dsa]);

  /* Selection is not navigation — on a wide screen both panes are visible — so
     it REPLACES rather than pushing. The URL stays shareable and reload-safe
     without putting every browsed problem into the history. */
  const selectProblem = useCallback((id) => {
    setSel(id);
    router.replace(`/practice?problem=${id}`, { scroll: false });
  }, [router]);

  const problem = PROBLEMS.find((p) => p.id === sel) || list[0] || PROBLEMS[0];
  const solvedCount = PROBLEMS.filter((p) => isSolved(prog.dsa[p.id])).length;

  return (
    <div className={`workbench${showList ? " show-list" : ""}`}>
      <aside className="wb-list">
        <div style={{ position: "sticky", top: 0, background: tk.bg1, borderBottom: `1px solid ${tk.line}`, padding: "var(--sp-3)", zIndex: 2 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter problems…"
            style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`, background: tk.bg, color: tk.text, fontSize: "var(--fs-sm)" }} />
          <div style={{ display: "flex", gap: 3, marginTop: "var(--sp-2)", flexWrap: "wrap" }}>
            {["all", "0", "1", "2", "3"].map((t) => (
              <button key={t} className="press" onClick={() => setTierF(t)}
                style={{ padding: "3px 8px", borderRadius: "var(--r-1)", fontSize: "var(--fs-micro)", fontFamily: "monospace", fontWeight: 700,
                  color: tierF === t ? tk.accent : tk.faint, background: tierF === t ? tk.accentBg : "transparent",
                  border: `1px solid ${tierF === t ? tk.accentLine : tk.line}` }}>
                {t === "all" ? "ALL" : `T${t}`}
              </button>
            ))}
            <div style={{ width: 1, background: tk.line, margin: "0 3px" }} />
            {STATUS.map((s) => (
              <button key={s.id} className="press" onClick={() => setStatusF(s.id)}
                style={{ padding: "3px 8px", borderRadius: "var(--r-1)", fontSize: "var(--fs-micro)", fontFamily: "monospace", fontWeight: 700,
                  color: statusF === s.id ? tk.text : tk.faint, background: statusF === s.id ? tk.bg3 : "transparent",
                  border: `1px solid ${statusF === s.id ? tk.line2 : tk.line}` }}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: "var(--sp-2)", gap: 6, flexWrap: "wrap" }}>
            <button className="press role-chip" data-on={roleF ? "1" : undefined} onClick={() => setRoleF((v) => !v)}
              title={roleF ? `Showing only sections ${role.name} names` : `Sorted so ${role.name}'s sections come first — click to show only those`}>
              {roleF ? `✓ ${role.name} only` : `${role.name} first`}
            </button>
          </div>
          <div className="row" style={{ marginTop: "var(--sp-2)", justifyContent: "space-between" }}>
            <Mono dim>{list.length} shown · {solvedCount}/{PROBLEMS.length} solved</Mono>
            <button className="press" onClick={() => setReveal((v) => !v)} title="Patterns are hidden so the list does not spoil the problem"
              style={{ fontSize: "var(--fs-micro)", fontFamily: "monospace", letterSpacing: ".06em", color: reveal ? tk.accent : tk.faint }}>
              {reveal ? "PATTERNS SHOWN" : "PATTERNS HIDDEN"}
            </button>
          </div>
        </div>
        {list.map((p, i) => (
          <ProblemRow key={p.id} p={p} i={i} prog={prog} reveal={reveal} active={p.id === problem?.id}
            forRole={secs.has(p.section)} onClick={() => { selectProblem(p.id); setShowList(false); }} />
        ))}
        {list.length === 0 && <Empty icon="⌕" title="Nothing matches">Loosen a filter, or clear the search.</Empty>}
      </aside>

      <div className="wb-detail">
        <button className="press wb-back" onClick={() => setShowList(true)}
          style={{ padding: "var(--sp-3) var(--sp-5) 0", color: tk.accent, fontSize: "var(--fs-sm)", fontWeight: 600 }}>← all problems</button>
        {problem ? <ProblemView problem={problem} mode={mode} onMode={setMode} /> : <Empty icon="◌" title="No problem selected" />}
      </div>
    </div>
  );
}

/* A drill hides its answer until you commit to one. */
function StagedDrill({ title, meta, hue, stages, i }) {
  const [open, setOpen] = useState(0);
  return (
    <Panel i={i} hue={open > 0 ? hue : "neutral"} style={{ padding: "var(--sp-4)", marginBottom: "var(--sp-3)" }}>
      <div className="row" style={{ gap: 9, marginBottom: "var(--sp-3)" }}>
        <span style={{ color: tk.text, fontWeight: 650, fontSize: "var(--fs-md)", flex: 1, minWidth: 0 }}>{title}</span>
        {meta?.map((m) => <Tag key={m} hue={hue}>{m}</Tag>)}
      </div>
      {stages.map((st, k) => {
        if (k > open) return null;
        return (
          <div key={st.label} className={k === open && k > 0 ? "anim-riseSm sweep" : "anim-riseSm"} style={{ marginBottom: "var(--sp-3)" }}>
            {k > 0 && <Label hue={hue} style={{ display: "block", marginBottom: 6 }}>{st.label}</Label>}
            {st.code
              ? <Code label={st.codeLabel} hue={k === 0 ? "neutral" : hue}>{st.code}</Code>
              : <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{st.body}</div>}
          </div>
        );
      })}
      {open < stages.length - 1 && (
        <Button size="sm" hue={hue} onClick={() => setOpen(open + 1)}>{stages[open + 1].cta || `Reveal ${stages[open + 1].label.toLowerCase()}`}</Button>
      )}
    </Panel>
  );
}

function DrillsTab() {
  const [tab, setTab] = useState("bugs");
  return (
    <div className="pane-pad pane-narrow">
      <H1>Drills</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)", maxWidth: "70ch" }}>
        A bug hunt is a code-reading round in miniature: find the defect before you scroll. An output quiz is the C++ semantics
        question every systems interviewer eventually asks. Commit to an answer out loud, then reveal.
      </Muted>
      <Tabs value={tab} onChange={setTab} style={{ marginBottom: "var(--sp-5)" }}
        items={[{ id: "bugs", label: "Bug hunts", count: BUG_HUNTS.length + BUG_HUNTS_2.length }, { id: "quiz", label: "Output quizzes", count: OUTPUT_QUIZZES.length + OUTPUT_QUIZZES_2.length }]} />

      {tab === "bugs" && [...BUG_HUNTS, ...BUG_HUNTS_2].map((b, i) => (
        <StagedDrill key={b.id} i={i} hue="bad" title={b.title} meta={[b.category].filter(Boolean)}
          stages={[
            { label: "Code", code: b.buggyCode, codeLabel: "// what is wrong here?" },
            { label: "The bugs", body: b.bugs, cta: "I have my answer — show the bugs" },
            { label: "Fixed", code: b.fixedCode, codeLabel: "// corrected" },
            { label: "What to say in the room", body: b.whatToSay },
          ].filter((x) => x.code || x.body)} />
      ))}

      {tab === "quiz" && [...OUTPUT_QUIZZES, ...OUTPUT_QUIZZES_2].map((q, i) => (
        <StagedDrill key={q.id} i={i} hue="warn" title={q.title} meta={[q.category].filter(Boolean)}
          stages={[
            { label: "Code", code: q.code, codeLabel: "// what does this print?" },
            { label: "Answer", body: q.correctAnswer, cta: "I have my answer — check it" },
            { label: "Why", body: q.explanation },
            { label: "The rule to remember", body: q.keyInsight },
          ].filter((x) => x.code || x.body)} />
      ))}
    </div>
  );
}

function ConceptsTab() {
  return (
    <div className="pane-pad pane-narrow">
      <H1>C++ concepts</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)", maxWidth: "72ch" }}>
        {CPP_CONCEPTS.length + CPP_CONCEPTS_2.length} things an interviewer keeps pulling on until you either show depth or run out.
        The first {CPP_CONCEPTS.length} are the ground every list covers; the rest are what a low-latency or systems panel reaches
        for once you have answered those. Each has the mechanism, the code, and the follow-ups they will actually ask.
      </Muted>
      {[...CPP_CONCEPTS, ...CPP_CONCEPTS_2].map((c, i) => (
        <Accordion key={c.id} i={i} hue="info" q={c.title} right={c.category ? <Tag hue="info">{c.category}</Tag> : null}>
          <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{c.explanation}</div>
          {c.keyInsight && <Note hue="accent" title="the thing to remember">{c.keyInsight}</Note>}
          {c.codeExample && <Code label="// C++" hue="info">{c.codeExample}</Code>}
          {Array.isArray(c.qa) && c.qa.length > 0 && (
            <div style={{ marginTop: "var(--sp-3)" }}>
              <Label style={{ display: "block", marginBottom: 6 }}>They will follow up with</Label>
              {c.qa.map((x, k) => (
                <Accordion key={k} i={k} q={x.q || x.question}>
                  <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{x.a || x.answer}</div>
                </Accordion>
              ))}
            </div>
          )}
        </Accordion>
      ))}

      <Note hue="info" title="patterns moved">
        The pattern templates now have their own tab, next to the problems that use each one — with how to recognise it and the
        plausible wrong idea it replaces.
      </Note>
    </div>
  );
}

function MocksTab() {
  const nav = useNav();
  const legacyNav = useMemo(() => ({
    goToGuide: (num, anchor) => nav.openGuide(num, anchor),
    goToModule: () => nav.go("learn"),
    goToDsa: (tab, id) => (id != null ? nav.openProblem(id) : nav.go("practice")),
    setMode: () => {},
  }), [nav]);
  const Body = LEGACY.mocks;
  return (
    <div className="pane-pad pane-narrow">
      <LegacyNavCtx.Provider value={legacyNav}>{Body ? <Body /> : <Empty icon="◉" title="Mocks unavailable" />}</LegacyNavCtx.Provider>
    </div>
  );
}

function LaddersTab() {
  return (
    <div className="pane-pad pane-narrow">
      <H1>When this bank runs out</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)" }}>
        The {PROBLEMS.length} curated problems teach the patterns. They do not build volume, and they cannot simulate a clock you did not set
        yourself. These five sets do, and they are the ones candidates for these roles actually train on. Go wide here after you
        have gone deep above.
      </Muted>
      <div style={{ display: "grid", gap: "var(--sp-3)" }}>
        {LADDERS.map((l, i) => {
          const j = JUDGES[l.id] || {};
          return (
            <Panel key={l.id} i={i} hue={j.color || "neutral"} style={{ padding: "var(--sp-4)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ color: tk.text, fontSize: "var(--fs-lg)", fontWeight: 650 }}>{l.name}</span>
                <Tag hue={j.color || "neutral"}>{l.count} problems</Tag>
                <Tag>{l.who}</Tag>
                <div style={{ flex: 1 }} />
                <ExtLink href={l.url} hue={j.color || "neutral"}>open</ExtLink>
              </div>
              <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.75 }}>{l.why}</div>
            </Panel>
          );
        })}
      </div>
      <Section title="Problems still to write here" i={1} style={{ marginTop: "var(--sp-7)" }}>
        <Muted style={{ marginBottom: "var(--sp-3)" }}>Known gaps in this bank. Until they exist, the ladders above cover them.</Muted>
        <div style={{ display: "grid", gap: 6 }}>
          {GAPS.map((g, i) => (
            <div key={i} className="anim-slide" style={{ "--i": i, display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: i ? `1px solid ${tk.line}` : "none" }}>
              <span style={{ color: tk.line2 }}>○</span>
              <span style={{ color: tk.dim, fontSize: "var(--fs-sm)" }}>{g}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* The valid tabs, so a stale ?tab= cannot render an empty page. */
const TAB_IDS = ["problems", "rapid", "estimate", "mental", "market", "drills", "patterns", "concepts", "mocks", "ladders"];

export default function Practice({ target, role }) {
  const router = useRouter();
  const [tab, setTab] = useState(() => (target?.kind === "tab" && TAB_IDS.includes(target.id) ? target.id : "problems"));
  useTargetChange(target, (t) => {
    /* A stale bookmark or a typo must not render an empty page. */
    if (t.kind === "tab") setTab(TAB_IDS.includes(t.id) ? t.id : "problems");
    if (t.kind === "problem") setTab("problems");
    if (t.kind === "section") setTab("problems");   // ProblemsTab filters on it
  });

  /* Switching tab is navigation, so it belongs in the URL: the tab survives a
     reload, can be linked to, and Back returns to the previous tab instead of
     leaving the site. Setting the same value again is a no-op, so the round
     trip through useTargetChange cannot loop. */
  const goTab = useCallback((id) => {
    setTab(id);
    router.push(id === "problems" ? "/practice" : `/practice?tab=${id}`, { scroll: false });
  }, [router]);

  const tabs = [
    { id: "problems", label: "Problems", count: PROBLEMS.length },
    { id: "rapid", label: "Rapid fire", count: RAPID.length },
    { id: "estimate", label: "Estimation", count: ESTIMATES.length },
    { id: "mental", label: "Mental math" },
    { id: "market", label: "Make a market" },
    { id: "drills", label: "Drills", count: BUG_HUNTS.length + BUG_HUNTS_2.length + OUTPUT_QUIZZES.length + OUTPUT_QUIZZES_2.length },
    { id: "patterns", label: "Patterns", count: CHEATSHEET.length + PATTERNS_2.length },
    { id: "concepts", label: "C++ concepts", count: CPP_CONCEPTS.length + CPP_CONCEPTS_2.length },
    { id: "mocks", label: "Mocks", count: 5 },
    { id: "ladders", label: "Ladders", count: LADDERS.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "0 var(--sp-5)", background: tk.bg, borderBottom: `1px solid ${tk.line}` }}>
        <Tabs items={tabs} value={tab} onChange={goTab} style={{ border: "none" }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: ["problems", "rapid", "estimate", "mental"].includes(tab) ? "hidden" : "auto" }}>
        {tab === "problems" && <ProblemsTab target={target} role={role} />}
        {tab === "rapid" && <RapidFire role={role} />}
        {tab === "estimate" && <Estimation role={role} />}
        {tab === "mental" && <MentalMath />}
        {tab === "market" && <MarketMaking />}
        {tab === "drills" && <DrillsTab />}
        {tab === "patterns" && <Patterns />}
        {tab === "concepts" && <ConceptsTab />}
        {tab === "mocks" && <MocksTab />}
        {tab === "ladders" && <LaddersTab />}
      </div>
    </div>
  );
}
