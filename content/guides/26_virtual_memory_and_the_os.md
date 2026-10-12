<!--
category: The Machine
tags: Virtual Memory, Page Table, Page Walk, TLB, STLB, TLB Reach, Huge Pages, THP, Page Fault, Pre-faulting, mlockall, NUMA, First Touch, Allocator, Syscall, vDSO, Scheduler, Jitter, isolcpus, nohz_full, IRQ Affinity, Tail Latency
difficulty: Advanced
readTime: 45 min
-->

# Virtual Memory and the OS Tax

> [!IMPORTANT]
> **TL;DR — what you must remember:** Every address your program uses is a lie that hardware translates, and the translation has its own cache — the **TLB** — with its own hierarchy, its own misses, and its own cliff. **TLB reach** (entries × page size) is the number that matters: run past it and every access additionally pays a **page walk** of four dependent loads. Huge pages multiply reach by 512 and are **best-effort**, not a guarantee. Above that sits the OS, whose costs are not the syscall itself (~140 ns) but *waiting*: page faults, preemption, interrupts and frequency changes — which is why **p50 and p99.9 are different disciplines** and tail latency is attributed, never averaged.

Guides 24 and 25 dealt with physical reality. This one deals with the layer
between your pointer and that reality, and with the operating system that owns
it. Two ideas carry the whole guide:

1. **Translation is a memory access problem of its own**, with a cache, a miss
   penalty and a working set — and a latency curve that *interleaves* with the
   cache curve, which is why so many memory investigations misdiagnose it.
2. **The OS costs you tail, not mean.** Almost nothing here shows up in an
   average. All of it shows up at p99.9.

> **Where the numbers come from.** One pinned machine, turbo disabled,
> `THP=madvise`, unprivileged `perf_event_paranoid=2`, from the labs named in
> parentheses: `cache/02`, `cache/06`, `perf/01`, `perf/05`, `systems/01`,
> `systems/02`. Constants are that machine's; the mechanisms are general.

---

# PART 1 — THE PAGE WALK

## What translation actually costs

x86-64 with 48-bit virtual addresses uses a **four-level** page table (PML4 →
PDPT → PD → PT). Five-level paging extends this to 57 bits on newer parts.
AArch64 is equivalent in shape with a configurable number of levels.

The critical property: a walk is **four dependent memory loads**. Each level's
entry supplies the physical address of the next level's table. They cannot
overlap — it is a pointer chase, with exactly the characteristics guide 24
described as the worst case for a memory system.

They are at least *cacheable*: page-table entries live in normal memory and sit
in L1/L2/L3 like anything else, so a walk usually hits cache rather than DRAM.
Hardware also keeps dedicated **page-walk caches** for the upper levels, since
the top of the tree is shared by enormous address ranges. A walk is therefore
usually tens of cycles rather than four full DRAM round trips — but it is never
free, and under random access over a large region the upper levels start missing
too.

## The hardware does this for you, which is the problem

Translation is automatic, so it is invisible in a profile. There is no symbol
for it, no line of your code to blame. It appears only as "memory is slower than
it should be" and in the `dtlb_load_misses.walk_*` counters. Knowing to look is
most of the skill.

---

# PART 2 — TLB REACH, AND THE CLIFF IT EXPLAINS

The **TLB** caches completed translations. Like any cache it has levels:

| Level | Entries on the lab machine | Covers at 4 KiB pages |
| :--- | :--- | :--- |
| L1 dTLB | ~96 | ~**384 KiB** |
| STLB (L2, unified) | 2048 | ~**8 MiB** |

**TLB reach = entries × page size.** That is the amount of memory you can touch
randomly before translations start missing, and it is *far* smaller than people
assume.

## Now re-read guide 24's staircase

This is the part worth slowing down for, because it converts two "mysterious"
features of a measured latency curve into arithmetic.

`cache/02` chases a dependent pointer chain through regions of growing size:

