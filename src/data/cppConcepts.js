/* ════════════════════════════════════════════════════════════════════════════
   C++ CONCEPTS — the second tier.

   The original twelve cover the ground every list covers: value categories,
   move, RAII, virtual dispatch, templates, UB, lambdas, layout, atomics. These
   twenty are what a low-latency or systems panel pushes into once you have
   answered those, and they are the ones candidates fall down on.

   Shape matches the original set so both render through the same component:
     title · category · explanation · keyInsight · codeExample · qa[]

   House rule for every entry: state the MECHANISM, then the consequence you
   can act on. "Prefer X" without a reason is not an answer.
   ════════════════════════════════════════════════════════════════════════════ */

export const CPP_CONCEPTS_2 = [
  {
    id: 101, title: "Copy Elision, RVO and why std::move on a return hurts",
    category: "Value Categories & References",
    explanation:
      "When a function returns a prvalue, the object is constructed directly in the caller's storage — no copy, no move, and since C++17 that elision is guaranteed for prvalues rather than merely permitted. Named RVO (returning a local variable) is still an optimization rather than a guarantee, but every mainstream compiler does it.",
    keyInsight:
      "Writing `return std::move(local)` turns the expression into an xvalue, which makes the object no longer eligible for NRVO. You have replaced a free elision with a real move — strictly worse, and for a type with no move constructor, a copy. The rule is: return the local by name and let the compiler elide.",
    codeExample: `Big make() {
    Big b;
    b.fill();
    return b;              // NRVO: constructed in the caller's storage, no move
    // return std::move(b); // WRONG: forces a move, disables NRVO
}

Big g() { return Big{}; }   // C++17: guaranteed elision, not even a move required

// The one case std::move on return IS right: returning a member or a
// parameter, where elision was never possible anyway.
struct Holder {
    std::vector<int> v;
    std::vector<int> take() && { return std::move(v); }   // member: move is correct
};`,
    qa: [
      { q: "Why is `return std::move(local)` a pessimization?", a: "It makes the return expression an xvalue rather than a prvalue naming a local, which disqualifies NRVO. You get a guaranteed move where you would have had no operation at all." },
      { q: "What changed in C++17?", a: "Elision of prvalues became mandatory: `Big g() { return Big{}; }` constructs in place and does not require Big to be movable or copyable at all. NRVO for named locals stayed optional." },
    ],
  },
  {
    id: 102, title: "Perfect forwarding, reference collapsing and std::forward",
    category: "Generic Programming",
    explanation:
      "In a deduced context, `T&&` is a forwarding reference: it binds to both lvalues and rvalues. Deduction gives T = `U&` for an lvalue and T = `U` for an rvalue, and reference collapsing (`& &&` → `&`, `&& &&` → `&&`) makes the parameter type follow. `std::forward<T>(x)` casts back to that original category.",
    keyInsight:
      "Inside the function the parameter is a named variable, which makes it an lvalue regardless of how it was deduced. Passing it on without `std::forward` silently copies where the caller passed a temporary. And `T&&` is only a forwarding reference when T is deduced on that same function — `std::vector<T>&&` and a class template's `T&&` are plain rvalue references.",
    codeExample: `template <class T>
void wrapper(T&& arg) {              // forwarding reference: T deduced here
    sink(std::forward<T>(arg));      // lvalue stays lvalue, rvalue stays rvalue
    // sink(arg);                    // WRONG: arg is a named lvalue, always copies
}

int x = 1;
wrapper(x);      // T = int&   -> int& && -> int&
wrapper(1);      // T = int    -> int&&

template <class T> void a(std::vector<T>&& v);   // NOT forwarding: T not deduced as T&&
template <class T> struct S { void f(T&& t); };  // NOT forwarding: T fixed by the class`,
    qa: [
      { q: "Why not just use std::move inside a forwarding wrapper?", a: "std::move casts unconditionally, so an lvalue the caller still owns would be moved from. std::forward casts only when T was deduced as a non-reference, preserving the caller's category." },
      { q: "When is T&& not a forwarding reference?", a: "Whenever T is not being deduced at that parameter: a class template member using the class's T, `std::vector<T>&&`, or an explicitly specified template argument." },
    ],
  },
  {
    id: 103, title: "Small buffer optimization, and where std::function allocates",
    category: "Performance & Systems",
    explanation:
      "Several standard types store small payloads inline and only reach the heap above a threshold. std::string does this for short strings (typically up to about 15 bytes on 64-bit libstdc++). std::function stores a small callable inline and heap-allocates a larger one — and the threshold is implementation-defined, not standard.",
    keyInsight:
      "A lambda capturing more than a couple of pointers can push std::function over its buffer and allocate on a path you believed was allocation-free. There is no portable way to ask how big the buffer is, so on a hot path the answer is not to use std::function: take a template parameter, or use a fixed-capacity function type you control.",
    codeExample: `std::string s = "short";              // inline, no allocation
std::string b(64, 'x');                // heap

// std::function: the capture size decides
int a{}, c{}, d{}, e{};
std::function<void()> f1 = [a]{};              // likely inline
std::function<void()> f2 = [a,c,d,e]{};        // may allocate — implementation-defined

// Hot path: take the callable as a template parameter and it is inlined,
// with no indirection and no possibility of allocation.
template <class F> void for_each_tick(F&& f) { /* ... */ f(tick); }

// Prove it rather than assume it:
void* operator new(size_t n) { std::abort(); }   // in a test build`,
    qa: [
      { q: "How do you prove a path does not allocate?", a: "Override global operator new to abort in a test build and run the path, or use a tracking allocator and assert a zero delta. Reading the code is not proof — std::function's threshold is not in the standard." },
      { q: "What replaces std::function on a hot path?", a: "A template parameter when the callable is known at compile time; a function pointer plus a void* context when it is not; or a fixed-capacity `inplace_function`-style type that fails to compile rather than allocating." },
    ],
  },
  {
    id: 104, title: "The strict aliasing rule, and how to type-pun legally",
    category: "Safety & Correctness",
    explanation:
      "The compiler may assume that pointers of unrelated types never refer to the same object. That lets it keep a value in a register across a store through a different type. Casting a float* to an int* and dereferencing violates the assumption and is undefined — the code often appears to work until an optimization level changes.",
    keyInsight:
      "char, unsigned char and std::byte may alias anything, which is why memcpy is the portable answer and why compilers recognise and eliminate it. In C++20 use std::bit_cast. A union type-pun is well-defined in C and formally not in C++, although most compilers support it as an extension — say that rather than claiming it is fine.",
    codeExample: `// UB: unrelated types
float f = 1.0f;
int bits = *reinterpret_cast<int*>(&f);        // strict aliasing violation

// Correct, and compiles to a single move:
int ok;
std::memcpy(&ok, &f, sizeof ok);

// C++20:
int best = std::bit_cast<int>(f);

// Why it matters — the compiler may hoist the load:
void scale(float* out, int* flag, int n) {
    for (int i = 0; i < n; i++)
        out[i] *= *flag;   // *flag can be kept in a register: float and int cannot alias
}`,
    qa: [
      { q: "What does -fno-strict-aliasing cost?", a: "It removes the assumption, so the compiler must reload after any store through a possibly-aliasing pointer. That is a real loss in loops. It makes broken code work rather than making it correct." },
      { q: "Why is memcpy not slow here?", a: "For a small constant size compilers lower it to a single load and store. It is a portability idiom, not a function call." },
    ],
  },
  {
    id: 105, title: "std::vector growth, iterator invalidation and reserve",
    category: "Performance & Systems",
    explanation:
      "vector grows geometrically — typically 1.5× or 2× — so push_back is amortized O(1). A reallocation moves or copies every element, invalidating all iterators, pointers and references into the container. insert and erase invalidate from the modification point onward even without reallocation.",
    keyInsight:
      "Amortized O(1) means the average; a single push_back that reallocates does unbounded work, which is exactly the call that lands in your p99.9. reserve() before a known-size fill removes it. The subtler bug is `v.push_back(v[0])` — the argument is a reference into the buffer being reallocated; the standard requires this to work, but the same pattern with your own container usually does not.",
    codeExample: `std::vector<int> v;
v.reserve(n);                    // one allocation, no reallocation during the fill
for (int i = 0; i < n; i++) v.push_back(i);

int* p = &v[0];
v.push_back(1);                  // p may now dangle

// Erase-remove, and why the two-step exists: remove() cannot change size
v.erase(std::remove(v.begin(), v.end(), 42), v.end());
std::erase(v, 42);               // C++20, one step

// Which containers keep references stable across insertion?
// deque: references stable on end insertion, iterators are not
// list, forward_list, map, set, unordered_* : stable except for erased elements`,
    qa: [
      { q: "Which containers keep references valid across insertion?", a: "The node-based ones — list, forward_list, map, set, unordered containers — because each element has its own allocation. deque keeps references valid on insertion at either end but invalidates iterators." },
      { q: "Why does shrink_to_fit exist and what does it guarantee?", a: "Nothing. It is a non-binding request; the implementation may ignore it. The portable way to actually release capacity is the swap trick: `std::vector<T>(v).swap(v)`." },
    ],
  },
  {
    id: 106, title: "unordered_map: buckets, load factor, and why it is slow",
    category: "Performance & Systems",
    explanation:
      "The standard requires reference stability across rehashing and permits erasure during iteration, which forces separate chaining: an array of buckets, each a linked list of nodes. Every element is a separate allocation, and a lookup is a hash, a modulo, an array load, then a pointer chase per collision.",
    keyInsight:
      "So unordered_map cannot be an open-addressing table, and cannot be as fast as one — the container's guarantees, not the implementation, are the limit. On a hot path use a flat open-addressing map (absl::flat_hash_map, ankerl::unordered_dense) and accept that references move. Also: the default hash for integers in libstdc++ is the identity, so sequential keys with a power-of-two bucket count cluster badly.",
    codeExample: `std::unordered_map<int, int> m;
m.reserve(n);                        // sets bucket count, avoids rehashing
m.max_load_factor(0.7f);             // rehash threshold

// The cost per lookup: hash -> modulo -> bucket array load -> node pointer chase.
// A flat table is one load in the common case.

// Sequential integer keys + identity hash + power-of-two buckets = clustering.
struct Mix {
    size_t operator()(uint64_t x) const noexcept {
        x ^= x >> 33; x *= 0xff51afd7ed558ccdULL; x ^= x >> 33;
        return x;
    }
};
std::unordered_map<uint64_t, int, Mix> better;`,
    qa: [
      { q: "Why can't the standard just use open addressing?", a: "Because it guarantees that references to elements stay valid across rehash, and open addressing moves elements. The guarantee forces node-based chaining." },
      { q: "When is std::map the better choice?", a: "When you need ordering or range queries, when the key count is small enough that log n on a warm tree beats a hash, or when you need iterator stability under erasure. Otherwise it is usually slower — pointer chasing through a red-black tree." },
    ],
  },
  {
    id: 107, title: "noexcept: what it changes, and where it is load-bearing",
    category: "Type System & Safety",
    explanation:
      "noexcept is a promise, not a request. If an exception escapes a noexcept function, std::terminate is called — there is no unwinding. In exchange the compiler may omit unwind bookkeeping, and the library queries it to choose algorithms.",
    keyInsight:
      "The load-bearing case is the move constructor. vector's reallocation gives the strong exception guarantee, so it only moves elements when the move is noexcept; otherwise it copies. Forget noexcept on your move constructor and every vector growth silently becomes a deep copy, with no diagnostic anywhere. Check with static_assert.",
    codeExample: `struct Buf {
    std::vector<char> d;
    Buf(Buf&&) noexcept = default;              // without noexcept, vector copies
    Buf& operator=(Buf&&) noexcept = default;
};
static_assert(std::is_nothrow_move_constructible_v<Buf>);

// The mechanism: move_if_noexcept
// vector<T>::reserve uses std::move_if_noexcept(elem), which yields
// T&& when the move is noexcept and const T& otherwise.

// Destructors are implicitly noexcept. Throwing from one during unwinding
// calls terminate — which is why a destructor must never let one escape.
~Conn() noexcept { try { close(); } catch (...) { /* log, swallow */ } }`,
    qa: [
      { q: "Does noexcept make code faster by itself?", a: "Rarely and only slightly — table-based unwinding costs nothing on the non-throwing path. The real gains are indirect: the library picking moves over copies, and the optimizer not having to preserve state for a landing pad." },
      { q: "When should you not mark a function noexcept?", a: "When it can genuinely fail and callers should be able to handle it. noexcept is a contract with the whole program; breaking it is a crash, not an exception." },
    ],
  },
  {
    id: 108, title: "Exceptions: the zero-cost model and what it actually costs",
    category: "Safety & Correctness",
    explanation:
      "Modern implementations use table-driven unwinding. The non-throwing path executes no extra instructions — the information needed to unwind lives in side tables, not in the code. Throwing walks those tables, which involves a runtime lookup, a lock in some implementations, and is orders of magnitude slower than a return.",
    keyInsight:
      "So 'exceptions are slow' is true only of throwing. What -fno-exceptions actually buys is code size (the tables and the landing pads) and a design discipline, not throughput on the happy path. The honest cost on a low-latency path is that a throw is unbounded and unpredictable — which is why they are banned there, not because the try block costs anything.",
    codeExample: `// Zero-cost: no instructions on the path that does not throw.
int parse(std::string_view s) {
    if (s.empty()) throw std::invalid_argument("empty");   // costs nothing until taken
    return to_int(s);
}

// The alternative when a throw is unacceptable:
std::expected<int, Error> parse2(std::string_view s) noexcept;   // C++23
// or an error code, or std::optional when there is only one failure mode.

// What -fno-exceptions removes: unwind tables, landing pads, and the
// ability of the standard library to report failure at all — operator new
// then terminates on exhaustion rather than throwing bad_alloc.`,
    qa: [
      { q: "Why are exceptions banned on a trading hot path?", a: "Not for the try block, which is free, but because a throw's cost is unbounded and data-dependent: table lookup, possible lock, destructor chain. A path budgeted in hundreds of nanoseconds cannot contain something that might take microseconds." },
      { q: "What does the strong exception guarantee mean in practice?", a: "If the operation throws, the object is unchanged. It is usually implemented copy-and-swap: do the work on a copy, then swap with a noexcept operation, so the only failure point is before any state changed." },
    ],
  },
  {
    id: 109, title: "CRTP and static polymorphism",
    category: "Generic Programming",
    explanation:
      "A class derives from a template base instantiated with the derived class itself. The base can then static_cast `this` to the derived type and call its methods — dispatch resolved at compile time, no vptr, no indirect call, and the calls inline.",
    keyInsight:
      "It buys interface reuse without runtime dispatch, which matters when the call is in a loop and tiny. What it costs is a common base type: every instantiation is an unrelated class, so you cannot hold them in one container without erasing the type again. C++20 concepts express the same constraint more directly and with better errors.",
    codeExample: `template <class Derived>
struct Strategy {
    void run(const Tick& t) {
        static_cast<Derived*>(this)->on_tick(t);   // resolved at compile time
    }
};

struct MyStrategy : Strategy<MyStrategy> {
    void on_tick(const Tick& t) { /* inlined into run */ }
};

// The limitation: Strategy<A> and Strategy<B> share no base, so
// std::vector<Strategy*> is impossible. If you need that, you need
// virtual dispatch or a type-erasing wrapper — and then you have paid
// for the indirection anyway.

// C++20 says the same thing more clearly:
template <class T> concept Tickable = requires(T t, Tick k) { t.on_tick(k); };
template <Tickable T> void run(T& s, const Tick& k) { s.on_tick(k); }`,
    qa: [
      { q: "When is CRTP the wrong choice?", a: "When you need runtime polymorphism — a heterogeneous container, a plugin boundary, or a type chosen at run time. Then virtual is simpler and the indirect call is usually not the bottleneck anyway." },
      { q: "What is the classic CRTP bug?", a: "Deriving with the wrong parameter — `struct B : Strategy<A>` — which compiles and then static_casts to an unrelated type. It is undefined behaviour and silent. A static_assert in the base that Derived actually derives from it catches this." },
    ],
  },
  {
    id: 110, title: "Type erasure: how std::function and std::any work",
    category: "Generic Programming",
    explanation:
      "Type erasure stores an object of unknown type behind a uniform interface, by pairing the storage with a table of function pointers that know how to operate on it. std::function holds the callable plus pointers to invoke, copy and destroy it; shared_ptr's deleter is erased the same way.",
    keyInsight:
      "This is virtual dispatch built by hand, so it has the same costs — an indirect call and lost inlining — plus a possible allocation when the object exceeds the inline buffer. It is worth it when you genuinely need heterogeneous storage. It is not worth it as a habit: taking a template parameter costs nothing and inlines.",
    codeExample: `// The mechanism, in miniature:
class AnyCallable {
    struct Base { virtual void call() = 0; virtual ~Base() = default; };
    template <class F> struct Impl : Base {
        F f; explicit Impl(F f) : f(std::move(f)) {}
        void call() override { f(); }
    };
    std::unique_ptr<Base> p;              // the erased object
public:
    template <class F> AnyCallable(F f) : p(std::make_unique<Impl<F>>(std::move(f))) {}
    void operator()() { p->call(); }      // indirect call, no inlining
};

// shared_ptr erases the deleter the same way, which is why
// shared_ptr<T> has one type regardless of how it was constructed:
std::shared_ptr<FILE> f(fopen("x", "r"), &fclose);`,
    qa: [
      { q: "Why does unique_ptr's deleter change its type but shared_ptr's does not?", a: "unique_ptr takes the deleter as a template parameter, so it is part of the type and adds no storage for a stateless deleter. shared_ptr erases it into the control block — one type, at the cost of an allocation and indirection." },
      { q: "What is the cost of type erasure in a loop?", a: "An indirect call the predictor must guess, and no inlining of the callee — usually the larger loss. If the set of types is known at compile time, a variant plus visit keeps the dispatch but restores inlining of the alternatives." },
    ],
  },
  {
    id: 111, title: "std::variant, visit, and what it compiles to",
    category: "Generic Programming",
    explanation:
      "variant is a tagged union: storage large enough for the largest alternative, plus an index. std::visit dispatches on that index — typically through a jump table of function pointers, though compilers can turn a small visit into a switch. No heap, no vptr.",
    keyInsight:
      "It is often described as free. It is not: a visit is still an indirect jump or a branch chain. What you actually gain over virtual dispatch is no allocation, no vptr in the object, and alternatives that can inline once the branch is resolved. The trap is valueless_by_exception — if an alternative's move constructor throws mid-assignment, the variant enters a state with no value at all.",
    codeExample: `using Msg = std::variant<Add, Cancel, Trade>;

// Overload set idiom — the readable way to visit:
template <class... Ts> struct overload : Ts... { using Ts::operator()...; };
template <class... Ts> overload(Ts...) -> overload<Ts...>;

std::visit(overload{
    [](const Add& a)    { book.add(a); },
    [](const Cancel& c) { book.cancel(c); },
    [](const Trade& t)  { book.trade(t); },
}, msg);

// sizeof(Msg) is the largest alternative plus the index plus padding —
// so one huge alternative makes every message that size. Check it:
static_assert(sizeof(Msg) <= 64);

// valueless_by_exception: only reachable if a move throws during assignment.
// Alternatives with noexcept moves make it unreachable.`,
    qa: [
      { q: "How does variant compare with a virtual base for a message handler?", a: "variant keeps everything by value — no allocation, no vptr, better locality, and the alternatives can inline. Virtual scales better to types you do not control and to an open set. If the message set is closed and known, variant is usually the better fit." },
      { q: "What is valueless_by_exception and how do you avoid it?", a: "A variant with no active alternative, reachable only when an alternative's move constructor throws during assignment. Make every alternative's move noexcept and it cannot happen." },
    ],
  },
  {
    id: 112, title: "Initialization: the rules that actually bite",
    category: "Type System & Safety",
    explanation:
      "C++ has value, default, zero, direct, copy, list and aggregate initialization, and they do not agree. `T x;` default-initializes — for a built-in with automatic storage that leaves it indeterminate. `T x{};` value-initializes, which zeroes it. Members are initialized in declaration order, not the order of the initializer list.",
    keyInsight:
      "Two concrete bugs. `std::vector<int> v(10)` gives ten zeros while `int a[10];` as a local gives ten indeterminate values. And braces prefer an initializer_list constructor, so `std::vector<int> v{10, 0}` is the two elements 10 and 0, not ten zeros — the most-vexing brace, and it silently produces a different container.",
    codeExample: `int a;        // indeterminate if local; zero if static/global
int b{};      // zero, always
int c = {};   // zero

std::vector<int> v1(10, 0);   // ten zeros
std::vector<int> v2{10, 0};   // TWO elements: 10 and 0

struct S {
    int x, y;
    S(int v) : y(v), x(y) {}  // BUG: x initialized first, from an uninitialized y
};                            // members init in DECLARATION order, not list order

// Most vexing parse: this declares a function, not an object.
// Widget w(Gadget());   -> function taking a Gadget(*)() and returning Widget
Widget w{Gadget{}};      // braces make it unambiguous`,
    qa: [
      { q: "Why does the member initializer list order not matter?", a: "It does not control the order — members are always initialized in declaration order. Writing the list in a different order is misleading and, if one member reads another, a real bug. Compilers warn with -Wreorder." },
      { q: "When do braces change meaning?", a: "Whenever the type has an initializer_list constructor: that overload is strongly preferred, so `vector<int>{10, 0}` builds two elements. For types without one, braces additionally forbid narrowing conversions, which is a reason to prefer them." },
    ],
  },
  {
    id: 113, title: "Alignment, padding and why struct order matters",
    category: "Performance & Systems",
    explanation:
      "Every type has an alignment, and members are laid out at offsets that satisfy it, inserting padding as needed. The struct's own alignment is the maximum of its members', and its size is rounded up to a multiple of that so arrays stay aligned.",
    keyInsight:
      "Declaration order therefore changes sizeof. Ordering members from largest alignment to smallest minimises padding, and on a structure you hold millions of, that is the difference between fitting a cache line and not. alignas can force a structure onto its own line to stop false sharing — the opposite problem, where you deliberately spend space.",
    codeExample: `struct Bad  { char a; double b; char c; };   // 1 + 7pad + 8 + 1 + 7pad = 24
struct Good { double b; char a, c; };        // 8 + 1 + 1 + 6pad = 16
static_assert(sizeof(Good) < sizeof(Bad));

// Deliberately spending space: keep two hot counters off one line
struct Counters {
    alignas(64) std::atomic<uint64_t> produced;
    alignas(64) std::atomic<uint64_t> consumed;
};

// Inspect rather than guess:
//   clang++ -Xclang -fdump-record-layouts -c s.cpp
//   pahole -C Bad ./a.out`,
    qa: [
      { q: "Why does sizeof round up to the alignment?", a: "So that consecutive elements of an array are each correctly aligned. Without the tail padding, element one would start at an unaligned offset." },
      { q: "What does over-aligning cost?", a: "Space, and possibly a different allocation path — an allocation with alignment greater than max_align_t needs aligned new. Padding a hot atomic to its own cache line is usually worth it; doing it to everything wastes cache." },
    ],
  },
  {
    id: 114, title: "constexpr, consteval and what actually runs at compile time",
    category: "Generic Programming",
    explanation:
      "constexpr means a function may run at compile time when its arguments allow; it does not require it. consteval (C++20) means it must. constinit asserts a variable is initialized at compile time without making it const, which is how you get a static with no runtime initialization order problem.",
    keyInsight:
      "The common misconception is that constexpr guarantees compile-time evaluation. It only guarantees eligibility — called with a runtime value, a constexpr function is an ordinary function. If you need the guarantee, use consteval, or force it with a constexpr variable or `if consteval`. Also: constexpr on a large computation moves cost from run time to build time, which is a real trade on a big codebase.",
    codeExample: `constexpr int square(int x) { return x * x; }
constexpr int a = square(4);      // compile time, guaranteed by the context
int n = read();
int b = square(n);                // run time: perfectly legal

consteval int must(int x) { return x * x; }
// int c = must(n);               // ERROR: argument not a constant expression

constinit static Table t = build();   // initialized at compile time; still mutable

// C++23: branch on how you are being evaluated
constexpr int f(int x) {
    if consteval { return slow_but_exact(x); }
    else         { return fast_runtime(x); }
}`,
    qa: [
      { q: "Why not mark everything constexpr?", a: "It constrains the implementation (no throwing paths that escape, restricted operations in older standards) and pushes work into the build. On a large codebase, heavy constexpr evaluation is a measurable compile-time cost." },
      { q: "What does constinit solve?", a: "The static initialization order fiasco for cases where you want a mutable global: it asserts the initialization happens at compile time, so no dynamic initialization can run in an unspecified order." },
    ],
  },
  {
    id: 115, title: "Inline, ODR and why the linker picks one definition",
    category: "Type System & Safety",
    explanation:
      "The One Definition Rule says a program may contain exactly one definition of any non-inline function or variable, and that all definitions of a class or inline function across translation units must be token-identical. `inline` means 'may be defined in multiple translation units; the linker will keep one', which is about linkage, not about inlining.",
    keyInsight:
      "Violating the ODR silently is one of the nastiest bugs in C++: two translation units compiled with different flags or different struct definitions link successfully, and the linker picks one arbitrarily. The symptom is a crash or wrong data far from the cause. -flto and the gold linker can detect some cases; a consistent build is the real defence.",
    codeExample: `// header.h — an inline variable, one shared instance (C++17)
inline int counter = 0;
inline int bump() { return ++counter; }

// The classic silent ODR violation:
// a.cpp:  struct Cfg { int x; };
// b.cpp:  struct Cfg { int x; int y; };   // different definition, same name
// Links fine. Sizes disagree. One of them is now writing past the end.

// Same class of bug, from flags rather than source:
//   a.cpp compiled with -DNDEBUG, b.cpp without, and a header struct that
//   has an extra member under assertions. Nothing warns.

// Anonymous namespaces give internal linkage — no ODR conflict possible:
namespace { struct Local { int x; }; }`,
    qa: [
      { q: "Does inline make the compiler inline the function?", a: "No. It is a linkage property. The inlining decision is made by the optimizer on cost, and modern compilers largely ignore the keyword as a hint. [[gnu::always_inline]] is the forcing version." },
      { q: "How do you catch an ODR violation?", a: "Build consistently; use anonymous namespaces for translation-unit-local types; -flto lets the linker see the mismatch; and ASan has an odr-violation detector for globals. There is no complete check, which is why consistency matters more than tooling." },
    ],
  },
  {
    id: 116, title: "Structured bindings, and the reference trap",
    category: "Type System & Safety",
    explanation:
      "`auto [a, b] = expr;` introduces names bound to the members of a copy of expr. `auto& [a, b] = expr;` binds to the original. The names are not variables in the usual sense — they refer to members of a hidden object — which is why they could not be captured by lambdas before C++20.",
    keyInsight:
      "The trap is iterating a map with `auto [k, v]`, which copies each pair including the key. On a map of strings that is an allocation per iteration inside a loop you thought was a scan. Use `const auto&` unless you intend the copy — and note that the key in a map's value_type is const, so `auto&` will not let you assign to it.",
    codeExample: `std::map<std::string, Big> m;

for (auto [k, v] : m)        // COPIES key and value every iteration
    use(v);

for (const auto& [k, v] : m) // no copy
    use(v);

// Works with arrays, tuples, and any aggregate:
int arr[2]{1, 2};
auto [x, y] = arr;

struct P { int a; double b; };
auto [a, b] = P{1, 2.0};

// C++20 lets a lambda capture them; before that this did not compile:
auto f = [&, k]{ return k; };`,
    qa: [
      { q: "Can you use structured bindings on your own type?", a: "Yes — either it is an aggregate with all public members, or you specialize std::tuple_size and std::tuple_element and provide get<N>. That is how a custom type joins the protocol." },
      { q: "Why does `auto& [k, v]` not let you modify k in a map?", a: "The map's value_type is pair<const Key, T>, so k binds to a const member regardless of the auto& on the outside." },
    ],
  },
  {
    id: 117, title: "shared_ptr internals: the control block and the cycle",
    category: "Resource Management",
    explanation:
      "shared_ptr holds two pointers: one to the object and one to a control block holding the strong count, the weak count, the deleter and the allocator. Copying it is an atomic increment; destruction an atomic decrement, with the object destroyed at zero strong and the control block freed at zero weak.",
    keyInsight:
      "Two costs and one bug. The atomics are unconditional — a shared_ptr copied across threads bounces a cache line even when nothing contends. make_shared allocates object and control block together, one allocation instead of two, but keeps the object's storage alive as long as any weak_ptr survives. And two objects holding shared_ptr to each other never reach zero; one side must be weak_ptr.",
    codeExample: `auto p = std::make_shared<Node>();   // one allocation, better locality
std::shared_ptr<Node> q(new Node);   // two allocations

// The cycle: neither count reaches zero, both leak
struct Node {
    std::shared_ptr<Node> next;
    std::weak_ptr<Node>   prev;      // break it with weak on one side
};

// weak_ptr must be locked to be used, which is also the thread-safe check:
if (auto s = w.lock()) s->use();     // atomically upgrades, or gives null

// enable_shared_from_this exists because this is wrong:
//   shared_ptr<T>(this)   -> a SECOND control block, double free`,
    qa: [
      { q: "When is make_shared the wrong choice?", a: "When the object is large and long-lived weak_ptrs are expected: the single allocation means the object's storage cannot be released until the last weak reference goes, so a big object stays resident. Also when you need a custom deleter, which make_shared does not take." },
      { q: "Is shared_ptr thread-safe?", a: "The control block is: copies and destructions from multiple threads are safe. The pointee is not, and neither is assigning to the same shared_ptr instance from two threads — that is a data race on the shared_ptr object itself." },
    ],
  },
  {
    id: 118, title: "Ranges and views: laziness, and the dangling trap",
    category: "Generic Programming",
    explanation:
      "A view is a lazy, non-owning adaptor. `v | std::views::filter(p) | std::views::transform(f)` builds a pipeline object; nothing runs until you iterate it, and no intermediate container is materialized. Composition is the point — the equivalent algorithm chain would allocate at each stage.",
    keyInsight:
      "Because views do not own, a view over a temporary dangles the moment the full expression ends. And laziness means side effects in a predicate run at iteration time, possibly more than once — filter's begin() has to find the first match, and caches it, which is why a filter_view's begin is not const. Treat views as expressions to be consumed, not stored.",
    codeExample: `std::vector<int> v{1,2,3,4,5,6};

auto evens = v | std::views::filter([](int x){ return x % 2 == 0; })
               | std::views::transform([](int x){ return x * x; });
for (int x : evens) use(x);          // one pass, no intermediate vector

// DANGLING: the vector dies at the end of the full expression
auto bad = make_vector() | std::views::take(3);
// for (int x : bad)  -> undefined behaviour

// Materialize when you need to keep it:
auto kept = std::ranges::to<std::vector>(
    v | std::views::filter(is_even));   // C++23

// Laziness bites with side effects:
auto logged = v | std::views::filter([](int x){ std::puts("check"); return x > 2; });
// "check" prints during iteration, not at construction`,
    qa: [
      { q: "Why is filter_view's begin() not const?", a: "It must find the first element satisfying the predicate, and it caches that position so begin() stays amortized O(1). Caching mutates, so begin() cannot be const — which also makes filter_view not a borrowed range." },
      { q: "When is a view slower than a loop?", a: "When the pipeline defeats vectorisation, or when a predicate is re-evaluated because you iterate twice. Views are a readability and composition win; they are not automatically a performance win, and a hot loop deserves a look at the generated code." },
    ],
  },
  {
    id: 119, title: "Coroutines: what co_await actually compiles to",
    category: "Concurrency & Systems",
    explanation:
      "A function containing co_await, co_yield or co_return is transformed into a state machine. Its locals that live across a suspension move into a heap-allocated coroutine frame; the promise type controls what the caller gets and what happens at each suspension point.",
    keyInsight:
      "The frame allocation is the cost that matters. It is elidable in principle — HALO, when the compiler can prove the coroutine's lifetime is contained in the caller — but that is an optimization you must verify, not assume. For a latency path, the question is not whether coroutines are elegant but whether the frame allocation is gone, and the way to know is to look at the calls to operator new in the object code.",
    codeExample: `Task<int> fetch() {
    auto a = co_await read_async();     // suspends; locals live in the frame
    co_return a + 1;
}

// The transformation, sketched:
//   struct frame { promise_type p; int state; /* locals crossing suspension */ };
//   operator new(sizeof frame)   <- the allocation, unless elided
//   resume() switches on state

// Verify the elision rather than trusting it:
//   nm -C ./a.out | grep operator.new
//   or override operator new to abort in a test build

// A custom allocator on the promise gives you control:
struct promise_type {
    static void* operator new(size_t n) { return pool().allocate(n); }
    static void operator delete(void* p, size_t n) { pool().deallocate(p, n); }
};`,
    qa: [
      { q: "When does the coroutine frame allocation get elided?", a: "When the compiler can see the whole lifetime and prove the frame does not outlive the caller — halo, heap allocation elision. It requires inlining the ramp function and is fragile across translation units, so on a hot path you check the object code." },
      { q: "Why do coroutines need a promise_type?", a: "It is the customization point: it decides the return object handed to the caller, whether the coroutine suspends at the start and end, what co_yield and co_return do, and how an escaping exception is handled." },
    ],
  },
  {
    id: 120, title: "false sharing, and the cost of an atomic in a loop",
    category: "Concurrency & Systems",
    explanation:
      "Coherence works at cache-line granularity, typically 64 bytes. Two threads writing different variables that share a line force the line to bounce between cores — every write invalidates the other's copy — so logically independent work serialises on the coherence protocol.",
    keyInsight:
      "The symptom is distinctive: throughput collapses with more threads while instruction count is unchanged. That signature — same instructions, far more cycles and coherence traffic — is what tells you it is sharing and not algorithm. The fix is padding to hardware_destructive_interference_size, or better, per-thread counters summed at the end so there is no sharing to fix.",
    codeExample: `struct Bad  { std::atomic<int> a, b; };            // same line: they fight
struct Good {
    alignas(64) std::atomic<int> a;
    alignas(64) std::atomic<int> b;
};

// Better than padding: do not share at all.
struct alignas(64) PerThread { uint64_t count; };
std::vector<PerThread> counters(nthreads);
// ... each thread touches only counters[id].count ...
uint64_t total = 0;
for (auto& c : counters) total += c.count;   // one pass at the end

// Confirm it with counters, not intuition:
//   perf stat -e cache-misses,cycles,instructions ./a.out
//   instructions flat + cycles up = sharing, not more work`,
    qa: [
      { q: "How do you distinguish false sharing from true contention?", a: "False sharing is threads touching different variables on one line — fix it by separating them and throughput returns. True contention is threads touching the same variable, where padding changes nothing and you need a different algorithm, such as per-thread accumulation." },
      { q: "Why is std::hardware_destructive_interference_size sometimes avoided?", a: "It is a compile-time constant, so it becomes part of your ABI, and libstdc++ warns about that. Many codebases use a plain 64 or query the cache line at runtime instead." },
    ],
  },
];
