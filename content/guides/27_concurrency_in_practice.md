<!--
category: The Machine
tags: C++ Memory Model, Atomics, memory_order, Happens-Before, SC-DRF, Release Sequence, SPSC, Ring Buffer, Seqlock, RCU, Hazard Pointers, ABA, Chase-Lev, Mutex, Futex, Spinlock, TSan, perf c2c, Lock-Free, Wait-Free, Low Latency
difficulty: Advanced
readTime: 50 min
-->

# Concurrency in Practice

> [!IMPORTANT]
> **TL;DR — what you must remember:** A **data race is undefined behaviour**, not a stale value — the optimizer is allowed to assume races never happen, so a race can corrupt logic nowhere near the racing variable. Above that floor, the C++ model is a budget: **relaxed** buys atomicity only, **acquire/release** buy one paired happens-before edge, **seq_cst** buys a global total order and is needed for exactly one pattern (store-buffer). Every real lock-free structure is then the same three moves: **share nothing**, **pad what you must share**, and **read your own copy instead of the other core's**. The measured SPSC queue in this guide goes from 148 ns to under 30 ns per item on those three moves alone — and the version that is *predictable* is not the one with the lowest median.

Guide 25 covered what the hardware does. This one covers what you write, in
what order, and how to prove it is right. It assumes Part 1–8 of guide 25; in
particular, that **coherence** is free and **consistency** is not.

> **Where the numbers come from.** `concurrency/01`–`04`, on one pinned machine
> with threads on separate physical performance cores unless stated. Constants
> are that machine's; the structures and the orderings are universal.

---

# PART 1 — THE C++ MEMORY MODEL, PRECISELY

## What a data race is, and why UB is the right word

Two accesses **conflict** if they touch the same memory location and at least
one is a write. A program has a **data race** if two conflicting accesses from
different threads are not ordered by happens-before and at least one is
non-atomic.

**A data race is undefined behaviour.** Not "you may read a stale value" —
*undefined*. The compiler is entitled to assume races do not occur, and that
assumption licenses transformations that look insane in a racy program: keeping
a value in a register across a loop, reordering or fusing stores, duplicating a
load so two reads return different values, or introducing a speculative write.

`concurrency/01` shows both halves of why this matters:

- A race the optimizer **hides**: the increment is collapsed so each thread
  performs one add, and the program "passes" its test.
- A race that **loses work**: 2.0 million of 4.0 million increments disappear.

TSan flags both. Nothing else reliably does.

> The consequence people miss: because it is UB and not a visibility problem,
> the damage need not appear at the racing variable. A race can break code that
> does not touch the shared data at all.

## The three relations

1. **Sequenced-before** — program order within one thread.
2. **Synchronizes-with** — the cross-thread edge created when an **acquire**
   operation reads the value written by a **release** operation on the *same*
   atomic object.
3. **Happens-before** — the transitive closure of the two.

```
   Thread P (producer)              Thread C (consumer)
   data = 42;          ─┐
   flag.store(1, release)─┼─ synchronizes-with ─→ flag.load(acquire) == 1
                           │                         use(data);   // sees 42
   (sequenced-before)      └─────────── happens-before ──────────┘
```

A release with no matching acquire synchronizes with nothing. **They must pair,
on the same variable**, and the acquire must actually read the released value.

## Modification order and the four coherence rules

Every atomic object has a single total **modification order** — guide 25's
coherence, stated in C++ terms. Four rules follow, and they hold **even for
`relaxed`**:

| Rule | Guarantee |
| :--- | :--- |
| write-write | if A happens-before B and both modify M, A comes first in M's order |
| read-read | a later read cannot see an *earlier* value than one already read |
| read-write | a read happens-before a write means the read's value precedes that write |
| write-read | a read after a write (happens-before) sees that write or a later one |

This is why "relaxed means anything goes" is wrong. Relaxed gives up ordering
against *other* objects. It never gives up this object's history.

