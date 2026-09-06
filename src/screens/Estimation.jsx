"use client";
import { useCallback, useMemo, useState } from "react";
import { hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, H1, Button, Tag } from "@/ui/kit.jsx";
import { ESTIMATES, EST_KINDS } from "@/data/estimation.js";
import { useProgress, progressStore } from "@/lib/progress/store.js";

/* ══════════════════════════════════════════════════════════════════════════
   ESTIMATION — you are not scored on the number.

   Trading and research loops run these, and the rubric is the structure:
   decompose into defensible terms, carry a RANGE not a point, and name the
   assumption you least trust. So this screen makes you commit your chain in
   writing BEFORE it will show you a worked one — otherwise you read someone
   else's reasoning and mistake recognition for the ability to produce it.
   ══════════════════════════════════════════════════════════════════════════ */

const D = { 1: "warm-up", 2: "standard", 3: "hard", 4: "genuinely hard" };

export default function Estimation() {
  const prog = useProgress();
  const [kinds, setKinds] = useState(() => new Set(EST_KINDS.map((k) => k.id)));
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const [mine, setMine] = useState({ chain: "", number: "", weakest: "" });
  const [revealed, setRevealed] = useState(false);

  const deck = useMemo(() => ESTIMATES.filter((e) => kinds.has(e.kind)), [kinds]);
  const card = deck[i] || null;
  const committed = mine.chain.trim().length > 20 && mine.number.trim().length > 0;

  const next = useCallback((verdict) => {
    if (card) {
      progressStore.setNote(`est:${card.id}`, JSON.stringify({ verdict, ...mine }));
    }
    setMine({ chain: "", number: "", weakest: "" });
    setRevealed(false);
    setI((n) => n + 1);
  }, [card, mine]);

  const toggle = (id) => setKinds((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n.size ? n : s;
  });

  const done = Object.keys(prog.notes || {}).filter((k) => k.startsWith("est:")).length;

  /* ── setup ──────────────────────────────────────────────────────────── */
  if (!running) {
    return (
      <div className="pane-pad pane-narrow">
        <H1>Estimation</H1>
        <Muted style={{ marginTop: 8, marginBottom: "var(--sp-4)", maxWidth: "72ch" }}>
          Reason to a number nobody gave you. These rounds are not scored on the answer — they are scored on whether
          you decomposed into terms you can defend, carried a range instead of a point, and could name the assumption
          you least trust. That last one is the question people forget to answer.
        </Muted>
        <div className="est-rubric">
          {[
            ["1", "Decompose", "Break it into terms each defensible within a factor of two or three. Errors partly cancel; they do not compound."],
            ["2", "Anchor", "State every number you are assuming, out loud, as an assumption rather than a fact."],
            ["3", "Range", "Give a band, not a point. A point estimate claims precision the method does not have."],
            ["4", "Weakest link", "Name the term you least trust and say how far wrong it could push the answer."],
          ].map(([n, t, d]) => (
            <div key={n} className="est-rubric-item">
              <span className="est-rubric-n">{n}</span>
              <div><strong>{t}</strong><span>{d}</span></div>
            </div>
          ))}
        </div>

        <Label style={{ marginTop: "var(--sp-5)", display: "block" }}>pick your decks</Label>
        <div className="rf-decks">
          {EST_KINDS.map((k) => {
            const on = kinds.has(k.id);
            const n = ESTIMATES.filter((e) => e.kind === k.id).length;
            return (
              <button key={k.id} className="press rf-deck" data-on={on ? "1" : undefined} onClick={() => toggle(k.id)}
                style={on ? { borderColor: H(k.hue).line, background: H(k.hue).bg } : undefined}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ color: H(k.hue).fg, fontWeight: 700, fontSize: "var(--fs-sm)" }}>{k.label}</span>
                  <div style={{ flex: 1 }} />
                  <Mono dim>{n}</Mono>
                </div>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: "var(--sp-5)", gap: "var(--sp-3)" }}>
          <Button hue="accent" onClick={() => { setI(0); setRevealed(false); setRunning(true); }}>
            ▶ Start · {deck.length} questions
          </Button>
          {done > 0 && <Mono dim>{done} worked before</Mono>}
        </div>
      </div>
    );
  }

  /* ── finished ───────────────────────────────────────────────────────── */
  if (!card) {
    return (
      <div className="pane-pad pane-narrow">
        <H1>Deck finished</H1>
        <Muted style={{ marginTop: 10, maxWidth: "64ch" }}>
          Your chains are saved. The useful review is not whether the number matched — it is whether the assumption
          you flagged as weakest was the one that actually dominated.
        </Muted>
        <div className="row" style={{ marginTop: "var(--sp-5)", gap: "var(--sp-3)" }}>
          <Button hue="accent" onClick={() => { setI(0); setRevealed(false); }}>Run it again</Button>
          <Button onClick={() => setRunning(false)}>Change decks</Button>
        </div>
      </div>
    );
  }

  const k = EST_KINDS.find((x) => x.id === card.kind);
  return (
    <div className="rf-stage">
      <div className="rf-bar">
        <Mono dim>{i + 1} / {deck.length}</Mono>
        <div className="rf-bar-track"><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>
        <Tag hue={k?.hue}>{k?.label}</Tag>
        <Mono dim>{D[card.d]}</Mono>
        <div style={{ flex: 1 }} />
        <button className="press btn-sm" onClick={() => setRunning(false)}>end</button>
      </div>

      <div className="rf-card" key={card.id}>
        <p className="rf-q">{card.q}</p>

        {!revealed && (
          <>
            <div className="est-anchors">
              <Label>quantities worth anchoring on</Label>
              <ul>{card.anchors.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>

            <div className="est-form">
              <label>
                <Label style={{ display: "block", marginBottom: 5 }}>your chain — one line per step</Label>
                <textarea rows={6} className="lab-textarea" value={mine.chain}
                  onChange={(e) => setMine({ ...mine, chain: e.target.value })}
                  placeholder={"5e6 people ÷ 2.5 per household = 2e6 households\n1 in 50 has a piano → 4e4 pianos\n…"} />
              </label>
              <div className="est-row">
                <label>
                  <Label style={{ display: "block", marginBottom: 5 }}>your answer, as a range</Label>
                  <input className="lab-textarea" value={mine.number}
                    onChange={(e) => setMine({ ...mine, number: e.target.value })} placeholder="e.g. 50 – 200" />
                </label>
                <label>
                  <Label style={{ display: "block", marginBottom: 5 }}>the assumption you least trust</Label>
                  <input className="lab-textarea" value={mine.weakest}
                    onChange={(e) => setMine({ ...mine, weakest: e.target.value })} placeholder="and how far wrong it could push you" />
                </label>
              </div>
              <div className="row" style={{ marginTop: "var(--sp-4)", gap: "var(--sp-3)" }}>
                <Button hue="accent" disabled={!committed} onClick={() => setRevealed(true)}>
                  {committed ? "Commit and compare" : "Write your chain first"}
                </Button>
                <button className="press btn-sm" onClick={() => setRevealed(true)}>skip to the worked answer</button>
              </div>
              {!committed && (
                <Muted style={{ fontSize: "var(--fs-micro)", marginTop: 8 }}>
                  Reading a worked chain feels like understanding. Producing one is the skill being tested.
                </Muted>
              )}
            </div>
          </>
        )}

        {revealed && (
          <div className="anim-riseSm">
            {mine.chain.trim() && (
              <div className="est-yours">
                <Label>what you wrote</Label>
                <pre>{mine.chain}</pre>
                <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
                  {mine.number && <Mono dim>your range: {mine.number}</Mono>}
                  {mine.weakest && <Mono dim>your weak link: {mine.weakest}</Mono>}
                </div>
              </div>
            )}

            <div className="est-work">
              <Label hue={k?.hue}>a worked chain</Label>
              <ol>{card.work.map((w, n) => <li key={n}>{w}</li>)}</ol>
              <div className="est-answer">
                <div><Label hue="ok">lands at</Label><span>{card.answer}</span></div>
                <div><Label>defensible range</Label><span>{card.range}</span></div>
              </div>
            </div>

            <div className="est-trust">
              <Label hue="warn">the assumption to distrust</Label>
              <p>{card.trust}</p>
            </div>

            <div className="est-matters">
              <Label hue="info">why the number changes what you build</Label>
              <p>{card.matters}</p>
            </div>

            <div className="rf-rate">
              <Label>how did your chain do?</Label>
              <div className="rf-rate-row">
                <button className="press rf-rate-btn" data-k="got" onClick={() => next("close")}>right order, right weak link <kbd className="mono">1</kbd></button>
                <button className="press rf-rate-btn" data-k="shaky" onClick={() => next("order")}>right order, missed the weak link <kbd className="mono">2</kbd></button>
                <button className="press rf-rate-btn" data-k="missed" onClick={() => next("off")}>off by an order or more <kbd className="mono">3</kbd></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
