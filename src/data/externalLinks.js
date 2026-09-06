// ════════════════════════════════════════════════════════════════════
//  External practice sets.
//
//  Two layers:
//   1. PER PROBLEM — a direct LeetCode link, keyed by the LeetCode number
//      (the number is the stable identity; titles in this bank are edited).
//   2. PER PATTERN — curated sets on the judges that quant / HFT / Google
//      candidates actually train on. Pattern links point at LISTS, not single
//      problems, so they stay correct as those sites add material.
//
//  Judges, and why each is here:
//    LeetCode    the interview lingua franca; pattern coverage, easy grading
//    CSES        https://cses.fi/problemset/ — the standard set. Harder than
//                LeetCode, no hints, exact-output judging. The set most often
//                named by people preparing for trading-firm loops.
//    Codeforces  timed contests; where speed under pressure is built
//    NeetCode    a curated 150-problem pattern spine over LeetCode
//    Project Euler  number theory / math, the quant-flavoured warm-up
//    AtCoder     clean, well-tested problem statements; DP contest is a classic
// ════════════════════════════════════════════════════════════════════

export const JUDGES = {
  leetcode:    { name: "LeetCode",     home: "https://leetcode.com/problemset/",       color: "warn",  note: "interview lingua franca" },
  cses:        { name: "CSES",         home: "https://cses.fi/problemset/",            color: "ok",    note: "the standard set; harder, no hints" },
  codeforces:  { name: "Codeforces",   home: "https://codeforces.com/problemset",      color: "info",  note: "timed contests, speed under pressure" },
  neetcode:    { name: "NeetCode",     home: "https://neetcode.io/practice",           color: "accent",note: "curated pattern spine over LeetCode" },
  euler:       { name: "Project Euler",home: "https://projecteuler.net/archives",      color: "info",  note: "number theory, quant-flavoured" },
  atcoder:     { name: "AtCoder",      home: "https://atcoder.jp/contests/dp/tasks",   color: "ok",    note: "the Educational DP contest" },
};

/* LeetCode number → slug. The number is the identity; these were checked
   against the canonical problem titles. Anything missing falls back to a
   search URL, which always resolves. */
export const LC_SLUG = {
  3: "longest-substring-without-repeating-characters", 4: "median-of-two-sorted-arrays", 5: "longest-palindromic-substring",
  10: "regular-expression-matching", 11: "container-with-most-water", 15: "3sum", 20: "valid-parentheses",
  23: "merge-k-sorted-lists", 33: "search-in-rotated-sorted-array", 36: "valid-sudoku", 39: "combination-sum",
  42: "trapping-rain-water", 44: "wildcard-matching", 45: "jump-game-ii", 49: "group-anagrams", 50: "powx-n",
  51: "n-queens", 54: "spiral-matrix", 55: "jump-game", 56: "merge-intervals", 62: "unique-paths",
  72: "edit-distance", 75: "sort-colors", 76: "minimum-window-substring", 84: "largest-rectangle-in-histogram",
  98: "validate-binary-search-tree", 102: "binary-tree-level-order-traversal", 426: "convert-binary-search-tree-to-sorted-doubly-linked-list", 543: "diameter-of-binary-tree", 105: "construct-binary-tree-from-preorder-and-inorder-traversal",
  124: "binary-tree-maximum-path-sum", 127: "word-ladder", 133: "clone-graph", 134: "gas-station",
  137: "single-number-ii", 138: "copy-list-with-random-pointer", 139: "word-break", 141: "linked-list-cycle",
  143: "reorder-list", 146: "lru-cache", 198: "house-robber", 200: "number-of-islands", 206: "reverse-linked-list",
  207: "course-schedule", 208: "implement-trie-prefix-tree", 212: "word-search-ii", 215: "kth-largest-element-in-an-array",
  227: "basic-calculator-ii", 236: "lowest-common-ancestor-of-a-binary-tree", 238: "product-of-array-except-self",
  239: "sliding-window-maximum", 253: "meeting-rooms-ii", 269: "alien-dictionary", 295: "find-median-from-data-stream",
  300: "longest-increasing-subsequence", 307: "range-sum-query-mutable", 312: "burst-balloons",
  315: "count-of-smaller-numbers-after-self", 322: "coin-change", 323: "number-of-connected-components-in-an-undirected-graph",
  340: "longest-substring-with-at-most-k-distinct-characters", 341: "flatten-nested-list-iterator",
  347: "top-k-frequent-elements", 371: "sum-of-two-integers", 394: "decode-string", 416: "partition-equal-subset-sum",
  417: "pacific-atlantic-water-flow", 424: "longest-repeating-character-replacement", 435: "non-overlapping-intervals",
  442: "find-all-duplicates-in-an-array", 460: "lfu-cache", 494: "target-sum", 502: "ipo", 516: "longest-palindromic-subsequence",
  518: "coin-change-ii", 528: "random-pick-with-weight", 547: "number-of-provinces", 560: "subarray-sum-equals-k",
  567: "permutation-in-string", 621: "task-scheduler", 739: "daily-temperatures", 743: "network-delay-time",
  787: "cheapest-flights-within-k-stops", 846: "hand-of-straights", 847: "shortest-path-visiting-all-nodes",
  875: "koko-eating-bananas", 877: "stone-game", 981: "time-based-key-value-store", 994: "rotting-oranges",
  1004: "max-consecutive-ones-iii", 1049: "last-stone-weight-ii", 1143: "longest-common-subsequence",
  1192: "critical-connections-in-a-network",
  1334: "find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance",
  1584: "min-cost-to-connect-all-points",
  48: "rotate-image", 218: "the-skyline-problem", 224: "basic-calculator", 284: "peeking-iterator",
  289: "game-of-life", 338: "counting-bits", 346: "moving-average-from-data-stream", 359: "logger-rate-limiter",
  641: "design-circular-deque", 732: "my-calendar-iii", 772: "basic-calculator-iii",
  28: "find-the-index-of-the-first-occurrence-in-a-string", 459: "repeated-substring-pattern",
  480: "sliding-window-median", 587: "erect-the-fence", 1044: "longest-duplicate-substring",
  85: "maximal-rectangle", 410: "split-array-largest-sum",
};