## SC-DRF, the promise

**If your program is data-race-free, it behaves as if sequentially
consistent.** Write race-free code with default orderings and you get the
intuitive interleaving model. You only enter weak-memory territory when you
deliberately weaken below `seq_cst` — which is the argument for making that a
considered decision rather than a reflex.

## Two corners worth knowing exist

- **Release sequences.** After a release store, a chain of read-modify-writes on
  the same variable extends the release's reach: an acquire that reads *any* of
  them still synchronizes with the original release. This is what makes
  reference counting work.
- **Out-of-thin-air.** The formal model does not completely rule out certain
  self-justifying `relaxed` outcomes. No implementation produces them and the
  standard discourages them, but it remains an acknowledged wart — and a
  reasonable answer to "what is wrong with the C++ model?"

---

# PART 2 — THE SIX ORDERINGS AS A BUDGET

### `relaxed`
Atomicity and modification order only. No ordering of other accesses.
**Use for:** independent counters and statistics; the *increment* side of a
reference count.

### `release` (stores and RMWs)
Everything sequenced-before becomes visible to a thread that acquires and reads
this value. A one-way barrier: earlier accesses cannot sink below it.
**Use for:** publishing a filled buffer.

### `acquire` (loads and RMWs)
Everything the releasing thread did is visible after this load returns. A
one-way barrier the other way: later accesses cannot hoist above it.
**Use for:** consuming published data.

### `acq_rel` (RMWs only)
Acquire on the value read, release on the value written. The correct ordering
for a CAS that both reads a head pointer and publishes a new one.

### `seq_cst` (the default)
Acquire+release **plus** a single global total order across all `seq_cst`
operations. Needed for exactly one shape: the store-buffer pattern, where two
threads store to different variables and each reads the other. Guide 25's SB
litmus test is that shape; if your problem is not that shape, acquire/release
is sufficient.

### `consume`
A weaker acquire ordering only dependency-carrying reads. Unimplementable as
specified; every mainstream compiler promotes it to `acquire`. Know it exists,
know why it failed, use `acquire`.

## Fences versus ordered operations

`std::atomic_thread_fence(order)` orders the accesses *around* it rather than a
specific operation. Prefer ordering on the operation — it is more precise and
usually cheaper. The fence form earns its place when one fence covers several
operations, as in the reference-count idiom below.

## The idiom that uses most of this

```cpp
void release_ref() {
    if (count.fetch_sub(1, std::memory_order_release) == 1) {
        std::atomic_thread_fence(std::memory_order_acquire);
        delete this;             // safe: every other thread's use is visible
    }
}
```

The `release` on every decrement ensures each thread's prior use of the object
happens-before the decrement. The `acquire` fence on the *last* one makes all of
those uses visible to the thread that destroys it. Increments can be `relaxed`,
because you must already hold a reference to perform one. Paying for an acquire
on every decrement instead of only the last is the common inefficiency.

---

# PART 3 — WHAT IT COMPILES TO

`concurrency/03` compiles every ordering for three targets. The summary:

| | x86-64 | AArch64 v8.0 | AArch64 + LSE |
| :--- | :--- | :--- | :--- |
| relaxed load | `mov` | `ldr` | `ldr` |
| acquire load | `mov` *(free)* | `ldar` | `ldar` / `ldapr` |
| relaxed store | `mov` | `str` | `str` |
| release store | `mov` *(free)* | `stlr` | `stlr` |
| **seq_cst store** | **`xchg`** | `stlr` | `stlr` |
| relaxed RMW | `lock xadd` | `ldxr`/`stxr` loop | `ldadd` |
| seq_cst RMW | `lock xadd` | `ldaxr`/`stlxr` loop | `ldaddal` |

Two conclusions that should change how you write code:

1. **On x86, only the `seq_cst` store costs anything.** Acquire and release are
   literally free, and *every* RMW is a `lock`-prefixed full barrier regardless
   of what you asked for. Weakening an RMW below `seq_cst` on x86 buys nothing.
