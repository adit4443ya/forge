<!--
category: The Machine
tags: Memory Hierarchy, DRAM, Row Buffer, Cache Line, Associativity, Conflict Miss, VIPT, 4K Aliasing, Prefetcher, MLP, MSHR, Fill Buffer, Store Buffer, Little's Law, AoS, SoA, Bandwidth
difficulty: Advanced
readTime: 45 min
-->

# The Memory Hierarchy, Derived

> [!IMPORTANT]
> **TL;DR — what you must remember:** Memory is slow for a *physical* reason — a DRAM bit is a leaking capacitor that must be sensed by an analog amplifier — and that reason has not improved for thirty years while bandwidth has. Everything above it is compensation: **lines** amortise the access, **sets and ways** make lookup cheap, **prefetchers** guess the future, and **fill buffers** overlap the waiting. Learn the hierarchy as one machine with one currency — *outstanding requests* — and the headline rule follows: a dependent load costs the full latency, and the only way to go faster is to have more loads in flight at once. That is Little's law, and it is the whole optimisation story.

Most memory advice is folklore repeated without its mechanism: "be cache
friendly", "use SoA", "add a prefetch". Each is sometimes right. This guide
builds the hierarchy from the bottom so you can tell *when*, and so that a
counter reading points at a cause instead of a guess.

