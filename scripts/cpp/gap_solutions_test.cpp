#include <bits/stdc++.h>
using namespace std;
static int fails = 0;
#define CHECK(c) do { if (!(c)) { fails++; fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #c); } } while (0)

// LeetCode's Iterator base for the peeking iterator
class Iterator {
    vector<int> v; size_t i = 0;
public:
    Iterator(const vector<int>& nums) : v(nums) {}
    int next() { return v[i++]; }
    bool hasNext() const { return i < v.size(); }
};

#include "p106.inc"
#include "p107.inc"
#include "p108.inc"
#include "p109.inc"
#include "p110.inc"
#include "p111.inc"
#include "p112.inc"
#include "p113.inc"
#include "p114.inc"
#include "p115.inc"
#include "p116.inc"
#include "p117.inc"
#include "p118.inc"

int main() {
    // 106 skyline
    { vector<vector<int>> b = {{2,9,10},{3,7,15},{5,12,12},{15,20,10},{19,24,8}};
      vector<vector<int>> want = {{2,10},{3,15},{7,12},{12,0},{15,10},{20,8},{24,0}};
      CHECK(getSkyline(b) == want);
      vector<vector<int>> b2 = {{0,2,3},{2,5,3}};                  // touching buildings of equal height: no dip
      vector<vector<int>> w2 = {{0,3},{5,0}};
      CHECK(getSkyline(b2) == w2); }
    // 107 calendar III
    { MyCalendarThree c;
      CHECK(c.book(10,20)==1); CHECK(c.book(50,60)==1); CHECK(c.book(10,40)==2);
      CHECK(c.book(5,15)==3);  CHECK(c.book(5,10)==3);  CHECK(c.book(25,55)==3); }
    // 108 rotate
    { vector<vector<int>> a = {{1,2,3},{4,5,6},{7,8,9}}; rotate(a);
      vector<vector<int>> w = {{7,4,1},{8,5,2},{9,6,3}}; CHECK(a == w); }
    // 109 life
    { vector<vector<int>> b = {{0,1,0},{0,0,1},{1,1,1},{0,0,0}}; gameOfLife(b);
      vector<vector<int>> w = {{0,0,0},{1,0,1},{0,1,1},{0,1,0}}; CHECK(b == w); }
    // 110 calculator
    { auto ev = [](const string& s){ Solution so; return so.calculate(s); };
      CHECK(ev("1 + 1")==2); CHECK(ev(" 2-1 + 2 ")==3); CHECK(ev("(1+(4+5+2)-3)+(6+8)")==23);
      CHECK(ev("3+2*2")==7); CHECK(ev(" 3/2 ")==1); CHECK(ev(" 3+5 / 2 ")==5);
      CHECK(ev("2*(5+5*2)/3+(6/2+8)")==21); CHECK(ev("-(2+3)")==-5); CHECK(ev("6-4/2")==4);
      CHECK(ev("(2+6*3+5-(3*14/7+2)*5)+3")==-12); CHECK(ev("0")==0); CHECK(ev("-7/2")==-3); }
    // 111 peeking
    { PeekingIterator it({1,2,3});
      CHECK(it.peek()==1); CHECK(it.next()==1); CHECK(it.next()==2); CHECK(it.peek()==3);
      CHECK(it.hasNext()); CHECK(it.next()==3); CHECK(!it.hasNext()); }
    // 112 rate limiters
    { TokenBucket tb(1.0, 3.0); long long S = 1000000000LL;
      CHECK(tb.allow(0)); CHECK(tb.allow(0)); CHECK(tb.allow(0)); CHECK(!tb.allow(0));
      CHECK(!tb.allow(S/2)); CHECK(tb.allow(S)); CHECK(!tb.allow(S));
      CHECK(tb.allow(10*S)); CHECK(tb.allow(10*S)); CHECK(tb.allow(10*S)); CHECK(!tb.allow(10*S)); // burst cap
      SlidingLog sl(S, 2);
      CHECK(sl.allow(0)); CHECK(sl.allow(S/2)); CHECK(!sl.allow(S*9/10)); CHECK(sl.allow(S + S/10));
      Logger lg;
      CHECK(lg.shouldPrintMessage(1,"foo")); CHECK(lg.shouldPrintMessage(2,"bar")); CHECK(!lg.shouldPrintMessage(3,"foo"));
      CHECK(!lg.shouldPrintMessage(8,"bar")); CHECK(!lg.shouldPrintMessage(10,"foo")); CHECK(lg.shouldPrintMessage(11,"foo")); }
    // 113 consistent hashing
    { ConsistentHash ch(64); ch.addNode("A"); ch.addNode("B"); ch.addNode("C");
      const int N = 20000; vector<string> before(N);
      map<string,int> load;
      for (int i = 0; i < N; i++) { before[i] = ch.lookup("key" + to_string(i)); load[before[i]]++; }
      CHECK(load.size() == 3);
      for (auto& [n, c] : load) CHECK(c > N/3/2 && c < N/3*2);        // reasonably balanced
      ch.removeNode("B");
      int moved = 0, movedFromNonB = 0;
      for (int i = 0; i < N; i++) { string now = ch.lookup("key" + to_string(i));
        if (now != before[i]) { moved++; if (before[i] != "B") movedFromNonB++; } }
      CHECK(movedFromNonB == 0);                                        // only B's keys moved
      CHECK(moved == load["B"]);
      ch.addNode("B");
      auto r = ch.replicas("key1", 2); CHECK(r.size()==2 && r[0]!=r[1]);
      auto r3 = ch.replicas("key1", 5); CHECK(r3.size()==3); }         // only 3 distinct nodes exist
    // 114 LRU + TTL
    { LRUWithTTL c(2);
      c.put(1,1,0,10); c.put(2,2,0,10);
      CHECK(c.get(1,5)==1); c.put(3,3,5,10);                            // evicts 2 (LRU)
      CHECK(c.get(2,5)==-1); CHECK(c.get(3,5)==3);
      CHECK(c.get(1,11)==-1);                                           // expired at 10
      CHECK(c.get(3,12)==3);                                          // [3], expires 15
      c.put(4,4,12,100);                                              // [4,3], 4 expires 112
      c.put(5,5,20,10);                                               // tail 3 is expired: drained, so 4 must survive
      CHECK(c.get(4,20)==4); CHECK(c.get(5,20)==5); CHECK(c.get(3,20)==-1); }
    // 115 bits
    { vector<int> w = {0,1,1,2,1,2}; CHECK(countBits(5)==w);
      unsigned x = 0b0011; auto gosper = [](unsigned x){ unsigned c = x & -x; unsigned r = x + c; return (((r ^ x) >> 2) / c) | r; };
      x = gosper(x); CHECK(x == 0b0101); x = gosper(x); CHECK(x == 0b0110); x = gosper(x); CHECK(x == 0b1001); }
    // 116 pow
    { CHECK(myPow(2,10)==1024); CHECK(fabs(myPow(2,-2)-0.25)<1e-12); CHECK(myPow(2, INT_MIN) == 0.0);
      CHECK(fabs(myPow(1.00001, 123456) - pow(1.00001, 123456)) < 1e-6);
      CHECK(modpow(2,10,1000)==24); CHECK(modpow(5,0,7)==1); CHECK(modpow(5,3,1)==0);
      long long M = 1000000007LL, naive = 1; for (int i = 0; i < 200; i++) naive = naive * 3 % M;
      CHECK(modpow(3,200,M)==naive);
      unsigned long long big = (1ULL<<61) - 1;                             // Mersenne prime, needs 128-bit products
      CHECK(modpow(2, big - 1, big) == 1);                                 // Fermat
      CHECK(gcd_(48,18)==6); CHECK(gcd_(17,0)==17); }
    // 117 ring
    { Ring<int,4> r; CHECK(r.empty());
      CHECK(r.push_back(1)); CHECK(r.push_back(2)); CHECK(r.push_back(3)); CHECK(r.push_back(4));
      CHECK(r.full()); CHECK(!r.push_back(5));
      int v; CHECK(r.pop_front(v) && v==1); CHECK(r.push_front(0)); CHECK(r.front()==0); CHECK(r.back()==4); CHECK(r.size()==4);
      CHECK(r.pop_back(v) && v==4); CHECK(r.pop_front(v) && v==0); CHECK(r.pop_front(v) && v==2); CHECK(r.pop_front(v) && v==3);
      CHECK(r.empty()); CHECK(!r.pop_front(v));
      for (int i = 0; i < 100000; i++) { CHECK(r.push_back(i)); CHECK(r.pop_front(v) && v == i); }   // index wrap stress
      CHECK(r.push_front(7)); CHECK(r.push_front(6)); CHECK(r.pop_back(v) && v==7); CHECK(r.pop_back(v) && v==6);
      MovingAverage ma(3);
      CHECK(fabs(ma.next(1)-1)<1e-12); CHECK(fabs(ma.next(10)-5.5)<1e-12);
      CHECK(fabs(ma.next(3)-14.0/3)<1e-12); CHECK(fabs(ma.next(5)-6)<1e-12); }
    // 118 timer wheel
    { TimerWheel w(8); map<int,int> firedAt; int t = 0;
      auto arm = [&](int d, int tag){ return w.add(d, [&,tag]{ firedAt[tag] = t; }); };
      arm(1,1); arm(8,8); arm(9,9); arm(16,16); arm(0,0); arm(7,7); auto c = arm(5,5);
      CHECK(w.cancel(c)); CHECK(!w.cancel(c));
      for (t = 1; t <= 20; t++) w.tick();
      CHECK(firedAt[1]==1); CHECK(firedAt[8]==8); CHECK(firedAt[9]==9); CHECK(firedAt[16]==16);
      CHECK(firedAt[0]==1); CHECK(firedAt[7]==7); CHECK(!firedAt.count(5));
      // a callback that arms another timer during tick
      t = 0; TimerWheel w2(4); int a = -1, b = -1;
      w2.add(2, [&]{ a = t; w2.add(3, [&]{ b = t; }); });
      for (t = 1; t <= 10; t++) w2.tick();
      CHECK(a==2); CHECK(b==5); }

    if (fails) { fprintf(stderr, "\n%d CHECKS FAILED\n", fails); return 1; }
    puts("ALL 13 SOLUTIONS PASS");
    return 0;
}
