/* ════════════════════════════════════════════════════════════════════════════
   MARKET-MAKING GAME — "make me a market."

   The classic market-making exercise: an unknown quantity, you quote a
   two-sided price, the interviewer trades against you, information arrives,
   and you requote. It is scored on four things a candidate can control:

     1. Is your mid near your honest expectation?
     2. Is your width proportional to your uncertainty?
     3. Do you SKEW when you are carrying inventory?
     4. Do you update on information rather than anchoring on your last quote?

   The counterparty here is deliberately informed: it trades only when your
   quote is wrong relative to fair value. That is not unfair, it is the point —
   every fill you get is adverse, which is the lesson the exercise teaches.

   Scoped honestly: this is a TRADING-track exercise, not a software one. It is
   here because it is the fastest way to feel adverse selection rather than
   read about it.
   ════════════════════════════════════════════════════════════════════════════ */

export const SCENARIOS = [
  {
    id: "dice2",
    title: "The sum of two dice",
    setup: "I roll two fair six-sided dice. Make me a market on their sum.",
    fair: () => {
      const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
      return { value: a + b, parts: [a, b] };
    },
    prior: { mean: 7, sd: 2.42 },
    reveals: [
      { at: 1, text: (s) => `The first die is a ${s.parts[0]}.`, posterior: (s) => ({ mean: s.parts[0] + 3.5, sd: 1.71 }) },
      { at: 2, text: (s) => `The second die is a ${s.parts[1]}.`, posterior: (s) => ({ mean: s.value, sd: 0 }) },
    ],
    teach: "Your opening market should be centred on 7 — the expectation — with a width reflecting a standard deviation of about 2.4. After the first die you know the mean exactly and the remaining uncertainty is one die, so the width should roughly halve.",
  },
  {
    id: "coins",
    title: "Heads in twenty flips",
    setup: "I flip a fair coin twenty times. Make me a market on the number of heads.",
    fair: () => {
      let h = 0, first10 = 0;
      for (let i = 0; i < 20; i++) { const f = Math.random() < 0.5 ? 1 : 0; h += f; if (i < 10) first10 += f; }
      return { value: h, parts: [first10] };
    },
    prior: { mean: 10, sd: 2.24 },
    reveals: [
      { at: 1, text: (s) => `The first ten flips gave ${s.parts[0]} heads.`, posterior: (s) => ({ mean: s.parts[0] + 5, sd: 1.58 }) },
      { at: 2, text: () => "All twenty are done.", posterior: (s) => ({ mean: s.value, sd: 0 }) },
    ],
    teach: "Binomial(20, ½): mean 10, standard deviation √(20·¼) ≈ 2.24. Halfway through, the resolved half contributes no variance, so your uncertainty drops by a factor of √2, not by half.",
  },
  {
    id: "cards",
    title: "The card you draw",
    setup: "I draw one card from a standard deck. Ace is 1, face cards are 10. Make me a market on its value.",
    fair: () => {
      const r = 1 + Math.floor(Math.random() * 13);
      return { value: Math.min(r, 10), parts: [r] };
    },
    prior: { mean: 6.54, sd: 3.2 },
    reveals: [
      { at: 1, text: (s) => `It is ${s.parts[0] >= 10 ? "a ten or a face card" : s.parts[0] <= 5 ? "five or below" : "between six and nine"}.`,
        posterior: (s) => (s.parts[0] >= 10 ? { mean: 10, sd: 0 } : s.parts[0] <= 5 ? { mean: 3, sd: 1.4 } : { mean: 7.5, sd: 1.1 }) },
      { at: 2, text: (s) => `It is a ${s.parts[0] === 1 ? "ace" : s.parts[0] > 10 ? ["jack", "queen", "king"][s.parts[0] - 11] : s.parts[0]}.`,
        posterior: (s) => ({ mean: s.value, sd: 0 }) },
    ],
    teach: "Four of the thirteen ranks are worth 10, which drags the mean above the naive 5.5 to about 6.5. Noticing a lumpy distribution before quoting is the whole skill here — a symmetric market around 5.5 is already losing.",
  },
  {
    id: "temp",
    title: "An estimate you have to reason to",
    setup: "Make me a market on the number of piano tuners in a city of five million.",
    fair: () => ({ value: 40 + Math.floor(Math.random() * 80), parts: [] }),
    prior: { mean: 80, sd: 45 },
    reveals: [
      { at: 1, text: () => "Roughly one household in fifty owns a piano that gets tuned.", posterior: () => ({ mean: 75, sd: 25 }) },
      { at: 2, text: (s) => `The answer is ${s.value}.`, posterior: (s) => ({ mean: s.value, sd: 0 }) },
    ],
    teach: "When your uncertainty is a factor of two rather than a few percent, your market must be wide — a tight market on a quantity you cannot pin down is not confidence, it is a gift to the person trading against you.",
  },
];

/* The counterparty trades only when your quote is wrong relative to fair value.
   Every fill you receive is therefore adverse: that is the lesson. */
export function counterparty(bid, ask, fairMean, size = 1) {
  if (ask <= fairMean) return { side: "lift", price: ask, qty: size };   // your ask is cheap: they buy
  if (bid >= fairMean) return { side: "hit", price: bid, qty: size };    // your bid is rich: they sell
  return null;                                                            // your market straddles fair: no trade
}

export function grade(rounds, trueValue) {
  const filled = rounds.filter((r) => r.trade);
  const position = filled.reduce((a, r) => a + (r.trade.side === "lift" ? -r.trade.qty : r.trade.qty), 0);
  const cash = filled.reduce((a, r) => a + (r.trade.side === "lift" ? r.trade.price * r.trade.qty : -r.trade.price * r.trade.qty), 0);
  const pnl = cash + position * trueValue;

  const widths = rounds.map((r) => r.ask - r.bid);
  const centring = rounds.map((r) => Math.abs((r.bid + r.ask) / 2 - r.fairMean));
  const avgWidth = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
  const avgOff = centring.reduce((a, b) => a + b, 0) / (centring.length || 1);

  /* Did the quote skew away from the side that would grow an existing position? */
  let skewed = 0, chances = 0;
  for (let i = 1; i < rounds.length; i++) {
    const before = rounds.slice(0, i).filter((r) => r.trade)
      .reduce((a, r) => a + (r.trade.side === "lift" ? -r.trade.qty : r.trade.qty), 0);
    if (before === 0) continue;
    chances++;
    const mid = (rounds[i].bid + rounds[i].ask) / 2;
    // long inventory → mid should sit below fair (keener to sell); short → above
    if ((before > 0 && mid < rounds[i].fairMean) || (before < 0 && mid > rounds[i].fairMean)) skewed++;
  }

  return { pnl, position, cash, avgWidth, avgOff, skewed, chances, fills: filled.length };
}
