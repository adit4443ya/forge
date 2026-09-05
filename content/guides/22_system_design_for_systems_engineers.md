<!--
category: Interview Preparation
tags: System Design, Order Book, Feed Handler, Async Logging, Cache, Time Series, Rate Limiter, Timer Wheel, Build Cache, Low Latency, Throughput, Google Design Interview, HFT Design Interview
difficulty: Advanced
readTime: 45 min
-->

# System Design for Systems Engineers

> [!IMPORTANT]
> **TL;DR — what you must remember:** Two different interviews share the name "system design". The **Google-style** round scales a service across machines: APIs, storage, consistency, sharding, failure of any component, capacity estimates. The **HFT-style** round shrinks a system onto one machine, often one core: a latency budget in nanoseconds, data structures chosen by cache behaviour, a threading model with no sharing, determinism and replay. Both reward the same habit: **state the requirements as numbers, sketch the data path, go deep on the hot path, name the failure modes, and say what you would measure.** This guide has seven designs you should be able to draw from memory, each with its numbers, structures, threading, failures and measurements, and a rubric for running either kind of interview.

---

# PART 1 — HOW TO RUN THE 45 MINUTES

1. **Clarify into numbers (5 min).** Messages per second, bytes per message, p50/p99 targets, working-set size, number of clients, durability, ordering guarantees. "10 million messages per second" means 100 ns per message on one core: say that out loud; it decides the design.
2. **Sketch the data path (5 min).** Boxes for ingress, hot path, storage, egress; arrows with rates. For a single-machine design, boxes are threads and cores.
3. **Deep-dive the hot path (20 min).** The data structure and the exact operations on it; the threading model and every point of sharing; the memory footprint and its cache/TLB behaviour; what allocates (nothing, ideally); the worst case.
4. **Failure modes and recovery (5 min).** What happens on loss, overload, restart, a slow consumer, a bad message, a crash mid-update.
5. **Measurement and evolution (5 min).** What you would instrument; how you would prove the latency budget; what changes at 10x.

Vocabulary that signals competence in a systems round: cache line, line utilization, memory-level parallelism, page fault, TLB reach, SPSC queue, acquire/release, false sharing, busy-poll, isolated core, tail latency, sequence number, idempotency, replay. Every one of these has a lab that measures it; cite the number, not the word.

---

# PART 2 — THE SEVEN DESIGNS

## 2.1 Limit order book (HFT-style, single instrument, 10M messages/s)

**Numbers.** 10M msgs/s → 100 ns per message all-in; tens of thousands of live orders; price range bounded (ticks); 99.9% of messages are add/cancel/modify at or near the top of book.

**Structures.**
- Price levels as an **array indexed by (price − base)/tick**, one for bids, one for asks: O(1) to reach any level, contiguous, cache-friendly. For very wide ranges, a two-level scheme (a bitmap of non-empty levels, or chunks) keeps "next non-empty level" O(1).
- Each level: total quantity, order count, an **intrusive doubly-linked FIFO** of orders (time priority) whose nodes come from a **pre-allocated pool**.
- **Order id → order pointer**: open-addressing hash table sized for the day (or a direct array when ids are dense), never rehashed on the hot path.
- Best bid/ask: cached indices; on removal, scan toward worse prices or use `find-first-set` on the non-empty-level bitmap.

**Why not `std::map<price, level>`**: a cache miss per tree hop, allocation per node; `cache/02` says a dependent miss is 130–180 ns, which is your entire budget.

**Hot path.** add: hash insert + level append + level totals (three lines touched); cancel: hash lookup → unlink → totals (two or three lines); modify: reduce in place or cancel+add. All O(1), all allocation-free, all on one thread.

**Threading.** One thread owns the book; the feed handler and the strategies talk to it through SPSC queues (`concurrency/02`); no locks. Book snapshots for slow consumers are copies taken by the owner at a low rate.

