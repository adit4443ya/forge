// ════════════════════════════════════════════════════════════════════
//  DSA curriculum — an ORDER over the existing problem bank (dsaData.jsx),
//  not more problems. Four tiers; each tier is meant to be solved TWICE under
//  time before moving on. Time budgets are per problem, out loud, no AI.
//  Ids refer to PROBLEMS[].id. Validated at build time by scripts/check-curriculum.mjs.
// ════════════════════════════════════════════════════════════════════

export const TIERS = [
  {
    id: 0, name: "Warm-up: hashing, two pointers, stack", budgetMin: 20,
    why: "Fluency. These should feel like typing. If any takes >20 min, that pattern goes to the review queue.",
    groups: [
      { pattern: "HashMap",       ids: [62, 63, 64, 65] },
      { pattern: "Stack / list",  ids: [56, 54] },
      { pattern: "Two pointers",  ids: [68, 93, 43, 59] },
      { pattern: "Prefix sums",   ids: [37, 38] },
      { pattern: "Matrix",        ids: [99, 108] },
    ],
  },
  {
    id: 1, name: "Core patterns", budgetMin: 30,
    why: "The patterns that cover most of a generalist coding loop. Know the template cold, then the variations.",
    groups: [
      { pattern: "Sliding window",  ids: [30, 33, 34, 67] },
      { pattern: "Binary search",   ids: [44, 74] },
      { pattern: "Linked list",     ids: [53, 55] },
      { pattern: "Trees",           ids: [50, 49, 48, 78, 79] },
      { pattern: "Monotonic stack", ids: [94, 72] },
      { pattern: "Heap",            ids: [88, 46] },
      { pattern: "Greedy",          ids: [40, 39, 76] },
      { pattern: "Graph BFS/DFS",   ids: [18, 19, 21] },
      { pattern: "Topological sort",ids: [23, 80] },
      { pattern: "Union-Find",      ids: [27, 97] },
      { pattern: "Trie",            ids: [57] },
      { pattern: "Backtracking",    ids: [51, 92] },
      { pattern: "DP foundations",  ids: [1, 3, 15, 16, 17, 7, 11] },
      { pattern: "Intervals",       ids: [98] },
      { pattern: "Design (basic)",  ids: [103, 111] },
      { pattern: "Matrix simulation",  ids: [109] },
      { pattern: "Bits & number theory", ids: [115, 116] },
    ],
  },
  {
    id: 2, name: "Interview-grade", budgetMin: 40,
    why: "Hard mediums and standard hards. Explain the invariant before coding; write the proof-of-correctness sentence.",
    groups: [
      { pattern: "Sliding window (hard)",  ids: [31, 32, 66] },
      { pattern: "Monotonic stack (hard)", ids: [35, 36] },
      { pattern: "Graphs",                 ids: [20, 22, 24, 25, 95, 29] },
      { pattern: "Trees / recursion",      ids: [47, 84, 77, 81] },
      { pattern: "Design",                 ids: [58] },
      { pattern: "Binary search (hard)",   ids: [90] },
      { pattern: "DP: strings",            ids: [6, 8, 9, 10] },
      { pattern: "DP: knapsack & games",   ids: [4, 2, 5, 12] },
      { pattern: "Greedy (hard)",          ids: [41, 96, 70, 75] },
      { pattern: "Selection & math",       ids: [89, 85, 86, 87] },
      { pattern: "String parsing",         ids: [100, 110] },
      { pattern: "Design (iterator, LFU)", ids: [101, 102, 112] },
      { pattern: "Sweep line (hard)",     ids: [106] },
      { pattern: "Randomized",             ids: [104] },
      { pattern: "HFT structures",         ids: [105, 117] },
    ],
  },
  {
    id: 3, name: "Hard and rare", budgetMin: 45,
    why: "Low frequency, high signal. Do these once each after tier 2 is solid; revisit only the ones that failed.",
    groups: [
      { pattern: "Interval DP",     ids: [91] },
      { pattern: "Bitmask DP",      ids: [14] },
      { pattern: "All-pairs / MST", ids: [26, 28] },
      { pattern: "Heap (hard)",     ids: [61] },
      { pattern: "Segment tree",    ids: [82, 83] },
      { pattern: "Interval counts", ids: [107] },
      { pattern: "Design (hard)",   ids: [113, 114] },
      { pattern: "Timer wheel",     ids: [118] },
      { pattern: "String algorithms", ids: [119, 120] },
      { pattern: "Sliding median",   ids: [121] },
      { pattern: "Geometry",         ids: [122] },
    ],
  },
];

// Patterns a strong generalist loop can touch that the bank does not yet
// cover well. Ids 98-118 filled the earlier gaps (sweep line, interval counts,
// matrix simulation, parsing, iterator/rate-limiter design, consistent hashing,
// LRU+TTL, bit idioms, ring buffer, timer wheel, KMP/Z/hashing, sliding
// median, geometry). These are the next problems to WRITE (with full solutions),
// not links to external sites.
export const GAPS = [
  "Suffix automaton / suffix array as a coding question (currently only KMP, Z and hashing)",
  "Persistent and offline data structures (merge-sort tree, wavelet tree)",
  "Flow and matching (Dinic, Hungarian) — rare in these loops, high ceiling",
];

export const ALL_TIER_IDS = TIERS.flatMap((t) => t.groups.flatMap((g) => g.ids));
export function tierOf(id) { return TIERS.find((t) => t.groups.some((g) => g.ids.includes(id))) || null; }
