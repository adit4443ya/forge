<!--
category: Systems & Low Latency
tags: Performance Investigation, Method, Profiling, perf, Counters, Bottleneck, Data Layout, Vectorization, Allocation, Tail Latency, Proof, Benchmarking Discipline, Playbook
difficulty: Advanced
readTime: 40 min
-->

# The Performance-Investigation Playbook

> [!IMPORTANT]
> **TL;DR — what you must remember:** Every investigation is the same five moves: **measure** (a repeatable workload and its noise floor), **locate** (from wall time down to a source line, through whatever libraries and inlining are in the way), **explain** (which of a short list of mechanisms binds, proven by a counter), **decide the lever** (source, layout, algorithm, compiler flags, library dispatch, or the machine), and **prove** (interleaved before/after with counters and correctness, plus the residual). The failure mode is skipping a step: fixing before locating, locating before measuring the noise, or "improving" without proving. This guide is the decision procedure; the lab has a runnable exercise for every branch of it.

---

# PART 1 — DEFINE THE QUESTION

Write one sentence before touching a tool:

> "*Workload W* on *machine M* takes *T* (metric: throughput / p50 / p99.9) and the budget is *B*."

- **Throughput or latency?** They are different disciplines. Throughput: total time of a fixed workload (perf/01 rules). Latency: each event's time, reported as percentiles (perf/05 rules). Optimizing one can hurt the other (batching helps throughput and worsens latency).
- **Which percentile?** p50 tells you the cost of the code; p99.9 tells you the cost of everything around it. If the complaint is "sometimes slow", it is a tail problem and the profile of the average case will mislead you.
- **On what machine?** Numbers do not transfer between a hybrid laptop with `powersave` and a pinned server core. State the machine; measure the noise floor first (perf/01: 2.4x spread unpinned, ~1% pinned and warm).

---

# PART 2 — MEASURE

Checklist (perf/01, perf/04):

1. Pin to one physical core (`tools/pin.sh`); keep the SMT sibling idle; on hybrid CPUs use a P-core and read the P-core PMU section.
2. Warm up, repeat, report **min / p50 / p99**, never a single number or a mean.
3. Inputs opaque to the compiler, results consumed (`BENCH_KEEP`); read the asm of the timed region once (perf/04 shows three different "0 ms" lies).
4. Same binary, same input, same core for A and B; interleave ABAB so drift hits both.
5. `perf stat -e cycles,instructions`: a change that cuts instructions but not cycles did nothing; one that cuts cycles but not instructions changed the microarchitectural behaviour.
6. For latency: one histogram per stage, plus the counters that name tail mechanisms (page faults, involuntary switches, migrations).

If A vs B differs by less than A vs A, you have not measured anything yet.

---

# PART 3 — LOCATE

Climb down one rung at a time, and do not skip rungs:

| Rung | Question | Tool | Lab |
|---|---|---|---|
| 1 | Is the CPU busy, or is the program *waiting*? | `time` (user+sys vs real), `strace -c`, per-stage timestamps | systems/02, systems/05 |
| 2 | Which process / library owns the time? | `perf record` on the *real* binary (beware ccache and wrappers); `perf report --sort comm,dso` | bigcode/04 |
| 3 | Which function? | `perf report --no-children --sort sym`; expect flat profiles in compilers/interpreters; aggregate with `--children` | perf/03, bigcode/04 |
| 4 | Which line, through inlining? | `perf annotate -l`, `--sort srcline`, `--call-graph dwarf --inline` | perf/03 |
| 5 | Which instruction, and is it the culprit or a skid victim? | `perf annotate`, then reason about the dependency chain | perf/03, codegen/03 |
| 6 | No symbols? | debuglink / `.debug` file / debuginfod / build-id cache; `llvm-symbolizer` | perf/03, bigcode/02–03 |

Traps collected from the lab: profiling a ccache hit (bigcode/04), reading the 69-sample E-core section instead of the 11K-sample P-core one (bigcode/04), perf's build-id cache silently supplying symbols for a stripped binary (perf/03), a hot function that does not exist because it was inlined (perf/03), and a compile-time problem that a CPU profile attributes to the compiler's code rather than to the input (bigcode/05: use `-ftime-trace`).

---

# PART 4 — EXPLAIN: THE DECISION TREE

Once you have the hot region and its counters, the mechanism is one of a short list. Walk the tree top-down; each leaf names the lab that demonstrates it and the fix family.

