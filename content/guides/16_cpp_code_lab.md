<!--
category: Hands-On Code Lab
tags: C++, CRTP, Move Semantics, Smart Pointers, SFINAE, Concepts, Atomics, HFT, Lock-Free, Sanitizers, ODR, Linking, Casting
difficulty: Intermediate
readTime: 50 min
-->

# Hands-On C++ Code Lab

> [!IMPORTANT]
> **TL;DR — what you must remember:** A run-it-yourself gallery: each topic (CRTP, move semantics, smart pointers, SFINAE/concepts, atomics, lock-free, ODR, sanitizers) is a **self-contained program** with the compile command, expected output, and the one sentence an interviewer wants to hear. Build with `g++ -std=c++20 -O2`. The point is to *see* the behavior in front of you, not just recite it.

A curated gallery of **compile-and-run** C++ programs — one per interview topic. Every entry shows **what it proves**, the **full source**, the exact **compile + run command**, the **expected output**, and the **key takeaways** an interviewer wants to hear.

> [!TIP]
> Every snippet below is self-contained. Copy it into a `.cpp` file and run the command shown. Unless noted otherwise, build with a C++20 compiler: `g++ -std=c++20 -O2 file.cpp -o demo`.

## Table of Contents

- [1. CRTP — Static Polymorphism Without a VTable](#1-crtp-static-polymorphism-without-a-vtable)
- [2. Copy & Move Semantics — Rule of 3 / Rule of 5](#2-copy-move-semantics-rule-of-3-rule-of-5)
- [3. Smart Pointers & RAII — Ownership Made Explicit](#3-smart-pointers-raii-ownership-made-explicit)
- [4. Templates, SFINAE & C++20 Concepts](#4-templates-sfinae-c-20-concepts)
- [5. The Four C++ Casts — Under the Hood](#5-the-four-c-casts-under-the-hood)
- [6. Storage Duration, const / constexpr / consteval](#6-storage-duration-const-constexpr-consteval)
- [7. Atomics & Memory Ordering](#7-atomics-memory-ordering)
- [8. HFT Low-Latency Toolkit — Lock-Free SPSC Queue](#8-hft-low-latency-toolkit-lock-free-spsc-queue)
- [9. Parameter Passing & the Array-Decay Trap](#9-parameter-passing-the-array-decay-trap)
- [10. The Singleton, Three Ways](#10-the-singleton-three-ways)
- [11. Memory Errors & How to Catch Them](#11-memory-errors-how-to-catch-them)
- [12. The Sanitizer Trilogy — ASan / TSan / UBSan](#12-the-sanitizer-trilogy-asan-tsan-ubsan)
- [13. ODR & Linkage — The One Definition Rule](#13-odr-linkage-the-one-definition-rule)
- [14. Linking & `extern "C"` — Building a Library](#14-linking-extern-c-building-a-library)

---

## 1. CRTP — Static Polymorphism Without a VTable

**What it proves:** You can get polymorphic dispatch resolved entirely at *compile time* — no vptr, no vtable, no indirect jump — by passing the derived type into the base template.

```cpp
#include <iostream>
using namespace std;

// The Base class is a template that takes the 'Derived' class as a parameter.
// Every interface method casts 'this' to 'Derived*' via static_cast — no virtuals.
template <typename Derived>
class Logger {
public:
    void log(const string& msg) {
        // Cast 'this' (Base*) to 'Derived*' to reach the implementation.
        static_cast<Derived*>(this)->log_implementation(msg);
    }
    void log_implementation(const string& msg) {       // default (optional)
        cout << "[Default Logger]: " << msg << endl;
    }
};

class FastLogger : public Logger<FastLogger> {
public:
    void log_implementation(const string& msg) {
        cout << "[Fast Console]: " << msg << endl;
    }
};

class SecretLogger : public Logger<SecretLogger> {
public:
    void log_implementation(const string& msg) {
        cout << "[Secret Masked]: " << string(msg.length(), '*') << endl;
    }
};

int main() {
    FastLogger fl;
    SecretLogger sl;
    cout << "--- STATIC POLYMORPHISM (CRTP) ---" << endl;
    fl.log("Price at 150.25");
    sl.log("User Password123");
    return 0;
}
```

```bash
g++ -std=c++20 -O2 crtp.cpp -o crtp && ./crtp
```

```text
--- STATIC POLYMORPHISM (CRTP) ---
[Fast Console]: Price at 150.25
[Secret Masked]: *****************
```

> [!NOTE]
> **Why it's faster:** (1) No vptr → `sizeof(FastLogger)` is 1 byte, not 8. (2) No indirection — the CPU never jumps through a vtable. (3) The compiler can *inline* `log_implementation` straight into the call site. CRTP is the classic trade of **runtime flexibility for raw speed** — exactly the deal HFT and templated library code want.

---

## 2. Copy & Move Semantics — Rule of 3 / Rule of 5

**What it proves:** Why a default (shallow) copy double-frees, how the Rule of Three fixes it with deep copies, and how a move constructor *steals* the buffer instead of cloning it.

```cpp
#include <iostream>
#include <cstring>
#include <utility>
using namespace std;

// --- DEEP COPY (Rule of Three) ---
class Deep {
public:
    int* data;
    size_t size;
    Deep(int value) : size(1) {
        data = new int(value);
        cout << "Deep Constructor: Allocated at " << data << endl;
    }
    Deep(const Deep& other) : size(other.size) {            // 1. Copy ctor
        data = new int(*other.data);
        cout << "Deep Copy Constructor: New alloc at " << data << endl;
    }
    Deep& operator=(const Deep& other) {                    // 2. Copy assign
        cout << "Deep Copy Assignment" << endl;
        if (this == &other) return *this;                   // self-assign guard
        delete data;
        size = other.size;
        data = new int(*other.data);
        return *this;
    }
    ~Deep() { delete data; }                                // 3. Destructor
};

// --- MOVE SEMANTICS (Rule of Five) ---
class SmartBuffer {
public:
    int* data;
    size_t size;
    SmartBuffer(size_t s) : size(s) {
        data = new int[size];
        cout << "SmartBuffer Constructor: " << size << " elems at " << data << endl;
    }
    SmartBuffer(SmartBuffer&& other) noexcept              // 4. Move ctor: "steal"
        : data(other.data), size(other.size) {
        other.data = nullptr;                              // leave source empty + safe
        other.size = 0;
        cout << "SmartBuffer Move Constructor (Stole " << data << ")" << endl;
    }
    ~SmartBuffer() { delete[] data; }
};

int main() {
    cout << "--- Deep Copy ---" << endl;
    Deep d1(200);
    Deep d2 = d1;                       // calls copy ctor — distinct allocation

    cout << "\n--- Move ---" << endl;
    SmartBuffer b1(1000);
    SmartBuffer b2 = std::move(b1);     // std::move → rvalue → move ctor
    cout << "b1.data: " << b1.data << " (null)\n";
    cout << "b2.data: " << b2.data << " (old b1 buffer)\n";
    return 0;
}
```

```bash
g++ -std=c++20 -O2 copy_move.cpp -o copy_move && ./copy_move
```

```text
--- Deep Copy ---
Deep Constructor: Allocated at 0x55...e2c0
Deep Copy Constructor: New alloc at 0x55...e2e0

--- Move ---
SmartBuffer Constructor: 1000 elems at 0x55...e300
SmartBuffer Move Constructor (Stole 0x55...e300)
b1.data: 0 (null)
b2.data: 0x55...e300 (old b1 buffer)
```

> [!IMPORTANT]
> A **shallow** copy of a pointer-owning class double-frees on destruction (both objects `delete` the same address). The fixes: **Rule of Three** (copy ctor + copy assign + dtor for deep copy) and **Rule of Five** (add move ctor + move assign to *transfer* ownership cheaply). Mark moves `noexcept` so `std::vector` will use them during reallocation.

---

## 3. Smart Pointers & RAII — Ownership Made Explicit

**What it proves:** How `unique_ptr` enforces single ownership (copy deleted, move allowed), how `shared_ptr`/`weak_ptr` track and break reference cycles, and why `enable_shared_from_this` exists.

```cpp
#include <iostream>
#include <memory>
using namespace std;

// A minimal unique_ptr: RAII + move-only ownership.
template <typename T> class SimpleUniquePtr {
    T* ptr;
public:
    explicit SimpleUniquePtr(T* p = nullptr) : ptr(p) {}
    ~SimpleUniquePtr() { delete ptr; }
    SimpleUniquePtr(const SimpleUniquePtr&) = delete;              // no copy
    SimpleUniquePtr& operator=(const SimpleUniquePtr&) = delete;
    SimpleUniquePtr(SimpleUniquePtr&& o) noexcept : ptr(o.ptr) {   // move = transfer
        o.ptr = nullptr;
    }
    T* get() const { return ptr; }
    T& operator*() const { return *ptr; }
};

int main() {
    {
        SimpleUniquePtr<int> p(new int(500));
        cout << "value: " << *p << endl;
        SimpleUniquePtr<int> moved = std::move(p);
        if (!p.get()) cout << "Original is null after move." << endl;
    } // freed here

    auto shared = make_shared<int>(100);
    weak_ptr<int> weak = shared;
    cout << "Shared count: " << shared.use_count() << endl;   // 1 (weak doesn't bump)
    if (auto locked = weak.lock()) cout << "Locked value: " << *locked << endl;
    shared.reset();
    if (weak.expired()) cout << "Weak ptr expired after reset." << endl;
    return 0;
}
```

```bash
g++ -std=c++20 -O2 smart_pointers.cpp -o sp && ./sp
```

```text
value: 500
Original is null after move.
Shared count: 1
Locked value: 100
Weak ptr expired after reset.
```

> [!NOTE]
> **`weak_ptr` does not contribute to `use_count`** — it's how you break `shared_ptr` cycles (e.g. parent↔child). `lock()` returns a valid `shared_ptr` only if the object is still alive, otherwise `expired()` is true. Reach for `enable_shared_from_this` when an object must hand out a `shared_ptr` to *itself* safely.

---

## 4. Templates, SFINAE & C++20 Concepts

**What it proves:** Three generations of compile-time dispatch — `enable_if` SFINAE, C++20 `concept` constraints, and recursive template metaprogramming (compile-time Fibonacci).

```cpp
#include <iostream>
#include <type_traits>
using namespace std;

// 1. SFINAE — Substitution Failure Is Not An Error
template <typename T>
typename std::enable_if<std::is_integral<T>::value, void>::type
process_value(T v) { cout << "Processing integral: " << v << endl; }

template <typename T>
typename std::enable_if<std::is_floating_point<T>::value, void>::type
process_value(T v) { cout << "Processing float: " << v << endl; }

// 2. C++20 Concepts — clean alternative to SFINAE
template <typename T> concept Numeric = std::is_arithmetic_v<T>;
void print_numeric(Numeric auto value) { cout << "Numeric value: " << value << endl; }

// 3. Compile-time metaprogramming — Fibonacci computed by the compiler
template <int N> struct Fibonacci {
    static constexpr int value = Fibonacci<N-1>::value + Fibonacci<N-2>::value;
};
template <> struct Fibonacci<0> { static constexpr int value = 0; };
template <> struct Fibonacci<1> { static constexpr int value = 1; };

int main() {
    process_value(10);     // integral overload
    process_value(3.14);   // float overload
    print_numeric(100);
    // print_numeric("hi"); // COMPILE ERROR: does not satisfy Numeric
    cout << "Fibonacci<10> at compile time: " << Fibonacci<10>::value << endl;
    return 0;
}
```

```bash
g++ -std=c++20 -O2 templates.cpp -o tmp && ./tmp
```

```text
Processing integral: 10
Processing float: 3.14
Numeric value: 100
Fibonacci<10> at compile time: 55
```

> [!TIP]
> Interview soundbite: "**Concepts are SFINAE with readable error messages.**" The `Fibonacci<10>::value` is a compile-time constant baked into the binary — there is *zero* runtime computation. That's the whole point of TMP.

---

## 5. The Four C++ Casts — Under the Hood

**What it proves:** Exactly what each named cast emits: `static_cast` may *adjust the pointer* under multiple inheritance, `dynamic_cast` walks the RTTI at runtime, `const_cast`/`reinterpret_cast` emit **zero** instructions and just change the compiler's view of the bits.

```cpp
#include <iostream>
#include <typeinfo>
#include <cstdint>
using namespace std;

class Base      { public: virtual void speak() { cout << "Base::speak()\n"; } virtual ~Base() {} };
class Interface { public: virtual void run() = 0; virtual ~Interface() {} };
class Derived : public Base, public Interface {
public:
    void speak() override { cout << "Derived::speak()\n"; }
    void run()   override { cout << "Derived::run()\n"; }
};
enum class Color { Red, Green, Blue };

int main() {
    // 1. static_cast — compile-time; adjusts 'this' across multiple inheritance.
    Color c = Color::Green;
    cout << "static_cast enum->int: " << static_cast<int>(c) << endl;
    Derived* d = new Derived();
    Interface* inter = static_cast<Interface*>(d);  // pointer shifted by +8 bytes
    inter->run();

    // 2. dynamic_cast — runtime RTTI walk; cross-cast Base -> Interface.
    Base* b = new Derived();
    if (Interface* i = dynamic_cast<Interface*>(b)) {
        cout << "dynamic_cast cross-cast OK\n"; i->run();
    }

    // 3. const_cast — ZERO instructions; only strips const for type-checking.
    auto legacy_print = [](char* s) { cout << "Legacy: " << s << endl; };
    const char* msg = "Hello Const";
    legacy_print(const_cast<char*>(msg));   // safe iff callee doesn't write

    // 4. reinterpret_cast — ZERO instructions; treat the bits as another type.
    uintptr_t addr = reinterpret_cast<uintptr_t>(d);
    cout << "reinterpret ptr->int: " << hex << showbase << addr << dec << endl;

    delete d; delete b;
    return 0;
}
```

```bash
g++ -std=c++20 -O2 casting.cpp -o cast && ./cast
```

```text
static_cast enum->int: 1
Derived::run()
dynamic_cast cross-cast OK
Derived::run()
Legacy: Hello Const
reinterpret ptr->int: 0x55...a2c0
```

> [!CAUTION]
> The killer detail: under multiple inheritance, `static_cast<Interface*>(d)` produces a pointer **offset by the size of the first base**, while `reinterpret_cast` would *not* adjust it — using `reinterpret_cast` there would silently hand you a broken vtable. Use `static_cast` for type-aware conversions, `reinterpret_cast` only for raw bit-level reinterpretation.

---

## 6. Storage Duration, const / constexpr / consteval

**What it proves:** The lifetime ladder — `static` locals persist across calls, `thread_local` gives each thread its own copy, `mutable` punches through `const`, and `constexpr`/`consteval` push work to compile time.

```cpp
#include <iostream>
#include <thread>
using namespace std;

constexpr int get_size() { return 100; }   // compile-time if possible
consteval int square(int n) { return n*n; } // MUST be compile-time

void counter() { static int count = 0; cout << "Count: " << ++count << " "; }
thread_local int thread_id = 0;             // per-thread storage

class DataWrapper {
    mutable int access_count = 0;           // modifiable inside a const method
    int data = 10;
public:
    int get_data() const { access_count++; return data; }
    int get_access_count() const { return access_count; }
};

int main() {
    constexpr int s = get_size();
    int arr[s];                             // size known at compile time
    cout << "constexpr array size: " << sizeof(arr)/sizeof(int) << endl;
    cout << "consteval square(5): " << square(5) << endl;

    cout << "static counter: ";
    for (int i = 0; i < 3; ++i) counter();
    cout << endl;

    DataWrapper dw; dw.get_data(); dw.get_data();
    cout << "mutable access_count: " << dw.get_access_count() << endl;

    thread t1([]{ thread_id = 1; cout << "T1 id: " << thread_id << endl; });
    thread t2([]{ thread_id = 2; cout << "T2 id: " << thread_id << endl; });
    t1.join(); t2.join();
    cout << "main thread id: " << thread_id << endl;
    return 0;
}
```

```bash
g++ -std=c++20 -O2 storage.cpp -o storage -pthread && ./storage
```

```text
constexpr array size: 100
consteval square(5): 25
static counter: Count: 1 Count: 2 Count: 3
mutable access_count: 2
T1 id: 1
T2 id: 2
main thread id: 0
```

> [!NOTE]
> `thread_id` is `thread_local`, so each thread sees its **own** copy — the main thread still reads `0` even after the workers set `1` and `2`. `mutable` is the sanctioned escape hatch for caches/counters that don't change an object's *logical* state. `consteval` is `constexpr`'s stricter sibling: it is an error if it ever runs at runtime.

---

## 7. Atomics & Memory Ordering

**What it proves:** The acquire/release handshake — a `release` store *publishes* every prior write, and a matching `acquire` load *sees* them. This is the foundation of every lock-free algorithm.

```cpp
#include <iostream>
#include <atomic>
#include <thread>
using namespace std;

atomic<int>  shared_data{0};
atomic<bool> ready{false};

void producer() {
    shared_data.store(42, memory_order_relaxed);  // 1. write the payload
    ready.store(true, memory_order_release);       // 2. publish (release)
}
void consumer() {
    while (!ready.load(memory_order_acquire)) {}    // 3. wait (acquire)
    cout << "Acquired shared data: "
         << shared_data.load(memory_order_relaxed) << endl; // 4. now safe to read
}

int main() {
    cout << "--- MEMORY ORDERING DEMO ---" << endl;
    thread t1(producer), t2(consumer);
    t1.join(); t2.join();
    return 0;
}
```

```bash
g++ -std=c++20 -O2 atomics.cpp -o atomics -pthread && ./atomics
```

```text
--- MEMORY ORDERING DEMO ---
Acquired shared data: 42
```

> [!IMPORTANT]
> The interview one-liner for each ordering:
> - **`relaxed`** — atomicity only, no ordering. Counters/stats.
> - **`release`** — "I'm done writing; everything before this is now visible."
> - **`acquire`** — "I'm starting to read; show me everything the producer released."
> - **`seq_cst`** (default) — one total global order. Safest, slowest (inserts full fences).

---

## 8. HFT Low-Latency Toolkit — Lock-Free SPSC Queue

**What it proves:** A production-shaped single-producer/single-consumer ring buffer that beats mutexes by ~100× — combining cache-line alignment (kills false sharing), power-of-two masking, and acquire/release atomics. Plus branch hints and software prefetch.

```cpp
#include <atomic>
#include <immintrin.h>   // _mm_prefetch
#include <iostream>
#include <new>           // hardware_destructive_interference_size
#include <thread>
using namespace std;

#ifdef __cpp_lib_hardware_interference_size
using std::hardware_destructive_interference_size;
#else
constexpr std::size_t hardware_destructive_interference_size = 64;
#endif

template <typename T, size_t Size>
class LockFreeQueue {
    static_assert((Size & (Size - 1)) == 0, "Size must be a power of 2"); // fast mask
    // head and tail live on DIFFERENT cache lines → no false sharing.
    alignas(hardware_destructive_interference_size) std::atomic<size_t> head{0};
    alignas(hardware_destructive_interference_size) std::atomic<size_t> tail{0};
    T buffer[Size];
    static constexpr size_t mask = Size - 1;
public:
    bool push(const T& item) {
        size_t h = head.load(std::memory_order_relaxed);   // only producer writes head
        size_t t = tail.load(std::memory_order_acquire);   // see consumer's progress
        if (((h + 1) & mask) == t) return false;           // full
        buffer[h & mask] = item;
        head.store((h + 1) & mask, std::memory_order_release); // publish data + index
        return true;
    }
    bool pop(T& item) {
        size_t t = tail.load(std::memory_order_relaxed);
        size_t h = head.load(std::memory_order_acquire);
        if (h == t) return false;                          // empty
        item = buffer[t & mask];
        tail.store((t + 1) & mask, std::memory_order_release);
        return true;
    }
};

void performance_tricks() {
    unsigned int data_ready = 1;
    if (__builtin_expect(data_ready == 1, 1))              // branch-prediction hint
        cout << "Optimized branch taken.\n";
    int* future = new int[100];
    _mm_prefetch((const char*)&future[0], _MM_HINT_T0);    // pull into L1 early
    unsigned int bits = 0b101101;
    cout << "POPCNT set bits: " << __builtin_popcount(bits) << endl;
    delete[] future;
}

int main() {
    cout << "--- HFT Low-Latency Demo ---\n";
    LockFreeQueue<int, 256> q;
    thread producer([&]{ for (int i = 0; i < 5; ++i) { while (!q.push(i)); cout << "Produced: " << i << endl; } });
    thread consumer([&]{ for (int i = 0; i < 5; ++i) { int v; while (!q.pop(v)); cout << "Consumed: " << v << endl; } });
    producer.join(); consumer.join();
    performance_tricks();
    return 0;
}
```

```bash
g++ -std=c++20 -O2 -march=native hft.cpp -o hft -pthread && ./hft
```

```text
--- HFT Low-Latency Demo ---
Produced: 0
Consumed: 0
Produced: 1
...
Optimized branch taken.
POPCNT set bits: 4
```

> [!NOTE]
> The four latency wins here: (1) **`alignas(64)`** puts `head`/`tail` on separate cache lines so the producer and consumer never invalidate each other (false sharing can be 100× slower). (2) **Power-of-two size** turns `% Size` into a single `& mask`. (3) **acquire/release** instead of a mutex (~10–50 ns vs ~1–5 µs). (4) **`__builtin_expect` + `_mm_prefetch`** keep the pipeline full and hide DRAM latency. (Producer/consumer interleaving is timing-dependent.)

---

## 9. Parameter Passing & the Array-Decay Trap

**What it proves:** `int arr[]` silently decays to `int*` (you lose the size), how passing by reference-to-array preserves it, and the value/ref/const-ref cost ladder for containers.

```cpp
#include <iostream>
#include <vector>
using namespace std;

void pass_1d_array_decay(int arr[], int size) {
    cout << "decay: sizeof(arr) = " << sizeof(arr) << " (pointer size)" << endl;
    if (size > 0) arr[0] = 999;
}
void pass_1d_array_ref(int (&arr)[5]) {                 // size preserved!
    cout << "ref:   sizeof(arr) = " << sizeof(arr) << " (real array size)" << endl;
    arr[1] = 888;
}
void pass_vector_value(vector<int> v) { v.push_back(10); }       // deep copy (slow)
void pass_vector_ref(vector<int>& v)  { v.push_back(20); }       // no copy (fast)
void pass_vector_cref(const vector<int>& v) {                    // read-only (best)
    if (!v.empty()) cout << "Vector[0]: " << v[0] << endl;
}

int main() {
    int my_array[5] = {1,2,3,4,5};
    cout << "main:  sizeof(my_array) = " << sizeof(my_array) << endl;
    pass_1d_array_decay(my_array, 5);
    pass_1d_array_ref(my_array);

    vector<int> vec = {10, 20};
    pass_vector_value(vec);
    cout << "after value pass: size = " << vec.size() << " (still 2)" << endl;
    pass_vector_ref(vec);
    cout << "after ref pass:   size = " << vec.size() << " (now 3)" << endl;
    pass_vector_cref(vec);
    return 0;
}
```

```bash
g++ -std=c++20 -O2 passing.cpp -o passing && ./passing
```

```text
main:  sizeof(my_array) = 20
decay: sizeof(arr) = 8 (pointer size)
ref:   sizeof(arr) = 20 (real array size)
after value pass: size = 2 (still 2)
after ref pass:   size = 3 (now 3)
Vector[0]: 999
```

> [!TIP]
> The rule that wins points: **pass by `const&` for read-only, `&` for mutate, by value only when you genuinely need a copy** (or want to move into it). `int arr[]` as a parameter *is* `int*` — `sizeof` gives 8, not 20. Use `std::span` (C++20) or a reference-to-array to keep the length.

---

## 10. The Singleton, Three Ways

**What it proves:** Three implementations of lazy single-instance init and their thread-safety story: naive (racy), `std::mutex` (correct, locks every call), and `std::call_once` (correct, locks only once).

```cpp
#include <iostream>
#include <mutex>
using namespace std;

// 1. Naive — NOT thread-safe (two threads can both see instance == nullptr).
class Singleton {
    static Singleton* instance;
    int counter = 0, multiplier = 2;
    Singleton() { cout << "normal singleton created\n"; }
public:
    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;
    static Singleton* get() { if (!instance) instance = new Singleton(); return instance; }
    void increment() { counter++; }
    int compute() const { return counter * multiplier; }
};
Singleton* Singleton::instance = nullptr;

// 2. call_once — thread-safe, runs the initializer exactly once.
class SingletonOnce {
    static SingletonOnce* instance;
    static std::once_flag flag;
    int base = 1, factor = 3;
    SingletonOnce() { cout << "once_flag singleton created\n"; }
public:
    static SingletonOnce* get() {
        std::call_once(flag, []{ instance = new SingletonOnce(); });
        return instance;
    }
    void multiply(int x) { base *= x; }
    int compute() const { return base * factor; }
};
SingletonOnce* SingletonOnce::instance = nullptr;
std::once_flag SingletonOnce::flag;

int main() {
    Singleton* s = Singleton::get();
    s->increment(); s->increment();
    cout << "[singleton] counter*multiplier = " << s->compute() << endl;

    SingletonOnce* o = SingletonOnce::get();
    o->multiply(4);
    cout << "[once] base*factor = " << o->compute() << endl;
    SingletonOnce* o2 = SingletonOnce::get();   // same object, no re-init
    o2->multiply(2);
    cout << "[once again] base*factor = " << o2->compute() << endl;
    return 0;
}
```

```bash
g++ -std=c++20 -O2 singleton.cpp -o singleton -pthread && ./singleton
```

```text
normal singleton created
[singleton] counter*multiplier = 4
once_flag singleton created
[once] base*factor = 12
[once again] base*factor = 24
```

> [!IMPORTANT]
> Modern best practice is the **Meyers Singleton**: `static Singleton instance; return instance;` inside the accessor. C++11 guarantees function-local `static` initialization is thread-safe, giving you `call_once` semantics for free — no manual flag, no `new`, no leak.

---

## 11. Memory Errors & How to Catch Them

**What it proves:** A field guide to the four classic heap bugs (leak, dangling pointer, use-after-free, buffer overflow) and the RAII mitigation. Pair it with Valgrind to *see* them.

```cpp
#include <iostream>
#include <memory>
#include <vector>
using namespace std;

void memory_leak() {
    int* leak = new int[100];          // never deleted → leak
    for (int i = 0; i < 100; ++i) leak[i] = i;
    cout << "Allocated 100 ints, forgot to delete.\n";
}
void dangling_pointer() {
    int* ptr = new int(10);
    delete ptr;                        // ptr now dangles
    // *ptr;  // UB: read of freed memory
}
void out_of_bounds() {
    int* arr = new int[5];
    // arr[10] = 99;  // heap-buffer-overflow (Valgrind: "Invalid write of size 4")
    delete[] arr;
}
void mitigation() {
    unique_ptr<int[]> safe(new int[100]); // RAII: freed automatically at scope exit
    safe[0] = 42;
    cout << "unique_ptr manages memory safely.\n";
}

int main() {
    memory_leak();
    dangling_pointer();
    out_of_bounds();
    mitigation();
    return 0;
}
```

```bash
g++ -g -O0 memory_errors.cpp -o memerr
valgrind --leak-check=full --show-leak-kinds=all ./memerr
```

```text
Allocated 100 ints, forgot to delete.
unique_ptr manages memory safely.
==12345== HEAP SUMMARY:
==12345==    definitely lost: 400 bytes in 1 blocks
==12345== LEAK SUMMARY:
==12345==    definitely lost: 400 bytes in 1 blocks
```

> [!CAUTION]
> In long-running processes (servers, HFT engines) these bugs don't crash immediately — they cause **memory fragmentation** and eventual **OOM** hours later. The cure is structural: prefer RAII (`unique_ptr`, `vector`, `string`) so destructors free resources deterministically. The detection tools below catch what slips through.

---

## 12. The Sanitizer Trilogy — ASan / TSan / UBSan

**What it proves:** Each `-fsanitize` flag instruments the binary to abort with a precise report the instant a specific bug class executes — far faster to diagnose than a Valgrind run or a silent corruption.

**AddressSanitizer (ASan)** — use-after-free, heap/stack overflow, leaks:

```cpp
#include <iostream>
void use_after_free() {
    int* p = new int(42);
    delete p;
    std::cout << "Value: " << *p << std::endl;  // heap-use-after-free
}
int main() { use_after_free(); }
```

```bash
g++ -fsanitize=address -g -O1 asan_demo.cpp -o asan && ./asan
```

```text
==12345==ERROR: AddressSanitizer: heap-use-after-free on address 0x...
READ of size 4 at 0x... thread T0
    #0 in use_after_free() asan_demo.cpp:5
freed by thread T0 here:
    #0 in operator delete(void*)
```

**ThreadSanitizer (TSan)** — data races:

```cpp
#include <iostream>
#include <thread>
int shared_counter = 0;
void increment() { for (int i = 0; i < 100000; ++i) shared_counter++; } // race!
int main() {
    std::thread t1(increment), t2(increment);
    t1.join(); t2.join();
    std::cout << "Final: " << shared_counter << std::endl; // < 200000, nondeterministic
}
```

```bash
g++ -fsanitize=thread -g -O1 tsan_demo.cpp -o tsan -pthread && ./tsan
```

```text
==================
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 4 at 0x... by thread T2:
    #0 increment() tsan_demo.cpp:4
  Previous write of size 4 ... by thread T1
==================
```

**UndefinedBehaviorSanitizer (UBSan)** — signed overflow, null deref, bad shifts:

```cpp
#include <climits>
#include <iostream>
int main() {
    int x = INT_MAX;
    x = x + 1;                       // signed integer overflow (UB)
    std::cout << "MAX+1: " << x << std::endl;
}
```

```bash
g++ -fsanitize=undefined -g -O1 ubsan_demo.cpp -o ubsan && ./ubsan
```

```text
ubsan_demo.cpp:5:11: runtime error: signed integer overflow:
2147483647 + 1 cannot be represented in type 'int'
```

> [!TIP]
> Day-to-day workflow: build your test binary with `-fsanitize=address,undefined` (they compose) and run your suite under it; add a separate `-fsanitize=thread` build for concurrency tests. Sanitizers are ~2× slowdown vs Valgrind's ~20×, so they belong in CI.

---

## 13. ODR & Linkage — The One Definition Rule

**What it proves:** Why a global variable or function defined in a header explodes the linker when included in two `.cpp` files, and the C++17 fix: `inline` variables and `inline static` data members can live safely in a header.

```cpp
// header.h
#ifndef ODR_HEADER_H
#define ODR_HEADER_H
#include <iostream>

// int global_var = 10;                 // ODR VIOLATION if included in 2 TUs
inline int shared_inline_var = 42;       // C++17: safe in a header

class MyClass {
public:
    static int static_member;            // declaration → define in ONE .cpp
    inline static int inline_static = 100; // C++17: definition right here
};

inline void print_safe() { std::cout << "Safe inline function\n"; } // safe
#endif
```

```cpp
// src1.cpp — the single definition of the static member
#include "header.h"
int MyClass::static_member = 55;
void mod_src1() { shared_inline_var += 10; MyClass::static_member += 1; }
```

```cpp
// src2.cpp
#include "header.h"
void mod_src2() { shared_inline_var *= 2; }
```

```cpp
// main.cpp
#include "header.h"
void mod_src1();  void mod_src2();
int main() {
    std::cout << "start shared_inline_var: " << shared_inline_var << "\n";
    mod_src1();   // +10, +1
    mod_src2();   // *2
    std::cout << "final shared_inline_var: " << shared_inline_var
              << " (expected (42+10)*2 = 104)\n";
    std::cout << "final static_member: " << MyClass::static_member << " (56)\n";
    return 0;
}
```

```bash
g++ -std=c++17 main.cpp src1.cpp src2.cpp -o odr && ./odr
```

```text
start shared_inline_var: 42
final shared_inline_var: 104 (expected (42+10)*2 = 104)
final static_member: 56 (56)
```

> [!IMPORTANT]
> The **ODR** says every entity may have exactly one definition across the whole program. Uncommenting `int global_var = 10;` in the header yields a linker error: `multiple definition of 'global_var'`. `inline` (functions since forever, *variables* since C++17) tells the linker "merge all identical definitions into one" — which is why header-only libraries work.

---

## 14. Linking & `extern "C"` — Building a Library

**What it proves:** How to split code into a reusable library and link against it, and why `extern "C"` disables C++ name mangling so symbols stay ABI-stable and callable from C / `dlsym`.

```cpp
// lib_math.h
#ifndef LIB_MATH_H
#define LIB_MATH_H
extern "C" {                 // C linkage: no name mangling → stable symbol names
    int add(int a, int b);
    int multiply(int a, int b);
}
#endif
```

```cpp
// lib_math.cpp
#include "lib_math.h"
int add(int a, int b)      { return a + b; }
int multiply(int a, int b) { return a * b; }
```

```cpp
// main.cpp
#include "lib_math.h"
#include <iostream>
int main() {
    int x = 10, y = 5;
    std::cout << "Adding: "      << x << " + " << y << " = " << add(x, y)      << "\n";
    std::cout << "Multiplying: " << x << " * " << y << " = " << multiply(x, y) << "\n";
    return 0;
}
```

```bash
# Option A — static library
g++ -c lib_math.cpp -o lib_math.o
ar rcs libmath.a lib_math.o
g++ main.cpp -L. -lmath -o app && ./app

# Option B — shared library
g++ -fPIC -shared lib_math.cpp -o libmath.so
g++ main.cpp -L. -lmath -o app -Wl,-rpath,. && ./app
```

```text
Adding: 10 + 5 = 15
Multiplying: 10 * 5 = 50
```

> [!NOTE]
> Without `extern "C"`, the C++ compiler mangles `add(int,int)` into something like `_Z3addii`. With it, the symbol stays `add` — the precondition for calling it from C code, loading it via `dlsym("add")`, or keeping a stable shared-library ABI. Verify with `nm libmath.so | grep add`.

---

> [!TIP]
> **How to use this lab:** pick the topic you'll be quizzed on, run the snippet, then *change one thing* and predict the output before re-running (uncomment the shallow copy, the out-of-bounds write, the data race). The fastest way to internalize C++ semantics is to watch the compiler and sanitizers react to your edits.