| Region size | Measured | The naive reading | What it actually is |
| :--- | :--- | :--- | :--- |
| ≤ 48 KiB | 2.4 ns | L1 hit | L1 hit ✓ |
| ~384 KiB → 1.25 MiB | 4 ns rising to 12 | "L2 gets slower as you fill it" | **the L1 dTLB ran out at 384 KiB** |
| 2 MiB | 24 ns | L3 | L3 ✓ |
| ~8 MiB | jumps by +15–100 ns | "L3 is slower than I thought" | **the STLB ran out at 8 MiB** |
| beyond | 128–184 ns | DRAM | DRAM *plus the walk* |

96 × 4 KiB = 384 KiB. 2048 × 4 KiB = 8 MiB. Both bends land exactly where the
arithmetic says they will, and **neither is a cache level**.

The general lesson: **a latency-versus-size curve contains two staircases
interleaved** — the data cache hierarchy and the translation hierarchy. Reading
a translation step as a cache step sends you to fix data layout when the fix is
page size. Tell them apart by re-running with huge pages: the cache steps stay
put, the TLB steps move.

## The second-order effect

Beyond reach, you are not merely paying a walk. The walk itself is memory
traffic competing for the same caches and the same fill buffers as your data, so
it reduces the memory-level parallelism available to the work you actually care
about. This is why the penalty grows rather than being a flat adder.

---

# PART 3 — HUGE PAGES

The fix for reach is obvious: make each entry cover more. A 2 MiB page is 512
times a 4 KiB page, so 2048 STLB entries reach **4 GiB** instead of 8 MiB.

## Two mechanisms, and they are not the same

**Transparent huge pages (THP)** — the kernel silently backs suitable regions
with huge pages. `/sys/kernel/mm/transparent_hugepage/enabled` is `always`,
`madvise` or `never`. Under `madvise` you opt in per region with
`madvise(ptr, len, MADV_HUGEPAGE)`. `MADV_COLLAPSE` (newer kernels) asks for an
*existing* region to be collapsed synchronously, which is far more predictable
than waiting for `khugepaged`.

**hugetlbfs** — explicitly reserved huge pages, requested at boot or via
`/proc/sys/vm/nr_hugepages`, mapped with `MAP_HUGETLB` or from a mounted
hugetlbfs. These are *guaranteed* and never broken up, at the cost of being
reserved whether used or not.

The distinction matters: THP is best-effort and can be taken away; hugetlbfs is
a reservation. Latency-critical systems that cannot tolerate a surprise use the
second.

## Best-effort means exactly that

`cache/06` measures the honest version:

| Scenario | 4 KiB pages | Huge pages | Note |
| :--- | :--- | :--- | :--- |
| 256 MB region | 147 ns | **130 ns** | THP applied cleanly |
| 1 GiB region | 226 ns | **189 ns** | only about **one third** backed by huge pages |

The second row is the lesson. On a machine that had been up a while, the kernel
could not find enough contiguous physical memory, and `MADV_COLLAPSE` returned
`ENOMEM`. You asked for huge pages and got a third of them. **Always verify**:

```sh
grep -i AnonHugePages /proc/meminfo          # system-wide
grep -i AnonHugePages /proc/self/smaps_rollup # this process
perf stat -e dtlb_load_misses.walk_completed ./prog
```

If `AnonHugePages` has not moved, your `madvise` did nothing, and any
improvement you measured came from somewhere else.

## The costs nobody mentions

- **Fragmentation makes it worse over time.** A freshly booted machine gets huge
  pages; the same machine after a week may not. Benchmarks taken at the wrong
  moment are unreproducible for this reason alone.
- **Compaction causes latency spikes.** The kernel may stall an allocation while
  it compacts memory to form a huge page — precisely the kind of multi-millisecond
  event you were trying to eliminate. For strict tail requirements, reserve
  hugetlbfs at boot and avoid the dynamic path entirely.
- **Memory amplification.** A 2 MiB page for a 4 KiB object wastes the rest.
- **The prefetcher benefit is real but separate.** Guide 24 noted that hardware
  prefetchers stop at page boundaries; a 2 MiB page gives them 512 times the
  runway. Some of the gain attributed to "fewer TLB misses" is actually this.

---

# PART 4 — PAGE FAULTS AND THE TAIL

## Memory you allocated does not exist yet

`malloc` and `mmap` hand back *address space*. Physical pages are attached
lazily, on first touch, by a **minor page fault** (no I/O). A **major fault**
involves the disk and costs milliseconds. On a latency-critical path, even minor
faults are unacceptable: each is a trap into the kernel, a page allocation, a
page-table update and a TLB entry.

