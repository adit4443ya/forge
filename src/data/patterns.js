/* ════════════════════════════════════════════════════════════════════════════
   PATTERN LIBRARY — the templates, next to the problems that use them.

   The original fifteen live in dsaData.jsx as CHEATSHEET; these extend the
   coverage to what a hard round actually reaches for. Same shape, plus two
   fields the originals lacked and that turn out to matter more than the
   template itself:

     recognise  the sentence in the PROBLEM that tells you to reach for this
     wrong      the plausible first idea, and why it fails

   A pattern you can only apply once someone tells you the name is not much
   use. Recognition is the skill; the template is the easy half.
   ════════════════════════════════════════════════════════════════════════════ */

export const PATTERNS_2 = [
  {
    pattern: "Fast and slow pointers",
    when: "Cycle detection, finding a midpoint, or the k-th from the end in one pass over a structure you cannot index",
    recognise: "A linked list plus 'without extra space', or any question about a cycle's existence or entry point",
    template: "slow = head; fast = head;\nwhile (fast && fast->next) { slow = slow->next; fast = fast->next->next; if (slow == fast) break; }\n// entry: reset one pointer to head, advance both one step at a time",
    wrong: "A hash set of visited nodes works and is easier — but it is O(n) space, which is exactly what the question is excluding.",
    tip: "Floyd's: after they meet, moving one pointer to the head and advancing both singly meets at the cycle entry. Distance from head to entry equals distance from meeting point to entry, going forward.",
    problems: ["Linked List Cycle", "Find the Duplicate Number", "Middle of the Linked List"],
  },
  {
    pattern: "Backtracking with pruning",
    when: "Enumerate all solutions to a constraint problem where most branches die early",
    recognise: "'All combinations / permutations / ways', small n, and a constraint that can be checked before completing a candidate",
    template: "void rec(state) {\n  if (complete(state)) { record(state); return; }\n  for (choice : options(state)) {\n    if (!feasible(state, choice)) continue;   // prune BEFORE recursing\n    apply(choice); rec(state); undo(choice);  // undo is what makes it backtracking\n  }\n}",
    wrong: "Generating everything and filtering at the end. The pruning is not an optimization here — without it the search is exponential in the full space rather than in the feasible one.",
    tip: "Sort first when duplicates must be skipped, then `if (i > start && a[i] == a[i-1]) continue;`. Choosing the most-constrained variable first (fewest remaining options) often turns an infeasible search into an instant one.",
    problems: ["N-Queens", "Combination Sum", "Word Search", "Palindrome Partitioning"],
  },
  {
    pattern: "Trie for prefix structure",
    when: "Many queries over a shared prefix structure — autocomplete, word search, or XOR maximization over bits",
    recognise: "A set of strings queried by prefix, or 'maximum XOR pair', which is a trie over the binary representation",
    template: "struct Node { Node* kid[26]{}; bool end = false; };\n// insert: walk, creating; mark end\n// query: walk, failing on a null child\n// XOR variant: 32-level binary trie, greedily take the opposite bit at each level",
    wrong: "A hash set gives O(1) exact lookup but nothing for prefixes — every prefix query degrades to scanning. The trie exists precisely to share the prefix work.",
    tip: "The XOR application is the one people miss: insert numbers as 32-bit paths, then for each number walk the trie preferring the opposite bit, which greedily maximizes the XOR one bit at a time.",
    problems: ["Implement Trie", "Word Search II", "Maximum XOR of Two Numbers in an Array"],
  },
  {
    pattern: "Difference array / interval counting",
    when: "Many range updates then one read, or 'how many intervals cover this point'",
    recognise: "Repeated 'add v to every index in [l, r]', or a maximum-overlap question over intervals",
    template: "d[l] += v; d[r + 1] -= v;        // O(1) per range update\nrunning = 0; for (i) { running += d[i]; a[i] = running; }   // one pass to materialize",
    wrong: "Applying each update element by element is O(range) each; with many updates that is quadratic. The difference array defers all of it to a single prefix sum.",
    tip: "For sparse coordinates use an ordered map instead of an array — the running sum over its keys in order gives the overlap count at every boundary, which is the whole answer to meeting-rooms and calendar problems.",
    problems: ["Corporate Flight Bookings", "Meeting Rooms II", "My Calendar III", "Car Pooling"],
  },
  {
    pattern: "Monotonic deque for a sliding window extremum",
    when: "Maximum or minimum of every window of fixed size k, in one pass",
    recognise: "'For each window of size k, report the max' — and O(n log n) with a heap is too slow or lazy deletion is awkward",
    template: "deque<int> dq;                      // indices, values decreasing\nfor (i) {\n  while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();   // smaller can never win again\n  dq.push_back(i);\n  if (dq.front() <= i - k) dq.pop_front();                      // left the window\n  if (i >= k - 1) out.push_back(a[dq.front()]);\n}",
    wrong: "A max-heap needs lazy deletion because you cannot remove the element leaving the window; it works but is O(n log n) and fiddly. The deque is O(n) because each index is pushed and popped once.",
    tip: "Store indices, not values, or you cannot tell when an element leaves the window. The invariant to say out loud: the deque holds candidates in decreasing order, and anything smaller than a later arrival is dominated.",
    problems: ["Sliding Window Maximum", "Shortest Subarray with Sum at Least K", "Jump Game VI"],
  },
  {
    pattern: "Binary search on the answer",
    when: "'Minimise the maximum' or 'maximise the minimum', where checking a candidate is easy but optimising directly is not",
    recognise: "An optimisation question whose decision version — 'can it be done with X?' — is obviously monotone",
    template: "lo = lowest plausible; hi = highest plausible;\nwhile (lo < hi) { mid = lo + (hi - lo) / 2;        // never lo + hi: overflow\n  if (feasible(mid)) hi = mid; else lo = mid + 1; }\nreturn lo;",
    wrong: "Trying to construct the optimum greedily. The greedy is usually right for the DECISION version and wrong for the optimisation — which is exactly why you binary search over the answer and let the greedy check it.",
    tip: "The work is proving monotonicity: if X works then X+1 works. If that is not true, the search is meaningless. State it before writing the loop.",
    problems: ["Split Array Largest Sum", "Koko Eating Bananas", "Capacity To Ship Packages", "Minimize Max Distance to Gas Station"],
  },
  {
    pattern: "Reduce a 2-D problem to N runs of a 1-D one",
    when: "A grid or matrix question that looks quadratic in both dimensions",
    recognise: "'Largest / maximum sum submatrix or rectangle' — anything where fixing one dimension leaves a problem you already know",
    template: "for each bottom row r:\n    update a 1-D array incrementally in O(cols)\n    answer = max(answer, solve1D(array))     // histogram, Kadane, etc.",
    wrong: "Enumerating all corner pairs. It is correct and O(M²N²), and the reduction gets the same answer in O(MN) or O(M²N) by reusing a solved subproblem.",
    tip: "The sentence that unlocks it: 'every rectangle has a bottom row — fix it, and the rest is the 1-D version'. Maximum-sum submatrix fixes a top and bottom row and runs Kadane; largest all-ones rectangle fixes a bottom row and runs largest-rectangle-in-histogram.",
    problems: ["Maximal Rectangle", "Maximum Sum Rectangle", "Count Submatrices With All Ones"],
  },
  {
    pattern: "Top-K with a bounded heap",
    when: "The k largest or smallest out of a stream or a set far too large to sort",
    recognise: "'k most frequent', 'k closest', or any top-k where n is huge and k is small",
    template: "// k LARGEST -> keep a MIN-heap of size k (evict the smallest)\nfor (x : items) { pq.push(x); if (pq.size() > k) pq.pop(); }\n// the heap now holds the k largest; pq.top() is the k-th largest",
    wrong: "Sorting everything is O(n log n) and needs all of it in memory. The bounded heap is O(n log k) and O(k) memory, which is what makes it work on a stream.",
    tip: "The direction is the bit people invert: k largest needs a MIN-heap, because you must be able to evict the smallest of your current best. Quickselect gives O(n) average when the data is in memory and you do not need them ordered.",
    problems: ["Top K Frequent Elements", "K Closest Points to Origin", "Kth Largest Element in a Stream"],
  },
  {
    pattern: "Two heaps for a running median",
    when: "A statistic of the middle of a set that keeps changing",
    recognise: "'Median' plus 'stream' or 'sliding window'",
    template: "max-heap lo (smaller half), min-heap hi (larger half)\ninsert: push to lo if x <= lo.top() else hi; then rebalance so 0 <= |lo| - |hi| <= 1\nmedian: lo.top(), or the average of both tops for an even count",
    wrong: "Keeping a sorted array and inserting in place — O(n) per insertion. The two heaps give O(log n), and the invariant on the sizes is the whole solution.",
    tip: "For a sliding window you must also remove an arbitrary element, which a binary heap cannot do. Either lazy deletion with a pending-count map and separate logical sizes, or an ordered multiset with an iterator parked on the median.",
    problems: ["Find Median from Data Stream", "Sliding Window Median", "IPO"],
  },
  {
    pattern: "Sweep line",
    when: "Events on a line where the answer changes only at event points",
    recognise: "Intervals, rectangles, or 'at any moment, how many are active'",
    template: "collect events (position, +1 start / -1 end)\nsort, breaking ties so starts precede ends (or the reverse — decide from the semantics)\nwalk, maintaining active state; the answer changes only here",
    wrong: "Sampling positions at a fixed granularity. It is approximate, and the tie-breaking you avoided thinking about is the actual difficulty of the problem.",
    tip: "The tie-break is where these are won or lost. For the skyline, at equal x process starts before ends, taller starts first and shorter ends first — encoding a start as a negative height makes a plain sort do all three.",
    problems: ["The Skyline Problem", "Meeting Rooms II", "Employee Free Time", "Rectangle Area II"],
  },
  {
    pattern: "Kadane and its variants",
    when: "Best contiguous subarray under some measure",
    recognise: "'Maximum sum / product subarray', contiguous, one pass expected",
    template: "best = cur = a[0];\nfor (i = 1..n-1) { cur = max(a[i], cur + a[i]); best = max(best, cur); }",
    wrong: "Prefix sums plus a nested scan is O(n²). Kadane is the observation that the best subarray ending at i either extends the one ending at i-1 or starts fresh — a one-line recurrence.",
    tip: "For products you must track both the maximum and the minimum, because a negative times the running minimum can become the new maximum. For 'at most one deletion' or 'circular', keep a second state and the same shape works.",
    problems: ["Maximum Subarray", "Maximum Product Subarray", "Maximum Sum Circular Subarray", "Best Time to Buy and Sell Stock"],
  },
  {
    pattern: "State-machine DP",
    when: "A sequence where each position has a small set of states with transitions between them",
    recognise: "'At most k transactions', 'with a cooldown', 'you may skip at most one' — a constraint that adds a dimension rather than changing the recurrence",
    template: "dp[i][state] = best over transitions into state at i\n// stocks: hold / free / cooldown\nhold = max(hold, free - price[i]);\nfree = max(free, hold + price[i]);",
    wrong: "Trying to be greedy. Greedy works for the unlimited-transaction case and breaks the moment a constraint couples decisions across time — which is what the extra state dimension is for.",
    tip: "Name the states out loud before writing anything. Most of these problems are easy once the state set is right and impossible while it is wrong, and the number of states is almost always two to four.",
    problems: ["Best Time to Buy and Sell Stock with Cooldown", "Best Time to Buy and Sell Stock III", "House Robber II"],
  },
  {
    pattern: "Digit DP",
    when: "Counting numbers in a range with a property about their digits",
    recognise: "'How many numbers between A and B contain / avoid / sum to …', with bounds up to 10^18",
    template: "dp(pos, tight, started, extraState)\n  tight  : still equal to the prefix of the bound\n  started: have we placed a non-zero digit (for leading zeros)\nanswer = f(B) - f(A - 1)",
    wrong: "Iterating the range. At 10^18 that is not an option, and the structure — digit by digit with a 'still on the boundary' flag — is what makes it O(digits × states).",
    tip: "The two flags are the whole pattern. `tight` says the digits so far match the bound exactly, so the next digit is capped; once it is false, all remaining positions are free and the state becomes cacheable.",
    problems: ["Numbers With Repeated Digits", "Count Numbers with Unique Digits", "Non-negative Integers without Consecutive Ones"],
  },
  {
    pattern: "Meet in the middle",
    when: "n around 40 — too large for 2^n, too small to have a polynomial answer",
    recognise: "Subset sums or subset selection with n between about 30 and 45",
    template: "split into halves A and B\nenumerate all 2^(n/2) subset sums of each\nsort one side, then binary search it for each element of the other",
    wrong: "Full enumeration at 2^40 is a trillion. Splitting makes it 2 × 2^20 to enumerate plus a log factor to combine — the classic square-root of the search space.",
    tip: "The recognition signal is the constraint. n ≤ 20 means straight bitmask; n ≤ 40 means meet in the middle; larger means there is a polynomial structure you have not found.",
    problems: ["Partition Array Into Two Arrays to Minimize Sum Difference", "Closest Subsequence Sum", "Ways to Split Array Into Three Subarrays"],
  },
  {
    pattern: "Union-Find with rollback / offline processing",
    when: "Connectivity queries mixed with edge deletions, or queries easier to answer in a different order",
    recognise: "Deletions in a connectivity problem, or queries you are allowed to answer offline",
    template: "// deletions are hard; reverse time so they become additions\nprocess queries in reverse, adding edges\n// or: union by rank WITHOUT path compression, keeping an undo stack",
    wrong: "Rebuilding the structure per query. Reversing time turns every deletion into a union, which the structure does support — the trick is the ordering, not the data structure.",
    tip: "Path compression and rollback are incompatible: compression rewrites parents irreversibly. For rollback use union by rank or size only, accept O(log n), and push each parent change onto an undo stack.",
    problems: ["Number of Islands II", "Bricks Falling When Hit", "Redundant Connection"],
  },
  {
    pattern: "Prefix XOR and the hash map",
    when: "Subarrays with an XOR property, the same way prefix sums handle sums",
    recognise: "'Subarrays with XOR equal to k', or a parity/toggle condition over a range",
    template: "running ^= a[i];\ncount += seen[running ^ k];      // a previous prefix that completes it\nseen[running]++;",
    wrong: "Recomputing the XOR of each subarray is O(n²). XOR is its own inverse, so prefix[j] ^ prefix[i-1] is the XOR of (i..j) — exactly the prefix-sum trick with ^ instead of −.",
    tip: "Seed the map with `seen[0] = 1` for prefixes that satisfy the condition from index zero. The same shape handles 'subarray with equal counts of two values' by mapping each value to +1/−1 and using a prefix sum.",
    problems: ["Count Triplets That Can Form Two Arrays of Equal XOR", "Subarray Sum Equals K", "Contiguous Array"],
  },
  {
    pattern: "Cyclic sort / index-as-hash",
    when: "The array holds values in 1..n and you need a missing or duplicated one in O(1) space",
    recognise: "'Numbers 1 to n', 'find the duplicate/missing', and 'without extra space'",
    template: "// place each value at its own index\nwhile (a[i] != i + 1 && a[a[i] - 1] != a[i]) swap(a[i], a[a[i] - 1]);\n// then the first index where a[i] != i + 1 is the answer\n// or: mark presence by negating a[abs(x) - 1]",
    wrong: "A hash set or a count array is O(n) extra space, which the constraint is excluding. The array itself is the hash table — the values are the keys and the indices are the slots.",
    tip: "The negation variant destroys the input; the swap variant permutes it. Say which you are doing and whether that is acceptable. If the input must survive, Floyd's cycle detection on the value-as-pointer graph solves 'find the duplicate' in O(1) space non-destructively.",
    problems: ["Find All Numbers Disappeared in an Array", "First Missing Positive", "Find the Duplicate Number"],
  },
  {
    pattern: "Rolling hash",
    when: "Comparing many substrings, or finding a repeated substring of unknown length",
    recognise: "Substring matching where the length varies, or an O(n log n) 'longest duplicated substring'",
    template: "H[i+1] = H[i] * base + s[i]  (mod a large prime)\nhash(l, r) = H[r] - H[l] * base^(r-l)\n// choose base at RANDOM at run time; use a 64-bit modulus",
    wrong: "Treating a hash match as proof. By the birthday bound, q comparisons collide with probability about q²/2m — a 32-bit modulus over a million comparisons is a near-certain false match. Verify a hit, or use two independent moduli.",
    tip: "Pick the base randomly at run time so no fixed input can be constructed against you, and say the collision bound out loud. If the answer must be exact, confirm a candidate with a direct comparison — that turns a probabilistic algorithm into a certain one.",
    problems: ["Longest Duplicate Substring", "Repeated String Match", "Distinct Echo Substrings"],
  },
];

/* One list for the UI: the originals plus these, tagged by where they came from. */
export function allPatterns(original = []) {
  return [
    ...original.map((p) => ({ ...p, tier: "core" })),
    ...PATTERNS_2.map((p) => ({ ...p, tier: "extended" })),
  ];
}