export function leetcodeUrl(num, title = "") {
  if (!num) return null;
  const slug = LC_SLUG[num];
  return slug ? `https://leetcode.com/problems/${slug}/`
              : `https://leetcode.com/problemset/?search=${encodeURIComponent(title || String(num))}`;
}

/* Pattern → curated sets elsewhere. `section` values come from dsaData.jsx.
   Every URL is a stable list or category page, not a single problem. */
export const PATTERN_SETS = {
  "Sliding Window": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/", note: "sliding-window and two-pointer block" },
    { judge: "neetcode", label: "NeetCode · Sliding Window", url: "https://neetcode.io/practice", note: "6 problems, in order" },
    { judge: "codeforces", label: "CF · two pointers", url: "https://codeforces.com/problemset?tags=two+pointers", note: "rated 1200-1700 first" },
  ],
  "Two Pointers": [
    { judge: "neetcode", label: "NeetCode · Two Pointers", url: "https://neetcode.io/practice" },
    { judge: "codeforces", label: "CF · two pointers", url: "https://codeforces.com/problemset?tags=two+pointers" },
  ],
  "Monotonic Stack": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/", note: "Nearest Smaller Values is the canonical drill" },
    { judge: "codeforces", label: "CF · data structures", url: "https://codeforces.com/problemset?tags=data+structures" },
  ],
  "Stack": [{ judge: "neetcode", label: "NeetCode · Stack", url: "https://neetcode.io/practice" }],
  "Prefix Sums": [
    { judge: "cses", label: "CSES · Range Queries", url: "https://cses.fi/problemset/list/", note: "static and dynamic range sums" },
    { judge: "codeforces", label: "CF · dp + prefix sums", url: "https://codeforces.com/problemset?tags=dp" },
  ],
  "HashMap": [{ judge: "neetcode", label: "NeetCode · Arrays & Hashing", url: "https://neetcode.io/practice" }],
  "Array": [{ judge: "neetcode", label: "NeetCode · Arrays & Hashing", url: "https://neetcode.io/practice" }],
  "Sorting": [{ judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/" }],
  "Quickselect": [{ judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/" }],
  "Binary Search": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/", note: "Factory Machines, Array Division" },
    { judge: "codeforces", label: "CF · binary search", url: "https://codeforces.com/problemset?tags=binary+search" },
  ],
  "Heap": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/" },
    { judge: "neetcode", label: "NeetCode · Heap / Priority Queue", url: "https://neetcode.io/practice" },
  ],
  "Trees": [
    { judge: "cses", label: "CSES · Tree Algorithms", url: "https://cses.fi/problemset/list/", note: "the whole section is worth doing" },
    { judge: "neetcode", label: "NeetCode · Trees", url: "https://neetcode.io/practice" },
  ],
  "Trie": [{ judge: "neetcode", label: "NeetCode · Tries", url: "https://neetcode.io/practice" }],
  "Backtracking": [
    { judge: "neetcode", label: "NeetCode · Backtracking", url: "https://neetcode.io/practice" },
    { judge: "codeforces", label: "CF · brute force", url: "https://codeforces.com/problemset?tags=brute+force" },
  ],
  "Linked List": [{ judge: "neetcode", label: "NeetCode · Linked List", url: "https://neetcode.io/practice" }],
  "Greedy": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/", note: "Tasks and Deadlines, Movie Festival" },
    { judge: "codeforces", label: "CF · greedy", url: "https://codeforces.com/problemset?tags=greedy", note: "the largest tag on CF; start at 1200" },
  ],
  "Intervals": [
    { judge: "cses", label: "CSES · Sorting and Searching", url: "https://cses.fi/problemset/list/", note: "Restaurant Customers, Movie Festival II" },
    { judge: "codeforces", label: "CF · sortings", url: "https://codeforces.com/problemset?tags=sortings" },
  ],
  "Matrix": [{ judge: "neetcode", label: "NeetCode · Arrays & Hashing", url: "https://neetcode.io/practice" }],
  "String Parsing": [
    { judge: "codeforces", label: "CF · expression parsing", url: "https://codeforces.com/problemset?tags=expression+parsing" },
    { judge: "cses", label: "CSES · String Algorithms", url: "https://cses.fi/problemset/list/" },
  ],
  "Design": [
    { judge: "neetcode", label: "NeetCode · Design questions", url: "https://neetcode.io/practice" },
    { judge: "cses", label: "CSES · Range Queries", url: "https://cses.fi/problemset/list/", note: "the data-structure half of design" },
  ],
  "Randomized": [
    { judge: "euler", label: "Project Euler · archives", url: "https://projecteuler.net/archives", note: "probability-flavoured problems" },
  ],
  "HFT Structures": [
    { judge: "cses", label: "CSES · Range Queries", url: "https://cses.fi/problemset/list/", note: "the structures a book/feed handler needs" },
  ],
  "Math": [
    { judge: "euler", label: "Project Euler · archives", url: "https://projecteuler.net/archives", note: "start at problem 1 and go in order" },
    { judge: "cses", label: "CSES · Mathematics", url: "https://cses.fi/problemset/list/" },
  ],
  "Bit Manipulation": [
    { judge: "cses", label: "CSES · Bitwise / Introductory", url: "https://cses.fi/problemset/list/" },
    { judge: "codeforces", label: "CF · bitmasks", url: "https://codeforces.com/problemset?tags=bitmasks" },
  ],
  "Segment Tree": [
    { judge: "cses", label: "CSES · Range Queries", url: "https://cses.fi/problemset/list/", note: "the definitive segment-tree ladder" },
    { judge: "codeforces", label: "CF · data structures", url: "https://codeforces.com/problemset?tags=data+structures" },
  ],
  "System Design DSA": [{ judge: "neetcode", label: "NeetCode · Design", url: "https://neetcode.io/practice" }],
};