**Failures.** Gap in the feed (mark stale, recover, replay: [Guide 18](#guide/18)); malformed message (validate lengths; drop and count); order id collisions (reject; alarm); memory pool exhaustion (size for the worst day; fail loudly at startup, never grow on the hot path).

**Measure.** Per-message latency histogram (`perf/05`), p99.9 by message type; level-array occupancy; pool high-water mark; replay a recorded day and check determinism (same input → identical book).

## 2.2 Market data feed handler (HFT-style)

**Numbers.** Bursts of 1M+ packets/s at the open; 50–1500 bytes per datagram; multiple channels/instruments; two redundant feeds.

**Design.** One receiving thread per core, pinned and isolated ([Guide 17](#guide/17)), busy-polling a socket or a bypass ring (`systems/03`); parse in place; sequence-number arbitration between A and B; gap detection with a bounded reorder buffer; dispatch by instrument to per-instrument books via SPSC queues; a recovery client on a separate thread; timestamps at every stage recorded to a preallocated ring (`systems/05`).

**Structures.** Fixed-size receive buffers; a small seen-sequence window (not a set); per-channel state in its own cache lines; a lookup from symbol id to book index by direct array.

**Failures.** Packet loss (the whole design exists for it); receiver falling behind (drops in `/proc/net/udp`: more cores, batch with `recvmmsg`, bypass); a slow consumer of the SPSC queue (bounded queue: the producer drops or marks, never blocks); a feed switching format (versioned parsers).

**Measure.** Wire/kernel-stamp-to-publish per stage; gap counts and recovery latency; queue depth high-water marks; CPU per core.

## 2.3 Asynchronous logging (both styles)

**Numbers.** 1M log lines/s from the hot path with a budget of ~50 ns per call; durability within a second; ordering per thread.

**Design.** Each hot thread writes a fixed-size record (timestamp, ids, integer arguments; **no formatting**) into its own SPSC ring buffer; one logging thread drains all rings, formats, and writes to disk with large sequential writes (`O_DIRECT` or buffered with `fdatasync` on a timer). Formatting cost moves off the hot path; the hot-path cost is a few stores and a release on the index.

**Structures.** Fixed-size records; ring buffers sized for the burst; a per-ring sequence for ordering; a global timestamp source (TSC, calibrated).

**Failures.** Ring full (drop with a counter, or overwrite oldest, or backpressure: pick per log level, never block the hot path); logger thread crash (records are in shared memory: recoverable); disk slow (the ring absorbs it).

**Measure.** Hot-path cost per log call (`perf/04` rules), drop counter, end-to-end delay from record to disk.

## 2.4 In-memory cache with expiry and concurrency (Google-style single node, then sharded)

**Numbers.** 1M ops/s, 100 GB working set per node, p99 < 1 ms, N reader threads.

**Design (single node).** Sharded by key hash into K independent maps, each with its own lock (or per-shard single-writer thread + SPSC command queue); LRU/LFU per shard with an intrusive list; TTL via a timer wheel (2.6); memory limits by shard. Readers under a shared lock or via RCU-style snapshots for read-mostly workloads.

**Scale-out.** Consistent hashing across nodes; replication for availability; the client library owns routing; invalidation via versioned keys or pub/sub; hot keys detected by per-key counters and replicated.

**Failures.** Node loss (rehash a slice; warm from a peer); hot key (replicas, request coalescing); thundering herd on expiry (jittered TTLs, single-flight refresh); stale reads (state the consistency you offer).

**Measure.** Hit rate by shard, p99 by op, lock hold times, memory fragmentation (`systems/01`'s allocator lessons apply at scale).

## 2.5 Tick time-series store (both styles)

**Numbers.** Billions of (timestamp, symbol, price, size) rows per day; append-only during the day; queries by symbol and time range; some run intraday.

**Design.** Columnar, partitioned by symbol and time bucket; each column an append-only array in memory (SoA: `cache/03`) flushed to files by bucket; timestamps delta-encoded, prices as integer ticks; an index of bucket start times; queries binary-search the time column then scan. Writers append to the current bucket without locks (single writer per symbol); readers see completed buckets plus a snapshot pointer of the current one.

**Failures.** Out-of-order ticks (buffer and sort within a bounded window); late data after flush (append a correction file); process crash (replay the day's feed; buckets are immutable once flushed).

**Measure.** Ingest rate per core; scan throughput (bytes/s vs `cache/01`'s ceiling); query p99.

## 2.6 Timer wheel and rate limiter (both styles)

**Timer wheel.** Millions of timers, 1 µs resolution, O(1) insert/cancel/expire: a circular array of buckets (one per tick), each an intrusive list; a hierarchical wheel for long timeouts; expiry runs from the polling loop's clock. Compare with a heap (O(log n), pointer-chasing) and explain why the wheel wins at scale.

**Rate limiter.** Token bucket per key: capacity, refill rate, last-refill timestamp; a request costs one token; refill lazily on access using the elapsed time; state in a hash table keyed by client. For a distributed limiter: per-node buckets with periodic reconciliation, or a central counter with sloppy quotas; state the accuracy you give up. Measure: decision latency (nanoseconds if single-machine), false rejects under skew.

## 2.7 A distributed build cache for a compiler team (Google-style)

**Numbers.** 7,500 TUs per build (`bigcode/01`), thousands of developers, 30% of compiles unchanged day to day; artifacts 100 KB–100 MB.

**Design.** Content-addressed storage keyed by a hash of (preprocessed input or input file hashes, compiler binary hash, flags, environment); a client wrapper (`ccache`/`sccache` shape: `bigcode/04` shows why the wrapper must be transparent to profiling); a CAS blob store with replication; a metadata service mapping action hash → outputs; LRU eviction by size; remote execution as the next step. Correctness: the key must include everything that affects the output (flags, `-frecord-command-line` helps audits: `bigcode/03`); non-determinism in outputs (timestamps, `__DATE__`) breaks caching and must be removed.

**Failures.** Cache poisoning (immutable, verified blobs); stale toolchain (compiler hash in the key); network outage (fall back to local compile); hot artifacts (CDN-style replication).

**Measure.** Hit rate by target, bytes served, tail latency of a lookup, build time distribution before/after.

---

# PART 3 — THE TWO RUBRICS

| Dimension | Google-style round wants | HFT-style round wants |
|---|---|---|
| Scope | many machines, users, regions | one machine, one core, one queue |
| Numbers | QPS, storage, bandwidth, growth | ns per message, bytes per line, p99.9 |
| Data | schema, storage engine, consistency model | layout, allocation, working set vs cache |
| Concurrency | services, queues, idempotent retries | threads pinned to cores, SPSC, no sharing |
| Failure | any node dies; partitions; retries | packet loss; overload; determinism; replay |
| Proof | capacity math, monitoring, SLOs | histograms, counters, replay equality |
| Evolution | 10x users | 10x messages, a second instrument, a second exchange |

Both interviewers stop you if you skip requirements; both reward a clear hot path; both dislike names of products in place of mechanisms.

---

# PART 4 — Q&A DRILL

### Q: Design a limit order book. What is the first thing you say?
The numbers: message rate → per-message budget; price range → array-indexed levels; order count → pool size. Then the three structures (level array, intrusive per-level lists, id hash) and why `std::map` is disqualified by a single cache miss per hop.

### Q: Your feed handler's consumer falls behind. What happens?
The SPSC queue is bounded; the producer never blocks. Choose: drop with a counter (market data can be re-derived from later snapshots), coalesce (keep only the latest per instrument), or apply backpressure to a non-critical consumer. Alarm on queue depth; measure the high-water mark.

### Q: How do you make a trading system deterministic and why?
Single-threaded ownership of state, inputs recorded with sequence numbers and timestamps, no wall-clock reads in logic (inject time), no unordered iteration. Replay of a recorded day must reproduce every decision bit-for-bit; that is how you debug production and test changes.

### Q: Google asks you to design a URL shortener; you are a systems person. How do you shine?
Do the standard design (API, key generation, storage, caching, redirects) *and* bring the systems depth where it matters: the read path's tail latency (cache locality, connection reuse, no allocation per request), capacity math to the byte, and honest failure analysis. Depth on the hot path is your differentiator; do not skip the breadth.

### Q: Why an intrusive list for orders at a price level?
Cancel by id needs O(1) unlink with no search: the node lives inside the order and knows its neighbours. Non-intrusive containers would need a second lookup and an allocation; `std::list` allocates per node.

### Q: What would you measure in the first week after shipping the order book?
Per-message-type latency histograms with p99.9 and max; level-array occupancy and the depth of the bitmap scan; pool high-water marks; gap counts; and replay equality of the day's log against the live decisions.

---

## Sources

- The lab measurements the numbers come from: `cache/02` (miss cost), `cache/03` (layout), `concurrency/02` (SPSC), `systems/03`, `systems/05` (wait costs), `perf/05` (tails), `bigcode/01` (build sizes).
- Public exchange protocol specifications (sequence numbers, snapshots) for 2.1–2.2; the Linux man pages cited in [Guide 18](#guide/18).
- For the Google-style rubric: Google's published interview guidance describes design rounds as assessing the ability to design scalable systems under ambiguity; the specifics above are standard distributed-systems material (consistent hashing, content-addressed storage, single-flight), not company-specific claims.
