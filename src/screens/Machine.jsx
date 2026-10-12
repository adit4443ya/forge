"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, Muted, Note, Code, Reveal, Tabs } from "@/ui/kit.jsx";
import { useTargetChange } from "@/ui/hooks.js";
import { LITMUS, LITMUS_FAMILIES, MODELS } from "@/data/litmus.js";
import { RAPID } from "@/data/rapidfire.js";
import { GUIDES } from "@/data/generated/guides.js";
import { LAB_INDEX } from "@/data/generated/labs.js";

/* ══════════════════════════════════════════════════════════════════════════
   THE MACHINE — memory as one subject.

   This surface exists because the material was correct and unusable: the chain
   from DRAM to a C++ memory_order had every link present as a bullet in a
   different guide under a different category, and no page anywhere walked it
   end to end. So this is a spine, not a silo — it links the four new guides
   AND the older reference cards rather than restating them.
   ══════════════════════════════════════════════════════════════════════════ */

const SPINE = ["24", "25", "26", "27"];

/* The causal chain. Each link is a question the next one answers, which is the
   ordering that makes the subject learnable rather than a pile of facts. */
const CHAIN = [
  { n: 1, stage: "DRAM is slow, and that is physics",
    q: "Why is there a hierarchy at all?",
    a: "A bit is a leaking capacitor read by an analog sense amplifier. Latency is set by circuit physics and has barely moved; bandwidth is width and frequency and has.",
    guide: "24", anchor: "part-1-why-there-is-a-hierarchy-at-all" },
  { n: 2, stage: "So we cache, in lines",
    q: "What is the unit of memory traffic?",
    a: "64 bytes, always. A field you never read still costs its line — the whole argument for data layout in one sentence.",
    guide: "24", anchor: "part-3-the-line-is-the-unit" },
  { n: 3, stage: "Lookup must be cheap, so sets and ways",
    q: "Why is L1 only 48 KiB?",
    a: "It is indexed before translation finishes, so index plus offset must fit in the page offset. Size is capped at page size times associativity.",
    guide: "24", anchor: "part-4-cache-organisation-sets-ways-and-the-conflicts-they-create" },
  { n: 4, stage: "Waiting is overlapped, not removed",
    q: "Why do the same loads cost 145 ns or 12 ns?",
    a: "Memory-level parallelism. Independent misses overlap in the fill buffers; dependent ones serialise. Little's law is the whole optimisation story.",
    guide: "24", anchor: "part-7-memory-level-parallelism-and-little-s-law" },
  { n: 5, stage: "A second core appears",
    q: "If two caches hold one line and one writes, how does the other find out?",
    a: "MESI, maintaining single-writer-or-multiple-readers. It works on lines, not variables — which is why false sharing costs the same as true sharing.",
    guide: "25", anchor: "part-2-mesi-derived" },
  { n: 6, stage: "The store buffer forces a weak model",
    q: "Why can two cores disagree about the order of two writes?",
    a: "A store sits in a buffer, not yet visible, while a load of a different address reads cache. That is StoreLoad reordering, from a structure that exists purely for speed.",
    guide: "25", anchor: "part-4-the-store-buffer-forces-a-weak-memory-model" },
  { n: 7, stage: "Architectures differ, and litmus tests name the difference",
    q: "What exactly is allowed where?",
    a: "x86-TSO permits StoreLoad and nothing else. AArch64 permits nearly everything. MP is forbidden on one and allowed on the other — the whole 'works on my laptop' genre.",
    guide: "25", anchor: "part-7-the-litmus-catalogue" },
  { n: 8, stage: "C++ gives you a budget",
    q: "What do I actually write?",
    a: "relaxed buys atomicity, acquire/release buy one paired edge, seq_cst buys a global order and is needed for exactly one pattern. A data race is UB, not a stale value.",
    guide: "27", anchor: "part-1-the-c-memory-model-precisely" },
  { n: 9, stage: "Underneath it all, translation",
    q: "Why does my latency curve bend at 8 MB when L3 is 18 MB?",
    a: "TLB reach: 2048 entries times 4 KiB. Not a cache level. A latency curve has two staircases interleaved and reading one as the other sends you to fix the wrong thing.",
    guide: "26", anchor: "part-2-tlb-reach-and-the-cliff-it-explains" },
  { n: 10, stage: "And the OS, which costs you tail",
    q: "p50 is fine and p99.9 is 100x. Why?",
    a: "Page faults, preemption, interrupts, frequency, compaction. None of it shows in a mean. A tail is attributed, never averaged.",
    guide: "26", anchor: "part-9-attributing-a-tail" },
  { n: 11, stage: "Which is where the practice lives",
    q: "So what do I build?",
    a: "Share nothing; pad what you must share; read your own copy. The measured SPSC queue goes 148 → 30 ns on those three moves — and the predictable version is not the one with the lowest median.",
    guide: "27", anchor: "part-4-the-spsc-ring-buffer-optimised-three-times" },
];