/* DP and Graph sections share sets; matched by prefix. */
const PREFIX_SETS = [
  ["DP —", [
    { judge: "atcoder", label: "AtCoder · Educational DP Contest", url: "https://atcoder.jp/contests/dp/tasks", note: "26 problems A-Z; the best DP ladder there is" },
    { judge: "cses", label: "CSES · Dynamic Programming", url: "https://cses.fi/problemset/list/", note: "19 problems, increasing difficulty" },
    { judge: "codeforces", label: "CF · dp", url: "https://codeforces.com/problemset?tags=dp" },
  ]],
  ["Graph —", [
    { judge: "cses", label: "CSES · Graph Algorithms", url: "https://cses.fi/problemset/list/", note: "36 problems; do the whole section" },
    { judge: "neetcode", label: "NeetCode · Graphs + Advanced Graphs", url: "https://neetcode.io/practice" },
    { judge: "codeforces", label: "CF · graphs", url: "https://codeforces.com/problemset?tags=graphs" },
  ]],
];

export function setsForSection(section = "") {
  if (PATTERN_SETS[section]) return PATTERN_SETS[section];
  const hit = PREFIX_SETS.find(([p]) => section.startsWith(p));
  return hit ? hit[1] : [];
}

/* Ladders shown on the Practice screen: "when this bank runs out, go here." */
export const LADDERS = [
  { id: "cses", name: "CSES Problem Set", url: "https://cses.fi/problemset/", count: "300+",
    who: "HFT / quant loops", why: "Standard problems, exact-output judging, no hints and no discussion tab. The set that most reliably exposes gaps: if you can finish Sorting and Searching plus Dynamic Programming plus Graph Algorithms, a trading-firm coding round holds no surprises." },
  { id: "neetcode", name: "NeetCode 150", url: "https://neetcode.io/practice", count: "150",
    who: "Google-style loops", why: "A curated spine over LeetCode covering every pattern a generalist loop draws from, in a sensible order. Use it to check pattern coverage, not to grind volume." },
  { id: "codeforces", name: "Codeforces", url: "https://codeforces.com/problemset", count: "9000+",
    who: "speed and pressure", why: "Rated problems and live contests. Div 2 A-C at rating 1200-1700 builds the thing no static bank can: correct code, fast, with a clock running and no editorial." },
  { id: "atcoder", name: "AtCoder Educational DP", url: "https://atcoder.jp/contests/dp/tasks", count: "26",
    who: "anyone weak at DP", why: "Twenty-six problems, A to Z, each isolating one DP idea. Finishing it converts DP from a topic you fear into a technique you apply." },
  { id: "euler", name: "Project Euler", url: "https://projecteuler.net/archives", count: "900+",
    who: "quant tracks", why: "Number theory, combinatorics and probability wearing a programming costume. The closest public analogue to the mathematical half of a quant screen." },
];
