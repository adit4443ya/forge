/* ════════════════════════════════════════════════════════════════════════════
   ESTIMATION — reasoning to a number you were never told.

   Trading and research loops run estimation rounds, and they are not scored on
   the number. They are scored on the structure: decompose into quantities you
   can defend, state each assumption, carry a RANGE rather than a point, and
   then name the assumption you least trust. A candidate who lands the right
   order of magnitude by luck and cannot say which step is shakiest has failed
   the round they think they passed.

   Every anchor below is a commonly-known approximate quantity, used as an
   anchor and rounded hard on purpose. None of these are looked-up figures and
   none should be quoted as facts — the point is the chain, not the constants.
   ════════════════════════════════════════════════════════════════════════════ */

export const EST_KINDS = [
  { id: "market",  label: "Markets & trading", hue: "bad" },
  { id: "systems", label: "Systems & scale",   hue: "ok" },
  { id: "compute", label: "Compute & compilers", hue: "warn" },
  { id: "classic", label: "Classic Fermi",     hue: "info" },
];

export const ESTIMATES = [
  {
    id: "e1", kind: "systems", d: 2,
    q: "How many bytes per second does a single 10 GbE link carry at full rate, and how many 64-byte market-data messages is that?",
    anchors: ["10 Gbit/s is the line rate", "8 bits per byte", "Ethernet framing adds overhead per packet"],
    work: [
      "10 Gbit/s ÷ 8 = 1.25 GB/s of raw line capacity.",
      "A 64-byte payload does not travel alone: Ethernet adds header, CRC, preamble and inter-packet gap — call it ~40 bytes of overhead, so ~104 bytes on the wire per message.",
      "1.25e9 ÷ 104 ≈ 1.2e7 messages per second.",
    ],
    answer: "Order of 10 million small messages per second per 10 GbE link; about 1.25 GB/s raw.",
    range: "8M – 15M messages/s depending on how you count framing",
    trust: "The framing overhead. At 64-byte payloads the overhead is nearly 40% of the wire bytes, so ignoring it overestimates message capacity by more than half. For larger messages the same assumption barely matters — which is the general lesson: check whether the term you approximated dominates.",
    matters: "It tells you whether a feed handler must be able to absorb ten million messages a second or one million, and that is the difference between a design that can allocate per message and one that cannot.",
  },
  {
    id: "e2", kind: "systems", d: 2,
    q: "A server has 32 GB of RAM. Roughly how many order-book price levels can you hold, and does that constrain the design?",
    anchors: ["A level is a price and a quantity plus bookkeeping", "Instruments number in the thousands to tens of thousands"],
    work: [
      "A level held compactly is a price (8 B), a quantity (8 B), maybe an order count and a queue head — call it 32 B packed, or ~64 B once you add a node pointer and allocator overhead in a tree.",
      "Say 10,000 instruments and 100 levels each you actually care about: 1e6 levels.",
      "1e6 × 64 B = 64 MB. Even at 1,000 levels each it is 640 MB.",
    ],
    answer: "Tens to hundreds of megabytes — three orders of magnitude below the machine.",
    range: "50 MB – 1 GB",
    trust: "The number of levels you actually need. The full depth of a book can be enormous, but strategies usually care about the top N; assuming full depth inflates this by an order of magnitude or more.",
    matters: "Memory is not the constraint, so the design should optimise for cache locality and latency, not for footprint. That flips the usual instinct: pick a flat direct-indexed array over a compact tree, and spend the memory to make the hot path one cache line.",
  },
  {
    id: "e3", kind: "market", d: 3,
    q: "A market maker quotes a one-tick spread and captures it on 30% of fills. How many round trips per day does it take to make a meaningful revenue number, and what does that tell you about the system?",
    anchors: ["A tick on a liquid instrument is a small fraction of the price", "Revenue per round trip = captured spread × size"],
    work: [
      "Take a $100 instrument with a $0.01 tick and 100-share lots: one full round trip captures at most $1, and at 30% capture the expectation is ~$0.30.",
      "To reach $100k a day from this alone you need ~3e5 profitable round trips, so on the order of 1e6 fills including the ones that do not capture.",
      "A trading day is ~2.3e4 seconds, so that is tens of fills per second sustained, and far more quote messages than fills.",
    ],
    answer: "Order of a million fills a day; tens per second sustained, with order and cancel traffic perhaps a hundred times that.",
    range: "1e5 – 1e7 fills/day depending on instrument and size",
    trust: "The capture rate. 30% is a stand-in; adverse selection is exactly what moves it, and if the real number is 5% the whole business changes. This is why markouts are measured rather than assumed.",
    matters: "Revenue is the product of a tiny per-trade edge and an enormous count, so anything that reduces the count — a slow cancel, a missed queue position, a gap that stops you quoting — costs money linearly. It is the numeric argument for why the systems work matters.",
  },
  {
    id: "e4", kind: "compute", d: 3,
    q: "Your compiler takes 3 seconds on one 5,000-line file. Is that reasonable, and where would you look first?",
    anchors: ["Ordinary C++ compiles at very roughly thousands of lines per second", "Templates and headers multiply the real line count"],
    work: [
      "At a rough 5,000 lines/second for plain code, 5,000 lines should be about one second, not three.",
      "But the preprocessed translation unit is what the compiler actually sees: a file including heavy standard or internal headers can preprocess to hundreds of thousands of lines. Check with -E | wc -l before anything else.",
      "If preprocessed size is ~500k lines, three seconds is roughly on trend and the file is not anomalous — the includes are.",
    ],
    answer: "Probably normal for header-heavy C++, and the first measurement is the preprocessed line count, not the source line count.",
    range: "1–10 s for a template-heavy translation unit",
    trust: "The lines-per-second anchor. It varies by an order of magnitude between simple C and template-heavy C++, so it can only be used to ask 'is this the right order', never to conclude 'this is a bug'.",
    matters: "It decides where you spend the day: reducing includes, or hunting a pathological template instantiation. -ftime-trace answers it directly and turns the estimate into a measurement, which is always the next step.",
  },
  {
    id: "e5", kind: "systems", d: 3,
    q: "How long does it take to read 1 TB from disk, and how does that change your algorithm?",
    anchors: ["A modern NVMe drive streams on the order of a few GB/s", "A spinning disk streams on the order of 100 MB/s"],
    work: [
      "NVMe at ~3 GB/s: 1e12 ÷ 3e9 ≈ 330 seconds, so roughly five minutes.",
      "A spinning disk at ~100 MB/s: 1e12 ÷ 1e8 = 1e4 seconds, roughly three hours.",
      "Random 4 KB reads are a different question entirely — bounded by IOPS, not bandwidth, and a factor of many worse.",
    ],
    answer: "Minutes on NVMe if you stream it; hours on a spinning disk, and far worse if the access is random.",
    range: "5 min – 3 h, dominated by the medium and the access pattern",
    trust: "That the access is sequential. The gap between sequential and random is the largest single factor here, and it is the assumption most often wrong in practice.",
    matters: "If one pass costs five minutes you design a single-pass streaming algorithm and accept an approximate answer — which is exactly the argument for the sketching structures. An algorithm needing three passes over a terabyte is a fifteen-minute job before you write a line of it.",
  },
  {
    id: "e6", kind: "compute", d: 2,
    q: "How many cache misses per second can one core sustain, and what throughput does that imply?",
    anchors: ["A main-memory access is on the order of 100 ns", "A core can keep roughly 10 misses in flight"],
    work: [
      "Fully serialised (a pointer chase), one miss per ~100 ns is 1e7 misses per second per core.",
      "With memory-level parallelism — independent misses overlapping, say ten outstanding — it is closer to 1e8 per second.",
      "At 64 bytes per line, 1e8 misses/s is ~6 GB/s from one core, which is the right order for a single core's share of memory bandwidth.",
    ],
    answer: "About 1e7 serialised misses per second, up to ~1e8 with parallelism — a factor of ten purely from overlap.",
    range: "1e7 – 1e8 per core",
    trust: "The number of misses in flight. It is the single largest lever, it depends on the access pattern rather than the hardware, and it is what separates a linked list from an array.",
    matters: "It converts a data-structure choice into a number. Ten million nodes traversed by pointer chasing is a full second; the same ten million elements in an array is tens of milliseconds. That is the whole argument for layout, quantified.",
  },
  {
    id: "e7", kind: "classic", d: 2,
    q: "How many piano tuners are there in a large city? Do it properly.",
    anchors: ["City population", "Fraction of households with a piano", "Tunings per piano per year", "Tunings one tuner can do in a year"],
    work: [
      "Population 5e6, ~2.5 people per household → 2e6 households.",
      "Say 1 in 50 has a piano that gets tuned → 4e4 pianos.",
      "Tuned once a year → 4e4 tunings per year.",
      "A tuner does ~3 a day, ~200 working days → ~600 tunings a year.",
      "4e4 ÷ 600 ≈ 60 tuners.",
    ],
    answer: "Order of 50–100.",
    range: "20 – 200",
    trust: "The piano ownership rate. It is the only figure with real cultural variation, and it moves the answer linearly — every other term is bounded within a factor of two.",
    matters: "This is the canonical example because the method is the answer: break into terms each defensible within a factor of two or three, and the errors partially cancel rather than compound. Say the chain out loud and name the weak link; that is the whole grading rubric.",
  },
  {
    id: "e8", kind: "market", d: 3,
    q: "Estimate the daily message volume of a major equity exchange's market-data feed.",
    anchors: ["Thousands of listed symbols", "Most activity in a small fraction of them", "Quote updates vastly outnumber trades"],
    work: [
      "Say ~5,000 symbols, of which a few hundred are genuinely active.",
      "An active symbol might see order-book updates at 1e2–1e3 per second during the session; the long tail contributes far less.",
      "300 active × 300 msg/s ≈ 1e5 msg/s, plus the tail, call it 2e5 msg/s.",
      "Over a ~2.3e4-second session: ~5e9 messages a day, heavily concentrated at the open and close.",
    ],
    answer: "Billions of messages a day, peaking at hundreds of thousands per second.",
    range: "1e9 – 1e10 per day",
    trust: "The per-symbol rate during bursts. The average is a poor guide because the distribution is extremely peaked — the open, the close, and news events dominate, and capacity must be sized for the peak, not the mean.",
    matters: "It sets the engineering budget directly: at 2e5 messages a second you have microseconds per message, so decode must be zero-copy and the book update must not allocate. It is also why capacity planning uses the burst, not the daily average.",
  },
  {
    id: "e9", kind: "systems", d: 3,
    q: "How much does one extra microsecond of latency cost you in a race you win 50% of the time?",
    anchors: ["Race outcomes are decided by the fastest participant", "Latency distributions overlap"],
    work: [
      "If two participants' latencies overlap with a spread of a few microseconds, shifting your distribution by 1 µs moves your win probability by a large fraction of the overlap.",
      "With a spread of ~3 µs and a roughly uniform overlap, 1 µs is about a third of the contested region — so a 50% win rate could fall toward 20% or rise toward 80%.",
      "Value scales with wins, so a third of the races is a third of that revenue line.",
    ],
    answer: "Enormous and highly non-linear: a microsecond can be tens of percent of the win rate when the distributions overlap on that scale.",
    range: "Anywhere from negligible to decisive, entirely set by the overlap width",
    trust: "The width of the overlap. If competitors are 100 µs away, one microsecond is nothing; if they are within 1 µs, it is everything. The answer is meaningless without that width, and saying so is the correct response.",
    matters: "It is the honest version of 'faster is better': the value of latency is convex and bounded by the competitive distribution, so the right question back is always 'how fast is fast enough here', not 'how fast can we go'.",
  },
  {
    id: "e10", kind: "compute", d: 2,
    q: "How long would it take to compile a codebase of 10 million lines, and how many machines would you throw at it?",
    anchors: ["Roughly a second per translation unit for ordinary code, more for template-heavy", "Translation units of a few hundred to a few thousand lines"],
    work: [
      "10e6 lines ÷ ~1,000 lines per translation unit ≈ 1e4 translation units.",
      "At ~2 s each serially: 2e4 seconds, roughly six hours on one core.",
      "Compilation is embarrassingly parallel per translation unit: 100 cores gives ~3–4 minutes, ignoring link time.",
      "Linking does not parallelise the same way and can become the tail — often minutes on its own.",
    ],
    answer: "Hours serially, minutes across a build farm, with the link step becoming the bottleneck once compilation is distributed.",
    range: "2–10 h serial; 2–15 min distributed",
    trust: "Seconds per translation unit, which varies by an order of magnitude with template use. Also the assumption that the link parallelises, which it largely does not.",
    matters: "It explains why large-codebase engineering invests in distributed builds, caching and thin LTO rather than in making any single file faster, and why link time gets its own attention once the compile is farmed out.",
  },
  {
    id: "e11", kind: "classic", d: 3,
    q: "How much does it cost to serve one API request, in cents?",
    anchors: ["A cloud core costs on the order of a few cents per hour", "Requests per second per core"],
    work: [
      "Say ~$0.04 per core-hour, so ~1.1e-5 dollars per core-second.",
      "A request needing 10 ms of CPU is 1e-2 core-seconds → ~1.1e-7 dollars, about 0.00001 cents.",
      "So compute is essentially free per request; a million requests is about 11 cents of CPU.",
      "Bandwidth, storage and the database are usually the real cost, and often dominate compute by an order of magnitude or more.",
    ],
    answer: "Compute is a tiny fraction of a cent — the interesting cost is almost never the CPU.",
    range: "1e-6 – 1e-4 cents of CPU per request",
    trust: "That the request is CPU-bound at 10 ms. A request that waits on a database uses far less CPU but holds other resources, so the model is measuring the wrong thing.",
    matters: "It redirects the optimisation: if compute is 1% of the bill, halving CPU saves 0.5%, while a caching change that removes a database round trip can save far more. Estimating the cost structure before optimising is the point.",
  },
  {
    id: "e12", kind: "market", d: 4,
    q: "A strategy shows a Sharpe of 2 in backtest. How many days of live trading before you can distinguish it from luck?",
    anchors: ["Sharpe is an annualised ratio of mean return to its standard deviation", "The standard error of an estimated Sharpe falls as 1/√years"],
    work: [
      "The standard error of an estimated Sharpe is roughly √((1 + S²/2)/T) with T in years; for S = 2 that is about √(3/T).",
      "To resolve S = 2 from S = 0 at about two standard errors you need 2·√(3/T) < 1, so T > 12 years.",
      "To merely distinguish it from zero at one standard error, T ≈ 3 years.",
    ],
    answer: "Years, not weeks — and considerably longer than most people assume.",
    range: "1–10+ years depending on the confidence you demand",
    trust: "That returns are independent and identically distributed. They are not — autocorrelation and regime changes make the effective sample much smaller than the calendar suggests, so this is an optimistic bound.",
    matters: "It is the quantitative reason backtest results are treated with suspicion and why out-of-sample discipline matters more than in-sample significance: the live evidence needed to confirm an edge takes longer to accumulate than the patience of anyone running it.",
  },
  {
    id: "e13", kind: "systems", d: 3,
    q: "You are asked to log every message on a hot path. What does that cost, and what would you do instead?",
    anchors: ["A formatted log line is on the order of 100 bytes", "Formatting and a syscall are both far more expensive than the hot path itself"],
    work: [
      "At 1e6 messages/s and 100 B a line, that is 1e8 B/s — 100 MB/s of log, ~8 TB over a trading day.",
      "Formatting alone is hundreds of nanoseconds; a write syscall is a microsecond or more. On a path budgeted in hundreds of nanoseconds, either one is fatal.",
      "So logging synchronously multiplies the hot path's cost by an order of magnitude and produces a volume nobody will read.",
    ],
    answer: "Both unaffordable and useless: hundreds of MB/s of data, and a per-message cost that exceeds the work being logged.",
    range: "1–100× the hot path's own cost, depending on the logger",
    trust: "The cost of the logging call. A carefully written binary ring logger can be tens of nanoseconds, which changes the conclusion — so 'logging is slow' is only true of formatted, synchronous logging.",
    matters: "It leads to the real design: write fixed-size binary records into a preallocated ring on the hot path, and let a separate core format and drain them. You keep the observability and pay nanoseconds, which is the standard answer in this domain.",
  },
  {
    id: "e14", kind: "compute", d: 4,
    q: "Estimate the peak floating-point throughput of one modern CPU core, and how close real code gets.",
    anchors: ["A few GHz clock", "Vector width of 256 or 512 bits", "Two fused-multiply-add units, 2 flops per FMA lane"],
    work: [
      "512-bit vectors hold 8 doubles. An FMA is 2 flops, so 16 flops per FMA instruction per lane group.",
      "Two FMA ports × 16 flops = 32 flops per cycle.",
      "At 3 GHz: ~1e11 flops/s, so on the order of 100 GFLOP/s per core for double precision.",
      "Real code with any memory traffic typically reaches a few percent of that; a well-tuned dense matrix multiply reaches a large fraction.",
    ],
    answer: "Order of 100 GFLOP/s peak per core; ordinary code sees single-digit percent of it.",
    range: "50–200 GFLOP/s peak, hugely dependent on width and clock",
    trust: "That the code is actually vectorised and FMA-heavy. If it is not, the peak is off by 8–16× immediately, which is why the peak number is nearly useless without the roofline context.",
    matters: "It is the top line of a roofline model: compare achieved flops per byte against it and you learn whether you are compute-bound or memory-bound — which is the question that decides whether vectorising will help at all.",
  },
];

export const estById = (id) => ESTIMATES.find((e) => e.id === id);
