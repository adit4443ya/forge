#include <bits/stdc++.h>
using namespace std;
static int fails = 0;
#define CHECK(c) do { if(!(c)){ fails++; fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#c);} } while(0)

#include "p123.inc"
#include "p124.inc"
#include "p125.inc"
#include "p126.inc"
#include "p127.inc"
// 128 declares requestSnapshot() without a definition; give it one before including.

#include "p128.inc"
void BookFeed::requestSnapshot() {}

int main(){
  mt19937 rng(20260906);
  // ── 123 windowed dedup ──
  { const uint64_t W = 1000; WindowDedup d(W, 4);
    CHECK(!d.seenBefore(7, 0)); CHECK(d.seenBefore(7, 10)); CHECK(d.seenBefore(7, 700));
    CHECK(!d.seenBefore(7, 5000));                        // long past the window: forgotten
    WindowDedup d2(W, 4);
    for (uint64_t t = 0; t < 4000; t += 37) d2.seenBefore(t, t);
    CHECK(!d2.seenBefore(999999, 4000));
    // never remembers longer than W*(1+1/k), never shorter than W
    WindowDedup d3(1000, 4);
    CHECK(!d3.seenBefore(1, 0));
    CHECK(d3.seenBefore(1, 999));                          // inside the window: must remember
    CHECK(!d3.seenBefore(2, 1300));
    WindowDedup d4(1000, 4);
    CHECK(!d4.seenBefore(5, 0)); CHECK(!d4.seenBefore(5, 1251)); }  // past W*(1+1/k): may forget
  // ── 124 exchange-argument scheduling ──
  { vector<pair<long long,long long>> jobs = {{3,1},{1,2},{2,3}};
    // brute force every permutation
    auto cost=[&](vector<pair<long long,long long>> v){ long long c=0,t=0; for(auto&[a,b]:v){t+=a;c+=b*t;} return c; };
    vector<pair<long long,long long>> best=jobs; sort(best.begin(),best.end());
    long long bc=LLONG_MAX; do { bc=min(bc,cost(best)); } while(next_permutation(best.begin(),best.end()));
    CHECK(minWeightedCompletion(jobs)==bc);
    for(int t=0;t<300;t++){                                 // differential vs brute force
      int n=1+rng()%6; vector<pair<long long,long long>> v(n);
      for(auto&p:v) p={(long long)(1+rng()%9),(long long)(1+rng()%9)};
      auto s=v; sort(s.begin(),s.end()); long long b=LLONG_MAX;
      do { b=min(b,cost(s)); } while(next_permutation(s.begin(),s.end()));
      CHECK(minWeightedCompletion(v)==b); } }
  // ── 125 distinct-count sketch ──
  { for (int n : {100, 5000, 200000}) {
      DistinctCount dc(1024);
      for (int i=0;i<n;i++) dc.add((uint64_t)i*2654435761u);
      for (int i=0;i<n;i++) dc.add((uint64_t)i*2654435761u);   // duplicates must not count
      double e=dc.estimate(), err=fabs(e-n)/n;
      printf("  distinct n=%-7d est=%-10.0f err=%.2f%%\n", n, e, err*100);
      CHECK(err < 0.15); }
    DistinctCount few(1024); for(int i=0;i<50;i++) few.add(i);
    CHECK(fabs(few.estimate()-50)<1e-9); }                  // below k it is exact
  // ── 126 maximal rectangle ──
  { { vector<int> h={2,1,5,6,2,3}; CHECK(largestRectangleHistogram(h)==10); }
    { vector<int> h={2,4}; CHECK(largestRectangleHistogram(h)==4); }
    { vector<int> h={}; CHECK(largestRectangleHistogram(h)==0); }
    vector<vector<char>> m={{'1','0','1','0','0'},{'1','0','1','1','1'},{'1','1','1','1','1'},{'1','0','0','1','0'}};
    CHECK(maximalRectangle(m)==6);
    vector<vector<char>> z={{'0'}}; CHECK(maximalRectangle(z)==0);
    vector<vector<char>> o={{'1'}}; CHECK(maximalRectangle(o)==1);
    for(int t=0;t<300;t++){                                  // differential vs O(n^4) brute force
      int R=1+rng()%5,C=1+rng()%5; vector<vector<char>> g(R,vector<char>(C));
      for(auto&r:g) for(auto&c:r) c = (rng()%2)?'1':'0';
      int brute=0;
      for(int r1=0;r1<R;r1++)for(int c1=0;c1<C;c1++)for(int r2=r1;r2<R;r2++)for(int c2=c1;c2<C;c2++){
        bool all=true; for(int a=r1;a<=r2&&all;a++)for(int b=c1;b<=c2&&all;b++) if(g[a][b]!='1') all=false;
        if(all) brute=max(brute,(r2-r1+1)*(c2-c1+1)); }
      auto copy=g; CHECK(maximalRectangle(copy)==brute); } }
  // ── 127 binary search the answer ──
  { vector<int> a={7,2,5,10,8}; CHECK(splitArray(a,2)==18);
    vector<int> b={1,2,3,4,5};  CHECK(splitArray(b,2)==9);
    vector<int> c={1,4,4};      CHECK(splitArray(c,3)==4);
    vector<int> d={5};          CHECK(splitArray(d,1)==5);
    for(int t=0;t<300;t++){                                  // differential vs DP
      int n=1+rng()%7,k=1+rng()%n; vector<int> v(n);
      for(auto&x:v) x=rng()%20;
      vector<vector<long long>> dp(n+1, vector<long long>(k+1, LLONG_MAX));
      vector<long long> pre(n+1,0); for(int i=0;i<n;i++) pre[i+1]=pre[i]+v[i];
      dp[0][0]=0;
      for(int i=1;i<=n;i++)for(int j=1;j<=k;j++)for(int p=0;p<i;p++)
        if(dp[p][j-1]!=LLONG_MAX) dp[i][j]=min(dp[i][j],max(dp[p][j-1],pre[i]-pre[p]));
      CHECK(splitArray(v,k)==(int)dp[n][k]); } }
  // ── 128 book feed state machine ──
  { BookFeed f;
    CHECK(!f.isLive());                                      // starts syncing, must not quote
    f.onSnapshot(0, {{100,5}}, {{101,7}});
    CHECK(f.isLive());
    f.onUpdate({1,true,100,9}); CHECK(f.isLive());            // in order
    f.onUpdate({3,true,99,4});  CHECK(!f.isLive());           // gap: must stop quoting
    f.onUpdate({2,true,100,0}); CHECK(!f.isLive());           // fills the hole but stays gapped
    f.onSnapshot(3, {{99,4}}, {{101,7}});                     // recovery
    CHECK(f.isLive());
    f.onUpdate({4,false,102,1}); CHECK(f.isLive());
    f.onUpdate({2,true,1,1});   CHECK(f.isLive()); }          // stale duplicate ignored, stays live
  if(fails){ fprintf(stderr,"\n%d CHECKS FAILED\n",fails); return 1; }
  puts("ALL 6 ELITE SOLUTIONS PASS");
  return 0;
}
