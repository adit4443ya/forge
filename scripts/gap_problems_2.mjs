// Thirteen problems that close the remaining curriculum gaps named in
// src/data/dsaCurriculum.js GAPS (Sep 2026): skyline and interval counts,
// matrix simulation, a real expression parser, iterator and rate-limiter
// design, consistent hashing, LRU with TTL, bit and number-theory idioms,
// and the ring buffer and timer wheel as coding questions.
// Appended to PROBLEMS by scripts/add-gap-problems.mjs.
export const GAP_PROBLEMS_2 = [
  {
    id: 106, section: "Intervals", title: "The Skyline Problem",
    difficulty: "Hard", frequency: "Medium", leetcode: 218,
    pattern: "Sweep line with a multiset of live heights",
    intuition: "Walk left to right. The outline changes only at building edges, and at any x the outline height is simply the tallest building currently covering x. So: turn each building into two events (its left edge enters a height, its right edge removes one), sort the events, and keep the set of live heights in a structure that gives you the maximum and supports removing one specific value.",
    keyInsight: "Everything hard is in the tie-breaking at equal x. Starts must be processed before ends (otherwise a building that ends where another begins produces a phantom dip to zero), taller starts before shorter ones (so the first emitted point is the true maximum), and shorter ends before taller ones (so a taller building's removal is not preceded by an intermediate step). Encoding a start as negative height and sorting pairs ascending gets all three for free.",
    approach: "1) For each (L, R, H) push (L, -H) and (R, +H). 2) Sort. 3) multiset<int> live{0} — the 0 is the ground and means you never check for empty. 4) For each event: insert -h or erase one copy of h. 5) If the new max differs from the last emitted height, emit (x, max).",
    complexity: "Time: O(N log N) — 2N events, each an O(log N) multiset operation | Space: O(N)",
    tabCode: `vector<vector<int>> getSkyline(vector<vector<int>>& b) {
    vector<pair<int,int>> ev;                 // (x, h): h < 0 means a building starts here, h > 0 means one ends
    for (auto& v : b) { ev.push_back({v[0], -v[2]}); ev.push_back({v[1], v[2]}); }
    sort(ev.begin(), ev.end());               // equal x: starts before ends, tallest start first, shortest end first
    multiset<int> live{0};                    // 0 = the ground; the answer at any x is *live.rbegin()
    vector<vector<int>> out;
    int prev = 0;
    for (auto [x, h] : ev) {
        if (h < 0) live.insert(-h);
        else       live.erase(live.find(h));  // erase ONE copy, not every building of that height
        int cur = *live.rbegin();
        if (cur != prev) { out.push_back({x, cur}); prev = cur; }
    }
    return out;
}
// Interview follow-ups worth having ready:
//  - A lazy-deletion max-heap works instead of the multiset: pop while the top's right edge <= x.
//  - Divide and conquer (merge two skylines like merge sort) is O(N log N) too and is the version
//    that generalizes to "union of rectangles" style questions.`,
  },
  {
    id: 107, section: "Intervals", title: "Maximum Overlap of Streaming Bookings (My Calendar III)",
    difficulty: "Hard", frequency: "Medium", leetcode: 732,
    pattern: "Difference array over an ordered map (interval counts)",
    intuition: "Counting how many intervals cover a point is a prefix sum over a difference array: +1 at each start, −1 at each end, then a running sum. The coordinates are sparse, so hold the difference array in an ordered map keyed by coordinate instead of a dense vector, and the running sum over the map in key order gives the overlap count at every boundary.",
    keyInsight: "The maximum overlap can only change at an interval boundary, so walking the sorted boundaries is exhaustive. Half-open intervals [s, e) mean a booking ending at e and one starting at e do not overlap — the −1 at e must be applied before the +1 at e is counted, which the running sum does naturally if both live in the same map entry.",
    approach: "1) delta[s] += 1, delta[e] -= 1. 2) Walk the map in order, accumulating; track the max. 3) Return the max. For a scalable version replace the linear walk with a segment tree over coordinate-compressed points using range-add and global-max with lazy propagation.",
    complexity: "Time: O(N) per booking with the map walk, O(N²) total; O(log N) per booking with a lazy segment tree | Space: O(N)",
    tabCode: `class MyCalendarThree {
    map<int,int> delta;                       // coordinate -> net change in "number of active bookings"
public:
    int book(int s, int e) {                  // half-open [s, e)
        ++delta[s]; --delta[e];
        int run = 0, best = 0;
        for (auto& [x, d] : delta) { run += d; best = max(best, run); }
        return best;
    }
};
// The same idea answers a whole family: "minimum rooms" (max of the running sum),
// "is any point covered k times" (any prefix >= k), "total covered length" (sum of gaps where run > 0),
// and "employee free time" (gaps where run == 0). Learn the difference array once, reuse it everywhere.
//
// When N is large and bookings stream in, the O(N) walk per call is the bottleneck. Compress the
// coordinates you have seen (or use a dynamic segment tree) and do range-add on [s, e) with lazy
// propagation, tracking the global max: O(log N) per booking.`,
  },
  {
    id: 108, section: "Matrix", title: "Rotate Image In Place",
    difficulty: "Medium", frequency: "High", leetcode: 48,
    pattern: "Decompose the rotation into transpose + reflect",
    intuition: "A 90° clockwise rotation sends (i, j) to (j, n−1−i). Doing that as one move needs a temporary matrix or a delicate four-way cycle per element. Instead notice that rotation is two reflections composed: transpose (reflect across the main diagonal) and then reverse each row (reflect across the vertical midline). Each reflection is trivially in place.",
    keyInsight: "Any rotation of a square is a product of two reflections, and reflections are involutions you can do in place with swaps. Transpose then reverse rows is clockwise; reverse rows then transpose is counter-clockwise; transpose then reverse columns is also counter-clockwise. Derive the composition order on a 2×2 example rather than memorizing.",
    approach: "1) For i < j, swap a[i][j] with a[j][i] (upper triangle only — swapping both triangles undoes it). 2) Reverse each row. 3) Done; no extra memory.",
    complexity: "Time: O(N²) | Space: O(1) extra",
    tabCode: `void rotate(vector<vector<int>>& a) {         // 90 degrees clockwise, in place
    int n = a.size();
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)          // strictly upper triangle, or you swap everything back
            swap(a[i][j], a[j][i]);              // transpose
    for (auto& row : a) reverse(row.begin(), row.end());   // mirror left-right
}
// Counter-clockwise: reverse each row first, then transpose (or transpose, then reverse each column).
// 180 degrees: reverse rows and reverse columns (order irrelevant).
//
// The four-way cycle version (for the follow-up "do it in one pass"):
//   for each layer L from 0 to n/2, for each i in [L, n-1-L):
//     tmp = a[L][i]; a[L][i] = a[n-1-i][L]; a[n-1-i][L] = a[n-1-L][n-1-i];
//     a[n-1-L][n-1-i] = a[i][n-1-L]; a[i][n-1-L] = tmp;
// Correct but every index is a chance to be wrong under a clock. Say it exists; write the two-reflection version.`,
  },
  {
    id: 109, section: "Matrix", title: "Game of Life In Place",
    difficulty: "Medium", frequency: "High", leetcode: 289,
    pattern: "State encoding — keep old and new in different bits",
    intuition: "Every cell's next state depends on its neighbours' current state, so you cannot overwrite a cell before its neighbours have read it. Copying the board costs O(MN) memory. Instead keep both generations in the same integer: bit 0 holds the current state, bit 1 the next. Neighbours keep reading bit 0; you write only bit 1. One final pass shifts everything right by one.",
    keyInsight: "The trick is not the bits — it is recognizing that 'in place' with a dependency on old values means you need a representation that holds two versions at once. The same idea (encode the transition, decode at the end) handles any cellular automaton and appears in graph problems that mark 'visited this round' versus 'visited earlier'.",
    approach: "1) For each cell, count live neighbours using (v & 1). 2) Apply the rules and set bit 1 if the cell is alive next. 3) Second pass: every cell >>= 1.",
    complexity: "Time: O(MN) | Space: O(1) extra",
    tabCode: `void gameOfLife(vector<vector<int>>& b) {
    int m = b.size(), n = b[0].size();
    for (int i = 0; i < m; i++) for (int j = 0; j < n; j++) {
        int live = 0;
        for (int di = -1; di <= 1; di++) for (int dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue;
            int r = i + di, c = j + dj;
            if (r >= 0 && r < m && c >= 0 && c < n) live += b[r][c] & 1;   // bit 0 is still the OLD generation
        }
        bool alive = b[i][j] & 1;
        if (( alive && (live == 2 || live == 3)) || (!alive && live == 3)) b[i][j] |= 2;   // bit 1 = NEXT generation
    }
    for (auto& row : b) for (int& x : row) x >>= 1;
}
// Follow-ups that separate candidates:
//  - Infinite board: keep only live cells in a hash set. Count, for every neighbour of every live cell,
//    how many live cells touch it (a map from coordinate to count). Cells with count 3, or count 2 and
//    currently live, survive. Memory is proportional to live cells, not the board.
//  - Board too large for memory: process in row bands; each band needs one row of context above and below.`,
  },
  {
    id: 110, section: "String Parsing", title: "Expression Evaluator with Precedence and Parentheses (Basic Calculator III)",
    difficulty: "Hard", frequency: "High", leetcode: 772,
    pattern: "Recursive descent — one function per precedence level",
    intuition: "Precedence and parentheses are a grammar, and the shortest correct parser for a grammar is one function per level: an expression is a sum of terms; a term is a product of factors; a factor is a number, a parenthesised expression, or a unary minus applied to a factor. Each function consumes as much input as it can and returns its value. Parentheses fall out for free: a factor that sees '(' just calls the expression function recursively.",
    keyInsight: "The precedence table becomes the call graph. Higher precedence means deeper in the call chain, because the deeper function grabs its operands before the shallower one gets to combine them. Adding a new operator or a new precedence level is adding one function — the stack-based single-pass solution has to be redesigned each time. This is the same structure as a real compiler's front end, so say so.",
    approach: "1) Strip spaces once. 2) parseExpr: v = parseTerm(); while next is + or −, combine with the next parseTerm(). 3) parseTerm: same shape over * and / with parseFactor(). 4) parseFactor: '(' → parseExpr, expect ')'; '−' → negate parseFactor(); else read digits. 5) A shared cursor index i is the only state.",
    complexity: "Time: O(N) — every character is consumed exactly once | Space: O(depth of parentheses) on the call stack",
    tabCode: `class Solution {
    string s; size_t i = 0;                            // the cursor is the only parser state
    long expr() {                                      // expr := term (('+' | '-') term)*
        long v = term();
        while (i < s.size() && (s[i] == '+' || s[i] == '-')) {
            char op = s[i++];
            long r = term();
            v = (op == '+') ? v + r : v - r;
        }
        return v;
    }
    long term() {                                      // term := factor (('*' | '/') factor)*
        long v = factor();
        while (i < s.size() && (s[i] == '*' || s[i] == '/')) {
            char op = s[i++];
            long r = factor();
            v = (op == '*') ? v * r : v / r;           // C++ '/' truncates toward zero, which is what the problem wants
        }
        return v;
    }
    long factor() {                                    // factor := '(' expr ')' | '-' factor | number
        if (s[i] == '(') { i++; long v = expr(); i++; return v; }   // the second i++ consumes ')'
        if (s[i] == '-') { i++; return -factor(); }                 // unary minus (Basic Calculator I needs this)
        long v = 0;
        while (i < s.size() && isdigit((unsigned char)s[i])) v = v * 10 + (s[i++] - '0');
        return v;
    }
public:
    int calculate(string in) {
        for (char c : in) if (c != ' ') s += c;
        i = 0;
        return (int)expr();
    }
};
// This one parser solves Basic Calculator I (224: + - and parentheses), II (227: + - * / no parentheses)
// and III (772: everything). To add '^' with right associativity: a power() level between term and factor
// whose right operand is power() again, not factor(). To add comparison operators: one more level above expr.
//
// The single-pass stack version for II (push numbers; on * or / combine with the stack top immediately;
// sum the stack at the end) is worth knowing, but it does not extend cleanly. Offer it as the alternative.`,
  },
  {
    id: 111, section: "Design", title: "Peeking Iterator (one-token lookahead)",
    difficulty: "Medium", frequency: "Medium", leetcode: 284,
    pattern: "Buffer one element ahead — the tokenizer's peek",
    intuition: "The underlying iterator can only advance. To answer 'what is next' without consuming it, fetch it once and hold it in a one-slot buffer with a flag saying whether the buffer is full. peek fills the buffer if empty and returns it; next returns the buffer if full (and empties it), otherwise advances the real iterator; hasNext is true if the buffer is full or the real iterator has more.",
    keyInsight: "Every parser you have ever used is built on exactly this: a lexer with one token of lookahead. The generalization is a deque of k buffered elements for LL(k) lookahead. The subtle point in the interview is hasNext — forgetting that a buffered element counts as 'having next' is the classic bug.",
    approach: "1) Members: bool has, T cached. 2) peek: if !has, cached = base.next(), has = true; return cached. 3) next: if has, has = false, return cached; else return base.next(). 4) hasNext: has || base.hasNext().",
    complexity: "Time: O(1) per operation | Space: O(1)",
    tabCode: `class PeekingIterator : public Iterator {          // Iterator provides next() and hasNext()
    bool has = false;
    int  cached = 0;
public:
    PeekingIterator(const vector<int>& nums) : Iterator(nums) {}
    int peek() {
        if (!has) { cached = Iterator::next(); has = true; }
        return cached;
    }
    int next() {
        if (has) { has = false; return cached; }
        return Iterator::next();
    }
    bool hasNext() const { return has || Iterator::hasNext(); }   // the buffered element counts
};
// Variants that use the same skeleton:
//  - Flatten nested list / 2D vector iterator: the buffer holds the next leaf; hasNext advances through
//    empty sublists to find it, so that next() never has to search.
//  - Zigzag iterator over k lists: a queue of (list, index) pairs; pop one, yield, push back if not exhausted.
//  - "Iterator over a generator": the cached element is the only way to implement hasNext on a source
//    that cannot tell you whether it has more without producing it.`,
  },
  {
    id: 112, section: "Design", title: "Rate Limiter: Token Bucket and Sliding Windows",
    difficulty: "Medium", frequency: "High", leetcode: 359,
    pattern: "Lazy refill — compute the state you would have had, only when asked",
    intuition: "A limiter answers 'may this request proceed now' against a policy like 'at most R per second with bursts up to B'. The token bucket models it directly: a bucket holds up to B tokens and refills at R per second; a request takes one token or is refused. You never need a timer to refill — on each request compute how many tokens would have arrived since the last request, add them (capped at B), and proceed. That lazy refill is the whole trick and it makes the structure O(1) memory per client.",
    keyInsight: "There are four standard algorithms and they trade exactness for memory: fixed window (O(1), lets 2× the limit through at a boundary), sliding log (exact, O(limit) memory per client), sliding counter (O(1), approximates the log by weighting the previous window), token bucket (O(1), the only one that expresses burst and sustained rate as separate parameters, which is why it is what gets deployed). Know which one a question is really asking for.",
    approach: "1) Token bucket state: tokens, lastTimestamp, plus rate and burst. 2) allow(now): tokens = min(burst, tokens + (now − last) × rate); last = now; if tokens ≥ 1, take one and return true. 3) For per-client limiting, a map from client to bucket, evicted when idle. 4) Logger Rate Limiter (the easy LeetCode form): map message → earliest time it may print again.",
    complexity: "Time: O(1) per request | Space: O(1) per client (token bucket, sliding counter) or O(limit) per client (sliding log)",
    tabCode: `// Token bucket: sustained rate 'rate' per second, bursts up to 'burst'. Timestamps in nanoseconds.
class TokenBucket {
    double rate, burst, tokens;
    long long last = 0; bool primed = false;
public:
    TokenBucket(double ratePerSec, double burstSize)
        : rate(ratePerSec), burst(burstSize), tokens(burstSize) {}
    bool allow(long long nowNs, double cost = 1.0) {
        if (primed) tokens = min(burst, tokens + (nowNs - last) * 1e-9 * rate);   // lazy refill, no timer thread
        last = nowNs; primed = true;
        if (tokens < cost) return false;
        tokens -= cost;
        return true;
    }
};

// Sliding-window log: exact "at most 'limit' in any trailing 'window'". Memory O(limit) per client.
class SlidingLog {
    deque<long long> ts; long long window; size_t limit;
public:
    SlidingLog(long long windowNs, size_t limit) : window(windowNs), limit(limit) {}
    bool allow(long long now) {
        while (!ts.empty() && ts.front() <= now - window) ts.pop_front();
        if (ts.size() >= limit) return false;
        ts.push_back(now); return true;
    }
};

// Sliding-window counter: O(1) approximation. Weight the previous fixed window by how much of it is still
// inside the trailing window: est = prevCount * (1 - elapsedFractionOfCurrentWindow) + curCount.

// Logger Rate Limiter (LeetCode 359): each message may print at most once per 10 seconds.
class Logger {
    unordered_map<string,int> nextOk;
public:
    bool shouldPrintMessage(int t, const string& msg) {
        auto it = nextOk.find(msg);
        if (it != nextOk.end() && t < it->second) return false;
        nextOk[msg] = t + 10; return true;
    }
};
// Say in the interview: the token bucket is what network hardware and API gateways actually use; the
// interesting production questions are per-key memory (evict idle buckets), clock source (monotonic, not
// wall), and what happens under contention (one atomic CAS on a packed (tokens, last) word, or a bucket per core).`,
  },
  {
    id: 113, section: "System Design DSA", title: "Consistent Hashing Ring",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Hash both keys and nodes onto a ring; a key belongs to the next node clockwise",
    intuition: "With key % N, adding one server changes N and remaps almost every key. Instead hash the servers onto a circle of hash values and hash each key onto the same circle; a key is owned by the first server at or after it going clockwise. Adding a server only claims the keys between it and its predecessor; removing one only hands its keys to its successor. About 1/N of the keys move, which is the minimum possible.",
    keyInsight: "Two refinements make it work in practice. Virtual nodes: hash each server to many points so the load is even and a server's removal spreads across many successors instead of one. Replication: a key's replicas are the next k distinct servers clockwise. The data structure is an ordered map keyed by hash with lower_bound for the clockwise lookup, so lookup is O(log(N·V)).",
    approach: "1) ring: ordered map hash → node. 2) addNode: insert V points hash(node + '#' + i). 3) removeNode: erase those V points. 4) lookup(key): it = ring.lower_bound(hash(key)); if end, wrap to begin. 5) Replicas: walk forward collecting the first k distinct nodes.",
    complexity: "Time: O(log(NV)) lookup, O(V log(NV)) add/remove | Space: O(NV) ring points",
    tabCode: `class ConsistentHash {
    map<uint64_t, string> ring;                 // point on the circle -> node. Ordered so lower_bound = clockwise
    int vnodes;
    static uint64_t h(const string& s) {        // demo only: std::hash is not stable across implementations.
        return std::hash<string>{}(s);          // production uses a fixed, well-mixed hash (xxHash, Murmur3).
    }
public:
    explicit ConsistentHash(int virtualNodes = 128) : vnodes(virtualNodes) {}
    void addNode(const string& node) {
        for (int i = 0; i < vnodes; i++) ring[h(node + "#" + to_string(i))] = node;
    }
    void removeNode(const string& node) {
        for (int i = 0; i < vnodes; i++) ring.erase(h(node + "#" + to_string(i)));
    }
    string lookup(const string& key) const {
        if (ring.empty()) return "";
        auto it = ring.lower_bound(h(key));      // first point at or after the key, clockwise
        if (it == ring.end()) it = ring.begin(); // wrap around the circle
        return it->second;
    }
    vector<string> replicas(const string& key, int k) const {   // next k DISTINCT nodes clockwise
        vector<string> out;
        if (ring.empty()) return out;
        auto it = ring.lower_bound(h(key));
        for (size_t seen = 0; seen < ring.size() && (int)out.size() < k; seen++) {
            if (it == ring.end()) it = ring.begin();
            if (find(out.begin(), out.end(), it->second) == out.end()) out.push_back(it->second);
            ++it;
        }
        return out;
    }
};
// Alternatives to have in your pocket: jump consistent hash (no ring, O(log N), but nodes must be numbered
// 0..N-1 so it only supports removing the last one) and rendezvous / highest-random-weight hashing
// (score every node per key, pick the max: O(N) per lookup, trivial to reason about, natural for small N).
// The question behind the question is always "what moves when the membership changes" - answer that first.`,
  },
  {
    id: 114, section: "Design", title: "LRU Cache with Per-Entry TTL",
    difficulty: "Hard", frequency: "High", leetcode: 146,
    pattern: "Doubly linked list + hash map, with lazy expiry on the read path",
    intuition: "Plain LRU is a hash map from key to a node in a doubly linked list ordered by recency; a hit splices the node to the front, an insert at capacity evicts the tail. Add a TTL by storing an expiry timestamp on each node. Do not run a timer: check the timestamp when the entry is read and treat an expired hit as a miss (removing it), and when you need room, first drain expired entries from the tail before evicting a live one.",
    keyInsight: "Two policies now interact and the interviewer wants to see that you noticed. An expired entry is dead regardless of recency, so it is removed on sight; a live entry is evicted only by capacity, in LRU order. Lazy expiry means memory may hold dead entries until touched — if that matters, add a min-heap of (expiry, key) and pop it on a schedule, or keep a second list in expiry order. State which you chose and why.",
    approach: "1) Node {key, val, expires}; list<Node> with front = most recent; unordered_map key → list iterator. 2) get(key, now): miss → −1; expired → erase, −1; else splice to front, return value. 3) put(key, val, now, ttl): existing → update and splice; else pop expired from the tail, evict tail if still full, push_front, record iterator.",
    complexity: "Time: O(1) get and put (amortized, including expiry cleanup) | Space: O(capacity)",
    tabCode: `class LRUWithTTL {
    struct Node { int key, val; long long expires; };
    size_t cap;
    list<Node> order;                                   // front = most recently used
    unordered_map<int, list<Node>::iterator> at;
public:
    explicit LRUWithTTL(size_t capacity) : cap(capacity) {}

    int get(int key, long long now) {
        auto it = at.find(key);
        if (it == at.end()) return -1;
        if (it->second->expires <= now) {               // lazy expiry: an expired hit is a miss and is removed
            order.erase(it->second); at.erase(it); return -1;
        }
        order.splice(order.begin(), order, it->second); // O(1) move to front; the iterator stays valid
        return it->second->val;
    }

    void put(int key, int val, long long now, long long ttl) {
        auto it = at.find(key);
        if (it != at.end()) {
            it->second->val = val; it->second->expires = now + ttl;
            order.splice(order.begin(), order, it->second);
            return;
        }
        while (!order.empty() && order.back().expires <= now) {   // drain dead entries before evicting a live one
            at.erase(order.back().key); order.pop_back();
        }
        if (order.size() == cap) { at.erase(order.back().key); order.pop_back(); }   // true LRU victim
        order.push_front({key, val, now + ttl});
        at[key] = order.begin();
    }
};
// The honest limitation of lazy expiry: an expired entry that is not at the tail survives until it is read,
// so a live tail can be evicted ahead of it. Correct by the contract (an expired value is never returned),
// wasteful for memory. If that matters, keep a second list in expiry order, or a min-heap of (expires, key).
// What a low-latency reviewer will push on:
//  - std::list allocates a node per insert. Use a fixed pool: a vector<Node> with prev/next indices, so
//    the cache is one contiguous block and eviction is index surgery, not malloc/free.
//  - unordered_map rehashes. Reserve for capacity up front, or use open addressing keyed by a fast hash.
//  - Time source: pass 'now' in (as here) so the cache is testable and never calls a clock itself.`,
  },
  {
    id: 115, section: "Bit Manipulation", title: "Counting Bits and the Bit-Idiom Table",
    difficulty: "Medium", frequency: "High", leetcode: 338,
    pattern: "Reuse a smaller answer: popcount(i) = popcount(i >> 1) + (i & 1)",
    intuition: "You need popcount for every number from 0 to n. Computing each from scratch is O(n log n). But i >> 1 is a smaller number whose answer you already have, and shifting drops exactly one bit — the low bit — so popcount(i) = popcount(i >> 1) + (i & 1). Equivalently, i & (i − 1) clears the lowest set bit, so popcount(i) = popcount(i & (i − 1)) + 1.",
    keyInsight: "The real deliverable is the idiom table below, not this one problem. Interviewers use bit questions to check that you can see numbers as bit patterns without hesitation: clearing the lowest set bit, isolating it, testing for a power of two, and reaching for the hardware popcount and count-trailing-zeros instructions instead of loops.",
    approach: "1) dp[0] = 0. 2) For i in 1..n: dp[i] = dp[i >> 1] + (i & 1). 3) Return dp. Then be able to say every line of the idiom table cold.",
    complexity: "Time: O(n) | Space: O(n) for the output",
    tabCode: `vector<int> countBits(int n) {
    vector<int> dp(n + 1, 0);
    for (int i = 1; i <= n; i++) dp[i] = dp[i >> 1] + (i & 1);   // or: dp[i & (i - 1)] + 1
    return dp;
}

// THE IDIOM TABLE - say these without thinking.
//   x & (x - 1)          clear the lowest set bit         -> popcount loop; x && !(x & (x-1)) tests power of two
//   x & -x               isolate the lowest set bit       -> Fenwick tree step, "lowest set bit" questions
//   x | (x + 1)          set the lowest clear bit
//   x ^ (x & (x - 1))    same as x & -x
//   (x >> k) & 1         test bit k;   x | (1u << k)  set;   x & ~(1u << k)  clear;   x ^ (1u << k)  flip
//   __builtin_popcount(x), __builtin_ctz(x), __builtin_clz(x)
//                        one instruction each (POPCNT/TZCNT/LZCNT on x86 with -mpopcnt/-mbmi; always on AArch64).
//                        ctz/clz of 0 is undefined: guard it. C++20 spells them std::popcount, std::countr_zero.
//   a ^ b ^ b == a       XOR cancels -> "the number that appears once", swap-free parity tricks
//   x & (x - 1) == 0     power of two (with x != 0);   (x & (x + 1)) == 0  -> x is 2^k - 1 (all ones)
//   Gosper's hack        next larger integer with the same popcount:
//                            c = x & -x;  r = x + c;  next = (((r ^ x) >> 2) / c) | r;
//                        -> iterate all k-subsets of an n-set in increasing order
//   -x == ~x + 1         two's complement; INT_MIN has no positive counterpart, so never negate before checking
//   Never: a ^= b; b ^= a; a ^= b   to swap. It zeroes both when &a == &b, and the compiler emits a
//                        better swap from std::swap anyway.
//
// Number-theory basics that share this drawer: gcd by Euclid, modular exponentiation by squaring (problem 116),
// modular inverse via Fermat when the modulus is prime, and (a * b) % m needing 128-bit intermediates when m > 2^32.`,
  },
  {
    id: 116, section: "Math", title: "Pow(x, n) and Modular Exponentiation",
    difficulty: "Medium", frequency: "High", leetcode: 50,
    pattern: "Exponentiation by squaring — walk the bits of the exponent",
    intuition: "x^n by repeated multiplication is O(n). But x^n = (x^2)^(n/2) when n is even, and x·(x^2)^((n−1)/2) when odd, so halving the exponent each step gives O(log n). The iterative form walks the exponent's bits from low to high: keep a running square of x; whenever the current bit is 1, multiply it into the result.",
    keyInsight: "Two things go wrong under a clock. Negative exponents: −INT_MIN overflows an int, so widen n to 64 bits before negating. Modular version: (a · b) mod m overflows 64 bits when m exceeds 2^32, so the product needs a 128-bit intermediate (or a 32-bit modulus). The algorithm is the same one that computes Fibonacci in O(log n) by squaring a 2×2 matrix, and the same one behind RSA — it is worth being able to say that.",
    approach: "1) If n < 0: x = 1/x, n = −n (as long long). 2) r = 1; while n: if n & 1, r *= x; x *= x; n >>= 1. 3) Modular: same loop with % m after each multiply and 128-bit products.",
    complexity: "Time: O(log n) multiplications | Space: O(1) iterative, O(log n) recursive",
    tabCode: `double myPow(double x, int n0) {
    long long n = n0;                              // widen first: -INT_MIN does not fit in an int
    if (n < 0) { x = 1 / x; n = -n; }
    double r = 1;
    while (n) {
        if (n & 1) r *= x;                         // this bit of the exponent is set: fold in the current power
        x *= x;                                    // x^1 -> x^2 -> x^4 -> ...
        n >>= 1;
    }
    return r;
}

// b^e mod m for e >= 0. __int128 is a GCC/Clang extension; for m < 2^32 plain unsigned long long is enough.
long long modpow(long long b, long long e, long long m) {
    long long r = 1 % m;                           // handles m == 1
    b %= m; if (b < 0) b += m;
    while (e) {
        if (e & 1) r = (long long)((__int128)r * b % m);
        b = (long long)((__int128)b * b % m);
        e >>= 1;
    }
    return r;
}

long long gcd_(long long a, long long b) { while (b) { a %= b; swap(a, b); } return a; }   // Euclid, O(log)

// Modular inverse of a mod prime p (Fermat): a^(p-2) mod p. For a non-prime modulus use extended Euclid:
// find x, y with a*x + m*y = gcd(a, m); if the gcd is 1, x mod m is the inverse.
// Fibonacci in O(log n): square the matrix [[1,1],[1,0]] with the same loop; F(n) is the top-right entry.`,
  },
  {
    id: 117, section: "HFT Structures", title: "Ring Buffer, Circular Deque and Moving Average",
    difficulty: "Medium", frequency: "High", leetcode: 641,
    pattern: "Power-of-two capacity with free-running indices masked on access",
    intuition: "A fixed array with two indices, head (next to read) and tail (next to write), that wrap around. The naive version wastes a slot to tell full from empty, or keeps a separate count. The clean version lets head and tail run freely as unsigned integers and masks them on every access; then size is simply tail − head, full is size == capacity, and unsigned wraparound of the indices themselves is harmless because the subtraction is modular too.",
    keyInsight: "Capacity as a power of two turns the modulo into an AND, which matters because this structure sits on hot paths — a lock-free single-producer single-consumer queue is exactly this ring with head and tail made atomic and placed on separate cache lines. The moving-average question is the same ring plus a running sum: the element you overwrite is the one leaving the window.",
    approach: "1) buf[Cap], head = tail = 0 (size_t). 2) push_back: if full return false; buf[tail++ & mask] = v. 3) pop_front: if empty return false; out = buf[head++ & mask]. 4) push_front: buf[--head & mask] = v (unsigned wrap keeps it correct). 5) Moving average: ring of k plus sum; on push subtract the evicted value when the ring is full.",
    complexity: "Time: O(1) every operation | Space: O(capacity)",
    tabCode: `template <class T, size_t CapPow2>
class Ring {                                         // circular deque; both ends O(1); no wasted slot
    static_assert((CapPow2 & (CapPow2 - 1)) == 0, "capacity must be a power of two");
    static constexpr size_t mask = CapPow2 - 1;
    T buf[CapPow2];
    size_t head = 0, tail = 0;                       // free-running; only ever masked on access
public:
    size_t size()  const { return tail - head; }     // correct even after the counters themselves wrap (unsigned)
    bool   empty() const { return head == tail; }
    bool   full()  const { return size() == CapPow2; }
    bool push_back (const T& v) { if (full())  return false; buf[tail++ & mask] = v; return true; }
    bool push_front(const T& v) { if (full())  return false; buf[--head & mask] = v; return true; }   // wraps fine
    bool pop_front (T& out)     { if (empty()) return false; out = buf[head++ & mask]; return true; }
    bool pop_back  (T& out)     { if (empty()) return false; out = buf[--tail & mask]; return true; }
    T& front() { return buf[head & mask]; }
    T& back()  { return buf[(tail - 1) & mask]; }
};

// Moving average of the last k values from a stream (LeetCode 346): same ring, plus a running sum.
class MovingAverage {
    vector<double> buf; size_t k, n = 0; double sum = 0;
public:
    explicit MovingAverage(size_t k) : buf(k), k(k) {}
    double next(double v) {
        size_t i = n % k;                            // k need not be a power of two here; it is not on a hot path
        if (n >= k) sum -= buf[i];                   // the slot we overwrite holds the value leaving the window
        buf[i] = v; sum += v; n++;
        return sum / min(n, k);
    }
};
// The SPSC lock-free queue is this Ring with:  std::atomic<size_t> head, tail on separate cache lines
// (alignas(64)); producer loads head with acquire and stores tail with release; consumer the mirror image.
// Each side caches the other's index and re-reads it only when it appears full/empty. That is lab concurrency/03.`,
  },
  {
    id: 118, section: "HFT Structures", title: "Timer Wheel",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Bucket timers by expiry slot; advance one slot per tick",
    intuition: "A heap of timers gives O(log n) insert and O(log n) pop, and a system with a million order timeouts pays that log on every one. A timing wheel is a circular array of W slots, one per tick of time; a timer due in d ticks goes into slot (now + d) mod W, with a 'rounds' counter for delays longer than one lap. Each tick, advance one slot and fire everything there whose rounds have reached zero. Insert, cancel and tick are all O(1) amortized.",
    keyInsight: "You are trading precision for constant-time operations: a timer fires at tick granularity, never sooner and up to one tick late, which is exactly right for timeouts and heartbeats and exactly wrong for a scheduler that needs exact deadlines. Two subtleties decide the grade: the off-by-one in slot and rounds (fire delay 1 on the next tick, delay W on the W-th), and running callbacks after the slot walk, because a callback may add or cancel timers in the slot you are iterating.",
    approach: "1) slots: vector of intrusive lists; cur = current slot; a map from id to (slot, node) for O(1) cancel. 2) add(d): d = max(d,1); slot = (cur + d) mod W; rounds = (d − 1) / W. 3) tick: cur = (cur + 1) mod W; walk slot cur; rounds == 0 → collect and remove, else decrement. 4) Run collected callbacks after the walk. 5) Hierarchical wheels (a wheel per time unit: ms, s, min) cascade long timers down as they approach.",
    complexity: "Time: O(1) add, O(1) cancel, O(timers in slot) per tick | Space: O(W + timers)",
    tabCode: `class TimerWheel {
    struct Timer { uint64_t id; uint32_t rounds; function<void()> cb; };
    vector<list<Timer>> slots;
    size_t cur = 0;
    uint64_t nextId = 1;
    unordered_map<uint64_t, pair<size_t, list<Timer>::iterator>> where;   // id -> (slot, node): O(1) cancel
public:
    explicit TimerWheel(size_t wheelSize) : slots(wheelSize) {}

    uint64_t add(uint32_t delayTicks, function<void()> cb) {
        if (delayTicks == 0) delayTicks = 1;         // "fire on the next tick" is the soonest we can promise
        size_t W = slots.size();
        size_t slot   = (cur + delayTicks) % W;
        uint32_t laps = (delayTicks - 1) / W;        // delay W lands on the W-th tick, not the 2W-th
        slots[slot].push_back({nextId, laps, std::move(cb)});
        where[nextId] = {slot, std::prev(slots[slot].end())};
        return nextId++;
    }

    bool cancel(uint64_t id) {
        auto it = where.find(id);
        if (it == where.end()) return false;
        slots[it->second.first].erase(it->second.second);
        where.erase(it);
        return true;
    }

    void tick() {                                    // call once per tick of wall time
        cur = (cur + 1) % slots.size();
        auto& L = slots[cur];
        vector<function<void()>> due;
        for (auto it = L.begin(); it != L.end(); ) {
            if (it->rounds == 0) { where.erase(it->id); due.push_back(std::move(it->cb)); it = L.erase(it); }
            else                 { --it->rounds; ++it; }
        }
        for (auto& cb : due) cb();                   // outside the walk: a callback may add() or cancel()
    }
};
// Where it lives: Linux kernel timers, Netty's HashedWheelTimer, Kafka's purgatory, and every order gateway
// that needs "cancel this order if not acked in 50 ms" for a million orders. For the low-latency version:
// intrusive doubly linked nodes owned by the timer object (no std::list, no map: the handle IS the node),
// a bitmap of non-empty slots so idle ticks skip in O(1), and a hierarchy of wheels so a 1 ms wheel can
// hold a 10-minute timer without 600,000 slots. Compare honestly with a heap: the heap is exact and simpler;
// the wheel wins only when insert/cancel volume dwarfs firings, which is precisely the order-timeout workload.`,
  },
];