2. **On AArch64, everything above relaxed costs an instruction**, but `seq_cst`
   is barely more than acquire/release because `LDAR`/`STLR` are RCsc. So the
   incentive to hand-tune downward is *weaker* than people assume, and the
   incentive to use LSE (single-instruction RMWs instead of a retry loop) is
   much stronger.

The practical rule: **default to `seq_cst`, weaken to acquire/release when you
can name the pairing, and weaken to `relaxed` only for counters.** Then measure
— on both architectures if you ship on both.

---

# PART 4 — THE SPSC RING BUFFER, OPTIMISED THREE TIMES

A single-producer single-consumer queue is the canonical lock-free structure and
the best vehicle for the three moves that matter. `concurrency/02` builds it in
three versions and measures each.

## Version 1 — the naive one: 148 ns per item

```cpp
struct Queue {                       // two problems, both invisible in review
    std::atomic<size_t> head{0};
    std::atomic<size_t> tail{0};     // same cache line as head
    T buffer[N];
};
// push: buffer[t % N] = v; tail.store(t + 1);      // seq_cst by default
// pop:  v = buffer[h % N]; head.store(h + 1);      // seq_cst by default
```

Two independent faults. **`head` and `tail` share a cache line**, so the
producer's write to `tail` invalidates the consumer's copy of `head` and back
again — guide 25's false sharing, on every single operation. And **`seq_cst`
everywhere** pays for a total order nobody needs.

## Version 2 — pad and weaken: 18–42 ns per item

```cpp
struct Queue {
    alignas(64) std::atomic<size_t> head{0};   // own line
    alignas(64) std::atomic<size_t> tail{0};   // own line
    alignas(64) T buffer[N];
};
// push: buffer[t % N] = v;
//       tail.store(t + 1, std::memory_order_release);   // publish
// pop:  size_t t = tail.load(std::memory_order_acquire); // consume
//       v = buffer[h % N];
//       head.store(h + 1, std::memory_order_release);
```

A 4–8x improvement. The orderings are exactly guide 25's **MP** litmus test: the
release on `tail` and the acquire of `tail` are what make the buffer write
visible before the index that advertises it. Without them this code is correct
on x86 by accident and broken on AArch64.

## Version 3 — cache the other side's index: 29–34 ns, and *stable*

The remaining cost is that each side still reads an index the other side writes,
so that line still moves. But the producer does not need the consumer's exact
position — only to know there is *some* room. So keep a private copy and refresh
it only when you appear to be full:

```cpp
// producer's private, non-atomic copy
if (tail + 1 - cached_head == N) {              // looks full?
    cached_head = head.load(std::memory_order_acquire);   // only now, re-read
    if (tail + 1 - cached_head == N) return false;        // really full
}
```

Now the shared line is touched once per *batch* rather than once per item.

## Read the numbers properly

| Version | ns / item | Spread |
| :--- | :--- | :--- |
| naive (shared line, `seq_cst`) | **148** | — |
| padded + acquire/release | **18–42** | wide (24 ns) |
| + cached indices | **29–34** | **tight (5 ns)** |

The third version has a **worse median than the second** and is the one you
ship. Its spread is a fifth as wide, and for anything judged on p99.9 a
predictable 32 ns beats an average of 30 ns that sometimes takes 42. **Choosing
the lower median here would be the wrong call**, and a benchmark reporting only
means would have led you to it.

> **The separate result worth knowing.** Running the two threads on SMT siblings
> of one physical core gave **2.4 ns per item** — the line never leaves the
> shared L1. It is not a free win: siblings contend for the same execution
> resources, so whether it helps depends entirely on what else those threads do.
> It is a useful demonstration that "the cost is the line moving" is literally
> true.

---

# PART 5 — THE OTHER STRUCTURES, AND WHEN TO REACH FOR THEM

