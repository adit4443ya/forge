<!--
category: The Machine
tags: Cache Coherence, MESI, MOESI, MESIF, False Sharing, Store Buffer, Memory Model, x86-TSO, AArch64, Weak Memory, Litmus Tests, SB, MP, LB, IRIW, Multi-Copy Atomicity, RCsc, RCpc, Barriers, DMB, LDAR, STLR, perf c2c, herd7
difficulty: Advanced
readTime: 50 min
-->

# Coherence and the Hardware Memory Model

> [!IMPORTANT]
> **TL;DR — what you must remember:** Two different guarantees get confused constantly. **Coherence** is per-location and you always have it: all cores agree on the order of writes to *one* address, and it is implemented by MESI. **Consistency** is *across* locations, and you mostly do not have it: the order one core's accesses to *different* addresses become visible to another is weak, because the **store buffer** — a pure performance structure — lets a core read past its own un-drained writes. x86 is TSO and permits exactly one reordering (**StoreLoad**); AArch64 permits nearly all of them. That single difference is why racy code passes on a laptop and fails on a phone. Litmus tests name each case; barriers buy back exactly the ordering you name.

Guide 24 treated memory as one core talking to one hierarchy. Add a second core
and two genuinely new questions appear, which most engineers merge into one and
then cannot reason about:

1. If two caches hold the same line and one is written, how does the other find
   out? → **coherence**, Parts 1–3.
2. If a core writes `x` and then `y`, in what order does another core see those
   two *different* locations change? → **consistency**, Parts 4–8.

The first is solved, automatic, and costs you performance. The second is not
solved, not automatic, and costs you correctness.

> **Where the numbers come from.** Measured on one pinned machine with turbo
> disabled, by the labs named in parentheses: `concurrency/01`–`05`, `cache/04`.
> The constants are that machine's; the *shapes* and the permitted-outcome
> tables are architectural and universal.

---

# PART 1 — COHERENCE VERSUS CONSISTENCY

Get this distinction right and the rest of the guide is mechanical. Get it wrong
and nothing in weak memory will ever make sense.

**Coherence** is a per-location property. For any *single* memory location,
there is one total order of the writes to it, and every core observes a sequence
of values consistent with that order. In particular a core can never see the
value of a location go *backwards*. This is guaranteed by the hardware, for
free, even for `relaxed` atomics and even for plain non-atomic accesses that are
not racing. The C++ standard calls it the **modification order** of an object.

**Consistency** (memory ordering) is an *across-location* property. It says
which orderings of accesses to *different* locations one core may observe in
another. This is where architectures differ, where `memory_order` lives, and
where your bugs are.

A compact way to hold it:

```
  coherence    "everyone agrees about the history of x"            ← always true
  consistency  "everyone agrees about the relative order of x and y" ← usually false
```

A litmus test makes it concrete. With `x` initially 0 and one core doing
`x = 1; x = 2;`:

| Observation by another core | Permitted? |
| :--- | :--- |
| reads 0, then 1, then 2 | yes |
| reads 0, then 2 | yes — it simply missed the intermediate value |
| reads 2, then 1 | **no** — that is a coherence violation, and no architecture allows it |

So "I used `relaxed`, could I see the value go backwards?" is answered *no* by
coherence alone. `relaxed` gives up ordering against *other* locations, never
coherence on this one.

---

# PART 2 — MESI, DERIVED

Do not memorise four letters. Derive them, and the protocol becomes obvious.

## The invariant the hardware must maintain

Caches are write-back, so a line may live in several caches at once. For the
data to stay sane, the hardware enforces **single-writer / multiple-reader**:
for any line, at any time, either

- exactly one cache may write it and no other cache holds it, **or**
- any number of caches may hold read-only copies.

Every state and transition below exists to maintain that invariant.

## The states fall out

Start with the minimum three:

- **Invalid** — I do not have this line.
- **Shared** — I have a clean copy; others may too; I may read, not write.
- **Modified** — I have the only copy, it is dirty, memory is stale; I may read
  and write.