/* The older guides this surface unifies. They are good reference cards; they
   were never a teaching sequence, which is what the spine adds. */
const REFERENCE_CARDS = [
  { num: "07", why: "the C++ side, condensed — keep for revision once guide 27 has taught it" },
  { num: "13", why: "the AArch64 hardware detail behind guide 25's ordering table" },
  { num: "17", why: "the Linux tuning checklist guide 26 derives" },
  { num: "19", why: "the x86 counters-and-numbers card for guides 24 and 25" },
  { num: "20", why: "the investigation method that uses all four" },
];

const LAB_TRACKS_HERE = [
  { id: "cache", label: "Memory hierarchy", proves: "guides 24 and 26" },
  { id: "concurrency", label: "Atomics and ordering", proves: "guides 25 and 27" },
  { id: "perf", label: "Measurement discipline", proves: "every number on this page" },
  { id: "systems", label: "Syscalls and waiting", proves: "guide 26" },
];

/* Measured on one pinned machine, turbo off. Stated as that machine's numbers,
   because a latency table presented as universal is how folklore starts. */
const LATENCY = [
  ["L1D hit", "2.4 ns", "48 KiB, 12-way; ~5 cycles", "cache/02"],
  ["L2 hit", "4–12 ns", "the rise inside it is the L1 dTLB, not L2", "cache/02"],
  ["L3 hit", "24–80+ ns", "shared; depends on slice distance", "cache/02"],
  ["Beyond STLB reach", "+15–100 ns", "~8 MB at 4 KiB pages — a page walk, not a cache", "cache/02"],
  ["DRAM, dependent", "128–184 ns", "includes the walk and queueing", "cache/02"],
  ["DRAM, 16-way parallel", "12 ns/load", "same loads, overlapped — Little's law", "cache/05"],
  ["Cache line transfer, core to core", "40–100 ns", "what false sharing actually costs", "cache/04"],
  ["Uncontended atomic RMW", "11.8 ns", "spinlock 13.5, std::mutex 25", "concurrency/04"],
  ["SPSC handoff, tuned", "29–34 ns", "148 naive; 2.4 across SMT siblings", "concurrency/02"],
  ["clock_gettime via vDSO", "38 ns", "no mode switch", "systems/02"],
  ["Minimal real syscall", "142 ns", "getpid; 23.6 µs under strace", "systems/02"],
  ["UDP round trip, busy-poll", "8.7 µs p50", "blocking 18.5, epoll 19.9", "systems/03"],
];

const BARRIERS = [
  ["LoadLoad", "free", "DMB ISHLD"],
  ["LoadStore", "free", "DMB ISHLD"],
  ["StoreStore", "free", "DMB ISHST"],
  ["StoreLoad", "MFENCE / any lock-prefixed op", "DMB ISH"],
];