## Seqlock — cheap reads of a rarely-written value

A writer increments a sequence counter to an odd value, writes, then increments
to even. A reader samples the counter, reads, samples again, and retries if the
value changed or was odd.

```cpp
do {
    s1 = seq.load(std::memory_order_acquire);
    if (s1 & 1) continue;                  // writer in progress
    value = payload;                       // may be torn; validated below
    std::atomic_thread_fence(std::memory_order_acquire);
} while (seq.load(std::memory_order_relaxed) != s1);
```

Readers never write, so there is no coherence traffic from the read side at all
— ideal for configuration or a market snapshot read far more often than
written. The catch is real: the payload read **can** observe a torn value, which
in strict C++ terms is a data race. Do it with `relaxed` atomics (or
`std::atomic_ref`) per field rather than plain loads, and treat the result as
provisional until the second sequence check validates it. Writers must still
exclude each other.

## The reclamation problem, and its three answers

Every node-based lock-free structure hits the same wall: you unlinked a node,
but another thread may still be reading it. You cannot free it yet, and there is
no lock to tell you when it is safe.

| Technique | Idea | Cost |
| :--- | :--- | :--- |
| **RCU** | readers are free and unmarked; writers wait for a grace period | zero read cost; deferred, potentially unbounded reclamation |
| **Hazard pointers** | each reader publishes what it is reading; writers check before freeing | one store + fence per read; bounded memory |
| **Epoch-based** | readers announce an epoch; memory freed when all have advanced | between the two; a stalled reader pins memory |

RCU is the right default when reads vastly outnumber writes and you can tolerate
deferred freeing — which is why the kernel uses it everywhere. Hazard pointers
are the choice when memory must be bounded.

## ABA

A CAS compares a *value*, not a history. If a pointer goes A → B → A between
your read and your CAS, the CAS succeeds against a structure that has changed
underneath you.

Fixes: a **tagged pointer** (a counter in the unused high bits, or a
double-width CAS such as `cmpxchg16b` / `CASP`), or any of the reclamation
schemes above, since ABA usually requires the node to have been freed and
reused.

## Work stealing, briefly

The Chase-Lev deque gives an owner thread cheap LIFO push/pop at one end while
thieves steal FIFO from the other. The owner's fast path is nearly free; only
the steal path needs a CAS. It is the standard structure under task-parallel
runtimes, and worth recognising by name.

---

# PART 6 — LOCKS, HONESTLY

A `std::mutex` on Linux is a small atomic plus a **futex**. The fast path is
entirely in user space: one atomic to acquire, one to release. Only on
contention does it call `futex(FUTEX_WAIT)` and sleep.

`concurrency/04` measures it:

| Primitive, uncontended | Cost |
| :--- | :--- |
| `std::mutex` lock+unlock | **25 ns** |
| spinlock | **13.5 ns** |
| bare atomic RMW | **11.8 ns** |

And under contention: **only 0.6% of acquisitions reached the kernel.** The rest
resolved by spinning in user space.

Two corrections to common folklore follow:

- **"Mutexes are slow because they syscall."** They do not, almost ever. An
  uncontended mutex is two atomics and ~25 ns. The syscall is the rare path.
- **"A spinlock is faster."** It is ~11 ns cheaper uncontended. Under contention
  it burns a core, and if the holder is preempted it burns it to no purpose —
  which on an oversubscribed machine is catastrophic. The real cost of
  contention in both cases is the **cache line moving between cores**, not the
  scheduling.

Spinlocks are right for very short critical sections on cores you own and that
will not be preempted. That is a narrow set of conditions, and outside it the
mutex wins.

### Spinning properly

```cpp
while (flag.test_and_set(std::memory_order_acquire)) {
    do {
        _mm_pause();                         // or __builtin_ia32_pause / YIELD
    } while (flag.test(std::memory_order_relaxed));   // spin on a *load*
}
```

