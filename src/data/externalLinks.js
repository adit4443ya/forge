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
/* ── practice sets, by section ────────────────────────────────────────────
   Exact problems, never a list page. Every CSES id below was verified by
   fetching the task and reading its title; every LeetCode slug was resolved
   against the judge's API. scripts/check-links.mjs re-checks both. */
const CSES = (id, title, note) => ({ judge: "cses", id, title, note, url: `https://cses.fi/problemset/task/${id}` });

export const PATTERN_SETS = {
  "Sliding Window": [
    CSES(1141, "Playlist", "longest window with distinct values"),
    CSES(1076, "Sliding Window Median", "the two-heap version, under a time limit"),
    CSES(1660, "Subarray Sums I", "the positive-only case, two pointers"),
  ],
  "Two Pointers": [
    CSES(1640, "Sum of Two Values", "the canonical two-pointer setup"),
    CSES(1642, "Sum of Four Values", "the same idea one level up"),
    CSES(1090, "Ferris Wheel", "greedy pairing from both ends"),
  ],
  "Monotonic Stack": [
    CSES(1645, "Nearest Smaller Values", "the monotonic stack, stated plainly"),
    CSES(1073, "Towers", "the multiset variant people reach for a stack on"),
  ],
  "Stack": [CSES(1645, "Nearest Smaller Values", "previous smaller element in one pass")],
  "Prefix Sums": [
    CSES(1662, "Subarray Divisibility", "prefix sums modulo n"),
    CSES(1661, "Subarray Sums II", "prefix sum plus a hash map, negatives allowed"),
    CSES(2166, "Prefix Sum Queries", "when the prefix has to be maintained"),
  ],
  "HashMap": [
    CSES(1621, "Distinct Numbers", "the warm-up"),
    CSES(1661, "Subarray Sums II", "counting prefixes with a map"),
  ],
  "Array": [CSES(1094, "Increasing Array", "one greedy pass"), CSES(1074, "Stick Lengths", "the median minimises absolute deviation")],
  "Sorting": [CSES(1091, "Concert Tickets", "a multiset and an upper bound"), CSES(1084, "Apartments", "two sorted streams")],
  "Quickselect": [CSES(1074, "Stick Lengths", "the answer is the median")],
  "Binary Search": [
    CSES(1620, "Factory Machines", "binary search on the answer, the clearest example there is"),
    CSES(1085, "Array Division", "minimise the maximum subarray sum"),
  ],
  "Heap": [CSES(1091, "Concert Tickets", "a multiset standing in for a heap"), CSES(1076, "Sliding Window Median", "two heaps, or an ordered multiset")],
  "Trees": [CSES(1132, "Tree Distances I", "rerooting"), CSES(1130, "Tree Matching", "DP on a tree")],
  "Tree": [CSES(1130, "Tree Matching", "the simplest tree DP that is not obvious")],
  "Trie": [CSES(1731, "Word Combinations", "a trie or a hash over the dictionary")],
  "Backtracking": [CSES(1624, "Chessboard and Queens", "pruned backtracking"), CSES(1622, "Creating Strings", "enumerate permutations")],
  "Linked List": [CSES(1197, "Cycle Finding", "Floyd's on a functional graph")],
  "Greedy": [CSES(1084, "Apartments", "the exchange argument in miniature"), CSES(1073, "Towers"), CSES(1163, "Traffic Lights", "a set and the interval it splits")],
  "Intervals": [CSES(1619, "Restaurant Customers", "the sweep, stated as simply as possible"), CSES(1163, "Traffic Lights")],
  "Matrix": [CSES(1193, "Labyrinth", "BFS on a grid with the path reconstructed"), CSES(1192, "Counting Rooms", "flood fill")],
  "String Parsing": [CSES(1732, "Finding Borders", "the failure function, by another name"), CSES(1110, "Minimal Rotation", "Booth's algorithm or a hash")],
  "Design": [CSES(1648, "Dynamic Range Sum Queries", "the structure behind most design answers"), CSES(2166, "Prefix Sum Queries")],
  "Randomized": [CSES(1618, "Trailing Zeros", "counting rather than simulating")],
  "HFT Structures": [
    CSES(1648, "Dynamic Range Sum Queries", "a segment tree, which is the book in disguise"),
    CSES(1649, "Dynamic Range Minimum Queries", "the same structure, different monoid"),
  ],
  "Math": [CSES(1618, "Trailing Zeros"), CSES(1075, "Counting Permutations", "derangements")],
  "Bit Manipulation": [CSES(1188, "Bit Inversions", "a set over positions"), CSES(1623, "Apple Division", "subset enumeration by bitmask")],
  "Segment Tree": [
    CSES(1648, "Dynamic Range Sum Queries", "build it once, properly"),
    CSES(1649, "Dynamic Range Minimum Queries"),
    CSES(1652, "Forest Queries", "2-D prefix sums first"),
  ],
  "System Design DSA": [CSES(1750, "Planets Queries I", "binary lifting"), CSES(2143, "Reachability Queries", "the offline structure")],
  "Graph — BFS": [CSES(1193, "Labyrinth"), CSES(1667, "Message Route", "shortest path with the route printed")],
  "Graph — Shortest Path": [CSES(1671, "Shortest Routes I", "Dijkstra"), CSES(1672, "Shortest Routes II", "Floyd-Warshall"), CSES(1673, "High Score", "Bellman-Ford with a negative cycle")],
  "Graph — Topo Sort": [CSES(1679, "Course Schedule", "topological order or report a cycle"), CSES(1202, "Investigation", "shortest path plus counting")],
  "Graph — Union Find": [CSES(1666, "Building Roads", "components with DSU"), CSES(1675, "Road Reparation", "Kruskal")],
  "Graph — MST": [CSES(1675, "Road Reparation", "Kruskal or Prim")],
  "Graph — Tarjan": [CSES(1683, "Planets and Kingdoms", "strongly connected components"), CSES(1682, "Flight Routes Check")],
  "Graph": [CSES(1192, "Counting Rooms"), CSES(1666, "Building Roads")],
  "DP — Knapsack": [CSES(1158, "Book Shop", "0/1 knapsack, no disguise"), CSES(1745, "Money Sums", "reachable subset sums")],
  "DP — Sequence": [CSES(1145, "Increasing Subsequence", "LIS in n log n"), CSES(1746, "Array Description")],
  "DP — String": [CSES(1639, "Edit Distance", "the two-string table")],
  "DP — Interval / Game": [CSES(1097, "Removal Game", "interval DP"), CSES(1099, "Stair Game", "game theory")],
  "DP — Bitmask": [CSES(1653, "Elevator Rides", "bitmask over people, two-field state"), CSES(1690, "Hamiltonian Flights", "bitmask over visited nodes")],
};