const PAPERS = [
  { t: "x86-TSO: A Rigorous and Usable Programmer's Model", by: "Sewell, Sarkar, Owens et al., CACM 2010",
    u: "https://www.cl.cam.ac.uk/~pes20/weakmemory/", n: "the formal model for what x86 guarantees" },
  { t: "Simplifying ARM Concurrency", by: "Pulte, Flur, Deacon et al., POPL 2018",
    u: "https://www.cl.cam.ac.uk/~pes20/weakmemory/", n: "the revision that made ARMv8 other-multi-copy atomic" },
  { t: "Shared Memory Consistency Models: A Tutorial", by: "Adve and Gharachorloo, 1996",
    u: null, n: "still the best single introduction to the topic" },
  { t: "What Every Programmer Should Know About Memory", by: "Ulrich Drepper, 2007",
    u: "https://lwn.net/Articles/250967/", n: "the most complete treatment of caches and DRAM for programmers" },
  { t: "Foundations of the C++ Concurrency Memory Model", by: "Boehm and Adve, PLDI 2008",
    u: null, n: "why the C++ model is shaped the way it is" },
  { t: "perfbook — Is Parallel Programming Hard?", by: "Paul E. McKenney",
    u: null, n: "RCU, hazard pointers, cumulativity, from the practitioner side" },
  { t: "Weak Memory Model Formalisms: Introduction and Survey", by: "arXiv, 2025",
    u: "https://arxiv.org/pdf/2508.04115", n: "x86-TSO, ARM and POWER models side by side" },
  { t: "False Sharing — kernel documentation", by: "docs.kernel.org",
    u: "https://docs.kernel.org/kernel-hacking/false-sharing.html", n: "the perf c2c workflow, and when not to bother" },
  { t: "When a Microsecond Is an Eternity", by: "Carl Cook, CppCon 2017",
    u: "https://isocpp.org/blog/2018/09/cppcon-2017-when-a-microsecond-is-an-eternity-high-performance-trading-syst", n: "the low-latency C++ talk; design advice ages better than the micro-tricks" },
  { t: "When Nanoseconds Matter", by: "David Gross, CppCon 2024",
    u: "https://isocpp.org/blog/2025/05/cppcon-2024-when-nanoseconds-matter-ultrafast-trading-systems-in-cpp-d", n: "the recent treatment, emphasising design-phase decisions" },
];

const VERDICT_HUE = { forbidden: "ok", allowed: "bad" };