This is the single most common cause of a startup-time tail. The program looks
fine after a warm-up and terrible in its first seconds, and nothing in the code
changed.

## The measurement

`perf/05` times every individual iteration rather than averaging:

| | p99.9 |
| :--- | :--- |
| As written | **39 µs** |
| After pre-faulting | **7.6 µs** |

A 5x improvement at the tail, with **no change to the algorithm**. The mean
barely moved — which is exactly why averaging hides this class of problem.

## The toolkit

```c
mlockall(MCL_CURRENT | MCL_FUTURE);     /* no swapping, ever */
mmap(..., MAP_POPULATE, ...);           /* fault it all in now */
madvise(p, n, MADV_HUGEPAGE);           /* ask for huge pages */
/* and the blunt instrument that always works: */
for (size_t i = 0; i < n; i += 4096) ((volatile char *)p)[i] = 0;
```

Then **verify** with `ru_minflt` from `getrusage` before and after the hot
phase. If it is still rising, suspect: the allocator returning memory to the
kernel and re-faulting it (pin with `mallopt(M_TRIM_THRESHOLD, -1)` and
`M_MMAP_THRESHOLD`), thread stacks growing, or THP being collapsed underneath
you.

> **The general principle, worth stating once:** every one of these is a way of
> moving work from the hot path to startup. That is the whole art of tail
> latency — not making operations faster, but making sure nothing *unexpected*
> happens during them.

---

# PART 5 — NUMA

On a multi-socket machine, memory attached to another socket costs more to
reach. Even on single-socket parts, sub-NUMA clustering can expose the same
asymmetry.

**The first-touch rule is the one to know.** Linux allocates a physical page on
the node of the thread that *first writes* it, not the thread that allocated it.
The classic bug follows immediately: one initialisation thread touches the whole
array, placing every page on its own node, and then the worker threads on other
nodes make remote accesses for the program's entire lifetime. The fix is to have
each worker initialise the region it will own — parallel first touch.

```sh
numactl --hardware                     # topology and distances
numactl --cpunodebind=0 --membind=0 ./prog   # pin both
numastat -p $(pidof prog)              # local vs remote hits
```

`--interleave=all` spreads pages round-robin: right for a bandwidth-bound
workload spanning all nodes, wrong for latency. Automatic NUMA balancing
(`/proc/sys/kernel/numa_balancing`) migrates pages based on observed access —
helpful for throughput servers, and usually disabled for latency-critical work
because the migrations themselves are jitter.

---

# PART 6 — THE ALLOCATOR

`malloc` is not one cost. `systems/01` measures the distribution:

| Path | Median |
| :--- | :--- |
| tcache (thread-local, small) | **36 ns** |
| bins | **52 ns** |
| mmap path, typical | **41 ns** |
| forced `mmap` (threshold defeated) | **4.2 µs p50**, with 200k `mmap`+`munmap` calls |
| custom pool | **16 ns** |

The 100x spread between the third and fourth rows is the point: **the same
`malloc(1 MiB)` is 41 ns or 4.2 µs depending on history.** glibc dynamically
raises `M_MMAP_THRESHOLD` as it observes freed `mmap`'d blocks, so an allocation
pattern that defeats that heuristic falls off a cliff — and does so *in
production*, under a workload the benchmark did not reproduce.

```c
mallopt(M_MMAP_THRESHOLD, 128 * 1024);  /* pin it; stop the heuristic moving */
mallopt(M_TRIM_THRESHOLD, -1);          /* never return memory to the kernel */
```

For a hot path, the honest answer is not to tune the general allocator but to
not call it: pre-allocate, use pools or arenas, and make steady-state allocation
count zero. The 16 ns pool row is there to show the ceiling you are leaving on
the table.

---

# PART 7 — THE SYSCALL BOUNDARY

`systems/02` measures the floor:

| Operation | Cost |
| :--- | :--- |
| `clock_gettime` via **vDSO** | **38 ns** |
| `getpid` (a real syscall, minimal work) | **142 ns** |
| `open` + `close` | **1.7 µs** |
| `getpid` **under `strace`** | **23.6 µs** |

