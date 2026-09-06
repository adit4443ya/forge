"use client";
import { useMemo, useState } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, H1, Tag, Empty } from "@/ui/kit.jsx";
import { useNav } from "@/shell/nav.js";
import { useProgress, isSolved } from "@/lib/progress/store.js";
import { CHEATSHEET } from "@/dsaData.jsx";
import { ALL_PROBLEMS as PROBLEMS } from "@/dsaData.jsx";
import { allPatterns } from "@/data/patterns.js";
import { externalProblem } from "@/data/externalLinks.js";

/* ══════════════════════════════════════════════════════════════════════════
   PATTERNS — the templates, next to the problems that use them.

   A cheat sheet buried in a tab is a thing you read once. Here each pattern
   links to the problems in the bank that need it and shows whether you have
   solved them, so the sheet doubles as a coverage view: which templates have
   you actually used, and which do you only recognise.

   The two fields that matter most are `recognise` and `wrong`. A pattern you
   can only apply once someone names it is not much use — recognition is the
   skill, and the template is the easy half.
   ══════════════════════════════════════════════════════════════════════════ */

const titleOf = (name) => PROBLEMS.find(
  (p) => p.title === name || p.title.toLowerCase().startsWith(String(name).toLowerCase().slice(0, 18))
);

export default function Patterns() {
  const prog = useProgress();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [tier, setTier] = useState("all");

  const all = useMemo(() => allPatterns(CHEATSHEET), []);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (tier !== "all" && p.tier !== tier) return false;
      if (!needle) return true;
      return [p.pattern, p.when, p.recognise, p.tip, ...(p.problems || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [all, q, tier]);

  /* Coverage: a pattern counts as used once you have solved a problem that needs it. */
  const stats = useMemo(() => {
    let used = 0, total = 0;
    for (const p of all) {
      const linked = (p.problems || []).map(titleOf).filter(Boolean);
      if (!linked.length) continue;
      total++;
      if (linked.some((x) => isSolved(prog.dsa?.[x.id]))) used++;
    }
    return { used, total };
  }, [all, prog]);

  return (
    <div className="pane-pad pane-narrow">
      <H1>Patterns</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-4)", maxWidth: "72ch" }}>
        {all.length} templates, each with the sentence in the problem that should make you reach for it and the
        plausible first idea that fails. Recognising the pattern is the skill; the template is the easy half.
      </Muted>

      <div className="pat-bar">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="pat-search"
          placeholder="Search patterns, problems, or the thing you noticed…" />
        {[["all", `All ${all.length}`], ["core", "Core"], ["extended", "Extended"]].map(([id, label]) => (
          <button key={id} className="press pat-chip" data-on={tier === id ? "1" : undefined} onClick={() => setTier(id)}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Mono dim>{stats.used}/{stats.total} used in a solved problem</Mono>
      </div>

      <div className="pat-list">
        {list.map((p, i) => {
          const on = open === p.pattern;
          const linked = (p.problems || []).map((n) => ({ name: n, hit: titleOf(n) }));
          const solved = linked.filter((l) => l.hit && isSolved(prog.dsa?.[l.hit.id])).length;
          const inBank = linked.filter((l) => l.hit).length;
          return (
            <article key={p.pattern} className="pat anim-slide" data-open={on ? "1" : undefined} style={{ "--i": Math.min(i, 12) }}>
              <button className="press pat-head" onClick={() => setOpen(on ? null : p.pattern)}>
                <span className="pat-name">{p.pattern}</span>
                {p.tier === "extended" && <Tag hue="info">extended</Tag>}
                <div style={{ flex: 1 }} />
                {inBank > 0 && <Mono dim>{solved}/{inBank} solved</Mono>}
                <span className="pat-caret" data-open={on ? "1" : undefined}>▸</span>
              </button>

              <div className="pat-when">{p.when}</div>

              <div className={`reveal${on ? " open" : ""}`}><div className="reveal-inner">
                <div className="pat-body">
                  {p.recognise && (
                    <div className="pat-cell" style={{ borderLeftColor: H("accent").fg, background: H("accent").bg }}>
                      <Label hue="accent">how you recognise it</Label>
                      <p>{p.recognise}</p>
                    </div>
                  )}

                  <div className="pat-cell pat-template">
                    <Label>the template</Label>
                    <pre><code>{p.template}</code></pre>
                  </div>

                  {p.wrong && (
                    <div className="pat-cell" style={{ borderLeftColor: H("bad").fg, background: H("bad").bg }}>
                      <Label hue="bad">the plausible wrong idea</Label>
                      <p>{p.wrong}</p>
                    </div>
                  )}

                  <div className="pat-cell" style={{ borderLeftColor: H("ok").fg, background: H("ok").bg }}>
                    <Label hue="ok">what people get wrong</Label>
                    <p>{p.tip}</p>
                  </div>

                  {linked.length > 0 && (
                    <div>
                      <Label style={{ display: "block", marginBottom: 7 }}>practise it</Label>
                      <div className="row" style={{ flexWrap: "wrap", gap: 7 }}>
                        {linked.map((l) => {
                          if (l.hit) return (
                            <button key={l.name} className="press pat-prob"
                              data-solved={isSolved(prog.dsa?.[l.hit.id]) ? "1" : undefined}
                              onClick={() => nav.openProblem(l.hit.id)}>
                              {isSolved(prog.dsa?.[l.hit.id]) ? "✓ " : ""}{l.hit.title}
                            </button>
                          );
                          /* Not in the bank: link to the exact problem page, never a search. */
                          const ext = externalProblem(l.name);
                          if (!ext) return null;
                          return (
                            <a key={l.name} className="press pat-prob pat-prob-ext" href={ext.href}
                               target="_blank" rel="noopener noreferrer"
                               title={`${ext.label}${ext.difficulty ? " · " + ext.difficulty : ""}${ext.paid ? " · needs LeetCode Premium" : ""}`}>
                              {ext.title} <span className="pat-prob-src">{ext.label}{ext.paid ? " · premium" : ""} ↗</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div></div>
            </article>
          );
        })}
      </div>

      {list.length === 0 && <Empty icon="⌕" title="Nothing matches">Try a shorter search, or switch to All.</Empty>}

      <div style={{ marginTop: "var(--sp-6)", color: tk.faint, fontSize: "var(--fs-sm)", lineHeight: 1.7, maxWidth: "70ch" }}>
        Patterns marked <strong style={{ color: tk.info }}>extended</strong> are the ones a hard round reaches for once
        you have answered the standard set. A pattern with no solved problem next to it is one you have read, not one
        you can use. Problems not in this bank link straight to the exact page on the judge — every one of those links
        was resolved against the judge&apos;s own API, so none of them is a guess.
      </div>
    </div>
  );
}