export default function Machine({ target }) {
  const [tab, setTab] = useState("chain");
  const [fam, setFam] = useState("all");
  const [open, setOpen] = useState(() => new Set());

  useTargetChange(target, (t) => { if (t.kind === "tab" && ["chain", "litmus", "reference"].includes(t.id)) setTab(t.id); });

  const guides = useMemo(() => Object.fromEntries(GUIDES.map((g) => [String(g.num), g])), []);
  const memCount = useMemo(() => RAPID.filter((r) => r.domain === "mem").length, []);
  const labCount = useMemo(
    () => LAB_INDEX.filter((l) => LAB_TRACKS_HERE.some((t) => l.id.startsWith(`${t.id}-`))).length, []);
  const shown = useMemo(() => (fam === "all" ? LITMUS : LITMUS.filter((l) => l.family === fam)), [fam]);

  const toggle = (id) => setOpen((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div>
      <header style={{ marginBottom: "var(--sp-6)" }}>
        <H1>The Machine</H1>
        <Muted style={{ marginTop: "var(--sp-2)", maxWidth: "68ch" }}>
          How memory actually works, as one subject. The chain from a leaking capacitor to a
          <Mono> memory_order</Mono> runs through four guides, {LITMUS.length} litmus drills,
          {" "}{memCount} rapid-fire questions and {labCount} labs you run yourself — in that order,
          because each link is the question the next one answers.
        </Muted>
        <Note hue="info" style={{ marginTop: "var(--sp-4)" }}>
          Every measured number on this surface came from one pinned machine with turbo disabled,
          and is labelled with the lab that produced it. The shapes are universal; the constants are not.
          Reproduce them on your own box before quoting them.
        </Note>
      </header>

      <Tabs
        value={tab} onChange={setTab}
        items={[
          { id: "chain", label: "The chain" },
          { id: "litmus", label: `Litmus drills · ${LITMUS.length}` },
          { id: "reference", label: "Reference" },
        ]}
        style={{ marginBottom: "var(--sp-5)" }}
      />

      {tab === "chain" && (
        <>
          <Section title="The causal chain" hue="accent"
            right={<Mono dim>each link answers the previous question</Mono>}>
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              {CHAIN.map((c, i) => (
                <Panel key={c.n} i={i} hue={c.n <= 4 ? "info" : c.n <= 8 ? "accent" : "ok"}
                  style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                  <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "baseline", flexWrap: "wrap" }}>
                    <Mono dim style={{ minWidth: 22 }}>{String(c.n).padStart(2, "0")}</Mono>
                    <strong style={{ color: tk.text, fontSize: "var(--fs-md)" }}>{c.stage}</strong>
                    <Link href={`/learn/guide/${c.guide}#${c.anchor}`} style={{ marginLeft: "auto" }}>
                      <Tag hue="accent">guide {c.guide} →</Tag>
                    </Link>
                  </div>
                  <div style={{ marginTop: 6, color: tk.dim, fontSize: "var(--fs-sm)", fontStyle: "italic" }}>{c.q}</div>
                  <div style={{ marginTop: 4, color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{c.a}</div>
                </Panel>
              ))}
            </div>
          </Section>

          <Section title="The four guides" hue="accent" right={<Mono dim>the spine, in reading order</Mono>}>
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              {SPINE.map((num, i) => {
                const g = guides[num];
                if (!g) return null;
                const parts = (g.headings || []).filter((h) => /^part-/.test(h.id) && !/q-a-drill/.test(h.id));
                return (
                  <Panel key={num} i={i} hue="accent" style={{ padding: "var(--sp-4)" }}>
                    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "baseline", flexWrap: "wrap" }}>
                      <Tag hue="accent">{num}</Tag>
                      <Link href={`/learn/guide/${num}`}>
                        <strong style={{ color: tk.text, fontSize: "var(--fs-lg)" }}>{g.title}</strong>
                      </Link>
                      <Mono dim style={{ marginLeft: "auto" }}>{g.readTime} · {parts.length} parts</Mono>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: "var(--sp-3)" }}>
                      {parts.map((p) => (
                        <Link key={p.id} href={`/learn/guide/${num}#${p.id}`}>
                          <Tag>{p.text.replace(/^PART\s+\d+\s*[—–-]\s*/i, "")}</Tag>
                        </Link>
                      ))}
                    </div>
                  </Panel>
                );
              })}
            </div>
          </Section>

          <Section title="The reference cards this unifies" hue="info"
            right={<Mono dim>good for revision, never a sequence</Mono>}>
            <Muted style={{ marginBottom: "var(--sp-3)" }}>
              This material was always here — spread across three unrelated categories, with the whole
              memory system compressed into about a dozen bullets. Those bullets are excellent once you
              know the mechanism; they are unusable as a first pass. Keep them for revision.
            </Muted>
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              {REFERENCE_CARDS.map((r, i) => {
                const g = guides[r.num];
                if (!g) return null;
                return (
                  <Link key={r.num} href={`/learn/guide/${r.num}`}>
                    <Panel i={i} hoverable style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                      <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "baseline", flexWrap: "wrap" }}>
                        <Tag>{r.num}</Tag>
                        <strong style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>{g.title}</strong>
                        <Mono dim style={{ marginLeft: "auto" }}>{r.why}</Mono>
                      </div>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </Section>

          <Section title="Proof on your own machine" hue="ok"
            right={<Mono dim>{labCount} labs</Mono>}>
            <Muted style={{ marginBottom: "var(--sp-3)" }}>
              Nothing above is worth believing because it is written down. Each of these tracks produces
              the numbers this surface quotes, on your hardware.
            </Muted>
            <div style={{ display: "grid", gap: "var(--sp-2)", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              {LAB_TRACKS_HERE.map((t, i) => {
                const n = LAB_INDEX.filter((l) => l.id.startsWith(`${t.id}-`)).length;
                return (
                  <Link key={t.id} href={`/labs?lab=${t.id}-01`}>
                    <Panel i={i} hue="ok" hoverable style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                      <div className="label" style={{ color: tk.faint }}>{t.id}</div>
                      <div style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                      <Mono dim>{n} labs · proves {t.proves}</Mono>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </Section>

          <Section title="Drill it" hue="warn">
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              <Button hue="warn" variant="solid" onClick={() => setTab("litmus")}>
                {LITMUS.length} litmus drills →
              </Button>
              <Link href="/practice?tab=rapid"><Button hue="accent">{memCount} rapid-fire questions →</Button></Link>
            </div>
          </Section>
        </>
      )}

      {tab === "litmus" && (
        <>
          <Note hue="warn" style={{ marginBottom: "var(--sp-4)" }}>
            <strong>Read the format before the first one.</strong> Ordinary drills have one answer.
            These have a <em>set</em> of permitted outcomes, and the set differs by architecture —
            which is the entire point, because a bug that is forbidden on x86 and allowed on AArch64
            is the most common shape of real concurrency failure. Decide your verdict for all three
            columns before revealing.
          </Note>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "var(--sp-4)" }}>
            <Button size="sm" hue={fam === "all" ? "accent" : "neutral"}
              variant={fam === "all" ? "solid" : "ghost"} onClick={() => setFam("all")}>
              All {LITMUS.length}
            </Button>
            {LITMUS_FAMILIES.map((f) => {
              const n = LITMUS.filter((l) => l.family === f.id).length;
              return (
                <Button key={f.id} size="sm" hue={fam === f.id ? f.hue : "neutral"}
                  variant={fam === f.id ? "solid" : "ghost"} onClick={() => setFam(f.id)} title={f.note}>
                  {f.label} {n}
                </Button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: "var(--sp-4)" }}>
            {shown.map((l, i) => {
              const isOpen = open.has(l.id);
              const famDef = LITMUS_FAMILIES.find((f) => f.id === l.family);
              return (
                <Panel key={l.id} i={i} hue={famDef?.hue || "neutral"} style={{ padding: "var(--sp-4)" }}>
                  <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "baseline", flexWrap: "wrap" }}>
                    {l.star && <Tag hue="bad" solid>start here</Tag>}
                    <strong style={{ color: tk.text, fontSize: "var(--fs-lg)" }}>{l.name}</strong>
                    <Mono dim style={{ marginLeft: "auto" }}>
                      {"●".repeat(l.d)}{"○".repeat(4 - l.d)}
                    </Mono>
                  </div>
                  <Muted style={{ marginTop: 4, fontSize: "var(--fs-sm)" }}>{l.teaches}</Muted>

                  <Code label="initially" lang="cpp" style={{ marginTop: "var(--sp-3)" }}>{l.init}</Code>

                  <div style={{
                    display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-2)",
                    gridTemplateColumns: `repeat(auto-fit,minmax(${l.threads.length > 2 ? 180 : 260}px,1fr))`,
                  }}>
                    {l.threads.map((t) => (
                      <Code key={t.label} label={t.label} lang="cpp" style={{ margin: 0 }}>{t.code}</Code>
                    ))}
                  </div>

                  <div style={{
                    marginTop: "var(--sp-3)", padding: "var(--sp-3)", borderRadius: "var(--r-2)",
                    background: tk.codeBg, border: `1px solid ${tk.codeLine}`,
                  }}>
                    <Label hue="warn">the question</Label>
                    <div style={{ color: tk.text, fontSize: "var(--fs-md)", marginTop: 4 }}>{l.ask}</div>
                  </div>

                  <Button hue={famDef?.hue || "accent"} variant={isOpen ? "ghost" : "solid"}
                    onClick={() => toggle(l.id)} style={{ marginTop: "var(--sp-3)" }}>
                    {isOpen ? "Hide" : "Reveal the verdict"}
                  </Button>

                  <Reveal open={isOpen}>
                    <div style={{ paddingTop: "var(--sp-3)" }}>
                      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                        {MODELS.map((m) => {
                          const v = l.verdict[m.id];
                          return (
                            <div key={m.id} title={m.note} style={{
                              flex: "1 1 150px", padding: "var(--sp-2) var(--sp-3)",
                              borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`,
                            }}>
                              <div className="label" style={{ color: tk.faint }}>{m.label}</div>
                              <div style={{ color: H(VERDICT_HUE[v] || "neutral").fg, fontWeight: 700, fontSize: "var(--fs-md)" }}>
                                {v}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {l.answerText && (
                        <Note hue="bad" style={{ marginTop: "var(--sp-3)" }}>{l.answerText}</Note>
                      )}
                      {l.scNote && <Muted style={{ marginTop: "var(--sp-2)", fontSize: "var(--fs-sm)" }}>{l.scNote}</Muted>}
                      {l.note && <Note hue="warn" style={{ marginTop: "var(--sp-3)" }}>{l.note}</Note>}

                      <div style={{ marginTop: "var(--sp-3)" }}>
                        <Label hue="info">mechanism</Label>
                        <Muted style={{ marginTop: 4 }}>{l.why}</Muted>
                      </div>
                      <div style={{ marginTop: "var(--sp-3)" }}>
                        <Label hue="ok">the fix</Label>
                        <Muted style={{ marginTop: 4 }}>{l.fix}</Muted>
                      </div>
                      {l.evidence && (
                        <Note hue="ok" style={{ marginTop: "var(--sp-3)" }}>
                          <strong>Measured.</strong> {l.evidence}
                        </Note>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: "var(--sp-3)", flexWrap: "wrap" }}>
                        {l.guide && (
                          <Link href={`/learn/guide/${l.guide.num}#${l.guide.anchor}`}>
                            <Tag hue="accent">guide {l.guide.num} →</Tag>
                          </Link>
                        )}
                        {l.lab && <Link href={`/labs/${l.lab}`}><Tag hue="ok">run {l.lab} →</Tag></Link>}
                      </div>
                    </div>
                  </Reveal>
                </Panel>
              );
            })}
          </div>
        </>
      )}

      {tab === "reference" && (
        <>
          <Section title="The latency table" hue="info"
            right={<Mono dim>one machine, pinned, turbo off</Mono>}>
            <Muted style={{ marginBottom: "var(--sp-3)" }}>
              Measure your own and keep it. A plateau you measured predicts cost far better than any
              published table, and the gap between a dependent and an overlapped access is the single
              most useful number here.
            </Muted>
            <div style={{ overflowX: "auto" }}>
              <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-xs)" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tk.line}` }}>
                    {["what", "cost", "note", "lab"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: tk.faint, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LATENCY.map(([w, c, n, lab]) => (
                    <tr key={w} style={{ borderBottom: `1px solid ${tk.line}` }}>
                      <td style={{ padding: "6px 10px", color: tk.text }}>{w}</td>
                      <td style={{ padding: "6px 10px", color: tk.accent, fontWeight: 700, whiteSpace: "nowrap" }}>{c}</td>
                      <td style={{ padding: "6px 10px", color: tk.dim }}>{n}</td>
                      <td style={{ padding: "6px 10px", color: tk.faint }}>{lab}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="What a barrier costs, by architecture" hue="accent">
            <div style={{ overflowX: "auto" }}>
              <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-xs)" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tk.line}` }}>
                    {["ordering", "x86-64", "AArch64"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: tk.faint, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BARRIERS.map(([o, x, a]) => (
                    <tr key={o} style={{ borderBottom: `1px solid ${tk.line}` }}>
                      <td style={{ padding: "6px 10px", color: tk.text }}>{o}</td>
                      <td style={{ padding: "6px 10px", color: x === "free" ? H("ok").fg : H("bad").fg }}>{x}</td>
                      <td style={{ padding: "6px 10px", color: tk.dim }}>{a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note hue="warn" style={{ marginTop: "var(--sp-3)" }}>
              StoreLoad is always the expensive one, because it is the only ordering that requires
              actually draining the store buffer. On x86 it is the <em>only</em> one you pay for, which is
              why acquire and release are free there and why a <Mono>seq_cst</Mono> store is not.
            </Note>
          </Section>

          <Section title="The litmus summary" hue="warn">
            <div style={{ overflowX: "auto" }}>
              <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-xs)" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tk.line}` }}>
                    {["test", "tests for", ...MODELS.map((m) => m.label)].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: tk.faint, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LITMUS.filter((l) => l.family === "hardware").map((l) => (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${tk.line}` }}>
                      <td style={{ padding: "6px 10px", color: tk.text }}>{l.name.split(" — ")[0]}</td>
                      <td style={{ padding: "6px 10px", color: tk.dim }}>{l.name.split(" — ")[1] || "—"}</td>
                      {MODELS.map((m) => (
                        <td key={m.id} style={{ padding: "6px 10px", color: H(VERDICT_HUE[l.verdict[m.id]] || "neutral").fg }}>
                          {l.verdict[m.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Muted style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-sm)" }}>
              Read the x86 column downwards: almost everything is forbidden. That is TSO in one column,
              and it is exactly why x86 forgives code that AArch64 will not.
            </Muted>
          </Section>

          <Section title="The literature" hue="info"
            right={<Mono dim>read these rather than more blog posts</Mono>}>
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              {PAPERS.map((p, i) => (
                <Panel key={p.t} i={i} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                  <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "baseline", flexWrap: "wrap" }}>
                    {p.u
                      ? <a href={p.u} target="_blank" rel="noopener noreferrer"
                          style={{ color: tk.accent, fontWeight: 600, fontSize: "var(--fs-sm)" }}>{p.t} ↗</a>
                      : <strong style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>{p.t}</strong>}
                    <Mono dim>{p.by}</Mono>
                  </div>
                  <Muted style={{ marginTop: 2, fontSize: "var(--fs-sm)" }}>{p.n}</Muted>
                </Panel>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