Four things to take from it:

- **The syscall floor is ~140 ns**, and that is for a call that does nothing.
  Anything touching the VFS or the network stack is microseconds.
- **The vDSO is why time is cheap.** The kernel maps a page of code and data
  into every process so `clock_gettime` reads a shared clock without a mode
  switch — 38 ns instead of 142+. If your timing calls ever cost more than that,
  something has forced them into the real syscall path.
- **Mitigations changed these numbers.** Page-table isolation and the various
  speculative-execution mitigations raised syscall entry cost substantially over
  what older material quotes. `/sys/devices/system/cpu/vulnerabilities/` shows
  what your machine is doing.
- **`strace` multiplies syscall cost by roughly 100.** Use it to *count*
  syscalls, never to time them. The same caution applies to `ltrace`.

> **The real lesson of this section** is not the numbers but the ratio: the
> kernel is fast, and *waiting* for it is not. A syscall is ~140 ns; the UDP
> stack is microseconds; a wake-up is ~5 µs with a tail into milliseconds
> (`systems/03`, `systems/05`). Design around the waiting, not the entry cost.

---

# PART 8 — SCHEDULING, INTERRUPTS, AND FREQUENCY

## Preemption is a tail event

A normal `SCHED_OTHER` thread can be preempted at any time. The Linux default
scheduler (CFS historically; **EEVDF** from 6.6 onward) is built for fairness
and throughput, and will happily take your core away for a few hundred
microseconds.

| Lever | What it removes | Needs root |
| :--- | :--- | :--- |
| `taskset` / `sched_setaffinity` | migration between cores | no |
| `chrt -f` (`SCHED_FIFO`) | preemption by normal threads | yes |
| `isolcpus=` | the scheduler placing *other* work on the core | boot param |
| `nohz_full=` | the periodic timer tick on that core | boot param |
| `rcu_nocbs=` | RCU callback processing on that core | boot param |
| IRQ affinity (`/proc/irq/*/smp_affinity`) | device interrupts | yes |
| cgroup v2 `cpuset` partitions | the modern, runtime equivalent of `isolcpus` | yes |

The three boot parameters are commonly confused, and the distinction is a fair
interview question: **`isolcpus` stops the scheduler putting work there,
`nohz_full` stops the timer tick, `rcu_nocbs` moves RCU callbacks elsewhere.**
They are independent and usually wanted together.

## The SCHED_FIFO trap

A `SCHED_FIFO` thread that spins will not yield to anything of lower priority —
including kernel threads doing writeback and other housekeeping. The whole
machine can appear to hang. Linux guards against this with RT throttling
(`/proc/sys/kernel/sched_rt_runtime_us`, by default 950 ms of every second), so
a runaway RT thread is forcibly descheduled — which is itself a 50 ms latency
event. Know both the trap and the guard.

## Frequency, idle states, and hybrid cores

`perf/01` measures how much the machine varies before you change anything:

- **Unpinned, the same work spread 2.4x.** Pinned, about 1%.
- **An efficiency core ran the same work 1.87x slower** than a performance core.
  On a hybrid part, *which* core you land on is a first-order effect, and the
  scheduler will migrate you.

Add frequency ramp and C-state exit latency and you have the explanation for
most "my benchmark is noisy" complaints. The discipline: pin, set the governor,
warm up, and report a distribution rather than a mean.

```sh
cpupower frequency-info                 # governor and limits
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
perf stat -e cycles,task-clock ./prog   # cycles vs wall time separates frequency from work
```

The `performance` governor stops the frequency *dropping*; it does not disable
turbo and does not stop thermal throttling. Measuring in cycles as well as
seconds is how you tell a frequency change from a real regression.

---

# PART 9 — ATTRIBUTING A TAIL

The practical output of this guide: a symptom-to-cause table for when p50 is
fine and p99.9 is not.

