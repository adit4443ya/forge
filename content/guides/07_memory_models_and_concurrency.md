<!--
category: C++ Systems Engineering
tags: Concurrency, Atomics, Memory Order, Happens-Before, SeqCst, Acquire, Release, AArch64, LDAR, STLR, DMB, LSE, Lock-Free, Mutex, Condition Variable, Weak Memory
difficulty: Advanced
readTime: 35 min
-->

# C++ Concurrency, Atomics, and Memory Models

> [!IMPORTANT]
> **TL;DR — what you must remember:** A **data race** (two unsynchronized accesses, ≥1 a write) is **undefined behavior** — atomics or locks are mandatory, full stop. `memory_order` lets you buy exactly as much ordering as you need: **relaxed** (atomicity only), **acquire/release** (one-way fences that *pair* to build a happens-before edge), **seq_cst** (one global total order — the safe default). On AArch64's **weak** memory model these map to **LDAR / STLR** and **DMB**: acquire/release is nearly free, and unlike x86 even plain ordering costs a special instruction. Get the C++ ↔ hardware mapping right and concurrency questions stop being scary.

Memory ordering dictates how memory writes performed by one thread become visible to another. On a single core with sequential execution this is trivial; across cores — each with its own store buffer, cache, and an out-of-order pipeline — it is the single subtlest topic in systems C++. This guide builds from the abstract C++11 memory model down to the concrete AArch64 instructions LLVM emits.

