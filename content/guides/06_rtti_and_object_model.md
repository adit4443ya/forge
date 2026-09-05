<!--
category: C++ Systems Engineering
tags: RTTI, dynamic_cast, VTable, Memory Layout, Diamond Problem, Thunks
difficulty: Advanced
readTime: 35 min
-->

# RTTI and Dynamic Cast Deep Dive

> [!IMPORTANT]
> **TL;DR — what you must remember:** RTTI is the runtime type machinery: each polymorphic class has a vtable whose slot **−1** points to a `type_info`. `dynamic_cast` walks that to do checked down/cross-casts, and `typeid` reads it. It only works on **polymorphic types** (≥1 virtual function), costs a runtime lookup, and is exactly what `-fno-rtti` strips. Contrast: `static_cast` is unchecked and compile-time; `dynamic_cast` is checked and runtime.

## Part 1: Memory Layout Fundamentals

### Simple Single Inheritance

```cpp
class Base {
    int base_data;
public:
    virtual void f() {}
};

class Derived : public Base {
    int derived_data;
public:
    void f() override {}
};
```

**Base object in memory:**
```
Address     Content                 Size
-------     -------                 ----
0x1000      vptr -> VTable_Base     8 bytes
0x1008      base_data               4 bytes
0x100C      padding                 4 bytes
Total: 16 bytes
```

**VTable_Base structure:**
```
Address     Content                      Offset from vtable start
-------     -------                      -------------------------
0x2000      offset-to-top (0)            -16 bytes
0x2008      type_info ptr -> RTTI_Base   -8 bytes
0x2010      &Base::f()                   0 bytes (vtable[0])
```

**RTTI_Base structure (_ZTI4Base):**
```cpp
struct type_info_base {
    void* vtable_ptr;           // Points to type_info's own vtable
    const char* name;           // "4Base" (mangled name)
};
```

**Derived object in memory:**
```
Address     Content                    Size
-------     -------                    ----
0x3000      vptr -> VTable_Derived     8 bytes
0x3008      base_data                  4 bytes
0x300C      padding                    4 bytes
0x3010      derived_data               4 bytes
0x3014      padding                    4 bytes
Total: 24 bytes
```

**VTable_Derived:**
```
0x4000      offset-to-top (0)              -16 bytes
0x4008      type_info ptr -> RTTI_Derived  -8 bytes
0x4010      &Derived::f()                  0 bytes (vtable[0])
```

**RTTI_Derived structure:**
```cpp
struct si_class_type_info {  // si = single inheritance
    void* vtable_ptr;
    const char* name;         // "7Derived"
    const type_info* base;    // Pointer to RTTI_Base
};
```

---

### Multiple Inheritance (Non-Virtual)

```cpp
class A {
    int a_data;
public:
    virtual void fa() {}
};

class B {
    int b_data;
public:
    virtual void fb() {}
};

class C : public A, public B {
    int c_data;
public:
    void fa() override {}
    void fb() override {}
    virtual void fc() {}
};
```

**C object in memory:**
```
Address     Content                    Size    Notes
-------     -------                    ----    -----
0x5000      vptr_A -> VTable_C_A       8       Primary base (A subobject)
0x5008      a_data                     4
0x500C      padding                    4
0x5010      vptr_B -> VTable_C_B       8       Secondary base (B subobject)
0x5018      b_data                     4
0x501C      padding                    4
0x5020      c_data                     4
0x5024      padding                    4
Total: 40 bytes
```

**Key insight:** TWO vptrs! One for each base class with virtual functions.

**VTable_C_A (primary):**
```
Address     Content                    Offset
-------     -------                    ------
0x6000      offset-to-top (0)          -16
0x6008      RTTI_C                     -8
0x6010      &C::fa()                   0  (vtable[0])
0x6018      &C::fc()                   8  (vtable[1])
```

**VTable_C_B (secondary):**
```
Address     Content                         Offset
-------     -------                         ------
0x6100      offset-to-top (-16)             -16  ← NOTE: negative!
0x6108      RTTI_C                          -8
0x6110      &thunk_to_C::fb()               0  (vtable[0])
```