| Symptom | Likely cause | Confirm with |
| :--- | :--- | :--- |
| Tail only in the first seconds | minor page faults on first touch | `getrusage` `ru_minflt`; fix with pre-fault + `mlockall` |
| Periodic spike, roughly once a second | timer tick, or RT throttling | `nohz_full`; `sched_rt_runtime_us` |
| Spikes correlated with other activity | preemption or migration | `perf sched`, `sched:sched_switch` tracepoints |
| Occasional multi-millisecond stall | major fault, compaction, or THP collapse | `/proc/vmstat` `compact_*`, `pgmajfault` |
| Wide spread, no obvious pattern | frequency/C-states, or hybrid core migration | cycles vs wall time; pin and re-measure |
| Slow only on some data sizes | TLB reach exceeded | `dtlb_load_misses.walk_completed`; retry with huge pages |
| Steady-state latency worse after hours | memory fragmentation; THP no longer granted | `AnonHugePages` in `smaps_rollup` |
| One thread slow, others fine | remote NUMA memory from first-touch | `numastat`, `numactl --membind` |

The discipline behind the table: **a tail is attributed, never averaged.**
Record per-operation timings, build a histogram, then explain each mode — the
label on a mode is the mechanism, and each mechanism in this guide has a counter
that proves it.

---

# PART 10 — Q&A DRILL

### Q: What does a TLB miss actually cost?
A page walk: four dependent memory loads on 48-bit x86-64 (five with 5-level
paging), each supplying the address of the next table. They cannot overlap. The
entries are cacheable and there are dedicated page-walk caches for the upper
levels, so it is usually tens of cycles rather than four DRAM trips — but it
also consumes cache capacity and fill buffers, so it steals memory-level
parallelism from your real work.

### Q: Your latency-versus-size curve has a step at 8 MB but L3 is 18 MB. Explain.
That step is not a cache level. It is the second-level TLB running out: 2048
entries × 4 KiB per page = 8 MiB of reach, after which every access also pays a
page walk. Re-run with huge pages — cache steps stay where they are and
translation steps move, which is how you tell the two staircases apart.

### Q: Someone reports L2 "getting slower" as the working set grows inside L2. What is really happening?
The L1 dTLB is running out. Roughly 96 entries at 4 KiB covers about 384 KiB,
which is well inside a 1.25 MiB L2, so beyond that point every access adds a
translation miss on top of a genuine L2 hit. The fix is page size, not data
layout.

### Q: How do huge pages help, and why can you not rely on them?
They multiply TLB reach by 512 at 2 MiB, and they give hardware prefetchers 512x
the runway before a page boundary stops them. You cannot rely on THP because it
needs contiguous physical memory: on a fragmented machine you get a fraction —
in the lab, one third of a 1 GiB region, with `MADV_COLLAPSE` returning `ENOMEM`
— and compaction can itself stall you. For guarantees, reserve hugetlbfs at boot.

### Q: You called madvise(MADV_HUGEPAGE) and latency improved 10%. How do you know huge pages caused it?
Check `AnonHugePages` in `/proc/self/smaps_rollup` before and after, and
`dtlb_load_misses.walk_completed` with `perf stat`. If neither moved, the
`madvise` did nothing and the improvement came from somewhere else — very
commonly the allocation itself being differently aligned.

### Q: You mlockall'd and pre-faulted, yet minor faults still rise during the run. Why?
Candidates: the allocator trimming memory back to the kernel and re-faulting it
(pin with `M_TRIM_THRESHOLD` and `M_MMAP_THRESHOLD`), new thread stacks growing
on demand, regions mapped after your pre-fault pass, or THP collapsing a region
underneath you. `MCL_FUTURE` covers future mappings but not the allocator
handing memory back in between.

### Q: What is the first-touch rule and the bug it causes?
A physical page is allocated on the NUMA node of the thread that first *writes*
it, not the one that allocated it. So a single-threaded initialisation loop
places the entire array on one node, and every worker on another node then makes
remote accesses forever. Fix by having each thread initialise the portion it
will later own.

### Q: The same malloc(1 MiB) is 41 ns in one run and 4.2 µs in another. Explain.
glibc adapts `M_MMAP_THRESHOLD` dynamically as it observes freed `mmap`'d
blocks. An allocation pattern that defeats that heuristic sends every call down
the `mmap`/`munmap` path — in the lab, 200k syscall pairs and a 4.2 µs median.
Pin the threshold with `mallopt`, or stop allocating on the hot path.

