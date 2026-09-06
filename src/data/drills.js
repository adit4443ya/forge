/* ════════════════════════════════════════════════════════════════════════════
   DRILLS — "what does this print", and "find the bug".

   The highest-signal C++ drill format, because it cannot be answered from
   memorised prose: either you can execute the code in your head or you cannot.
   Every entry states the MECHANISM, not just the answer.

   Shapes match the originals in dsaData.jsx so they render through the same
   components: OUTPUT_QUIZZES_2 {code, correctAnswer, explanation, keyInsight}
   and BUG_HUNTS_2 {title, buggyCode, bugs, fixedCode, whatToSay}.
   ════════════════════════════════════════════════════════════════════════════ */

export const OUTPUT_QUIZZES_2 = [
  {
    id: 201, title: "Vector reallocation and a dangling reference", category: "Containers & Lifetime",
    code: `std::vector<int> v{1, 2, 3};
int& r = v[0];
v.push_back(4);
std::cout << r << "\\n";`,
    correctAnswer: "Undefined behaviour — r may dangle",
    explanation: "push_back can reallocate. When it does, every iterator, pointer and reference into the old buffer is invalidated, and r refers to freed memory. It frequently still prints 1, which is what makes this dangerous rather than obvious.",
    keyInsight: "Reserve first, or re-take the reference after any operation that may grow the container. ASan catches this as heap-use-after-free; without it the bug survives until the allocation pattern changes.",
  },
  {
    id: 202, title: "Static initialization order", category: "Initialization",
    code: `// a.cpp
extern int b;
int a = b + 1;
// b.cpp
extern int a;
int b = 2;`,
    correctAnswer: "a is 1 or 3 depending on link order",
    explanation: "Non-local objects with dynamic initialization in different translation units have no defined relative order. If b is initialized first a is 3; otherwise b is still zero-initialized and a is 1.",
    keyInsight: "The fix is a function-local static, constructed on first use and thread-safe since C++11. constinit is the other answer when you want the variable mutable but initialized at compile time.",
  },
  {
    id: 203, title: "Integer promotion in a comparison", category: "Type System",
    code: `int i = -1;
unsigned u = 1;
std::cout << (i < u ? "less" : "not less") << "\\n";`,
    correctAnswer: "not less",
    explanation: "The usual arithmetic conversions convert both operands to unsigned int, so -1 becomes 4294967295, which is not less than 1.",
    keyInsight: "This is why comparing a signed loop counter against .size() warns. Either make the counter the container's size_type, or use std::ssize (C++20) to get a signed size. -Wsign-compare exists precisely for this.",
  },
  {
    id: 204, title: "Order of evaluation of function arguments", category: "Operator Semantics",
    code: `int i = 0;
auto f = [](int a, int b) { return a * 10 + b; };
std::cout << f(i++, i++) << "\\n";`,
    correctAnswer: "Unspecified — 1 or 10 depending on the compiler",
    explanation: "Since C++17 each argument is fully evaluated before the next begins, but the ORDER between them is still unspecified. So one call sees (0,1) and another (1,0).",
    keyInsight: "C++17 removed the undefined behaviour here — it is now merely unspecified, which is still a bug. The distinction is worth stating: unspecified means one of a set of valid outcomes; undefined means anything at all.",
  },
  {
    id: 205, title: "Slicing on assignment", category: "Object Model",
    code: `struct Base { virtual void f() { std::cout << "Base\\n"; } };
struct Derived : Base { void f() override { std::cout << "Derived\\n"; } };
Derived d;
Base b = d;     // by value
b.f();`,
    correctAnswer: "Base",
    explanation: "Copying a Derived into a Base object copies only the Base subobject — the derived parts are sliced off, and the vptr is Base's. Virtual dispatch works through references and pointers, never through a by-value copy.",
    keyInsight: "This is why polymorphic base classes are usually made non-copyable, or their copy operations protected. Passing by value where you meant a reference is the usual way it arrives.",
  },
  {
    id: 206, title: "A lambda capturing by reference outliving the frame", category: "Lifetime",
    code: `std::function<int()> make() {
    int x = 42;
    return [&] { return x; };
}
std::cout << make()() << "\\n";`,
    correctAnswer: "Undefined behaviour — x is gone",
    explanation: "The default-reference capture binds to the local x, which dies when make returns. Calling the lambda afterwards reads a dead stack slot; it commonly prints 42 anyway because the frame has not been overwritten yet.",
    keyInsight: "`[&]` is safe only when the lambda cannot outlive the enclosing scope — a std::sort comparator, say. Anything stored or returned should capture by value, and capturing `this` by reference is the same trap in class code.",
  },
  {
    id: 207, title: "Signed overflow and a loop the compiler deletes", category: "Undefined Behaviour",
    code: `for (int i = 1; i > 0; i *= 2)
    count++;`,
    correctAnswer: "May loop forever at -O2",
    explanation: "Signed overflow is undefined, so the compiler may assume i stays positive, which makes the condition always true and lets it remove the test entirely. At -O0 the value wraps and the loop ends.",
    keyInsight: "The classic 'works in debug, hangs in release'. Use an unsigned type where wraparound is defined, or check against the limit before multiplying. UBSan reports it immediately.",
  },
  {
    id: 208, title: "std::string_view over a temporary", category: "Lifetime",
    code: `std::string_view sv = std::string("hello") + " world";
std::cout << sv << "\\n";`,
    correctAnswer: "Undefined behaviour — the temporary is destroyed",
    explanation: "The concatenation produces a temporary std::string which is destroyed at the end of the full expression. The view then points at freed memory. Lifetime extension does not apply — string_view is not a reference.",
    keyInsight: "The rule for every non-owning view, span included: it must never outlive its owner. That makes them good parameter types, rarely good return types, and almost never good members.",
  },
  {
    id: 209, title: "Deleting through a base without a virtual destructor", category: "Object Model",
    code: `struct B { ~B() { std::cout << "~B\\n"; } };
struct D : B { std::vector<int> big; ~D() { std::cout << "~D\\n"; } };
B* p = new D;
delete p;`,
    correctAnswer: "Prints ~B only — undefined behaviour, and D's vector leaks",
    explanation: "Deleting a derived object through a base pointer with a non-virtual destructor is undefined. In practice only ~B runs, so D's members are never destroyed and its allocation leaks.",
    keyInsight: "Either give a polymorphic base a virtual destructor, or make the destructor protected and non-virtual so deleting through the base does not compile. The second is the right choice when you never delete polymorphically — it costs no vptr.",
  },
  {
    id: 210, title: "Erasing while iterating", category: "Containers & Lifetime",
    code: `std::vector<int> v{1, 2, 3, 4};
for (auto it = v.begin(); it != v.end(); ++it)
    if (*it % 2 == 0) v.erase(it);`,
    correctAnswer: "Undefined behaviour — it is invalidated by erase",
    explanation: "erase invalidates the iterator it was given and everything after it. Incrementing an invalidated iterator is undefined; with consecutive even numbers it also skips elements even when it appears to work.",
    keyInsight: "erase returns the iterator to the next element: `it = v.erase(it);` and only `++it` otherwise. For a whole-container filter, erase-remove, or std::erase(v, x) in C++20.",
  },
  {
    id: 211, title: "Shifting by the width of the type", category: "Undefined Behaviour",
    code: `int x = 1;
int n = 32;
std::cout << (x << n) << "\\n";`,
    correctAnswer: "Undefined behaviour — commonly prints 1",
    explanation: "Shifting by an amount greater than or equal to the width of the promoted left operand is undefined. On x86 the shift instruction masks the count to 5 bits, so 32 becomes 0 and x is unchanged — which is why it prints 1 rather than 0.",
    keyInsight: "The hardware behaviour is not the language's guarantee, and a compiler that constant-folds may produce something else entirely. Widen first — `1ULL << n` — or guard the shift count.",
  },
  {
    id: 212, title: "The most vexing parse", category: "Initialization",
    code: `struct Timer { Timer() { std::cout << "constructed\\n"; } };
int main() {
    Timer t();
    std::cout << "done\\n";
}`,
    correctAnswer: "Prints only 'done'",
    explanation: "`Timer t();` declares a function named t taking no arguments and returning Timer. No object is created, so no constructor runs.",
    keyInsight: "Braces remove the ambiguity: `Timer t{};`. The same parse bites harder with arguments — `Widget w(Gadget());` declares a function taking a function pointer.",
  },
  {
    id: 213, title: "A virtual call from a constructor", category: "Object Model",
    code: `struct B { B() { f(); } virtual void f() { std::cout << "B::f\\n"; } };
struct D : B { void f() override { std::cout << "D::f\\n"; } };
D d;`,
    correctAnswer: "B::f",
    explanation: "During the base constructor the object's dynamic type is still Base — the vptr has not yet been updated to Derived's table. So the call resolves to B::f, not the override.",
    keyInsight: "Well-defined, and almost never what the author meant. If the base needs derived behaviour at construction, pass it in or use two-phase initialization. The mirror case applies in destructors, where the vptr has already been reset." ,
  },
  {
    id: 214, title: "Capturing a structured binding", category: "Type System",
    code: `std::map<std::string, int> m{{"a", 1}, {"b", 2}};
int total = 0;
for (auto [k, v] : m) total += v;   // note: no reference`,
    correctAnswer: "Correct total, but copies every key and value",
    explanation: "`auto [k, v]` binds to members of a COPY of each pair. For a map of strings that is a string copy — and likely an allocation — on every iteration of a loop you believed was a scan.",
    keyInsight: "Use `const auto&` unless you intend the copy. Note also that `auto&` will not let you assign to k: a map's value_type is pair<const Key, T>, so the key is const regardless.",
  },
  {
    id: 215, title: "Comparing floating point after reassociation", category: "Numerics",
    code: `float a = 0.1f, b = 0.2f;
std::cout << (a + b == 0.3f ? "equal" : "not equal") << "\\n";`,
    correctAnswer: "not equal",
    explanation: "None of 0.1, 0.2 or 0.3 is representable in binary floating point. The rounding of the sum differs from the rounding of the literal, so the bit patterns differ.",
    keyInsight: "Compare with a tolerance chosen from the magnitudes involved, not a fixed epsilon. And the deeper point for compilers: because addition is not associative, the compiler may not reassociate a floating-point sum without permission — which is exactly why a reduction loop does not auto-vectorise.",
  },
];