**Why thunk?** Because `this` pointer needs adjustment.

**Thunk code:**
```asm
thunk_to_C::fb():
    sub rdi, 16        ; Adjust 'this' from B* to C*
    jmp C::fb()        ; Jump to actual implementation
```

**RTTI_C structure:**
```cpp
struct vmi_class_type_info {  // vmi = virtual + multiple inheritance
    void* vtable_ptr;
    const char* name;          // "1C"
    unsigned int flags;        // Inheritance flags
    unsigned int base_count;   // 2
    
    struct base_info {
        const type_info* base_type;  // RTTI_A or RTTI_B
        long offset_flags;           // Offset + public/virtual flags
    } base_info[2];
};

// Actual values:
{
    vtable: &type_info_vtable,
    name: "1C",
    flags: 0,
    base_count: 2,
    base_info: [
        { base_type: &RTTI_A, offset_flags: 0x2 },      // offset=0, public
        { base_type: &RTTI_B, offset_flags: 0x4002 }    // offset=16, public
    ]
}
```

**offset_flags encoding:**
```
Bits 0-1:   Inheritance flags (0x2 = public)
Bit 2:      Virtual base flag (0 = non-virtual)
Bits 8+:    Offset in bytes (shifted left by 8)
```

So `0x4002 = (16 << 8) | 0x2 = offset 16, public`

---

### Virtual Inheritance (Diamond Problem)

```cpp
class V {
    int v_data;
public:
    virtual void fv() {}
};

class A : public virtual V {
    int a_data;
public:
    void fv() override {}
};

class B : public virtual V {
    int b_data;
public:
    void fv() override {}
};

class D : public A, public B {
    int d_data;
public:
    void fv() override {}
};
```

**This is complex. D has:**
- A subobject (without V part)
- B subobject (without V part)
- V subobject (shared, placed at end)
- D's own data

**D object in memory:**
```
Address     Content                        Size    Notes
-------     -------                        ----    -----
0x7000      vptr_A -> VTable_D_A           8       A subobject
0x7008      vbase_offset -> 32             8       Offset to V subobject
0x7010      a_data                         4
0x7014      padding                        4

0x7018      vptr_B -> VTable_D_B           8       B subobject  
0x7020      vbase_offset -> 16             8       Offset to V from B
0x7028      b_data                         4
0x702C      padding                        4

0x7030      d_data                         4       D's data
0x7034      padding                        4

0x7038      vptr_V -> VTable_D_V           8       V subobject (SHARED)
0x7040      v_data                         4
0x7044      padding                        4
Total: 72 bytes
```

**VTable_D_A:**
```
0x8000      vbase_offset (32)              -24  ← offset to V from A
0x8008      offset-to-top (0)              -16
0x8010      RTTI_D                         -8
0x8018      &D::fv() [A-in-D thunk]        0
```

**VTable_D_B:**
```
0x8100      vbase_offset (16)              -24  ← offset to V from B
0x8108      offset-to-top (-24)            -16
0x8110      RTTI_D                         -8
0x8118      &D::fv() [B-in-D thunk]        0
```

**VTable_D_V:**
```
0x8200      vbase_offset (0)               -24
0x8208      offset-to-top (-56)            -16  ← offset from V to D start
0x8210      RTTI_D                         -8
0x8218      &D::fv()                       0    ← actual implementation
```

**RTTI_D:**
```cpp
{
    vtable: &type_info_vtable,
    name: "1D",
    flags: 1,  // Has virtual bases
    base_count: 2,
    base_info: [
        { base_type: &RTTI_A, offset_flags: 0x2 },     // offset=0, public, non-virtual
        { base_type: &RTTI_B, offset_flags: 0x1802 }   // offset=24, public, non-virtual
    ]
}
```