```
CPU idle while "slow"?  ──yes──►  WAITING: wake-ups, blocking I/O, locks that sleep, timers (Nagle 40 ms), page faults
   │                              → systems/03, systems/04, systems/05, concurrency/04, perf/05
  no
   ▼
IPC low (< 1)?
   ├─ branch-misses high ────────►  UNPREDICTABLE BRANCHES → sort/partition data, branchless where both sides are cheap, table-driven (perf/02, codegen/04)
   ├─ L1/LLC/dTLB misses high ──►  MEMORY-LATENCY-BOUND:
   │        dependent loads? ──►  chains: batch/interleave, jump-pointer prefetch, fewer hops, flat structures (cache/02, cache/05)
   │        random over > 8 MB? ►  page walks: huge pages (cache/06)
   │        many threads? ──────►  false/true sharing: pad, partition (cache/04, concurrency/02)
   ├─ long dependency chain ─────►  LATENCY-BOUND ARITHMETIC → more accumulators, break the chain, watch FMA (codegen/03, codegen/02)
   └─ port pressure (mca) ──────►  THROUGHPUT-BOUND → fewer instructions: vectorize, strength-reduce, algorithm (codegen/02, codegen/03)
IPC healthy (2–4) but slow?
   ├─ time scales with bytes ───►  BANDWIDTH-BOUND (prefetcher hides misses) → move fewer bytes: layout, packing, hot/cold split (perf/02, cache/01, cache/03)
   ├─ instruction count high ───►  DOING TOO MUCH → algorithm; missed vectorization (remarks); missed inlining across TUs (codegen/02, codegen/05)
   ├─ malloc/free in the profile ►  ALLOCATION → pools, reserve, SSO, arenas (systems/01)
   └─ syscalls in the profile ──►  KERNEL ON THE HOT PATH → vDSO/rdtsc, busy-poll, async logging (systems/02)
p50 fine, tail bad?
   └────────────────────────────►  TAIL MECHANISMS: page faults, preemption, migration, SMT sibling, C-states, IRQs, allocation (perf/05, Guide 17)
```

Every leaf has a counter that goes to zero (or a histogram hump that disappears) when you are right. If you cannot name the counter, you have a hypothesis, not an explanation.

---

# PART 5 — DECIDE THE LEVER

The same symptom can be fixed at six levels. Choose by leverage and by what you are allowed to change:

| Lever | When it is the right one | Lab evidence | Cost / risk |
|---|---|---|---|
| **Algorithm / data structure** | instruction count or hop count is the problem; O(n log n) vs O(n²); one lookup instead of five | cache/02, cache/05 | biggest wins; needs correctness work |
| **Data layout** | bandwidth-bound or latency-bound on a scan; false sharing | cache/03 (2–4.3x), cache/04 (6–12x) | touches every user of the type |
| **Source-level codegen hints** | a loop the vectorizer refuses for a provable reason; a chain the compiler may not break | codegen/02 (`restrict`, `#pragma clang fp reassociate`: 4x) | UB if the promise is false |
| **Compiler flags** | cross-TU inlining, ISA, PGO layout | codegen/05 (LTO 1.4x), codegen/02 (`-march` can also *hurt*: FMA chain) | whole-build effects; measure per binary |
| **Library / kernel dispatch** | a faster implementation exists for this size and hardware (BLAS kernel, SIMD variant, SVE/SME) | aarch64/04 checklist: correct on all VLs, faster on the target sizes, stable choice | must validate correctness *and* benefit; "has feature" ≠ "faster" |
| **The machine** | tail dominated by the kernel: isolation, governor, huge pages, IRQ affinity | perf/05, cache/06, Guide 17 | needs root; deployment scope |

Two rules: **one change per measurement**, and **the cheapest lever that removes the mechanism** (a `restrict` beats a rewrite; a pool beats a new allocator; a layout change beats a new algorithm when the algorithm is fine).

---

# PART 6 — PROVE

The proof is a table, not an adjective:

```
                 before            after             change        counters (before → after)
p50 / min        ...               ...               ...           cycles, instructions, IPC
p99 / p99.9      ...               ...               ...           branch-misses, LLC-load-misses, dTLB-load-misses, page-faults, ctxsw
correctness      tests / checksum / bitwise diff of outputs
asm diff         tools/asmdiff.sh on the hot function (what changed in the machine code)
residual         what is still slow and its mechanism; why you stopped
```

- ABAB interleaving, three runs each, same core, same input.
- Correctness before speed: outputs compared bitwise or within a stated tolerance; the tests still pass; sanitizers still clean (`-fsanitize=address,undefined`; TSan for threads).
- Report the tail if the question was latency; report bytes/s or elements/s if the question was throughput.
- The "surprise" line from the capstone template: the thing you did not expect. It is where the learning is and where reviewers look for honesty.

---

# PART 7 — THE TRAPS, IN ONE PLACE

