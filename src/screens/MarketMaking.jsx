"use client";
import { useMemo, useState } from "react";
import { hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted, H1, Button, Note, Tag } from "@/ui/kit.jsx";
import { SCENARIOS, counterparty, grade } from "@/data/marketmaking.js";
import { progressStore } from "@/lib/progress/store.js";

/* "Make me a market." You quote two-sided, an informed counterparty trades
   against you only when your quote is wrong, information arrives, you requote.
   Every fill is adverse — that is the lesson, not a bug in the simulation. */

const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

export default function MarketMaking() {
  const [scenario, setScenario] = useState(null);
  const [state, setState] = useState(null);       // { fair, round, rounds, revealed }
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [done, setDone] = useState(false);

  const begin = (sc) => {
    setScenario(sc);
    setState({ fair: sc.fair(), round: 0, rounds: [], revealed: [] });
    setBid(""); setAsk(""); setDone(false);
  };

  const post = () => {
    const b = parseFloat(bid), a = parseFloat(ask);
    if (!Number.isFinite(b) || !Number.isFinite(a) || a <= b) return;
    const belief = state.round === 0
      ? scenario.prior
      : scenario.reveals[state.round - 1].posterior(state.fair);
    const trade = counterparty(b, a, belief.mean);
    const rounds = [...state.rounds, { bid: b, ask: a, fairMean: belief.mean, sd: belief.sd, trade }];
    const nextRound = state.round + 1;
    const reveal = scenario.reveals[state.round];
    const revealed = reveal ? [...state.revealed, reveal.text(state.fair)] : state.revealed;

    if (nextRound > scenario.reveals.length) {
      setState({ ...state, rounds, revealed });
      setDone(true);
      const g = grade(rounds, state.fair.value);
      progressStore.setNote(`mmk:${scenario.id}`, `pnl ${n2(g.pnl)} · ${g.fills} fills`);
    } else {
      setState({ ...state, round: nextRound, rounds, revealed });
      setBid(""); setAsk("");
    }
  };

  const result = useMemo(
    () => (done && state ? grade(state.rounds, state.fair.value) : null),
    [done, state]
  );

  /* ── pick a scenario ────────────────────────────────────────────────── */
  if (!scenario) {
    return (
      <div className="pane-pad pane-narrow">
        <H1>Make me a market</H1>
        <Note hue="warn" title="what this is for">
          A <strong>trading</strong>-track exercise, not a software one. It is here because it is the fastest way to feel adverse
          selection instead of reading about it: the counterparty trades only when your quote is wrong, so every fill you get is
          one you did not want.
        </Note>
        <div className="mk-rules">
          {[
            ["Centre", "Your mid should sit on your honest expectation. Not where you hope, where you believe."],
            ["Width", "Wide when uncertain, tight when you know. A tight market on a quantity you cannot pin down is a gift."],
            ["Skew", "Carrying a long? Move your whole market down so the flow unwinds you. Inventory is risk, not profit."],
            ["Update", "New information means a new market. Anchoring on your last quote is how you get run over."],
          ].map(([t, d]) => (
            <div key={t} className="mk-rule"><strong>{t}</strong><span>{d}</span></div>
          ))}
        </div>
        <Label style={{ display: "block", marginTop: "var(--sp-5)" }}>pick a scenario</Label>
        <div className="rf-decks">
          {SCENARIOS.map((s) => (
            <button key={s.id} className="press rf-deck" data-on="1" onClick={() => begin(s)}>
              <span style={{ color: "var(--tk-accent)", fontWeight: 700, fontSize: "var(--fs-sm)" }}>{s.title}</span>
              <div className="rf-deck-note">{s.setup}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── the game ───────────────────────────────────────────────────────── */
  const position = state.rounds.filter((r) => r.trade)
    .reduce((a, r) => a + (r.trade.side === "lift" ? -r.trade.qty : r.trade.qty), 0);

  return (
    <div className="pane-pad pane-narrow">
      <div className="row" style={{ gap: 10, marginBottom: "var(--sp-4)" }}>
        <button className="press btn-sm" onClick={() => setScenario(null)}>← scenarios</button>
        <Mono dim>{scenario.title}</Mono>
        <div style={{ flex: 1 }} />
        {position !== 0 && (
          <Tag hue={position > 0 ? "ok" : "bad"}>{position > 0 ? `long ${position}` : `short ${-position}`}</Tag>
        )}
      </div>

      <p className="mk-setup">{scenario.setup}</p>

      {state.revealed.map((r, i) => (
        <div key={i} className="mk-reveal anim-riseSm"><Label hue="info">new information</Label><span>{r}</span></div>
      ))}

      {state.rounds.length > 0 && (
        <div className="mk-log">
          {state.rounds.map((r, i) => (
            <div key={i} className="mk-log-row">
              <Mono dim>round {i + 1}</Mono>
              <Mono>{n2(r.bid)} / {n2(r.ask)}</Mono>
              <span className="mk-log-out" data-hit={r.trade ? "1" : undefined}>
                {r.trade
                  ? r.trade.side === "lift"
                    ? `they bought at your ${n2(r.trade.price)} — you are short`
                    : `they sold at your ${n2(r.trade.price)} — you are long`
                  : "no trade — your market straddled fair"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!done && (
        <div className="mk-quote">
          <Label hue="accent">your market</Label>
          <div className="mk-quote-row">
            <label><span>bid</span><input className="mm-input mk-input" value={bid} inputMode="decimal"
              onChange={(e) => setBid(e.target.value)} placeholder="buy at" /></label>
            <span className="mk-at">/</span>
            <label><span>ask</span><input className="mm-input mk-input" value={ask} inputMode="decimal"
              onChange={(e) => setAsk(e.target.value)} placeholder="sell at" /></label>
            <Button hue="accent" onClick={post}
              disabled={!(parseFloat(ask) > parseFloat(bid))}>
              {parseFloat(ask) > parseFloat(bid) ? "Post it" : "ask must exceed bid"}
            </Button>
          </div>
          {bid && ask && parseFloat(ask) > parseFloat(bid) && (
            <Mono dim>mid {n2((parseFloat(bid) + parseFloat(ask)) / 2)} · width {n2(parseFloat(ask) - parseFloat(bid))}</Mono>
          )}
        </div>
      )}

      {done && result && (
        <div className="anim-riseSm">
          <div className="mk-result" data-good={result.pnl >= 0 ? "1" : undefined}>
            <div>
              <Label>true value</Label><span className="mk-big">{state.fair.value}</span>
            </div>
            <div>
              <Label>your P&L</Label>
              <span className="mk-big" style={{ color: result.pnl >= 0 ? "var(--tk-ok)" : "var(--tk-bad)" }}>
                {result.pnl >= 0 ? "+" : ""}{n2(result.pnl)}
              </span>
            </div>
            <div><Label>fills</Label><span className="mk-big">{result.fills}</span></div>
            <div><Label>final position</Label><span className="mk-big">{result.position}</span></div>
          </div>

          <div className="mk-feedback">
            <Label hue="accent">how you quoted</Label>
            <ul>
              <li>
                <strong>Centring.</strong> Your mid was off fair by {n2(result.avgOff)} on average.
                {result.avgOff < 0.6 ? " That is well centred — you were quoting your belief." : " That is a real bias; a mid away from your expectation gives away edge before anyone trades."}
              </li>
              <li>
                <strong>Width.</strong> You averaged {n2(result.avgWidth)}.
                {result.fills === 0
                  ? " Nothing traded, so the market was wide enough to be safe — and wide enough that nobody wanted it. A market maker who never fills earns nothing."
                  : result.avgWidth < 1.5 ? " Tight. Tight markets fill often, and every fill here is adverse — that is why the P&L moves against you."
                  : " Reasonably wide, which is right when the uncertainty is large."}
              </li>
              <li>
                <strong>Skew.</strong> {result.chances === 0
                  ? "You never carried inventory into a requote, so there was nothing to skew."
                  : `You had inventory going into ${result.chances} requote${result.chances > 1 ? "s" : ""} and skewed away from it ${result.skewed} time${result.skewed === 1 ? "" : "s"}. ` +
                    (result.skewed === result.chances ? "That is exactly right — you moved the market to unwind." : "Skewing when long or short is how a maker keeps inventory near zero.")}
              </li>
            </ul>
          </div>

          <Note hue="info" title="the point of this scenario">{scenario.teach}</Note>

          <div className="row" style={{ marginTop: "var(--sp-4)", gap: "var(--sp-3)" }}>
            <Button hue="accent" onClick={() => begin(scenario)}>Play again</Button>
            <Button onClick={() => setScenario(null)}>Another scenario</Button>
          </div>
        </div>
      )}
    </div>
  );
}