**RTTI_A:**
```cpp
{
    vtable: &type_info_vtable,
    name: "1A",
    flags: 1,  // Has virtual bases
    base_count: 1,
    base_info: [
        { base_type: &RTTI_V, offset_flags: 0x1006 }  // Bit 2 set = VIRTUAL base
    ]
}
```

**Key:** Virtual base offset stored in vtable AND base_info has virtual flag.

---

## Part 2: Dynamic Cast Algorithm

### Case 1: Upcast (Derived* → Base*)

```cpp
D* d = new D();
A* a = dynamic_cast<A*>(d);
```

**This is trivial - no RTTI needed!**

Compiler knows offset at compile time:
```llvm
; Offset from D to A is 0 (A is first subobject)
%a = bitcast %class.D* %d to %class.A*
```

No runtime call to `__dynamic_cast`.

---

### Case 2: Downcast (Base* → Derived*)

```cpp
A* a = get_some_object();  // Might be A or D
D* d = dynamic_cast<D*>(a);
```

**Now we need RTTI.**

**Generated code:**
```llvm
%d_raw = call i8* @__dynamic_cast(
    i8* %a,                  ; Source pointer
    i8* @_ZTI1A,             ; Source type_info (RTTI_A)
    i8* @_ZTI1D,             ; Destination type_info (RTTI_D)
    i64 0                    ; Offset hint
)
%d = bitcast i8* %d_raw to %class.D*
```

**__dynamic_cast implementation (pseudocode):**

```cpp
void* __dynamic_cast(
    void* src_ptr,
    const type_info* src_type,
    const type_info* dst_type,
    ptrdiff_t src_to_dst_hint
) {
    // Step 1: Get actual object type from vptr
    void** vptr = *(void***)src_ptr;
    const type_info* actual_type = (type_info*)vptr[-1];
    
    // Step 2: Check if actual type matches destination
    if (actual_type == dst_type) {
        // Object IS the destination type
        // Apply offset from src to dst within the object
        return (char*)src_ptr + src_to_dst_hint;
    }
    
    // Step 3: Walk inheritance tree
    // Is dst_type a base of actual_type?
    ptrdiff_t offset;
    if (is_base_of(dst_type, actual_type, &offset)) {
        return (char*)src_ptr + offset;
    }
    
    // Step 4: Cross-cast check
    // Maybe src and dst are siblings?
    if (is_public_base(src_type, actual_type) &&
        is_public_base(dst_type, actual_type)) {
        // Calculate offset from src to dst through actual
        offset = offset_to_actual - offset_from_dst_to_actual;
        return (char*)src_ptr + offset;
    }
    
    return nullptr;  // Cast failed
}
```

**Concrete example with D → A → V:**

```cpp
V* v = get_object();  // Actually points to D
D* d = dynamic_cast<D*>(v);
```

**Call:**
```cpp
__dynamic_cast(v, RTTI_V, RTTI_D, 0)
```

**Steps:**
1. Read `v`'s vptr → points to VTable_D_V
2. Read `vptr[-1]` → get RTTI_D
3. Compare RTTI_D with target RTTI_D → **match!**
4. Read `vptr[-2]` → get offset-to-top = -56
5. Return `v + (-56)` → pointer to start of D object

**is_base_of pseudocode:**
```cpp
bool is_base_of(const type_info* base, const type_info* derived, ptrdiff_t* offset) {
    if (derived == base) {
        *offset = 0;
        return true;
    }
    
    // Get base class info from derived
    vmi_class_type_info* vmi = (vmi_class_type_info*)derived;
    
    for (int i = 0; i < vmi->base_count; i++) {
        ptrdiff_t base_offset = vmi->base_info[i].offset_flags >> 8;
        bool is_virtual = vmi->base_info[i].offset_flags & 0x4;
        
        if (is_virtual) {
            // Read vbase offset from vtable
            void** vptr = /* ... read from object ... */;
            base_offset = *(ptrdiff_t*)(vptr - 3);  // vbase_offset location
        }
        
        if (vmi->base_info[i].base_type == base) {
            *offset = base_offset;
            return true;
        }
        
        // Recursive check
        ptrdiff_t nested_offset;
        if (is_base_of(base, vmi->base_info[i].base_type, &nested_offset)) {
            *offset = base_offset + nested_offset;
            return true;
        }
    }
    
    return false;
}
```

