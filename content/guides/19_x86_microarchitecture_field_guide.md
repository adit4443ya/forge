<!--
category: Systems & Low Latency
tags: x86-64, Microarchitecture, Pipeline, Branch Prediction, Caches, TLB, Store Buffer, Out-of-Order, Dependency Chains, SIMD, AVX, Atomics, MESI, TSC, Hybrid Cores, perf Counters, Top-down
difficulty: Advanced
readTime: 45 min
-->

# x86 Microarchitecture Field Guide

> [!IMPORTANT]
> **TL;DR — what you must remember:** A modern x86 core is a **6-wide, deeply out-of-order machine** whose speed is set by whichever of four things binds first: the **dependency chain** through your loop (latency), the **execution ports** (throughput), the **branch predictor** (a mispredict flushes ~20 cycles of work), or **memory** (a line from DRAM is ~100+ ns and only overlappable if the loads are independent). Every number in this guide was either measured in the lab on an i7-1260P (Golden Cove P-cores) or is stated as a range with the source you would check. The lab labs that measure each point are named so you can reproduce rather than believe.

The Arm counterpart is [Guide 13](#guide/13); the OS half is [Guide 17](#guide/17).

---

# PART 1 — THE PIPELINE IN ONE PAGE

```
 FRONT END                       BACK END (out of order)                       MEMORY
 fetch → decode (6-wide) → µop cache ─► rename/allocate (ROB ~512 entries) ─► scheduler ─► 12 ports ─► retire
                                                                                    │            ▲
 branch predictor steers fetch;                                                     └─ load/store buffers, store buffer, L1D ◄─ L2 ◄─ L3 ◄─ DRAM
 a mispredict discards everything after the branch
```

- **Front end**: instructions are fetched and decoded into micro-ops (µops); a µop cache serves decoded loops. Its width (~6 µops/cycle on Golden Cove) is the *absolute* ceiling of IPC; most code never gets near it.
- **Rename and the reorder buffer (ROB)**: architectural registers are mapped onto a larger physical file so independent instructions can proceed out of order. The ROB (~512 entries) is how far the core can look ahead; a load miss stalls retirement, and when the ROB fills with instructions waiting behind the miss, the core stops.
- **Ports**: each µop executes on one of ~12 ports with fixed capabilities (integer ALU, multiply, loads, stores, vector). Two loads and two stores per cycle on this core; one 64-bit multiply per cycle.
- **Retire**: in order, so the architectural state looks sequential; mispredicts and faults are resolved here.

The two numbers you use most: the **latency** of an instruction (cycles until its result exists) and its **reciprocal throughput** (cycles between independent issues). `llvm-mca` prints both per instruction and simulates the dispatch (codegen/03): `imul` latency 3, throughput 1; `add` 1/0.25; `addsd` 2 on Golden Cove (4 on older cores); FMA 4; a load ~5 cycles from L1.

---

# PART 2 — DEPENDENCY CHAINS: LATENCY-BOUND VS THROUGHPUT-BOUND

The most important microarchitectural question about any loop: *is each iteration waiting for the previous one?*

| Loop | Bound by | Lab measurement |
|---|---|---|
| `x = x * K + a[i]` (one recurrence) | latency: imul 3 + add 1 = 4 cycles per element | codegen/03: 2.29 ns/elem ≈ 4.8 cycles; llvm-mca predicts 6 (over-charges the fused load) |
| four interleaved recurrences | ports: 4 multiplies per 4 cycles | 0.51 ns/elem ≈ 1.1 cycles: 4.5x |
| `s += a[i]` in double, no reassociation | latency: `addsd` chain, 2 cycles | cache/03: 1.05 ns/elem; with `-ffast-math` 0.48 (bandwidth-bound) |
| `s += a[i]*b[i]` float with FMA | latency: FMA 4 cycles per element | codegen/02: `-march=native` made it 2x *slower* than mul+add (2-cycle add off the critical path) |
| dependent random loads | memory latency: ~140 ns each | cache/05: 145 ns/load; 16 independent chains: 12 ns/load |

Rules: count the longest dependent path through one iteration in cycles; that is your floor. Break it with independent accumulators (the compiler does this for integer sums and, with permission, for FP), with batching (cache/05), or by removing the dependency (a different algorithm). More instructions with shorter chains beat fewer instructions with longer chains: the FMA case is the canonical example.

---

# PART 3 — BRANCH PREDICTION

- **Mechanism**: a branch target buffer predicts *where* a branch goes; history-based predictors (TAGE-like, using the outcomes of the last few hundred branches) predict *whether* it is taken. Correct predictions are free; a mispredict discards the speculatively executed work and refetches: **~24 cycles measured** in perf/02 (`branch-misses` × 24 ≈ the cycle delta between sorted and random input), 15–25 on most current cores.
- **What predicts well**: loop back-edges, error checks that never fire, conditions correlated with recent history, patterns up to a few thousand branches long. **What does not**: data-dependent conditions on random data (the sorted-vs-random array: 13x slower, perf/02), and indirect calls that alternate targets.
- **Branchless code**: `cmov`/`setcc`/blends compute both sides and select. Wins when the branch is unpredictable *and* both sides are cheap (codegen/04: 7.3 → 1.0 ns/elem); loses on predictable branches by adding a data dependency, and the compiler often makes the decision for you based on the *shape* of the source (the "load both then select" form got vectorized into a blend; the naive ternary became a branch). Read the asm.
- **Indirect branches** (virtual calls, `switch` jump tables, function pointers) are predicted per site; a monomorphic site is cheap, a polymorphic one that alternates pays the mispredict. The larger cost of a virtual call is the *inlining it prevents* (codegen/01, codegen/05).
- **Measure**: `perf stat -e branches,branch-misses`; `branch-misses / branches` above ~1% in a hot loop is worth a look; `perf record -e branch-misses` finds the branch.

---

# PART 4 — CACHES, TLB, AND THE MEMORY SYSTEM

Measured on the lab machine (cache/02, dependent loads; sizes from `lscpu`):

| Level | Size (P-core) | Latency measured | Notes |
|---|---|---|---|
| L1D | 48 KiB, 12-way | 2.4 ns (~5 cycles) | 2 loads + 2 stores per cycle; 64-byte lines |
| L2 | 1.25 MiB | 4–12 ns | private per core; the rise inside L2 is the L1 dTLB running out |
| L3 | 18 MiB shared | 24 ns at 2 MiB, rising to 80+ | shared with E-cores; latency depends on slice distance |
| beyond STLB reach (~8 MB, 4 KiB pages) | | +15–100 ns per access | page walks, not a cache level: cache/02 and cache/06 |
| DRAM | | 128–184 ns | plus the walk; ~15 GB/s single-core streaming bandwidth (cache/01) |

Mechanisms to know by name:

- **Lines**: 64 bytes is the unit of everything (cache/01: stride 1 → 64 costs 8x per access; a struct field you skip still costs its line: cache/03).
- **Prefetchers**: L1 next-line and L2 streamer/stride prefetchers detect sequential and constant-stride streams *within a 4 KiB page* and hide DRAM latency entirely for streaming code (perf/02: stride-1 showed ~0 demand misses while moving 640 MB). They stop at page boundaries and cannot follow pointers (cache/05).
- **Memory-level parallelism**: the core tracks ~10–16 outstanding L1 misses (fill buffers); independent loads overlap, dependent ones serialize (cache/05: 145 → 12 ns/load).
- **Store buffer and store-to-load forwarding**: stores retire into a buffer and become visible later; a load from an address with a pending store gets the data forwarded (~5 cycles), which is why a `volatile` accumulator costs ~5 cycles per iteration (perf/04: 8x slower). Forwarding fails on size/alignment mismatches (a 4-byte load of half an 8-byte pending store): a stall of ~15 cycles.
- **4K aliasing**: loads and stores whose addresses differ by a multiple of 4096 look alike to the early disambiguation logic and can falsely conflict; a classic cause of "two arrays with the same alignment are slower than misaligned ones".
- **TLB**: ~96 L1 dTLB entries, 2048 STLB entries; a miss is a page walk of 4 dependent memory reads (page tables cached, usually); huge pages multiply reach by 512 (cache/06: 147 → 130 ns with full THP on 256 MB).
- **Coherence (MESI)**: a line can be Modified in one core's cache; another core's write forces a transfer (~40–100 ns). Two cores writing one line, even different bytes, ping-pong it: cache/04 (6–12x). Reads of a shared line are free once every reader has a copy.

---

# PART 5 — SIMD ON x86

- **Widths**: SSE (128-bit, `xmm`, baseline x86-64), AVX/AVX2 (256-bit, `ymm`, 2013+ desktop), AVX-512 (512-bit, `zmm`, servers; *disabled* on Alder Lake client parts because the E-cores lack it). `-march=x86-64-v3` = AVX2+FMA+BMI; `-march=x86-64-v4` adds AVX-512. `clang -march=native -###` shows what the host enables.
- **What the vectorizer needs** (codegen/02): a countable trip count, no loop-carried dependence, provably or checkably disjoint memory, operations that exist at the target width (gathers need AVX2), permission to reorder FP reductions, and a cost model that says yes. Ask it: `-Rpass=loop-vectorize -Rpass-missed=loop-vectorize -Rpass-analysis=loop-vectorize`.
- **Frequency licences**: heavy 256-bit and 512-bit instructions historically lowered the core's frequency (most visibly on Skylake-SP with AVX-512); recent cores are gentler. Measure: a vectorized loop that is not faster may be paying a licence transition or is memory-bound (codegen/02: `axpy` at 8-wide was not faster than 4-wide: bandwidth).
- **Transitions**: mixing legacy SSE and VEX-encoded AVX code without `vzeroupper` costs a state transition on some cores; compilers insert it. Intrinsics users: keep everything VEX.
- **Alignment**: unaligned loads are cheap when they do not cross a line; loads that split lines cost two accesses; 64-byte alignment for hot arrays is free insurance.
- **Horizontal operations** (reductions across lanes, shuffles) are the expensive part of SIMD; design kernels to do vertical work in the loop and one horizontal reduce at the end (codegen/02's reduction pattern).

---

# PART 6 — ATOMICS, FENCES, AND THE MEMORY MODEL

- x86 is **TSO**: loads are not reordered with loads, stores not with stores, and a load may be satisfied from the local store buffer *before* an older store is globally visible. That single allowed reordering (store then load of a different address) is real and visible: concurrency/05 saw it in 8.8–24.6% of a million trials with plain `mov` stores, and 0% with `xchg`.
- **Instructions and costs** (concurrency/03): plain `mov` for relaxed/acquire/release loads and stores; `xchg` (implicit lock) for a seq_cst store, ~20–40 cycles including a store-buffer drain; `lock xadd`/`lock cmpxchg` for RMWs regardless of ordering (~18 cycles uncontended, cache/04 baseline 8.9 ns); `mfence` or `lock or [rsp]` for a full fence. A `lock`ed instruction on a line held by another core costs the line transfer.
- **Uncontended vs contended** (concurrency/04): an uncontended `std::mutex` is two atomics, ~25 ns, no syscall; under contention the cost is the line moving (50–100 ns) before any futex sleep.
- **`pause`**: in spin loops it reduces the power and the memory-order-machine-clear penalty when the spun-on line changes; it is 10–140 cycles depending on the core generation (that variability is why spin loops with a fixed count of pauses behave differently across CPUs).

---

# PART 7 — TIME, FREQUENCY, HYBRID CORES

- **TSC**: `rdtsc` reads a counter that ticks at a constant rate (2.496 GHz on the lab laptop, perf/04) regardless of the core's actual frequency (`constant_tsc`, `nonstop_tsc`); convert ticks to ns with a calibrated rate, not the nominal one. Serialize for short regions: `lfence; rdtsc` before, `rdtscp; lfence` after (~24 ns for the pair, vs ~12 ns for a bare `rdtsc`, vs ~38 ns for the vDSO `clock_gettime`).
- **Cycles vs time**: `perf stat` `cycles` counts actual core cycles; time depends on the frequency, which the governor, turbo and thermal limits move around (perf/01: the first two reps of every run at half speed under `powersave`; 60.1M cycles in 28.8 ms means the core ran at ~2.09 GHz). Compare cycles for microarchitectural questions and time for what users feel.
- **Hybrid (P + E cores)**: Alder Lake and later mix Golden Cove P-cores (wide, SMT) with Gracemont E-cores (narrower, no SMT, smaller L1/L2). The same loop is ~1.9x slower on an E-core (perf/01); the scheduler moves threads between them; `perf` reports the two PMUs in separate sections (bigcode/04: read the one with the samples). Pin (`tools/pin.sh`) before measuring anything.
- **SMT**: two hardware threads share one core's front end, ports, L1 and L2. A busy sibling slows you; an idle one gives you the whole core; queues between siblings are 10x faster than between cores (concurrency/02: 2.4 ns/item) because they share L1.

---

# PART 8 — COUNTERS: WHICH EVENT ANSWERS WHICH QUESTION

| Question | Events (`perf stat -e …:u`) | Reading |
|---|---|---|
| Is the core busy or waiting? | `cycles`, `instructions` → IPC | < 1 waiting (memory/branches); ~2–4 healthy; near 6 front-end limit |
| Is it the branches? | `branches`, `branch-misses` | misses / branches; × ~24 cycles ≈ cycles lost |
| Is it memory, and which level? | `L1-dcache-load-misses`, `LLC-load-misses`, `dTLB-load-misses` | demand misses only: prefetched lines do not count (perf/02) |
| Is it the front end? | `topdown-fe-bound` via `perf stat --topdown` / `-M TopdownL1` (may need root for the slots event) | the Top-down method: front-end, bad speculation, back-end (memory vs core), retiring |
| Where? | `perf record` on the same event (`-e branch-misses`, `-e cache-misses`) then `perf annotate` | attribution has skid: the reported instruction is a few after the culprit |
| Is it the kernel or waiting? | `context-switches`, `cpu-migrations`, `page-faults` (software events, allowed unprivileged) | perf/05's counters; `strace -c` for syscalls |

Names differ per CPU: `perf list`, and for exact events the vendor's list (`cpu_core/event=0x..,umask=0x../`). On this hybrid machine, use `cpu_core/…/` prefixes or pin to a P-core.

---

# PART 9 — Q&A DRILL

### Q: What bounds a loop that does one multiply-add per element on a value from the previous iteration?
The latency of the chain: imul 3 + add 1 = 4 cycles per element regardless of how wide the core is (codegen/03 measured 4.8). Four independent chains run at the port limit (~1 cycle per element). The fix is structural (accumulators, batching), not "faster instructions".

### Q: Why can enabling FMA make a scalar dot product slower?
The compiler fuses `s += a*b` into one FMA with 4-cycle latency on the accumulation chain; before, only the 2-cycle add was on the chain and the multiply ran in parallel. Fewer instructions, longer chain, 2x slower (codegen/02). `-ffp-contract=off` or restructuring with several accumulators fixes it.

### Q: A loop shows high IPC and few cache misses but is memory-bound. How?
The prefetcher fetched every line before the load needed it; counters count *demand* misses. The tell is that time scales with bytes moved and matches the machine's bandwidth ceiling (~15 GB/s per core here: perf/02, cache/01).

### Q: How much does a branch mispredict cost and how did you get that number?
~24 cycles here: perf/02 ran the same instructions on sorted and random data; the cycle difference divided by the extra branch misses gave the per-miss cost. The usual range is 15–25 on current x86.

### Q: What is the only reordering x86 performs, and how do you prevent it?
A store followed by a load of a different address can appear reordered because the load reads cache before the store leaves the store buffer. `xchg` (seq_cst store) or `mfence` prevents it; concurrency/05 shows 24.6% of trials reordered with plain stores and 0% with `xchg`.

### Q: Two cores increment their own counters and run 6x slower than one core. Why?
False sharing: the counters share a 64-byte line and every increment forces a coherence transfer (cache/04). Pad to separate lines; the same instructions then scale perfectly.

### Q: Why is `rdtsc` not a cycle counter, and when does that matter?
It ticks at a constant nominal rate independent of the core's actual frequency. For elapsed time it is ideal (after calibration); for "how many cycles did this take" use `perf stat -e cycles`, because under `powersave` or turbo the core's frequency differs from the TSC's (perf/01: 2.09 GHz measured vs 2.496 GHz TSC).

### Q: You are handed a Skylake server after developing on an Alder Lake laptop. What changes?
No E-cores and no hybrid PMU split; AVX-512 exists (and may lower frequency under heavy use); `addsd` latency 4 not 2 (reductions get slower); larger L2 on newer parts, different L3 topology (mesh, per-slice latency); mitigations and microcode differ. Re-measure the noise floor (perf/01) and the working-set curve (cache/02) first; do not carry numbers across.

---

## Sources

- Intel 64 and IA-32 Architectures Optimization Reference Manual (microarchitecture chapters: pipeline widths, buffer sizes, prefetchers, store forwarding rules, 4K aliasing).
- uops.info: measured latency/throughput/ports per instruction per microarchitecture (the source of the numbers `llvm-mca`'s scheduling models approximate).
- Agner Fog, *The microarchitecture of Intel, AMD and VIA CPUs* and *Instruction tables* (agner.org/optimize).
- Intel Top-down Microarchitecture Analysis Method (Yasin), implemented in `perf stat --topdown`.
- Lab measurements: perf/01, perf/02, perf/04, perf/05, cache/01–06, codegen/02–04, concurrency/02–05, bigcode/04.