export const BUG_HUNTS_2 = [
  {
    id: 251, title: "An SPSC queue with the wrong memory orders", category: "Concurrency",
    buggyCode: `template <class T, size_t N>
class Spsc {
    T buf[N];
    std::atomic<size_t> head{0}, tail{0};
public:
    bool push(const T& v) {
        size_t t = tail.load(std::memory_order_relaxed);
        if (t - head.load(std::memory_order_relaxed) == N) return false;
        buf[t % N] = v;
        tail.store(t + 1, std::memory_order_relaxed);   // BUG
        return true;
    }
    bool pop(T& out) {
        size_t h = head.load(std::memory_order_relaxed);
        if (h == tail.load(std::memory_order_relaxed)) return false;   // BUG
        out = buf[h % N];
        head.store(h + 1, std::memory_order_relaxed);   // BUG
        return true;
    }
};`,
    bugs: [
      "The producer's tail store is relaxed, so the write to buf[t % N] can become visible AFTER the index that advertises it. The consumer can read the slot before the value lands.",
      "The consumer's load of tail is relaxed, so it establishes no happens-before with the producer's write — even a correct store order would not help.",
      "head is stored relaxed, so the producer can see the slot freed before the consumer has finished reading it, and overwrite a value still being copied out.",
      "head and tail share a cache line, so every producer write invalidates the consumer's copy: false sharing on the hot path.",
    ],
    fixedCode: `template <class T, size_t N>
class Spsc {
    static_assert((N & (N - 1)) == 0, "power of two");
    T buf[N];
    alignas(64) std::atomic<size_t> head{0};   // own cache line
    alignas(64) std::atomic<size_t> tail{0};
public:
    bool push(const T& v) {
        size_t t = tail.load(std::memory_order_relaxed);         // only this thread writes tail
        if (t - head.load(std::memory_order_acquire) == N) return false;
        buf[t & (N - 1)] = v;
        tail.store(t + 1, std::memory_order_release);            // publishes the slot write
        return true;
    }
    bool pop(T& out) {
        size_t h = head.load(std::memory_order_relaxed);         // only this thread writes head
        if (h == tail.load(std::memory_order_acquire)) return false;   // sees the slot write
        out = buf[h & (N - 1)];
        head.store(h + 1, std::memory_order_release);            // publishes the slot as free
        return true;
    }
};`,
    whatToSay:
      "The rule is that each side loads its OWN index relaxed — nobody else writes it — and the OTHER side's index with acquire, storing its own with release. That release/acquire pair is what carries the slot's contents across. Then pad head and tail to separate cache lines, because otherwise the two threads fight over one line on every operation. On x86 the wrong version usually works, which is why this needs a model argument and not a test.",
  },
  {
    id: 252, title: "A cache that returns expired values", category: "Correctness",
    buggyCode: `class Cache {
    struct E { int v; long expires; };
    std::unordered_map<int, E> m;
    std::list<int> lru;
public:
    int get(int k, long now) {
        auto it = m.find(k);
        if (it == m.end()) return -1;
        lru.remove(k);                 // BUG: O(n)
        lru.push_front(k);
        return it->second.v;           // BUG: never checks expiry
    }
    void put(int k, int v, long now, long ttl) {
        if (m.size() == cap) {
            m.erase(lru.back());       // BUG: evicts by recency even if something is expired
            lru.pop_back();
        }
        m[k] = {v, now + ttl};
        lru.push_front(k);             // BUG: duplicate key pushed twice
    }
};`,
    bugs: [
      "get never compares against expires, so it returns stale values forever — the TTL is decorative.",
      "lru.remove(k) is a linear scan, making the advertised O(1) get an O(n) one. Store an iterator into the list alongside the value and splice instead.",
      "put pushes the key again without removing the old entry, so the list accumulates duplicates and the eviction picks a key that may no longer be the oldest.",
      "Eviction always removes the least recently used even when expired entries are sitting in the map — dead entries survive while live ones are thrown away.",
    ],
    fixedCode: `class Cache {
    struct Node { int key, val; long expires; };
    size_t cap;
    std::list<Node> order;                                  // front = most recent
    std::unordered_map<int, std::list<Node>::iterator> at;  // key -> its node
public:
    explicit Cache(size_t c) : cap(c) {}
    int get(int k, long now) {
        auto it = at.find(k);
        if (it == at.end()) return -1;
        if (it->second->expires <= now) {                   // expired is a MISS
            order.erase(it->second); at.erase(it); return -1;
        }
        order.splice(order.begin(), order, it->second);     // O(1), iterator stays valid
        return it->second->val;
    }
    void put(int k, int v, long now, long ttl) {
        auto it = at.find(k);
        if (it != at.end()) {                               // update in place, no duplicate
            it->second->val = v; it->second->expires = now + ttl;
            order.splice(order.begin(), order, it->second);
            return;
        }
        while (!order.empty() && order.back().expires <= now) {   // drain dead before evicting live
            at.erase(order.back().key); order.pop_back();
        }
        if (order.size() == cap) { at.erase(order.back().key); order.pop_back(); }
        order.push_front({k, v, now + ttl});
        at[k] = order.begin();
    }
};`,
    whatToSay:
      "Two policies interact and the code only implemented one. Expiry is checked lazily on read, so an expired hit is a miss and is removed on sight; capacity eviction then drains expired entries from the tail before it evicts a live one. The O(1) claim needs the map to store a list iterator so the move to front is a splice, not a search. State the invariant — the map and the list always hold the same key set, once each — and every bug here is a violation of it.",
  },
  {
    id: 253, title: "A parser that trusts its input", category: "Safety",
    buggyCode: `struct Header { uint16_t len; uint8_t type; };
void handle(const char* buf, size_t n) {
    const Header* h = reinterpret_cast<const Header*>(buf);   // BUG x2
    if (h->len > n) return;
    char msg[256];
    memcpy(msg, buf + sizeof(Header), h->len);                // BUG
    dispatch(h->type, msg, h->len);
}`,
    bugs: [
      "n is never checked to be at least sizeof(Header) before dereferencing h — a 1-byte packet reads past the end.",
      "The cast assumes buf is suitably aligned for Header and that the layout matches the wire format. Neither is guaranteed; on a strict-alignment target it faults, and padding or endianness can differ.",
      "h->len is bounded against n but not against sizeof(msg), so a length between 256 and n overflows the stack buffer.",
      "len is read directly from the wire with no endianness conversion, so the same code disagrees with itself across architectures.",
    ],
    fixedCode: `void handle(const char* buf, size_t n) {
    if (n < sizeof(uint16_t) + sizeof(uint8_t)) return;       // enough for the header

    uint16_t len_be;
    std::memcpy(&len_be, buf, sizeof len_be);                 // no alignment assumption
    const uint16_t len = ntohs(len_be);                       // explicit endianness
    const uint8_t type = static_cast<uint8_t>(buf[2]);

    const size_t body = n - 3;
    if (len > body) return;                                   // fits in what we received
    if (len > MAX_BODY) return;                               // and in what we can hold

    std::array<char, MAX_BODY> msg{};
    std::memcpy(msg.data(), buf + 3, len);
    dispatch(type, msg.data(), len);
}`,
    whatToSay:
      "Every field arriving from the network is attacker-controlled until it has been bounded. The three checks are: enough bytes for the header before reading it, the declared length against the bytes actually received, and the declared length against the destination's capacity — the last is the one that was missing and the one that is a stack smash. Read fields with memcpy rather than a struct cast so there is no alignment or layout assumption, and convert endianness explicitly.",
  },
  {
    id: 254, title: "A thread pool that loses wakeups", category: "Concurrency",
    buggyCode: `class Pool {
    std::queue<Job> q;
    std::mutex m;
    std::condition_variable cv;
    bool stop = false;
public:
    void submit(Job j) {
        q.push(std::move(j));            // BUG: no lock
        cv.notify_one();
    }
    void worker() {
        for (;;) {
            std::unique_lock lk(m);
            if (q.empty()) cv.wait(lk);  // BUG: no predicate
            if (stop) return;            // BUG: may return with jobs pending
            Job j = std::move(q.front()); q.pop();
            lk.unlock();
            j();
        }
    }
};`,
    bugs: [
      "submit pushes without holding the mutex — a data race with the workers, and the notify can be lost between a worker's empty check and its wait.",
      "cv.wait without a predicate does not handle spurious wakeups, and re-checking with `if` rather than `while` means a woken worker can proceed on an empty queue.",
      "The stop flag is checked after the wait but is written elsewhere without synchronisation, and returning on stop while the queue still holds jobs silently drops them.",
      "j() runs after unlocking, which is correct, but an exception escaping the job terminates the worker thread and the pool quietly shrinks.",
    ],
    fixedCode: `class Pool {
    std::queue<Job> q;
    mutable std::mutex m;
    std::condition_variable cv;
    bool stop = false;
public:
    void submit(Job j) {
        { std::lock_guard lk(m); q.push(std::move(j)); }   // lock covers the push
        cv.notify_one();                                    // notify outside the lock
    }
    void worker() {
        for (;;) {
            Job j;
            {
                std::unique_lock lk(m);
                cv.wait(lk, [this] { return stop || !q.empty(); });   // predicate: no lost or spurious wakeup
                if (q.empty()) return;                                // stop AND drained
                j = std::move(q.front()); q.pop();
            }
            try { j(); } catch (...) { /* log; the worker survives */ }
        }
    }
    void shutdown() {
        { std::lock_guard lk(m); stop = true; }
        cv.notify_all();
    }
};`,
    whatToSay:
      "A condition variable is not a signal — it carries no state, so every wait needs a predicate over state protected by the same mutex. That single change fixes both the lost wakeup and the spurious one. The push must be under the lock or the predicate is racing with it. Draining on shutdown is a policy decision that should be explicit: this version returns only when the queue is empty, so submitted work is not silently discarded. And a job that throws must not take the worker with it.",
  },
];