/** Exact problems for a section, or an empty list. Never a search or a list page. */
export function setsForSection(section) {
  if (!section) return [];
  if (PATTERN_SETS[section]) return PATTERN_SETS[section];
  for (const [prefix, set] of Object.entries(PREFIX_SETS || {})) {
    if (section.startsWith(prefix)) return set;
  }
  return [];
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

/* ── named problems that are NOT in the local bank ────────────────────────
   Every reference in the pattern library and the cheat sheets resolves to an
   exact problem page, never a search or a list. Each slug below was verified
   against LeetCode's GraphQL API — the id, canonical title and difficulty came
   back from that call, so a renamed or removed problem shows up as a failure
   in scripts/check-links.mjs rather than as a dead chip in the UI.
   `paid: true` means the problem is behind LeetCode Premium; the UI says so
   rather than sending someone to a paywall unannounced. */
export const EXTERNAL_PROBLEMS = {
  "Combination Sum IV": { slug: "combination-sum-iv", id: 377, title: "Combination Sum IV", difficulty: "Medium" },
  "LCS": { slug: "longest-common-subsequence", id: 1143, title: "Longest Common Subsequence", difficulty: "Medium" },
  "Regex Matching": { slug: "regular-expression-matching", id: 10, title: "Regular Expression Matching", difficulty: "Hard" },
  "LPS": { slug: "longest-palindromic-subsequence", id: 516, title: "Longest Palindromic Subsequence", difficulty: "Medium" },
  "Matrix Chain Multiplication": { slug: "burst-balloons", id: 312, title: "Burst Balloons", difficulty: "Hard" },
  "Shortest Path All Nodes": { slug: "shortest-path-visiting-all-nodes", id: 847, title: "Shortest Path Visiting All Nodes", difficulty: "Hard" },
  "Can I Win": { slug: "can-i-win", id: 464, title: "Can I Win", difficulty: "Medium" },
  "Sticker Problem": { slug: "stickers-to-spell-word", id: 691, title: "Stickers to Spell Word", difficulty: "Hard" },
  "01 Matrix": { slug: "01-matrix", id: 542, title: "01 Matrix", difficulty: "Medium" },
  "Network Delay Time": { slug: "network-delay-time", id: 743, title: "Network Delay Time", difficulty: "Medium" },
  "Path with Max Probability": { slug: "path-with-maximum-probability", id: 1514, title: "Path with Maximum Probability", difficulty: "Medium" },
  "Cheapest Flights K Stops": { slug: "cheapest-flights-within-k-stops", id: 787, title: "Cheapest Flights Within K Stops", difficulty: "Medium" },
  "Negative Cycle Detection": { judge: "cses", url: "https://cses.fi/problemset/task/1197", title: "Cycle Finding" },
  "Redundant Connection": { slug: "redundant-connection", id: 684, title: "Redundant Connection", difficulty: "Medium" },
  "Number of Provinces": { slug: "number-of-provinces", id: 547, title: "Number of Provinces", difficulty: "Medium" },
  "MST (Kruskal)": { slug: "min-cost-to-connect-all-points", id: 1584, title: "Min Cost to Connect All Points", difficulty: "Medium" },
  "Min Window Substring": { slug: "minimum-window-substring", id: 76, title: "Minimum Window Substring", difficulty: "Hard" },
  "Longest No-Repeat": { slug: "longest-substring-without-repeating-characters", id: 3, title: "Longest Substring Without Repeating Characters", difficulty: "Medium" },
  "Subarray Sum = K": { slug: "subarray-sum-equals-k", id: 560, title: "Subarray Sum Equals K", difficulty: "Medium" },
  "XOR Queries": { slug: "xor-queries-of-a-subarray", id: 1310, title: "XOR Queries of a Subarray", difficulty: "Medium" },
  "Continuous Subarray Sum": { slug: "continuous-subarray-sum", id: 523, title: "Continuous Subarray Sum", difficulty: "Medium" },
  "Min Days to Bloom": { slug: "minimum-number-of-days-to-make-m-bouquets", id: 1482, title: "Minimum Number of Days to Make m Bouquets", difficulty: "Medium" },
  "Split Array Largest Sum": { slug: "split-array-largest-sum", id: 410, title: "Split Array Largest Sum", difficulty: "Hard" },
  "Median Data Stream": { slug: "find-median-from-data-stream", id: 295, title: "Find Median from Data Stream", difficulty: "Hard" },
  "Linked List Cycle": { slug: "linked-list-cycle", id: 141, title: "Linked List Cycle", difficulty: "Easy" },
  "Find the Duplicate Number": { slug: "find-the-duplicate-number", id: 287, title: "Find the Duplicate Number", difficulty: "Medium" },
  "Middle of the Linked List": { slug: "middle-of-the-linked-list", id: 876, title: "Middle of the Linked List", difficulty: "Easy" },
  "Palindrome Partitioning": { slug: "palindrome-partitioning", id: 131, title: "Palindrome Partitioning", difficulty: "Medium" },
  "Maximum XOR of Two Numbers in an Array": { slug: "maximum-xor-of-two-numbers-in-an-array", id: 421, title: "Maximum XOR of Two Numbers in an Array", difficulty: "Medium" },
  "Corporate Flight Bookings": { slug: "corporate-flight-bookings", id: 1109, title: "Corporate Flight Bookings", difficulty: "Medium" },
  "My Calendar III": { slug: "my-calendar-iii", id: 732, title: "My Calendar III", difficulty: "Hard" },
  "Car Pooling": { slug: "car-pooling", id: 1094, title: "Car Pooling", difficulty: "Medium" },
  "Shortest Subarray with Sum at Least K": { slug: "shortest-subarray-with-sum-at-least-k", id: 862, title: "Shortest Subarray with Sum at Least K", difficulty: "Hard" },
  "Jump Game VI": { slug: "jump-game-vi", id: 1696, title: "Jump Game VI", difficulty: "Medium" },
  "Capacity To Ship Packages": { slug: "capacity-to-ship-packages-within-d-days", id: 1011, title: "Capacity To Ship Packages Within D Days", difficulty: "Medium" },
  "Minimize Max Distance to Gas Station": { slug: "minimize-max-distance-to-gas-station", id: 774, title: "Minimize Max Distance to Gas Station", difficulty: "Hard", paid: true },
  "Maximal Rectangle": { slug: "maximal-rectangle", id: 85, title: "Maximal Rectangle", difficulty: "Hard" },
  "Maximum Sum Rectangle": { slug: "max-sum-of-rectangle-no-larger-than-k", id: 363, title: "Max Sum of Rectangle No Larger Than K", difficulty: "Hard" },
  "Count Submatrices With All Ones": { slug: "count-submatrices-with-all-ones", id: 1504, title: "Count Submatrices With All Ones", difficulty: "Medium" },
  "K Closest Points to Origin": { slug: "k-closest-points-to-origin", id: 973, title: "K Closest Points to Origin", difficulty: "Medium" },
  "Employee Free Time": { slug: "employee-free-time", id: 759, title: "Employee Free Time", difficulty: "Hard", paid: true },
  "Rectangle Area II": { slug: "rectangle-area-ii", id: 850, title: "Rectangle Area II", difficulty: "Hard" },
  "Maximum Subarray": { slug: "maximum-subarray", id: 53, title: "Maximum Subarray", difficulty: "Medium" },
  "Maximum Product Subarray": { slug: "maximum-product-subarray", id: 152, title: "Maximum Product Subarray", difficulty: "Medium" },
  "Maximum Sum Circular Subarray": { slug: "maximum-sum-circular-subarray", id: 918, title: "Maximum Sum Circular Subarray", difficulty: "Medium" },
  "Best Time to Buy and Sell Stock": { slug: "best-time-to-buy-and-sell-stock", id: 121, title: "Best Time to Buy and Sell Stock", difficulty: "Easy" },
  "Best Time to Buy and Sell Stock with Cooldown": { slug: "best-time-to-buy-and-sell-stock-with-cooldown", id: 309, title: "Best Time to Buy and Sell Stock with Cooldown", difficulty: "Medium" },
  "Best Time to Buy and Sell Stock III": { slug: "best-time-to-buy-and-sell-stock-iii", id: 123, title: "Best Time to Buy and Sell Stock III", difficulty: "Hard" },
  "House Robber II": { slug: "house-robber-ii", id: 213, title: "House Robber II", difficulty: "Medium" },
  "Numbers With Repeated Digits": { slug: "numbers-with-repeated-digits", id: 1012, title: "Numbers With Repeated Digits", difficulty: "Hard" },
  "Count Numbers with Unique Digits": { slug: "count-numbers-with-unique-digits", id: 357, title: "Count Numbers with Unique Digits", difficulty: "Medium" },
  "Non-negative Integers without Consecutive Ones": { slug: "non-negative-integers-without-consecutive-ones", id: 600, title: "Non-negative Integers without Consecutive Ones", difficulty: "Hard" },
  "Partition Array Into Two Arrays to Minimize Sum Difference": { slug: "partition-array-into-two-arrays-to-minimize-sum-difference", id: 2035, title: "Partition Array Into Two Arrays to Minimize Sum Difference", difficulty: "Hard" },
  "Closest Subsequence Sum": { slug: "closest-subsequence-sum", id: 1755, title: "Closest Subsequence Sum", difficulty: "Hard" },
  "Ways to Split Array Into Three Subarrays": { slug: "ways-to-split-array-into-three-subarrays", id: 1712, title: "Ways to Split Array Into Three Subarrays", difficulty: "Medium" },
  "Number of Islands II": { slug: "number-of-islands-ii", id: 305, title: "Number of Islands II", difficulty: "Hard", paid: true },
  "Bricks Falling When Hit": { slug: "bricks-falling-when-hit", id: 803, title: "Bricks Falling When Hit", difficulty: "Hard" },
  "Count Triplets That Can Form Two Arrays of Equal XOR": { slug: "count-triplets-that-can-form-two-arrays-of-equal-xor", id: 1442, title: "Count Triplets That Can Form Two Arrays of Equal XOR", difficulty: "Medium" },
  "Contiguous Array": { slug: "contiguous-array", id: 525, title: "Contiguous Array", difficulty: "Medium" },
  "Find All Numbers Disappeared in an Array": { slug: "find-all-numbers-disappeared-in-an-array", id: 448, title: "Find All Numbers Disappeared in an Array", difficulty: "Easy" },
  "First Missing Positive": { slug: "first-missing-positive", id: 41, title: "First Missing Positive", difficulty: "Hard" },
  "Longest Duplicate Substring": { slug: "longest-duplicate-substring", id: 1044, title: "Longest Duplicate Substring", difficulty: "Hard" },
  "Repeated String Match": { slug: "repeated-string-match", id: 686, title: "Repeated String Match", difficulty: "Medium" },
  "Distinct Echo Substrings": { slug: "distinct-echo-substrings", id: 1316, title: "Distinct Echo Substrings", difficulty: "Hard" },
};

/** A resolved destination for a problem named anywhere in the content, or null. */
export function externalProblem(name) {
  const e = EXTERNAL_PROBLEMS[name];
  if (!e) return null;
  if (e.judge === "cses") return { ...e, href: e.url, label: "CSES" };
  return { ...e, href: `https://leetcode.com/problems/${e.slug}/`, label: `LeetCode ${e.id}` };
}