That works. But consider the single most common pattern in all of computing: a
thread allocates something, reads it, then writes it, and *no other core is
involved*. With only three states, the read brings the line in as Shared, and
the write must then broadcast an upgrade request — a bus transaction — to
invalidate copies that do not exist.

So add a fourth state purely to avoid that waste:

- **Exclusive** — I have the only copy, it is clean. I may silently transition
  to Modified on a write, with no message at all.

That is **MESI**, and the `E` state is the whole reason it beats the three-state
version on ordinary single-threaded code.

## The transitions worth naming

| Event | Transition | Message |
| :--- | :--- | :--- |
| Read miss, nobody else has it | I → **E** | read request |
| Read miss, others hold it | I → **S** (they stay S) | read request |
| Write to a line in S | S → **M** | invalidate / upgrade to all sharers |
| Write miss | I → **M** | **read-for-ownership** — fetch *and* invalidate |
| Another core reads my M line | M → **S** | supply the data, write back |
| Another core writes my line | M/E/S → **I** | invalidate |

Two of these deserve emphasis:

- **Read-for-ownership (RFO).** Writing one byte of a line you do not hold
  requires fetching the entire line *and* invalidating everyone else's copy. A
  write is a more expensive operation than a read, not a cheaper one.
- **M → S on a remote read** is why a producer/consumer handoff costs a line
  transfer in each direction.

## The extensions you should recognise

- **MOESI** (used by AMD) adds **Owned**: a dirty line may be *shared* while one
  cache remains responsible for supplying it, so a dirty line can be read by
  others without first being written back to memory.
- **MESIF** (used by Intel) adds **Forward**: when several caches hold a clean
  line, exactly one is designated to answer requests, instead of all of them
  responding at once.

Both are optimisations of *who supplies the data*, not changes to the invariant.

## Snooping does not scale, so the LLC keeps a directory

With a few cores you can broadcast every request and have each cache snoop it.
That is O(n) traffic per access and collapses as core counts grow. Modern server
and desktop parts use a **directory**: the last-level cache (distributed in
slices) records which cores hold each line, so an invalidate is sent only to the
cores that actually have it. A side effect you can measure: L3 latency depends
on *which slice* holds the line, which is the "24 ns rising to 80+" spread in
guide 24's staircase.

---

# PART 3 — WHAT COHERENCE COSTS YOU: FALSE SHARING

Coherence operates on **lines**, and knows nothing about your variables. Two
completely independent variables that happen to share 64 bytes are, to the
protocol, one object.

`cache/04` gives two counters to two cores. Adjacent in one line, the counters
run **6–12x slower** than the same counters padded onto separate lines. Nothing
is shared logically; everything is shared physically.

The sharpest result in that lab: **false sharing costs essentially the same as
true sharing.** Writing the *same* variable from two cores and writing two
*different* variables on one line both reduce to the same thing — the line
ping-ponging between cores, each transfer on the order of 40–100 ns. The
protocol cannot tell them apart, and neither can your latency.

## Finding it rather than guessing

```sh
perf c2c record -ag -- sleep 3
perf c2c report
```

`perf c2c` ("cache to cache") identifies the lines with the most remote hits and
attributes them to **the offsets within the line** and the functions touching
them. That offset list is what turns "something is false sharing" into "these
two fields". Pair it with `pahole` to map offsets back to struct members.

A refinement worth knowing: `perf c2c report --double-cl` groups at
*double* cache-line granularity, which catches contention caused by
adjacent-line prefetching pulling in the neighbouring line too.

The kernel's own documentation (`Documentation/kernel-hacking/false-sharing`)
adds the judgement call: false sharing is not always worth fixing. Padding costs
memory and complexity, and if the line is not hot, you have traded real memory
for an imaginary win. Measure first.

## The fixes, in order of preference

1. **Do not share.** Per-core or per-thread state, aggregated at the end, is the
   only solution with no steady-state coherence traffic at all.
