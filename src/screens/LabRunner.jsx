"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tk, hue as H, useSyntaxTheme } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, Tag, Button } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";

/* ══════════════════════════════════════════════════════════════════════════
   LAB RUNNER — a lab as a guided session, not a checkbox.

   The old Labs screen listed sixty-one titles and left you to go find the
   file. Everything a lab actually contains — what it teaches, the build line,
   each step's command, the output that step produced on the machine that
   wrote it, and what the output means — is parsed out of the source and shown
   here, so the only thing you leave for is the terminal.
   ══════════════════════════════════════════════════════════════════════════ */

const TRACK_HUE = {
  debug: "bad", ir: "warn", cross_level: "info", perf: "ok", cache: "info",
  codegen: "accent", concurrency: "warn", systems: "ok", aarch64: "bad",
  bigcode: "info", capstones: "accent",
};

function Copy({ text, label = "copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button className="press copy-btn" data-done={done ? "1" : undefined}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }).catch(() => {});
      }}>
      {done ? "copied" : label}
    </button>
  );
}

function Cmd({ commands, output }) {
  const joined = commands.join("\n");
  return (
    <div className="lab-cmd">
      <div className="lab-cmd-head">
        <Label hue="accent">run this</Label>
        <div style={{ flex: 1 }} />
        <Copy text={joined} />
      </div>
      <pre className="lab-cmd-body"><code>{commands.map((c, i) => (
        <span key={i} className="lab-cmd-line"><span className="lab-prompt">$</span> {c}{"\n"}</span>
      ))}</code></pre>
      {output && (
        <>
          <div className="lab-out-head"><Label>what it printed on the machine that wrote this lab</Label></div>
          <pre className="lab-out"><code>{output}</code></pre>
        </>
      )}
    </div>
  );
}

const Blocks = ({ blocks }) => blocks.map((b, i) => (
  b.kind === "cmd"
    ? <Cmd key={i} commands={b.commands} output={b.output} />
    : <p key={i} className="lab-prose">{b.text}</p>
));