### Q: Why is clock_gettime 38 ns when getpid is 142 ns?
`clock_gettime` is served by the vDSO: the kernel maps a page of code and shared
clock data into every process, so the call never crosses into kernel mode.
`getpid` is a real syscall and pays the entry and exit cost, which modern
speculative-execution mitigations have made meaningfully more expensive than it
once was.

### Q: isolcpus, nohz_full and rcu_nocbs — what does each remove?
`isolcpus` keeps the scheduler from placing other work on the core. `nohz_full`
stops the periodic timer tick there when one task is runnable. `rcu_nocbs` moves
RCU callback processing off it. Three independent sources of interference,
usually wanted together, and none of them a substitute for the others.

### Q: A SCHED_FIFO thread that spins makes the whole machine's I/O stall. Why, and what saves you?
It never yields to lower-priority work, including kernel housekeeping threads.
Linux's RT throttling saves the machine by forcibly descheduling RT tasks that
exceed `sched_rt_runtime_us` (950 ms per second by default) — but that rescue is
itself a 50 ms stall, so it is a safety net, not a design.

### Q: Your benchmark varies 2.4x run to run. Before optimising anything, what do you do?
Measure the machine, not the code. Pin to a specific performance core — on a
hybrid part an efficiency core was 1.87x slower in the lab, and the scheduler
migrates freely. Then set the governor, warm up, and report a distribution.
Pinning alone took the lab machine from 2.4x spread to about 1%. If A versus B
differs by less than A versus A, you have measured nothing.

### Q: p50 is fine and p99.9 is 100x. Walk me through it.
Do not average — record per-operation timings and build a histogram, then
attribute each mode. Early-only tail means first-touch page faults: pre-fault and
`mlockall`. Roughly periodic means the timer tick or RT throttling. Correlated
with other activity means preemption or migration: pin and isolate.
Multi-millisecond outliers mean major faults, compaction or THP collapse. Wide
and formless means frequency or C-states: compare cycles against wall time. Each
mode has a counter, and the counter is the proof.

---

## Sources

- Linux kernel documentation: `admin-guide/kernel-parameters.txt` (`isolcpus`, `nohz_full`, `rcu_nocbs`, `intel_idle.max_cstate`), `admin-guide/mm/transhuge.rst`, `admin-guide/mm/hugetlbpage.rst`, `admin-guide/mm/numa_memory_policy.rst`, `admin-guide/sysctl/kernel.rst` (`sched_rt_runtime_us`), `admin-guide/cgroup-v2.rst` (cpuset partitions), `core-api/irq/irq-affinity.rst`, `timers/no_hz.rst`.
- man pages: `sched(7)`, `sched_setaffinity(2)`, `mlockall(2)`, `madvise(2)` (`MADV_HUGEPAGE`, `MADV_COLLAPSE`), `mmap(2)` (`MAP_POPULATE`, `MAP_HUGETLB`), `mallopt(3)`, `getrusage(2)`, `numactl(8)`, `numastat(8)`, `chrt(1)`, `cpupower(1)`, `vdso(7)`, `proc(5)`.
- *Intel 64 and IA-32 Architectures Software Developer's Manual*, volume 3A, chapter 4 (paging, page-walk caches) and the Optimization Reference Manual for TLB structure and the relevant performance counters; *Arm Architecture Reference Manual* for the AArch64 translation regime.
- Ulrich Drepper, *What Every Programmer Should Know About Memory* (2007), [lwn.net/Articles/250967](https://lwn.net/Articles/250967/) — part 4 covers TLBs and virtual memory.
- Brendan Gregg, *Systems Performance* — the USE method and the tracing workflow behind the attribution table in Part 9.
- LWN coverage of transparent huge pages, `MADV_COLLAPSE`, and the EEVDF scheduler for the behaviour changes referenced here.
- Lab measurements: `cache/02` (the latency staircase with both TLB bends), `cache/06` (TLB reach, THP, the one-third result and `ENOMEM` on collapse), `perf/01` (pinning, hybrid cores, frequency), `perf/05` (per-iteration tails, pre-faulting 39 → 7.6 µs p99.9), `systems/01` (allocator distribution), `systems/02` (syscall floor, vDSO, `strace` overhead).
