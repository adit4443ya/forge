#include <bits/stdc++.h>
using namespace std;
static int fails = 0;
#define CHECK(c) do { if (!(c)) { fails++; fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #c); } } while (0)
#include "p119.inc"
#include "p120.inc"
#include "p121.inc"
#include "p122.inc"

static int naiveFind(const string& t, const string& p) {
    if (p.empty()) return 0;
    for (size_t i = 0; i + p.size() <= t.size(); i++) if (!t.compare(i, p.size(), p)) return (int)i;
    return -1;
}
int main() {
    mt19937 rng(20260905);
    // ── 119 KMP ──
    { CHECK(strStr("sadbutsad","sad")==0); CHECK(strStr("leetcode","leeto")==-1);
      CHECK(strStr("hello","ll")==2); CHECK(strStr("aaa","a")==0); CHECK(strStr("abc","")==0);
      CHECK(strStr("aaaaab","aaab")==2); CHECK(strStr("mississippi","issip")==4);
      vector<int> l = buildLps("aabaaab"); vector<int> w = {0,1,0,1,2,2,3}; CHECK(l==w);
      CHECK(buildLps("aaaa")==(vector<int>{0,1,2,3}));
      // period via lps: "abcabcabc" has period 3
      { string s="abcabcabc"; auto z=buildLps(s); CHECK((int)s.size()-z.back()==3 && s.size()%3==0); }
      for (int t = 0; t < 3000; t++) {                      // random differential vs naive
          string txt, pat; int n = rng()%14, m = 1+rng()%4;
          for (int i=0;i<n;i++) txt += char('a'+rng()%3);
          for (int i=0;i<m;i++) pat += char('a'+rng()%3);
          CHECK(strStr(txt,pat)==naiveFind(txt,pat));
      } }
    // ── 120 Z + rolling hash ──
    { auto z = zArray("aabxaayaab"); CHECK(z[0]==10); CHECK(z[1]==1); CHECK(z[4]==2); CHECK(z[7]==3);
      CHECK(zArray("aaaaa")==(vector<int>{5,4,3,2,1}));
      // Z-based search agrees with naive
      for (int t = 0; t < 2000; t++) {
          string txt, pat; int n = rng()%14, m = 1+rng()%4;
          for (int i=0;i<n;i++) txt += char('a'+rng()%3);
          for (int i=0;i<m;i++) pat += char('a'+rng()%3);
          string c = pat + '\x01' + txt; auto zz = zArray(c);
          int first = -1;
          for (size_t i = pat.size()+1; i < c.size(); i++) if (zz[i] >= (int)pat.size()) { first = (int)(i - pat.size() - 1); break; }
          CHECK(first == naiveFind(txt, pat));
      }
      // rolling hash: equal substrings hash equal, and it agrees with real comparison
      { string s = "abracadabraabracadabra";
        mt19937_64 r64(12345);
        unsigned long long base = 131 + 2*(r64() % ((RollingHash::M - 300)/2));
        RollingHash rh(s, base);
        CHECK(rh.get(0,7) == rh.get(11,18));                 // "abracad" twice
        int agree = 0, total = 0;
        for (size_t i=0;i<s.size();i++) for (size_t j=i+1;j<=s.size();j++)
          for (size_t k=0;k+ (j-i) <= s.size(); k++) {
            bool same = (s.compare(i,j-i,s,k,j-i)==0);
            bool h = (rh.get(i,j) == rh.get(k,k+(j-i)));
            total++; if (same==h) agree++;
          }
        CHECK(agree == total);                               // no collisions on this input
        printf("  hash agreement: %d/%d\n", agree, total); } }
    // ── 121 sliding median ──
    { auto approx=[](const vector<double>&a,const vector<double>&b){
        if(a.size()!=b.size())return false; for(size_t i=0;i<a.size();i++) if(fabs(a[i]-b[i])>1e-9) return false; return true; };
      vector<int> v1={1,3,-1,-3,5,3,6,7};
      vector<double> w1={1,-1,-1,3,5,6}; { auto g=medianSlidingWindow(v1,3); CHECK(approx(g,w1)); }
      vector<int> v2={1,2,3,4,2,3,1,4,2}; vector<double> w2={2.5,2.5,3.0,2.5,2.5,2.5};
      { auto g=medianSlidingWindow(v2,4); CHECK(approx(g,w2)); }
      { vector<int> v={1,4,2,3}; vector<double> w={1,4,2,3}; auto g=medianSlidingWindow(v,1); CHECK(approx(g,w)); }
      { vector<int> v={INT_MAX,INT_MAX}; auto g=medianSlidingWindow(v,2);   // the overflow trap
        CHECK(g.size()==1 && fabs(g[0]-(double)INT_MAX)<1e-6); }
      { vector<int> v={2147483647,-2147483648}; auto g=medianSlidingWindow(v,2);
        CHECK(g.size()==1 && fabs(g[0]-(-0.5))<1e-6); }
      for (int t=0;t<800;t++) {                              // differential vs sort-the-window
          int n=1+rng()%12, k=1+rng()%n; vector<int> a(n);
          for (auto& x:a) x=(int)(rng()%21)-10;
          auto got=medianSlidingWindow(a,k); vector<double> want;
          for (int i=0;i+k<=n;i++){ vector<int> w(a.begin()+i,a.begin()+i+k); sort(w.begin(),w.end());
            want.push_back(k&1? (double)w[k/2] : ((double)w[k/2-1]+(double)w[k/2])/2.0); }
          CHECK(approx(got,want));
      } }
    // ── 122 geometry ──
    { CHECK(cross({0,0},{1,0},{0,1})==1); CHECK(cross({0,0},{0,1},{1,0})==-1); CHECK(cross({0,0},{1,1},{2,2})==0);
      { vector<P> pts={{0,0},{1,1},{2,2},{2,0},{0,2}}; auto h=convexHull(pts); CHECK(h.size()==4); }
      { vector<P> sq={{0,0},{0,3},{3,3},{3,0}}; CHECK((long long)llabs((long long)area2(sq))==18); }
      { vector<P> pts={{0,0},{3,0},{0,4}}; CHECK(closestPair(pts)==9); }
      { vector<P> pts={{0,0},{1,0},{5,5},{5,6},{100,100}}; CHECK(closestPair(pts)==1); }
      { long long B=1000000000LL; vector<P> big={{-B,-B},{B,-B},{B,B},{-B,B},{0,0}};
        auto h=convexHull(big); CHECK(h.size()==4); CHECK(llabs((long long)(area2(h)/2))==4000000000000000000LL); }
      for (int t=0;t<400;t++) {                              // hull vs brute force, closest pair vs O(n^2)
          int n=2+rng()%9; vector<P> pts(n);
          for (auto& p:pts) p={(long long)(rng()%13)-6,(long long)(rng()%13)-6};
          long long brute=LLONG_MAX;
          for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){ long long dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
            if(dx||dy) brute=min(brute,dx*dx+dy*dy); else brute=0; }
          CHECK(closestPair(pts)==brute);
          auto h=convexHull(pts);
          for (auto& p:pts) {                                // every point is inside or on the hull
            if (h.size()<3) continue; bool inside=true;
            for (size_t i=0;i<h.size();i++) if (cross(h[i],h[(i+1)%h.size()],p) < 0) inside=false;
            CHECK(inside);
          }
      } }
    if (fails) { fprintf(stderr, "\n%d CHECKS FAILED\n", fails); return 1; }
    puts("ALL 4 SOLUTIONS PASS");
    return 0;
}