function EvidenceNote({ labId }) {
  const prog = useProgress();
  const saved = prog.evidence?.[labId];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({ claim: saved?.claim || "", evidence: saved?.evidence || "", surprise: saved?.surprise || "" }));

  const field = (k, ph, rows = 2) => (
    <label key={k} style={{ display: "block", marginBottom: "var(--sp-3)" }}>
      <Label style={{ display: "block", marginBottom: 5 }}>{k}</Label>
      <textarea rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} className="lab-textarea" />
    </label>
  );

  if (!open) {
    return (
      <div className="lab-evidence" data-done={saved?.claim ? "1" : undefined}>
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: saved?.claim ? tk.ok : tk.faint, fontSize: 15 }}>{saved?.claim ? "✓" : "◇"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: tk.text, fontWeight: 650, fontSize: "var(--fs-sm)" }}>
              {saved?.claim ? "Your evidence note" : "Finish the lab: write the evidence note"}
            </div>
            {saved?.claim
              ? <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.7, marginTop: 6, whiteSpace: "pre-wrap" }}>{saved.claim}</div>
              : <Muted style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>
                  A lab is done when you can say what it showed <em>on your machine</em> — not when you have read it.
                </Muted>}
          </div>
          <Button size="sm" hue={saved?.claim ? "neutral" : "accent"} onClick={() => setOpen(true)}>
            {saved?.claim ? "Edit" : "Write it"}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="lab-evidence anim-riseSm">
      {field("claim", "One sentence: what this lab showed you on your machine.")}
      {field("evidence", "The numbers or output that support it. Paste the line that matters.", 4)}
      {field("surprise", "The thing you did not expect. If there was none, you did not look hard enough.")}
      <div className="row">
        <Button hue="ok" onClick={() => { progressStore.setEvidence(labId, f); setOpen(false); }}>Save note</Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export default function LabRunner({ lab, track, prev, next }) {
  const syn = useSyntaxTheme();
  const prog = useProgress();
  const done = !!prog.labs?.[lab.id];
  const [checked, setChecked] = useState(() => new Set());
  const hue = TRACK_HUE[lab.track] || "accent";

  const toggle = (n) => setChecked((s) => {
    const next = new Set(s);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const md = useMemo(() => ({
    code({ inline, className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className || "")?.[1];
      if (inline || !lang) return <code className={className} {...props}>{children}</code>;
      return (
        <SyntaxHighlighter style={syn} language={lang} PreTag="div"
          customStyle={{ margin: 0, padding: "14px 16px", background: tk.codeBg, fontSize: 13, lineHeight: 1.65, borderRadius: "var(--r-2)" }}>
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    },
  }), [syn]);

  const total = lab.steps.length;
  const pct = total ? Math.round((checked.size / total) * 100) : 0;

  return (
    <div className="lab-page">
      {/* ── header ─────────────────────────────────────────────── */}
      <div className="lab-top">
        <div className="row" style={{ gap: 10 }}>
          <Link href="/labs" className="press btn-sm">← Labs</Link>
          <Mono dim>{lab.id}</Mono>
          {track && <Tag hue={hue}>{track.title}</Tag>}
          <span className="mono" style={{ color: tk.faint, fontSize: "var(--fs-micro)" }}>
            {"●".repeat(lab.difficulty || 1)}{"○".repeat(Math.max(0, 4 - (lab.difficulty || 1)))}
          </span>
          <div style={{ flex: 1 }} />
          <button className="press lab-done" data-done={done ? "1" : undefined}
            onClick={() => progressStore.toggleLab(lab.id)}>
            {done ? "✓ done" : "mark done"}
          </button>
        </div>
        <h1 className="lab-title">{lab.title}</h1>
        <div className="row" style={{ gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          <Mono dim>{lab.file}</Mono>
          {lab.needs && <Mono dim>needs: {lab.needs}</Mono>}
          {total > 0 && <Mono dim>{total} steps</Mono>}
        </div>
        {total > 0 && (
          <div className="lab-progress">
            <div className="lab-progress-bar"><span style={{ width: `${pct}%` }} /></div>
            <Mono dim>{checked.size}/{total} steps</Mono>
          </div>
        )}
      </div>

      <div className="lab-body">
        {/* ── what it teaches ──────────────────────────────────── */}
        {lab.teaches && (
          <section className="lab-block">
            <Label hue={hue}>what this lab teaches</Label>
            <p className="lab-lede">{lab.teaches}</p>
          </section>
        )}

        {lab.evidence && (
          <section className="lab-callout" style={{ borderLeftColor: H("accent").fg, background: H("accent").bg }}>
            <Label hue="accent">evidence to leave with</Label>
            <div style={{ color: tk.text, fontSize: "var(--fs-sm)", lineHeight: 1.7, marginTop: 5 }}>{lab.evidence}</div>
          </section>
        )}

        {/* ── build ────────────────────────────────────────────── */}
        {lab.build && (
          <section className="lab-block">
            <Label hue={hue}>first, build it</Label>
            <Cmd commands={lab.build.split("\n")} output="" />
            {lab.artifact && <Mono dim>produces {lab.artifact}</Mono>}
          </section>
        )}

        {/* ── the steps ────────────────────────────────────────── */}
        {total > 0 && (
          <section className="lab-block">
            <Label hue={hue}>walk it, one step at a time</Label>
            <div className="lab-steps">
              {lab.steps.map((s) => {
                const on = checked.has(s.n);
                return (
                  <article key={s.n} className="lab-step" data-done={on ? "1" : undefined}>
                    <button className="press lab-step-head" onClick={() => toggle(s.n)}>
                      <span className="lab-step-n">{on ? "✓" : s.n}</span>
                      <span className="lab-step-title">{s.title || `Step ${s.n}`}</span>
                    </button>
                    <div className="lab-step-body"><Blocks blocks={s.blocks} /></div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ── markdown labs (bigcode, capstones) ───────────────── */}
        {lab.markdown && (
          <section className="lab-block prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{lab.markdown}</ReactMarkdown>
          </section>
        )}

        {/* ── extra sections from the header ───────────────────── */}
        {lab.sections?.map((s, i) => (
          <section key={i} className="lab-block">
            <Label hue={hue}>{s.title.toLowerCase()}</Label>
            <Blocks blocks={s.blocks} />
          </section>
        ))}

        {/* ── try this yourself ────────────────────────────────── */}
        {lab.tryIt?.length > 0 && (
          <section className="lab-block lab-try">
            <Label hue="ok">take it further</Label>
            <Blocks blocks={lab.tryIt} />
          </section>
        )}

        {/* ── the source ───────────────────────────────────────── */}
        {lab.source && (
          <section className="lab-block">
            <details className="lab-source">
              <summary><Label hue={hue}>read the source · {lab.file}</Label></summary>
              <SyntaxHighlighter style={syn} language={lab.lang === "llvm" ? "llvm" : lab.lang} PreTag="div"
                customStyle={{ margin: "10px 0 0", padding: "14px 16px", background: tk.codeBg, fontSize: 12.5, lineHeight: 1.6, borderRadius: "var(--r-2)", maxHeight: 560 }}>
                {lab.source}
              </SyntaxHighlighter>
            </details>
          </section>
        )}

        {/* ── close the loop ───────────────────────────────────── */}
        <section className="lab-block"><EvidenceNote labId={lab.id} /></section>

        <nav className="lab-nav">
          {prev ? <Link href={`/labs/${prev.id}`} className="press lab-nav-link"><Mono dim>← {prev.id}</Mono><span>{prev.title}</span></Link> : <span />}
          {next ? <Link href={`/labs/${next.id}`} className="press lab-nav-link" data-next="1"><Mono dim>{next.id} →</Mono><span>{next.title}</span></Link> : <span />}
        </nav>
      </div>
    </div>
  );
}
