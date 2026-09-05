// Eight problems that fill the curriculum gaps (intervals, matrix, parsing, iterator/design,
// randomized, HFT structures). Appended to PROBLEMS by scripts/add-gap-problems.mjs.
export const GAP_PROBLEMS = [
  {
    id: 98, section: "Intervals", title: "Meeting Rooms II (minimum rooms)",
    difficulty: "Medium", frequency: "High", leetcode: 253,
    pattern: "Sweep line — sort starts and ends separately",
    intuition: "A room is needed for every meeting that starts before the earliest-ending active meeting ends. Sort starts and ends independently; walk the starts; each start either opens a new room (start < earliest end) or reuses the room that just freed (advance the end pointer).",
    keyInsight: "You never need to know WHICH meeting ended, only that one did. Separating starts from ends turns an interval problem into two sorted streams. Equivalent formulation: a min-heap of end times, pop while top <= start.",
    approach: "1) starts = sorted start times, ends = sorted end times. 2) j = 0, rooms = 0. 3) for each start: if start < ends[j] rooms++ else j++. 4) rooms never decreases; return it.",
    complexity: "Time: O(N log N) for the sorts | Space: O(N)",
    tabCode: `// Two sorted streams (sweep line). rooms only ever grows: the answer is the final count.
int minMeetingRooms(vector<vector<int>>& iv) {
    vector<int> starts, ends;
    for (auto& v : iv) { starts.push_back(v[0]); ends.push_back(v[1]); }
    sort(starts.begin(), starts.end());
    sort(ends.begin(), ends.end());
    int rooms = 0, j = 0;
    for (int s : starts) {
        if (s < ends[j]) rooms++;       // starts before the earliest active meeting ends: new room
        else j++;                       // that meeting ended: reuse its room (rooms unchanged)
    }
    return rooms;
}
// Heap version (same complexity): sort by start; min-heap of end times;
// for each meeting: if heap.top() <= start, pop; push end; answer = max heap size.`,
  },
  {
    id: 99, section: "Matrix", title: "Spiral Matrix",
    difficulty: "Medium", frequency: "High", leetcode: 54,
    pattern: "Shrinking boundaries",
    intuition: "Keep four boundaries (top, bottom, left, right). Walk the top row left→right, the right column top→bottom, then, if rows remain, the bottom row right→left, and, if columns remain, the left column bottom→top. Shrink each boundary after its pass.",
    keyInsight: "The two guards (top <= bottom before the bottom row, left <= right before the left column) are the whole difficulty: they stop a single remaining row or column from being emitted twice.",
    approach: "1) Init boundaries. 2) while top<=bottom && left<=right: four passes with the two guards. 3) Return the list.",
    complexity: "Time: O(M×N) | Space: O(1) extra",
    tabCode: `vector<int> spiralOrder(vector<vector<int>>& m) {
    vector<int> out;
    if (m.empty()) return out;
    int top = 0, bottom = (int)m.size() - 1, left = 0, right = (int)m[0].size() - 1;
    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; c++) out.push_back(m[top][c]);
        top++;
        for (int r = top; r <= bottom; r++) out.push_back(m[r][right]);
        right--;
        if (top <= bottom) {                                  // guard: a single remaining row
            for (int c = right; c >= left; c--) out.push_back(m[bottom][c]);
            bottom--;
        }
        if (left <= right) {                                  // guard: a single remaining column
            for (int r = bottom; r >= top; r--) out.push_back(m[r][left]);
            left++;
        }
    }
    return out;
}`,
  },
  {
    id: 100, section: "String Parsing", title: "Basic Calculator II (+ − × ÷ with precedence)",
    difficulty: "Medium", frequency: "High", leetcode: 227,
    pattern: "One-pass with a stack of signed terms",
    intuition: "Precedence without recursion: keep a stack of terms. On + or −, push the (signed) number. On × or ÷, combine the number with the top of the stack immediately, because × and ÷ bind tighter. At the end, sum the stack.",
    keyInsight: "Apply the PREVIOUS operator when you reach the NEXT one (or the end of the string). Integer division in C++ truncates toward zero, which is what the problem asks for; do not use floor.",
    approach: "1) num = 0, op = '+', stack. 2) For each char: accumulate digits; when an operator (or the last char) arrives, apply op with num, then op = char, num = 0. 3) Sum the stack.",
    complexity: "Time: O(N) | Space: O(N) for the stack (O(1) with a running total + last term)",
    tabCode: `int calculate(string s) {
    vector<long> st; long num = 0; char op = '+';
    for (size_t i = 0; i < s.size(); i++) {
        char c = s[i];
        if (isdigit((unsigned char)c)) num = num * 10 + (c - '0');
        bool isOp = !isdigit((unsigned char)c) && c != ' ';
        if (isOp || i == s.size() - 1) {                       // apply the PREVIOUS operator
            if (op == '+') st.push_back(num);
            else if (op == '-') st.push_back(-num);
            else if (op == '*') st.back() *= num;
            else st.back() /= num;                             // truncates toward zero
            op = c; num = 0;
        }
    }
    long sum = 0; for (long v : st) sum += v;
    return (int)sum;
}`,
  },
  {
    id: 101, section: "Design", title: "Flatten Nested List Iterator",
    difficulty: "Medium", frequency: "Medium", leetcode: 341,
    pattern: "Explicit stack of (iterator, end) pairs — lazy DFS",
    intuition: "Flattening eagerly is easy but wrong for a huge or infinite structure. Keep a stack of iterator ranges, one per nesting level; hasNext() advances until the top points at an integer, descending into lists and popping exhausted ranges.",
    keyInsight: "All the work is in a single settle() routine called by both hasNext() and next(); next() must be correct even if hasNext() was never called. Advance the parent iterator BEFORE pushing the child so the list is not revisited.",
    approach: "1) Push (begin, end) of the outer list. 2) settle(): while stack non-empty: if top exhausted pop; else if top is an integer return; else push the child's range after advancing the parent. 3) next(): settle, return *cur++.",
    complexity: "Time: amortized O(1) per element | Space: O(depth)",
    tabCode: `// Uses LeetCode's NestedInteger interface: isInteger(), getInteger(), getList().
class NestedIterator {
    using It = vector<NestedInteger>::iterator;
    vector<pair<It, It>> st;                                   // (cur, end) per nesting level
    void settle() {                                            // make the top point at an integer, or empty the stack
        while (!st.empty()) {
            if (st.back().first == st.back().second) { st.pop_back(); continue; }
            if (st.back().first->isInteger()) return;
            auto& lst = st.back().first->getList();
            ++st.back().first;                                 // advance the parent BEFORE descending
            st.push_back({lst.begin(), lst.end()});
        }
    }
public:
    NestedIterator(vector<NestedInteger>& nestedList) { st.push_back({nestedList.begin(), nestedList.end()}); }
    bool hasNext() { settle(); return !st.empty(); }
    int next() { settle(); return (st.back().first++)->getInteger(); }
};`,
  },
  {
    id: 102, section: "Design", title: "LFU Cache",
    difficulty: "Hard", frequency: "Medium", leetcode: 460,
    pattern: "Frequency buckets of LRU lists + key → (value, freq, iterator)",
    intuition: "LRU needs one list; LFU needs one list PER frequency (each list ordered by recency), plus the minimum frequency. get/put move a key from its frequency list to the next one in O(1) with a stored list iterator. Eviction pops the back of the min-frequency list.",
    keyInsight: "minFreq only ever needs two updates: set to 1 on any insertion, and incremented when the key you just promoted emptied the min-frequency list. Never scan for the minimum.",
    approach: "1) byFreq: freq → list<key> (front = most recent). 2) node: key → (value, freq, iterator). 3) touch(key): unlink, bump freq, push_front, fix minFreq. 4) put on full: evict byFreq[minFreq].back().",
    complexity: "Time: O(1) per get/put | Space: O(capacity)",
    tabCode: `class LFUCache {
    int cap, minFreq = 0;
    unordered_map<int, list<int>> byFreq;                                       // freq -> keys, most recent at front
    unordered_map<int, tuple<int, int, list<int>::iterator>> node;              // key -> (value, freq, position)
    void touch(int key) {
        auto& [val, freq, it] = node[key]; (void)val;
        byFreq[freq].erase(it);
        if (byFreq[freq].empty()) { byFreq.erase(freq); if (minFreq == freq) minFreq++; }
        freq++;
        byFreq[freq].push_front(key);
        it = byFreq[freq].begin();
    }
public:
    LFUCache(int capacity) : cap(capacity) {}
    int get(int key) {
        if (!cap || !node.count(key)) return -1;
        touch(key);
        return std::get<0>(node[key]);
    }
    void put(int key, int value) {
        if (!cap) return;
        if (node.count(key)) { std::get<0>(node[key]) = value; touch(key); return; }
        if ((int)node.size() == cap) {                                            // evict LRU among the least frequent
            int victim = byFreq[minFreq].back();
            byFreq[minFreq].pop_back();
            if (byFreq[minFreq].empty()) byFreq.erase(minFreq);
            node.erase(victim);
        }
        byFreq[1].push_front(key);
        node[key] = {value, 1, byFreq[1].begin()};
        minFreq = 1;
    }
};`,
  },
  {
    id: 103, section: "Design", title: "Time-Based Key-Value Store",
    difficulty: "Medium", frequency: "High", leetcode: 981,
    pattern: "Per-key append-only log + binary search on timestamps",
    intuition: "Timestamps arrive in increasing order per key, so each key's history is a sorted vector of (timestamp, value). get(key, t) is the last entry with timestamp <= t: one upper_bound, step back one.",
    keyInsight: "Append-only sorted vectors beat a map<int,string> per key: contiguous memory, binary search over a cache-friendly array, and no allocation per set beyond the vector's growth. This is the shape of a tick store (Guide 22).",
    approach: "1) m: key → vector<pair<timestamp,value>>. 2) set: push_back. 3) get: upper_bound by timestamp; if at begin return \"\"; else prev(p)->second.",
    complexity: "Time: set O(1) amortized, get O(log N) | Space: O(total entries)",
    tabCode: `class TimeMap {
    unordered_map<string, vector<pair<int, string>>> m;      // per key: timestamps strictly increasing
public:
    void set(string key, string value, int timestamp) { m[key].emplace_back(timestamp, std::move(value)); }
    string get(string key, int timestamp) {
        auto it = m.find(key);
        if (it == m.end()) return "";
        auto& v = it->second;
        auto p = upper_bound(v.begin(), v.end(), timestamp,
                             [](int t, const pair<int, string>& e) { return t < e.first; });   // first entry with ts > timestamp
        if (p == v.begin()) return "";
        return prev(p)->second;
    }
};`,
  },
  {
    id: 104, section: "Randomized", title: "Random Pick with Weight (+ reservoir sampling)",
    difficulty: "Medium", frequency: "Medium", leetcode: 528,
    pattern: "Prefix sums + binary search; reservoir for streams",
    intuition: "Turn weights into cumulative sums; draw a uniform integer in [1, total]; the answer is the first prefix >= the draw (lower_bound). For a stream of unknown length (LC 382/398), keep one item and replace it with probability 1/k at the k-th element: reservoir sampling.",
    keyInsight: "Precompute once, O(log N) per pick; the draw must be in [1, total] (not [0, total)) with lower_bound, or zero-weight items become pickable. Reservoir sampling's proof: the k-th item survives all later replacements with probability (k/(k+1))·((k+1)/(k+2))···((n-1)/n) = k/n times 1/k = 1/n.",
    approach: "1) prefix[i] = w[0]+…+w[i]. 2) pickIndex: r = uniform(1, prefix.back()); return lower_bound(prefix, r) - begin. 3) Reservoir: iterate, replace with probability 1/k.",
    complexity: "Time: O(N) build, O(log N) pick | Space: O(N)",
    tabCode: `class Solution {
    vector<int> prefix;
    mt19937 rng{random_device{}()};
public:
    Solution(vector<int>& w) {
        prefix.reserve(w.size());
        int s = 0; for (int x : w) { s += x; prefix.push_back(s); }
    }
    int pickIndex() {
        int target = uniform_int_distribution<int>(1, prefix.back())(rng);    // [1, total]
        return (int)(lower_bound(prefix.begin(), prefix.end(), target) - prefix.begin());
    }
};
// Reservoir sampling (stream of unknown length, pick one uniformly):
// int keep = -1, k = 0;
// for (int x : stream) { k++; if (uniform_int_distribution<int>(1, k)(rng) == 1) keep = x; }`,
  },
  {
    id: 105, section: "HFT Structures", title: "Price-Level Order Book: add / cancel / best bid & ask",
    difficulty: "Medium", frequency: "Medium", leetcode: 0,
    pattern: "Direct-indexed price levels, cached best, amortized scan",
    intuition: "Prices are integer ticks on a bounded grid, so a level is an array slot: add and cancel are O(1) updates to an aggregate quantity. Best bid/ask are cached indices: an add can only improve them (compare), a cancel that empties the best level scans toward worse prices until a non-empty level.",
    keyInsight: "No tree, no hash, no allocation: a dependent cache miss (~130 ns) would be the whole per-message budget. The scan on cancel is what a bitmap of non-empty levels with find-first-set turns into O(1) per 64 levels; for tens of thousands of orders per level you add an intrusive FIFO list per level for time priority (Guide 22).",
    approach: "1) bidQty[N], askQty[N] aggregates. 2) add: qty += q; bestBid = max, bestAsk = min. 3) cancel: qty -= q; if the best level emptied, walk toward worse prices. 4) top of book = the cached indices.",
    complexity: "Time: O(1) add, amortized O(1) cancel (worst case O(N) scan, O(N/64) with a bitmap) | Space: O(N) levels",
    tabCode: `// One instrument, prices as ticks in [0, N). Quantities aggregated per level.
struct Book {
    static constexpr int N = 1 << 16;
    vector<long> bidQty = vector<long>(N, 0), askQty = vector<long>(N, 0);
    int bestBid = -1, bestAsk = N;                        // -1 / N mean "no orders on that side"
    void add(bool bid, int p, long q) {
        if (bid) { bidQty[p] += q; if (p > bestBid) bestBid = p; }
        else     { askQty[p] += q; if (p < bestAsk) bestAsk = p; }
    }
    void cancel(bool bid, int p, long q) {                // precondition: q <= resting quantity at p
        if (bid) { bidQty[p] -= q; while (bestBid >= 0 && bidQty[bestBid] == 0) bestBid--; }
        else     { askQty[p] -= q; while (bestAsk < N && askQty[bestAsk] == 0) bestAsk++; }
    }
    int topBid() const { return bestBid; }                 // -1 if empty
    int topAsk() const { return bestAsk < N ? bestAsk : -1; }
    long spread() const { return (bestBid < 0 || bestAsk >= N) ? -1 : (long)bestAsk - bestBid; }
};
// Interview follow-ups: add per-level intrusive FIFO lists for order ids (O(1) cancel by id via a hash
// table of id -> node), a 64-bit bitmap per 64 levels for O(1) "next non-empty level", and a
// sequence-number check before every update (Guide 18).`,
  },
];
