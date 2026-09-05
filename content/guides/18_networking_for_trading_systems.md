<!--
category: Systems & Low Latency
tags: Networking, UDP Multicast, TCP, Kernel Bypass, DPDK, Solarflare, Onload, Busy Polling, Nagle, TCP_NODELAY, Timestamps, PTP, Market Data, Order Entry, Sequence Numbers, Feed Handler
difficulty: Advanced
readTime: 45 min
-->

# Networking for Trading Systems

> [!IMPORTANT]
> **TL;DR — what you must remember:** Market data comes in over **UDP multicast** (one packet reaches everyone; loss is handled with sequence numbers, a recovery channel and snapshots; A/B redundant feeds, take the first arrival). Orders go out over **TCP** (a session protocol, `TCP_NODELAY`, one write per message). Between the wire and your code sits the **kernel network stack**, ~4–15 µs per packet with a fat tail; the hot path avoids it by **busy-polling** and, at the top tier, by **kernel bypass** (the NIC's rings mapped into user space) or **FPGAs**. You prove any of this with **timestamps at every stage**, hardware ones when you can get them.

This is the network half of [Guide 17](#guide/17). The lab measurements it leans on: `systems/03` (blocking vs epoll vs busy-poll), `systems/04` (Nagle + delayed ACK), `systems/05` (kernel receive timestamps), `systems/02` (syscall cost).

---

# PART 1 — THE SHAPE OF A TRADING SYSTEM'S NETWORK

```
 exchange ──UDP multicast (A feed)──►  NIC ──► feed handler ──► book ──► strategy ──► order gateway ──TCP──► exchange
 exchange ──UDP multicast (B feed)──►  NIC ─┘         ▲                                     │
                                   recovery/snapshot (TCP or UDP unicast) ◄─────────────────┘ on gap
```

Three flows with three different requirements:

| Flow | Transport | Why | What matters |
|---|---|---|---|
| Market data | UDP multicast, often two redundant feeds (A/B) on different ports or paths | fan-out to thousands of subscribers with no per-client state and no retransmission stalls; the exchange never waits for anyone | first-arrival latency, gap detection, zero copies, no wake-ups |
| Recovery | TCP (retransmit request) or UDP snapshot channel | fill gaps, resync after a restart | correctness; rare; off the hot path |
| Order entry | TCP, one session per connection, exchange protocol (FIX for slow, binary "OUCH-like" protocols for fast) | reliability and ordering; the exchange requires a session | `TCP_NODELAY`, one write per message, pre-built messages, warm connection, tail latency of the send path |

Everything else (risk reports, logging, monitoring, drop copies) is ordinary networking on ordinary threads.

---

# PART 2 — UDP MULTICAST MARKET DATA

## Why multicast

One datagram from the exchange is replicated by the switches to every subscriber. The exchange keeps no per-client state and never retransmits on the main channel, so a slow subscriber cannot slow anyone else. Loss is the subscriber's problem to detect and repair.

## Joining and receiving

```c
int fd = socket(AF_INET, SOCK_DGRAM, 0);
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);          // several processes may join the same group
bind(fd, (struct sockaddr *)&any_on_port, sizeof ...);              // bind the port (and the group address on Linux, to filter)
struct ip_mreqn m = { .imr_multiaddr = group, .imr_ifindex = ifindex };
setsockopt(fd, IPPROTO_IP, IP_ADD_MEMBERSHIP, &m, sizeof m);         // IGMP join, per interface
setsockopt(fd, SOL_SOCKET, SO_RCVBUF, &big, sizeof big);             // capped by net.core.rmem_max
```

Then receive with `recvmmsg` (many datagrams per syscall) or busy-poll with `MSG_DONTWAIT` (`systems/03`). Drops show up in `/proc/net/udp` (`drops` column), `netstat -su` (`packet receive errors`), and `ethtool -S` (`rx_missed`, `rx_no_buffer`): if the receive buffer or the NIC ring fills, the kernel drops silently.

## Sequence numbers and gaps

Every feed message carries a sequence number. The handler keeps `expected`:

- `seq == expected`: process, `expected++`.
- `seq > expected`: a **gap**. Buffer the message, request `[expected, seq)` from the recovery channel (or wait a bounded time for the B feed to fill it), then replay in order. While gapped, the book is stale: strategies must know.
- `seq < expected`: a duplicate (the other feed, a retransmit): drop.

**Arbitration between A and B**: process whichever copy of a sequence number arrives first, drop the other. This halves the effective loss rate and often improves latency because the two paths differ. Implementation: a small window of seen sequence numbers, not a set.

**Snapshots**: on start or after an unrecoverable gap, request a full book image (a separate channel), apply it, then replay the buffered live messages with `seq > snapshot_seq`.

## Feed message parsing

Exchange formats (ITCH-style binary, SBE, proprietary) are fixed-layout little- or big-endian structs. Parse in place: cast the buffer to a packed struct, read the fields you need, never copy the datagram, never allocate. Convert endianness with `__builtin_bswap*`. Validate lengths against the datagram size, not the header (a malformed packet must not read past the buffer).

---

# PART 3 — WHAT THE KERNEL NETWORK STACK COSTS

The path of one received datagram on a stock Linux box:

```
NIC DMA → ring buffer → interrupt (or NAPI poll) → softirq: driver → netif_receive_skb → IP → UDP → socket queue → wake receiver → recvfrom: copy to user
```

Measured on the lab laptop over loopback (an upper bound on the stack, a lower bound on a real NIC): one-way ~2–5 µs of processing (`systems/05` send→stamp), plus **the wait**: 17 µs p50 and 1.2 ms p99 for a blocking receiver at 20k packets/s, versus 2.8 µs p50 and 7 µs p99 for a spinning one. The round trip in `systems/03` went from 18.5 µs to 8.7 µs by spinning on both ends, and the maximum from 687 µs to 42 µs.

Where the microseconds go, and the knob for each:

| Stage | Cost | Knob |
|---|---|---|
| interrupt + wake-up | 5 µs typical, 100s of µs from deep idle | busy-poll (`SO_BUSY_POLL`, `MSG_DONTWAIT` loop), or bypass |
| softirq protocol processing | 1–3 µs | RSS/RFS steering to a core near the consumer; `net.core.busy_read` |
| copy to user | 0.1–1 µs per KB | `recvmmsg` batches; bypass gives zero-copy |
| socket lock, `sk_buff` alloc/free | ~1 µs | fewer sockets per core; bypass |
| interrupt coalescing (`ethtool -c`) | adds up to the coalesce timeout | disable for latency (`rx-usecs 0`), keep for throughput |

Sysctls that matter for UDP feeds: `net.core.rmem_max`, `net.core.netdev_max_backlog`, `net.core.busy_poll` / `busy_read` (kernel spins on the NIC for N µs before sleeping: a middle ground without root-owned polling threads), and `net.ipv4.udp_mem`.

---

# PART 4 — KERNEL BYPASS AND HARDWARE

When the stack's 4–15 µs and its tail are unacceptable, the packet must reach user space without the kernel in the data path:

| Approach | How | Latency (order of magnitude) | Cost |
|---|---|---|---|
| **Kernel bypass user-space stacks**: Solarflare/AMD Onload, ef_vi, Mellanox/NVIDIA VMA, Exablaze | the NIC's receive/transmit rings are mapped into the process; a library reimplements UDP/TCP in user space; the socket API is intercepted (Onload) or replaced (ef_vi) | ~1–2 µs wire-to-application, tight tail | vendor NIC; one core polling per stack; the application owns retransmission and flow control for TCP |
| **DPDK / XDP / AF_XDP** | generic poll-mode drivers (DPDK) or an eBPF hook at the driver (XDP) with a user-space socket type (AF_XDP) | similar to bypass for UDP; TCP needs a user-space stack | more engineering; DPDK takes the whole NIC |
| **FPGA** | feed decoding, book building, even order triggering in hardware; the host sees a decoded stream or just a "done" | sub-µs, deterministic | hardware team; inflexible; the software side still measures and validates it |
| **Co-location and switching** | your servers in the exchange's data centre; cut-through switches; layer-1 replication | the physics: 5 ns per metre of fibre | money |

What does not change with bypass: you still busy-poll (now the ring instead of the socket), still need isolated cores ([Guide 17](#guide/17)), still parse in place, still arbitrate A/B and detect gaps. Bypass removes the kernel's 5–15 µs and its scheduler-induced tail; it does not remove your own code's cost.

---

# PART 5 — TCP FOR ORDER ENTRY

Orders are few and must not be lost, so they go over TCP sessions with a protocol the exchange defines. The latency-relevant details are all about **what the kernel does between `write()` and the wire**:

1. **Nagle + delayed ACK** (`systems/04`): two small writes then a read costs 40 ms on a stock socket. `TCP_NODELAY`, always, and one `write`/`send` per message (or `writev`).
2. **Pre-build the message**: the hot path fills a few fields in a prepared buffer and calls `send` once. No formatting, no allocation.
3. **Keep the connection warm**: a heartbeat every few seconds keeps the congestion window and the NIC/switch state from going cold; the first packet after idle pays extra (slow start restart: `net.ipv4.tcp_slow_start_after_idle = 0`).
4. **Where the send path spends time**: `send` copies into the socket buffer (~1 µs), TCP builds the segment, the driver posts it to the NIC ring, the NIC DMAs and transmits. With bypass the copy and the kernel vanish; the NIC part stays.
5. **Flow control**: if the exchange's window closes (it is slow), `send` blocks or returns `EAGAIN` on a non-blocking socket. Never block the hot thread on `send`: non-blocking sockets, a bounded queue, and a decision about what to do when the gateway is behind.
6. **Retransmission** (200 ms minimum RTO on Linux, `tcp_rto_min`) is the tail of TCP: a lost order packet is a lost 200 ms. Redundant sessions or FPGA gateways exist for this reason.

The corresponding measurement: `SO_TIMESTAMPING` with `SOF_TIMESTAMPING_TX_SOFTWARE | TX_SCHED | TX_ACK` timestamps a packet at the socket, at the driver, and on ACK; hardware NICs add `TX_HARDWARE` at the wire.

---

# PART 6 — TIMESTAMPS, CLOCKS, AND PROVING IT

You cannot fix what you cannot locate, and a trading system's latency budget is made of five or six stages. The tools:

- **Payload timestamps**: the sender writes `clock_gettime(CLOCK_REALTIME)` (or the TSC) into the message; the receiver diffs. Same machine: exact. Two machines: only as good as clock sync.
- **Kernel receive timestamps** (`SO_TIMESTAMPNS`, `systems/05`): when the kernel took the packet from the driver, delivered as `cmsg`. Separates "stack" from "wait".
- **Hardware timestamps** (`SO_TIMESTAMPING` with `RX_HARDWARE`/`TX_HARDWARE`): the NIC stamps at the PHY; needs a NIC with a PTP clock. Combined with PTP-synchronized clocks across machines (`ptp4l`, `phc2sys`; hardware timestamping on the switch path), sub-microsecond end-to-end measurement across the data centre.
- **Capture**: `tcpdump -i eth0 -j adapter_unsynced` or a span-port capture appliance gives an independent view of wire arrival time; compare against your application's stamps to catch the stack or the NIC lying.
- **What to report**: per-stage p50 / p99 / p99.9 / max over a full trading day, with the packet rate. A mean hides the 3 ms outliers that `systems/05` produced at 20k packets/s with a sleeping receiver.

Clocks to know: `CLOCK_REALTIME` (wall, NTP/PTP-disciplined, can jump), `CLOCK_MONOTONIC` (no jumps, rate-adjusted), `CLOCK_MONOTONIC_RAW` (hardware rate, no adjustment: for intervals), the TSC (per-core counter, constant-rate on modern CPUs; convert with a calibrated frequency, `perf/04`), and the NIC's PHC (`/dev/ptp0`) that hardware stamps come from.

---

# PART 7 — A FEED HANDLER'S HOT LOOP (the design you should be able to draw)

```
loop on an isolated core:
    poll the socket / ring (no blocking)
    for each datagram:
        parse header in place; check length
        seq = header.seq
        if seq == expected: dispatch(msg); expected++
        elif seq > expected: buffer(msg); request_gap(expected, seq); mark_book_stale()
        else: drop (duplicate from the other feed)
    dispatch(msg): switch on type -> update book (arrays indexed by price level, intrusive per-level lists)
                   -> publish book delta to strategies via an SPSC queue (no lock, no syscall)
    stamps: record (wire or kernel stamp, poll-return time, parse-done time, publish time) in a preallocated ring; another thread turns them into histograms
```

Design properties: no allocation, no syscalls except the receive itself (none with bypass), no locks, bounded work per packet, everything sized at startup, all failure modes (gap, malformed, buffer full) handled by a flag the strategy reads, never by blocking.

---

# PART 8 — Q&A DRILL

### Q: Why UDP multicast for market data and TCP for orders?
Multicast fans out with no per-subscriber state and no retransmission stalls; loss is handled by sequence numbers, A/B arbitration, a recovery channel and snapshots. Orders are rare and must be reliable and ordered, and the exchange requires a session protocol; TCP with `TCP_NODELAY` and one write per message.

### Q: What is the write-write-read problem and how do you fix it?
Nagle holds a second small segment until the first is acknowledged; the receiver's delayed-ACK timer holds that ACK for up to 40 ms hoping to piggyback it. `systems/04`: 41 ms per request. Fix: `TCP_NODELAY`, and build the message in one buffer so there is one write (also fewer syscalls).

### Q: A feed handler sees gaps. Walk through the recovery.
Buffer out-of-order messages, request the missing range from the retransmission channel (or give the B feed a bounded time to deliver it), mark the book stale so strategies stop trusting it, replay in order once the gap is filled, clear the flag. If the gap is too large or the recovery fails: snapshot, then replay buffered messages above the snapshot's sequence.

### Q: What does the kernel stack cost and what does bypass buy?
Roughly 4–15 µs per packet on the receive path with a fat tail dominated by wake-ups (`systems/03`, `systems/05`); bypass maps the NIC rings into user space, removing the interrupt, the copy, the socket lock and the scheduler: ~1–2 µs with a tight tail. It does not remove your parsing, your book, or the need for isolated cores.

### Q: How do you know whether a latency spike was the network or your process?
Timestamps at every stage: NIC hardware stamp (wire), kernel stamp (`SO_TIMESTAMPNS`), poll-return time, parse-done, publish. `systems/05` shows the stack at 2–5 µs while the wait was 17 µs median and 1.2 ms p99: the process, not the network. An independent capture (span port, `tcpdump` with adapter stamps) settles arguments with the exchange.

### Q: Why busy-poll instead of `epoll`?
`epoll_wait` puts the thread to sleep; waking it costs ~5 µs and up to hundreds from a deep idle state, with a tail (`systems/03`: 19.9 vs 8.7 µs round trip, max 485 vs 42 µs). A spinning thread on an isolated core reacts in ~1–2 µs. Costs: a core at 100% and the isolation requirement.

### Q: Two data centres, is the latency 2 ms or 200 µs? How would you measure it?
Physics: ~5 µs per km of fibre round trip. Measure with PTP-synchronized clocks and hardware timestamps on both ends (`SO_TIMESTAMPING` RX/TX hardware), or with a round trip through a reflector and halve it, and report the distribution, not one number.

### Q: What can go wrong with `SO_RCVBUF` and how do you see it?
Too small and a burst of packets is dropped silently when the queue fills; `/proc/net/udp` drops, `netstat -su` receive errors, `ethtool -S` for NIC-level misses. Raise `net.core.rmem_max` (root) and the socket's buffer, and more importantly drain faster (poll, batch with `recvmmsg`, bypass).

---

## Sources

- Linux man pages: `udp(7)`, `tcp(7)` (`TCP_NODELAY`, `TCP_QUICKACK`, `TCP_CORK`), `socket(7)` (`SO_BUSY_POLL`, `SO_RCVBUF`, `SO_TIMESTAMPNS`), `ip(7)` (`IP_ADD_MEMBERSHIP`), `recvmmsg(2)`, `epoll(7)`.
- Linux kernel documentation: `networking/timestamping.rst` (`SO_TIMESTAMPING` flags), `networking/scaling.rst` (RSS/RPS/RFS), `networking/napi.rst`, `networking/af_xdp.rst`, `networking/ip-sysctl.rst`.
- IEEE 1588 / `linuxptp` documentation (`ptp4l`, `phc2sys`) for clock synchronization.
- Exchange protocol specifications are public (e.g., Nasdaq ITCH/OUCH, CME MDP 3.0 with SBE): read one to see sequence numbers, snapshots and message layouts in practice.
- Lab measurements: `systems/02`, `systems/03`, `systems/04`, `systems/05`.
