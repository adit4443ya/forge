/* ════════════════════════════════════════════════════════════════════════════
   LITMUS DRILLS — "can this happen?", which is the concurrency version of
   "what does this print".

   The drill format elsewhere in this app asks for ONE answer. That is the wrong
   shape for concurrency, where the honest answer is a SET of permitted outcomes
   and the set DIFFERS BY ARCHITECTURE. A program whose bad outcome is forbidden
   on x86 and allowed on AArch64 is the single most common shape of real
   concurrency bug, and a single-answer quiz cannot express it.

   So every entry carries a verdict per model:

     sc     sequential consistency — the intuitive interleaving model
     x86    x86-TSO (store buffer, FIFO, with store-to-load forwarding)
     arm    AArch64 (weak, other-multi-copy-atomic)

   Verdict values are exactly "forbidden" or "allowed" so the renderer can
   colour them; anything needing qualification carries a `note`.

   House rules, same as the rest of the content: no claim about who asks what,
   no invented numbers. Where a lab measured the outcome, `evidence` quotes it
   and `lab` names the lab.
   ════════════════════════════════════════════════════════════════════════════ */

export const MODELS = [
  { id: "sc", label: "SC", note: "the intuitive interleaving model" },
  { id: "x86", label: "x86-TSO", note: "store buffer; only StoreLoad reorders" },
  { id: "arm", label: "AArch64", note: "weak; nothing ordered by default" },
];

