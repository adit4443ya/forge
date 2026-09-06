/* ════════════════════════════════════════════════════════════════════════════
   MENTAL MATH — generated, not a fixed bank, so it never runs out.

   Scoped honestly: timed arithmetic is a screen on the TRADING track at some
   market-making firms. It is not part of a software-engineering loop, and at
   least one firm states publicly that it does not ask engineers for it. It is
   here because it is cheap to practise and occasionally asked, not because it
   is on the critical path — see the note the drill shows before you start.

   Every generator returns { q, a, why } where `why` is the technique, because
   drilling arithmetic without the method just makes you slower more confidently.
   ════════════════════════════════════════════════════════════════════════════ */

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];
const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const MM_KINDS = [
  {
    id: "mult2", label: "Two-digit products", hue: "accent",
    gen(rng) {
      const a = ri(rng, 11, 99), b = ri(rng, 11, 99);
      const base = Math.round(b / 10) * 10;
      return {
        q: `${a} × ${b}`,
        a: a * b,
        why: `Round one factor to something easy, then correct. ${b} = ${base} ${b - base >= 0 ? "+" : "−"} ${Math.abs(b - base)}, ` +
             `so ${a}×${b} = ${a}×${base} ${b - base >= 0 ? "+" : "−"} ${a}×${Math.abs(b - base)} = ${a * base} ${b - base >= 0 ? "+" : "−"} ${a * Math.abs(b - base)} = ${a * b}.`,
      };
    },
  },
  {
    id: "pct", label: "Percentages", hue: "ok",
    gen(rng) {
      const p = pick(rng, [5, 12, 15, 18, 25, 35, 40, 60, 75, 85]);
      const n = ri(rng, 3, 40) * 20;
      return {
        q: `${p}% of ${n}`,
        a: round((p * n) / 100),
        why: `Decompose the percentage. ${p}% = ${p >= 50 ? `50% + ${p - 50}%` : `${Math.floor(p / 10) * 10}% + ${p % 10}%`}. ` +
             `10% of ${n} is ${n / 10}, 1% is ${n / 100}, and 50% is ${n / 2}. Build ${p}% from those and add.`,
      };
    },
  },
  {
    id: "frac", label: "Fractions to decimals", hue: "info",
    gen(rng) {
      const d = pick(rng, [3, 6, 7, 8, 9, 11, 12, 16]);
      const n = ri(rng, 1, d - 1);
      return {
        q: `${n}/${d} as a decimal (3 dp)`,
        a: round(n / d, 3),
        why: `Know the repeating families: 1/3 = .333, 1/6 = .1667, 1/7 = .142857 repeating, 1/8 = .125, ` +
             `1/9 = .111, 1/11 = .0909, 1/12 = .0833, 1/16 = .0625. ${n}/${d} is ${n} × (1/${d}) = ${round(n / d, 4)}.`,
      };
    },
  },
  {
    id: "sq", label: "Squares and roots", hue: "warn",
    gen(rng) {
      if (rng() < 0.5) {
        const a = ri(rng, 25, 99);
        const near = Math.round(a / 10) * 10;
        const d = a - near;
        return {
          q: `${a}²`,
          a: a * a,
          why: `(n ± d)² = n² ± 2nd + d². Here n = ${near}, d = ${Math.abs(d)}: ` +
               `${near}² = ${near * near}, 2·${near}·${Math.abs(d)} = ${2 * near * Math.abs(d)}, ${Math.abs(d)}² = ${d * d}. ` +
               `So ${near * near} ${d >= 0 ? "+" : "−"} ${2 * near * Math.abs(d)} + ${d * d} = ${a * a}.`,
        };
      }
      const n = ri(rng, 200, 9800);
      return {
        q: `√${n} to one decimal`,
        a: round(Math.sqrt(n), 1),
        why: `Bracket it between squares you know, then refine once with Newton: x₁ = (x₀ + n/x₀)/2. ` +
             `Starting near ${Math.floor(Math.sqrt(n))}, one step lands within a tenth. Answer ${round(Math.sqrt(n), 2)}.`,
      };
    },
  },
  {
    id: "ev", label: "Expected value", hue: "bad",
    gen(rng) {
      const k = ri(rng, 2, 5);
      const outs = Array.from({ length: k }, () => ri(rng, -20, 40));
      const ws = Array.from({ length: k }, () => ri(rng, 1, 6));
      const tot = ws.reduce((a, b) => a + b, 0);
      const ev = outs.reduce((a, o, i) => a + o * ws[i], 0) / tot;
      return {
        q: `Payoffs ${outs.join(", ")} with weights ${ws.join(", ")}. Expected value to 2 dp?`,
        a: round(ev),
        why: `Weighted mean: Σ(payoff × weight) ÷ Σweight = ${outs.map((o, i) => `${o}×${ws[i]}`).join(" + ")} = ` +
             `${outs.reduce((a, o, i) => a + o * ws[i], 0)}, over ${tot}, giving ${round(ev)}. ` +
             `Sanity check: it must lie between ${Math.min(...outs)} and ${Math.max(...outs)}.`,
      };
    },
  },
  {
    id: "odds", label: "Odds and probability", hue: "info",
    gen(rng) {
      if (rng() < 0.5) {
        const a = ri(rng, 1, 9), b = ri(rng, 1, 12);
        return {
          q: `Odds of ${a}:${b} against. Implied probability, as a percentage to 1 dp?`,
          a: round((b / (a + b)) * 100, 1),
          why: `Odds a:b against means b wins out of a+b trials, so p = ${b}/(${a}+${b}) = ${round(b / (a + b), 4)} = ${round((b / (a + b)) * 100, 1)}%. ` +
               `Going the other way, p → odds is (1−p):p.`,
        };
      }
      const p = pick(rng, [10, 20, 25, 30, 40, 60, 75, 80]);
      const n = ri(rng, 2, 4);
      return {
        q: `${p}% chance each trial, ${n} independent trials. Probability of at least one success, to 1 dp?`,
        a: round((1 - (1 - p / 100) ** n) * 100, 1),
        why: `Complement. P(none) = ${round(1 - p / 100, 2)}^${n} = ${round((1 - p / 100) ** n, 4)}, so at least one is ` +
             `1 − that = ${round((1 - (1 - p / 100) ** n) * 100, 1)}%. "At least one" is almost always the complement.`,
        };
    },
  },
  {
    id: "compound", label: "Compounding and log-scale", hue: "accent",
    gen(rng) {
      const r = pick(rng, [2, 3, 5, 7, 8, 10, 12]);
      const y = ri(rng, 3, 25);
      return {
        q: `${r}% a year for ${y} years. Growth multiple, to 2 dp?`,
        a: round((1 + r / 100) ** y),
        why: `Rule of 72: doubling takes about 72/${r} ≈ ${round(72 / r, 1)} years, so ${y} years is about ` +
             `${round(y / (72 / r), 2)} doublings → 2^${round(y / (72 / r), 2)} ≈ ${round(2 ** (y / (72 / r)), 2)}. ` +
             `Exact is ${round((1 + r / 100) ** y, 3)} — the rule is good to a few percent for small rates.`,
      };
    },
  },
];

/* Deterministic generator so a session can be replayed and scored the same. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function generate(kindIds, count, seed) {
  const rng = makeRng(seed);
  const kinds = MM_KINDS.filter((k) => kindIds.includes(k.id));
  if (!kinds.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const k = kinds[i % kinds.length];
    return { ...k.gen(rng), kind: k.id, label: k.label, hue: k.hue, n: i };
  });
}

/* Exact for integers. For decimals the slack is half a unit in the last place
   the question asked for — the standard rounding tolerance — so 52.7 is not
   accepted for 52.6, and a genuinely different number never scores. */
export function correct(given, want) {
  const g = parseFloat(String(given).replace(/[, ]/g, ""));
  if (!Number.isFinite(g)) return false;
  if (Number.isInteger(want)) return g === want;
  const dp = (String(want).split(".")[1] || "").length;
  return Math.abs(g - want) <= 0.5 * 10 ** -dp + 1e-9;
}