---

### Case 3: Cross-cast (Sibling to Sibling)

```cpp
class A { virtual ~A() {} };
class B { virtual ~B() {} };
class C : public A, public B {};

A* a = new C();
B* b = dynamic_cast<B*>(a);  // Cast from A to B (siblings in C)
```

**Memory layout of C:**
```
0x9000      vptr_A -> VTable_C_A       8
0x9008      vptr_B -> VTable_C_B       8
```

**Dynamic cast call:**
```cpp
__dynamic_cast(a, RTTI_A, RTTI_B, -1)  // -1 = no hint
```

**Algorithm:**
1. Read vptr from `a` → VTable_C_A
2. Get actual type: RTTI_C
3. Check: Is RTTI_B == RTTI_C? No.
4. Check: Is RTTI_B base of RTTI_C? **Yes!**
5. Walk RTTI_C base_info:
   - base_info[0]: RTTI_A at offset 0
   - base_info[1]: RTTI_B at offset 8 ← **Found!**
6. Calculate: We're at A (offset 0), need to go to B (offset 8)
7. Return: `a + 8`

**Result:** `b` points 8 bytes after `a`.

---

### Case 4: Diamond with Virtual Inheritance

```cpp
V* v = new D();  // V is virtual base of D
A* a = dynamic_cast<A*>(v);  // Cast from V to A
```

**Call:**
```cpp
__dynamic_cast(v, RTTI_V, RTTI_A, -1)
```

**Algorithm:**
1. Read vptr from `v` → VTable_D_V (at offset 56 in D)
2. Get actual type: RTTI_D (from vptr[-1])
3. Get offset-to-top: -56 (from vptr[-2])
4. Calculate D start: `v + (-56)` = 0x7000
5. Check RTTI_D base_info:
   - base_info[0]: RTTI_A at offset 0 ← **Found!**
6. Return: `v + (-56) + 0` = 0x7000 (start of D, which is also start of A)

**Key:** Had to use offset-to-top to find most-derived object, then search from there.

---

### Case 5: Failed Cast

```cpp
class X { virtual ~X() {} };
class Y { virtual ~Y() {} };

X* x = new X();
Y* y = dynamic_cast<Y*>(x);  // Unrelated types
```

**Call:**
```cpp
__dynamic_cast(x, RTTI_X, RTTI_Y, -1)
```

