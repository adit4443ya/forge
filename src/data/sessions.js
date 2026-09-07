// ════════════════════════════════════════════════════════════════════
//  SESSION MODEL — what "Today" runs.
//
//  A session is an ordered list of steps with a mode. The mode decides how
//  much of a problem you are allowed to see:
//
//    DRILL  timed gates. Hints unlock on a clock. The default.
//    STUDY  everything revealable immediately. For revision and for reading
//           a solution you have already earned.
//    MOCK   nothing but the statement until the timer ends, then self-score.
//
//  The mode is recorded on every attempt, so "solved in STUDY" never counts
//  as "solved in MOCK" on the dashboard or in the review scheduler.
// ════════════════════════════════════════════════════════════════════

export const MODES = {
  drill: {
    id: "drill", name: "Drill", icon: "◈",
    blurb: "Timed gates. Hints unlock on a clock; the solution unlocks last.",
    detail: "The default for building recall. You can always unlock early, and the attempt records that you did.",
    gates: { hint1: 0.20, hint2: 0.35, approach: 0.50, solution: 0.80 },   // fraction of the budget
    allowEarly: true,
  },
  study: {
    id: "study", name: "Study", icon: "◇",
    blurb: "Everything revealable now. Timer runs but gates nothing.",
    detail: "For revising a problem you have solved before, or for reading a solution deliberately.",
    gates: null,
    allowEarly: true,
  },
  mock: {
    id: "mock", name: "Mock", icon: "◆",
    blurb: "Statement only until the timer ends. Then a full self-score.",
    detail: "Interview conditions. No hints, no unlocking, no exceptions. This is the mode the dashboard's readiness number trusts.",
    gates: { hint1: 1, hint2: 1, approach: 1, solution: 1 },
    allowEarly: false,
  },
};
export const MODE_LIST = [MODES.drill, MODES.study, MODES.mock];

/* Session templates. `slots` are filled by Today from the review queue,
   the curriculum tier you are on, and the current phase's lab track. */
export const SESSION_TEMPLATES = [
  {
    id: "A", name: "Coding", minutes: 100, mode: "drill", icon: "⌨",
    purpose: "Pattern recall under a clock. The one session you never skip.",
    steps: [
      { kind: "review", minutes: 10, label: "Review queue", detail: "Answer out loud before revealing. Rate honestly." },
      { kind: "problem", minutes: 25, label: "Problem 1", detail: "From the tier you are on. State the invariant before you type." },
      { kind: "problem", minutes: 35, label: "Problem 2", detail: "One tier up. Narrate the whole time." },
      { kind: "log", minutes: 15, label: "Mistake log", detail: "What went wrong, in one line. It becomes a review card." },
    ],
  },
  {
    id: "B", name: "Lab", minutes: 100, mode: "study", icon: "⌬",
    purpose: "Evidence. You leave with numbers you produced and can defend.",
    steps: [
      { kind: "lab", minutes: 85, label: "Run the lab", detail: "Follow the STEP commands. Compare your output to the pasted output." },
      { kind: "note", minutes: 15, label: "Evidence note", detail: "Five lines: claim, evidence, surprise. The surprise line is not optional." },
    ],
  },
  {
    id: "C", name: "Depth", minutes: 70, mode: "study", icon: "◫",
    purpose: "Turn reading into recall. Speaking is the whole point.",
    steps: [
      { kind: "guide", minutes: 35, label: "One guide section", detail: "One section, not one guide. Stop and explain it to the wall." },
      { kind: "flash", minutes: 20, label: "Ten questions aloud", detail: "From the competency you are building. Out loud or it does not count." },
      { kind: "drill", minutes: 15, label: "One systems drill", detail: "A bug hunt, an output quiz, or a C++ concept." },
    ],
  },
  {
    id: "D", name: "Mock", minutes: 60, mode: "mock", icon: "◉",
    purpose: "Interview conditions. The only measurement the readiness number trusts.",
    steps: [
      { kind: "mock", minutes: 60, label: "Full mock", detail: "Pick a format. Clock on, out loud, no help, self-score at the end." },
    ],
  },
];
/* ── what a session becomes for each role ─────────────────────────────────
   The shape (a coding session, a lab session, a depth session, a mock) is the
   same everywhere because the discipline is. What changes is the content of
   each step and what a step is FOR, because the days genuinely differ: a
   compiler engineer spends theirs reducing and reading IR, a systems engineer
   measuring, an HFT engineer arguing about a cache line and a memory order.

   Only steps that actually differ are overridden; anything not listed here
   keeps the base wording. */