Two details, both load-bearing. **Spin on a load, not on the RMW** — a
`test_and_set` in the loop requests the line exclusively on every iteration and
starves the holder. And **`pause`** reduces power and the memory-order
machine-clear penalty when the line changes; it costs anywhere from ~10 to ~140
cycles depending on the core generation, which is exactly why a spin loop tuned
with a fixed pause count behaves differently on different CPUs.

### Lock-free is not wait-free, and not automatically faster

**Lock-free** means some thread always makes progress. **Wait-free** means every
thread makes progress in bounded steps. Most "lock-free" structures are
lock-free, not wait-free, and a CAS retry loop under contention can be slower
*and* less predictable than a mutex. Lock-freedom buys you immunity to a thread
being preempted while holding the resource — which is a real and valuable
property — not speed.

---

# PART 7 — FINDING THE BUGS

| Tool | Finds | Limit |
| :--- | :--- | :--- |
| **TSan** (`-fsanitize=thread`) | data races, via happens-before tracking | dynamic — only on paths actually executed; ~5–15x slowdown |
| **`perf c2c`** | contended cache lines, with offsets | needs the contention to actually occur under profiling |
| **`pahole`** | struct layout, holes, line crossings | static; tells you the risk, not the cost |
| **helgrind / DRD** | races and lock-order problems | much slower than TSan |
| **`herd7` / `litmus7`** | whether an *outcome* is permitted | small kernels, not whole programs |
| **Stress on weakly-ordered hardware** | missing acquire/release | only as good as your test's timing luck |

The workflow that actually works:

1. **Reason from the model first.** Name the pairing for every weakened
   ordering. If you cannot name which release this acquire pairs with, do not
   weaken it.
2. **TSan in CI, always.** It found both lab races, including the one the
   optimizer had hidden so well that the test passed.
3. **`perf c2c` when it is slow but correct.** Contention is a performance bug
   with a specific address, not a vibe.
4. **Run it on ARM.** The MP pattern is forbidden on x86 and allowed on AArch64;
   x86-only testing cannot find that class of bug at all.

> TSan proves the presence of races, never their absence. A clean run on the
> paths you exercised is evidence, not a proof.

---

# PART 8 — THE LOW-LATENCY PLAYBOOK

What practitioners converge on, with the reasoning rather than the ritual.

**Design level — this is where the latency is won.**

- **Share nothing on the hot path.** Per-thread state aggregated later. Every
  other technique here is damage control for sharing you could not avoid.
- **Pre-allocate everything.** No allocation, no syscall, no page fault in
  steady state (guide 26, Part 4). Pools, arenas, fixed-capacity containers.
- **Bound the work.** `std::vector::push_back` is amortised O(1), and the
  reallocation lands on one unlucky call. Amortised bounds are the wrong tool
  for a p99.9 budget; reserve, or use fixed capacity.
- **One writer per cache line.** Enforced with `alignas`, verified with
  `pahole` and `perf c2c`.

**Mechanism level.**

- **Busy-poll instead of sleeping** when a core is dedicated. A wake-up is ~5 µs
  with a tail into milliseconds (`systems/03`, `systems/05`); spinning trades a
  whole core for removing that.
- **Pin and isolate** (guide 26, Part 8). An unpinned thread showed 2.4x spread
  and an efficiency core was 1.87x slower.
- **Keep the path warm.** Code and data evicted during an idle period cost
  misses on the one event that mattered. Periodically exercising the hot path
  with dummy work keeps instructions, data and branch predictor state resident.
  It is genuinely effective and genuinely ugly; measure before adopting it.

**On the published talks.** The low-latency C++ talks listed in the sources are
the best public material on this, and worth watching in full. Treat their
*design* advice as durable — shared-nothing, pre-allocation, measuring the tail,
keeping the hot path short — and their *micro-optimisations* as dated by
construction: branch-prediction tricks, hand-unrolling and specific instruction
choices were tuned against the cores of their time, and some have since been
overtaken by better hardware or better compilers. The discipline that does not
age is measuring on your own machine, which is what the labs exist for.

