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