> → This guide is the **software** half. For the hardware half — the AArch64 weak memory model, `LDAR`/`STLR`, `DMB`/`DSB`, and exclusive vs LSE atomics — see [AArch64 Architecture · Part 5](#guide/13/part-5-the-weak-memory-model-arm-s-sharpest-edge).

---

# PART 1 — THE C++ MEMORY MODEL & DATA RACES

## What Is a Data Race (Precisely)?

Two memory accesses **conflict** if they touch the same memory location and at least one is a write. A program has a **data race** if two conflicting accesses from different threads are **not ordered** by a happens-before relationship and neither is atomic. 

**A data race is undefined behavior.** Not "you get a stale value" — *undefined*. The compiler is allowed to assume races never happen, which is exactly why it can keep a value in a register across a loop, reorder stores, or invent speculative writes. The fix is never `volatile` (that controls neither atomicity nor inter-thread ordering); the fix is an atomic or a lock.

```cpp
int x = 0;                 // plain int
// Thread A: x = 1;        // write
// Thread B: int y = x;    // read  → DATA RACE → UB
```

## The Three Relations You Must Name

1. **Sequenced-before** — intra-thread program order (with the usual sequence-point / evaluation-order caveats).
2. **Synchronizes-with** — the cross-thread edge created when an `acquire` load observes the value written by a `release` store on the *same* atomic.
3. **Happens-before** — the transitive closure of the above. If A happens-before B, A's effects are visible to B.

```
   Thread P (producer)            Thread C (consumer)
   data = 42;          ─┐
   flag.store(1,release)─┼─ synchronizes-with ─→ flag.load(acquire)==1
                          │                        use(data);  // sees 42
   (sequenced-before)     └────────── happens-before ──────────┘
```

## SC-DRF: The Promise the Standard Makes

The model's headline guarantee is **SC-DRF**: *if your program is **D**ata-**R**ace-**F**ree, it behaves as if executed under **S**equential **C**onsistency* — a simple interleaving of thread steps. You only have to reason about weak-memory weirdness when you deliberately weaken below `seq_cst`. Write race-free code with the default ordering and you get the intuitive model for free.

---

# PART 2 — THE SIX `memory_order` VALUES

`std::memory_order` is an argument to every atomic operation. It specifies how that operation orders the *surrounding non-atomic and atomic* accesses.

### `memory_order_relaxed`
- **Guarantees:** atomicity and a single per-object **modification order** only. No ordering of *other* memory operations.
- **Use case:** independent counters (statistics, reference counts on the *increment* path) where only the final tally matters.

```cpp
std::atomic<long> hits{0};
hits.fetch_add(1, std::memory_order_relaxed);   // count, don't synchronize
```

### `memory_order_release` (stores / RMW)
- **Effect:** everything sequenced-before this store becomes visible to any thread that performs an **acquire** on the same atomic and reads this value. A **one-way barrier**: earlier accesses cannot move *below* it.
- **Use:** "publish" a buffer after filling it.

### `memory_order_acquire` (loads / RMW)
- **Effect:** everything the releasing thread did before its release is visible **after** this load returns. A one-way barrier the other direction: later accesses cannot move *above* it.
- **Use:** "consume" published data; establishes happens-before with the matching release.

### `memory_order_acq_rel` (read-modify-write only)
- Both an acquire (on the value read) and a release (on the value written). The correct ordering for a lock-free stack/queue CAS that both reads the old head and publishes the new one.

### `memory_order_seq_cst` (the default)
- Acquire+release **plus** participation in a single **total order** over all `seq_cst` operations, consistent across all threads. The safe default; the only ordering that makes independent-reads-of-independent-writes (IRIW) and store-buffer litmus tests behave intuitively.

### `memory_order_consume` (avoid)
- A weaker acquire that orders only *dependency-carrying* reads. Notoriously hard to specify; every mainstream compiler promotes it to `acquire`. Know it exists, then use `acquire`.

> **Mental model:** `release` pushes a "done" flag down; `acquire` pulls the published state up; the two **must pair on the same variable** to create synchronization. A lone release or lone acquire synchronizes with nothing.

---

# PART 3 — ACQUIRE/RELEASE vs SEQ_CST

For a single producer/consumer handoff, **acquire/release is sufficient and cheaper**:

```cpp
// Producer
shared_data = value;                              // (1) non-atomic write
ready.store(true, std::memory_order_release);     // (2) publish

// Consumer
while (!ready.load(std::memory_order_acquire)) {} // (3) wait
use(shared_data);                                 // (4) safe: (1) happens-before (4)
```

The `release` at (2) and `acquire` at (3) guarantee (1) **happens-before** (4).

So when do you actually *need* `seq_cst`? When two threads each store to a different atomic and then read the *other* — and you need them to agree on a global order (Dekker / store-buffer pattern):

```cpp
std::atomic<bool> x{false}, y{false};
int r1, r2;
// Thread 1:  x.store(true, seq_cst);  r1 = y.load(seq_cst);
// Thread 2:  y.store(true, seq_cst);  r2 = x.load(seq_cst);
// With seq_cst, r1 == r2 == 0 is IMPOSSIBLE (a total order forbids it).
// With acquire/release, r1 == r2 == 0 IS allowed — each store can sit in
// a store buffer while the load reads stale memory (StoreLoad reorder).
```

`seq_cst` is what closes that StoreLoad hole, and it is the *only* ordering that does. If you cannot articulate why you dropped below `seq_cst`, don't.

---

# PART 4 — C++ ATOMICS ↔ AArch64 MAPPING (Know This Cold)

This is the table that separates "I read the cppreference page" from "I work on a compiler backend." AArch64 has **acquire/release built into the load/store instructions** (RCsc semantics), so the mapping is clean:

| C++ operation | `memory_order` | AArch64 (Armv8.0) | With LSE (Armv8.1+) |
| :--- | :--- | :--- | :--- |
| `load` | `relaxed` | `LDR` | `LDR` |
| `load` | `acquire` / `seq_cst` | `LDAR` | `LDAR` |
| `store` | `relaxed` | `STR` | `STR` |
| `store` | `release` / `seq_cst` | `STLR` | `STLR` |
| `fetch_add` etc. | `relaxed` | `LDXR`/`STXR` loop | `LDADD` |
| `fetch_add` etc. | `acq_rel` / `seq_cst` | `LDAXR`/`STLXR` loop | `LDADDAL` |
| `exchange` | `seq_cst` | `LDAXR`/`STLXR` loop | `SWPAL` |
| `compare_exchange` | `seq_cst` | `LDAXR`/`STLXR` loop | `CASAL` |
| `atomic_thread_fence` | `acquire` | `DMB ISHLD` | `DMB ISHLD` |
| `atomic_thread_fence` | `release` / `seq_cst` | `DMB ISH` | `DMB ISH` |

Key reading:
- **`LDAR` / `STLR`** are *Load-Acquire* / *Store-Release*. Their ordering is baked into the instruction — no separate fence needed. The suffix `A` = acquire, `L` = release.
- **`LSE` atomics** (Large System Extensions) replace the `LDXR/STXR` retry loop with a *single* instruction (`LDADD`, `SWP`, `CAS`). The ordering suffix combos are `A` (acquire), `L` (release), `AL` (both). Under high contention LSE wins big because there is no exclusive-monitor livelock. Select them with `-mcpu=...` or `-march=armv8.1-a+lse`.
- **`DMB ISH`** is a *Data Memory Barrier* over the *Inner Shareable* domain — the standalone fence used for `atomic_thread_fence`. `ISHLD` is the load-only (acquire) variant.

> → Exclusive monitors (`LDXR`/`STXR`), the `A`/`L` suffix machinery, and the full `DMB` vs `DSB` distinction are dissected in [AArch64 Architecture · Atomics: Exclusives vs LSE](#guide/13/atomics-exclusives-vs-lse) and the [C++ → AArch64 mapping section](#guide/13/c-aarch64-mapping-you-must-know-cold).

---

# PART 5 — WHY WEAK MEMORY MODELS MATTER

Two cores can disagree about the order of memory events because each has a **store buffer** and the pipeline runs **out of order**. How much disagreement the architecture *permits* is its **memory model**.

| | **x86-64 (TSO)** | **AArch64 (weak)** |
| :--- | :--- | :--- |
| Plain load | already an acquire | **no ordering** |
| Plain store | already a release | **no ordering** |
| Reordering allowed | StoreLoad only | Load/Store/Load/Store — almost all |
| `acquire` / `release` cost | **free** (plain `MOV`) | `LDAR` / `STLR` (cheap, not free) |
| `seq_cst` store cost | `XCHG` / `MFENCE` | `STLR` (≈ same as release) |

The practical consequences:

1. **Bugs hide on x86 and surface on ARM.** Code that races but "works" on your x86 laptop because TSO accidentally provides the ordering will break on a Snapdragon. The weak model is an *honest* model — it exposes missing synchronization. This is why you test concurrency on ARM.
2. **The cost trade-off flips.** On x86, `acquire`/`release` are free and `seq_cst` stores are the only ones that cost a fence — so people splurge on `seq_cst`. On AArch64, *every* ordered access costs an instruction, but `seq_cst` is barely more than `acquire`/`release` (both go through `LDAR`/`STLR`), so the incentive to hand-tune down to relaxed is weaker than you'd think. Measure before micro-optimizing.
3. **`LDAR`/`STLR` give RCsc, not just RCpc.** Armv8's acquire/release pair is *sequentially consistent* with respect to each other, which is why C++ `seq_cst` can lower to the same `LDAR`/`STLR` rather than needing extra fences in the common case.

---

# PART 6 — SYNCHRONIZATION PRIMITIVES

## `std::lock_guard` vs `std::unique_lock`

| Feature | `std::lock_guard` | `std::unique_lock` |
| :--- | :--- | :--- |
| **Strategy** | Strict RAII (scoped) | Flexible RAII |
| **Overhead** | Minimal (lock/unlock) | Slightly more (tracks own state) |
| **Manual control** | Cannot unlock early | `unlock()` / `lock()` allowed |
| **Deferred / try lock** | No | `std::defer_lock`, `std::try_to_lock` |
| **CV support** | No | **Required** for `std::condition_variable` |

Default to `lock_guard` (or C++17 `scoped_lock` for multiple mutexes — it deadlock-avoids via `std::lock`). Reach for `unique_lock` only when you need a condition variable or deferred/conditional locking.

## `std::condition_variable`: the Unlock-Sleep-Relock cycle

`cv.wait` needs a `unique_lock` because it performs an atomic multi-step dance:

1. Thread holds a `unique_lock` on the mutex.
2. `cv.wait(lock, predicate)` is called.
3. **Atomically** unlock the mutex *and* sleep — done as one step to prevent a **lost wakeup**.
4. On `notify_one/all`, wake and **re-acquire** the mutex before `wait` returns.
5. Re-check the predicate (guards against **spurious wakeups**); if false, loop.

```cpp
std::mutex m;
std::condition_variable cv;
bool ready = false;

// Waiter
std::unique_lock<std::mutex> lk(m);
cv.wait(lk, []{ return ready; });   // predicate form = spurious-wakeup safe

// Notifier
{ std::lock_guard<std::mutex> lk(m); ready = true; }
cv.notify_one();
```

## Spinlock vs Mutex, and False Sharing

- A **spinlock** busy-waits (`while (flag.test_and_set(acquire)) ;`) — right only for *very* short critical sections on dedicated cores (HFT). It burns a core and can livelock under contention. A **mutex** parks the thread in the kernel — right for anything that might wait microseconds or more.
- **False sharing:** two atomics that sit on the same 64-byte cache line ping-pong the line between cores even though they're logically independent. Fix with `alignas(64)` (or `std::hardware_destructive_interference_size`) to give each its own line.

```cpp
struct alignas(64) PaddedCounter { std::atomic<long> v{0}; };  // one per cache line
```

---

# PART 7 — Q&A DRILL

### Q: What exactly makes something a data race, and why is it UB rather than just a stale read?
Two conflicting accesses (same location, ≥1 write) from different threads not ordered by happens-before, where at least one is non-atomic. It's UB because the optimizer is permitted to assume races don't occur — it may cache values in registers, reorder, or fuse stores. So a race can corrupt *unrelated* logic, not just produce a stale value.

### Q: A producer fills a buffer then sets a flag. What's the minimum ordering, and what breaks if you use `relaxed`?
`release` on the flag store, `acquire` on the flag load. With `relaxed`, there's no synchronizes-with edge, so the buffer writes can be observed *after* the flag — the consumer reads a flag of `true` over still-garbage data.

### Q: On AArch64, what instructions implement an `acquire` load and a `release` store?
`LDAR` (Load-Acquire) and `STLR` (Store-Release). The ordering is part of the instruction; no separate `DMB` is needed.

### Q: Why is `memory_order_acquire` nearly free on AArch64 but `seq_cst` is the costly one on x86?
On x86 (TSO) plain loads/stores are already acquire/release, so only the StoreLoad-ordering of `seq_cst` stores needs a fence (`MFENCE`/`XCHG`). On AArch64 nothing is ordered by default, so acquire/release cost `LDAR`/`STLR` — but those already give SC-consistent semantics, so `seq_cst` is barely more expensive than acquire/release.

### Q: What's the difference between `LDXR/STXR` and the LSE atomics, and when does it matter?
`LDXR/STXR` is the load-exclusive / store-exclusive retry loop using the exclusive monitor; under contention it can livelock and wastes cycles retrying. LSE (`LDADD`, `SWP`, `CAS`, Armv8.1+) does the RMW in one instruction with no loop, which is dramatically better under high contention. It matters for hot reference counts, spinlocks, and lock-free structures.

### Q: Your lock-free code passes thousands of runs on x86 and fails on a Snapdragon. First hypothesis?
A missing acquire/release somewhere. x86's TSO accidentally provides the ordering your code relies on; AArch64's weak model doesn't, so the latent race surfaces. Audit every atomic for the correct `memory_order` and look for a non-atomic access "protected" only by a `relaxed` flag.

### Q: Why must `cv.wait` take a `unique_lock`, and why the predicate form?
Because `wait` must atomically unlock-and-sleep then relock — it needs to *own* and *manipulate* the lock state, which `lock_guard` can't expose. The predicate form re-checks the condition on wake, making it immune to spurious wakeups and lost-wakeup races.

### Q: Two `std::atomic<int>` counters incremented by different threads are slow despite being independent. Why?
False sharing — they share a 64-byte cache line, so each increment invalidates the other core's copy. Pad/align each to its own cache line (`alignas(64)` / `hardware_destructive_interference_size`).