The chain this guide covers is the first link of a longer one. Coherence and
ordering — what happens when a *second* core touches the same line — is
[Coherence and the Hardware Memory Model](#guide/25/part-1-coherence-versus-consistency).
Translation and the OS underneath it is
[Virtual Memory and the OS Tax](#guide/26/part-1-the-page-walk).

> **Where the numbers come from.** Every measured figure below was produced on
> one machine (a hybrid 12th-generation x86-64 laptop part, pinned to a
> performance core, turbo disabled, `THP=madvise`) by the labs named in
> parentheses — `cache/01` through `cache/06`, `perf/02`, `perf/04`. They are
> *that machine's* numbers. The shapes of the curves are universal; the
> constants are not. Reproduce them on your own box before quoting them.

---

# PART 1 — WHY THERE IS A HIERARCHY AT ALL

A hierarchy is not an optimisation someone chose. It is forced by the fact that
you cannot have capacity and latency at the same time.

## A DRAM bit is a capacitor, and that changes everything

One DRAM cell is **one transistor and one capacitor**. The capacitor holds a
charge that means 0 or 1. Three consequences follow, and all of DRAM's
behaviour comes from them:

1. **The charge leaks.** It must be rewritten periodically — *refresh* — or the
   data is lost. Refresh is not free: while a bank refreshes, it cannot be read.
2. **Reading is destructive.** Sensing the capacitor drains it. The row has to
   be written back after every read, which is why there is no such thing as a
   cheap "peek".
3. **Sensing is analog.** A tiny charge is compared against a reference by a
   *sense amplifier*, which takes time set by physics and circuit design, not by
   the logic clock. This is the part that has not got meaningfully faster.

SRAM — what caches are made of — uses six transistors per bit in a latching
configuration. No leak, no destructive read, no analog settle. It is *far*
faster and roughly an order of magnitude more expensive in area per bit. That
area cost is why L1 is tens of kilobytes and DRAM is gigabytes, and the whole
hierarchy exists to paper over the gap.

## The memory wall

Through the 1990s and 2000s, processor clock and instruction throughput improved
far faster than DRAM latency. Bandwidth kept scaling — wider buses, more
channels, higher transfer rates — because bandwidth is a matter of width and
frequency. Latency did not, because latency is dominated by that analog sense
and the fixed command sequence around it. Wulf and McKee named the resulting
divergence the **memory wall** in 1995, and the prediction aged well.

The practical form of the wall, stated as a ratio you should carry around: a
dependent DRAM access on a modern core costs **hundreds of instruction slots**.
On the lab machine a dependent random load is ~140 ns (`cache/02`, `cache/05`);
at a few GHz that is several hundred cycles, during which a 4-to-6-wide core
could have retired well over a thousand instructions. *Arithmetic is free.
Memory is the program.*

> This is why "optimise the loop body" is so often the wrong instinct. If the
> loop is waiting on memory, making the arithmetic cheaper changes nothing —
> a point `perf/04` makes concrete when a `volatile` accumulator turns out to
> cost 8x more than the real work.

---

# PART 2 — INSIDE DRAM: ROWS, BANKS, AND WHY "RANDOM" IS WORSE THAN THE LATENCY NUMBER

The single quoted "DRAM latency" number hides a state machine. Knowing it
explains several otherwise baffling measurements.

## The address is a hierarchy too

A physical address is decomposed by the memory controller into:

```
  channel → DIMM/rank → bank group → bank → row → column
```

Within a bank, the array is a grid. To read anything you must first **ACTIVATE**
a row, which copies that entire row — typically a few kilobytes — into the
bank's **row buffer** (also called the open page, and unrelated to a virtual
memory page). Only then can a **READ** select a column out of the row buffer.

## Three outcomes, three very different costs

| Access | What happens | Cost |
| :--- | :--- | :--- |
| **Row-buffer hit** | The row you want is already open | the column read alone (`CL`) |
| **Row-buffer miss (empty)** | Activate, then read | `tRCD` + `CL` |
| **Row-buffer conflict** | A *different* row is open: close it, then activate, then read | `tRP` + `tRCD` + `CL` |

The names are JEDEC's: `CL` column-address-strobe latency, `tRCD` row-to-column
delay, `tRP` row precharge. The exact values are on the module's datasheet and
differ per generation and part; what you need is the *shape* — a conflict costs
roughly three sequential waits where a hit costs one.

Now two mysteries dissolve:

- **Sequential access is fast for a second reason.** Beyond lines and
  prefetching, consecutive addresses tend to land in the same open row, so most
  accesses are row-buffer hits. `cache/01` measures 0.56 ns per access at
  stride 1 — well below any single DRAM access — because lines, prefetching and
  row hits all compound.
- **Truly random access over a large region is worse than the quoted latency.**
  Every access is likely a row conflict in some bank, and the controller's
  queues are full of them. The 128–184 ns range `cache/02` reports for the DRAM
  plateau is the *achieved* latency with all of this included, which is why it
  exceeds any datasheet `CL` by a wide margin.

## Bank-level parallelism and interleaving

Each bank has its own row buffer, so several banks can be mid-activation at
once. The controller interleaves addresses across channels and banks precisely
so that a sequential stream spreads over many banks and keeps them all busy —
this is where DRAM *bandwidth* comes from, and it is why bandwidth scales while
latency does not. Two access streams whose addresses differ by exactly the
interleaving period can land on the same bank repeatedly and serialise: a
**bank conflict**, the DRAM-level cousin of the cache conflict miss in Part 4.

> **Interview-grade summary:** DRAM is not a flat array with one latency. It is
> banks of rows behind a row buffer, and the cost of an access depends on what
> was open before it. Sequential wins three times over; random loses three times
> over.

---

# PART 3 — THE LINE IS THE UNIT

Because an access is expensive and mostly fixed-cost, hardware never fetches one
byte. It fetches a **cache line**: 64 bytes on x86-64 and on most AArch64
implementations.

> **Do not hardcode 64.** AArch64 reports the line size in `CTR_EL0`, and
> implementations legitimately differ — some Apple designs use 128-byte lines.
> In C++ use `std::hardware_destructive_interference_size` when it is available
> (it is 64 on typical x86-64 and can be 128 on other targets), and read
> `/sys/devices/system/cpu/cpu0/cache/index0/coherency_line_size` at runtime
> when you need the truth on the box you are on.

## What that means for your loop

`cache/01` sweeps a stride over a large array and reports nanoseconds per
access:

| Stride | ns / access | Why |
| :--- | :--- | :--- |
| 1 byte | 0.56 | 64 useful accesses per line; prefetcher streaming; row-buffer hits |
| 64 bytes | 4.3 | one line fetched per access, nothing amortised |
| 4096 bytes | 17.7 | one line *and* one page per access; prefetcher defeated; conflict misses |

The 8x step from stride 1 to stride 64 is the line doing its job: the *same*
number of lines move in both cases, but at stride 1 you used all 64 bytes and at
stride 64 you used one. Traffic is measured in lines, not in bytes you asked
for.

The stride-4096 row is the one to be able to explain, because *three* mechanisms
pile on at once. Part 4 and the TLB section of
[guide 26](#guide/26/part-2-tlb-reach-and-the-cliff-it-explains) supply the other two.

## The corollary that changes data structure design

**A field you never read still costs its line.** If you scan one 4-byte field of
a 64-byte struct, you move the whole 64 bytes: you are using 1/16 of the
bandwidth you are paying for. That single sentence is the entire justification
for structure-of-arrays, and Part 8 gives the measured conditions under which it
pays and the conditions under which it loses.

---

# PART 4 — CACHE ORGANISATION: SETS, WAYS, AND THE CONFLICTS THEY CREATE

A cache must answer "do I have this line?" in a couple of cycles. Searching
every line is impossible; allowing only one location per address is too rigid.
The compromise is **set associativity**.

## The address split

```
  ┌──────────── tag ────────────┬─── set index ───┬── line offset ──┐
   identifies which line           picks the set     byte in line
```

- **offset** = log2(line size) = 6 bits for 64-byte lines
- **index** = log2(number of sets)
- **tag** = everything above

Lookup reads the one set the index selects, then compares the tag against all
`W` ways in parallel. `W` comparators, one set read: cheap and flexible.

## Deriving the lab machine's L1 — and why L1 sizes are what they are

The lab machine reports a 48 KiB, 12-way L1D. That is not an arbitrary number:

```
  48 KiB / 64-byte lines = 768 lines
  768 lines / 12 ways    = 64 sets
  64 sets                → 6 index bits
  6 index + 6 offset     = 12 bits = 4096 bytes = exactly one page
```

The index and offset together consume exactly the low 12 bits — **the page
offset**, the bits that are *identical* in the virtual and the physical address.
That is the **VIPT** trick (virtually indexed, physically tagged): the cache can
start reading the set from the virtual address immediately, in parallel with
address translation, and only needs the physical address later for the tag
compare. No translation on the critical path.

This constraint — index bits must fit inside the page offset — gives
`L1 size ≤ page size × associativity`. It explains a decade of x86 history:
L1D sat at 32 KiB 8-way (4096 × 8) for many generations, and growing it to
48 KiB required going to 12 ways (4096 × 12) rather than adding index bits.
L2 and L3 are physically indexed and sit after translation, so they are free of
this limit and much larger.

> If someone asks "why is L1 so small?", the answer is not "cost". It is that
> L1 must be indexable before translation finishes, which caps the index bits,
> which caps the size at page size times associativity.

## Conflict misses, and the real reason stride 4096 is a disaster

A set holds only `W` lines. Touch `W+1` addresses that map to the same set and
you evict a line you still need, no matter how much total capacity is free.
That is a **conflict miss**, and it is distinct from a capacity miss.

Which addresses collide? Those whose index bits match — addresses separated by
a multiple of `sets × line size`. On the lab L1: 64 × 64 = **4096 bytes**.

So a stride of 4096 maps *every single access to set 0*. With 12 ways you can
hold 12 such lines and the 13th evicts the first. This is the third mechanism in
the stride table: one line used per access, one page per access (a TLB entry
each — see guide 26), and every access fighting for one set.

The general rule: **be suspicious of strides and array dimensions that are exact
powers of two**, especially multiples of 4096. A 1024 × 1024 array of doubles
has a row stride of 8192 bytes, so a column walk touches one set repeatedly.
Padding the row to 1024 + 8 elements breaks the alignment and can transform the
performance — one of the oldest tricks in numerical computing, and still worth
knowing why it works.

## 4K aliasing: when the core *guesses* two addresses conflict

A related effect lives in the load/store unit rather than the cache. To decide
whether a load might depend on a store still in flight, the core needs to
compare addresses — but the full physical address is not available early. It
compares the **low 12 bits**. Two addresses exactly 4096 bytes apart share those
bits, so a load can be falsely flagged as dependent on an unrelated in-flight
store and stalled until the ambiguity resolves.

The symptom is memorable and counter-intuitive: *two arrays with the same
alignment run slower than two arrays with deliberately different alignment.*
If you see it, offsetting one buffer by a line or two fixes it. Intel documents
the behaviour in its optimisation manual.

---

# PART 5 — THE STAIRCASE, MEASURED

`cache/02` chases a dependent pointer chain through a region of growing size.
Dependent is the key word: each load's address comes from the previous load, so
nothing can overlap and nothing can be prefetched. What you get is the machine's
honest latency curve.

| Region fits in | Size on this machine | Measured latency | Note |
| :--- | :--- | :--- | :--- |
| L1D | 48 KiB, 12-way | **2.4 ns** (~5 cycles) | 2 loads + 2 stores per cycle at this level |
| L2 | 1.25 MiB private | **4–12 ns** | the *rise within* L2 is the L1 dTLB running out, not L2 getting slower |
| L3 | 18 MiB shared | **24 ns** at 2 MiB → **80+** | shared with the efficiency cores; latency depends on which slice holds the line |
| beyond STLB reach | ~8 MB at 4 KiB pages | **+15–100 ns** | *page walks* — not a cache level at all |
| DRAM | — | **128–184 ns** | includes the walk and controller queueing |

Two things in that table are worth more than the numbers.

**First: one of the "cache" steps is not a cache.** The step at roughly 8 MB is
the second-level TLB running out of entries, so every access additionally pays a
page walk. 2048 STLB entries × 4 KiB per page = 8 MiB of reach. The arithmetic
lands exactly where the curve bends. Guide 26 derives this properly; the point
here is that a latency-vs-size curve contains *two* different staircases
interleaved, and reading one as the other is a classic misdiagnosis.

**Second: the rise inside L2 is also translation**, for the same reason one
level down — the ~96-entry L1 dTLB covers only ~384 KiB at 4 KiB pages. A naive
reading ("L2 gets slower as you use more of it") is wrong, and the fix if it
matters is huge pages, not data layout.

> **How to use this in an investigation.** Measure *your* curve once, with a
> dependent chain, and keep it. It tells you which plateau a structure's working
> set lands on, and a plateau is a far better predictor of cost than any
> published latency table.

---

# PART 6 — PREFETCHERS: THE HARDWARE'S GUESS

A prefetcher watches the access stream, predicts the next line, and fetches it
early. When it works, latency vanishes — not reduced, *hidden*.

How well it works is measurable, and the result surprises people. In `perf/02`,
a stride-1 sweep over 640 MB shows **almost no demand cache misses**. The data
clearly came from DRAM; the counters say "no misses" because a line the
prefetcher brought in before you asked is, by the time you ask, a hit. **Counters
count what the core waited for, not what travelled.**

## The kinds, and what each can detect

| Prefetcher | Detects | Typical scope |
| :--- | :--- | :--- |
| L1 next-line / adjacent-line | the line after the one you touched | immediate neighbour |
| L1 IP-stride | a constant stride from a *particular instruction* | per load instruction |
| L2 streamer | ascending or descending runs | within a 4 KiB region |
| L2 adjacent-line | pairs of lines | immediate neighbour |

## The two hard limits

**They stop at page boundaries.** A prefetcher that crossed a page would need a
translation for an address the program has not referenced — it would have to
speculate in the TLB and might fetch a page the process does not own. So
streaming restarts at every 4 KiB boundary. With huge pages the runway is 512
times longer, which is one of the under-appreciated benefits of huge pages.

**They cannot follow pointers.** A prefetcher predicts *addresses*. In
`node = node->next`, the next address does not exist until the current load
returns. There is no pattern to detect, and this is the fundamental reason
linked structures are slow and array structures are fast — not "cache
friendliness" in the abstract.

## When software prefetch actually helps

`__builtin_prefetch` / `_mm_prefetch` is worth it only when **you** can compute
an address the hardware cannot, far enough ahead to cover the latency.

`cache/05` measures both sides honestly:

- **Dependent chain with jump pointers** — each node stores a pointer to a node
  several steps ahead, so a prefetch has something to issue: **140 → 15–21 ns**
  per load. A real win, because the program supplied information the hardware
  could not infer.
- **Independent loads** — already overlapping nicely: **no gain at all**. The
  latency was already hidden; there was nothing left to hide.

So the answer to "just add prefetches" is a question: *what address will you
prefetch, and how do you know it one memory latency early?* If there is no
answer, the prefetch is noise, and it costs instruction slots and cache
pollution.

---

# PART 7 — MEMORY-LEVEL PARALLELISM, AND LITTLE'S LAW

This is the most valuable idea in the guide, and the one most often missing.

A core does not stop at a cache miss. It tracks outstanding misses in
structures variously called **line-fill buffers** or **MSHRs** (miss status
holding registers) and keeps executing. Independent misses overlap; dependent
ones cannot. The number of simultaneous misses in flight is **memory-level
parallelism**.

Documented capacity on this class of core is roughly **10–16** outstanding L1
misses. `cache/05` measures the consequence directly:

| Access pattern | ns per load |
| :--- | :--- |
| One dependent chain | **145** |
| 16 independent chains interleaved | **12** |

The same loads, the same total traffic, a **12x** difference — produced purely
by letting them overlap. And the ratio is itself informative: 145 / 12 ≈ 12
implies about twelve effective outstanding misses, consistent with the
documented 10–16.

## Little's law, applied to memory

From queueing theory: `concurrency = throughput × latency`. Rearranged for a
memory system:

```
  achievable throughput = outstanding requests / latency
```

Put the lab's numbers in: 12 outstanding × 64-byte lines / 140 ns ≈
**5.5 GB/s** from one core using dependent-ish random access. The same machine
streams about **15 GB/s** on one core (`cache/01`) because prefetching keeps far
more requests in flight than a pointer chase can.

Three conclusions worth memorising:

1. **A single core usually cannot saturate DRAM bandwidth** — it runs out of
   buffers before the memory system runs out of capacity. Bandwidth figures on a
   datasheet are for the whole socket, with every core participating.
2. **"Memory-bound" splits in two.** *Latency-bound* means too few requests in
   flight: fix it by restructuring for independence. *Bandwidth-bound* means the
   channels are full: fix it by moving less data. These need opposite
   interventions, and `perf/02`'s counters distinguish them.
3. **Restructuring for independence beats micro-optimising.** Batching four
   lookups so their loads overlap can beat any amount of work on the loop body,
   because it changes the numerator in Little's law.

> **The interview question this answers.** "A loop shows high IPC and few cache
> misses but is memory-bound. How?" Because the prefetcher turned its misses
> into hits (so the miss counters are quiet) while the core still waits on a
> full set of fill buffers and finite bandwidth. High IPC is not evidence of
> health; it can simply mean the core had other instructions to retire while it
> waited.

---

# PART 8 — WRITES, THE STORE BUFFER, AND LAYOUT

## Stores do not go straight to memory

A store retires into a **store buffer** and drains later. This lets the core
continue past a store whose line is not even present yet. Two consequences:

- **Store-to-load forwarding.** A load whose address matches a pending store is
  served from the buffer, at a cost of roughly a handful of cycles rather than a
  cache access. Forwarding *fails* on partial overlaps — a 4-byte load of half
  of a pending 8-byte store — and the penalty is a longer stall while the store
  drains. `perf/04` shows the shape of this: a `volatile` accumulator, forced to
  round-trip through memory every iteration, runs **8x** slower than the real
  code.
- **A write is usually a read first.** To write one byte, the core must own the
  whole line, so it fetches it: a **read-for-ownership**. Writing a buffer you
  will completely overwrite still reads it in — unless you use non-temporal or
  write-combining stores (`movnt*`), which is the one case where bypassing the
  cache is right. Beware: non-temporal stores also skip the cache for *later*
  readers.

The ordering consequences of the store buffer — why it forces a weak memory
model and what `seq_cst` costs — are the subject of
[guide 25](#guide/25/part-4-the-store-buffer-forces-a-weak-memory-model). Here it is purely a
performance structure.

## AoS versus SoA, with the condition attached

`cache/03` runs both layouts under three access patterns and the result is not a
blanket win:

| Access pattern | Winner | Margin |
| :--- | :--- | :--- |
| Scan one field of every record | **SoA** | 2x — and 4.3x once FP reassociation is allowed |
| Touch all fields of every record | roughly even | both move the same lines |
| Random access to whole records | **AoS** | 2x — one line holds the whole record |

The rule, with its reason: **SoA wins when you scan a subset of fields, because
lines carry only what you read. AoS wins when you touch whole records randomly,
because one line carries the whole record.** A hot path doing both needs a
decision, not a slogan.

The 2x → 4.3x jump in the first row is a separate lesson: the layout change only
exposed the win. Until floating-point reassociation was permitted, the loop was
bound by the latency of a serial FP accumulation chain, not by memory. **A
layout fix pays only when the loop is actually bound by what the layout fixes.**

## Alignment and padding, briefly

- Unaligned access is cheap *until* it crosses a line, which costs two accesses.
- Align hot arrays to 64 bytes: free insurance.
- Pad anything written by two different cores onto separate lines. That is false
  sharing, a coherence effect, measured at 6–12x in `cache/04` and explained in
  guide 25.
- `pahole` prints a struct's real layout and holes; it is how you find 40 bytes
  of padding in a 4-million-element array.

---

# PART 9 — THE INVESTIGATION ORDER

A short decision procedure that uses the whole guide.

1. **Is it memory at all?** `perf stat`: same instructions but more cycles points
   at the microarchitecture; fewer instructions and the same cycles points at
   waiting. Cycles and instructions are ground truth; seconds are a symptom.
2. **Latency-bound or bandwidth-bound?** Few misses but high stall time and a
   dependent pattern → latency: increase independence (Part 7). Counters showing
   the channels saturated → bandwidth: move fewer lines (Parts 3 and 8).
3. **Are the misses real or prefetched?** Demand misses versus prefetched lines
   (`perf/02`). Quiet miss counters do not mean quiet memory.
4. **Is it translation rather than data?** A plateau whose size matches TLB reach
   rather than a cache size (Part 5) → guide 26.
5. **Is it a conflict rather than a capacity problem?** Power-of-two strides and
   dimensions, addresses 4096 apart (Part 4) → pad or offset.
6. **Is another core involved?** Two threads, one line → false sharing → guide 25
   and `perf c2c`.

Only after those does the loop body deserve attention.

---

# PART 10 — Q&A DRILL

### Q: Why has DRAM bandwidth improved so much more than DRAM latency?
Bandwidth is a function of width and transfer rate — add channels, raise the
clock, interleave across banks, and more bytes per second follow. Latency is
dominated by activating a row and letting an analog sense amplifier settle, plus
a fixed command sequence (precharge, activate, read). That part is set by circuit
physics rather than by the bus, so it has stayed roughly flat while everything
around it got faster. Wulf and McKee called the divergence the memory wall.

### Q: What is a row buffer, and why does it make random access worse than the quoted latency?
Reading DRAM requires activating a whole row into the bank's row buffer, then
selecting a column from it. A sequential stream mostly hits an already-open row
and pays only the column read. Random access usually finds a *different* row
open, so it pays precharge plus activate plus read — roughly three sequential
waits instead of one — and the controller's queues fill with such conflicts.

### Q: Both stride 64 and stride 1 move the same number of cache lines. Why is stride 64 eight times slower per access?
Because the cost is per line, and at stride 1 each line serves 64 accesses while
at stride 64 it serves one. Identical traffic, one sixty-fourth of the useful
work per line. Traffic is counted in lines, not in the bytes you asked for.

### Q: Why can L1 not simply be made much bigger?
Because L1 is virtually indexed and physically tagged so lookup can begin before
translation finishes, which requires the index and offset bits to fit inside the
page offset. That caps size at page size × associativity — 4 KiB × 12 = 48 KiB on
the lab machine. Growing L1 means adding ways, not index bits, which is why x86
L1D sat at 32 KiB 8-way for so long.

### Q: A column walk over a 1024 × 1024 double array is pathologically slow. Mechanism and fix?
The row stride is 8192 bytes, an exact multiple of `sets × line size`, so every
access maps to the same set and conflicts evict lines that are still live — a
conflict miss, not a capacity miss. Pad the row to 1024 + 8 elements (or tile the
loop) so consecutive rows land in different sets.

### Q: Two arrays run slower when identically aligned than when deliberately misaligned. What is happening?
4K aliasing. The load/store unit compares only the low 12 bits of addresses to
decide whether a load may depend on an in-flight store, so addresses exactly
4096 apart look identical to it and the load is falsely held. Offset one buffer
by a line or two.

### Q: A stride-1 sweep over 640 MB reports almost no cache misses. Is the data in cache?
No — it came from DRAM, but the prefetcher fetched each line before the demand
access arrived, so the access recorded a hit. Counters measure what the core
waited for, not what moved. Check prefetched-line counters alongside demand
misses before concluding anything.

### Q: Why can a prefetcher not help a linked-list traversal, and what would?
It predicts addresses from a pattern; in a pointer chase the next address does
not exist until the current load returns, so there is nothing to predict. What
helps is supplying information the hardware lacks: jump pointers that let you
prefetch several nodes ahead (measured 140 → 15–21 ns), or replacing the list
with an array layout.

### Q: The same random loads cost 145 ns each in one arrangement and 12 ns in another. What changed?
Dependence. One dependent chain serialises; sixteen independent chains let the
core keep about a dozen misses in flight in its fill buffers, overlapping the
waits. That is memory-level parallelism, and by Little's law throughput is
outstanding requests divided by latency — so the fix for latency-bound code is
more independence, not a faster loop body.

### Q: Why can one core rarely saturate the memory bandwidth in the datasheet?
Because it runs out of miss-tracking buffers long before the channels run out of
capacity. With roughly a dozen outstanding 64-byte misses at ~140 ns, one core
sustains single-digit GB/s on random access; the datasheet figure assumes the
whole socket participating. Saturating bandwidth is a multi-core activity.

### Q: When is structure-of-arrays the wrong choice?
When the access pattern is random over whole records. Then AoS puts the entire
record on one line and SoA needs one line per field — measured at 2x in AoS's
favour. SoA wins the opposite case, scanning a subset of fields over many
records. Also beware concluding a layout change failed when the loop was never
memory-bound: in the lab, SoA's advantage went from 2x to 4.3x only after FP
reassociation removed a serial accumulation chain that had been the real limit.

### Q: Writing a buffer you will fully overwrite still reads it from memory. Why, and what avoids it?
A store needs ownership of the whole line, so the core fetches it first — a
read-for-ownership — even though every byte is about to be replaced.
Non-temporal or write-combining stores avoid the fetch by assembling a full line
and sending it out, which is the legitimate use of cache-bypassing stores.

---

## Sources

- Ulrich Drepper, *What Every Programmer Should Know About Memory* (2007), serialised at [lwn.net/Articles/250967](https://lwn.net/Articles/250967/) — still the most complete single treatment of cache and DRAM behaviour for programmers.
- Wm. A. Wulf and Sally A. McKee, *Hitting the Memory Wall: Implications of the Obvious*, ACM SIGARCH Computer Architecture News, 1995 — the origin of the latency/bandwidth divergence framing.
- Bruce Jacob, Spencer Ng and David Wang, *Memory Systems: Cache, DRAM, Disk* (2007) — the reference for row buffers, bank parallelism and controller scheduling.
- JEDEC DDR4/DDR5 standards for the timing parameter definitions (`CL`, `tRCD`, `tRP`, `tRAS`, refresh intervals); specific values come from a module's own datasheet.
- *Intel 64 and IA-32 Architectures Optimization Reference Manual* — prefetcher descriptions and scope, store-forwarding rules, 4K aliasing, fill-buffer counts.
- Agner Fog, *The microarchitecture of Intel, AMD and VIA CPUs* and *Instruction tables*, [agner.org/optimize](https://www.agner.org/optimize/).
- [uops.info](https://uops.info/) — measured per-instruction latency, throughput and port usage per microarchitecture.
- Igor Ostrovsky, *Gallery of Processor Cache Effects* — compact demonstrations of line size, associativity and false sharing.
- Linux kernel documentation, `Documentation/admin-guide/mm/` for the page-size interactions referenced here and developed in guide 26.
- Lab measurements, all on one pinned machine with turbo disabled: `cache/01` (stride, line and page effects, streaming bandwidth), `cache/02` (the dependent-chain latency staircase and the STLB cliff), `cache/03` (AoS vs SoA under three patterns), `cache/04` (false sharing), `cache/05` (memory-level parallelism and software prefetch), `cache/06` (TLB reach and huge pages), `perf/02` (demand vs prefetched misses), `perf/04` (the `volatile` round-trip).
