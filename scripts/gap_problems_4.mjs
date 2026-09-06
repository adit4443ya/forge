// ELITE TIER — problems that are not on the standard lists.
// The brief: no recognisable pattern name rescues you, the first idea is wrong
// in an instructive way, and the interesting work is the reasoning before the
// code. Each states the wrong first instinct explicitly, because meeting it and
// recovering is the skill being trained.
export const GAP_PROBLEMS_4 = [
  {
    id: 123, section: "Design", title: "Exactly-Once Deduplication in a Bounded Window",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Ring of hash sets — amortise eviction instead of tracking expiry per key",
    intuition: "Messages arrive with ids and you must drop any id seen in the last T seconds, at millions per second, in bounded memory. The instinct is a hash map from id to timestamp plus a sweep, but the sweep is unbounded work at an unpredictable moment and the map grows to the whole window. Instead slice the window into k buckets, each a hash set. Insert into the current bucket; look up across all k; when the clock crosses a bucket boundary, clear the oldest bucket wholesale and reuse it.",
    keyInsight: "You never delete an individual key. Eviction becomes clearing one bucket — O(bucket size), paid at a boundary you choose, with memory bounded by construction. The cost is granularity: an id is remembered for between T and T(1 + 1/k), which is a specification question, not a bug. This is the same shape as a timer wheel: bucket by time and amortise, rather than tracking each item's expiry.",
    approach: "1) k buckets, each a hash set, bucket i covering [t0 + iT/k, ...). 2) seen(id): check all k sets; if absent insert into current and return false. 3) On a boundary, advance the cursor and clear the bucket now falling out of the window. 4) For memory certainty, cap each bucket and choose the behaviour on overflow deliberately.",
    complexity: "Time: O(k) per query, k a small constant | Space: O(ids in the window), bounded",
    tabCode: `class WindowDedup {                       // \"have I seen this id in the last T?\"
    std::vector<std::unordered_set<uint64_t>> buckets;
    uint64_t bucketNs, startNs = 0, cur = 0;
    bool primed = false;
public:
    WindowDedup(uint64_t windowNs, size_t k = 4)
        : buckets(k), bucketNs(windowNs / k) {}

    bool seenBefore(uint64_t id, uint64_t nowNs) {
        if (!primed) { startNs = nowNs; primed = true; }
        // Advance whole buckets; clearing is the only eviction that ever happens.
        while (nowNs - startNs >= bucketNs) {
            startNs += bucketNs;
            cur = (cur + 1) % buckets.size();
            buckets[cur].clear();                        // O(size of one bucket), at a boundary we chose
        }
        for (auto& b : buckets) if (b.count(id)) return true;
        buckets[cur].insert(id);
        return false;
    }
};
// Why not the obvious alternatives:
//   unordered_map<id, timestamp> + periodic sweep — the sweep is O(all keys) and lands
//     unpredictably; that is a latency spike, which is exactly what this domain cannot have.
//   A single LRU of fixed size — evicts by capacity, not by time, so under a burst the
//     window silently shortens and duplicates get through when you are least able to notice.
//   A Bloom filter — O(1) and tiny, but false positives mean DROPPING a message you never
//     saw. Acceptable only if the downstream is idempotent; say which error you can afford.
//     A counting/rotating Bloom filter is the memory-bounded version of exactly this design.
//
// The follow-up worth having ready: ids are usually monotonic per producer, so per-producer
// you can keep a high-water mark plus a small bitset of out-of-order arrivals below it —
// O(1) memory per producer and exact, which beats all of the above when the structure holds.`,
  },
  {
    id: 124, section: "Greedy", title: "Choose the Order That Minimises the Worst Wait",
    difficulty: "Hard", frequency: "Low", leetcode: null,
    pattern: "Exchange argument — prove the comparator by swapping an adjacent pair",
    intuition: "n jobs, job i takes t_i and has penalty rate p_i; total cost is the sum over jobs of p_i times its completion time. Which order minimises it? Sorting by shortest time or by largest penalty are both wrong. Consider only two adjacent jobs and ask which order is cheaper: swapping i and j changes the cost by t_i·p_j − t_j·p_i, so i should precede j exactly when t_i/p_i < t_j/p_j.",
    keyInsight: "The exchange argument is the whole technique, and it is the one that generalises. If no adjacent swap improves the order, no permutation does — because any permutation is reachable by adjacent swaps and the cost is a sum of pairwise terms. Discovering the comparator by comparing two elements, then proving it by exchange, is how nearly every non-obvious greedy is actually derived; guessing the comparator and testing on examples is how people get it wrong.",
    approach: "1) Write the cost difference for swapping two adjacent jobs. 2) Everything but the two cancels. 3) The condition that remains is the comparator. 4) Sort by it. 5) State the exchange argument as the proof.",
    complexity: "Time: O(N log N) | Space: O(1) beyond the sort",
    tabCode: `// Cost = sum over jobs of penalty_i * (completion time of i).
// Swapping adjacent i, j changes cost by t_i*p_j - t_j*p_i, so:
//   put i first  <=>  t_i * p_j < t_j * p_i  <=>  t_i/p_i < t_j/p_j
long long minWeightedCompletion(std::vector<std::pair<long long,long long>> jobs) {  // (time, penalty)
    std::sort(jobs.begin(), jobs.end(), [](auto& a, auto& b) {
        return a.first * b.second < b.first * a.second;   // cross-multiply: no division, no precision loss
    });
    long long clock = 0, cost = 0;
    for (auto& [t, p] : jobs) { clock += t; cost += p * clock; }
    return cost;
}
// The family this unlocks, all the same argument with a different cancellation:
//   - Two jobs per task (machine A then B): Johnson's rule, min(a_i, b_j) < min(a_j, b_i).
//   - Deadlines with penalties: sort by the exchange comparator, then use a union-find or a
//     heap to drop the cheapest job whenever a deadline becomes infeasible.
//   - Merging files with cost = sum of sizes: always merge the two smallest (Huffman).
//   - Maximise sum of a_i * b_sigma(i): sort both the same way (rearrangement inequality).
//
// The trap that catches people: a comparator derived this way must be a STRICT WEAK ORDERING.
// t_i/p_i as a floating-point division can make two \"equal\" items compare inconsistently and
// std::sort then reads out of bounds — undefined behaviour, not just a wrong answer. Cross-
// multiply with integers, and watch for overflow when the values are large.`,
  },
  {
    id: 125, section: "Randomized", title: "Estimate the Count of Distinct Items in One Pass",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Hash to uniform, then read the count off an order statistic",
    intuition: "A stream of billions of items, and you need the number of distinct ones in kilobytes. Exact is impossible — it provably needs linear space. So hash each item to a uniform value in [0,1) and keep only the smallest hash seen. If there are n distinct values, n uniform samples have expected minimum 1/(n+1), so n ≈ 1/min − 1. One number, and it estimates a cardinality.",
    keyInsight: "Hashing turns an arbitrary universe into uniform samples, and duplicates collapse automatically because the same item hashes to the same value — which is exactly why this counts DISTINCT items without storing them. One minimum has enormous variance, so the real estimators reduce it: keep the k smallest and use k/(k-th smallest), or bucket by the leading bits and average the maximum run of zeros per bucket, which is HyperLogLog. The idea to carry is that an order statistic of uniform hashes encodes the count.",
    approach: "1) h = hash(item) mapped to [0,1). 2) Keep the k smallest distinct hashes in a max-heap of size k. 3) Estimate n ≈ (k − 1) / (k-th smallest). 4) Relative error is about 1/√k, so k = 1024 gives roughly 3%. 5) Merge two sketches by merging their k-minimum sets — which is what makes it distributable.",
    complexity: "Time: O(log k) per item | Space: O(k), independent of the stream length or the universe",
    tabCode: `class DistinctCount {                     // KMV (k-minimum values) sketch
    size_t k;
    std::priority_queue<double> top;                 // max-heap of the k smallest hashes
    std::unordered_set<uint64_t> present;            // guard against inserting the same hash twice
    static double unit(uint64_t x) {                 // mix, then map to [0,1)
        x ^= x >> 33; x *= 0xff51afd7ed558ccdULL;
        x ^= x >> 33; x *= 0xc4ceb9fe1a85ec53ULL;
        x ^= x >> 33;
        return (double)(x >> 11) / (double)(1ULL << 53);
    }
public:
    explicit DistinctCount(size_t k = 1024) : k(k) {}
    void add(uint64_t item) {
        double h = unit(item);
        uint64_t key = (uint64_t)(h * (double)(1ULL << 53));
        if (present.count(key)) return;              // a repeat contributes nothing: that is the point
        if (top.size() < k)      { top.push(h); present.insert(key); }
        else if (h < top.top())  { present.erase((uint64_t)(top.top() * (double)(1ULL << 53)));
                                   top.pop(); top.push(h); present.insert(key); }
    }
    double estimate() const {
        if (top.size() < k) return (double)top.size();        // fewer than k distinct: exact
        return (double)(k - 1) / top.top();                   // (k-1)/kth-smallest is unbiased
    }
};
// Why 1/min - 1 alone is not enough: the minimum of n uniforms has standard deviation of the
// same order as its mean, so a single-minimum estimate can be off by a factor of two. Averaging
// k order statistics cuts the relative error to about 1/sqrt(k) — that trade is the design.
//
// HyperLogLog is the same idea with a cheaper statistic: bucket on the top bits, store the
// longest run of leading zeros per bucket (a few bits each), and take a harmonic mean. That is
// how you count a billion distinct items in about 1.5 KB at ~2% error.
//
// The property that matters in a distributed system: sketches MERGE. Union two streams by
// taking the element-wise minimum (or maximum run), with no re-reading and no coordination.`,
  },
  {
    id: 126, section: "Monotonic Stack", title: "The Largest Rectangle You Cannot See",
    difficulty: "Hard", frequency: "Medium", leetcode: 85,
    pattern: "Reduce a 2-D question to N runs of a 1-D one you already trust",
    intuition: "Largest all-ones rectangle in a binary matrix. Enumerating corners is O(M²N²). The move is to notice that for each row, the heights of the columns of ones ending at that row form a histogram — and the largest rectangle whose bottom edge is on this row is exactly the largest rectangle in that histogram, which is a solved 1-D problem. Sweep the rows, maintain the histogram incrementally, and take the best.",
    keyInsight: "The technique is reduction, not a new algorithm: find a dimension along which the problem becomes one you have already solved, and pay only the cost of maintaining the reduced state. Here the histogram update is O(1) per cell — height becomes height+1 or resets to 0 — so the whole thing costs M runs of an O(N) subroutine. Recognising a solved subproblem inside an unsolved one is the skill; the monotonic stack is just the subroutine.",
    approach: "1) heights[j] = consecutive ones in column j ending at the current row. 2) For each row, update heights in O(N). 3) Run largest-rectangle-in-histogram with a monotonic stack. 4) Track the maximum.",
    complexity: "Time: O(M×N) — each cell pushed and popped at most once per row | Space: O(N)",
    tabCode: `int largestRectangleHistogram(std::vector<int>& h) {
    std::stack<int> st;                                  // indices, heights strictly increasing
    int best = 0;
    for (int i = 0; i <= (int)h.size(); i++) {
        int cur = (i == (int)h.size()) ? 0 : h[i];       // sentinel drains the stack
        while (!st.empty() && h[st.top()] >= cur) {
            int height = h[st.top()]; st.pop();
            int left = st.empty() ? -1 : st.top();       // first bar to the left that is strictly lower
            best = std::max(best, height * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}

int maximalRectangle(std::vector<std::vector<char>>& m) {
    if (m.empty()) return 0;
    std::vector<int> heights(m[0].size(), 0);
    int best = 0;
    for (auto& row : m) {
        for (size_t j = 0; j < row.size(); j++)
            heights[j] = (row[j] == '1') ? heights[j] + 1 : 0;    // O(1) incremental histogram
        best = std::max(best, largestRectangleHistogram(heights));
    }
    return best;
}
// The reduction, said out loud: \"every rectangle has a bottom row; fix it, and the question
// becomes the largest rectangle in the histogram of column heights above it.\"
//
// The same move appears elsewhere and is worth naming:
//   - Maximum sum submatrix: fix the top and bottom rows, and it is maximum subarray (Kadane).
//   - Count submatrices of all ones: per row, for each column count rectangles ending there
//     using a monotonic stack that carries the running total.
//   - Trapping rain water in 2-D: not a reduction — it becomes a priority-queue flood fill
//     from the border. Knowing which problems do NOT reduce is part of the skill.`,
  },
  {
    id: 127, section: "Binary Search", title: "Search a Space That Is Not an Array",
    difficulty: "Hard", frequency: "High", leetcode: 410,
    pattern: "Binary search the ANSWER: guess a value, ask a yes/no question, halve",
    intuition: "Split an array into k contiguous parts minimising the largest part sum. There is no sorted array to search. But the answer is a number in a known range, and the question 'can I do it with largest part at most X' is monotone — if X works, X+1 works. So binary search over X and answer the feasibility question greedily in O(N).",
    keyInsight: "Binary search does not need an array; it needs a monotone predicate over an ordered candidate space. The whole difficulty is spotting that the hard optimisation question has an easy decision version. The template — define the predicate, prove it monotone, bound the range, then search — converts an entire family of 'minimise the maximum' and 'maximise the minimum' problems into a greedy check.",
    approach: "1) lo = max element (a part must hold it), hi = total sum. 2) feasible(X): walk greedily, starting a new part when adding would exceed X; count parts. 3) If parts ≤ k, X is feasible; shrink hi, else raise lo. 4) Return lo.",
    complexity: "Time: O(N log(sum)) | Space: O(1)",
    tabCode: `int splitArray(std::vector<int>& nums, int k) {
    long long lo = 0, hi = 0;
    for (int x : nums) { lo = std::max(lo, (long long)x); hi += x; }

    auto feasible = [&](long long cap) {                 // monotone in cap: this is what licenses the search
        int parts = 1; long long run = 0;
        for (int x : nums) {
            if (run + x > cap) { parts++; run = x; }     // greedy is optimal for the DECISION version
            else run += x;
        }
        return parts <= k;
    };

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;              // never lo+hi: that overflows
        if (feasible(mid)) hi = mid; else lo = mid + 1;
    }
    return (int)lo;
}
// The recognition rule: \"minimise the maximum\" or \"maximise the minimum\" almost always means
// binary search on the answer. The work is defining the predicate and arguing it is monotone.
//
// Same template, different predicate:
//   - Koko eating bananas / ship packages in D days: same shape exactly.
//   - Aggressive cows (maximise the minimum gap): predicate places cows greedily.
//   - Median of two sorted arrays: binary search the PARTITION, not the value.
//   - Kth smallest in a sorted matrix: binary search the value, predicate counts <= x.
//   - Minimum time to complete jobs with machines: predicate is itself a feasibility DP.
//
// Two things that go wrong: a predicate that is not actually monotone (then the search is
// meaningless — check it), and the classic overflow in the midpoint on large ranges.`,
  },
  {
    id: 128, section: "HFT Structures", title: "Reconstruct the Order Book From a Gapped Feed",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Sequence numbers, a buffer, and a snapshot — state machine over an unreliable stream",
    intuition: "Incremental book updates arrive over UDP with sequence numbers. Messages drop and reorder. You must maintain a correct book, know when you cannot, and recover. The naive handler applies whatever arrives, which silently corrupts the book from the first gap onward — and a wrong book is worse than no book, because you keep quoting on it.",
    keyInsight: "The book is a fold over an ordered stream, so a gap does not lose one message, it invalidates every subsequent state. That forces an explicit state machine — SYNCING, LIVE, GAPPED — and the correct behaviour in GAPPED is to stop trading, not to guess. The recovery is: buffer live increments while a snapshot is fetched, then replay only the buffered messages whose sequence exceeds the snapshot's. Out-of-order arrival within a small window is normal and is handled by the same buffer, not by an error path.",
    approach: "1) LIVE: apply if seq == expected; buffer if greater (gap); ignore if smaller (duplicate from the B feed). 2) On a gap, request a snapshot and enter SYNCING. 3) On the snapshot, install it, drop buffered messages at or below its sequence, replay the rest in order, return to LIVE. 4) Expose isLive() and refuse to quote when it is false.",
    complexity: "Time: O(log levels) per update, O(buffered) per recovery | Space: O(levels + buffered)",
    tabCode: `class BookFeed {
public:
    struct Update { uint64_t seq; bool isBid; int64_t price, qty; };   // qty 0 removes the level
private:
    enum class State { Syncing, Live, Gapped };
    State state = State::Syncing;
    uint64_t expected = 0;
    std::map<int64_t, int64_t> bids, asks;                       // price ticks -> quantity
    std::map<uint64_t, Update> pending;                          // ordered buffer, keyed by sequence
public:
    bool isLive() const { return state == State::Live; }          // quote only when this is true

    void onUpdate(const Update& u) {
        if (state == State::Live && u.seq == expected) { apply(u); expected++; drain(); return; }
        if (u.seq < expected) return;                             // duplicate: the A/B feeds overlap
        pending[u.seq] = u;                                       // ahead of us: hold it
        if (state == State::Live) { state = State::Gapped; requestSnapshot(); }
    }

    void onSnapshot(uint64_t seq, std::map<int64_t,int64_t> b, std::map<int64_t,int64_t> a) {
        bids = std::move(b); asks = std::move(a);
        expected = seq + 1;
        for (auto it = pending.begin(); it != pending.end(); )    // anything at or before the snapshot
            it = (it->first < expected) ? pending.erase(it) : std::next(it);   // is already reflected
        state = State::Live;
        drain();
    }
private:
    void drain() {                                                // replay whatever is now contiguous
        for (auto it = pending.find(expected); it != pending.end() && it->first == expected;
             it = pending.find(expected)) {
            apply(it->second); pending.erase(it); expected++;
        }
    }
    void apply(const Update& u) {
        auto& side = u.isBid ? bids : asks;
        if (u.qty == 0) side.erase(u.price); else side[u.price] = u.qty;
    }
    void requestSnapshot();                                       // venue-specific
};
// The judgement the question is really testing, in one sentence: while gapped you STOP QUOTING,
// because trading on a book you know is wrong is the expensive failure and \"no quote\" is the
// cheap one.
//
// What a reviewer will push on next:
//   - std::map allocates per level and chases pointers. Prices are integer ticks on a bounded
//     grid, so a direct-indexed array of levels with a moving base is O(1) and one cache line.
//   - A/B arbitration removes most gaps for free: take whichever copy of the same sequence
//     arrives first and discard the other. Do that before this state machine ever sees a gap.
//   - The buffer must be bounded. An unbounded pending map under a sustained outage is how the
//     recovery path itself takes the process down.`,
  },
];