**Algorithm:**
1. Read vptr → VTable_X
2. Get actual type: RTTI_X
3. Is RTTI_Y == RTTI_X? No.
4. Is RTTI_Y base of RTTI_X? No (check RTTI_X.base_info - empty or only has base classes).
5. Is RTTI_X base of RTTI_Y? No (can't check RTTI_Y bases from RTTI_X).
6. **Return nullptr**

---

## Part 3: Complete Walkthrough - Complex Example

### Setup

```cpp
class Base {
    int base_val;
public:
    virtual ~Base() {}
    virtual void identify() { printf("Base\n"); }
};

class Interface {
public:
    virtual ~Interface() {}
    virtual void interface_method() = 0;
};

class Middle : public Base, public Interface {
    int middle_val;
public:
    void identify() override { printf("Middle\n"); }
    void interface_method() override { printf("Middle impl\n"); }
};

class Derived : public Middle {
    int derived_val;
public:
    void identify() override { printf("Derived\n"); }
};

// Test dynamic_cast
void test() {
    Derived* d = new Derived();
    
    // Cast 1: Upcast to Base
    Base* b = dynamic_cast<Base*>(d);
    
    // Cast 2: Upcast to Interface
    Interface* i = dynamic_cast<Interface*>(d);
    
    // Cast 3: Cross-cast from Base to Interface
    Interface* i2 = dynamic_cast<Interface*>(b);
    
    // Cast 4: Downcast from Interface to Derived
    Derived* d2 = dynamic_cast<Derived*>(i);
}
```

---

### Memory Layout

**Derived object:**
```
Address     Content                    Size    Cumulative
-------     -------                    ----    ----------
0xA000      vptr_Base -> VT_D_Base     8       0
0xA008      base_val                   4       8
0xA00C      padding                    4       12

0xA010      vptr_Iface -> VT_D_Iface   8       16
0xA018      middle_val                 4       24
0xA01C      padding                    4       28

0xA020      derived_val                4       32
0xA024      padding                    4       36
Total: 40 bytes
```

---

### VTables

**VT_D_Base (primary):**
```
0xB000      offset-to-top (0)              -16
0xB008      &RTTI_Derived                  -8
0xB010      &Derived::~Derived()           0   (vtable[0])
0xB018      &Derived::identify()           8   (vtable[1])
```

**VT_D_Iface (secondary):**
```
0xB100      offset-to-top (-16)            -16  ← Key value!
0xB108      &RTTI_Derived                  -8
0xB110      &thunk_Derived::~Derived()     0
0xB118      &thunk_Derived::interface_method()  8
```

**Thunk example:**
```asm
thunk_Derived::interface_method:
    sub rdi, 16           ; this -= 16 (Interface* → Derived*)
    jmp Derived::interface_method
```

---

### RTTI Structures

**RTTI_Base:**
```cpp
{
    vtable: &std::type_info::vtable,
    name: "4Base"
}
```

**RTTI_Interface:**
```cpp
{
    vtable: &std::type_info::vtable,
    name: "9Interface"
}
```

**RTTI_Middle:**
```cpp
{
    vtable: &std::type_info::vtable,
    name: "6Middle",
    flags: 0,
    base_count: 2,
    base_info: [
        { base_type: &RTTI_Base,      offset_flags: 0x0002 },    // offset 0
        { base_type: &RTTI_Interface, offset_flags: 0x1002 }     // offset 16
    ]
}
```

**RTTI_Derived:**
```cpp
{
    vtable: &std::type_info::vtable,
    name: "7Derived",
    flags: 0,
    base_count: 1,
    base_info: [
        { base_type: &RTTI_Middle, offset_flags: 0x0002 }  // offset 0
    ]
}
```

---

### Cast 1: Upcast Derived* → Base*

```cpp
Base* b = dynamic_cast<Base*>(d);
```

**Compile-time resolution:**
- Compiler knows Base is at offset 0 in Derived
- No RTTI lookup needed
- Generates: `%b = bitcast %Derived* %d to %Base*`

**Result:** `b = 0xA000` (same address as `d`)

---

### Cast 2: Upcast Derived* → Interface*

```cpp
Interface* i = dynamic_cast<Interface*>(d);
```

**Compile-time resolution:**
- Compiler knows Interface is at offset 16 in Derived
- No RTTI lookup needed
- Generates: `%i = getelementptr %Derived* %d, i32 0, i32 1` (simplified)

**Result:** `i = 0xA010` (d + 16 bytes)

**Verify vptr:**
- Read `*(void**)0xA010` → 0xB110 (VT_D_Iface + 16)
- `0xB110[-1]` → points to RTTI_Derived ✓

---

### Cast 3: Cross-cast Base* → Interface*

```cpp
Interface* i2 = dynamic_cast<Interface*>(b);
```

**This needs RTTI!**

**Generated IR:**
```llvm
%i2_raw = call i8* @__dynamic_cast(
    i8* %b,                    ; 0xA000
    i8* @RTTI_Base,            ; Source type
    i8* @RTTI_Interface,       ; Target type
    i64 -1                     ; No hint
)
```

**__dynamic_cast execution:**

**Step 1:** Get actual type
```cpp
void** vptr = *(void***)0xA000;  // Read vptr from b
// vptr = 0xB010 (VT_D_Base + 16)
type_info* actual = (type_info*)vptr[-1];
// actual = &RTTI_Derived
```

**Step 2:** Is target == actual?
```cpp
if (&RTTI_Interface == &RTTI_Derived) → false
```

**Step 3:** Is target a base of actual?
```cpp
is_base_of(&RTTI_Interface, &RTTI_Derived, &offset)

// Search RTTI_Derived bases:
// base_info[0] = RTTI_Middle at offset 0

// Recursively search RTTI_Middle:
is_base_of(&RTTI_Interface, &RTTI_Middle, &offset)
// base_info[1] = RTTI_Interface at offset 16 ← FOUND!

// Total offset: 0 (Derived→Middle) + 16 (Middle→Interface) = 16
offset = 16
return true
```

**Step 4:** Apply offset
```cpp
return (char*)src_ptr + offset;
// return 0xA000 + 16 = 0xA010
```

**Result:** `i2 = 0xA010`

**Verification:**
- `i2` points to Interface subobject
- `*(void**)i2` → 0xB110 (VT_D_Iface)
- Same as `i` from Cast 2 ✓

---

### Cast 4: Downcast Interface* → Derived*

```cpp
Derived* d2 = dynamic_cast<Derived*>(i);
```

**i = 0xA010** (Interface subobject)

**Generated IR:**
```llvm
%d2_raw = call i8* @__dynamic_cast(
    i8* %i,                     ; 0xA010
    i8* @RTTI_Interface,        ; Source
    i8* @RTTI_Derived,          ; Target
    i64 -1
)
```

**__dynamic_cast execution:**

**Step 1:** Get actual type
```cpp
void** vptr = *(void***)0xA010;
// vptr = 0xB110 (VT_D_Iface + 16)
type_info* actual = (type_info*)vptr[-1];
// actual = &RTTI_Derived
```

**Step 2:** Is target == actual?
```cpp
if (&RTTI_Derived == &RTTI_Derived) → TRUE!
```

**Step 3:** Apply offset-to-top
```cpp
ptrdiff_t offset_to_top = *(ptrdiff_t*)(vptr - 2);
// Read from 0xB100 (vptr - 16)
// offset_to_top = -16

return (char*)src_ptr + offset_to_top;
// return 0xA010 + (-16) = 0xA000
```

**Result:** `d2 = 0xA000` (points to start of Derived object)

**Verification:**
- `d2 == d` ✓
- `*(void**)d2` → 0xB010 (VT_D_Base) ✓

---

## Part 4: Edge Cases and Failures

### Private Inheritance

```cpp
class Base { virtual ~Base() {} };
class Derived : private Base {};  // private!

Derived* d = new Derived();
Base* b = dynamic_cast<Base*>(d);  // Compile error!
```

**Why fails:** Compile-time check. Private bases not accessible.

**In RTTI:** `offset_flags` encodes access level:
```
0x0 = private
0x1 = protected  
0x2 = public
```

`__dynamic_cast` checks this bit. If not public, returns nullptr.

---

### Ambiguous Cast

```cpp
class A { virtual ~A() {} };
class B : public A {};
class C : public A {};
class D : public B, public C {};  // Diamond, non-virtual!

D* d = new D();
A* a = dynamic_cast<A*>(d);  // Compile error: ambiguous
```

**Why:** D has TWO A subobjects (via B and via C).

**Memory:**
```
D object:
    B subobject:
        A subobject  ← A #1
    C subobject:
        A subobject  ← A #2
```

**Solution:** Use virtual inheritance or cast to B first:
```cpp
B* b = d;
A* a = dynamic_cast<A*>(b);  // OK, unambiguous
```

---

### Cast to void*

```cpp
Derived* d = new Derived();
void* v = dynamic_cast<void*>(d);
```

**Special case:** Returns pointer to most-derived object.

**Implementation:**
```cpp
// Just apply offset-to-top
void** vptr = *(void***)src_ptr;
ptrdiff_t offset = *(ptrdiff_t*)(vptr - 2);
return (char*)src_ptr + offset;
```

**Use case:** Get start address regardless of subobject pointer.

---

## Part 5: Performance and Optimization

### Cost of dynamic_cast

**Upcast:** Free (compile-time offset)
**Downcast/Cross-cast:**
- 1 vptr dereference (cache miss likely)
- 1-2 RTTI reads (another cache miss)
- Tree walk (linear in inheritance depth)

**Typical cost:** 50-200 CPU cycles

**Optimization 1:** Cache results
```cpp
// Bad: repeated dynamic_cast
for (...) {
    if (Derived* d = dynamic_cast<Derived*>(base)) {
        d->method();
    }
}

// Good: cast once
Derived* d = dynamic_cast<Derived*>(base);
if (d) {
    for (...) {
        d->method();
    }
}
```

**Optimization 2:** Avoid dynamic_cast in hot paths
```cpp
// Use visitor pattern or type enum instead
class Base {
    enum Type { TYPE_DERIVED1, TYPE_DERIVED2 };
    Type get_type() const { return type_; }
};
```

---

### Compiler Devirtualization

**If compiler proves exact type:**

```cpp
void foo() {
    Derived d;
    Base* b = &d;
    
    // Compiler knows b points to Derived
    Derived* d2 = dynamic_cast<Derived*>(b);
    // Optimized to: d2 = (Derived*)b; (no RTTI check!)
}
```

**Check optimization:**
```bash
clang++ -O2 -S -mllvm -print-after-all test.cpp 2>&1 | grep dynamic_cast
# If output is empty, dynamic_cast was elided
```

---

## Part 6: Debugging RTTI Issues

### Print Object Layout

```cpp
#include <cstdio>
#include <typeinfo>

void print_layout(void* obj) {
    void** vptr = *(void***)obj;
    printf("Object at: %p\n", obj);
    printf("VPtr:      %p\n", vptr);
    
    const std::type_info* ti = (std::type_info*)vptr[-1];
    printf("Type:      %s\n", ti->name());
    
    ptrdiff_t* offset = (ptrdiff_t*)(vptr - 2);
    printf("Offset-to-top: %ld\n", *offset);
}

int main() {
    Derived d;
    print_layout(&d);
    
    Interface* i = &d;
    print_layout(i);
}
```

**Output:**
```
Object at: 0x7ffc1234
VPtr:      0x55555678
Type:      7Derived
Offset-to-top: 0

Object at: 0x7ffc1244
VPtr:      0x55555788
Type:      7Derived
Offset-to-top: -16
```

---

### GDB Inspection

```bash
(gdb) p *(void***)obj         # Print vptr
(gdb) p **(void***)obj@5      # Print first 5 vtable entries
(gdb) p *(long*)(**(void***)obj - 2)  # offset-to-top
(gdb) p *(char**)(**(void***)obj - 1) # type_info name
```

---

### Verify Dynamic Cast

```cpp
#include <cassert>

Derived* d = new Derived();
Base* b = d;
Interface* i = d;

// These should all succeed
Derived* d1 = dynamic_cast<Derived*>(b);
assert(d1 == d);

Derived* d2 = dynamic_cast<Derived*>(i);
assert(d2 == d);

Interface* i2 = dynamic_cast<Interface*>(b);
assert(i2 == i);

// Address checks
assert((char*)i == (char*)d + 16);  // Interface is 16 bytes offset
```

---

## Summary

**RTTI enables dynamic_cast via:**
1. **VPtr** in objects → points to vtable
2. **VTable** has offset-to-top and type_info pointer
3. **type_info** has class name and base class info
4. **__dynamic_cast** walks inheritance tree using RTTI

**Key memory patterns:**
- Single inheritance: 1 vptr, simple offset
- Multiple inheritance: N vptrs (one per base with virtuals), thunks for adjustment
- Virtual inheritance: vbase_offset in vtable, shared base at end

**Cast types:**
- Upcast: compile-time, no RTTI
- Downcast: needs RTTI to verify actual type
- Cross-cast: needs RTTI to find path through most-derived

**Cost:** ~100 cycles, avoid in hot loops.

Questions on specific aspects?