/* Difficulty: 1 you should get instantly · 2 standard · 3 hard · 4 few people get this */
export const LITMUS = [
  /* ── the classical hardware litmus tests ────────────────────────────── */
  {
    id: "sb", name: "SB — Store Buffer", family: "hardware", d: 2,
    teaches: "The one reordering x86 permits, and the only pattern that genuinely needs seq_cst.",
    init: "std::atomic<int> x{0}, y{0};  int r0, r1;",
    threads: [
      { label: "Thread 0", code: "x.store(1, relaxed);\nr0 = y.load(relaxed);" },
      { label: "Thread 1", code: "y.store(1, relaxed);\nr1 = x.load(relaxed);" },
    ],
    ask: "Can the program end with r0 == 0 && r1 == 0?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    verdictFix: { sc: "forbidden" },
    scNote: "Under SC this is forbidden: no interleaving of the four statements produces it.",
    why:
      "Each thread's store sits in its own store buffer, not yet visible to anyone else, while its load "
      + "reads the other variable straight from cache. Both loads therefore see the initial 0. Nothing "
      + "exotic is required — no out-of-order execution, no compiler reordering. Just a buffer that exists "
      + "to stop the core stalling on every store.",
    fix:
      "seq_cst on all four operations, or an explicit full fence (MFENCE / DMB ISH) between each store and "
      + "the load that follows it. This is the ONE shape for which acquire/release is not enough: the two "
      + "variables are independent, so there is no single variable for a release and an acquire to pair on.",
    lab: "concurrency-05",
    evidence: "Measured over 1,000,000 trials: relaxed 8.8%, acquire/release 24.6%, seq_cst 0%. The gap between the first two is timing, not a difference in guarantees — on x86 both compile to plain mov.",
    guide: { num: "25", anchor: "part-4-the-store-buffer-forces-a-weak-memory-model" },
  },
  {
    id: "mp", name: "MP — Message Passing", family: "hardware", d: 2,
    teaches: "Publish/consume. Safe on x86 by accident, broken on AArch64 — the most common real bug.",
    init: "int data = 0;  std::atomic<int> flag{0};  int r0, r1;",
    threads: [
      { label: "Producer", code: "data = 42;\nflag.store(1, relaxed);" },
      { label: "Consumer", code: "r0 = flag.load(relaxed);\nr1 = data;" },
    ],
    ask: "Can the consumer see r0 == 1 (flag set) but r1 == 0 (data stale)?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "allowed" },
    why:
      "x86-TSO never reorders store-with-store or load-with-load, so the producer's two stores land in order "
      + "and the consumer's two loads happen in order — the bad outcome is impossible. AArch64 orders neither "
      + "by default, so the flag store can become visible before the data store, or the consumer can load data "
      + "before it loads the flag.",
    fix:
      "release on the flag store, acquire on the flag load. That single pairing forbids it on every "
      + "architecture. Note that `data` is a plain int here and is only safe BECAUSE the release/acquire pair "
      + "creates the happens-before edge; without it this is also a data race, and therefore UB.",
    lab: "concurrency-02",
    evidence: null,
    guide: { num: "25", anchor: "part-7-the-litmus-catalogue" },
    star: true,
  },
  {
    id: "lb", name: "LB — Load Buffer", family: "hardware", d: 3,
    teaches: "Load-then-store reordering: values that look like they came from the future.",
    init: "std::atomic<int> x{0}, y{0};  int r0, r1;",
    threads: [
      { label: "Thread 0", code: "r0 = x.load(relaxed);\ny.store(1, relaxed);" },
      { label: "Thread 1", code: "r1 = y.load(relaxed);\nx.store(1, relaxed);" },
    ],
    ask: "Can the program end with r0 == 1 && r1 == 1?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "allowed" },
    why:
      "The outcome requires each thread's store to become visible before its own earlier load completes — "
      + "a load reordered with a LATER store. TSO forbids that (LoadStore is ordered). A weak model permits "
      + "the store to be issued while the load is still outstanding, so each thread can read the value the "
      + "other is about to write. It looks circular, which is why it unsettles people.",
    fix:
      "Any barrier between the load and the store, or a real data dependency from the loaded value into the "
      + "stored one — a dependency the hardware must respect.",
    lab: null, evidence: null,
    guide: { num: "25", anchor: "part-7-the-litmus-catalogue" },
  },
  {
    id: "iriw", name: "IRIW — Independent Reads of Independent Writes", family: "hardware", d: 4,
    teaches: "Whether two observers can disagree about the order of two unrelated writes.",
    init: "std::atomic<int> x{0}, y{0};  int r0, r1, r2, r3;",
    threads: [
      { label: "T0", code: "x.store(1, relaxed);" },
      { label: "T1", code: "y.store(1, relaxed);" },
      { label: "T2", code: "r0 = x.load(relaxed);\nr1 = y.load(relaxed);" },
      { label: "T3", code: "r2 = y.load(relaxed);\nr3 = x.load(relaxed);" },
    ],
    ask: "Can r0==1 && r1==0 && r2==1 && r3==0 — T2 claiming x happened first, T3 claiming y did?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "allowed" },
    note:
      "On AArch64 this is allowed with PLAIN loads — but not for the reason most people give. ARMv8 is "
      + "other-multi-copy atomic, so writes do NOT propagate to different cores at different times. The "
      + "outcome comes from each reader reordering its OWN two loads. Order those loads (DMB LD, or make both "
      + "acquire) and ARMv8 forbids it. On POWER, which is not multi-copy atomic, ordering the loads is NOT "
      + "sufficient — you need cumulative barriers.",
    why:
      "x86-TSO forbids it because TSO is multi-copy atomic and does not reorder loads, so both observers see "
      + "one global store order. The test is the standard way to ask whether a model has a single global view "
      + "of independent writes.",
    fix: "Order each reader's pair of loads. On a non-multi-copy-atomic machine you additionally need cumulative barriers.",
    lab: null, evidence: null,
    guide: { num: "25", anchor: "part-7-the-litmus-catalogue" },
  },
  {
    id: "corr", name: "CoRR — Coherence, Read-Read", family: "hardware", d: 1,
    teaches: "The guarantee you always have, even with relaxed. Coherence is not consistency.",
    init: "std::atomic<int> x{0};  int r0, r1;",
    threads: [
      { label: "Writer", code: "x.store(1, relaxed);\nx.store(2, relaxed);" },
      { label: "Reader", code: "r0 = x.load(relaxed);\nr1 = x.load(relaxed);" },
    ],
    ask: "Can the reader see r0 == 2 and then r1 == 1 — the value going backwards?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "forbidden" },
    why:
      "Forbidden everywhere, including for relaxed, and including on POWER. Every atomic object has a single "
      + "total modification order, and read-read coherence forbids a later read in the same thread returning "
      + "an earlier value from it. This is why 'relaxed means anything can happen' is wrong: relaxed gives up "
      + "ordering against OTHER objects, never this object's own history.",
    fix: "Nothing to fix — this is a guarantee, not a hazard. Knowing it is a guarantee is the point.",
    lab: null, evidence: null,
    guide: { num: "25", anchor: "part-1-coherence-versus-consistency" },
  },
  {
    id: "mp-dep", name: "MP with an address dependency", family: "hardware", d: 4,
    teaches: "Why memory_order_consume exists, and why it failed.",
    init: "int data = 0;  std::atomic<int*> p{nullptr};  int r1;",
    threads: [
      { label: "Producer", code: "data = 42;\np.store(&data, release);" },
      { label: "Consumer", code: "int* q = p.load(relaxed);\nif (q) r1 = *q;   // address dep" },
    ],
    ask: "With only a relaxed load, can the consumer get a non-null q but read r1 == 0?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "forbidden" },
    note:
      "Forbidden IN HARDWARE on every mainstream architecture: the second load's address comes from the first "
      + "load's value, so the hardware cannot start it early. But it is NOT forbidden in C++, because the "
      + "COMPILER may break the dependency — by value-speculating the pointer, or by proving q must equal "
      + "&data and substituting it. That gap is exactly what memory_order_consume was meant to close.",
    why:
      "consume was specified to preserve dependency ordering at the language level, which would have made this "
      + "safe and cheaper than acquire on weak hardware. It proved impossible to specify in a way compilers "
      + "could implement without tracking dependencies through arbitrary code, so every mainstream compiler "
      + "promotes it to acquire.",
    fix: "Use acquire. Know that consume exists, know it is promoted, and do not rely on bare dependency ordering in C++.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-2-the-six-orderings-as-a-budget" },
  },
  {
    id: "dekker", name: "Dekker's algorithm without seq_cst", family: "hardware", d: 3,
    teaches: "SB wearing a disguise — mutual exclusion silently failing.",
    init: "std::atomic<bool> want0{false}, want1{false};",
    threads: [
      { label: "Thread 0", code: "want0.store(true, release);\nif (!want1.load(acquire))\n    enter_critical();" },
      { label: "Thread 1", code: "want1.store(true, release);\nif (!want0.load(acquire))\n    enter_critical();" },
    ],
    ask: "Can both threads enter the critical section at the same time?",
    verdict: { sc: "forbidden", x86: "allowed", arm: "allowed" },
    why:
      "This is SB with better naming. Each thread stores to its own flag then loads the other's; both stores "
      + "can sit in store buffers while both loads read the stale false. Release and acquire do not help: they "
      + "order accesses around ONE variable, and the hazard here is the relative order of operations on TWO. "
      + "The one-way barriers point the wrong way — a release store does not stop a LATER load from moving up "
      + "past it.",
    fix:
      "seq_cst on the stores and the loads, which imposes the global total order the algorithm assumes. This "
      + "is the clearest practical demonstration that acquire/release is not 'seq_cst but cheaper'.",
    lab: "concurrency-05", evidence: null,
    guide: { num: "25", anchor: "part-7-the-litmus-catalogue" },
  },

  /* ── compiler and API drills: the bug is above the hardware ─────────── */
  {
    id: "collapse", name: "The race the optimizer hides", family: "compiler", d: 3,
    teaches: "A data race is UB, not a stale value — and UB can make the test pass.",
    init: "int counter = 0;   // plain int, deliberately not atomic",
    threads: [
      { label: "Thread A", code: "for (int i = 0; i < 1000000; ++i)\n    ++counter;" },
      { label: "Thread B", code: "for (int i = 0; i < 1000000; ++i)\n    ++counter;" },
    ],
    ask: "After joining both threads, what can counter be?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    answerText: "Anything from 2 to 2,000,000 — and 2 is a realistic result at -O2.",
    why:
      "Because the access is non-atomic and racing, the behaviour is undefined, and the compiler may assume "
      + "no other thread touches counter. It is then free to hoist the whole loop into a register and perform "
      + "ONE store of counter + 1000000 — or, having proved nothing observable depends on the intermediate "
      + "values, to collapse it further. The danger is not that the count is wrong; it is that a test asserting "
      + "'the threads ran' can PASS.",
    fix:
      "std::atomic<int> with fetch_add(1, relaxed) — relaxed is correct here because only the final tally "
      + "matters and no other memory is being published. If the counter is hot and per-thread tallies are "
      + "acceptable, keep a padded per-thread counter and sum at the end: no coherence traffic at all.",
    lab: "concurrency-01",
    evidence: "Measured: the collapsed version performs 1 add per thread and its test passes. A second variant that does race visibly lands 2.0M of 4.0M increments. ThreadSanitizer flags both.",
    guide: { num: "27", anchor: "part-1-the-c-memory-model-precisely" },
    star: true,
  },
  {
    id: "hoist", name: "The spin loop that never ends", family: "compiler", d: 2,
    teaches: "A non-atomic read in a loop can be hoisted out of it entirely.",
    init: "bool ready = false;   // plain bool\nint data = 0;",
    threads: [
      { label: "Waiter", code: "while (!ready) { }\nuse(data);" },
      { label: "Setter", code: "data = 42;\nready = true;" },
    ],
    ask: "What does the waiter do at -O2?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    answerText: "It very commonly hangs forever — the loop becomes `if (!ready) for(;;);`",
    why:
      "The loop body has no side effects and does not modify ready, so under the no-race assumption the "
      + "compiler may load ready ONCE into a register and spin on that register. No amount of waiting helps, "
      + "because nothing re-reads memory. This is the purest demonstration that a data race is a compiler "
      + "problem before it is ever a hardware problem.",
    fix:
      "std::atomic<bool> ready, with release on the store and acquire on the load — which also fixes the "
      + "publication of `data` (this is MP). If you are spinning for real, add a pause intrinsic in the body, "
      + "and consider atomic wait/notify so you are not burning a core.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-1-the-c-memory-model-precisely" },
  },
  {
    id: "volatile", name: "volatile as the fix", family: "compiler", d: 2,
    teaches: "volatile controls neither atomicity nor inter-thread ordering.",
    init: "volatile bool ready = false;\nint data = 0;   // still a plain int",
    threads: [
      { label: "Waiter", code: "while (!ready) { }\nuse(data);" },
      { label: "Setter", code: "data = 42;\nready = true;" },
    ],
    ask: "volatile stops the hoist. Is the program now correct?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "allowed" },
    answerText: "No. The loop now terminates, but use(data) can still read 0 on a weakly-ordered machine.",
    why:
      "volatile forces the compiler to re-read `ready` from memory, which fixes the infinite loop and makes "
      + "the bug look solved. It provides no ordering between `data` and `ready` and no atomicity. On x86 the "
      + "hardware happens to supply the ordering (this is MP, forbidden under TSO), so the program passes "
      + "every test — and then fails on AArch64. volatile making a concurrency bug RARER rather than fixing it "
      + "is what makes it dangerous.",
    fix:
      "std::atomic with release/acquire. volatile's legitimate uses are memory-mapped I/O and "
      + "sig_atomic_t-style signal handler communication — neither of which is thread synchronisation.",
    lab: null, evidence: null,
    guide: { num: "25", anchor: "part-8-barriers-and-tools-that-check-your-reasoning" },
  },
  {
    id: "dclp", name: "Double-checked locking, the broken version", family: "compiler", d: 3,
    teaches: "Publishing a pointer to an object whose construction is not yet visible.",
    init: "Widget* instance = nullptr;\nstd::mutex m;",
    threads: [
      { label: "Any thread", code: "if (!instance) {\n    lock_guard lk(m);\n    if (!instance)\n        instance = new Widget();\n}\nreturn instance;" },
      { label: "Another thread", code: "if (!instance) { ... }\nreturn instance;   // may get a\n                   // half-built Widget" },
    ],
    ask: "The lock is held during construction. Can a reader still see a partially constructed Widget?",
    verdict: { sc: "forbidden", x86: "forbidden", arm: "allowed" },
    note: "'forbidden' on x86 here means the hardware will not reorder it; the COMPILER still can, because the outer read of `instance` is an unsynchronised non-atomic access, which is a data race and therefore UB on every architecture.",
    why:
      "`new Widget()` is two things: allocate-and-construct, then assign the pointer. Nothing orders them for "
      + "an observer outside the lock. A reader taking the fast path reads `instance` with no acquire, so it "
      + "may obtain the pointer while the constructor's writes are not yet visible. This is MP again, with the "
      + "object's fields as `data`.",
    fix:
      "In C++11 and later, just use a function-local static — initialisation of one is guaranteed thread-safe "
      + "and it compiles to a cheap guard check. If you must hand-roll, make `instance` a std::atomic<Widget*>, "
      + "store with release and load with acquire on BOTH checks.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-1-the-c-memory-model-precisely" },
  },
  {
    id: "seqlock", name: "Seqlock without the second check", family: "api", d: 3,
    teaches: "An optimistic read is only valid once you have validated it.",
    init: "std::atomic<unsigned> seq{0};\nPayload payload;   // several fields",
    threads: [
      { label: "Writer", code: "seq.store(s + 1, relaxed);  // odd\n/* write payload fields */\nseq.store(s + 2, release); // even" },
      { label: "Reader (wrong)", code: "unsigned s1 = seq.load(acquire);\nif (s1 & 1) retry();\nlocal = payload;\nreturn local;   // no re-check" },
    ],
    ask: "The reader checked that no write was in progress before reading. What can it still return?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    answerText: "A torn value — some fields from before the write, some from after.",
    why:
      "The check happens before the read, so a writer can start at any point DURING the payload copy. Half "
      + "the fields are old and half are new, and nothing in the reader notices. The sequence counter is not a "
      + "lock; it is a way to DETECT that you raced, which only works if you look again afterwards.",
    fix:
      "Re-read the counter after copying and retry if it changed or is odd. Because the payload read can "
      + "genuinely race with the writer, read the fields as relaxed atomics (or via std::atomic_ref) rather "
      + "than plain loads, and treat the copy as provisional until the second check passes.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-5-the-other-structures-and-when-to-reach-for-them" },
  },
  {
    id: "aba", name: "ABA — the CAS that should not have succeeded", family: "api", d: 3,
    teaches: "compare_exchange compares a value, not a history.",
    init: "std::atomic<Node*> head;   // lock-free stack",
    threads: [
      { label: "Popper", code: "Node* h = head.load(acquire);\nNode* n = h->next;\n/* ... descheduled here ... */\nhead.compare_exchange_weak(h, n);" },
      { label: "Meanwhile", code: "pop A;  pop B;\nfree(B);\npush A;   // same address,\n          // different next" },
    ],
    ask: "The CAS sees head == h, exactly what it loaded. Does it succeed, and is that correct?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    answerText: "It succeeds and corrupts the stack — head is set to a node that was freed.",
    why:
      "CAS asks 'is this still the value I read?', not 'has anything happened since?'. The pointer went "
      + "A → B → A, so the comparison passes while the structure underneath it changed completely. The stale "
      + "`n` the popper captured points into freed memory. Note that no memory ordering mistake was made — "
      + "this is a correctness hazard that correct orderings do not address.",
    fix:
      "A tagged pointer: pack a monotonically increasing counter alongside the pointer and CAS both together "
      + "(a double-width CAS such as cmpxchg16b or CASP). Or remove the precondition by using a reclamation "
      + "scheme — hazard pointers, epochs or RCU — since ABA normally requires the node to be freed and reused.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-5-the-other-structures-and-when-to-reach-for-them" },
  },
  {
    id: "lostwake", name: "The lost wakeup", family: "api", d: 2,
    teaches: "Why cv.wait needs the predicate and the mutex, both.",
    init: "std::mutex m;  std::condition_variable cv;  bool ready = false;",
    threads: [
      { label: "Waiter", code: "unique_lock lk(m);\ncv.wait(lk);      // no predicate\nconsume();" },
      { label: "Notifier", code: "ready = true;     // not under the lock\ncv.notify_one();" },
    ],
    ask: "Two bugs. What can go wrong?",
    verdict: { sc: "allowed", x86: "allowed", arm: "allowed" },
    answerText: "The waiter can sleep forever, and can also wake with nothing to do.",
    why:
      "If the notifier runs entirely before the waiter reaches cv.wait, the notification is lost — a condition "
      + "variable has no memory, so notifying when nobody waits does nothing, and the waiter then sleeps "
      + "forever on a condition that is already true. Separately, cv.wait may return spuriously, so even a "
      + "delivered notification is not proof the condition holds. Setting `ready` outside the lock is a data "
      + "race on top of both.",
    fix:
      "Set the flag while holding the mutex, and use the predicate form: cv.wait(lk, []{ return ready; }). "
      + "The predicate is checked before sleeping (closing the lost-wakeup window) and again on every wake "
      + "(absorbing spurious wakeups). This is also why wait needs a unique_lock: it must unlock-and-sleep "
      + "atomically, then re-lock before returning.",
    lab: null, evidence: null,
    guide: { num: "27", anchor: "part-6-locks-honestly" },
  },
];

export const LITMUS_FAMILIES = [
  { id: "hardware", label: "Hardware ordering", hue: "accent", note: "What the architecture permits, with or without a correct compiler." },
  { id: "compiler", label: "Compiler and UB", hue: "warn", note: "The bug exists before any instruction executes." },
  { id: "api", label: "Primitives misused", hue: "info", note: "Correct orderings, wrong structure." },
];
