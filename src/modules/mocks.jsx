"use client";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { NavCtx, S, B, P, Chip, Card, G } from "@/legacyLibrary.jsx";
import { tk, alpha } from "@/theme.jsx";
import { useProgress, progressStore, today } from "@/lib/progress/store.js";
import { PREP_INDEX, PREP_MODULE_LABELS } from "@/data/generated/prepIndex.js";
import { PROBLEMS } from "@/dsaData.jsx";
import { TIERS } from "@/data/dsaCurriculum.js";

/* ══════════════════════════════════════════════════════════════════════════
   MOCK INTERVIEWS — timed, randomized, self-scored, logged.
   Formats mirror the two target loops. Nothing here is an AI; the point is
   that you perform under a clock and score yourself against a fixed rubric.
   ══════════════════════════════════════════════════════════════════════════ */
const pick = (arr, n, rng) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const mulberry32 = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const tierIds = (t) => TIERS[t].groups.flatMap((g) => g.ids);
const byId = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));

const DESIGN_PROMPTS = [
  "Design a limit order book for one instrument at 10M messages/s: add, modify, cancel, best bid/ask, top-N levels. Single machine.",
  "Design a market-data feed handler for two redundant UDP multicast feeds with gap recovery and per-instrument fan-out to strategies.",
  "Design asynchronous logging for a hot path with a 50 ns budget per call, 1M lines/s, durable within a second.",
  "Design an in-memory cache with TTL and LRU eviction serving 1M ops/s from many threads; then shard it across 20 machines.",
  "Design a tick time-series store: billions of rows per day, append-only intraday, queries by symbol and time range.",
  "Design a timer wheel for millions of timers at 1 µs resolution, and a per-client token-bucket rate limiter on top of it.",
  "Design a distributed build cache for 7,500-TU C++ builds across thousands of developers (content-addressed, remote execution next).",
  "Design a URL shortener at 100k redirects/s with a 5 ms p99; then explain what changes for 10x.",
  "Design a news feed service: fan-out on write vs read, ranking, caching, and the tail-latency story.",
  "Design a metrics pipeline ingesting 10M samples/s from 50k hosts with 1 s query freshness.",
];
const PERF_SCENARIOS = [
  "A trading pipeline's p50 is fine but p99 is 100x. Walk through what you collect, in order, and what each mechanism would look like.",
  "A loop was vectorized (remarks confirm) and is not faster. Explain the three most likely reasons and the command that distinguishes them.",
  "A library call is 30% of the profile. How do you decide between call it less, call a different entry point, or accept it?",
  "The AArch64 port is 40% slower than x86 on the same workload. What do you measure first, and which four mechanisms do you check?",
  "A service's memory grows 2 GB/day and latency degrades with it. Tools, hypotheses, and the fix families.",
  "A C++ build takes 40 minutes; you have one day. What do you measure, and what are the three levers with the best expected value?",
];
const BEHAVIORAL = [
  "Tell me about a bug you found in someone else's code that nobody else could find. How did you know you were right?",
  "Describe an optimization you shipped that you later found had a flaw in its measurement.",
  "A reviewer disagrees with your approach in a public code review. Walk through what you did.",
  "Tell me about a time you had to learn a large unfamiliar codebase quickly. What was your method?",
  "Describe a technical decision where you were wrong. What changed your mind?",
  "You have two weeks and three important tasks. How did you decide, and what did you tell the people waiting?",
];
const FUND_MODULES = ["cpp_obj", "cpp_tpl", "cpp_mem", "cpp_con", "cpp_misc", "arch", "link", "test", "hft"];

const FORMATS = [
  { id: "google", name: "Generalist coding", minutes: 45, color: tk.accent, blurb: "Two problems, one from tier 1 and one from tier 2. Talk while you code. No AI, no docs." },
  { id: "hft", name: "HFT fundamentals grill", minutes: 30, color: tk.orange, blurb: "Ten rapid questions on C++, memory, concurrency, Linux and hardware. Answer each in under three minutes, out loud." },
  { id: "design", name: "System design", minutes: 40, color: tk.rose, blurb: "One prompt. Numbers first, then the data path, then the hot path, then failures, then what you would measure." },
  { id: "perf", name: "Performance investigation", minutes: 30, color: tk.emerald, blurb: "One scenario. Narrate the evidence you would collect and the decision tree (Guide 20)." },
  { id: "behavioral", name: "Behavioral", minutes: 15, color: tk.violet, blurb: "Four prompts, two minutes each, in a structure: situation, action, result, what you learned." },
];