---

# PART 9 — Q&A DRILL

### Q: What exactly makes something a data race, and why is it UB rather than a stale read?
Two conflicting accesses — same location, at least one a write — from different
threads, not ordered by happens-before, at least one non-atomic. It is UB
because the optimizer may assume races do not happen, which licenses caching a
value in a register, fusing or reordering stores, and duplicating loads. So the
corruption need not appear at the racing variable: it can break unrelated logic.

### Q: A producer fills a buffer then sets a flag. Minimum correct ordering, and what breaks with relaxed?
Release on the flag store, acquire on the flag load. With `relaxed` there is no
synchronizes-with edge, so the buffer writes may become visible after the flag,
and the consumer reads a flag of 1 over uninitialised data. This is the MP
litmus test — forbidden on x86-TSO, allowed on AArch64 — which is why the bug is
invisible on a desktop.

### Q: When do you genuinely need seq_cst?
Only for the store-buffer shape: two threads each store to a *different* atomic
and then read the other, and you need both to agree on a global order. Guide
25's SB test. Everything else — publish/consume, reference counts, queues — is
acquire/release or weaker. If you cannot articulate why you dropped below
`seq_cst`, do not.

### Q: Your atomic counter uses relaxed. Can another thread see it decrease?
No. Coherence gives every atomic object a single modification order, and
read-read coherence forbids a later read returning an earlier value. `relaxed`
gives up ordering relative to *other* objects, never this object's own history.

### Q: Why can a reference count increment be relaxed but the decrement must not?
To increment you must already hold a reference, so the object cannot die
underneath you and no ordering is required. The decrement publishes "I am done
with it": it needs `release` so your prior uses happen-before the destruction,
and the thread that drops the count to zero needs an `acquire` fence so it sees
every other thread's uses before running the destructor.

### Q: An SPSC queue is slow. Name two faults you would look for before reading the algorithm.
Head and tail sharing a cache line, so every operation ping-pongs it between the
two cores; and `seq_cst` by default where acquire/release is sufficient. In the
lab those two alone took it from 148 ns per item to 18–42.

### Q: You have two SPSC versions: one averages 30 ns with a 24 ns spread, one averages 32 ns with a 5 ns spread. Which ships?
The second, for anything judged on tail latency. A predictable 32 ns beats an
average of 30 that sometimes takes 42. This is also an argument about
measurement: a benchmark reporting only means would have chosen wrong.

### Q: Why is spinning on test_and_set worse than spinning on a plain load?
Every `test_and_set` is a read-for-ownership that takes the line exclusively, so
the spinners continuously steal the line from the thread trying to release the
lock. Spin on a relaxed load and only attempt the RMW when the load suggests it
will succeed.

### Q: Is a mutex slow because it makes a syscall?
No. An uncontended `std::mutex` is two atomics, about 25 ns, entirely in user
space; only contention calls `futex`, and in the lab just 0.6% of contended
acquisitions reached the kernel. The dominant cost of contention is the cache
line moving between cores, which a spinlock pays too.

### Q: What is the ABA problem and how do you avoid it?
A CAS compares a value, not a history, so a pointer that goes A → B → A between
your load and your CAS lets the CAS succeed on a structure that changed. Use a
tagged pointer with a version counter (often via a double-width CAS), or a
reclamation scheme — hazard pointers, epochs, RCU — since ABA usually needs the
node to have been freed and reused.

### Q: Compare RCU and hazard pointers.
RCU makes readers completely free — no writes, no fences, no coherence traffic —
and defers reclamation until a grace period passes, so memory use is unbounded
if a reader stalls. Hazard pointers make each reader publish what it is reading,
costing a store and a fence per read, in exchange for bounded memory. Reads
dominate and deferred freeing is acceptable → RCU; memory must be bounded →
hazard pointers.

