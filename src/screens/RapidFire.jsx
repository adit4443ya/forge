"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, H1, Button, Tag, Empty } from "@/ui/kit.jsx";
import { RAPID, DOMAINS } from "@/data/rapidfire.js";
import { decksFor } from "@/data/roleScope.js";
import { useProgress, progressStore } from "@/lib/progress/store.js";
import { addCard, hasCard, cardId } from "@/lib/review.js";

/* ══════════════════════════════════════════════════════════════════════════
   RAPID FIRE — the drill for things you must be able to say, not look up.

   One question at a time, nothing else on screen. You commit out loud, then
   reveal. Rating yourself is the point: a miss goes into the review queue, and
   the follow-up ("where most people come apart") is shown after the answer so
   you cannot skim past the part that actually separates candidates.
   ══════════════════════════════════════════════════════════════════════════ */

const DIFF = { 1: "easy", 2: "standard", 3: "hard", 4: "few get this" };
const shuffle = (a, seed) => {
  const r = [...a];
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export default function RapidFire({ role }) {
  const prog = useProgress();
  /* Open with the decks this role is actually screened on; the rest are one
     click away, because nothing here is off-limits. */
  const [picked, setPicked] = useState(() => {
    const d = decksFor(role?.id, "rapid");
    return new Set(d.length ? d : DOMAINS.map((x) => x.id));
  });
  const [seed, setSeed] = useState(1);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0);           // 0 question · 1 answer · 2 follow-up
  const [tally, setTally] = useState({ got: 0, shaky: 0, missed: 0 });
  const [running, setRunning] = useState(false);

  const deck = useMemo(
    () => shuffle(RAPID.filter((r) => picked.has(r.domain)), seed),
    [picked, seed]
  );
  const card = deck[i] || null;

  const rate = useCallback((verdict) => {
    if (!card) return;
    setTally((t) => ({ ...t, [verdict]: t[verdict] + 1 }));
    progressStore.setNote(`rapid:${card.id}`, verdict);
    if (verdict !== "got" && !hasCard(cardId(card.q))) {
      addCard({ q: card.q, a: `${card.a}\n\n${card.edge}`, module: `rapid:${card.domain}` });
    }
    setStage(0);
    setI((n) => n + 1);
  }, [card]);

  useEffect(() => {
    if (!running) return undefined;
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setStage((s) => Math.min(s + 1, 2)); }
      else if (e.key === "1") rate("got");
      else if (e.key === "2") rate("shaky");
      else if (e.key === "3") rate("missed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, rate]);

  const seen = Object.keys(prog.notes || {}).filter((k) => k.startsWith("rapid:")).length;
  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n.size ? n : s;                          // never leave an empty deck
  });

  /* ── setup ──────────────────────────────────────────────────────────── */
  if (!running) {
    return (
      <div className="pane-pad pane-narrow">
        <H1>Rapid fire</H1>
        <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)", maxWidth: "70ch" }}>
          {RAPID.length} mechanism questions with short answers. Say yours out loud <em>before</em> you reveal —
          the gap between knowing and being able to say it under a clock is the whole reason this exists. Anything
          you do not nail goes into the review queue.
        </Muted>

        <Label>pick your decks</Label>
        <div className="rf-decks">
          {DOMAINS.map((d) => {
            const on = picked.has(d.id);
            const n = RAPID.filter((r) => r.domain === d.id).length;
            return (
              <button key={d.id} className="press rf-deck" data-on={on ? "1" : undefined} onClick={() => toggle(d.id)}
                style={on ? { borderColor: H(d.hue).line, background: H(d.hue).bg } : undefined}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ color: H(d.hue).fg, fontWeight: 700, fontSize: "var(--fs-sm)" }}>{d.label}</span>
                  <div style={{ flex: 1 }} />
                  <Mono dim>{n}</Mono>
                </div>
                <div className="rf-deck-note">{d.note}</div>
              </button>
            );
          })}
        </div>

        <div className="row" style={{ marginTop: "var(--sp-5)", gap: "var(--sp-3)" }}>
          <Button hue="accent" onClick={() => { setI(0); setStage(0); setTally({ got: 0, shaky: 0, missed: 0 }); setSeed(Date.now() % 100000); setRunning(true); }}>
            ▶ Start · {deck.length} questions
          </Button>
          {seen > 0 && <Mono dim>{seen} answered before</Mono>}
        </div>
      </div>
    );
  }

  /* ── finished ───────────────────────────────────────────────────────── */
  if (!card) {
    const total = tally.got + tally.shaky + tally.missed;
    return (
      <div className="pane-pad pane-narrow">
        <H1>Deck finished</H1>
        <div className="rf-score">
          {[["got", "nailed it", "ok"], ["shaky", "shaky", "warn"], ["missed", "missed", "bad"]].map(([k, label, hue]) => (
            <div key={k} className="rf-score-cell" style={{ borderColor: H(hue).line, background: H(hue).bg }}>
              <div className="rf-score-n" style={{ color: H(hue).fg }}>{tally[k]}</div>
              <div className="rf-score-l">{label}</div>
            </div>
          ))}
        </div>
        <Muted style={{ marginTop: "var(--sp-4)", maxWidth: "62ch" }}>
          {tally.got === total
            ? "Everything nailed. Widen the decks or come back when the review queue is due — recall you never lose is recall you are not testing."
            : `The ${tally.shaky + tally.missed} you did not nail are in the review queue and will come back at the interval that makes them stick.`}
        </Muted>
        <div className="row" style={{ marginTop: "var(--sp-5)", gap: "var(--sp-3)" }}>
          <Button hue="accent" onClick={() => { setI(0); setStage(0); setTally({ got: 0, shaky: 0, missed: 0 }); setSeed(Date.now() % 100000); }}>Run it again, reshuffled</Button>
          <Button onClick={() => setRunning(false)}>Change decks</Button>
        </div>
      </div>
    );
  }

  /* ── the card ───────────────────────────────────────────────────────── */
  const dom = DOMAINS.find((d) => d.id === card.domain);
  return (
    <div className="rf-stage">
      <div className="rf-bar">
        <Mono dim>{i + 1} / {deck.length}</Mono>
        <div className="rf-bar-track"><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>
        <Tag hue={dom?.hue}>{dom?.label}</Tag>
        <Mono dim>{DIFF[card.d]}</Mono>
        <div style={{ flex: 1 }} />
        <button className="press btn-sm" onClick={() => setRunning(false)}>end</button>
      </div>

      <div className="rf-card" key={card.id}>
        <p className="rf-q">{card.q}</p>

        {stage === 0 && (
          <div className="rf-prompt anim-fade">
            <Muted>Say your answer out loud. Then reveal.</Muted>
            <Button hue="accent" onClick={() => setStage(1)}>Reveal answer <kbd className="mono">space</kbd></Button>
          </div>
        )}

        {stage >= 1 && (
          <div className="rf-answer anim-riseSm">
            <Label hue={dom?.hue}>the answer</Label>
            <p>{card.a}</p>
          </div>
        )}

        {stage === 1 && (
          <div className="rf-prompt anim-fade">
            <Button onClick={() => setStage(2)}>Show where most people come apart <kbd className="mono">space</kbd></Button>
          </div>
        )}

        {stage >= 2 && (
          <div className="rf-edge anim-riseSm">
            <Label hue="warn">where most people come apart</Label>
            <p>{card.edge}</p>
          </div>
        )}

        {stage >= 1 && (
          <div className="rf-rate anim-fade">
            <Label>how did you do?</Label>
            <div className="rf-rate-row">
              <button className="press rf-rate-btn" data-k="got" onClick={() => rate("got")}>nailed it <kbd className="mono">1</kbd></button>
              <button className="press rf-rate-btn" data-k="shaky" onClick={() => rate("shaky")}>shaky <kbd className="mono">2</kbd></button>
              <button className="press rf-rate-btn" data-k="missed" onClick={() => rate("missed")}>missed <kbd className="mono">3</kbd></button>
            </div>
            <Muted style={{ fontSize: "var(--fs-micro)", marginTop: 8 }}>
              Anything but &ldquo;nailed it&rdquo; goes to the review queue.
            </Muted>
          </div>
        )}
      </div>

      {deck.length === 0 && <Empty icon="◇" title="No questions">Pick at least one deck.</Empty>}
    </div>
  );
}
