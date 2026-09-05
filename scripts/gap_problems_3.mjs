// The last three gaps named in src/data/dsaCurriculum.js GAPS (Sep 2026):
// string algorithms as coding questions, the two-heap sliding median, and
// computational geometry basics. Appended by scripts/add-gap-problems.mjs.
export const GAP_PROBLEMS_3 = [
  {
    id: 119, section: "String Parsing", title: "KMP: the Failure Function and What It Really Computes",
    difficulty: "Hard", frequency: "Medium", leetcode: 28,
    pattern: "Longest proper prefix that is also a suffix, reused as a fallback",
    intuition: "Naive matching restarts the pattern at every text position, throwing away everything it just learned. But a mismatch after k matched characters tells you a lot: those k characters ARE the pattern's own first k. So the only positions worth retrying are the ones where a proper prefix of the pattern also ends there — that is, the longest proper prefix that is also a suffix of pattern[0..k). Precompute that for every k and a mismatch becomes a jump, never a rewind of the text.",
    keyInsight: "lps[i] = the length of the longest proper prefix of pattern[0..i] that is also a suffix of it. The text pointer never moves backwards, which is what makes it O(n + m) and what makes it usable on a stream. Building lps is the same algorithm matching the pattern against itself — if you can see that, you can rederive it under pressure instead of memorising it.",
    approach: "1) Build lps in O(m): two pointers, len and i; on match lps[i++] = ++len; on mismatch fall back len = lps[len-1], or if len == 0 set lps[i++] = 0. 2) Scan the text with the same fallback rule. 3) On a full match, report and fall back to lps[m-1] to allow overlaps.",
    complexity: "Time: O(n + m) | Space: O(m)",
    tabCode: `vector<int> buildLps(const string& p) {
    vector<int> lps(p.size(), 0);
    int len = 0;
    for (size_t i = 1; i < p.size(); ) {
        if (p[i] == p[len]) lps[i++] = ++len;          // extend the current border
        else if (len)       len = lps[len - 1];        // fall back to the next shorter border; do NOT i++
        else                lps[i++] = 0;
    }
    return lps;
}

int strStr(const string& t, const string& p) {          // first index, or -1
    if (p.empty()) return 0;
    vector<int> lps = buildLps(p);
    for (size_t i = 0, j = 0; i < t.size(); ) {
        if (t[i] == p[j]) { i++; j++; if (j == p.size()) return (int)(i - j); }
        else if (j)       j = lps[j - 1];              // the text pointer never rewinds
        else              i++;
    }
    return -1;
}

// What the failure function is really worth (this is why the question gets asked):
//  - Shortest period of s: n - lps[n-1] IS the period when it divides n. So "is s a
//    repeated substring of itself" (LeetCode 459) is a one-liner on top of lps.
//  - Count all borders of s: walk lps[n-1], lps[lps[n-1]-1], ... to enumerate every
//    proper prefix that is also a suffix.
//  - Shortest palindrome by prepending (LeetCode 214): build lps of s + '#' + reverse(s);
//    lps.back() is the longest palindromic prefix, so prepend the rest reversed.
//  - Streaming: because i never decreases, KMP matches over a socket with O(m) memory.`,
  },
  {
    id: 120, section: "String Parsing", title: "Z-Algorithm and Rolling Hash (with the collision talk)",
    difficulty: "Hard", frequency: "Medium", leetcode: 1044,
    pattern: "Z-array for exact structure; polynomial hashing for O(1) substring comparison",
    intuition: "Two different tools for 'compare substrings fast'. The Z-array gives, for each i, the length of the longest substring starting at i that is also a prefix of the whole string — computed in linear time by reusing the rightmost match window instead of recomparing. A rolling hash instead maps every substring to a number so any two can be compared in O(1), at the cost of being probabilistic.",
    keyInsight: "The interview point is knowing which one to reach for and being honest about the hash. A polynomial hash mod a prime is not a proof of equality — by the birthday bound, comparing q substrings collides with probability roughly q²/(2m), so a single 32-bit modulus over a million comparisons is a near-certainty of a false match. Use a 64-bit prime modulus (or two independent moduli), pick the base randomly at run time so no fixed input can be crafted against you, and if the answer must be exact, verify a hit with a direct comparison. Saying that unprompted is the answer.",
    approach: "Z: maintain [l, r], the match window with the largest r. For i in it, seed z[i] = min(r - i, z[i - l]) then extend by comparison. Hash: h(s[l..r)) = (H[r] - H[l]·base^(r-l)) mod M, with prefix hashes H and powers precomputed.",
    complexity: "Z: O(n) time, O(n) space | Hash: O(n) build, O(1) per substring compare",
    tabCode: `vector<int> zArray(const string& s) {
    int n = s.size();
    vector<int> z(n, 0);
    z[0] = n;
    for (int i = 1, l = 0, r = 0; i < n; i++) {
        if (i < r) z[i] = min(r - i, z[i - l]);        // reuse what the window already proved
        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) z[i]++;
        if (i + z[i] > r) { l = i; r = i + z[i]; }     // r only ever grows -> linear total work
    }
    return z;
}
// Pattern search with Z: run zArray(pattern + '\\x01' + text); any z == pattern.size() is a match.

// Polynomial rolling hash. 64-bit modulus + a random base: collisions become
// something you can quote a bound for rather than hope about.
struct RollingHash {
    static constexpr unsigned long long M = (1ULL << 61) - 1;   // Mersenne prime
    vector<unsigned long long> H, P;
    static unsigned long long mul(unsigned long long a, unsigned long long b) {
        __uint128_t c = (__uint128_t)a * b;
        unsigned long long lo = (unsigned long long)(c & M), hi = (unsigned long long)(c >> 61);
        unsigned long long r = lo + hi;
        return r >= M ? r - M : r;
    }
    explicit RollingHash(const string& s, unsigned long long base) : H(s.size() + 1, 0), P(s.size() + 1, 1) {
        for (size_t i = 0; i < s.size(); i++) {
            H[i + 1] = mul(H[i], base) + (unsigned char)s[i];
            if (H[i + 1] >= M) H[i + 1] -= M;
            P[i + 1] = mul(P[i], base);
        }
    }
    unsigned long long get(size_t l, size_t r) const {           // hash of [l, r)
        unsigned long long x = H[r] + M - mul(H[l], P[r - l]);
        return x >= M ? x - M : x;
    }
};
// Choose the base at run time, never a constant:
//   mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());
//   unsigned long long base = 131 + 2 * (rng() % ((RollingHash::M - 300) / 2));
//
// Longest duplicate substring (LeetCode 1044): binary search the length L, and for each L
// put every window's hash in a hash set — monotone because a duplicate of length L implies
// one of length L-1. O(n log n) expected. VERIFY the candidate with a real comparison before
// returning it; that turns a probabilistic algorithm into a certain answer.`,
  },
  {
    id: 121, section: "Heap", title: "Sliding Window Median (two heaps with lazy deletion)",
    difficulty: "Hard", frequency: "Medium", leetcode: 480,
    pattern: "Max-heap of the low half, min-heap of the high half, rebalanced every step",
    intuition: "The median needs the middle of a set that keeps changing. Split the window in two: a max-heap holding the smaller half (its top is the largest small value) and a min-heap holding the larger half (its top is the smallest large value). Keep their sizes within one and the median is the low top, or the average of the two tops for an even window. Insertion and removal each touch one heap and then rebalance.",
    keyInsight: "A binary heap cannot delete an arbitrary element, and the value leaving the window is arbitrary. Two honest ways out: lazy deletion — mark the outgoing value in a counter map and only actually pop it when it surfaces at a top, tracking the logical sizes separately — or use an ordered multiset and keep an iterator at the median. Say which invariant you are maintaining (the size relation) before writing code; that is what the interviewer is scoring.",
    approach: "1) Insert x: push to lo if x <= lo.top() else hi; rebalance so 0 <= |lo| - |hi| <= 1. 2) Remove x: decrement delayed[x]; adjust the logical balance; prune tops. 3) Prune: while the top's delayed count is positive, pop it. 4) Median from the tops, averaging as doubles to avoid overflow.",
    complexity: "Time: O(n log k) | Space: O(k)",
    tabCode: `vector<double> medianSlidingWindow(vector<int>& nums, int k) {
    priority_queue<int> lo;                                   // max-heap: the smaller half
    priority_queue<int, vector<int>, greater<int>> hi;        // min-heap: the larger half
    unordered_map<int, int> delayed;                          // value -> pending deletions
    int loSize = 0, hiSize = 0;                               // LOGICAL sizes, ignoring pending
    vector<double> out;

    auto prune = [&](auto& heap) {
        while (!heap.empty()) {
            auto it = delayed.find(heap.top());
            if (it == delayed.end() || it->second == 0) break;
            if (--it->second == 0) delayed.erase(it);
            heap.pop();
        }
    };
    auto rebalance = [&]() {
        if (loSize > hiSize + 1) { hi.push(lo.top()); lo.pop(); loSize--; hiSize++; prune(lo); }
        else if (loSize < hiSize) { lo.push(hi.top()); hi.pop(); hiSize--; loSize++; prune(hi); }
    };

    for (int i = 0; i < (int)nums.size(); i++) {
        if (lo.empty() || nums[i] <= lo.top()) { lo.push(nums[i]); loSize++; }
        else                                   { hi.push(nums[i]); hiSize++; }
        rebalance();

        if (i >= k) {
            int gone = nums[i - k];
            delayed[gone]++;
            if (!lo.empty() && gone <= lo.top()) { loSize--; if (gone == lo.top()) prune(lo); }
            else                                 { hiSize--; if (!hi.empty() && gone == hi.top()) prune(hi); }
            rebalance();
        }
        if (i >= k - 1)
            out.push_back(k & 1 ? (double)lo.top()
                                : ((double)lo.top() + (double)hi.top()) / 2.0);   // widen BEFORE adding
    }
    return out;
}
// Two traps that fail submissions:
//  - (lo.top() + hi.top()) / 2 overflows int when both are near INT_MAX. Cast first.
//  - Tracking heap.size() instead of logical sizes: the heaps hold ghosts, so the balance
//    condition must be about the elements that are still logically in the window.
//
// The alternative worth naming: multiset<int> with an iterator parked on the median, moved
// one step whenever an insert or erase lands on one side. Simpler to argue, same complexity.
// A policy-based order-statistic tree gives find_by_order directly, which is the "right"
// data structure and the honest answer to "what would you use in production".`,
  },
  {
    id: 122, section: "Math", title: "Computational Geometry: Orientation, Hull and Closest Pair",
    difficulty: "Hard", frequency: "Low", leetcode: 587,
    pattern: "Every geometry question is the sign of a cross product",
    intuition: "The one primitive is the cross product of two edge vectors: for points O, A, B, cross = (A−O)×(B−O). Its sign says whether OAB turns counter-clockwise, clockwise, or is collinear. Convex hull, segment intersection, point-in-polygon and polygon area are all that sign applied in a loop. Learn the primitive and its overflow behaviour, not four separate algorithms.",
    keyInsight: "Use integers and never divide. Coordinates up to 1e9 make the cross product reach 4e18, which overflows a signed 64-bit only barely — use __int128 or bound the inputs and say so. Every floating-point geometry bug traces back to comparing a computed value against zero with ==; if the inputs are integral, keep them integral and the sign is exact.",
    approach: "Hull (Andrew's monotone chain): sort by (x, y); build the lower chain popping while the last turn is not counter-clockwise; build the upper chain the same way; concatenate without the duplicated endpoints. Closest pair: sort by x, divide, recurse, then check only points within the current best distance of the split line, sorted by y — at most a constant number each.",
    complexity: "Hull: O(n log n) | Closest pair: O(n log n) | Orientation: O(1)",
    tabCode: `struct P { long long x, y; };
// > 0 counter-clockwise, < 0 clockwise, == 0 collinear. __int128 so 1e9 coords cannot overflow.
long long cross(const P& o, const P& a, const P& b) {
    __int128 v = (__int128)(a.x - o.x) * (b.y - o.y) - (__int128)(a.y - o.y) * (b.x - o.x);
    return v > 0 ? 1 : (v < 0 ? -1 : 0);
}

vector<P> convexHull(vector<P> p) {                       // Andrew's monotone chain
    sort(p.begin(), p.end(), [](const P& a, const P& b) { return a.x != b.x ? a.x < b.x : a.y < b.y; });
    p.erase(unique(p.begin(), p.end(), [](const P& a, const P& b) { return a.x == b.x && a.y == b.y; }), p.end());
    if (p.size() < 3) return p;
    vector<P> h(2 * p.size());
    int k = 0;
    for (size_t i = 0; i < p.size(); i++) {               // lower hull
        while (k >= 2 && cross(h[k - 2], h[k - 1], p[i]) <= 0) k--;   // <= 0 drops collinear points
        h[k++] = p[i];
    }
    for (int i = (int)p.size() - 2, t = k + 1; i >= 0; i--) {         // upper hull
        while (k >= t && cross(h[k - 2], h[k - 1], p[i]) <= 0) k--;
        h[k++] = p[i];
    }
    h.resize(k - 1);                                      // last point repeats the first
    return h;
}
// Use < 0 instead of <= 0 in both loops to KEEP collinear boundary points (LeetCode 587 wants them).

// Twice the signed area of a polygon (shoelace). Sign gives the winding direction.
__int128 area2(const vector<P>& poly) {
    __int128 s = 0;
    for (size_t i = 0, n = poly.size(); i < n; i++) {
        const P& a = poly[i]; const P& b = poly[(i + 1) % n];
        s += (__int128)a.x * b.y - (__int128)b.x * a.y;
    }
    return s;                                             // area = |s| / 2; s > 0 means counter-clockwise
}

// Closest pair, divide and conquer. Returns the squared distance, so it stays integral.
long long closestPair(vector<P> pts) {
    sort(pts.begin(), pts.end(), [](const P& a, const P& b) { return a.x < b.x; });
    vector<P> buf(pts.size());
    auto d2 = [](const P& a, const P& b) {
        long long dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy;
    };
    auto rec = [&](auto&& self, int lo, int hi) -> long long {        // [lo, hi)
        if (hi - lo <= 3) {
            long long best = LLONG_MAX;
            for (int i = lo; i < hi; i++) for (int j = i + 1; j < hi; j++) best = min(best, d2(pts[i], pts[j]));
            sort(pts.begin() + lo, pts.begin() + hi, [](const P& a, const P& b) { return a.y < b.y; });
            return best;
        }
        int mid = (lo + hi) / 2;
        long long midX = pts[mid].x;
        long long best = min(self(self, lo, mid), self(self, mid, hi));
        merge(pts.begin() + lo, pts.begin() + mid, pts.begin() + mid, pts.begin() + hi, buf.begin(),
              [](const P& a, const P& b) { return a.y < b.y; });
        copy(buf.begin(), buf.begin() + (hi - lo), pts.begin() + lo);
        vector<P> strip;                                              // within sqrt(best) of the split
        for (int i = lo; i < hi; i++) {
            long long dx = pts[i].x - midX;
            if (dx * dx < best) strip.push_back(pts[i]);
        }
        for (size_t i = 0; i < strip.size(); i++)                     // the classic result: at most 7 ahead
            for (size_t j = i + 1; j < strip.size() && (strip[j].y - strip[i].y) * (strip[j].y - strip[i].y) < best; j++)
                best = min(best, d2(strip[i], strip[j]));
        return best;
    };
    return rec(rec, 0, (int)pts.size());
}
// Compare squared distances, never sqrt: it keeps the arithmetic exact and it is faster.`,
  },
];