| Trap | Symptom | Lab |
|---|---|---|
| Unpinned on a hybrid laptop | 2x run-to-run spread; "optimizations" that are core migrations | perf/01 |
| Dead code / constant folding / closed forms | 0 ns "results" | perf/04 |
| `volatile` accumulator | 8x slower than shipped code; you measured the harness | perf/04 |
| Counting misses as cost | high IPC memory-bound loop looks fine; prefetcher hid the misses | perf/02 |
| ccache / wrapper in front of the tool | a profile of the loader and zstd | bigcode/04 |
| Wrong PMU section on hybrid CPUs | a 69-sample "profile" that contradicts everything | bigcode/04 |
| Inlined hot function | "main is hot" | perf/03 |
| FMA contraction | `-march=native` makes a reduction 2x slower | codegen/02 |
| `-O2` chose a branch, not a cmov | "branchless" source that branches | codegen/04 |
| Prefetch where the core already overlaps | 0% gain plus instruction overhead | cache/05 |
| Assuming THP | a third of the region huge; ENOMEM on collapse | cache/06 |
| memset(0) after malloc → calloc | pre-fault that did not pre-fault | perf/05 |
| strace / ltrace timings | 100x slower syscalls and calls; count with them, never time | systems/01, systems/02 |
| A test vector with a zero-mean factor | a broken kernel that "passes" | aarch64/04 |
| Emulator timings | qemu numbers mean nothing; correctness only | aarch64/02 |

---

# PART 8 — FOUR MINI-SCENARIOS (talk them through out loud)

**1. "The pipeline's p50 is fine but p99 is 100x."** Tail, not throughput. Per-stage histograms (perf/05); `ru_minflt`, `nonvoluntary_ctxt_switches`, migrations, `/proc/interrupts` on the core. Expect page faults or preemption first; then allocation or a syscall in the loop; then the machine (Guide 17). Prove with the histogram's hump disappearing and the counter at zero.

**2. "We vectorized it and it is not faster."** Check the remarks that it really vectorized at the width you think; then compute bytes/s: if it is at the bandwidth ceiling, vectorization was never the lever (layout is: cache/03). If not, look for an FMA or reduction chain (codegen/02, codegen/03) or gathers the cost model priced badly. `llvm-mca` on both loop bodies settles latency vs throughput.

**3. "A library call is 30% of the profile."** First: is it inlining that is missing (a tiny function across a TU or `.so` boundary: codegen/05), an allocation pattern (systems/01), or genuinely expensive work? `--sort dso,sym` then callers (`-G`); count calls (`ltrace -c`) and sizes; decide between call the library less (batching), call a better entry point (dispatch: aarch64/04), or move the work.

**4. "The Arm port is slower than x86."** Do not compare across machines; characterize the Arm box first (perf/01, cache/02 on it). Then: is it a codegen difference (read both asm, aarch64/01), a missing vector path (`-Rpass=loop-vectorize` for `vscale`: aarch64/02), atomics compiled as exclusive loops instead of LSE (aarch64/03), or a memory-ordering fence you were getting for free on x86 (concurrency/03)? Each has a lab with the exact command.

---

# PART 9 — Q&A DRILL

### Q: A senior engineer says "just add prefetches". What do you check first?
Whether the loads are dependent (prefetch can help, with a known-ahead address: cache/05 jump pointers 140 → 15 ns) or independent (the core already overlaps them: 0% gain). Then whether the loop is even latency-bound (IPC, miss counters). Then measure with and without.

### Q: How do you present a 15% improvement so that a reviewer believes it?
The ABAB table with min/p50/p99, three runs each, the counters that explain the mechanism (e.g., branch-misses down 90%), the asm diff of the hot loop, and the correctness evidence. Plus the residual: what is still there and why.

### Q: When is the compiler flag the right lever, and when is it a trap?
Right: cross-TU inlining (LTO), ISA the code can use (`-march` for the production CPU), PGO for branchy code. Trap: `-O3` bloating code, `-march=native` tying you to the build host or lengthening an FP chain via FMA, `-ffast-math` globally changing NaN semantics. Every flag is a measurement, per binary.

### Q: The profile is flat: no symbol above 3%. What now?
Aggregate: by library, by caller subtree (`--children`), by subsystem; use a second instrument that attributes by *work* (`-ftime-trace` for a compiler, request-type histograms for a server). Flat profiles usually mean the workload drives a whole subsystem; the lever is the algorithm or the amount of work, not one loop (bigcode/04, bigcode/05).

### Q: What is the first thing you do on a machine you have never measured on?
Run the noise floor (perf/01) and the working-set curve (cache/02). Ten minutes, and every later number has context.

---

## Sources

This guide is the synthesis of the lab tracks it cites (perf, cache, codegen, concurrency, systems, aarch64, bigcode, capstones); the underlying tool documentation is Linux `perf` (`perf-record(1)`, `perf-report(1)`, `perf-annotate(1)`, `perf-stat(1)`), LLVM's `-Rpass` remarks documentation, `llvm-mca` documentation, and the `strace(1)` / `ltrace(1)` man pages.
