"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, H1, Button, Note } from "@/ui/kit.jsx";
import { MM_KINDS, generate, correct } from "@/data/mentalmath.js";
import { progressStore } from "@/lib/progress/store.js";

/* Timed arithmetic. Scoped honestly in the note below: this is a trading-track
   screen, not a software one. Every answer shows the TECHNIQUE, because
   drilling arithmetic without the method makes you slower more confidently. */

const LENGTHS = [{ n: 10, s: 120 }, { n: 20, s: 240 }, { n: 30, s: 300 }];

export default function MentalMath() {
  const [kinds, setKinds] = useState(() => new Set(MM_KINDS.map((k) => k.id)));
  const [len, setLen] = useState(LENGTHS[0]);
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [entry, setEntry] = useState("");
  const [log, setLog] = useState([]);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const inputRef = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setLeft((t) => (t <= 1 ? (setRunning(false), 0) : t - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    setDeck(generate([...kinds], len.n, (Date.now() & 0x7fffffff) || 1));
    setI(0); setLog([]); setEntry(""); setLeft(len.s); setRunning(true);
    startedAt.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const submit = useCallback(() => {
    const card = deck[i];
    if (!card) return;
    const ok = correct(entry, card.a);
    /* Read the clock EAGERLY. A state updater is called lazily by React, so
       computing the elapsed time inside it would run after the reset below and
       measure zero for every question. */
    const now = Date.now();
    const ms = now - startedAt.current;
    startedAt.current = now;
    setLog((l) => [...l, { ...card, given: entry, ok, ms }]);
    setEntry("");
    if (i + 1 >= deck.length) setRunning(false); else setI(i + 1);
  }, [deck, i, entry]);

  /* Record the run so it shows up as work done, not just a number on screen. */
  useEffect(() => {
    if (running || !log.length) return;
    const right = log.filter((l) => l.ok).length;
    progressStore.setNote(`mm:${new Date().toISOString().slice(0, 16)}`, `${right}/${log.length}`);
  }, [running, log]);

  const toggle = (id) => setKinds((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n.size ? n : s;
  });

  /* ── setup ─────────────────────────────────────────────────────────── */
  if (!running && !log.length) {
    return (
      <div className="pane-pad pane-narrow">
        <H1>Mental math</H1>
        <Note hue="warn" title="what this is for">
          Timed arithmetic is a screen on the <strong>trading</strong> track at some market-making firms. It is not part of a
          software-engineering loop — at least one firm says publicly it does not ask engineers for it. Drill it because it is
          cheap and occasionally asked, not because it is on your critical path.
        </Note>
        <Label style={{ display: "block", marginTop: "var(--sp-5)" }}>what to drill</Label>
        <div className="rf-decks">
          {MM_KINDS.map((k) => {
            const on = kinds.has(k.id);
            return (
              <button key={k.id} className="press rf-deck" data-on={on ? "1" : undefined} onClick={() => toggle(k.id)}
                style={on ? { borderColor: H(k.hue).line, background: H(k.hue).bg } : undefined}>
                <span style={{ color: H(k.hue).fg, fontWeight: 700, fontSize: "var(--fs-sm)" }}>{k.label}</span>
              </button>
            );
          })}
        </div>
        <Label style={{ display: "block", marginTop: "var(--sp-5)" }}>how long</Label>
        <div className="row" style={{ marginTop: 8 }}>
          {LENGTHS.map((l) => (
            <Button key={l.n} hue={l === len ? "accent" : "neutral"} onClick={() => setLen(l)}>
              {l.n} questions · {l.s / 60} min
            </Button>
          ))}
        </div>
        <div style={{ marginTop: "var(--sp-5)" }}><Button hue="accent" onClick={start}>▶ Start</Button></div>
      </div>
    );
  }

  /* ── results ───────────────────────────────────────────────────────── */
  if (!running) {
    const right = log.filter((l) => l.ok).length;
    const avg = log.length ? (log.reduce((a, l) => a + l.ms, 0) / log.length / 1000).toFixed(1) : "0.0";
    return (
      <div className="pane-pad pane-narrow">
        <H1>{right} / {log.length}</H1>
        <div className="row" style={{ gap: "var(--sp-5)", marginTop: 10 }}>
          <Mono dim>{avg}s average</Mono>
          <Mono dim>{Math.round((right / (log.length || 1)) * 100)}% correct</Mono>
        </div>
        <Muted style={{ margin: "var(--sp-4) 0", maxWidth: "64ch" }}>
          Speed without the method plateaus fast. Read the technique on anything you missed — that is the part that transfers.
        </Muted>
        <div className="mm-results">
          {log.map((l, n) => (
            <div key={n} className="mm-result" data-ok={l.ok ? "1" : undefined}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="mm-result-q">{l.q}</span>
                <div style={{ flex: 1 }} />
                <Mono dim>{(l.ms / 1000).toFixed(1)}s</Mono>
                <Mono style={{ color: l.ok ? "var(--tk-ok)" : "var(--tk-bad)" }}>
                  {l.ok ? "✓" : `${l.given || "—"} ≠ ${l.a}`}
                </Mono>
              </div>
              {!l.ok && <div className="mm-why">{l.why}</div>}
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: "var(--sp-5)", gap: "var(--sp-3)" }}>
          <Button hue="accent" onClick={start}>Run another</Button>
          <Button onClick={() => { setLog([]); }}>Change settings</Button>
        </div>
      </div>
    );
  }

  /* ── running ───────────────────────────────────────────────────────── */
  const card = deck[i];
  const low = left <= 20;
  return (
    <div className="rf-stage">
      <div className="rf-bar">
        <Mono dim>{i + 1} / {deck.length}</Mono>
        <div className="rf-bar-track"><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>
        <Mono style={{ color: low ? "var(--tk-bad)" : undefined }}>
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </Mono>
        <Mono dim>{log.filter((l) => l.ok).length} right</Mono>
        <div style={{ flex: 1 }} />
        <button className="press btn-sm" onClick={() => setRunning(false)}>end</button>
      </div>
      <div className="mm-stage">
        <div className="mm-q">{card?.q}</div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input ref={inputRef} className="mm-input" value={entry} inputMode="decimal" autoComplete="off"
            onChange={(e) => setEntry(e.target.value)} placeholder="answer, then enter" />
        </form>
        <Muted style={{ fontSize: "var(--fs-micro)", marginTop: 12 }}>enter to submit · no calculator, no paper</Muted>
      </div>
    </div>
  );
}