### Q: Does lock-free mean faster?
No. Lock-free means some thread always makes progress, which buys immunity to a
holder being preempted. Under contention a CAS retry loop can be slower and less
predictable than a mutex. Wait-free — every thread bounded — is a stronger and
rarer property. Choose lock-freedom for the progress guarantee, then measure for
speed.

### Q: TSan reports nothing. Is the code race-free?
No. TSan is dynamic: it reports races on paths that actually executed with the
timing that occurred. It proves presence, not absence. Combine it with reasoning
from the model, `herd7` for the litmus questions, and running on weakly-ordered
hardware, where ordering bugs that x86 masks become reachable.

---

## Sources

- ISO C++ standard, `[intro.races]` and `[atomics.order]` — the normative definitions of data race, modification order, the coherence requirements and release sequences.
- Hans-J. Boehm and Sarita V. Adve, *Foundations of the C++ Concurrency Memory Model*, PLDI 2008 — the design rationale, including SC-DRF.
- Hans-J. Boehm, *Threads Cannot Be Implemented as a Library*, PLDI 2005 — why this had to be in the language rather than a library.
- Paul E. McKenney, *Is Parallel Programming Hard, And, If So, What Can You Do About It?* ("perfbook") — the standard treatment of RCU, hazard pointers, counting and deferred reclamation.
- Maged M. Michael, *Hazard Pointers: Safe Memory Reclamation for Lock-Free Objects*, IEEE TPDS, 2004.
- David Chase and Yossi Lev, *Dynamic Circular Work-Stealing Deque*, SPAA 2005 — the Chase-Lev deque.
- Anthony Williams, *C++ Concurrency in Action* (2nd ed.) — the most complete practical treatment of the C++ model and lock-free structures.
- Herb Sutter, *atomic<> Weapons* (C++ and Beyond, 2012) — the standard talk on the C++ model and its hardware mapping.
- Fedor Pikus, *C++ atomics, from basic to advanced* (CppCon 2017), and Timur Doumler's talks on C++ concurrency for the memory-model material.
- Carl Cook, *When a Microsecond Is an Eternity: High Performance Trading Systems in C++* (CppCon 2017) — [isocpp.org summary](https://isocpp.org/blog/2018/09/cppcon-2017-when-a-microsecond-is-an-eternity-high-performance-trading-syst); and the earlier *The Speed Game* (Meeting C++ 2016) for the system-tuning side.
- David Gross, *Trading at Light Speed: Designing Low Latency Systems in C++* ([Meeting C++ 2022](https://meetingcpp.com/2022/Talks/items/Trading_at_light_speed__designing_low_latency_systems_in_Cpp.html)) and *When Nanoseconds Matter: Ultrafast Trading Systems in C++* ([CppCon 2024](https://isocpp.org/blog/2025/05/cppcon-2024-when-nanoseconds-matter-ultrafast-trading-systems-in-cpp-d)) — the more recent treatment, with an emphasis on design-phase decisions.
- The LMAX Disruptor technical paper for the ring-buffer and false-sharing argument in a production context.
- Erik Rigtorp's write-ups on SPSC queues and low-latency C++ at [rigtorp.se](https://rigtorp.se/) — close to the lab's version 3.
- Jeff Preshing, [preshing.com](https://preshing.com/) — lock-free programming and memory ordering, the most approachable bridge to the formal models.
- Linux `Documentation/RCU/`, `futex(2)`, and the `perf c2c` workflow in `Documentation/kernel-hacking/false-sharing`.
- Lab measurements: `concurrency/01` (a race the optimizer hides and one that loses 2.0M of 4.0M increments; TSan on both), `concurrency/02` (the SPSC queue three ways, with run-to-run spread, and the SMT-sibling result), `concurrency/03` (every `memory_order` compiled for x86-64, AArch64 v8.0 and LSE), `concurrency/04` (mutex, spinlock and atomic costs; futex counts under contention).