function useTimer(totalMin) {
  const [left, setLeft] = useState(totalMin * 60);
  const [running, setRunning] = useState(false);
  const [prevTotal, setPrevTotal] = useState(totalMin);
  if (prevTotal !== totalMin) {               // format changed: reset during render (React's derived-state pattern)
    setPrevTotal(totalMin); setLeft(totalMin * 60); setRunning(false);
  }
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    ref.current = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  return { left, running, start: () => setRunning(true), pause: () => setRunning(false), reset: () => { setRunning(false); setLeft(totalMin * 60); } };
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function MocksModule() {
  const prog = useProgress();
  const nav = useContext(NavCtx) || {};
  const [fmt, setFmt] = useState(FORMATS[0]);
  const [seed, setSeed] = useState(() => Date.now() & 0xffff);
  const [scores, setScores] = useState({ correctness: 3, communication: 3, speed: 3 });
  const [note, setNote] = useState("");
  const timer = useTimer(fmt.minutes);
  const rng = useMemo(() => mulberry32(seed), [seed]);

  const content = useMemo(() => {
    const r = mulberry32(seed + 7);
    if (fmt.id === "google") { const a = pick(tierIds(1), 1, r)[0], b = pick(tierIds(2), 1, r)[0]; return { problems: [a, b].map((id) => byId[id]).filter(Boolean) }; }
    if (fmt.id === "hft") { const qs = PREP_INDEX.filter((q) => FUND_MODULES.includes(q.module)); return { questions: pick(qs, 10, r) }; }
    if (fmt.id === "design") return { prompt: pick(DESIGN_PROMPTS, 1, r)[0] };
    if (fmt.id === "perf") return { prompt: pick(PERF_SCENARIOS, 1, r)[0] };
    return { prompts: pick(BEHAVIORAL, 4, r) };
  }, [fmt, seed]);
  void rng;

  const finish = () => {
    const spent = Math.round((fmt.minutes * 60 - timer.left) / 60);
    progressStore.logSession("mock", spent || fmt.minutes);
    const key = `mock:${today()}:${Date.now() % 100000}`;
    progressStore.setNote(key, JSON.stringify({ format: fmt.id, minutes: spent || fmt.minutes, scores, note, seed }));
    timer.reset(); setNote("");
  };
  const history = Object.entries(prog.notes || {}).filter(([k]) => k.startsWith("mock:")).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10)
    .map(([k, v]) => { try { return { key: k, ...JSON.parse(v) }; } catch { return { key: k }; } });

  const slider = (name) => (
    <label key={name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-sm)", color: tk.text }}>
      <span style={{ minWidth: 110, fontFamily: tk.mono, fontSize: "var(--fs-caption)", color: tk.textDim, letterSpacing: ".1em" }}>{name.toUpperCase()}</span>
      <input type="range" min="1" max="5" value={scores[name]} onChange={(e) => setScores({ ...scores, [name]: Number(e.target.value) })} />
      <span style={{ fontFamily: tk.mono, color: tk.textBright, fontWeight: 700 }}>{scores[name]}/5</span>
    </label>
  );

  return (
    <div>
      <S title="Mock interviews">
        <B type="interview">Alternate formats week to week. A mock counts only if it ran on the clock, out loud, without help. Score honestly: a 3 is "an interviewer would have doubts". The log feeds the dashboard's mock count.</B>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {FORMATS.map((f) => (
            <div key={f.id} onClick={() => { setFmt(f); setSeed(Date.now() & 0xffff); }}
              style={{ cursor: "pointer", background: fmt.id === f.id ? alpha(f.color, "12") : tk.bg2, border: `1px solid ${fmt.id === f.id ? f.color : tk.border}`, borderLeft: `3px solid ${f.color}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ color: tk.textBright, fontWeight: 700 }}>{f.name} <span style={{ fontFamily: tk.mono, fontSize: "var(--fs-caption)", color: f.color }}>{f.minutes} min</span></div>
              <div style={{ color: tk.textDim, fontSize: "var(--fs-sm)", marginTop: 4, lineHeight: 1.5 }}>{f.blurb}</div>
            </div>
          ))}
        </div>
      </S>

      <S title={`${fmt.name} · ${mmss(timer.left)}`} c={fmt.color}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {!timer.running ? <Chip color={tk.green} onClick={timer.start}>▶ start</Chip> : <Chip color={tk.amber} onClick={timer.pause}>❚❚ pause</Chip>}
          <Chip color={tk.slate} onClick={timer.reset}>reset</Chip>
          <Chip color={tk.slate} onClick={() => setSeed(Date.now() & 0xffff)}>new draw</Chip>
          {timer.left === 0 && <span style={{ fontFamily: tk.mono, color: tk.red, fontWeight: 800, alignSelf: "center" }}>TIME</span>}
        </div>

        {fmt.id === "google" && (
          <div style={{ display: "grid", gap: 10 }}>
            {content.problems.map((p, i) => (
              <Card key={p.id} title={`Problem ${i + 1} · ${i === 0 ? "tier 1 (target 20 min)" : "tier 2 (target 25 min)"}`} color={i === 0 ? tk.green : tk.amber}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ color: tk.textBright, fontWeight: 700 }}>{p.title}</span>
                  <span style={{ fontFamily: tk.mono, fontSize: "var(--fs-caption)", color: tk.textDim }}>{p.section} · {p.difficulty}</span>
                  <Chip color={tk.violet} onClick={() => nav.goToDsa && nav.goToDsa("problems", p.id)}>open after the mock</Chip>
                </div>
                <P>Say the brute force, the invariant, the complexity; write the code; walk one example through it; name two edge cases. Do not open the solution until the timer stops.</P>
              </Card>
            ))}
          </div>
        )}
        {fmt.id === "hft" && (
          <ol style={{ margin: 0, paddingLeft: 20, color: tk.text, lineHeight: 1.8 }}>
            {content.questions.map((q, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {q.question} <span style={{ fontFamily: tk.mono, fontSize: "var(--fs-caption)", color: tk.textDim }}>({PREP_MODULE_LABELS[q.module] || q.module})</span>
                <button onClick={() => nav.goToModule && nav.goToModule(q.module)} style={{ marginLeft: 8, cursor: "pointer", font: "inherit", fontSize: "var(--fs-caption)", color: tk.accent, background: "transparent", border: "none", textDecoration: "underline" }}>check after</button>
              </li>
            ))}
          </ol>
        )}
        {(fmt.id === "design" || fmt.id === "perf") && (
          <Card title="Prompt" color={fmt.color}>
            <div style={{ color: tk.textBright, fontSize: "var(--fs-lg)", lineHeight: 1.6 }}>{content.prompt}</div>
            <G cols={2} items={fmt.id === "design" ? [
              { t: "0–5 min", d: "Clarify into numbers: rates, sizes, p99, durability, ordering." },
              { t: "5–10 min", d: "Sketch the data path; boxes are threads/cores for single-machine designs." },
              { t: "10–30 min", d: "Deep-dive the hot path: structures, sharing, memory footprint, the worst case." },
              { t: "30–40 min", d: "Failure modes, recovery, what you measure, what changes at 10x (Guide 22)." },
            ] : [
              { t: "Measure", d: "Workload, metric, noise floor, pinned, ABAB." },
              { t: "Locate", d: "Waiting or busy? library? symbol? line? (perf ladder)" },
              { t: "Explain", d: "Which counter names the mechanism? The decision tree in Guide 20." },
              { t: "Decide & prove", d: "The cheapest lever that removes the mechanism; the before/after table." },
            ]} />
          </Card>
        )}
        {fmt.id === "behavioral" && (
          <ol style={{ margin: 0, paddingLeft: 20, color: tk.text, lineHeight: 1.8 }}>
            {content.prompts.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
          </ol>
        )}

        <div style={{ marginTop: 18, borderTop: `1px solid ${tk.border}`, paddingTop: 14, display: "grid", gap: 10 }}>
          <div style={{ fontFamily: tk.mono, fontSize: "var(--fs-caption)", color: tk.textDim, letterSpacing: ".12em", fontWeight: 700 }}>SELF-SCORE WHEN DONE</div>
          {["correctness", "communication", "speed"].map(slider)}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line: what went wrong, what to drill next." rows={2}
            style={{ font: "inherit", fontSize: "var(--fs-sm)", padding: 8, borderRadius: 6, border: `1px solid ${tk.border}`, background: tk.bg, color: tk.text }} />
          <div><Chip color={tk.rose} onClick={finish}>log this mock</Chip></div>
        </div>
      </S>

      <S title="Recent mocks" c={tk.slate}>
        {history.length === 0 ? <P>No mocks logged yet.</P> : history.map((h) => (
          <div key={h.key} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${alpha(tk.border, "60")}`, fontSize: "var(--fs-sm)" }}>
            <span style={{ fontFamily: tk.mono, color: tk.textDim, fontSize: "var(--fs-caption)" }}>{h.key.split(":")[1]}</span>
            <span style={{ color: tk.textBright, fontWeight: 600 }}>{FORMATS.find((f) => f.id === h.format)?.name || h.format}</span>
            <span style={{ fontFamily: tk.mono, color: tk.textDim, fontSize: "var(--fs-caption)" }}>{h.minutes} min · C{h.scores?.correctness} / M{h.scores?.communication} / S{h.scores?.speed}</span>
            {h.note && <span style={{ color: tk.text }}>{h.note}</span>}
          </div>
        ))}
      </S>
    </div>
  );
}
