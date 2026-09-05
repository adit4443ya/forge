<!--
category: Systems & Low Latency
tags: Linux, Scheduler, CPU Isolation, isolcpus, nohz_full, IRQ Affinity, SCHED_FIFO, cpufreq, C-states, Huge Pages, mlock, NUMA, Page Faults, vDSO, Busy Polling, Tuning Checklist
difficulty: Advanced
readTime: 45 min
-->

# Linux for Low Latency

> [!IMPORTANT]
> **TL;DR — what you must remember:** On a stock Linux box the *code* is rarely the tail. The tail is the kernel doing something else on your core: a scheduler tick, an interrupt, a wake-up from a deep idle state, a page fault, a frequency change, a lock in a syscall. Low-latency tuning is the discipline of **removing every reason the kernel has to touch your core**, and then **measuring that it stopped**. Everything below is either something you can do as a user (pin, pre-fault, avoid syscalls, spin) or something that needs root (isolate, IRQ affinity, governor, real-time priority), and every item comes with the command that proves it worked.

This guide is the *operating-system* half of the low-latency picture. The measurements it refers to are in the lab: `perf/01` (noise floor), `perf/05` (tail latency and its sources), `systems/02` (syscall cost), `systems/03` (blocking vs busy-poll), `systems/05` (kernel receive timestamps), `cache/06` (huge pages). The networking half is [Guide 18](#guide/18); the CPU half is [Guide 19](#guide/19).

---

# PART 1 — WHERE LATENCY COMES FROM ON A LINUX BOX

A thread that wants to react to an event in under a microsecond has five enemies, and none of them is its own code:

| Enemy | What it does to you | Typical cost | Seen with |
|---|---|---|---|
| **Scheduler** | preempts you for another runnable task, or delays your wake-up | 5 µs to milliseconds | `nonvoluntary_ctxt_switches` in `/proc/PID/status`, `perf sched` |
| **Interrupts** | hardware IRQs and softirqs run on *your* core in the middle of your loop | 1–50 µs each | `/proc/interrupts` deltas per CPU, `perf stat -e irq:*` (root) |
| **Timers** | the periodic tick (HZ = 1000 here: every 1 ms) and hrtimers of other tasks | a few µs, every ms | `nohz_full` removes the tick on isolated cores |
| **Power management** | the core enters a C-state when idle and takes tens of µs to come back; frequency ramps under `powersave` | 10–100+ µs wake-up; 2x slower during ramp | `perf/01` first-rep ramp; `cpupower idle-info` |
| **Memory** | first-touch page faults, TLB misses on 4 KiB pages, NUMA remote access, swap | 1–20 µs per fault; 15–100 ns per walk | `getrusage(ru_minflt)`, `dTLB-load-misses`, `numastat` |

The lab measured all five on a laptop that had none of the fixes applied: `perf/05` saw a p99.9 of 39 µs on a ~1 µs operation, then 7.6 µs after pre-faulting, with the rest attributed to preemption by the involuntary-switch counter. That is the shape of every low-latency investigation: **find the mechanism, find its counter, apply the fix, watch the counter go to zero.**

---

# PART 2 — CPU ISOLATION AND PINNING

## What you can do without root

```bash
taskset -c 2 ./app                 # pin the process to CPU 2 (tools/pin.sh wraps this)
# or, inside the program, per thread:
cpu_set_t s; CPU_ZERO(&s); CPU_SET(2, &s); sched_setaffinity(0, sizeof s, &s);   // tools/bench.h: bench_pin(2)
```

Pinning stops **migration** (the scheduler moving you between cores, each move costing cold caches and a TLB flush) and makes measurements repeatable. It does **not** stop the kernel from running *other* things on that core. On a hybrid CPU pin to a P-core and know which CPUs are SMT siblings (`/sys/devices/system/cpu/cpuN/topology/thread_siblings_list`): a sibling running anything shares your core's execution units and L1 (`perf/01`, `concurrency/02`).

## What needs root: making a core yours

| Mechanism | How | What it removes | Verify |
|---|---|---|---|
| `isolcpus=2,3` (kernel cmdline) | boot parameter | the scheduler's load balancer: nothing is *placed* on the core unless pinned there | `cat /sys/devices/system/cpu/isolated` |
| `nohz_full=2,3` | boot parameter (needs `CONFIG_NO_HZ_FULL`) | the 1 kHz scheduler tick, when exactly one task runs on the core | `cat /sys/devices/system/cpu/nohz_full`; tick count in `/proc/interrupts` (LOC row) stops rising |
| `rcu_nocbs=2,3` | boot parameter | RCU callback processing moves to housekeeping cores | `ps -e \| grep rcuo` shows the offloaded threads |
| IRQ affinity | `echo 1 > /proc/irq/N/smp_affinity` (mask) or `smp_affinity_list`; stop `irqbalance` | device interrupts landing on your core | `/proc/interrupts` column for the core stays flat |
| `irqbalance` off | `systemctl stop irqbalance` | the daemon re-spreading IRQs onto your core | same |
| Kernel threads | `tuna` / cgroup cpusets to move kworkers, ksoftirqd stays per-core | housekeeping work | `ps -eLo psr,comm \| grep " 2 "` |
| Timer migration | `/proc/sys/kernel/timer_migration = 0` (or via `nohz_full`) | timers of *other* tasks firing on your core | fewer hrtimer interrupts |
| Watchdogs | `nmi_watchdog=0`, `nowatchdog` | periodic NMI/soft-lockup checks | `/proc/interrupts` NMI row |

The full recipe in one line of kernel command line, for cores 2–3 of an 8-core box:

```
isolcpus=managed_irq,domain,2-3 nohz_full=2-3 rcu_nocbs=2-3 nowatchdog nmi_watchdog=0 intel_idle.max_cstate=0 processor.max_cstate=0
```

`isolcpus=managed_irq` (5.x+) also keeps *managed* device IRQs (NVMe, modern NICs) off the isolated cores; without it those are placed by the driver regardless of `smp_affinity`. Modern alternative: `cpusets` v2 with `cpuset.cpus.partition=isolated` gives the same at run time without a reboot (kernel 6.x).

## How you know it worked

```bash
# nothing else scheduled on CPU 2 for 10 s:
perf stat -e context-switches,cpu-migrations -C 2 -- sleep 10          # root: counts everything on the CPU
cat /proc/interrupts | awk 'NR==1 || $3+0 > 0'                            # column for CPU2 should not move
watch -n1 'grep -E "^(LOC|RES|CAL|TLB):" /proc/interrupts'               # LOC = local timer tick, RES = rescheduling IPI, TLB = shootdowns
```

If you cannot get root (the lab laptop): pin, keep the SMT sibling idle, and *measure* what is left. `perf/05` STEP 3 is exactly that: 7 involuntary switches per second and a max of ~40–100 µs is the floor without isolation. Know where your responsibility ends.

---

# PART 3 — SCHEDULING

## Policies

- **SCHED_OTHER** (CFS / EEVDF since 6.6): fair share by weight (`nice`). Any other runnable task on the core gets its turn; your latency is bounded by the scheduling period, not by your code.
- **SCHED_FIFO / SCHED_RR**: real-time priorities 1–99. A FIFO thread runs until it blocks or a higher priority thread appears; RR adds a time slice among equals. `chrt -f 80 ./app` (needs `CAP_SYS_NICE` or an `rtprio` rlimit in `/etc/security/limits.conf`).
- **RT throttling**: by default RT tasks may use only 950 ms of every 1 s (`/proc/sys/kernel/sched_rt_runtime_us`); a spinning FIFO thread on a non-isolated core is throttled for 50 ms per second: a guaranteed 50 ms stall. On isolated cores set `sched_rt_runtime_us = -1` or leave the core to one task.
- **The trap with RT spinning**: a SCHED_FIFO thread that never blocks on a core that also hosts kernel work (softirq, RCU) can starve that work and deadlock the machine's I/O. Isolation first, RT second.

## Preemption and the kernel itself

Even with nothing else runnable, the kernel may preempt you for its own work. Which work depends on the kernel's preemption model (`CONFIG_PREEMPT_NONE`, `VOLUNTARY`, `PREEMPT`, `PREEMPT_RT`). PREEMPT_RT (mainline since 6.12) turns most interrupt handlers into threads and most spinlocks into sleeping locks, making worst-case latencies measurable (tens of µs) at some throughput cost. Trading firms mostly run stock kernels with heavy isolation rather than RT kernels, because with a truly isolated core there is nothing to preempt you with.

## Oversubscription

More runnable threads than cores turns every lock into a scheduling problem (`concurrency/04`): a lock holder can be preempted and every waiter spins for a quantum. The rule: hot-path threads ≤ dedicated cores, and never spin without a dedicated core.

## Verify

```bash
cat /proc/$PID/status | grep ctxt_switches     # voluntary = you blocked; nonvoluntary = you were preempted
perf sched record -- ./app && perf sched latency   # root: per-task scheduling delay histogram
cat /proc/sched_debug | grep -A3 "cpu#2"          # runnable tasks on the core
```

---

# PART 4 — POWER, FREQUENCY, IDLE STATES

The lab laptop runs the `powersave` governor with turbo disabled: `perf/01` shows the first two reps of every run 2x slower while the clock ramps. Production low-latency boxes fix the clock:

| Setting | Effect | How (root) | Verify |
|---|---|---|---|
| governor `performance` | no frequency ramp; the core stays at max non-turbo (or turbo) | `cpupower frequency-set -g performance` | `cpupower frequency-info`; `grep MHz /proc/cpuinfo` |
| turbo | higher peak, but frequency depends on how many cores are active and on temperature: **non-deterministic** | `/sys/devices/system/cpu/intel_pstate/no_turbo` | decide: determinism (off) vs speed (on); measure both |
| C-states | idle cores enter C1/C3/C6…; exiting C6 costs ~100 µs on client parts | `intel_idle.max_cstate=0` / `processor.max_cstate=0` (boot), or hold `/dev/cpu_dma_latency` open with value 0 from a process (per-process, reversible) | `cpupower idle-info`; `/sys/devices/system/cpu/cpu2/cpuidle/state*/usage` stops counting |
| SMT | siblings share the core; off for determinism, on for throughput | `/sys/devices/system/cpu/smt/control` = off | `lscpu` threads per core |
| Thermal / RAPL limits | sustained load throttles the clock | data-centre parts and cooling; `turbostat` (root) shows actual MHz and package power | `perf stat` cycles vs time over a long run |

A spinning thread keeps its core out of idle states for free; that is the second reason (after wake-up latency) that busy-polling beats blocking in `systems/03`.

---

# PART 5 — MEMORY

## Page faults

Fresh memory is not mapped until touched; the first write to each 4 KiB page traps into the kernel (1–20 µs, `perf/05` saw two faults per page: zero-page read then copy-on-write). Fixes, all root-free:

```c
mmap(..., MAP_POPULATE, ...)          // kernel pre-faults the whole mapping
mlockall(MCL_CURRENT | MCL_FUTURE);   // lock and (with MCL_FUTURE) pre-fault everything, forever; needs RLIMIT_MEMLOCK or CAP_IPC_LOCK for big sizes
memset(buf, 0xFF, n);                 // touch it yourself (not memset 0 right after malloc: clang turns that into calloc, systems/01 and perf/05)
```

And never allocate on the hot path (`systems/01`): pools sized at startup, pre-faulted.

## Huge pages

4 KiB pages give a 64-entry L1 dTLB ~256 KB of reach and a 2048-entry STLB ~8 MB; random access beyond that pays a page walk per access (`cache/02`, `cache/06`). 2 MiB pages multiply reach by 512.

| Way | Guarantee | How |
|---|---|---|
| THP `always` | none; kernel may also stall your process compacting memory | `/sys/kernel/mm/transparent_hugepage/enabled` |
| THP `madvise` (this box) | best-effort for regions you mark | `madvise(p, n, MADV_HUGEPAGE)`, then `MADV_COLLAPSE` (6.1+) to force; check `AnonHugePages` in `/proc/self/smaps` |
| hugetlbfs / `MAP_HUGETLB` | guaranteed, reserved at boot or via `/proc/sys/vm/nr_hugepages` (root) | `mmap(..., MAP_HUGETLB, ...)` from the reserved pool |

`cache/06` shows what best-effort means: 324 MB of a 1 GiB request became huge on a fragmented laptop, and `MADV_COLLAPSE` returned ENOMEM. Production: reserve with hugetlbfs and fail loudly at startup if the reservation is short. Also set `transparent_hugepage/defrag` so the *kernel* never compacts synchronously inside your process (`defer` or `madvise`).

## NUMA

On multi-socket boxes memory attached to the other socket costs ~1.5–2x latency and crosses an interconnect. Rules: bind the process to one node (`numactl --cpunodebind=0 --membind=0`), allocate *and first-touch* memory from the thread that will use it (first-touch policy places the page on the toucher's node), keep the NIC's PCIe root on the same node as the receiving core (`cat /sys/class/net/eth0/device/numa_node`). Verify with `numastat -p PID` and `perf stat -e node-load-misses` (root).

## Other memory hygiene

- `vm.swappiness=0` and no swap on latency boxes; a swapped page is milliseconds.
- `vm.overcommit_memory` and `vm.zone_reclaim_mode`: know they exist; read the sysctl docs before touching.
- Watch `/proc/self/smaps` `Rss` vs `Locked` after startup to confirm everything you wanted resident is resident.

---

# PART 6 — INTERRUPTS, SOFTIRQS, TIMERS

- A **hardirq** is the device's interrupt handler; it is short and schedules a **softirq** (NET_RX for packets, TIMER, RCU, SCHED) that does the real work, on the same core, in interrupt context or in the per-core `ksoftirqd/N` thread when load is high.
- **NAPI** turns a NIC's interrupts into polling while packets keep arriving; interrupt coalescing (`ethtool -c`) trades latency for fewer interrupts. For the hot path you want *no* NIC interrupts on your core: either the NIC's queue is steered to a housekeeping core (RSS / `smp_affinity`) and you busy-poll the socket (`SO_BUSY_POLL`) or you bypass the kernel entirely ([Guide 18](#guide/18)).
- The **tick** (LOC in `/proc/interrupts`) fires HZ times per second on every non-`nohz_full` core; each is a few µs of scheduler and timekeeping work plus a cache footprint. `nohz_full` stops it when the core runs exactly one task.
- **Rescheduling IPIs** (RES) and **TLB shootdowns** (TLB) are other cores interrupting yours: the first to wake or migrate tasks, the second when a process you share an address space with unmaps memory (`munmap`, `madvise(DONTNEED)`) on another core. A hot-path thread should share an address space only with threads that never unmap.

Observe: `watch -d -n1 cat /proc/interrupts` (any column that moves on your isolated core is a bug), `perf stat -e irq:irq_handler_entry,irq:softirq_entry -C 2` (root), `bpftrace -e 'tracepoint:irq:softirq_entry { @[args->vec] = count(); }'` (root).

---

# PART 7 — I/O AND THE SYSCALL BUDGET

`systems/02` measured the floor: a syscall is ~140 ns *when nothing goes wrong*, and the point of avoiding them is not the 140 ns but the door they open for the scheduler and locks. The hot path's I/O rules:

1. **Time**: `clock_gettime` via the vDSO (~38 ns, no kernel entry) for microseconds; `rdtsc` (~12 ns) for nanoseconds (`perf/04`).
2. **Waiting**: never `epoll_wait`/`recv` blocking on the hot path; busy-poll a non-blocking socket (`systems/03`: 18 → 9 µs round trip, tail 687 → 42 µs) or the NIC ring with kernel bypass.
3. **Logging**: write to a preallocated ring buffer; a separate core drains it to disk (`concurrency/02` is the queue).
4. **Files**: keep them open (`open+close` = 1.7 µs, `systems/02`); use `O_DIRECT`/`io_uring` on the background threads if disk matters, never on the hot thread.
5. **Signals and timers**: no `setitimer`/`timer_create` on the hot thread; a signal delivery is a trip through the kernel plus a frame on your stack.

Count what you actually call: `strace -c -f ./app` for a minute of steady state should show zero syscalls from the hot thread (`strace -p TID`). Remember strace makes them ~100x slower; count with it, time without it.

---

# PART 8 — THE TUNING CHECKLIST

| # | Item | Root? | Command / setting | Proof |
|---|---|---|---|---|
| 1 | Pin hot threads to dedicated P-cores; siblings idle or SMT off | no / yes | `sched_setaffinity`; `smt/control` | `sched_getcpu()` constant; `/proc/PID/status` migrations 0 |
| 2 | Isolate those cores | yes | `isolcpus=managed_irq,domain,… nohz_full=… rcu_nocbs=…` | `/sys/devices/system/cpu/isolated`; LOC/RES flat in `/proc/interrupts` |
| 3 | Route IRQs away; stop irqbalance | yes | `/proc/irq/*/smp_affinity_list`; `systemctl stop irqbalance` | interrupt columns flat |
| 4 | Fix the clock | yes | `performance` governor; decide turbo; `max_cstate=0` or `/dev/cpu_dma_latency` | `cpupower frequency-info`; `perf/01` ramp gone |
| 5 | Real-time priority for the hot thread only if isolated | yes | `chrt -f 80`; `sched_rt_runtime_us=-1` on isolated cores | no RT throttling stalls |
| 6 | Pre-fault and lock memory | no | `MAP_POPULATE`, `mlockall`, touch with non-zero | `ru_minflt` delta 0 during the run |
| 7 | Huge pages for big tables | no (THP) / yes (hugetlbfs) | `MADV_HUGEPAGE` + `MADV_COLLAPSE`; `nr_hugepages` + `MAP_HUGETLB` | `AnonHugePages`; `dTLB-load-misses` |
| 8 | NUMA-local everything | no | `numactl`, first-touch from the owning thread | `numastat -p` |
| 9 | No allocation, no syscalls, no locks that sleep on the hot path | no | pools, vDSO/rdtsc, SPSC queues, spinning | `strace -c` zero; `ltrace -c` zero malloc |
| 10 | No swap, no THP `always`, no compaction stalls | yes | `swapoff -a`; THP `madvise`; `defrag=madvise` | `/proc/vmstat` compact_stall not rising |
| 11 | Measure the residual | no | `perf/05`-style per-iteration histogram over minutes | p99.9 and max with their mechanisms named |

Apply in that order, measuring after each step; most of the improvement is in 1, 4, 6 and 9, which is why a well-written application on a stock kernel already beats a badly written one on a tuned kernel.

---

# PART 9 — Q&A DRILL

### Q: A thread pinned to an otherwise idle core still shows a 200 µs stall once a second. Where do you look?
`/proc/interrupts` for that core (timer tick, IPIs, a device queue landing there), `nonvoluntary_ctxt_switches` (a kworker or RCU callback got scheduled), C-state exit if the thread blocks between events (`cpuidle/state*/usage`), and `sched_rt_runtime_us` throttling if it runs SCHED_FIFO on a non-isolated core. Then `perf sched` or a bpftrace one-liner on `sched_switch` for that CPU to see *what* ran.

### Q: Why do trading systems spin on an isolated core instead of sleeping and waking?
A wake-up is ~5 µs on a warm core and up to hundreds of µs from a deep C-state, with a fat tail (`systems/03`, `systems/05`). Spinning keeps the core awake, the caches warm and the reaction time in the 1–2 µs range with a tight tail. The costs: a core at 100%, power, and the *requirement* that the core is isolated, because a spinning thread that gets preempted is worse than one that sleeps.

### Q: `isolcpus` vs `nohz_full` vs `rcu_nocbs`: what does each remove?
`isolcpus` removes the load balancer (nothing lands on the core unless pinned). `nohz_full` removes the periodic tick when a single task runs. `rcu_nocbs` moves RCU callback execution to housekeeping cores. You want all three plus IRQ affinity; each leaves a different source of interruption.

### Q: You mlockall'd and pre-faulted, yet `ru_minflt` still rises during the run. Why?
Something still allocates: a library, `std::string` growth, a log line, an exception. `ltrace -c -e malloc` and `strace -c -e mmap,brk` name it. Also check that `MCL_FUTURE` was set; without it, later mappings are not locked.

### Q: How do huge pages help, and why can you not rely on THP?
A 2 MiB page covers 512x the memory per TLB entry, moving the random-access cliff from ~8 MB to gigabytes; a page walk costs 15–100 ns per access (`cache/06`). THP is best-effort: on a fragmented machine you get a fraction of your region as huge pages and `MADV_COLLAPSE` fails with ENOMEM. Reserve hugetlbfs pages at boot for guarantees.

### Q: What does the `performance` governor change and what does it not?
It stops frequency ramping (the first-rep slowness in `perf/01`) and keeps the core at its maximum non-turbo frequency. It does not stop C-state entry when the core idles (that is `max_cstate` / `cpu_dma_latency`) and it does not make turbo deterministic (that depends on active cores and temperature).

### Q: A SCHED_FIFO thread that spins makes the whole machine's disk I/O stall. Why?
On a non-isolated core the FIFO thread starves ksoftirqd, RCU callbacks and kworkers pinned to that core; block I/O completions on that core never run. Isolate first, or leave the spinning thread at normal priority on a dedicated core (a dedicated core makes RT priority mostly unnecessary anyway).

### Q: Which of these can you do as an unprivileged user on a shared box?
Affinity within your allowed cpuset, pre-faulting, `mlock` within `RLIMIT_MEMLOCK`, `madvise(MADV_HUGEPAGE)` when THP is `madvise`, `/dev/cpu_dma_latency` only if writable, no syscalls/allocations on the hot path, busy-polling, and all measurement. Everything that changes what the kernel does to *other* processes needs root.

---

## Sources

- Linux kernel documentation: `admin-guide/kernel-parameters.txt` (`isolcpus`, `nohz_full`, `rcu_nocbs`, `intel_idle.max_cstate`), `timers/no_hz.rst`, `admin-guide/mm/transhuge.rst`, `admin-guide/mm/hugetlbpage.rst`, `admin-guide/sysctl/kernel.rst` (`sched_rt_runtime_us`), `admin-guide/cgroup-v2.rst` (cpuset partitions), `core-api/irq/irq-affinity.rst`.
- man pages: `sched(7)`, `sched_setaffinity(2)`, `mlockall(2)`, `madvise(2)` (`MADV_HUGEPAGE`, `MADV_COLLAPSE`), `mmap(2)` (`MAP_POPULATE`, `MAP_HUGETLB`), `numactl(8)`, `chrt(1)`, `cpupower(1)`, `proc(5)` (`/proc/interrupts`, `/proc/PID/status`).
- The lab measurements cited above: `perf/01`, `perf/05`, `systems/01-05`, `cache/06`, `concurrency/04` in the debug_lab repository.