2. **Pad to a line.** `alignas(std::hardware_destructive_interference_size)`, or
   `alignas(64)` where that is unavailable. Note the matching
   `hardware_constructive_interference_size`, which asks the opposite question:
   what should be packed *together* so one fetch gets it all.
3. **Reduce write frequency.** Readers of a shared line are free once everyone
   has a copy; it is writes that force transfers. Batch updates locally and
   publish occasionally.

The SPSC queue in `concurrency/02` demonstrates all three at once, and is
developed in [guide 27](#guide/27/part-4-the-spsc-ring-buffer-optimised-three-times).

---

# PART 4 — THE STORE BUFFER FORCES A WEAK MEMORY MODEL

Here is the derivation that makes weak memory inevitable rather than perverse.

## The structure

From guide 24: a store retires into a **store buffer** and drains to cache
later. This exists so a core is not stalled for hundreds of cycles every time it
writes a line it does not own. It is one of the highest-value structures in the
machine.

## The consequence, in four lines

Take two cores, `x` and `y` both initially 0:

```
  Core 0              Core 1
  x = 1;              y = 1;
  r0 = y;             r1 = x;
```

Core 0 puts `x = 1` into its store buffer. The store is **not yet visible to
anyone else**. Core 0 then reads `y` — which goes to cache, bypassing the
buffer, because `y` is a different address. Core 1 does the mirror image. Both
reads can therefore return **0**.

`r0 == 0 && r1 == 0` is impossible under any interleaving of the program
statements. It happens anyway. And notice what caused it: *nothing* exotic. No
out-of-order execution, no compiler reordering, no speculation. Just a buffer
that makes stores fast.

**This is why weak memory models exist.** They are not architects being
difficult; they are the honest specification of structures that exist for
performance. A model that forbade this would require draining the store buffer
on every load, giving up the structure entirely.

## Measured, not asserted

`concurrency/05` runs exactly this pattern a million times:

| Ordering used | Trials showing `r0 == r1 == 0` |
| :--- | :--- |
| `relaxed` | **8.8%** |
| `acquire`/`release` | **24.6%** |
| `seq_cst` | **0%** |

Read that table carefully, because the obvious interpretation is wrong.

The difference between 8.8% and 24.6% is **not** a difference in guarantees. On
x86, `relaxed` and `acquire`/`release` loads and stores both compile to plain
`mov`; the architecture permits this outcome identically in both cases. The
differing rates reflect how often the timing window happens to line up given the
surrounding code — not a property of the model. **A litmus experiment measures a
frequency, never a specification.** An outcome you never observe may still be
permitted, which is exactly why you reason from the model and use the experiment
only to prove that a permitted thing is also *real*.

The meaningful row is the last one. `seq_cst` reaches 0%, because it is the only
ordering that closes the StoreLoad hole.

---

# PART 5 — x86-TSO

x86 is **Total Store Order**. Informally: the store buffer is FIFO, with
store-to-load forwarding, and that is the *only* relaxation.

## What is and is not permitted

| Reordering | Permitted on x86? |
| :--- | :--- |
| Load then Load | no |
| Load then Store | no |
| Store then Store | no |
| **Store then Load** (different addresses) | **yes** |

Consequences that follow directly, and that you should be able to state without
hesitation:

- A plain `mov` load already has **acquire** semantics.
- A plain `mov` store already has **release** semantics.
- Therefore `acquire`/`release` are **free** on x86 — literally the same
  instruction as `relaxed`.
- Only `seq_cst` costs anything, and only on the **store** side, because
  StoreLoad is the one hole to close. Implementations put the fence on the store
  (`xchg`, which carries an implicit `lock`) so that loads stay free.

`concurrency/03` compiles every `memory_order` and confirms it: on x86-64 the
only row that differs is the `seq_cst` store. An `xchg` costs on the order of
20–40 cycles including the store-buffer drain; `lock xadd` and `lock cmpxchg`
cost roughly 18 cycles uncontended regardless of the ordering requested — which
means **on x86 a relaxed RMW is not cheaper than a seq_cst RMW**, a fact that
surprises people trying to micro-optimise.

## It is a real formal model, not a folk description

x86-TSO was given a rigorous operational semantics (write buffers plus a global
lock) and an equivalent axiomatic one by Owens, Sarkar and Sewell. This mattered
historically: the vendor prose was ambiguous enough that an earlier attempt,
x86-CC, turned out to be *unsound* against real hardware. The formal model is
now the standard reference for what x86 actually guarantees.

Being able to say "x86 is TSO, which has been formally specified, and the one
permitted reordering is StoreLoad" is a complete and correct answer.

---

# PART 6 — AArch64 AND WEAK MEMORY

AArch64 permits essentially every reordering unless you ask otherwise. Nothing
is ordered by default.

## Multi-copy atomicity — the revision that matters

A model is **multi-copy atomic** if a write, once visible to any other observer,
is visible to *all* of them at the same time. Writes do not propagate to
different cores at different times.

- **ARMv7 and POWER** are **not** multi-copy atomic. Two cores can genuinely
  disagree about the order of two other cores' writes. This forces *cumulative*
  barriers and makes reasoning considerably harder.
- **ARMv8 is other-multi-copy atomic** — a deliberate strengthening, formalised
  in the revised ARMv8 model. A write becomes visible to all other cores at
  once, even though a core may still see its own write early via forwarding.

The practical payoff: on ARMv8 ordering a reader's own loads is *sufficient* to
make readers agree, whereas on POWER you additionally need cumulative barriers.

## The instructions

| C++ | AArch64 (v8.0) | With LSE (v8.1+) |
| :--- | :--- | :--- |
| relaxed load / store | `LDR` / `STR` | same |
| acquire load | `LDAR` | `LDAR` (or `LDAPR`, v8.3+) |
| release store | `STLR` | `STLR` |
| relaxed RMW | `LDXR`/`STXR` retry loop | `LDADD`, `SWP`, `CAS` |
| acq_rel / seq_cst RMW | `LDAXR`/`STLXR` retry loop | `LDADDAL`, `SWPAL`, `CASAL` |
| acquire fence | `DMB ISHLD` | same |
| release / full fence | `DMB ISH` | same |

Reading notes that separate depth from recitation:

- **`LDAR`/`STLR` are RCsc**, not merely RCpc. An `STLR` and a later `LDAR` to a
  *different* address are ordered with respect to each other. This is precisely
  why C++ `seq_cst` can lower to plain `LDAR`/`STLR` without an extra fence, and
  why on AArch64 `seq_cst` is barely more expensive than acquire/release — the
  opposite of the x86 cost structure.
- **`LDAPR` (ARMv8.3) is the RCpc variant** — acquire semantics *without* the
  sequentially-consistent ordering against prior releases. It is the cheaper,
  more precise lowering for C++ `acquire`, and its existence is the clearest
  evidence that RCsc was costing something real.
- **LSE atomics** replace the exclusive-monitor retry loop with one instruction.
  Under contention this is a large win, because `LDXR`/`STXR` can livelock:
  every failed `STXR` retries, and contending cores can starve each other.
- **The suffixes are systematic**: `A` = acquire, `L` = release, `AL` = both.

## DMB, DSB, ISB — the three that get confused

| Instruction | What it does | Use it for |
| :--- | :--- | :--- |
| `DMB` | orders memory accesses relative to each other | ordinary memory ordering |
| `DSB` | waits for completion of prior accesses *and* maintenance operations | after cache/TLB maintenance |
| `ISB` | flushes the pipeline so later instructions are re-fetched | after changing system registers, self-modifying code |

The common error is reaching for `DSB` or `ISB` for data ordering. `ISB` is not
a data barrier at all. For ordinary concurrent data, `DMB ISH` (inner shareable)
is the right tool, and the shareability domain matters: `ISH` covers the cores
you share memory with, while `SY` is broader and slower.

## The practical asymmetry

| | x86-64 (TSO) | AArch64 (weak) |
| :--- | :--- | :--- |
| plain load | already acquire | **no ordering** |
| plain store | already release | **no ordering** |
| acquire / release cost | **free** | `LDAR` / `STLR` — cheap, not free |
| `seq_cst` store cost | `xchg` — the only thing you pay for | `STLR` — about the same as release |
| RMW cost by ordering | flat (always `lock`) | rises with ordering; LSE flattens it |

Two conclusions, both measured in `concurrency/03`:

1. **Bugs hide on x86 and surface on ARM.** Code that omits synchronisation but
   "works" on a desktop because TSO accidentally supplied the ordering will fail
   on a weakly-ordered core. The weak model is the *honest* one. Test
   concurrency on ARM, or under a tool that simulates it.
2. **The optimisation incentive flips.** On x86 there is no point weakening a
   RMW below `seq_cst`. On AArch64 weakening helps, but since `seq_cst` is
   barely more than acquire/release there, the gain from hand-tuning down to
   `relaxed` is smaller than people expect. Measure before you weaken, and
   remember that weakening trades away provability.

---

# PART 7 — THE LITMUS CATALOGUE

A litmus test is a tiny program plus a question: *can this outcome happen?* They
are the shared vocabulary of memory models. Knowing five by name is worth more
than any amount of prose.

Assume all variables start at 0 and all accesses are plain or `relaxed` unless
stated.

## SB — Store Buffer (also Dekker)

```
  Core 0            Core 1
  x = 1             y = 1
  r0 = y            r1 = x
  Question: r0 == 0 && r1 == 0 ?
```

| SC | x86-TSO | ARMv8 |
| :--- | :--- | :--- |
| forbidden | **allowed** | **allowed** |

The canonical StoreLoad case, and the only one x86 permits. Fix with `seq_cst`
on all four accesses, or an explicit full fence (`MFENCE` / `DMB ISH`) between
each store and its following load. This is the pattern — and the *only* common
pattern — for which `seq_cst` is actually required.

## MP — Message Passing

```
  Core 0            Core 1
  data = 42         r0 = flag
  flag = 1          r1 = data
  Question: r0 == 1 && r1 == 0 ?   (flag seen, data not)
```

| SC | x86-TSO | ARMv8 |
| :--- | :--- | :--- |
| forbidden | **forbidden** | **allowed** |

**This is the single most important row in the guide.** It is the publish/consume
pattern every program uses, it is *safe on x86 by accident*, and it is broken on
AArch64. A release store on `flag` and an acquire load of `flag` forbid it
everywhere. This one line explains the entire "passes on my laptop, fails on the
phone" genre of bug.

## LB — Load Buffer

```
  Core 0            Core 1
  r0 = x            r1 = y
  y = 1             x = 1
  Question: r0 == 1 && r1 == 1 ?
```

| SC | x86-TSO | ARMv8 |
| :--- | :--- | :--- |
| forbidden | **forbidden** | **allowed** |

Requires reordering a load with a *later* store, which TSO forbids. It is
allowed on weak models and is the one that makes people uneasy, since the values
appear to come from the future. Dependencies or a barrier forbid it.

## IRIW — Independent Reads of Independent Writes

```
  Core 0    Core 1    Core 2            Core 3
  x = 1     y = 1     r0 = x            r2 = y
                      r1 = y            r3 = x
  Question: r0==1 && r1==0 && r2==1 && r3==0 ?
            (Core 2 says x first; Core 3 says y first)
```

| SC | x86-TSO | ARMv8 (plain loads) | ARMv8 (loads ordered) |
| :--- | :--- | :--- | :--- |
| forbidden | **forbidden** | **allowed** | forbidden |

The subtle one, and worth getting exactly right. x86-TSO forbids it because TSO
is multi-copy atomic *and* does not reorder loads. On ARMv8 the outcome is still
observable with plain loads — not because writes propagate non-atomically
(ARMv8 is other-multi-copy atomic) but because each reader may reorder **its
own two loads**. Order those loads — `DMB LD` between them, or make both
acquire — and other-multi-copy atomicity makes the readers agree. On POWER,
which is *not* multi-copy atomic, ordering the loads is **not** enough; you need
cumulative barriers (`sync`).

## CoRR — Coherence, Read-Read

```
  Core 0            Core 1
  x = 1             r0 = x
  x = 2             r1 = x
  Question: r0 == 2 && r1 == 1 ?   (the value went backwards)
```

| SC | x86-TSO | ARMv8 | POWER |
| :--- | :--- | :--- | :--- |
| forbidden | forbidden | forbidden | forbidden |

Forbidden **everywhere**, including for `relaxed` atomics. This is Part 1's
coherence guarantee stated as a litmus test, and it is the reason "relaxed means
anything can happen" is wrong.

## Two more to recognise

- **WRC** (write-to-read causality) tests whether a chain of observations across
  three cores is respected — the cumulativity question. Release/acquire handles
  it on ARMv8; POWER needs more.
- **ISA2** extends the chain further and is the standard stress test for
  cumulative barriers.

## The summary table to carry

| Test | What it tests | x86-TSO | ARMv8 | Fix |
| :--- | :--- | :--- | :--- | :--- |
| **CoRR** | coherence | forbidden | forbidden | nothing needed |
| **MP** | publish/consume | forbidden | **allowed** | release + acquire |
| **LB** | load→store | forbidden | **allowed** | dependency or barrier |
| **SB** | store→load | **allowed** | **allowed** | `seq_cst` or full fence |
| **IRIW** | observer agreement | forbidden | **allowed** (plain loads) | order both readers' loads |

Read the x86 column top to bottom: only SB is allowed. That is TSO in one
column, and it is why x86 forgives so much.

---

# PART 8 — BARRIERS, AND TOOLS THAT CHECK YOUR REASONING

## The four orderings a barrier can enforce

Any fence is some subset of: **LoadLoad**, **LoadStore**, **StoreStore**,
**StoreLoad**. StoreLoad is always the expensive one, because it is the one that
requires actually draining the store buffer.

| Architecture | Free by default | Instruction for the rest |
| :--- | :--- | :--- |
| x86-64 | LoadLoad, LoadStore, StoreStore | `MFENCE`, or any `lock`-prefixed op, for StoreLoad |
| AArch64 | none | `DMB ISHLD` (load-side), `DMB ISHST` (store-side), `DMB ISH` (full) |

On x86, `LFENCE` and `SFENCE` are *not* the general-purpose fences people assume
— ordinary loads and stores are already ordered. They matter for non-temporal
stores and for `LFENCE`'s speculation-blocking role. The fence you want for
StoreLoad is `MFENCE` or a `lock`ed instruction, and a `lock or [rsp], 0` is a
common cheaper idiom.

## Compiler barriers are a different thing

`std::atomic_signal_fence`, or `asm volatile("" ::: "memory")`, stops the
*compiler* reordering while emitting no instruction. It gives you nothing
against the hardware. Confusing the two produces code that is correct on x86
(where the hardware does most of the work) and broken elsewhere — the MP pattern
all over again.

And `volatile` is neither. It controls neither atomicity nor inter-thread
ordering and is not a concurrency tool in C++; its correct uses are
memory-mapped I/O and signal handlers.

## Check your reasoning mechanically

You do not have to argue about litmus outcomes from memory.

- **`herd7` and `litmus7`** (the diy/herdtools suite) take a litmus test and
  either *simulate* it against a formal model (`herd7`) or *run* it on real
  hardware many times (`litmus7`). Disagreement between them is the interesting
  case.
- **The Linux-Kernel Memory Model** ships in the kernel tree
  (`tools/memory-model/`) with its own litmus tests, and
  `Documentation/memory-barriers.txt` is the kernel's authoritative prose.
- **CppMem** explores the C++ model's permitted executions for a small program.
- **ThreadSanitizer** finds races in real programs. It is dynamic — it reports
  what it observed — so it proves the presence of bugs, never their absence.
  `concurrency/01` has it flagging both a race the optimizer hides and a race
  that silently loses half its increments.

The honest workflow: reason from the model, confirm with `herd7`, then verify
the real program with TSan, and treat a measured frequency as evidence that a
permitted outcome is *also real* — never as evidence that an unobserved one is
forbidden.

---

# PART 9 — Q&A DRILL

### Q: Distinguish coherence from consistency.
Coherence is per-location: all cores agree on the single total order of writes
to any one address, and a core never sees a location's value go backwards. It is
free and automatic, implemented by MESI. Consistency is across locations: the
order in which one core's accesses to *different* addresses become visible to
another. It is not automatic, it differs by architecture, and it is what
`memory_order` controls.

### Q: Why does MESI have an Exclusive state when Modified and Shared would do?
To make the ordinary read-then-write pattern on private data free of bus
traffic. Without E, a line read into Shared requires an invalidate broadcast
before it can be written, even when no other cache holds it. E says "only copy,
clean", so the write is a silent upgrade to Modified with no message.

### Q: What is read-for-ownership, and what does it imply about writes?
To write any part of a line you must hold the whole line exclusively, so a write
miss fetches the line *and* invalidates every other copy. A write is therefore
more expensive than a read, and writing a buffer you intend to overwrite
completely still reads it in — which is the case non-temporal stores exist for.

### Q: Is false sharing cheaper than true sharing?
No — measurably about the same. Coherence works on lines, not variables, so two
cores writing different bytes of one line produce exactly the same ping-pong as
two cores writing the same variable. In the lab both cost 6–12x versus padded
counters.

### Q: You suspect false sharing in a large program. How do you confirm it rather than guess?
`perf c2c record -ag` then `perf c2c report`, which ranks cache lines by remote
access and attributes the contention to offsets within the line and the
functions touching them; `--double-cl` additionally catches adjacent-line
effects. Map the offsets to struct members with `pahole`. Then decide whether it
is worth padding — the kernel's own guidance is that not every instance is worth
the memory.

### Q: Derive why x86 permits StoreLoad reordering.
A store retires into the store buffer and is not yet globally visible; a
subsequent load of a *different* address reads cache directly and can complete
before that store drains. So the load appears to happen before the store. The
buffer exists so a core is not stalled on every store miss, and forbidding this
would mean draining it on every load.

### Q: Which single memory_order is required for the store-buffer pattern, and why is nothing weaker enough?
`seq_cst`. Acquire/release are one-way barriers that order accesses around a
*single* synchronising variable; the SB pattern has two independent variables and
needs a global total order over the operations so that both cores agree. Only
`seq_cst` provides that, and it is the only ordering that closes StoreLoad.

### Q: On x86, is a relaxed fetch_add cheaper than a seq_cst fetch_add?
No. Any RMW on x86 uses a `lock`-prefixed instruction, which is a full barrier
regardless of the ordering you requested — roughly 18 cycles uncontended in the
lab either way. Weakening the order changes nothing on x86; it changes a lot on
AArch64.

### Q: Why can C++ seq_cst lower to plain LDAR/STLR on AArch64 with no extra fence?
Because `LDAR`/`STLR` are RCsc: a store-release and a later load-acquire to
different addresses are ordered with respect to each other. That is exactly the
property `seq_cst` needs, so no separate `DMB` is required in the common case —
which is why `seq_cst` costs little more than acquire/release there, the
opposite of x86's cost structure.

### Q: What is LDAPR for?
It is the RCpc acquire introduced in ARMv8.3 — acquire semantics without the
sequentially-consistent ordering against prior release stores. It is the cheaper
and more precise lowering for C++ `acquire`, and its introduction is evidence
that `LDAR`'s stronger RCsc guarantee was costing real performance.

### Q: Your lock-free code passes millions of runs on x86 and fails on an ARM core. First hypothesis?
A missing acquire/release on a publish/consume handoff — the MP litmus test. MP
is forbidden on x86-TSO, so the code is correct there by accident, and allowed on
ARMv8, so the latent bug becomes real. Audit every place a flag or pointer
publishes data written before it.

### Q: ARMv8 is other-multi-copy atomic. Does that forbid IRIW?
Not by itself. Multi-copy atomicity means a write becomes visible to all other
cores simultaneously, which removes one cause of observer disagreement — but
each reader can still reorder its *own* two loads, which is enough to produce the
IRIW outcome. Order both readers' loads and ARMv8 then forbids it. On POWER,
which is not multi-copy atomic, ordering the loads is not sufficient and you need
cumulative barriers.

### Q: Someone fixes a race with `volatile`. What do you say?
That `volatile` provides neither atomicity nor inter-thread ordering, so it does
not fix a data race — which is undefined behaviour, not a stale value. It stops
some compiler caching, which can make the bug rarer and therefore worse. The fix
is an atomic or a lock. `volatile` is for memory-mapped I/O and signal handlers.

### Q: A litmus experiment never shows a given outcome. Is the outcome forbidden?
No. An experiment measures a frequency under one compiler, one microarchitecture
and one timing; a permitted outcome can have an arbitrarily small window. In the
lab, `relaxed` and `acquire/release` produced 8.8% and 24.6% for the same
permitted SB outcome purely because of surrounding timing — the difference was
not a difference in guarantees. Reason from the model; use `herd7` to check the
model and experiments only to show that something permitted is also real.

---

## Sources

- Peter Sewell, Susmit Sarkar, Scott Owens, Francesco Zappa Nardelli and Magnus O. Myreen, *x86-TSO: A Rigorous and Usable Programmer's Model for x86 Multiprocessors*, Communications of the ACM 53(7), 2010 — [cl.cam.ac.uk/~pes20/weakmemory](https://www.cl.cam.ac.uk/~pes20/weakmemory/). The earlier TPHOLs 2009 paper *A Better x86 Memory Model: x86-TSO* gives the operational and axiomatic definitions, and records that the preceding x86-CC model was unsound against hardware.
- Christopher Pulte, Shaked Flur, Will Deacon, Jon French, Susmit Sarkar and Peter Sewell, *Simplifying ARM Concurrency: Multicopy-Atomic Axiomatic and Operational Models for ARMv8*, POPL 2018 — the revision that made ARMv8 other-multi-copy atomic.
- Sarita V. Adve and Kourosh Gharachorloo, *Shared Memory Consistency Models: A Tutorial*, IEEE Computer, 1996 — the standard introduction to the whole topic.
- Hans-J. Boehm and Sarita V. Adve, *Foundations of the C++ Concurrency Memory Model*, PLDI 2008 — why the C++ model is shaped the way it is.
- Paul E. McKenney, *Is Parallel Programming Hard, And, If So, What Can You Do About It?* ("perfbook"), and *Memory Barriers: a Hardware View for Software Hackers* — the practitioner's treatment of barriers, cumulativity and coherence.
- *Weak Memory Model Formalisms: Introduction and Survey*, [arXiv:2508.04115](https://arxiv.org/pdf/2508.04115) — a recent survey placing x86-TSO, ARM and POWER models side by side.
- Linux kernel: `Documentation/memory-barriers.txt`, the Linux-Kernel Memory Model in `tools/memory-model/`, and `Documentation/kernel-hacking/false-sharing` ([docs.kernel.org](https://docs.kernel.org/kernel-hacking/false-sharing.html)) for the `perf c2c` workflow and the judgement call on when to pad.
- The herdtools suite (`herd7`, `litmus7`, `diy7`) for simulating and running litmus tests; CppMem for the C++ model.
- *Arm Architecture Reference Manual* for `LDAR`/`STLR`/`LDAPR`, the LSE atomics, and the `DMB`/`DSB`/`ISB` distinction; *Intel 64 and IA-32 Architectures Software Developer's Manual*, volume 3A, chapter 8, for the x86 memory-ordering rules.
- Jeff Preshing's memory-ordering series at [preshing.com](https://preshing.com/) — the most approachable bridge between the formal models and working code.
- Lab measurements: `concurrency/01` (races TSan catches), `concurrency/03` (every `memory_order` compiled for x86-64, AArch64 v8.0 and LSE), `concurrency/05` (the SB litmus test over a million trials), `cache/04` (false sharing versus padding).