export const ROLE_SESSIONS = {
  compiler: {
    A: {
      purpose: "Coding rounds are real for compiler loops too — the generalist algorithmic kind especially. This is the session that keeps that half sharp.",
      steps: {
        1: { detail: "From your tier. Compiler loops favour graphs, trees and parsing — state the invariant before you type." },
        2: { detail: "One tier up. Narrate it. The bar is explaining the transformation, not just passing the tests." },
        3: { detail: "One line per mistake. If it was a wrong data structure, say which one you should have reached for." },
      },
    },
    B: {
      purpose: "The IR and pipeline tracks. You leave able to say which pass did what, with the dump to prove it.",
      steps: {
        0: { label: "Run the lab", detail: "Prefer the ir/, cross_level/ or codegen/ tracks. Read the IR before and after and name the transformation." },
        1: { detail: "Claim, evidence, surprise. For a compiler lab the evidence is a dump or a diff, not a wall-clock number." },
      },
    },
    C: {
      purpose: "Read one pass or one mechanism until you can draw it. Depth here is what separates a compiler hire.",
      steps: {
        0: { label: "One section of an LLVM guide", detail: "SSA, the pass manager, instruction selection or register allocation. One section, then explain it to the wall." },
        1: { label: "Ten compiler questions aloud", detail: "From the compilers or architecture deck in Rapid fire. Out loud or it does not count." },
        2: { label: "One output quiz or bug hunt", detail: "Undefined behaviour and the optimizer, ideally — the ones where -O0 and -O2 disagree." },
      },
    },
    D: { purpose: "Interview conditions. For a compiler loop that means a coding round AND a 'walk me through what this pass did' round." },
  },

  systems: {
    A: {
      purpose: "Keep the coding bar sharp while the rest of your week is measurement.",
      steps: {
        1: { detail: "From your tier. Favour array, matrix and heap work — the shapes that show up when you are counting things fast." },
        3: { detail: "One line per mistake. Note whether the failure was the algorithm or the constant factor." },
      },
    },
    B: {
      purpose: "The measurement tracks. You leave with a number, a counter that explains it, and a spread you can defend.",
      steps: {
        0: { label: "Run the lab", detail: "Prefer perf/, cache/ or systems/. Pin first, warm up, and report min/p50/p99 — never a single number." },
        1: { detail: "Claim, evidence, surprise. The evidence is the counter that explains the number, not the number alone." },
      },
    },
    C: {
      purpose: "Read one mechanism until you can predict what the counter will say before you run it.",
      steps: {
        0: { label: "One section on the machine", detail: "The microarchitecture guide, the Linux one, or the performance playbook. One section, then explain it." },
        1: { label: "Ten systems questions aloud", detail: "From the systems or architecture deck. Say the mechanism, then the measurement that would prove it." },
        2: { label: "One estimation chain", detail: "Write the assumptions down before revealing. Estimating is how you decide what to measure." },
      },
    },
    D: { purpose: "Interview conditions. For a systems loop that means a coding round and a 'this is slow, find out why' round." },
  },

  hft: {
    A: {
      purpose: "The coding bar here is the same as any strong loop, with less tolerance for hand-waving about cost.",
      steps: {
        1: { detail: "From your tier. Say the complexity AND the constant — what it allocates, what it touches, how many cache lines." },
        2: { detail: "One tier up. Narrate it, and be ready for 'now make it allocation-free'." },
        3: { detail: "One line per mistake. Note anything that would have been unacceptable on a hot path." },
      },
    },
    B: {
      purpose: "The concurrency, cache and syscall tracks. You leave with a latency distribution and an argument about its tail.",
      steps: {
        0: { label: "Run the lab", detail: "Prefer concurrency/, cache/ or systems/. Report p99.9, not the mean — the tail is the product." },
        1: { detail: "Claim, evidence, surprise. For a latency lab the evidence is the distribution and where the tail came from." },
      },
    },
    C: {
      purpose: "Alternate the two halves: the machine, and what the market is doing to you.",
      steps: {
        0: { label: "One section: low latency or microstructure", detail: "The Linux, networking or system-design guide, or the microstructure module. One section, then explain it." },
        1: { label: "Ten questions aloud", detail: "From the HFT, C++ or probability decks. Adverse selection and memory ordering are the two they push hardest on." },
        2: { label: "One estimation or a market-making round", detail: "Estimation for the numbers, Make a market for the feel of being picked off." },
      },
    },
    D: { purpose: "Interview conditions. For an HFT loop that means coding, a C++/systems fundamentals round, and often a probability one." },
  },
};

/** A template rewritten for a role. Falls back to the base template unchanged. */
export function templateForRole(template, roleId) {
  const o = ROLE_SESSIONS[roleId]?.[template.id];
  if (!o) return template;
  return {
    ...template,
    purpose: o.purpose || template.purpose,
    steps: template.steps.map((st, i) => (o.steps?.[i] ? { ...st, ...o.steps[i] } : st)),
  };
}

export const TEMPLATE_BY_ID = Object.fromEntries(SESSION_TEMPLATES.map((t) => [t.id, t]));

/* Which session to suggest, from what you have already done this week. */
export function suggestSession(sessionsThisWeek = []) {
  const done = sessionsThisWeek.map((s) => s.kind);
  const order = ["A", "B", "C", "A", "D"];
  for (const id of order) {
    const target = order.filter((x) => x === id).length;
    if (done.filter((x) => x === id).length < target) return TEMPLATE_BY_ID[id];
  }
  return TEMPLATE_BY_ID.A;
}

/* Time budget for one problem, by tier, in seconds. */
export const TIER_BUDGET = [20 * 60, 30 * 60, 40 * 60, 45 * 60];

/* Gate schedule for a problem: { stage: unlockSeconds }. */
export function gateSchedule(modeId, budgetSeconds) {
  const mode = MODES[modeId] || MODES.drill;
  if (!mode.gates) return null;
  return Object.fromEntries(Object.entries(mode.gates).map(([k, f]) => [k, Math.round(f * budgetSeconds)]));
}
export const STAGES = [
  { id: "hint1",    label: "Hint 1",   note: "the smallest nudge: what to look at" },
  { id: "hint2",    label: "Hint 2",   note: "the key insight, still not the method" },
  { id: "approach", label: "Approach", note: "the steps, no code" },
  { id: "solution", label: "Solution", note: "code, complexity, and why" },
];
