"use client";
// ═══════════════════════════════════════════════════════════════════
//  DSA Practice — Complete Data File
//  84 problems | 12 C++ deep-dive concepts | 6 tip sets
//  Sep 2026: 8 duplicate entries removed; unverifiable "company" labels dropped.
//  Each problem has TWO orthogonal axes:
//    difficulty: "Easy" | "Medium" | "Hard"   (intrinsic problem hardness)
//    frequency:  "High"  | "Medium" | "Low"    (how often it shows up in interviews)
// ═══════════════════════════════════════════════════════════════════

export const PROBLEMS = [

  // ══════════════════════════════
  //  DP — KNAPSACK  (ids 1–5)
  // ══════════════════════════════
  {
    id: 1, section: "DP — Knapsack", title: "Partition Equal Subset Sum",
    difficulty: "Medium", frequency: "High", leetcode: 416,
    pattern: "0/1 Knapsack — Boolean",
    intuition: "Reduce to: does a subset exist with sum = totalSum/2? This is a classic 0/1 knapsack. dp[s] = can we achieve sum s? For each num, iterate sums BACKWARDS (critical: prevents reuse). If total is odd → false immediately.",
    keyInsight: "Reverse inner loop = 0/1 knapsack (each element once). Forward inner loop = unbounded knapsack (element reusable). This single distinction separates two entire problem families.",
    approach: "1) Check if total is odd → false. 2) target = total/2. 3) dp[0]=true. 4) For each num, reverse loop s from target to num: dp[s] |= dp[s-num]. 5) Return dp[target].",
    complexity: "Time: O(N × sum/2) | Space: O(sum/2)",
    memoCode: `// TOP-DOWN: recursive + memoization
bool solve(int i, int t, vector<int>& nums, vector<vector<int>>& memo) {
    if (t == 0) return true;
    if (i < 0 || t < 0) return false;
    if (memo[i][t] != -1) return memo[i][t];
    return memo[i][t] = solve(i-1, t, nums, memo)
                      || solve(i-1, t - nums[i], nums, memo);
}

bool canPartition(vector<int>& nums) {
    int total = accumulate(nums.begin(), nums.end(), 0);
    if (total % 2 != 0) return false;
    int target = total / 2, n = nums.size();
    vector<vector<int>> memo(n, vector<int>(target+1, -1));
    return solve(n-1, target, nums, memo);
}`,
    tabCode: `// BOTTOM-UP: tabulation (0/1 Knapsack)
bool canPartition(vector<int>& nums) {
    int total = accumulate(nums.begin(), nums.end(), 0);
    if (total % 2 != 0) return false;
    int target = total / 2;

    vector<bool> dp(target + 1, false);
    dp[0] = true;

    for (int num : nums)
        for (int s = target; s >= num; s--)  // REVERSE = 0/1
            dp[s] = dp[s] || dp[s - num];

    return dp[target];
}`,
  },
  {
    id: 2, section: "DP — Knapsack", title: "Target Sum",
    difficulty: "Medium", frequency: "Medium", leetcode: 494,
    pattern: "0/1 Knapsack — Count subsets with difference",
    intuition: "Assign + or − to each number to reach target S. Let P = sum of positives, N = sum of negatives. P − N = S AND P + N = total → P = (S + total)/2. Now count subsets summing to P.",
    keyInsight: "Many ±-assignment problems reduce to subset sum via: positiveSubset = (target + total) / 2. Always check (target+total) is even and non-negative before proceeding.",
    approach: "1) Compute newTarget = (target + total) / 2. 2) Validate. 3) dp[0]=1. 4) Reverse loop: dp[s] += dp[s-num]. 5) Return dp[newTarget].",
    complexity: "Time: O(N × target) | Space: O(target)",
    memoCode: `// TOP-DOWN with map memo (handles negative sums)
unordered_map<string, int> memo;

int solve(int i, int rem, vector<int>& nums) {
    if (i == nums.size()) return rem == 0 ? 1 : 0;
    string key = to_string(i) + "," + to_string(rem);
    if (memo.count(key)) return memo[key];
    return memo[key] = solve(i+1, rem - nums[i], nums)
                     + solve(i+1, rem + nums[i], nums);
}

int findTargetSumWays(vector<int>& nums, int target) {
    return solve(0, target, nums);
}`,
    tabCode: `// BOTTOM-UP: reduce to subset-count knapsack
int findTargetSumWays(vector<int>& nums, int target) {
    int total = accumulate(nums.begin(), nums.end(), 0);
    if (abs(target) > total) return 0;
    if ((total + target) % 2 != 0) return 0;

    int newTarget = (total + target) / 2;
    vector<int> dp(newTarget + 1, 0);
    dp[0] = 1;

    for (int num : nums)
        for (int s = newTarget; s >= num; s--)
            dp[s] += dp[s - num];
    return dp[newTarget];
}`,
  },
  {
    id: 3, section: "DP — Knapsack", title: "Coin Change (Minimum Coins)",
    difficulty: "Medium", frequency: "High", leetcode: 322,
    pattern: "Unbounded Knapsack — Minimize",
    intuition: "Each coin can be used unlimited times → unbounded knapsack. dp[a] = min coins for amount a. FORWARD loop allows reuse. dp[a] = min(dp[a], dp[a-coin]+1). Init dp[0]=0, rest=INF.",
    keyInsight: "Forward inner loop allows unlimited reuse (unbounded). This is the ONLY structural difference from 0/1 knapsack. For counting combinations vs permutations, the outer loop order matters.",
    approach: "1) dp init INT_MAX. 2) dp[0]=0. 3) For each coin, forward loop: dp[a] = min(dp[a], dp[a-coin]+1). 4) Return dp[amount] or -1.",
    complexity: "Time: O(N × amount) | Space: O(amount)",
    memoCode: `// TOP-DOWN: min coins via memoization
int solve(vector<int>& coins, int amt, vector<int>& memo) {
    if (amt == 0) return 0;
    if (amt < 0)  return INT_MAX;
    if (memo[amt] != -1) return memo[amt];
    int res = INT_MAX;
    for (int coin : coins) {
        int sub = solve(coins, amt - coin, memo);
        if (sub != INT_MAX) res = min(res, 1 + sub);
    }
    return memo[amt] = res;
}

int coinChange(vector<int>& coins, int amount) {
    vector<int> memo(amount + 1, -1);
    int ans = solve(coins, amount, memo);
    return ans == INT_MAX ? -1 : ans;
}`,
    tabCode: `// BOTTOM-UP: unbounded knapsack (forward loop)
int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;

    for (int coin : coins)
        for (int a = coin; a <= amount; a++)  // FORWARD = reuse allowed
            if (dp[a - coin] != INT_MAX)
                dp[a] = min(dp[a], dp[a - coin] + 1);

    return dp[amount] == INT_MAX ? -1 : dp[amount];
}`,
  },
  {
    id: 4, section: "DP — Knapsack", title: "Coin Change II (Count Combinations)",
    difficulty: "Medium", frequency: "Medium", leetcode: 518,
    pattern: "Unbounded Knapsack — Count combinations",
    intuition: "Count COMBINATIONS (not permutations). Outer loop = coins, inner = amounts. This ensures [1,2] and [2,1] are counted once. Swap the loop order → you count permutations (LC 377).",
    keyInsight: "Outer=coins, Inner=amounts → combinations. Outer=amounts, Inner=coins → permutations. Critical interview distinction that trips many candidates.",
    approach: "1) dp[0]=1. 2) Outer loop: each coin. 3) Inner loop: amount from coin to target (forward). 4) dp[a] += dp[a-coin].",
    complexity: "Time: O(N × amount) | Space: O(amount)",
    memoCode: `// TOP-DOWN: fix coin index to avoid permutation counting
int solve(vector<int>& coins, int amt, int idx, vector<vector<int>>& memo) {
    if (amt == 0) return 1;
    if (amt < 0 || idx == (int)coins.size()) return 0;
    if (memo[idx][amt] != -1) return memo[idx][amt];
    return memo[idx][amt] = solve(coins, amt - coins[idx], idx, memo)
                           + solve(coins, amt, idx + 1, memo);
}

int change(int amount, vector<int>& coins) {
    int n = coins.size();
    vector<vector<int>> memo(n, vector<int>(amount+1, -1));
    return solve(coins, amount, 0, memo);
}`,
    tabCode: `// BOTTOM-UP: outer=coins ensures combinations
int change(int amount, vector<int>& coins) {
    vector<int> dp(amount + 1, 0);
    dp[0] = 1;

    for (int coin : coins)           // OUTER = coins → COMBINATIONS
        for (int a = coin; a <= amount; a++)
            dp[a] += dp[a - coin];

    return dp[amount];
}`,
  },
  {
    id: 5, section: "DP — Knapsack", title: "Last Stone Weight II",
    difficulty: "Medium", frequency: "Low", leetcode: 1049,
    pattern: "0/1 Knapsack — Minimize difference",
    intuition: "Smash stones optimally. Each stone gets + or − sign. Minimize |total - 2*S| where S is a subset sum ≤ total/2. Maximize S such that S ≤ total/2. Same as Partition Subset Sum generalization.",
    keyInsight: "Any 'minimize difference of two groups' problem reduces to: maximize subset sum ≤ total/2, then answer = total - 2*maxSubset. Core knapsack insight.",
    approach: "1) dp[0..target] where target=total/2. 2) Reverse loop knapsack. 3) Find largest reachable s ≤ target. 4) Return total - 2*s.",
    complexity: "Time: O(N × sum/2) | Space: O(sum/2)",
    memoCode: `// TOP-DOWN: maximize subset sum ≤ total/2
int solve(int i, int t, vector<int>& s, vector<vector<int>>& memo) {
    if (i < 0 || t <= 0) return 0;
    if (memo[i][t] != -1) return memo[i][t];
    int skip = solve(i-1, t, s, memo);
    int take = (s[i] <= t) ? s[i] + solve(i-1, t-s[i], s, memo) : 0;
    return memo[i][t] = max(skip, take);
}

int lastStoneWeightII(vector<int>& stones) {
    int total = accumulate(stones.begin(), stones.end(), 0);
    int target = total / 2, n = stones.size();
    vector<vector<int>> memo(n, vector<int>(target+1, -1));
    return total - 2 * solve(n-1, target, stones, memo);
}`,
    tabCode: `// BOTTOM-UP: maximize reachable subset sum
int lastStoneWeightII(vector<int>& stones) {
    int total = accumulate(stones.begin(), stones.end(), 0);
    int target = total / 2;
    vector<bool> dp(target + 1, false);
    dp[0] = true;

    for (int s : stones)
        for (int j = target; j >= s; j--)
            dp[j] = dp[j] || dp[j - s];

    for (int j = target; j >= 0; j--)
        if (dp[j]) return total - 2 * j;
    return total;
}`,
  },

  // ══════════════════════════════
  //  DP — STRING  (ids 6–11)
  // ══════════════════════════════
  {
    id: 6, section: "DP — String", title: "Edit Distance",
    difficulty: "Hard", frequency: "High", leetcode: 72,
    pattern: "Two-string alignment DP",
    intuition: "dp[i][j] = min ops to convert word1[0..i-1] to word2[0..j-1]. Match → free (diagonal). Otherwise 1 + min of: INSERT (left), DELETE (top), REPLACE (diagonal). Classic 2D string DP.",
    keyInsight: "The 3 ops map to 3 DP grid neighbors: left=insert, top=delete, diagonal=replace. This 2D recurrence appears in LCS, wildcard, regex — learn once, apply everywhere.",
    approach: "1) Init dp[i][0]=i, dp[0][j]=j. 2) Fill row-by-row. 3) Match → diagonal. Mismatch → 1 + min(3 neighbors).",
    complexity: "Time: O(M×N) | Space: O(M×N), optimizable to O(N)",
    memoCode: `// TOP-DOWN: 2D memoization
int solve(string& w1, string& w2, int i, int j, vector<vector<int>>& memo) {
    if (i == 0) return j;
    if (j == 0) return i;
    if (memo[i][j] != -1) return memo[i][j];
    if (w1[i-1] == w2[j-1])
        return memo[i][j] = solve(w1, w2, i-1, j-1, memo);
    return memo[i][j] = 1 + min({
        solve(w1, w2, i,   j-1, memo),
        solve(w1, w2, i-1, j,   memo),
        solve(w1, w2, i-1, j-1, memo)
    });
}

int minDistance(string word1, string word2) {
    int m = word1.size(), n = word2.size();
    vector<vector<int>> memo(m+1, vector<int>(n+1, -1));
    return solve(word1, word2, m, n, memo);
}`,
    tabCode: `// BOTTOM-UP: 2D tabulation
int minDistance(string word1, string word2) {
    int m = word1.size(), n = word2.size();
    vector<vector<int>> dp(m+1, vector<int>(n+1, 0));
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (word1[i-1] == word2[j-1])
                dp[i][j] = dp[i-1][j-1];
            else
                dp[i][j] = 1 + min({dp[i-1][j], dp[i][j-1], dp[i-1][j-1]});
        }
    }
    return dp[m][n];
}`,
  },
  {
    id: 7, section: "DP — String", title: "Longest Common Subsequence",
    difficulty: "Medium", frequency: "High", leetcode: 1143,
    pattern: "Two-string matching DP",
    intuition: "dp[i][j] = LCS of text1[0..i-1] and text2[0..j-1]. Match → diagonal + 1. No match → max of skipping one char from either side. Foundation of many string DP problems.",
    keyInsight: "LCS is a building block: SCS length = m+n-LCS. Edit distance (insert/delete only) = m+n-2*LCS. Longest palindromic subsequence = LCS(s, reverse(s)).",
    approach: "1) 2D dp of (m+1)×(n+1). 2) Match → dp[i-1][j-1]+1. No match → max(dp[i-1][j], dp[i][j-1]).",
    complexity: "Time: O(M×N) | Space: O(M×N)",
    memoCode: `// TOP-DOWN: recursive LCS with memoization
int solve(string& s1, string& s2, int i, int j, vector<vector<int>>& memo) {
    if (i < 0 || j < 0) return 0;
    if (memo[i][j] != -1) return memo[i][j];
    if (s1[i] == s2[j])
        return memo[i][j] = 1 + solve(s1, s2, i-1, j-1, memo);
    return memo[i][j] = max(solve(s1, s2, i-1, j, memo),
                            solve(s1, s2, i, j-1, memo));
}

int longestCommonSubsequence(string text1, string text2) {
    int m = text1.size(), n = text2.size();
    vector<vector<int>> memo(m, vector<int>(n, -1));
    return solve(text1, text2, m-1, n-1, memo);
}`,
    tabCode: `// BOTTOM-UP: 2D tabulation
int longestCommonSubsequence(string text1, string text2) {
    int m = text1.size(), n = text2.size();
    vector<vector<int>> dp(m+1, vector<int>(n+1, 0));

    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            if (text1[i-1] == text2[j-1])
                dp[i][j] = dp[i-1][j-1] + 1;
            else
                dp[i][j] = max(dp[i-1][j], dp[i][j-1]);

    return dp[m][n];
}`,
  },
  {
    id: 8, section: "DP — String", title: "Longest Palindromic Subsequence",
    difficulty: "Medium", frequency: "Medium", leetcode: 516,
    pattern: "Interval DP / Reverse LCS trick",
    intuition: "Two approaches: (1) LPS(s) = LCS(s, reverse(s)). (2) Interval DP: dp[i][j] = LPS in s[i..j]. Match endpoints → inner + 2. Else max of excluding either end. Fill by increasing gap.",
    keyInsight: "Interval DP fills diagonally (by increasing gap). Same fill order: Stone Game, Burst Balloons, Matrix Chain. Base: dp[i][i]=1 (single char).",
    approach: "1) dp[i][i]=1. 2) For gap 1..n-1: if s[i]==s[j] → dp[i+1][j-1]+2; else max(dp[i+1][j], dp[i][j-1]).",
    complexity: "Time: O(N²) | Space: O(N²)",
    memoCode: `// TOP-DOWN: interval DP with memoization
int solve(string& s, int i, int j, vector<vector<int>>& memo) {
    if (i > j) return 0;
    if (i == j) return 1;
    if (memo[i][j] != -1) return memo[i][j];
    if (s[i] == s[j])
        return memo[i][j] = 2 + solve(s, i+1, j-1, memo);
    return memo[i][j] = max(solve(s, i+1, j, memo), solve(s, i, j-1, memo));
}

int longestPalindromeSubseq(string s) {
    int n = s.size();
    vector<vector<int>> memo(n, vector<int>(n, -1));
    return solve(s, 0, n-1, memo);
}`,
    tabCode: `// BOTTOM-UP: fill by increasing gap (interval DP)
int longestPalindromeSubseq(string s) {
    int n = s.size();
    vector<vector<int>> dp(n, vector<int>(n, 0));
    for (int i = 0; i < n; i++) dp[i][i] = 1;

    for (int gap = 1; gap < n; gap++) {
        for (int i = 0; i + gap < n; i++) {
            int j = i + gap;
            if (s[i] == s[j]) dp[i][j] = dp[i+1][j-1] + 2;
            else dp[i][j] = max(dp[i+1][j], dp[i][j-1]);
        }
    }
    return dp[0][n-1];
}`,
  },
  {
    id: 9, section: "DP — String", title: "Wildcard Matching",
    difficulty: "Hard", frequency: "Medium", leetcode: 44,
    pattern: "Two-string pattern DP",
    intuition: "'?' matches one char. '*' matches any sequence. dp[i][j] = s[0..i-1] matches p[0..j-1]? For '*': match empty (dp[i][j-1]) OR consume one char from s (dp[i-1][j]).",
    keyInsight: "For '*': dp[i][j-1] = '*' matches empty. dp[i-1][j] = '*' consumed s[i] and remains. Leading '*'s can match empty string.",
    approach: "1) dp[0][0]=true. Leading '*'s match empty. 2) '?' or char → diagonal. '*' → dp[i][j-1] || dp[i-1][j].",
    complexity: "Time: O(M×N) | Space: O(M×N)",
    memoCode: `// TOP-DOWN: recursive with memoization
int solve(string& s, string& p, int i, int j, vector<vector<int>>& memo) {
    if (j < 0) return i < 0 ? 1 : 0;
    if (i < 0) {
        for (int k = 0; k <= j; k++) if (p[k] != '*') return 0;
        return 1;
    }
    if (memo[i][j] != -1) return memo[i][j];
    if (p[j] == '*')
        return memo[i][j] = solve(s, p, i, j-1, memo)
                          || solve(s, p, i-1, j, memo);
    if (p[j] == '?' || p[j] == s[i])
        return memo[i][j] = solve(s, p, i-1, j-1, memo);
    return memo[i][j] = 0;
}

bool isMatch(string s, string p) {
    int m = s.size(), n = p.size();
    vector<vector<int>> memo(m, vector<int>(n, -1));
    return solve(s, p, m-1, n-1, memo);
}`,
    tabCode: `// BOTTOM-UP: 2D tabulation
bool isMatch(string s, string p) {
    int m = s.size(), n = p.size();
    vector<vector<bool>> dp(m+1, vector<bool>(n+1, false));
    dp[0][0] = true;
    for (int j = 1; j <= n; j++)
        if (p[j-1] == '*') dp[0][j] = dp[0][j-1];

    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            if (p[j-1] == '?' || p[j-1] == s[i-1]) dp[i][j] = dp[i-1][j-1];
            else if (p[j-1] == '*') dp[i][j] = dp[i][j-1] || dp[i-1][j];

    return dp[m][n];
}`,
  },
  {
    id: 10, section: "DP — String", title: "Regular Expression Matching",
    difficulty: "Hard", frequency: "Medium", leetcode: 10,
    pattern: "Regex DP with '.' and '*'",
    intuition: "'.' matches any char. '*' = zero or more of PRECEDING char. For '*': zero copies → dp[i][j-2]. One+ copies → dp[i-1][j] if preceding char matches s[i-1].",
    keyInsight: "'*' always refers to the PRECEDING element. Treat (p[j-2], p[j-1]='*') as a pair. Zero copies = skip the pair. One+ = extend if chars match.",
    approach: "1) dp[0][0]=true. Handle a*b* patterns at row 0. 2) For '*': zero (dp[i][j-2]) OR one+ if preceding matches.",
    complexity: "Time: O(M×N) | Space: O(M×N)",
    memoCode: `// TOP-DOWN: recursive regex matching
int solve(string& s, string& p, int i, int j, vector<vector<int>>& memo) {
    if (j == (int)p.size()) return i == (int)s.size() ? 1 : 0;
    if (memo[i][j] != -1) return memo[i][j];
    bool firstMatch = (i < (int)s.size()) && (p[j] == '.' || p[j] == s[i]);
    if (j+1 < (int)p.size() && p[j+1] == '*')
        return memo[i][j] = solve(s, p, i, j+2, memo)
                          || (firstMatch && solve(s, p, i+1, j, memo));
    return memo[i][j] = firstMatch ? solve(s, p, i+1, j+1, memo) : 0;
}

bool isMatch(string s, string p) {
    vector<vector<int>> memo(s.size()+1, vector<int>(p.size()+1, -1));
    return solve(s, p, 0, 0, memo);
}`,
    tabCode: `// BOTTOM-UP: 2D tabulation
bool isMatch(string s, string p) {
    int m = s.size(), n = p.size();
    vector<vector<bool>> dp(m+1, vector<bool>(n+1, false));
    dp[0][0] = true;
    for (int j = 2; j <= n; j++)
        if (p[j-1] == '*') dp[0][j] = dp[0][j-2];

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (p[j-1] == '.' || p[j-1] == s[i-1]) {
                dp[i][j] = dp[i-1][j-1];
            } else if (p[j-1] == '*') {
                dp[i][j] = dp[i][j-2];
                if (p[j-2] == '.' || p[j-2] == s[i-1])
                    dp[i][j] = dp[i][j] || dp[i-1][j];
            }
        }
    }
    return dp[m][n];
}`,
  },
  {
    id: 11, section: "DP — String", title: "Word Break",
    difficulty: "Medium", frequency: "High", leetcode: 139,
    pattern: "Linear prefix DP + dictionary lookup",
    intuition: "dp[i] = can s[0..i-1] be segmented into valid words? For each i, try splits: if dp[j] is true AND s[j..i-1] is in dictionary → dp[i]=true. Use unordered_set for O(1) lookup.",
    keyInsight: "Optimization: only check substrings up to maxWordLength. For Word Break II: backtrack with memoization. BFS from index 0 also works cleanly.",
    approach: "1) dp[0]=true (empty string). 2) For i 1..n: for j 0..i-1: if dp[j] && substr in dict → dp[i]=true, break. 3) Return dp[n].",
    complexity: "Time: O(N² × L) | Space: O(N)",
    memoCode: `// TOP-DOWN: recursive with memoization
bool wordBreak(string s, vector<string>& wordDict) {
    unordered_set<string> dict(wordDict.begin(), wordDict.end());
    vector<int> memo(s.size(), -1);

    function<bool(int)> solve = [&](int start) -> bool {
        if (start == (int)s.size()) return true;
        if (memo[start] != -1) return memo[start];
        for (int end = start+1; end <= (int)s.size(); end++)
            if (dict.count(s.substr(start, end-start)) && solve(end))
                return memo[start] = 1;
        return memo[start] = 0;
    };
    return solve(0);
}`,
    tabCode: `// BOTTOM-UP: prefix DP
bool wordBreak(string s, vector<string>& wordDict) {
    unordered_set<string> dict(wordDict.begin(), wordDict.end());
    int n = s.size();
    vector<bool> dp(n+1, false);
    dp[0] = true;

    for (int i = 1; i <= n; i++)
        for (int j = 0; j < i; j++)
            if (dp[j] && dict.count(s.substr(j, i-j))) { dp[i] = true; break; }

    return dp[n];
}`,
  },

  // ══════════════════════════════
  //  DP — INTERVAL / GAME  (12–13)
  // ══════════════════════════════
  {
    id: 12, section: "DP — Interval / Game", title: "Stone Game / Predict the Winner",
    difficulty: "Medium", frequency: "Low", leetcode: 877,
    pattern: "Minimax Interval DP — relative advantage",
    intuition: "Two players pick from ends. dp[l][r] = max RELATIVE advantage for current player over opponent on [l..r]. Pick left: nums[l] - dp[l+1][r]. Pick right: nums[r] - dp[l][r-1]. Subtraction handles opponent's optimal play.",
    keyInsight: "Storing RELATIVE advantage (my score - opponent's) instead of absolute scores is the key. After your pick, remaining game is from OPPONENT's perspective → hence subtraction.",
    approach: "1) dp[i][i]=nums[i]. 2) Increasing gap fill. 3) dp[l][r] = max(nums[l]-dp[l+1][r], nums[r]-dp[l][r-1]). 4) Win if dp[0][n-1]>=0.",
    complexity: "Time: O(N²) | Space: O(N²)",
    memoCode: `// TOP-DOWN: minimax with memoization
int solve(vector<int>& nums, int l, int r, vector<vector<int>>& memo) {
    if (l > r) return 0;
    if (memo[l][r] != -1) return memo[l][r];
    return memo[l][r] = max(
        nums[l] - solve(nums, l+1, r, memo),
        nums[r] - solve(nums, l, r-1, memo)
    );
}

bool predictTheWinner(vector<int>& nums) {
    int n = nums.size();
    vector<vector<int>> memo(n, vector<int>(n, -1));
    return solve(nums, 0, n-1, memo) >= 0;
}`,
    tabCode: `// BOTTOM-UP: fill by increasing gap
bool predictTheWinner(vector<int>& nums) {
    int n = nums.size();
    vector<vector<int>> dp(n, vector<int>(n, 0));
    for (int i = 0; i < n; i++) dp[i][i] = nums[i];

    for (int gap = 1; gap < n; gap++)
        for (int l = 0; l + gap < n; l++) {
            int r = l + gap;
            dp[l][r] = max(nums[l] - dp[l+1][r], nums[r] - dp[l][r-1]);
        }

    return dp[0][n-1] >= 0;
}`,
  },

  // ══════════════════════════════
  //  DP — BITMASK  (id 14)
  // ══════════════════════════════
  {
    id: 14, section: "DP — Bitmask", title: "Shortest Path Visiting All Nodes",
    difficulty: "Hard", frequency: "Low", leetcode: 847,
    pattern: "BFS + Bitmask state (graph TSP)",
    intuition: "State = (node, visited_mask). BFS gives shortest path. Start from ALL nodes simultaneously. Goal: mask = (1<<n)-1. Graph BFS + bitmask = TSP for unweighted graphs.",
    keyInsight: "Start BFS from ALL nodes at once when start is unknown. State space is O(N × 2^N). For DP version: dp[mask][node] = min steps to reach 'node' having visited 'mask'.",
    approach: "1) Enqueue (node, 1<<node, 0) for all nodes. 2) BFS. 3) new_mask = mask|(1<<neighbor). 4) Return steps when full mask reached.",
    complexity: "Time: O(N² × 2^N) | Space: O(N × 2^N)",
    memoCode: `// DP perspective: dp[node][mask] = min dist
// (BFS is preferred; this shows the DP formulation)
// dp[node][mask] = min steps to be at 'node' having visited 'mask'
// Transition: dp[nei][mask | (1<<nei)] = dp[node][mask] + 1`,
    tabCode: `// BOTTOM-UP: BFS with bitmask state
int shortestPathLength(vector<vector<int>>& g) {
    int n = g.size(), full = (1 << n) - 1;
    queue<tuple<int,int,int>> q;
    set<pair<int,int>> vis;

    for (int i = 0; i < n; i++) {
        q.push({i, 1<<i, 0});
        vis.insert({i, 1<<i});
    }

    while (!q.empty()) {
        auto [node, mask, dist] = q.front(); q.pop();
        if (mask == full) return dist;
        for (int nei : g[node]) {
            int nm = mask | (1 << nei);
            if (!vis.count({nei, nm})) {
                vis.insert({nei, nm});
                q.push({nei, nm, dist+1});
            }
        }
    }
    return -1;
}`,
  },

  // ══════════════════════════════
  //  DP — SEQUENCE  (15–17)
  // ══════════════════════════════
  {
    id: 15, section: "DP — Sequence", title: "Longest Increasing Subsequence",
    difficulty: "Medium", frequency: "High", leetcode: 300,
    pattern: "Patience sorting / Binary search O(N log N)",
    intuition: "O(N log N): maintain tails[] where tails[k] = smallest possible tail of all increasing subsequences of length k+1. For each num: lower_bound gives position. Extends array or replaces.",
    keyInsight: "tails[] doesn't store the actual LIS — just tail values. lower_bound gives the correct position. tails.size() = LIS length. To reconstruct: track parent array alongside.",
    approach: "1) For each num: pos = lower_bound(tails, num). 2) pos==end → extend. Else replace tails[pos]. 3) Answer = tails.size().",
    complexity: "Time: O(N log N) | Space: O(N)",
    memoCode: `// NAIVE O(N²): dp[i] = LIS length ending at index i
int lengthOfLIS_N2(vector<int>& nums) {
    int n = nums.size(), ans = 1;
    vector<int> dp(n, 1);

    for (int i = 1; i < n; i++) {
        for (int j = 0; j < i; j++)
            if (nums[j] < nums[i]) dp[i] = max(dp[i], dp[j] + 1);
        ans = max(ans, dp[i]);
    }
    return ans;
}`,
    tabCode: `// OPTIMIZED O(N log N): patience sort / binary search
int lengthOfLIS(vector<int>& nums) {
    vector<int> tails; // tails[k] = smallest tail of LIS length k+1

    for (int num : nums) {
        auto it = lower_bound(tails.begin(), tails.end(), num);
        if (it == tails.end()) tails.push_back(num);
        else *it = num;
    }
    return tails.size();
}`,
  },
  {
    id: 16, section: "DP — Sequence", title: "House Robber I & II",
    difficulty: "Medium", frequency: "High", leetcode: 198,
    pattern: "Linear DP — no two adjacent",
    intuition: "I: dp[i] = max loot up to house i. Either rob house i (dp[i-2]+nums[i]) or skip (dp[i-1]). II: Circular — can't rob both first and last. Run I twice: [0..n-2] and [1..n-1], take max.",
    keyInsight: "House Robber II = run House Robber I on two sub-arrays (exclude first or exclude last) and take the max. Elegant reduction handles circular constraint without special logic.",
    approach: "I: O(1) space — track prev2, prev1. II: max(rob(0,n-2), rob(1,n-1)) where rob() is House Robber I.",
    complexity: "Time: O(N) | Space: O(1)",
    memoCode: `// TOP-DOWN: House Robber I
int rob(vector<int>& nums) {
    vector<int> memo(nums.size(), -1);
    function<int(int)> solve = [&](int i) -> int {
        if (i < 0) return 0;
        if (memo[i] != -1) return memo[i];
        return memo[i] = max(solve(i-1), nums[i] + solve(i-2));
    };
    return solve(nums.size()-1);
}`,
    tabCode: `// House Robber I — O(1) space
int rob(vector<int>& nums) {
    int prev2 = 0, prev1 = 0;
    for (int num : nums) {
        int cur = max(prev1, prev2 + num);
        prev2 = prev1; prev1 = cur;
    }
    return prev1;
}

// House Robber II — circular
int rob2(vector<int>& nums) {
    int n = nums.size();
    if (n == 1) return nums[0];
    auto robLinear = [&](int l, int r) {
        int p2 = 0, p1 = 0;
        for (int i = l; i <= r; i++) { int c = max(p1, p2+nums[i]); p2=p1; p1=c; }
        return p1;
    };
    return max(robLinear(0, n-2), robLinear(1, n-1));
}`,
  },
  {
    id: 17, section: "DP — Sequence", title: "Unique Paths / Minimum Path Sum",
    difficulty: "Medium", frequency: "High", leetcode: 62,
    pattern: "Grid DP — 2D traversal",
    intuition: "Unique Paths: dp[i][j] = paths to reach (i,j) = dp[i-1][j] + dp[i][j-1]. Min Path Sum: dp[i][j] = min cost = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]. Both build left-to-right, top-to-bottom.",
    keyInsight: "Grid DP is among the easiest 2D DPs to visualize. Space optimization: use 1D rolling array (each row depends only on prev row). dp[j] = min(dp[j], dp[j-1]) + grid[i][j].",
    approach: "Init first row and column as base cases. Fill dp[i][j] from top and left neighbors.",
    complexity: "Time: O(M×N) | Space: O(N) with rolling array",
    memoCode: `// TOP-DOWN: recursive grid DP (Min Path Sum)
int minPathSum(vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    vector<vector<int>> memo(m, vector<int>(n, -1));
    function<int(int,int)> solve = [&](int i, int j) -> int {
        if (i == 0 && j == 0) return grid[0][0];
        if (i < 0 || j < 0) return INT_MAX/2;
        if (memo[i][j] != -1) return memo[i][j];
        return memo[i][j] = grid[i][j] + min(solve(i-1,j), solve(i,j-1));
    };
    return solve(m-1, n-1);
}`,
    tabCode: `// BOTTOM-UP: space-optimized 1D rolling array
int minPathSum(vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    vector<int> dp(n, INT_MAX);
    dp[0] = 0;

    for (int i = 0; i < m; i++) {
        dp[0] += grid[i][0];
        for (int j = 1; j < n; j++)
            dp[j] = min(dp[j], dp[j-1]) + grid[i][j];
    }
    return dp[n-1];
}

// Unique Paths (LC 62)
int uniquePaths(int m, int n) {
    vector<int> dp(n, 1);
    for (int i = 1; i < m; i++)
        for (int j = 1; j < n; j++)
            dp[j] += dp[j-1];
    return dp[n-1];
}`,
  },

  // ══════════════════════════════
  //  GRAPH — BFS  (18–22)
  // ══════════════════════════════
  {
    id: 18, section: "Graph — BFS", title: "Number of Islands",
    difficulty: "Medium", frequency: "High", leetcode: 200,
    pattern: "Grid flood fill BFS/DFS",
    intuition: "For each unvisited '1': launch BFS to flood-fill all connected land, marking as '0'. Each launch = one island. Mark cells BEFORE enqueue to prevent duplicate processing.",
    keyInsight: "Mark cells BEFORE enqueueing, not after popping. This is the most common BFS mistake — without pre-marking, same cell enqueued multiple times → TLE.",
    approach: "1) Scan grid. 2) On '1': count++, BFS flood fill marking '0'. 3) Return count.",
    complexity: "Time: O(M×N) | Space: O(min(M,N)) BFS queue",
    tabCode: `int numIslands(vector<vector<char>>& grid) {
    int m = grid.size(), n = grid[0].size(), count = 0;
    int dx[] = {0,0,1,-1}, dy[] = {1,-1,0,0};

    for (int i = 0; i < m; i++) for (int j = 0; j < n; j++) {
        if (grid[i][j] == '1') {
            count++;
            queue<pair<int,int>> q;
            grid[i][j] = '0'; // mark BEFORE enqueue
            q.push({i, j});
            while (!q.empty()) {
                auto [x, y] = q.front(); q.pop();
                for (int d = 0; d < 4; d++) {
                    int nx = x+dx[d], ny = y+dy[d];
                    if (nx>=0&&nx<m&&ny>=0&&ny<n&&grid[nx][ny]=='1') {
                        grid[nx][ny] = '0';
                        q.push({nx, ny});
                    }
                }
            }
        }
    }
    return count;
}`,
  },
  {
    id: 19, section: "Graph — BFS", title: "Rotting Oranges",
    difficulty: "Medium", frequency: "High", leetcode: 994,
    pattern: "Multi-source BFS — simultaneous spread",
    intuition: "All rotten spread simultaneously → enqueue ALL rotten BEFORE BFS starts. Process level-by-level (each level = 1 minute). After BFS, if any fresh remains → -1.",
    keyInsight: "Multi-source BFS: enqueue all sources before starting. Pattern appears in: 01 Matrix, Walls and Gates, Shortest Bridge, Pacific Atlantic Water Flow.",
    approach: "1) Enqueue all rotten + count fresh. 2) Level-order BFS. 3) Return minutes or -1 if fresh > 0.",
    complexity: "Time: O(M×N) | Space: O(M×N)",
    tabCode: `int orangesRotting(vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size(), fresh = 0;
    queue<pair<int,int>> q;
    for (int i = 0; i < m; i++) for (int j = 0; j < n; j++) {
        if (grid[i][j] == 2) q.push({i, j});
        else if (grid[i][j] == 1) fresh++;
    }
    if (!fresh) return 0;
    int mins = 0, dx[] = {0,0,1,-1}, dy[] = {1,-1,0,0};
    while (!q.empty() && fresh > 0) {
        mins++;
        for (int sz = q.size(); sz > 0; sz--) {
            auto [x, y] = q.front(); q.pop();
            for (int d = 0; d < 4; d++) {
                int nx = x+dx[d], ny = y+dy[d];
                if (nx>=0&&nx<m&&ny>=0&&ny<n&&grid[nx][ny]==1) {
                    grid[nx][ny]=2; fresh--; q.push({nx,ny});
                }
            }
        }
    }
    return fresh == 0 ? mins : -1;
}`,
  },
  {
    id: 20, section: "Graph — BFS", title: "Word Ladder",
    difficulty: "Hard", frequency: "Medium", leetcode: 127,
    pattern: "BFS shortest transformation sequence",
    intuition: "Each word = node. Edge if 1-char different. BFS from begin. For each word, try 26×L mutations instead of checking all N words → O(26L) vs O(NL) per step. Use wordSet as visited.",
    keyInsight: "Bidirectional BFS reduces O(b^d) to O(b^(d/2)). Erase words from set as visited — no separate visited structure needed.",
    approach: "1) wordSet. 2) BFS from beginWord. 3) For each word, try 26 chars per position. 4) Return steps+1 when endWord found.",
    complexity: "Time: O(N × L × 26) | Space: O(N × L)",
    tabCode: `int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
    unordered_set<string> words(wordList.begin(), wordList.end());
    if (!words.count(endWord)) return 0;
    queue<pair<string,int>> q;
    q.push({beginWord, 1});
    words.erase(beginWord);
    while (!q.empty()) {
        auto [word, steps] = q.front(); q.pop();
        for (int i = 0; i < (int)word.size(); i++) {
            char orig = word[i];
            for (char c = 'a'; c <= 'z'; c++) {
                word[i] = c;
                if (word == endWord) return steps + 1;
                if (words.count(word)) { words.erase(word); q.push({word, steps+1}); }
            }
            word[i] = orig;
        }
    }
    return 0;
}`,
  },
  {
    id: 21, section: "Graph — BFS", title: "Clone Graph",
    difficulty: "Medium", frequency: "High", leetcode: 133,
    pattern: "BFS with node-clone mapping",
    intuition: "BFS traversal while maintaining a map from original node → cloned node. Before enqueueing a neighbor, check if already cloned (acts as visited). Link cloned nodes as edges are traversed.",
    keyInsight: "The clone map doubles as the visited set. For any graph deep copy: maintain oldNode → newNode map. Works for any graph structure.",
    approach: "1) Map original → clone. 2) BFS from root. 3) For each neighbor: if not cloned → create + enqueue. 4) Add neighbor's clone to current clone's adjacency list.",
    complexity: "Time: O(V+E) | Space: O(V)",
    tabCode: `Node* cloneGraph(Node* node) {
    if (!node) return nullptr;
    unordered_map<Node*, Node*> cloned;
    queue<Node*> q;
    cloned[node] = new Node(node->val);
    q.push(node);
    while (!q.empty()) {
        Node* curr = q.front(); q.pop();
        for (Node* nei : curr->neighbors) {
            if (!cloned.count(nei)) {
                cloned[nei] = new Node(nei->val);
                q.push(nei);
            }
            cloned[curr]->neighbors.push_back(cloned[nei]);
        }
    }
    return cloned[node];
}`,
  },
  {
    id: 22, section: "Graph — BFS", title: "Pacific Atlantic Water Flow",
    difficulty: "Medium", frequency: "Medium", leetcode: 417,
    pattern: "Reverse multi-source BFS from both oceans",
    intuition: "Instead of simulating water flow forward (expensive), run BFS BACKWARDS from each ocean. Pacific: top row + left column. Atlantic: bottom row + right column. Answer = cells reachable from BOTH.",
    keyInsight: "Reverse thinking: instead of 'can water flow from cell X to ocean?', ask 'can water flow from ocean to cell X if we reverse flow direction?'. Reduces to two multi-source BFS runs.",
    approach: "1) BFS from Pacific sources (top+left). 2) BFS from Atlantic sources (bottom+right). 3) Return intersection of visited sets.",
    complexity: "Time: O(M×N) | Space: O(M×N)",
    tabCode: `vector<vector<int>> pacificAtlantic(vector<vector<int>>& h) {
    int m = h.size(), n = h[0].size();
    auto bfs = [&](vector<pair<int,int>> sources) {
        vector<vector<bool>> vis(m, vector<bool>(n, false));
        queue<pair<int,int>> q;
        for (auto [r,c] : sources) { vis[r][c]=true; q.push({r,c}); }
        int dx[]={0,0,1,-1}, dy[]={1,-1,0,0};
        while (!q.empty()) {
            auto [x,y] = q.front(); q.pop();
            for (int d = 0; d < 4; d++) {
                int nx=x+dx[d], ny=y+dy[d];
                if (nx>=0&&nx<m&&ny>=0&&ny<n&&!vis[nx][ny]&&h[nx][ny]>=h[x][y]) {
                    vis[nx][ny]=true; q.push({nx,ny});
                }
            }
        }
        return vis;
    };
    vector<pair<int,int>> pac, atl;
    for (int i=0;i<m;i++){pac.push_back({i,0});atl.push_back({i,n-1});}
    for (int j=0;j<n;j++){pac.push_back({0,j});atl.push_back({m-1,j});}
    auto vp=bfs(pac), va=bfs(atl);
    vector<vector<int>> res;
    for (int i=0;i<m;i++) for (int j=0;j<n;j++)
        if (vp[i][j]&&va[i][j]) res.push_back({i,j});
    return res;
}`,
  },

  // ══════════════════════════════
  //  GRAPH — TOPO SORT  (23)
  // ══════════════════════════════
  {
    id: 23, section: "Graph — Topo Sort", title: "Course Schedule I & II",
    difficulty: "Medium", frequency: "High", leetcode: 207,
    pattern: "Kahn's BFS Topological Sort",
    intuition: "DAG: a valid ordering exists iff there is NO cycle. Kahn's: start from all 0-indegree nodes, process node, decrement neighbors. If processed count < total nodes → cycle.",
    keyInsight: "Kahn's = cycle detection + topological ordering in one pass. DFS topo uses reverse post-order. Kahn's is usually cleaner for interviews.",
    approach: "1) Build adjacency list + indegree array. 2) Enqueue all 0-indegree. 3) BFS: process → decrement → enqueue if 0. 4) Check count==n.",
    complexity: "Time: O(V+E) | Space: O(V+E)",
    tabCode: `class Solution {
public:
    bool canFinish(int n, vector<vector<int>>& prereqs) {
        vector<vector<int>> g(n); vector<int> indeg(n, 0);
        for (auto& p:prereqs){g[p[1]].push_back(p[0]);indeg[p[0]]++;}
        queue<int> q;
        for (int i=0;i<n;i++) if(!indeg[i]) q.push(i);
        int cnt=0;
        while (!q.empty()){int u=q.front();q.pop();cnt++;for(int v:g[u])if(--indeg[v]==0)q.push(v);}
        return cnt==n;
    }

    vector<int> findOrder(int n, vector<vector<int>>& prereqs) {
        vector<vector<int>> g(n); vector<int> indeg(n,0);
        for (auto& p:prereqs){g[p[1]].push_back(p[0]);indeg[p[0]]++;}
        queue<int> q;
        for (int i=0;i<n;i++) if(!indeg[i]) q.push(i);
        vector<int> order;
        while (!q.empty()){int u=q.front();q.pop();order.push_back(u);for(int v:g[u])if(--indeg[v]==0)q.push(v);}
        return order.size()==n?order:vector<int>{};
    }
};`,
  },

  // ══════════════════════════════
  //  GRAPH — SHORTEST PATH  (24–26)
  // ══════════════════════════════
  {
    id: 24, section: "Graph — Shortest Path", title: "Dijkstra's Algorithm",
    difficulty: "Medium", frequency: "Medium", leetcode: 743,
    pattern: "Greedy min-heap — non-negative weights only",
    intuition: "Expand closest unfinalized node using min-heap. Once popped = FINAL distance. Skip stale entries (d > dist[u]). Fails with negative edges.",
    keyInsight: "The 'skip stale' check (if d > dist[u]) is critical. Without it, same node processed multiple times → O(VE) instead of O(E log V). This check is what makes Dijkstra efficient.",
    approach: "1) dist[src]=0. 2) Push (0, src). 3) Pop, skip if stale. 4) Relax neighbors, push improvements.",
    complexity: "Time: O(E log V) | Space: O(V+E)",
    tabCode: `int networkDelayTime(vector<vector<int>>& times, int n, int k) {
    vector<vector<pair<int,int>>> g(n+1);
    for (auto& t:times) g[t[0]].push_back({t[1],t[2]});
    vector<int> dist(n+1, INT_MAX);
    dist[k]=0;
    priority_queue<pair<int,int>,vector<pair<int,int>>,greater<>> pq;
    pq.push({0,k});
    while (!pq.empty()) {
        auto [d,u]=pq.top(); pq.pop();
        if (d>dist[u]) continue; // SKIP STALE
        for (auto [v,w]:g[u])
            if (dist[u]+w<dist[v]){dist[v]=dist[u]+w;pq.push({dist[v],v});}
    }
    int ans=*max_element(dist.begin()+1,dist.begin()+n+1);
    return ans==INT_MAX?-1:ans;
}`,
  },
  {
    id: 25, section: "Graph — Shortest Path", title: "Bellman-Ford (K Stops)",
    difficulty: "Medium", frequency: "Medium", leetcode: 787,
    pattern: "Relax all edges V-1 times — handles negatives",
    intuition: "Handles NEGATIVE edges. Relax all edges K+1 times for K-stops. COPY dist before each round to prevent cascading (a single round must not chain multiple edges).",
    keyInsight: "COPY dist before each round for K-stops. Without the copy, one relaxation round can chain multiple edges, violating the K-constraint.",
    approach: "1) dist[src]=0. 2) K+1 rounds: snapshot dist + relax all edges. 3) Return dist[dst] or -1.",
    complexity: "Time: O(K × E) | Space: O(V)",
    tabCode: `int findCheapestPrice(int n, vector<vector<int>>& flights, int src, int dst, int k) {
    vector<int> dist(n, INT_MAX);
    dist[src] = 0;
    for (int i = 0; i <= k; i++) {
        vector<int> temp(dist); // SNAPSHOT prevents cascading
        for (auto& f : flights)
            if (dist[f[0]]!=INT_MAX && dist[f[0]]+f[2]<temp[f[1]])
                temp[f[1]] = dist[f[0]]+f[2];
        dist = temp;
    }
    return dist[dst]==INT_MAX ? -1 : dist[dst];
}`,
  },
  {
    id: 26, section: "Graph — Shortest Path", title: "Floyd-Warshall (All-Pairs)",
    difficulty: "Medium", frequency: "Low", leetcode: 1334,
    pattern: "All-pairs shortest path — DP on intermediate nodes",
    intuition: "Try each node k as an intermediate. dist[i][j] = min(direct, through k). After all k: dist[i][j] = true shortest. O(V³) — only for small V (≤500).",
    keyInsight: "Negative cycle detected if dist[i][i] < 0. Order of loops matters: k (intermediate) must be outermost loop.",
    approach: "1) Init from adjacency matrix. 2) For each k, for each (i,j): dist[i][j] = min(dist[i][j], dist[i][k]+dist[k][j]).",
    complexity: "Time: O(V³) | Space: O(V²)",
    tabCode: `int findTheCity(int n, vector<vector<int>>& edges, int threshold) {
    vector<vector<int>> dist(n, vector<int>(n, INT_MAX/2));
    for (int i=0;i<n;i++) dist[i][i]=0;
    for (auto& e:edges){dist[e[0]][e[1]]=e[2];dist[e[1]][e[0]]=e[2];}
    for (int k=0;k<n;k++)
        for (int i=0;i<n;i++)
            for (int j=0;j<n;j++)
                dist[i][j]=min(dist[i][j],dist[i][k]+dist[k][j]);
    int ans=-1,minR=INT_MAX;
    for (int i=0;i<n;i++){
        int cnt=0;
        for (int j=0;j<n;j++) if(i!=j&&dist[i][j]<=threshold) cnt++;
        if (cnt<=minR){minR=cnt;ans=i;}
    }
    return ans;
}`,
  },

  // ══════════════════════════════
  //  GRAPH — UNION FIND  (27)
  // ══════════════════════════════
  {
    id: 27, section: "Graph — Union Find", title: "Union Find Template",
    difficulty: "Medium", frequency: "Medium", leetcode: 547,
    pattern: "DSU with path compression + union by rank",
    intuition: "PATH COMPRESSION: find() points directly to root. UNION BY RANK: smaller tree under larger. Together: near O(1) amortized. unite() returning false → cycle detected.",
    keyInsight: "unite() returning false = cycle in undirected graph (LC 684). Also core of Kruskal's MST. Track component count for connectivity queries.",
    approach: "1) parent[i]=i, rank[i]=0. 2) find: recursive path compression. 3) unite: union by rank.",
    complexity: "Time: O(α(N)) ≈ O(1) | Space: O(N)",
    tabCode: `class UnionFind {
public:
    vector<int> parent, rank_;
    int components;
    UnionFind(int n):parent(n),rank_(n,0),components(n){iota(parent.begin(),parent.end(),0);}
    int find(int x){if(parent[x]!=x)parent[x]=find(parent[x]);return parent[x];}
    bool unite(int x,int y){
        int rx=find(x),ry=find(y);
        if(rx==ry) return false;
        if(rank_[rx]<rank_[ry]) swap(rx,ry);
        parent[ry]=rx;
        if(rank_[rx]==rank_[ry]) rank_[rx]++;
        components--;
        return true;
    }
};

// LC 684: Redundant Connection
vector<int> findRedundantConnection(vector<vector<int>>& edges) {
    UnionFind uf(edges.size()+1);
    for (auto& e:edges) if(!uf.unite(e[0],e[1])) return e;
    return {};
}`,
  },

  // ══════════════════════════════
  //  GRAPH — MST + TARJAN  (28–29)
  // ══════════════════════════════
  {
    id: 28, section: "Graph — MST", title: "Kruskal's Minimum Spanning Tree",
    difficulty: "Medium", frequency: "Low", leetcode: 1584,
    pattern: "Sort edges + Union Find greedy",
    intuition: "Sort edges by weight. Greedily add cheapest edge that doesn't create a cycle (use Union-Find). Stop at V-1 edges. Kruskal = sort+UF. Prim = heap-growth from one node.",
    keyInsight: "Kruskal is simpler to code. Prim is better for dense graphs. Both produce the same MST weight.",
    approach: "1) Sort edges by weight. 2) For each edge: if uf.unite succeeds → add. 3) Stop after V-1 edges.",
    complexity: "Time: O(E log E) | Space: O(V)",
    tabCode: `// LC 1584: Min Cost to Connect All Points
int minCostConnectPoints(vector<vector<int>>& pts) {
    int n = pts.size();
    vector<tuple<int,int,int>> edges;
    for (int i=0;i<n;i++) for (int j=i+1;j<n;j++)
        edges.push_back({abs(pts[i][0]-pts[j][0])+abs(pts[i][1]-pts[j][1]),i,j});
    sort(edges.begin(),edges.end());
    UnionFind uf(n);
    int cost=0,used=0;
    for (auto&[w,u,v]:edges)
        if(uf.unite(u,v)){cost+=w;if(++used==n-1)break;}
    return cost;
}`,
  },
  {
    id: 29, section: "Graph — Tarjan", title: "Critical Connections (Bridges)",
    difficulty: "Hard", frequency: "Low", leetcode: 1192,
    pattern: "Tarjan's bridge-finding algorithm",
    intuition: "Edge (u,v) is a bridge if low[v] > disc[u]. DFS with disc[] (discovery time) and low[] (lowest reachable via back edges). Back edges update low[] upward.",
    keyInsight: "low[v] > disc[u] → bridge. low[v] >= disc[u] → articulation point. Both in ONE DFS pass.",
    approach: "1) DFS with timer. 2) Tree edge: recurse, update low[u], check bridge. 3) Back edge: update low[u] = min(low[u], disc[v]).",
    complexity: "Time: O(V+E) | Space: O(V+E)",
    tabCode: `class Solution {
    vector<vector<int>> res;
    vector<int> disc,low;
    int timer=0;
public:
    vector<vector<int>> criticalConnections(int n, vector<vector<int>>& conn) {
        vector<vector<int>> g(n);
        for (auto&c:conn){g[c[0]].push_back(c[1]);g[c[1]].push_back(c[0]);}
        disc.assign(n,-1);low.assign(n,-1);
        dfs(g,0,-1);
        return res;
    }
    void dfs(vector<vector<int>>& g,int u,int par){
        disc[u]=low[u]=timer++;
        for (int v:g[u]){
            if(v==par) continue;
            if(disc[v]==-1){dfs(g,v,u);low[u]=min(low[u],low[v]);if(low[v]>disc[u])res.push_back({u,v});}
            else low[u]=min(low[u],disc[v]);
        }
    }
};`,
  },

  // ══════════════════════════════
  //  SLIDING WINDOW  (30–34)
  // ══════════════════════════════
  {
    id: 30, section: "Sliding Window", title: "Longest Substring Without Repeating",
    difficulty: "Medium", frequency: "High", leetcode: 3,
    pattern: "Variable window + last-index map",
    intuition: "Expand right. On duplicate within window, jump left pointer past previous occurrence. Track last seen index per char. Window always maintains unique chars.",
    keyInsight: "Left pointer ONLY moves forward → O(N) total. Check last_seen >= left to ensure previous occurrence is actually within current window.",
    approach: "1) Map char → last index. 2) For each right: if seen within window (>= left), move left. Update map. Track max length.",
    complexity: "Time: O(N) | Space: O(26) = O(1)",
    tabCode: `int lengthOfLongestSubstring(string s) {
    unordered_map<char,int> last;
    int left=0,ans=0;
    for (int right=0;right<(int)s.size();right++){
        if (last.count(s[right])&&last[s[right]]>=left)
            left=last[s[right]]+1;
        last[s[right]]=right;
        ans=max(ans,right-left+1);
    }
    return ans;
}`,
  },
  {
    id: 31, section: "Sliding Window", title: "Minimum Window Substring",
    difficulty: "Hard", frequency: "High", leetcode: 76,
    pattern: "Shrinkable window with HAVE/NEED tracking",
    intuition: "Expand right until all chars of t satisfied (have==need). Shrink left to minimize. 'have' only updates at exact threshold crossings.",
    keyInsight: "'have' increments/decrements only at exact threshold — avoids re-scanning all frequencies. 'need' = count of distinct chars in t needed at full frequency.",
    approach: "1) Build need map from t. 2) Expand right. 3) While valid (have==need): record result, shrink left.",
    complexity: "Time: O(N) | Space: O(|charset|)",
    tabCode: `string minWindow(string s, string t) {
    unordered_map<char,int> need,win;
    for (char c:t) need[c]++;
    int have=0,req=need.size(),left=0,minLen=INT_MAX,minStart=0;
    for (int r=0;r<(int)s.size();r++){
        win[s[r]]++;
        if(need.count(s[r])&&win[s[r]]==need[s[r]]) have++;
        while(have==req){
            if(r-left+1<minLen){minLen=r-left+1;minStart=left;}
            win[s[left]]--;
            if(need.count(s[left])&&win[s[left]]<need[s[left]]) have--;
            left++;
        }
    }
    return minLen==INT_MAX?"":s.substr(minStart,minLen);
}`,
  },
  {
    id: 32, section: "Sliding Window", title: "Sliding Window Maximum",
    difficulty: "Hard", frequency: "High", leetcode: 239,
    pattern: "Monotonic decreasing deque",
    intuition: "Deque of INDICES, monotonic decreasing VALUES. Front = window max. Remove expired front. Remove smaller from back before adding.",
    keyInsight: "Deque stores INDICES (to check window expiry). Values are decreasing. Each element enters and exits once → O(N) total.",
    approach: "1) Remove expired front. 2) Remove smaller back. 3) Append index. 4) Record front when window size k reached.",
    complexity: "Time: O(N) | Space: O(K)",
    tabCode: `vector<int> maxSlidingWindow(vector<int>& nums, int k) {
    deque<int> dq;
    vector<int> res;
    for (int i=0;i<(int)nums.size();i++){
        while(!dq.empty()&&dq.front()<i-k+1) dq.pop_front();
        while(!dq.empty()&&nums[dq.back()]<=nums[i]) dq.pop_back();
        dq.push_back(i);
        if(i>=k-1) res.push_back(nums[dq.front()]);
    }
    return res;
}`,
  },
  {
    id: 33, section: "Sliding Window", title: "Permutation in String",
    difficulty: "Medium", frequency: "Medium", leetcode: 567,
    pattern: "Fixed-size window with frequency matching",
    intuition: "Check if any permutation of s1 is a substring of s2. Fixed window of size len(s1). Use 'matches' counter: 26 possible chars, count how many have matching frequencies.",
    keyInsight: "Fixed window variant. 'matches' counter trick: increment when freq matches threshold, decrement when it breaks. O(1) per slide.",
    approach: "1) Build s1 frequency + count initial matches. 2) Slide window of size s1.length(). 3) On right add and left evict: update matches. 4) If 26 matches → true.",
    complexity: "Time: O(N) | Space: O(26) = O(1)",
    tabCode: `bool checkInclusion(string s1, string s2) {
    if(s1.size()>s2.size()) return false;
    vector<int> need(26,0),win(26,0);
    for (char c:s1) need[c-'a']++;
    int matches=0;
    for (int i=0;i<26;i++) if(need[i]==0) matches++;
    for (int r=0;r<(int)s2.size();r++){
        int rc=s2[r]-'a';
        win[rc]++;
        if(win[rc]==need[rc]) matches++;
        else if(win[rc]==need[rc]+1) matches--;
        if(r>=(int)s1.size()){
            int lc=s2[r-s1.size()]-'a';
            win[lc]--;
            if(win[lc]==need[lc]) matches++;
            else if(win[lc]==need[lc]-1) matches--;
        }
        if(matches==26) return true;
    }
    return false;
}`,
  },
  {
    id: 34, section: "Sliding Window", title: "Longest Repeating Char Replacement",
    difficulty: "Medium", frequency: "Medium", leetcode: 424,
    pattern: "Variable window with max frequency tracking",
    intuition: "Window is valid if (windowSize - maxFreqInWindow) <= k. Expand right, track maxFreq. Shrink left when invalid. maxFreq only ever increases — we only care about the best seen.",
    keyInsight: "We never shrink maxFreq when left shrinks — if window can't beat current best, it just slides. This makes the operation O(N) — left and right each move forward once.",
    approach: "1) Freq array + maxFreq. 2) Expand right. 3) If window-maxFreq > k: slide left. 4) Track max window size.",
    complexity: "Time: O(N) | Space: O(26) = O(1)",
    tabCode: `int characterReplacement(string s, int k) {
    vector<int> freq(26,0);
    int left=0,maxFreq=0,ans=0;
    for (int right=0;right<(int)s.size();right++){
        freq[s[right]-'A']++;
        maxFreq=max(maxFreq,freq[s[right]-'A']);
        if(right-left+1-maxFreq>k){ freq[s[left]-'A']--; left++; }
        ans=max(ans,right-left+1);
    }
    return ans;
}`,
  },

  // ══════════════════════════════
  //  MONOTONIC STACK  (35–36)
  // ══════════════════════════════
  {
    id: 35, section: "Monotonic Stack", title: "Largest Rectangle in Histogram",
    difficulty: "Hard", frequency: "High", leetcode: 84,
    pattern: "Monotonic increasing stack + sentinel",
    intuition: "Monotonic increasing stack of indices. When current bar is shorter (pop): popped bar is HEIGHT, current index and new top determine WIDTH. Sentinel 0 at end flushes all remaining bars.",
    keyInsight: "Sentinel trick (append 0) forces stack flush. Building block for Maximal Rectangle (LC 85): run histogram on each row's accumulated heights.",
    approach: "1) Append sentinel 0. 2) For each bar: while stack top taller, pop, compute area. Width = i - newTop - 1. 3) Track max.",
    complexity: "Time: O(N) | Space: O(N)",
    tabCode: `int largestRectangleArea(vector<int>& h) {
    stack<int> stk;
    h.push_back(0); // SENTINEL: forces stack flush
    int ans=0;
    for (int i=0;i<(int)h.size();i++){
        while(!stk.empty()&&h[stk.top()]>h[i]){
            int height=h[stk.top()]; stk.pop();
            int width=stk.empty()?i:i-stk.top()-1;
            ans=max(ans,height*width);
        }
        stk.push(i);
    }
    h.pop_back();
    return ans;
}`,
  },
  {
    id: 36, section: "Monotonic Stack", title: "Trapping Rain Water",
    difficulty: "Hard", frequency: "High", leetcode: 42,
    pattern: "Two pointers — process smaller wall",
    intuition: "Water at i = min(maxLeft, maxRight) - height[i]. Two pointers: process the SMALLER side. The smaller side's max definitively bounds water there.",
    keyInsight: "Move smaller pointer because water is bounded by LOWER wall. The other side is already >= so its exact value doesn't affect current calculation.",
    approach: "1) L=0, R=n-1. 2) Process smaller side. 3) If height >= max: update max. Else: add water = max - height.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `int trap(vector<int>& h) {
    int l=0,r=h.size()-1,lMax=0,rMax=0,water=0;
    while (l<r){
        if(h[l]<h[r]){h[l]>=lMax?lMax=h[l]:water+=lMax-h[l];l++;}
        else{h[r]>=rMax?rMax=h[r]:water+=rMax-h[r];r--;}
    }
    return water;
}`,
  },

  // ══════════════════════════════
  //  PREFIX SUMS  (37–38)
  // ══════════════════════════════
  {
    id: 37, section: "Prefix Sums", title: "Subarray Sum Equals K",
    difficulty: "Medium", frequency: "High", leetcode: 560,
    pattern: "Prefix sum + frequency hashmap",
    intuition: "prefix[j] - prefix[i] = k → subarray (i,j] has sum k. Count prefix[i] = prefix[j]-k seen before j.",
    keyInsight: "Init map with {0:1} to handle subarrays starting from index 0. Extends to XOR subarrays, divisible-by-K, longest subarray sum K.",
    approach: "1) Map {0:1}. 2) curr += num. count += map[curr-k]. map[curr]++.",
    complexity: "Time: O(N) | Space: O(N)",
    tabCode: `int subarraySum(vector<int>& nums, int k) {
    unordered_map<int,int> prefCnt;
    prefCnt[0]=1;
    int curr=0,count=0;
    for (int num:nums){curr+=num;count+=prefCnt[curr-k];prefCnt[curr]++;}
    return count;
}`,
  },
  {
    id: 38, section: "Prefix Sums", title: "Product of Array Except Self",
    difficulty: "Medium", frequency: "High", leetcode: 238,
    pattern: "Left-right prefix/suffix decomposition",
    intuition: "result[i] = leftProduct × rightProduct. Left pass: accumulate prefix products. Right pass: multiply suffix products using running variable.",
    keyInsight: "Left-right decomposition appears in: rain water, stock buy/sell, max product subarray. Two-pass prefix/suffix when you need info from both sides of each element.",
    approach: "1) Left pass: result[i] = product of nums[0..i-1]. 2) Right pass: multiply by product of nums[i+1..n-1].",
    complexity: "Time: O(N) | Space: O(1) extra",
    tabCode: `vector<int> productExceptSelf(vector<int>& nums) {
    int n=nums.size();
    vector<int> res(n,1);
    int left=1;
    for (int i=0;i<n;i++){res[i]=left;left*=nums[i];}
    int right=1;
    for (int i=n-1;i>=0;i--){res[i]*=right;right*=nums[i];}
    return res;
}`,
  },

  // ══════════════════════════════
  //  GREEDY  (39–41)
  // ══════════════════════════════
  {
    id: 39, section: "Greedy", title: "Jump Game I & II",
    difficulty: "Medium", frequency: "High", leetcode: 55,
    pattern: "Greedy reachability — BFS level analogy",
    intuition: "I: Track maxReach. If i > maxReach → stuck. II: BFS-like greedy with currentEnd and farthest boundaries. Jump when i reaches currentEnd.",
    keyInsight: "Jump Game II = BFS where each level = one jump. currentEnd = current level boundary. farthest = next level boundary.",
    approach: "I: One pass, track maxReach. II: Track curEnd and farthest, jump++ when i==curEnd.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `bool canJump(vector<int>& nums) {
    int maxReach=0;
    for (int i=0;i<(int)nums.size();i++){if(i>maxReach)return false;maxReach=max(maxReach,i+nums[i]);}
    return true;
}

int jump(vector<int>& nums) {
    int jumps=0,curEnd=0,farthest=0;
    for (int i=0;i<(int)nums.size()-1;i++){
        farthest=max(farthest,i+nums[i]);
        if(i==curEnd){jumps++;curEnd=farthest;}
    }
    return jumps;
}`,
  },
  {
    id: 40, section: "Greedy", title: "Merge Intervals",
    difficulty: "Medium", frequency: "High", leetcode: 56,
    pattern: "Sort + merge overlapping intervals",
    intuition: "Sort by start. Merge if overlap (current.start <= last.end). Extend end. After sorting, only need to compare with LAST merged interval.",
    keyInsight: "After sorting by start, you only need to check the LAST merged interval. O(N) scan after O(N log N) sort.",
    approach: "1) Sort by start. 2) For each interval: overlap → extend end. No overlap → push new interval.",
    complexity: "Time: O(N log N) | Space: O(N)",
    tabCode: `vector<vector<int>> merge(vector<vector<int>>& intervals) {
    sort(intervals.begin(),intervals.end());
    vector<vector<int>> res;
    for (auto&iv:intervals){
        if(res.empty()||iv[0]>res.back()[1]) res.push_back(iv);
        else res.back()[1]=max(res.back()[1],iv[1]);
    }
    return res;
}`,
  },
  {
    id: 41, section: "Greedy", title: "Task Scheduler",
    difficulty: "Medium", frequency: "Medium", leetcode: 621,
    pattern: "Frequency greedy — idle frame counting",
    intuition: "(maxFreq-1) chunks of (n+1) slots, plus final chunk of maxCount tasks. If enough diverse tasks → idle slots collapse. Answer = max(formula, totalTasks).",
    keyInsight: "Visualize: [A _ _ _][A _ _ _][A B]. Chunks = maxFreq-1, width = n+1. Final chunk = count of tasks at maxFreq.",
    approach: "1) Count freq, find maxFreq and maxCount. 2) result = (maxFreq-1)*(n+1)+maxCount. 3) max(result, total).",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `int leastInterval(vector<char>& tasks, int n) {
    int freq[26]={};
    for (char t:tasks) freq[t-'A']++;
    int maxF=*max_element(freq,freq+26);
    int maxCnt=count(freq,freq+26,maxF);
    return max((int)tasks.size(),(maxF-1)*(n+1)+maxCnt);
}`,
  },

  // ══════════════════════════════
  //  TWO POINTERS  (42–43)
  // ══════════════════════════════
  {
    id: 43, section: "Two Pointers", title: "Sort Colors (Dutch National Flag)",
    difficulty: "Medium", frequency: "Medium", leetcode: 75,
    pattern: "Three-way partition — one pass",
    intuition: "Partition array into 0s | 1s | 2s in one pass. Three pointers: lo, mid, hi. Swap and advance based on nums[mid] value.",
    keyInsight: "When swapping with hi: DON'T advance mid — element from hi is unknown. When swapping with lo: advance both (lo is always 0 from prior swaps).",
    approach: "1) lo=0, mid=0, hi=n-1. 2) 0→swap(lo,mid),lo++,mid++. 1→mid++. 2→swap(mid,hi),hi-- (no mid++).",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `void sortColors(vector<int>& nums) {
    int lo=0,mid=0,hi=nums.size()-1;
    while(mid<=hi){
        if(nums[mid]==0){swap(nums[lo++],nums[mid++]);}
        else if(nums[mid]==1){mid++;}
        else{swap(nums[mid],nums[hi--]);}  // don't advance mid!
    }
}`,
  },

  // ══════════════════════════════
  //  BINARY SEARCH  (44)
  // ══════════════════════════════
  {
    id: 44, section: "Binary Search", title: "Search in Rotated Sorted Array",
    difficulty: "Medium", frequency: "High", leetcode: 33,
    pattern: "Modified binary search — identify sorted half first",
    intuition: "One half is always sorted. Check nums[left] <= nums[mid] → left half sorted. Then check if target falls in sorted half → narrow. For duplicates (LC 81): nums[left]==nums[mid] → left++.",
    keyInsight: "IDENTIFY sorted half first, THEN check if target is within it. Exactly one half is always sorted after rotation.",
    approach: "1) Binary search. 2) Identify sorted half. 3) Check if target in sorted half → narrow. Else → other half.",
    complexity: "Time: O(log N) | Space: O(1)",
    tabCode: `int search(vector<int>& nums, int target) {
    int l=0,r=nums.size()-1;
    while(l<=r){
        int m=l+(r-l)/2;
        if(nums[m]==target) return m;
        if(nums[l]<=nums[m]){
            if(nums[l]<=target&&target<nums[m]) r=m-1;
            else l=m+1;
        } else {
            if(nums[m]<target&&target<=nums[r]) l=m+1;
            else r=m-1;
        }
    }
    return -1;
}`,
  },

  // ══════════════════════════════
  //  HEAP  (45–46)
  // ══════════════════════════════
  {
    id: 46, section: "Heap", title: "Merge K Sorted Lists",
    difficulty: "Hard", frequency: "High", leetcode: 23,
    pattern: "Min-heap of list heads",
    intuition: "Push all non-null list heads into min-heap. Pop smallest → append → push its next. Heap maintains at most K elements. Each of N total nodes enters and exits once → O(N log K).",
    keyInsight: "Generalizes merge sort's merge step to K lists. Custom comparator with lambda in C++.",
    approach: "1) Push all non-null heads. 2) Pop min, append. 3) Push popped node's next. 4) Repeat.",
    complexity: "Time: O(N log K) | Space: O(K)",
    tabCode: `ListNode* mergeKLists(vector<ListNode*>& lists) {
    auto cmp=[](ListNode* a,ListNode* b){return a->val>b->val;};
    priority_queue<ListNode*,vector<ListNode*>,decltype(cmp)> pq(cmp);
    for (auto*l:lists) if(l) pq.push(l);
    ListNode dummy(0),*cur=&dummy;
    while(!pq.empty()){
        cur->next=pq.top();pq.pop();cur=cur->next;
        if(cur->next) pq.push(cur->next);
    }
    return dummy.next;
}`,
  },

  // ══════════════════════════════
  //  TREES  (47–50)
  // ══════════════════════════════
  {
    id: 47, section: "Trees", title: "Binary Tree Maximum Path Sum",
    difficulty: "Hard", frequency: "High", leetcode: 124,
    pattern: "DFS with global max — through vs return distinction",
    intuition: "At each node: THROUGH = val + leftGain + rightGain (update global max). RETURN to parent = val + max(left, right). Clamp negative gains to 0.",
    keyInsight: "'Through' uses BOTH child branches. 'Return' uses ONE (can't go both ways up). Same logic powers tree diameter.",
    approach: "1) DFS returns single-branch gain (clamped). 2) At each node: update global = val + L + R. 3) Return val + max(L,R).",
    complexity: "Time: O(N) | Space: O(H)",
    tabCode: `class Solution {
    int ans=INT_MIN;
public:
    int maxPathSum(TreeNode* root){dfs(root);return ans;}
    int dfs(TreeNode* node){
        if(!node) return 0;
        int L=max(dfs(node->left),0);
        int R=max(dfs(node->right),0);
        ans=max(ans,node->val+L+R);
        return node->val+max(L,R);
    }
};`,
  },
  {
    id: 48, section: "Trees", title: "LCA + Serialize / Deserialize",
    difficulty: "Medium", frequency: "High", leetcode: 236,
    pattern: "Recursive DFS — split point / preorder encoding",
    intuition: "LCA: first node where p and q are in DIFFERENT subtrees. Serialize: preorder with 'N' as null markers. Deserialize: read preorder, build recursively.",
    keyInsight: "Generic LCA: first node where both children return non-null = split point. Serialize needs null markers for UNIQUE reconstruction.",
    approach: "LCA: postorder — L && R → current is LCA. Serialize: preorder + 'N' for nulls.",
    complexity: "Time: O(N) | Space: O(H)",
    tabCode: `TreeNode* lowestCommonAncestor(TreeNode* root,TreeNode* p,TreeNode* q){
    if(!root||root==p||root==q) return root;
    auto*L=lowestCommonAncestor(root->left,p,q);
    auto*R=lowestCommonAncestor(root->right,p,q);
    if(L&&R) return root;
    return L?L:R;
}

class Codec{
public:
    string serialize(TreeNode* root){
        if(!root) return "N";
        return to_string(root->val)+","+serialize(root->left)+","+serialize(root->right);
    }
    TreeNode* deserialize(string data){istringstream ss(data);return build(ss);}
private:
    TreeNode* build(istringstream& ss){
        string tok;getline(ss,tok,',');
        if(tok=="N") return nullptr;
        auto*node=new TreeNode(stoi(tok));
        node->left=build(ss);node->right=build(ss);
        return node;
    }
};`,
  },
  {
    id: 49, section: "Trees", title: "Construct Binary Tree from Preorder + Inorder",
    difficulty: "Medium", frequency: "High", leetcode: 105,
    pattern: "Divide and conquer using inorder index map",
    intuition: "Preorder: first element = root. Inorder: root divides left/right subtrees. Hashmap for O(1) root index lookup in inorder. Recursively build left then right.",
    keyInsight: "Left subtree size = (inorder root index) - inStart. Map inorder values to indices for O(1) lookup.",
    approach: "1) Map inorder val→index. 2) preIdx tracks current root. 3) Recurse: root from preorder, split inorder at root's position.",
    complexity: "Time: O(N) | Space: O(N)",
    tabCode: `class Solution {
    unordered_map<int,int> inIdx;
    int preIdx=0;
public:
    TreeNode* buildTree(vector<int>& pre,vector<int>& in){
        for(int i=0;i<(int)in.size();i++) inIdx[in[i]]=i;
        return build(pre,0,in.size()-1);
    }
    TreeNode* build(vector<int>& pre,int inL,int inR){
        if(inL>inR) return nullptr;
        int rootVal=pre[preIdx++];
        auto*root=new TreeNode(rootVal);
        int mid=inIdx[rootVal];
        root->left=build(pre,inL,mid-1);
        root->right=build(pre,mid+1,inR);
        return root;
    }
};`,
  },
  {
    id: 50, section: "Trees", title: "Validate Binary Search Tree",
    difficulty: "Medium", frequency: "High", leetcode: 98,
    pattern: "DFS with valid range propagation",
    intuition: "At each node, pass down valid [min, max] range. Root has (-INF, +INF). Left child: (min, node->val). Right child: (node->val, max). Fail if node->val out of range.",
    keyInsight: "Common mistake: only check parent-child. You MUST propagate bounds top-down. All nodes in right subtree must be > root->val, not just > direct parent.",
    approach: "1) DFS with (node, lo, hi). 2) Invalid if val <= lo or val >= hi. 3) Recurse with updated bounds.",
    complexity: "Time: O(N) | Space: O(H)",
    tabCode: `class Solution {
public:
    bool isValidBST(TreeNode* root){return validate(root,LLONG_MIN,LLONG_MAX);}
    bool validate(TreeNode* node,long long lo,long long hi){
        if(!node) return true;
        if(node->val<=lo||node->val>=hi) return false;
        return validate(node->left,lo,node->val)&&validate(node->right,node->val,hi);
    }
};`,
  },

  // ══════════════════════════════
  //  BACKTRACKING  (51–52)
  // ══════════════════════════════
  {
    id: 51, section: "Backtracking", title: "Combination Sum + N-Queens",
    difficulty: "Hard", frequency: "High", leetcode: 39,
    pattern: "Choose-recurse-unchoose framework",
    intuition: "Combo Sum: allow reuse so recurse with same index i (not i+1). N-Queens: place row by row, track cols and diagonals with sets. (row-col) for '\\\\' diagonal, (row+col) for '/' diagonal.",
    keyInsight: "start index = combinations. swap indices = permutations. sort + skip = dedup. N-Queens: same '\\\\' diagonal = same (row-col), same '/' = same (row+col).",
    approach: "Combo: sort, prune, start idx allows reuse. N-Queens: row by row, check 3 constraints.",
    complexity: "Combo: O(N^(T/M)) | N-Queens: O(N!)",
    tabCode: `// Combination Sum (LC 39)
class Solution {
    vector<vector<int>> res;
public:
    vector<vector<int>> combinationSum(vector<int>& cands,int target){
        sort(cands.begin(),cands.end()); vector<int> path;
        bt(cands,target,0,path); return res;
    }
    void bt(vector<int>&c,int rem,int start,vector<int>&path){
        if(rem==0){res.push_back(path);return;}
        for(int i=start;i<(int)c.size()&&c[i]<=rem;i++){
            path.push_back(c[i]);bt(c,rem-c[i],i,path);path.pop_back();
        }
    }
};

// N-Queens (LC 51)
class NQueens{
    vector<vector<string>> res;
public:
    vector<vector<string>> solveNQueens(int n){
        vector<string> board(n,string(n,'.'));
        unordered_set<int> cols,d1,d2;
        solve(board,0,n,cols,d1,d2); return res;
    }
    void solve(vector<string>&b,int row,int n,unordered_set<int>&cols,unordered_set<int>&d1,unordered_set<int>&d2){
        if(row==n){res.push_back(b);return;}
        for(int c=0;c<n;c++){
            if(cols.count(c)||d1.count(row-c)||d2.count(row+c)) continue;
            b[row][c]='Q';cols.insert(c);d1.insert(row-c);d2.insert(row+c);
            solve(b,row+1,n,cols,d1,d2);
            b[row][c]='.';cols.erase(c);d1.erase(row-c);d2.erase(row+c);
        }
    }
};`,
  },

  // ══════════════════════════════
  //  LINKED LIST  (53–56)
  // ══════════════════════════════
  {
    id: 53, section: "Linked List", title: "Reverse Linked List + LRU Cache",
    difficulty: "Medium", frequency: "High", leetcode: 206,
    pattern: "Pointer reversal + DLL with HashMap",
    intuition: "Reverse: 3 pointers (prev, curr, next). LRU: HashMap O(1) lookup + DLL O(1) removal/insertion. Sentinel head/tail eliminate null-check edge cases.",
    keyInsight: "DLL + HashMap = O(1) for ALL LRU operations. Sentinel nodes remove null checks. Most frequently tested linked list combination at Apple/Qualcomm.",
    approach: "Reverse: save next, redirect, advance. LRU: get→move front. put→insert front, evict tail if overflow.",
    complexity: "Reverse: O(N)/O(1) | LRU: O(1) per op",
    tabCode: `ListNode* reverseList(ListNode* head) {
    ListNode*prev=nullptr,*curr=head;
    while(curr){auto*nxt=curr->next;curr->next=prev;prev=curr;curr=nxt;}
    return prev;
}

class LRUCache{
    struct Node{int k,v;Node*p,*n;};
    int cap; unordered_map<int,Node*> m; Node*head,*tail;
    void remove(Node*nd){nd->p->n=nd->n;nd->n->p=nd->p;}
    void addFront(Node*nd){nd->n=head->n;nd->p=head;head->n->p=nd;head->n=nd;}
public:
    LRUCache(int c):cap(c){head=new Node();tail=new Node();head->n=tail;tail->p=head;}
    int get(int key){if(!m.count(key))return -1;remove(m[key]);addFront(m[key]);return m[key]->v;}
    void put(int key,int val){
        if(m.count(key)){m[key]->v=val;remove(m[key]);addFront(m[key]);return;}
        auto*nd=new Node{key,val,nullptr,nullptr};m[key]=nd;addFront(nd);
        if((int)m.size()>cap){m.erase(tail->p->k);remove(tail->p);}
    }
};`,
  },
  {
    id: 54, section: "Linked List", title: "Cycle Detection (Floyd's Algorithm)",
    difficulty: "Easy", frequency: "High", leetcode: 141,
    pattern: "Floyd's Tortoise & Hare — slow/fast pointers",
    intuition: "I (detect): slow+fast meet iff cycle. II (find start): after meeting, move one to head, advance both at speed 1 — they meet at cycle start.",
    keyInsight: "Phase 2 math: 2*(slow dist) = fast dist. When both start at speed 1 — one from head, one from meeting point — they reach cycle entrance simultaneously.",
    approach: "I: fast/slow → meet if cycle. II: one to head, both speed 1 → meet at cycle start.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `bool hasCycle(ListNode*head){
    ListNode*slow=head,*fast=head;
    while(fast&&fast->next){slow=slow->next;fast=fast->next->next;if(slow==fast)return true;}
    return false;
}

ListNode*detectCycle(ListNode*head){
    ListNode*slow=head,*fast=head;
    while(fast&&fast->next){slow=slow->next;fast=fast->next->next;if(slow==fast)break;}
    if(!fast||!fast->next) return nullptr;
    slow=head;
    while(slow!=fast){slow=slow->next;fast=fast->next;}
    return slow;
}`,
  },
  {
    id: 55, section: "Linked List", title: "Copy List with Random Pointer",
    difficulty: "Medium", frequency: "Medium", leetcode: 138,
    pattern: "Interleave copy + random pointer linking",
    intuition: "O(1) space: interleave copies (A→A'→B→B'→...). Set random: copy->random = node->random->next. Extract: separate interleaved lists.",
    keyInsight: "The interleave trick: A'→random can be set as A→random→next because the copy follows the original in our interleaved list.",
    approach: "1) Interleave: insert copy after each node. 2) Set random pointers. 3) Extract copy list.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `Node* copyRandomList(Node* head) {
    if(!head) return nullptr;
    for(Node*cur=head;cur;cur=cur->next->next){
        Node*copy=new Node(cur->val);copy->next=cur->next;cur->next=copy;
    }
    for(Node*cur=head;cur;cur=cur->next->next)
        if(cur->random) cur->next->random=cur->random->next;
    Node*newHead=head->next;
    for(Node*cur=head;cur;cur=cur->next){
        Node*copy=cur->next;cur->next=copy->next;
        copy->next=copy->next?copy->next->next:nullptr;
    }
    return newHead;
}`,
  },

  // ══════════════════════════════
  //  STACK  (56)
  // ══════════════════════════════
  {
    id: 56, section: "Stack", title: "Valid Parentheses + Min Stack",
    difficulty: "Easy", frequency: "High", leetcode: 20,
    pattern: "LIFO matching + O(1) min tracking",
    intuition: "Valid Parentheses: push opening, pop on closing — check match. Min Stack: store (val, min_at_this_depth) pair — O(1) getMin().",
    keyInsight: "Min Stack: each entry is (val, min_so_far). getMin = top.second. No separate structure needed.",
    approach: "Parens: stack + match map. MinStack: each entry = {val, min_so_far}.",
    complexity: "Both: O(1) per op | Space: O(N)",
    tabCode: `bool isValid(string s) {
    stack<char> st;
    unordered_map<char,char> match={{')','{'},
        {']','['},{')','{'}};
    // correction:
    // match = {{')', '('}, {']', '['}, {'}', '{'}};
    for(char c:s){
        if(c=='('||c=='['||c=='{') st.push(c);
        else{if(st.empty()||st.top()!=(c==')'?'(':c==']'?'[':'{'))return false;st.pop();}
    }
    return st.empty();
}

class MinStack{
    stack<pair<int,int>> st;
public:
    void push(int val){int m=st.empty()?val:min(val,st.top().second);st.push({val,m});}
    void pop(){st.pop();}
    int top(){return st.top().first;}
    int getMin(){return st.top().second;}
};`,
  },

  // ══════════════════════════════
  //  TRIE  (57)
  // ══════════════════════════════
  {
    id: 57, section: "Trie", title: "Implement Trie",
    difficulty: "Medium", frequency: "High", leetcode: 208,
    pattern: "Prefix tree — O(L) per operation",
    intuition: "Node with children[26] + isEnd flag. Insert: create path. Search: traverse + check isEnd. StartsWith: traverse + check existence.",
    keyInsight: "Trie + grid backtracking = Word Search II. Build trie from words, DFS following trie edges. Shared prefixes are pruned once.",
    approach: "1) children[26] + isEnd. 2) Insert: walk/create nodes. 3) Search/StartsWith: walk, return existence/isEnd.",
    complexity: "Time: O(L) per op | Space: O(total chars × 26)",
    tabCode: `class Trie {
    struct Node{Node*ch[26]={};bool end=false;};
    Node*root;
    Node*find(const string&s){auto*n=root;for(char c:s){if(!n->ch[c-'a'])return nullptr;n=n->ch[c-'a'];}return n;}
public:
    Trie():root(new Node()){}
    void insert(string word){auto*n=root;for(char c:word){if(!n->ch[c-'a'])n->ch[c-'a']=new Node();n=n->ch[c-'a'];}n->end=true;}
    bool search(string word){auto*n=find(word);return n&&n->end;}
    bool startsWith(string prefix){return find(prefix)!=nullptr;}
};`,
  },

  // ══════════════════════════════
  //  SYSTEM DESIGN DSA  (58–61)
  // ══════════════════════════════
  {
    id: 58, section: "System Design DSA", title: "LRU Cache (Standalone)",
    difficulty: "Medium", frequency: "High", leetcode: 146,
    pattern: "HashMap + Doubly Linked List",
    intuition: "O(1) get and put. HashMap maps key→node. DLL orders by recency. On get: move node to front. On put: insert front, evict tail if over capacity.",
    keyInsight: "Sentinel head/tail nodes eliminate all null checks. The only tricky part is correctly wiring the DLL operations. Used in compiler caches, TLB, instruction caches.",
    approach: "See LRU implementation in problem 53 (Reverse + LRU).",
    complexity: "Time: O(1) per op | Space: O(capacity)",
    tabCode: `// See Problem 53 for full LRU Cache implementation.
// Key insight: HashMap<key, DLL_node*> + DLL with sentinels.
// get(k): find in map → move to front → return value.
// put(k,v): if exists → update + move front.
//           else → create node + insert front.
//           if over capacity → evict tail->prev.`,
  },
  {
    id: 59, section: "Two Pointers", title: "Longest Palindromic Substring",
    difficulty: "Medium", frequency: "High", leetcode: 5,
    pattern: "Expand around center — O(N²) time, O(1) space",
    intuition: "For each center (N odd + N-1 even = 2N-1 total centers), expand outward while chars match. Track longest palindrome found.",
    keyInsight: "Two types of centers: single char (odd palindromes) and gap between chars (even palindromes). Always try BOTH from each position.",
    approach: "1) For each i: expand odd (i,i) and even (i,i+1). 2) Track best start+length. 3) Return substring.",
    complexity: "Time: O(N²) | Space: O(1)",
    memoCode: `// DP approach: dp[i][j] = is s[i..j] palindrome?
string longestPalindrome_DP(string s) {
    int n=s.size(),start=0,maxLen=1;
    vector<vector<bool>> dp(n,vector<bool>(n,false));
    for(int i=0;i<n;i++) dp[i][i]=true;
    for(int i=0;i<n-1;i++) if(s[i]==s[i+1]){dp[i][i+1]=true;start=i;maxLen=2;}
    for(int len=3;len<=n;len++)
        for(int i=0;i+len-1<n;i++){
            int j=i+len-1;
            if(s[i]==s[j]&&dp[i+1][j-1]){dp[i][j]=true;if(len>maxLen){maxLen=len;start=i;}}
        }
    return s.substr(start,maxLen);
}`,
    tabCode: `// Expand around center — O(1) space
string longestPalindrome(string s) {
    int n=s.size(),start=0,maxLen=1;
    auto expand=[&](int l,int r){
        while(l>=0&&r<n&&s[l]==s[r]){l--;r++;}
        if(r-l-1>maxLen){maxLen=r-l-1;start=l+1;}
    };
    for(int i=0;i<n;i++){expand(i,i);expand(i,i+1);}
    return s.substr(start,maxLen);
}`,
  },
  {
    id: 61, section: "System Design DSA", title: "IPO Problem (Max Capital)",
    difficulty: "Hard", frequency: "Low", leetcode: 502,
    pattern: "Two heaps — greedy capital maximization",
    intuition: "At each step, pick most profitable affordable project. Min-heap gates projects by required capital. Max-heap selects by profit. Always taking max profit from available is greedy-optimal.",
    keyInsight: "Two heaps: min-heap(capital, profit) gates by capital, max-heap(profit) selects. Classic greedy + heap at Apple/AMD.",
    approach: "1) Sort projects by capital. 2) For k rounds: unlock affordable → max-heap. 3) Pick top profit. 4) Repeat.",
    complexity: "Time: O(N log N + k log N) | Space: O(N)",
    tabCode: `int findMaximizedCapital(int k,int w,vector<int>&profits,vector<int>&capital){
    int n=profits.size();
    vector<pair<int,int>> projects;
    for(int i=0;i<n;i++) projects.push_back({capital[i],profits[i]});
    sort(projects.begin(),projects.end());
    priority_queue<int> avail;
    int idx=0;
    for(int i=0;i<k;i++){
        while(idx<n&&projects[idx].first<=w){avail.push(projects[idx].second);idx++;}
        if(avail.empty()) break;
        w+=avail.top();avail.pop();
    }
    return w;
}`,
  },
  {
    id: 62, section: "HashMap", title: "Group Anagrams",
    difficulty: "Medium", frequency: "High", leetcode: 49,
    pattern: "Sort string as key",
    intuition: "Anagrams have identical sorted strings. Use sorted string as map key. O(NK log K) where K is max word length.",
    keyInsight: "Character counting (freq array) is O(NK) but sorting is often cleaner and fast enough for interview constraints.",
    approach: "Map<string, vector<string>>. Loop through, sort word, push to map bucket.",
    complexity: "Time: O(N * K log K) | Space: O(NK)",
    tabCode: `vector<vector<string>> groupAnagrams(vector<string>& strs) {
    unordered_map<string, vector<string>> m;
    for (string s : strs) {
        string t = s; sort(t.begin(), t.end());
        m[t].push_back(s);
    }
    vector<vector<string>> res;
    for (auto& p : m) res.push_back(p.second);
    return res;
}`
  },
  {
    id: 63, section: "HashMap", title: "Top K Frequent Elements",
    difficulty: "Medium", frequency: "High", leetcode: 347,
    pattern: "Frequency map + Bucket Sort",
    intuition: "O(N log K) with heap, but O(N) with bucket sort by using frequencies as indices. Frequencies are bounded by N.",
    keyInsight: "When range of counters is known and bounded (like counts in array of size N), bucket sort always beats heaps.",
    approach: "1) Count freq. 2) bucket[freq] = list of nums. 3) Iterate buckets from end.",
    complexity: "Time: O(N) | Space: O(N)",
    tabCode: `vector<int> topKFrequent(vector<int>& nums, int k) {
    unordered_map<int, int> count;
    for (int n : nums) count[n]++;
    vector<vector<int>> bucket(nums.size() + 1);
    for (auto& p : count) bucket[p.second].push_back(p.first);
    vector<int> res;
    for (int i = bucket.size() - 1; i >= 0 && res.size() < k; i--)
        for (int n : bucket[i]) { res.push_back(n); if (res.size() == k) break; }
    return res;
}`
  },
  {
    id: 64, section: "Array", title: "Find All Duplicates in an Array",
    difficulty: "Medium", frequency: "Medium", leetcode: 442,
    pattern: "Cyclic sort logic / Negation marking",
    intuition: "Numbers are 1 to n. Use current array as hash table by negating values at index abs(val)-1. If already negative, it's a duplicate.",
    keyInsight: "The nums[abs(n)-1] trick is the most efficient way to detect duplicates in [1,n] range with O(1) space.",
    approach: "1) result list. 2) for each n: idx = abs(n)-1. 3) if nums[idx] < 0, add abs(n) to res. else nums[idx] *= -1.",
    complexity: "Time: O(N) | Space: O(1) extra",
    tabCode: `vector<int> findDuplicates(vector<int>& nums) {
    vector<int> res;
    for (int n : nums) {
        int idx = abs(n) - 1;
        if (nums[idx] < 0) res.push_back(abs(n));
        else nums[idx] *= -1;
    }
    return res;
}`
  },
  {
    id: 65, section: "HashMap", title: "Valid Sudoku",
    difficulty: "Medium", frequency: "Medium", leetcode: 36,
    pattern: "Hashing row/col/box constraints",
    intuition: "Track used digits in rows, cols, and 3x3 boxes simultaneously. Box index = (r/3)*3 + (c/3). One pass validation.",
    keyInsight: "Bitmasking can reduce space for 1-9 checks to single integers, but hashsets/arrays are more readable for interviews.",
    approach: "1) row[9], col[9], box[9] tracking sets. 2) Iterate (r,c), check if already exists. 3) add to sets.",
    complexity: "Time: O(1) - fixed 9x9 | Space: O(1)",
    tabCode: `bool isValidSudoku(vector<vector<char>>& board) {
    int row[9][9] = {0}, col[9][9] = {0}, box[9][9] = {0};
    for (int r = 0; r < 9; r++) {
        for (int c = 0; c < 9; c++) {
            if (board[r][c] == '.') continue;
            int n = board[r][c] - '1', b = (r/3)*3 + (c/3);
            if (row[r][n] || col[c][n] || box[b][n]) return false;
            row[r][n] = col[c][n] = box[b][n] = 1;
        }
    }
    return true;
}`
},
{
  id: 66, section: "Sliding Window", title: "At Most K Distinct Characters",
  difficulty: "Hard", frequency: "Low", leetcode: 340,
  pattern: "Variable window + freq map",
  intuition: "Expand right. If distinct chars > k, shrink left while decrementing freq map. Remove char from map when freq reaches 0. Maximize window size.",
  keyInsight: "Use a hashmap to store the frequency of characters in the current window. The number of distinct characters is simply the size of the map.",
  approach: "1) map<char, int> 2) Expand R, map[s[R]]++ 3) while map.size() > k: map[s[L]]--, if map[s[L]]==0 map.erase(s[L]), L++ 4) ans = max(ans, R-L+1).",
  complexity: "Time: O(N) | Space: O(K)",
  tabCode: `int lengthOfLongestSubstringKDistinct(string s, int k) {
    if (k == 0) return 0;
    unordered_map<char, int> m;
    int l = 0, res = 0;
    for (int r = 0; r < s.size(); r++) {
        m[s[r]]++;
        while (m.size() > k) {
            if (--m[s[l]] == 0) m.erase(s[l]);
            l++;
        }
        res = max(res, r - l + 1);
    }
    return res;
}`
},
{
  id: 67, section: "Sliding Window", title: "Max Consecutive Ones III",
  difficulty: "Medium", frequency: "Medium", leetcode: 1004,
  pattern: "Sliding window 'k-zeroes' limit",
  intuition: "Find longest subarray with at most k zeroes. Expand R. If nums[R]==0, zeroes++. While zeroes > k, if nums[L]==0 zeroes--, L++.",
  keyInsight: "Standard variable window. Can be optimized into a 'non-shrinking' window (O(N) with just R-L total).",
  approach: "Expand R, track zeroes. If > k, move L until zeroes <= k.",
  complexity: "Time: O(N) | Space: O(1)",
  tabCode: `int longestOnes(vector<int>& nums, int k) {
    int l = 0, zeroes = 0, res = 0;
    for (int r = 0; r < nums.size(); r++) {
        if (nums[r] == 0) zeroes++;
        while (zeroes > k) {
            if (nums[l++] == 0) zeroes--;
        }
        res = max(res, r - l + 1);
    }
    return res;
}`
},
{
  id: 68, section: "Two Pointers", title: "Container With Most Water",
  difficulty: "Medium", frequency: "High", leetcode: 11,
  pattern: "Two pointers — converging from ends",
  intuition: "Area = min(h[L], h[R]) * (R-L). To potentially find a larger area, we must move the pointer with the SMALLER height, as it is the bottleneck.",
  keyInsight: "Proof: Moving the larger height can only decrease width and won't increase the bottlenecking height. Thus, moving smaller is the only way to improve.",
  approach: "L=0, R=n-1. While L<R: calculate area, move min(h[L], h[R]).",
  complexity: "Time: O(N) | Space: O(1)",
  tabCode: `int maxArea(vector<int>& height) {
    int l = 0, r = height.size() - 1, res = 0;
    while (l < r) {
        res = max(res, min(height[l], height[r]) * (r - l));
        if (height[l] < height[r]) l++;
        else r--;
    }
    return res;
}`
},
{
  id: 70, section: "Greedy", title: "Hand of Straights",
  difficulty: "Medium", frequency: "Low", leetcode: 846,
  pattern: "Frequency map + Sorted keys",
  intuition: "Must start with the smallest card available to form a group. Count frequencies, sort keys. For each card, try to form a group of size 'groupSize' starting from it.",
  keyInsight: "Always pick the smallest card first. If we can't form a group starting from the smallest, we can't form it at all.",
  approach: "1) Map frequencies. 2) Sorted keys or MinHeap. 3) While cards remain: take smallest, check if smallest+1...smallest+size-1 exist.",
  complexity: "Time: O(N log N) | Space: O(N)",
  tabCode: `bool isNStraightHand(vector<int>& hand, int groupSize) {
    if(hand.size() % groupSize != 0) return false;
    map<int, int> count;
    for(int x : hand) count[x]++;
    while(!count.empty()) {
        int start = count.begin()->first;
        for(int i=0; i<groupSize; i++) {
            if(count[start + i] == 0) return false;
            if(--count[start + i] == 0) count.erase(start + i);
        }
    }
    return true;
}`
},
{
  id: 72, section: "Stack", title: "Decode String",
  difficulty: "Medium", frequency: "Medium", leetcode: 394,
  pattern: "Dual stacks (Multiplier + String)",
  intuition: "nested structures 'k[string]'. Use a stack to save the current string and the multiplier when encountering '['. Pop and repeat when encountering ']'.",
  keyInsight: "Handle numbers digit-by-digit. When '[': push current state and reset. When ']': pop multiplier and previous string, append repeat.",
  approach: "1) stack<int> counts, stack<string> strStack. 2) if digit: update k. 3) if '[': push k, push res, reset. 4) if ']': pop and repeat.",
  complexity: "Time: O(N) | Space: O(N)",
  tabCode: `string decodeString(string s) {
    stack<int> counts; stack<string> strs;
    string res = ""; int k = 0;
    for(char c : s) {
        if(isdigit(c)) k = k * 10 + (c - '0');
        else if(c == '[') { counts.push(k); strs.push(res); k = 0; res = ""; }
        else if(c == ']') {
            string tmp = res; res = strs.top(); strs.pop();
            int repeat = counts.top(); counts.pop();
            while(repeat--) res += tmp;
        } else res += c;
    }
    return res;
}`
},
{
  id: 74, section: "Binary Search", title: "Koko Eating Bananas",
  difficulty: "Medium", frequency: "Medium", leetcode: 875,
  pattern: "Binary search on solution space",
  intuition: "Range of speed is [1, max(piles)]. For a speed K, calculate total hours. If hours <= H, try smaller K. If hours > H, must increase K.",
  keyInsight: "Monotonicity: If she can finish at speed S, she can finish at any speed > S. Binary search finds the 'tipping point' (minimum S).",
  approach: "1) low=1, high=max(piles). 2) mid = speed. 3) sum(ceil(p/mid)). 4) update range.",
  complexity: "Time: O(N log(MaxP)) | Space: O(1)",
  tabCode: `int minEatingSpeed(vector<int>& piles, int h) {
    int l = 1, r = *max_element(piles.begin(), piles.end());
    while (l < r) {
        int mid = l + (r - l) / 2, hours = 0;
        for (int p : piles) hours += (p + mid - 1) / mid;
        if (hours <= h) r = mid;
        else l = mid + 1;
    }
    return l;
}`
},
{
  id: 75, section: "Greedy", title: "Jump Game II",
  difficulty: "Medium", frequency: "Medium", leetcode: 45,
  pattern: "Greedy — BFS layered approach",
  intuition: "Find minimum jumps. At each jump, calculate the furthest point reachable from the current jump range. When we reach the end of current jump range, perform another jump.",
  keyInsight: "One-pass greedy: 'curEnd' tracks how far we can go with 'jumps', 'curFarthest' tracks the max reach for the NEXT jump.",
  approach: "1) curEnd=0, farthest=0, jumps=0. 2) Iterate i to n-1: farthest=max(farthest, i+nums[i]). 3) if i==curEnd: jumps++, curEnd=farthest.",
  complexity: "Time: O(N) | Space: O(1)",
  tabCode: `int jump(vector<int>& nums) {
    int jumps = 0, curEnd = 0, farthest = 0;
    for (int i = 0; i < (int)nums.size() - 1; i++) {
        farthest = max(farthest, i + nums[i]);
        if (i == curEnd) { jumps++; curEnd = farthest; }
    }
    return jumps;
}`
},
{
  id: 76, section: "Greedy", title: "Non-overlapping Intervals",
  difficulty: "Medium", frequency: "Medium", leetcode: 435,
  pattern: "Interval scheduling",
  intuition: "To minimize removals, maximize kept intervals. Sort by END TIME. Pick first, skip any that overlap with current end. Re-update end to new end.",
  keyInsight: "Sorting by end time is greedy-optimal because it leaves the most room for subsequent intervals.",
  approach: "1) Sort by end time. 2) Track end of last kept interval. 3) If start < lastEnd, increment removals. Else update lastEnd.",
  complexity: "Time: O(N log N) | Space: O(1)",
  tabCode: `int eraseOverlapIntervals(vector<vector<int>>& intervals) {
    sort(intervals.begin(), intervals.end(), [](auto& a, auto& b){ return a[1] < b[1]; });
    int count = 0, lastEnd = INT_MIN;
    for(auto& i : intervals) {
        if(i[0] >= lastEnd) lastEnd = i[1];
        else count++;
    }
    return count;
}`
},

  // ══════════════════════════════
  //  SEGMENT TREE / FENWICK  (ids 82–83)
  // ══════════════════════════════
  {
    id: 82, section: "Segment Tree", title: "Range Sum Query — Mutable",
    difficulty: "Medium", frequency: "Low", leetcode: 307,
    pattern: "Iterative segment tree — point update, range query",
    intuition: "A naive array gives O(1) update but O(N) range sum; a prefix-sum array gives O(1) query but O(N) update. A segment tree balances both at O(log N) each by storing partial sums in a binary tree laid flat in an array of size 2N. Leaves sit at [N, 2N); each internal node stores the sum of its two children.",
    keyInsight: "Build the tree in a flat array of size 2N. Leaf i lives at index i+N. Parent of node x is x/2; children are 2x and 2x+1. Update walks leaf→root fixing parents; query folds the [l, r) interval by climbing inward, adding any node that falls fully inside the range.",
    approach: "1) Place values at tree[i+N], build parents downward: tree[i]=tree[2i]+tree[2i+1]. 2) update(i,v): set leaf, climb i/=2 recomputing. 3) query(l,r): l+=N,r+=N; while l<r, if l odd add tree[l++], if r odd add tree[--r], then l/=2,r/=2.",
    complexity: "Time: O(log N) update & query, O(N) build | Space: O(N)",
    tabCode: `class NumArray {
    int n; vector<int> tree;          // flat segment tree, size 2n
public:
    NumArray(vector<int>& a) : n(a.size()), tree(2*a.size()) {
        for (int i = 0; i < n; i++) tree[i+n] = a[i];      // fill leaves
        for (int i = n-1; i > 0; i--) tree[i] = tree[2*i] + tree[2*i+1];
    }
    void update(int i, int val) {
        for (tree[i += n] = val; i > 1; i /= 2)            // climb to root
            tree[i/2] = tree[i] + tree[i^1];               // i^1 = sibling
    }
    int sumRange(int l, int r) {                            // inclusive [l,r]
        int res = 0; for (l += n, r += n+1; l < r; l /= 2, r /= 2) {
            if (l & 1) res += tree[l++];                   // l is a right child
            if (r & 1) res += tree[--r];                   // r is a right child
        }
        return res;
    }
};`
  },
  {
    id: 83, section: "Segment Tree", title: "Count of Smaller Numbers After Self",
    difficulty: "Hard", frequency: "Low", leetcode: 315,
    pattern: "Fenwick (BIT) over coordinate-compressed values, scan right→left",
    intuition: "For each element we want how many later elements are smaller. Scan from the RIGHT, and as we go, record each value in a Binary Indexed Tree keyed by RANK. Before inserting nums[i], query the BIT prefix sum of all ranks strictly less than rank(nums[i]) — that's exactly how many already-seen (i.e., to-the-right) elements are smaller.",
    keyInsight: "Coordinate-compress values to ranks 1..k so the BIT stays small. A Fenwick tree gives O(log N) prefix-sum and point-update with almost no constant factor — far simpler to code than a segment tree for this. Right-to-left scan converts 'smaller after self' into a prefix-count query.",
    approach: "1) Sort unique values → rank map. 2) BIT of size k. 3) For i=n-1..0: r=rank(nums[i]); res[i]=query(r-1); update(r,+1). 4) query(i)=sum of [1..i]; update(i,d): i+=i&-i.",
    complexity: "Time: O(N log N) | Space: O(N)",
    tabCode: `class BIT {
    vector<int> t;
public:
    BIT(int n) : t(n+1, 0) {}
    void update(int i, int d) { for (; i < (int)t.size(); i += i & -i) t[i] += d; }
    int  query (int i) { int s=0; for (; i > 0; i -= i & -i) s += t[i]; return s; }
};
vector<int> countSmaller(vector<int>& nums) {
    vector<int> sorted(nums);
    sort(sorted.begin(), sorted.end());
    sorted.erase(unique(sorted.begin(), sorted.end()), sorted.end());
    auto rank = [&](int x){                              // 1-indexed rank
        return int(lower_bound(sorted.begin(), sorted.end(), x) - sorted.begin()) + 1;
    };
    BIT bit(sorted.size());
    vector<int> res(nums.size());
    for (int i = nums.size()-1; i >= 0; --i) {
        int r = rank(nums[i]);
        res[i] = bit.query(r - 1);                       // strictly smaller seen so far
        bit.update(r, 1);
    }
    return res;
}`
  },

  // ══════════════════════════════
  //  TRIE + BACKTRACKING  (id 84)
  // ══════════════════════════════
  {
    id: 84, section: "Trie", title: "Word Search II",
    difficulty: "Hard", frequency: "Medium", leetcode: 212,
    pattern: "Build a Trie of words, then DFS the grid pruning by Trie edges",
    intuition: "Searching each word independently is O(words × cells × wordLen). Instead, build ONE Trie from all words and DFS the board once: at each cell, only continue down board directions that correspond to an existing Trie child. The Trie collapses shared prefixes, so thousands of words with common prefixes are explored together.",
    keyInsight: "Store the full word at the terminal Trie node so you can emit it on a hit without rebuilding the string. Prune aggressively: mark the visited cell, and after exploring, if a Trie node has no children left, you can detach it to shrink future work. The Trie turns the board DFS into a single shared traversal.",
    approach: "1) Insert all words; node.word = full word at end. 2) DFS(r,c,node): get char; if no child → return. 3) Descend child; if child.word → record + null it (dedupe). 4) Explore 4 neighbors with visited mark. 5) Backtrack.",
    complexity: "Time: O(M·N·4^L) worst, far less with pruning | Space: O(total chars)",
    tabCode: `struct Node { Node* nxt[26]={}; string word; };
class Solution {
    vector<string> res;
    void dfs(vector<vector<char>>& b, int r, int c, Node* n) {
        char ch = b[r][c];
        if (ch == '#' || !n->nxt[ch-'a']) return;        // pruned by Trie
        n = n->nxt[ch-'a'];
        if (!n->word.empty()) { res.push_back(n->word); n->word.clear(); } // dedupe
        b[r][c] = '#';                                   // mark visited
        int dr[]={-1,1,0,0}, dc[]={0,0,-1,1};
        for (int k = 0; k < 4; k++) {
            int nr=r+dr[k], nc=c+dc[k];
            if (nr>=0 && nr<(int)b.size() && nc>=0 && nc<(int)b[0].size())
                dfs(b, nr, nc, n);
        }
        b[r][c] = ch;                                    // restore
    }
public:
    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {
        Node* root = new Node();
        for (auto& w : words) {                          // build Trie
            Node* n = root;
            for (char ch : w) {
                if (!n->nxt[ch-'a']) n->nxt[ch-'a'] = new Node();
                n = n->nxt[ch-'a'];
            }
            n->word = w;
        }
        for (int r = 0; r < (int)board.size(); r++)
            for (int c = 0; c < (int)board[0].size(); c++)
                dfs(board, r, c, root);
        return res;
    }
};`
  },

  // ══════════════════════════════
  //  BIT MANIPULATION  (ids 85–86)
  // ══════════════════════════════
  {
    id: 85, section: "Bit Manipulation", title: "Single Number II",
    difficulty: "Medium", frequency: "Low", leetcode: 137,
    pattern: "Bitwise state machine — count bits mod 3 with two accumulators",
    intuition: "Every number appears 3× except one. For each bit position the total count of 1s is a multiple of 3, plus possibly 1 from the unique number. We could sum each of 32 bit columns mod 3, but a slicker O(1)-space trick uses two integers (ones, twos) acting as a 2-bit counter PER bit that resets when it reaches 3.",
    keyInsight: "Model each bit's occurrence count modulo 3 using two bitmasks: 'ones' holds bits seen 1×(mod 3), 'twos' holds bits seen 2×(mod 3). The update ones = (ones ^ x) & ~twos; twos = (twos ^ x) & ~ones; advances every bit's mini-counter 00→01→10→00. After processing all, 'ones' holds the unique number.",
    approach: "ones=twos=0. For each x: ones = (ones ^ x) & ~twos; twos = (twos ^ x) & ~ones. Return ones. Generalizes: for k-repeats use ceil(log2 k) masks or per-column count % k.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `int singleNumber(vector<int>& nums) {
    int ones = 0, twos = 0;          // two-bit per-column counter mod 3
    for (int x : nums) {
        ones = (ones ^ x) & ~twos;   // add x to 'ones', clear bits now in 'twos'
        twos = (twos ^ x) & ~ones;   // carry into 'twos', clear bits now in 'ones'
    }
    return ones;                     // bits seen exactly once (mod 3)
}
// Simpler-to-explain alternative — count each bit column mod 3:
int singleNumberColumns(vector<int>& nums) {
    int res = 0;
    for (int b = 0; b < 32; b++) {
        int cnt = 0;
        for (int x : nums) cnt += (x >> b) & 1;
        if (cnt % 3) res |= (1 << b);
    }
    return res;
}`
  },
  {
    id: 86, section: "Bit Manipulation", title: "Sum of Two Integers (no + or -)",
    difficulty: "Medium", frequency: "Medium", leetcode: 371,
    pattern: "Full-adder via XOR (sum) + AND<<1 (carry), loop until carry=0",
    intuition: "Addition decomposes into two independent pieces: the sum WITHOUT carry is a^b (XOR adds bit-by-bit ignoring overflow), and the carry is (a&b)<<1 (a carry is generated wherever both bits are 1, and it lands one position left). Re-add sum and carry repeatedly until there's no carry — that's exactly how a hardware ripple-carry adder works.",
    keyInsight: "XOR = addition mod 2 per bit; AND<<1 = the carries. Iterating sum/carry until carry is 0 emulates a full adder. Use unsigned for the shift to avoid signed-overflow UB on the carry propagation into the sign bit.",
    approach: "while (b != 0): carry = (unsigned)(a & b) << 1; a = a ^ b; b = carry. Return a. Subtraction: add the two's complement (~b + 1).",
    complexity: "Time: O(1) — at most 32 iterations | Space: O(1)",
    tabCode: `int getSum(int a, int b) {
    while (b != 0) {
        unsigned carry = (unsigned)(a & b) << 1;  // bits where BOTH are 1, shifted
        a = a ^ b;                                // add ignoring carry
        b = (int)carry;                           // propagate carry next round
    }
    return a;
}`
  },

  // ══════════════════════════════
  //  MATH — FAST EXPONENTIATION  (id 87)
  // ══════════════════════════════
  {
    id: 87, section: "Math", title: "Pow(x, n) — Fast Exponentiation",
    difficulty: "Medium", frequency: "Medium", leetcode: 50,
    pattern: "Binary exponentiation — square the base, consume exponent bits",
    intuition: "Computing x^n by multiplying x n times is O(n). But x^n = (x^(n/2))^2 when n is even, and x·(x^(n/2))^2 when n is odd. Each step halves the exponent, giving O(log n). Equivalently: read the exponent's bits; square the running base each step and multiply it into the result wherever a bit is set.",
    keyInsight: "Handle negative n by inverting: x^(-n) = (1/x)^n. The cast to long long before negating INT_MIN avoids overflow (−INT_MIN doesn't fit in int). This 'square-and-multiply' is the same routine used for modular exponentiation in crypto.",
    approach: "1) long long N=n; if N<0 {x=1/x; N=-N;}. 2) result=1. 3) while N: if N&1 result*=x; x*=x; N>>=1. 4) return result.",
    complexity: "Time: O(log n) | Space: O(1)",
    tabCode: `double myPow(double x, int n) {
    long long N = n;                 // widen so -INT_MIN is representable
    if (N < 0) { x = 1 / x; N = -N; }
    double result = 1.0;
    while (N) {
        if (N & 1) result *= x;      // this exponent bit is set
        x *= x;                      // square the base
        N >>= 1;                     // next bit
    }
    return result;
}`
  },

  // ══════════════════════════════
  //  HEAP — TWO-HEAP MEDIAN  (id 88)
  // ══════════════════════════════
  {
    id: 88, section: "Heap", title: "Find Median from Data Stream",
    difficulty: "Hard", frequency: "High", leetcode: 295,
    pattern: "Two balanced heaps — max-heap (low half) + min-heap (high half)",
    intuition: "To get the median in O(1) we keep the lower half of numbers in a MAX-heap and the upper half in a MIN-heap. The two tops straddle the median. By keeping the heaps' sizes balanced (differ by ≤1), the median is either the max-heap top (odd count) or the average of both tops (even count).",
    keyInsight: "Always push to one heap then 'rebalance' by moving its top to the other, and fix sizes so low.size() ≥ high.size(). Insertion is O(log N) (heap push/pop), median is O(1). This beats keeping a sorted array (O(N) insert).",
    approach: "addNum: push to low(max-heap); move low.top to high; if high>low, move high.top back to low. findMedian: low.size>high.size ? low.top : (low.top+high.top)/2.",
    complexity: "Time: O(log N) add, O(1) median | Space: O(N)",
    tabCode: `class MedianFinder {
    priority_queue<int> low;                                  // max-heap: lower half
    priority_queue<int, vector<int>, greater<int>> high;      // min-heap: upper half
public:
    void addNum(int num) {
        low.push(num);
        high.push(low.top()); low.pop();        // funnel largest of low into high
        if (high.size() > low.size()) {         // keep low >= high
            low.push(high.top()); high.pop();
        }
    }
    double findMedian() {
        if (low.size() > high.size()) return low.top();
        return (low.top() + high.top()) / 2.0;  // even count → average of tops
    }
};`
  },

  // ══════════════════════════════
  //  QUICKSELECT  (id 89)
  // ══════════════════════════════
  {
    id: 89, section: "Quickselect", title: "Kth Largest Element in an Array",
    difficulty: "Medium", frequency: "High", leetcode: 215,
    pattern: "Quickselect — Lomuto partition, recurse into one side only",
    intuition: "A heap solves this in O(N log k), but Quickselect averages O(N): partition around a pivot like quicksort, but after partitioning you know the pivot's FINAL sorted position. If that position is the one you want, you're done; otherwise recurse into ONLY the side that contains the target — discarding the other half each time gives the linear average.",
    keyInsight: "The k-th LARGEST is the (n-k)-th smallest index in ascending order. Randomize the pivot (or shuffle) to avoid the O(N²) adversarial worst case on sorted input. Unlike quicksort you never recurse into both sides — that's what drops N log N to N on average.",
    approach: "target = n-k. partition(l,r): pivot=a[r]; i=l; for j in [l,r): if a[j]<pivot swap(a[i++],a[j]); swap(a[i],a[r]); return i. If i==target return; else recurse left/right half.",
    complexity: "Time: O(N) average, O(N²) worst | Space: O(1) iterative",
    tabCode: `int findKthLargest(vector<int>& a, int k) {
    int target = a.size() - k;                  // k-th largest = (n-k)-th smallest
    int lo = 0, hi = a.size() - 1;
    while (lo <= hi) {
        int p = lo + rand() % (hi - lo + 1);    // randomized pivot
        swap(a[p], a[hi]);
        int pivot = a[hi], i = lo;
        for (int j = lo; j < hi; ++j)           // Lomuto partition
            if (a[j] < pivot) swap(a[i++], a[j]);
        swap(a[i], a[hi]);                       // pivot lands at its sorted index i
        if (i == target) return a[i];
        else if (i < target) lo = i + 1;        // recurse RIGHT side only
        else hi = i - 1;                         // recurse LEFT side only
    }
    return -1;
}`
  },

  // ══════════════════════════════
  //  BINARY SEARCH — HARD  (id 90)
  // ══════════════════════════════
  {
    id: 90, section: "Binary Search", title: "Median of Two Sorted Arrays",
    difficulty: "Hard", frequency: "High", leetcode: 4,
    pattern: "Binary search on the partition point of the smaller array",
    intuition: "The median splits the merged array into a left half and a right half of equal size, where every left element ≤ every right element. Instead of merging (O(N+M)), binary-search WHERE to cut the smaller array; the cut in the larger array is then forced by the size constraint. Check the four boundary elements to know if the cut is correct.",
    keyInsight: "Always binary-search the SMALLER array to guarantee O(log(min(N,M))). The partition is valid when maxLeftA ≤ minRightB AND maxLeftB ≤ minRightA. Use ±infinity sentinels for out-of-range boundaries so edge cuts (empty halves) need no special casing.",
    approach: "Ensure A is smaller. lo=0,hi=m. cutA=(lo+hi)/2; cutB=(m+n+1)/2-cutA. L1=A[cutA-1]||-inf, R1=A[cutA]||+inf, L2,R2 sym. If L1<=R2 && L2<=R1 → median. Else if L1>R2 hi=cutA-1 else lo=cutA+1.",
    complexity: "Time: O(log(min(N,M))) | Space: O(1)",
    tabCode: `double findMedianSortedArrays(vector<int>& A, vector<int>& B) {
    if (A.size() > B.size()) swap(A, B);        // binary-search the SMALLER one
    int m = A.size(), n = B.size(), lo = 0, hi = m;
    const long INF = LONG_MAX, NEG = LONG_MIN;
    while (lo <= hi) {
        int cutA = (lo + hi) / 2;
        int cutB = (m + n + 1) / 2 - cutA;
        long L1 = cutA ? A[cutA-1] : NEG, R1 = cutA < m ? A[cutA] : INF;
        long L2 = cutB ? B[cutB-1] : NEG, R2 = cutB < n ? B[cutB] : INF;
        if (L1 <= R2 && L2 <= R1) {             // correct partition found
            if ((m + n) & 1) return max(L1, L2);
            return (max(L1, L2) + min(R1, R2)) / 2.0;
        } else if (L1 > R2) hi = cutA - 1;      // A's cut too far right
        else                lo = cutA + 1;      // A's cut too far left
    }
    return 0.0;
}`
  },

  // ══════════════════════════════
  //  INTERVAL DP — BURST BALLOONS  (id 91)
  // ══════════════════════════════
  {
    id: 91, section: "DP — Interval / Game", title: "Burst Balloons",
    difficulty: "Hard", frequency: "Low", leetcode: 312,
    pattern: "Interval DP — fix the LAST balloon burst in each window",
    intuition: "If you think about the FIRST balloon to burst, the array keeps changing and subproblems aren't independent. The trick is to fix the LAST balloon k burst inside an open interval (i, j): when k is last, its neighbors are exactly the fixed walls i and j, so the gain is nums[i]·nums[k]·nums[j] plus the two now-independent subintervals (i,k) and (k,j).",
    keyInsight: "Pad the array with 1s on both ends so boundary multiplications are clean. Iterate by interval LENGTH so smaller subintervals are solved first. Choosing the last burst (not the first) is what decouples the left and right subproblems — the signature insight of interval DP.",
    approach: "1) a = [1] + nums + [1]. 2) dp[i][j] = best for open interval (i,j). 3) For len 2..n+1, for each i, j=i+len: dp[i][j]=max over k in (i,j) of dp[i][k]+dp[k][j]+a[i]*a[k]*a[j]. 4) Answer dp[0][n+1].",
    complexity: "Time: O(N³) | Space: O(N²)",
    memoCode: `// TOP-DOWN: recursion on open interval (i, j)
int dp[302][302];
int solve(vector<int>& a, int i, int j) {
    if (i + 1 == j) return 0;                    // no balloon between walls
    if (dp[i][j] != -1) return dp[i][j];
    int best = 0;
    for (int k = i + 1; k < j; k++)              // k = LAST balloon burst in (i,j)
        best = max(best, solve(a,i,k) + solve(a,k,j) + a[i]*a[k]*a[j]);
    return dp[i][j] = best;
}
int maxCoins(vector<int>& nums) {
    vector<int> a = {1};
    a.insert(a.end(), nums.begin(), nums.end()); a.push_back(1);
    memset(dp, -1, sizeof dp);
    return solve(a, 0, a.size() - 1);
}`,
    tabCode: `// BOTTOM-UP: iterate by interval length
int maxCoins(vector<int>& nums) {
    int n = nums.size();
    vector<int> a(n + 2, 1);
    for (int i = 0; i < n; i++) a[i+1] = nums[i];
    vector<vector<int>> dp(n + 2, vector<int>(n + 2, 0));
    for (int len = 2; len <= n + 1; len++)       // distance between the two walls
        for (int i = 0; i + len <= n + 1; i++) {
            int j = i + len;
            for (int k = i + 1; k < j; k++)       // last balloon burst between i,j
                dp[i][j] = max(dp[i][j],
                               dp[i][k] + dp[k][j] + a[i]*a[k]*a[j]);
        }
    return dp[0][n + 1];
}`
  },

  // ══════════════════════════════
  //  BACKTRACKING — N-QUEENS  (id 92)
  // ══════════════════════════════
  {
    id: 92, section: "Backtracking", title: "N-Queens",
    difficulty: "Hard", frequency: "High", leetcode: 51,
    pattern: "Row-by-row backtracking with O(1) column/diagonal conflict sets",
    intuition: "Place exactly one queen per row, trying each column. A placement is legal if no earlier queen shares the column or either diagonal. Track three boolean sets so each conflict check is O(1): the column index, the ↘ diagonal (row−col, offset to stay non-negative), and the ↙ diagonal (row+col). Recurse to the next row; backtrack by clearing the marks.",
    keyInsight: "Both diagonals have a constant value along their length: r−c is fixed on a ↘ diagonal, r+c on a ↙ diagonal. Encoding conflicts as three bitsets (or three bool arrays) turns the validity test from O(N) scanning into O(1), which is what makes N-Queens tractable for N up to ~13.",
    approach: "solve(row): if row==n record board. For col 0..n-1: if !col[c] && !diag1[r-c+n] && !diag2[r+c]: mark all three + place; solve(row+1); unmark + remove. Diagonals offset by +n to keep indices ≥ 0.",
    complexity: "Time: O(N!) | Space: O(N²) board + O(N) recursion",
    tabCode: `class Solution {
    int n; vector<vector<string>> res;
    vector<bool> col, d1, d2;                 // column, r-c diag, r+c diag
    vector<string> board;
    void solve(int r) {
        if (r == n) { res.push_back(board); return; }
        for (int c = 0; c < n; c++) {
            if (col[c] || d1[r - c + n] || d2[r + c]) continue;   // O(1) check
            col[c] = d1[r-c+n] = d2[r+c] = true;
            board[r][c] = 'Q';
            solve(r + 1);
            col[c] = d1[r-c+n] = d2[r+c] = false;                 // backtrack
            board[r][c] = '.';
        }
    }
public:
    vector<vector<string>> solveNQueens(int N) {
        n = N; col.assign(n,0); d1.assign(2*n,0); d2.assign(2*n,0);
        board.assign(n, string(n, '.'));
        solve(0);
        return res;
    }
};`
  },

  // ══════════════════════════════
  //  TWO POINTERS — 3SUM  (id 93)
  // ══════════════════════════════
  {
    id: 93, section: "Two Pointers", title: "3Sum",
    difficulty: "Medium", frequency: "High", leetcode: 15,
    pattern: "Sort + fix one element + two-pointer scan for the remaining pair",
    intuition: "Brute force is O(N³). Sort the array, then fix the first number a[i] and reduce the problem to '2Sum on a sorted array' for the rest: a left pointer just after i and a right pointer at the end converge based on whether the running sum is too small (move left up) or too big (move right down). Sorting also makes deduping trivial.",
    keyInsight: "Skip duplicates at all three positions: for i (the fixed element) and for both pointers after recording a hit. Once a[i] > 0 you can stop entirely — three sorted non-negative numbers can't sum to zero. The sort costs O(N log N); the scan is O(N²) but with a tiny constant.",
    approach: "Sort. For i in 0..n-3 (skip dup a[i]): if a[i]>0 break. l=i+1,r=n-1. While l<r: s=a[i]+a[l]+a[r]. s<0→l++; s>0→r--; s==0→record, then skip dup l and r, l++,r--.",
    complexity: "Time: O(N²) | Space: O(1) extra (ignoring output / sort)",
    tabCode: `vector<vector<int>> threeSum(vector<int>& a) {
    sort(a.begin(), a.end());
    vector<vector<int>> res;
    int n = a.size();
    for (int i = 0; i < n - 2; ++i) {
        if (a[i] > 0) break;                         // no zero-sum triple possible
        if (i && a[i] == a[i-1]) continue;           // skip duplicate fixed element
        int l = i + 1, r = n - 1;
        while (l < r) {
            int s = a[i] + a[l] + a[r];
            if (s < 0) ++l;
            else if (s > 0) --r;
            else {
                res.push_back({a[i], a[l], a[r]});
                while (l < r && a[l] == a[l+1]) ++l;  // skip dup left
                while (l < r && a[r] == a[r-1]) --r;  // skip dup right
                ++l; --r;
            }
        }
    }
    return res;
}`
  },

  // ══════════════════════════════
  //  MONOTONIC STACK — DAILY TEMPS  (id 94)
  // ══════════════════════════════
  {
    id: 94, section: "Monotonic Stack", title: "Daily Temperatures",
    difficulty: "Medium", frequency: "Medium", leetcode: 739,
    pattern: "Monotonic decreasing stack of indices — resolve on a higher value",
    intuition: "For each day we want the number of days until a warmer temperature. Keep a stack of indices whose answers are still PENDING, in decreasing-temperature order. When today's temperature is higher than the temperature at the stack top, today is that day's answer — pop it and record the index distance. Each index is pushed and popped once.",
    keyInsight: "Store INDICES, not temperatures, so you can compute the day gap (i − poppedIndex). The stack stays monotonically decreasing, so every element is resolved exactly when the first warmer day appears — giving amortized O(N) despite the inner while-loop.",
    approach: "stack of indices. For i in 0..n-1: while stack non-empty and T[i] > T[stack.top]: j=pop; ans[j]=i-j. push i. Remaining indices keep answer 0 (no warmer future day).",
    complexity: "Time: O(N) amortized | Space: O(N)",
    tabCode: `vector<int> dailyTemperatures(vector<int>& T) {
    int n = T.size();
    vector<int> ans(n, 0);
    stack<int> st;                               // indices, decreasing temperature
    for (int i = 0; i < n; ++i) {
        while (!st.empty() && T[i] > T[st.top()]) {
            int j = st.top(); st.pop();
            ans[j] = i - j;                      // i is the first warmer day for j
        }
        st.push(i);
    }
    return ans;
}`
  },

  // ══════════════════════════════
  //  TOPO SORT — ALIEN DICTIONARY  (id 95)
  // ══════════════════════════════
  {
    id: 95, section: "Graph — Topo Sort", title: "Alien Dictionary",
    difficulty: "Hard", frequency: "High", leetcode: 269,
    pattern: "Build a precedence graph from adjacent words, Kahn's topo sort",
    intuition: "The dictionary order encodes letter precedence: comparing two adjacent words, the FIRST position where they differ tells you the left word's letter comes before the right word's letter. Build a directed graph of those constraints over the alphabet, then a topological order of that graph is a valid letter ordering. A cycle means the input is contradictory (invalid).",
    keyInsight: "Two traps: (1) the very first differing character is the ONLY constraint a word pair gives — stop there. (2) If a word is a PREFIX of the previous word (e.g., 'abc' before 'ab'), that's invalid and you must return \"\". Use Kahn's BFS so detecting a leftover (cycle) is just 'did we output every seen letter?'.",
    approach: "1) Collect all letters. 2) For each adjacent pair: find first diff char (c1,c2); add edge c1→c2, indeg[c2]++; if no diff but word1 longer → return \"\". 3) Kahn: queue indeg-0 letters, pop→append→decrement neighbors. 4) If result covers all letters return it, else \"\".",
    complexity: "Time: O(total chars) | Space: O(1) — bounded alphabet (26)",
    tabCode: `string alienOrder(vector<string>& words) {
    unordered_map<char, unordered_set<char>> g;
    unordered_map<char, int> indeg;
    for (auto& w : words) for (char c : w) indeg[c];   // register every letter
    for (int i = 0; i + 1 < (int)words.size(); ++i) {
        string& a = words[i]; string& b = words[i+1];
        int len = min(a.size(), b.size()), j = 0;
        for (; j < len; ++j) if (a[j] != b[j]) {
            if (!g[a[j]].count(b[j])) { g[a[j]].insert(b[j]); indeg[b[j]]++; }
            break;
        }
        if (j == len && a.size() > b.size()) return "";  // prefix conflict → invalid
    }
    queue<char> q;
    for (auto& [c, d] : indeg) if (d == 0) q.push(c);
    string res;
    while (!q.empty()) {
        char c = q.front(); q.pop(); res += c;
        for (char nx : g[c]) if (--indeg[nx] == 0) q.push(nx);
    }
    return res.size() == indeg.size() ? res : "";        // leftover ⇒ cycle
}`
  },

  // ══════════════════════════════
  //  GREEDY — GAS STATION  (id 96)
  // ══════════════════════════════
  {
    id: 96, section: "Greedy", title: "Gas Station",
    difficulty: "Medium", frequency: "Medium", leetcode: 134,
    pattern: "Single-pass greedy — reset start when the running tank goes negative",
    intuition: "If the total gas ≥ total cost, a solution exists and is unique. The greedy insight: track a running tank as you move forward; the moment it dips below zero at station i, NONE of the stations from the current start through i can be a valid start (they all fail before or at i). So jump the candidate start to i+1 and reset the tank.",
    keyInsight: "Two accumulators: 'total' (over the whole loop, to decide feasibility) and 'tank' (since the last reset, to pick the start). The proof that the surviving start works rests on total ≥ 0 — once feasibility is guaranteed, the last reset point must complete the circuit.",
    approach: "total=tank=0, start=0. For i in 0..n-1: diff=gas[i]-cost[i]; total+=diff; tank+=diff; if tank<0 {start=i+1; tank=0;}. Return total>=0 ? start : -1.",
    complexity: "Time: O(N) | Space: O(1)",
    tabCode: `int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {
    int total = 0, tank = 0, start = 0;
    for (int i = 0; i < (int)gas.size(); ++i) {
        int diff = gas[i] - cost[i];
        total += diff;                 // overall feasibility
        tank  += diff;                 // tank since the last candidate start
        if (tank < 0) {                // can't reach i+1 from current start
            start = i + 1;             // every station up to i is ruled out
            tank = 0;
        }
    }
    return total >= 0 ? start : -1;
}`
  },

  // ══════════════════════════════
  //  UNION FIND — CONNECTED COMPONENTS  (id 97)
  // ══════════════════════════════
  {
    id: 97, section: "Graph — Union Find", title: "Number of Connected Components",
    difficulty: "Medium", frequency: "Medium", leetcode: 323,
    pattern: "Disjoint Set Union with path compression + union by rank",
    intuition: "Start with n isolated nodes, hence n components. Each edge potentially merges two components: if the endpoints already share a root, the edge is redundant; if not, union them and decrement the component count. DSU answers 'are these connected?' in near-O(1) amortized, far cheaper than running a fresh DFS per query.",
    keyInsight: "The two optimizations are what make DSU nearly O(1): PATH COMPRESSION flattens find() by repointing nodes straight to the root, and UNION BY RANK attaches the shorter tree under the taller. Together they give the inverse-Ackermann α(n) bound — effectively constant. Counting components = n minus the number of SUCCESSFUL unions.",
    approach: "parent[i]=i, rank[i]=0, count=n. find(x): if parent[x]!=x parent[x]=find(parent[x]); return. union(a,b): ra=find(a),rb=find(b); if ra==rb return; attach by rank; count--. Answer = count.",
    complexity: "Time: O(E·α(N)) ≈ O(E) | Space: O(N)",
    tabCode: `class DSU {
    vector<int> parent, rank_;
public:
    int count;
    DSU(int n) : parent(n), rank_(n, 0), count(n) {
        iota(parent.begin(), parent.end(), 0);   // each node is its own root
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);  // path compression
        return parent[x];
    }
    void unite(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return;                    // already connected → redundant
        if (rank_[ra] < rank_[rb]) swap(ra, rb); // union by rank
        parent[rb] = ra;
        if (rank_[ra] == rank_[rb]) rank_[ra]++;
        --count;                                 // two components became one
    }
};
int countComponents(int n, vector<vector<int>>& edges) {
    DSU dsu(n);
    for (auto& e : edges) dsu.unite(e[0], e[1]);
    return dsu.count;
}`
  },

  // ══════════════════════════════
  //  INTERVALS  (id 98, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 98, section: "Intervals", title: "Meeting Rooms II (minimum rooms)",
    difficulty: "Medium", frequency: "High", leetcode: 253,
    pattern: "Sweep line — sort starts and ends separately",
    intuition: "A room is needed for every meeting that starts before the earliest-ending active meeting ends. Sort starts and ends independently; walk the starts; each start either opens a new room (start < earliest end) or reuses the room that just freed (advance the end pointer).",
    keyInsight: "You never need to know WHICH meeting ended, only that one did. Separating starts from ends turns an interval problem into two sorted streams. Equivalent formulation: a min-heap of end times, pop while top <= start.",
    approach: "1) starts = sorted start times, ends = sorted end times. 2) j = 0, rooms = 0. 3) for each start: if start < ends[j] rooms++ else j++. 4) rooms never decreases; return it.",
    complexity: "Time: O(N log N) for the sorts | Space: O(N)",
    tabCode: `// Two sorted streams (sweep line). rooms only ever grows: the answer is the final count.
int minMeetingRooms(vector<vector<int>>& iv) {
    vector<int> starts, ends;
    for (auto& v : iv) { starts.push_back(v[0]); ends.push_back(v[1]); }
    sort(starts.begin(), starts.end());
    sort(ends.begin(), ends.end());
    int rooms = 0, j = 0;
    for (int s : starts) {
        if (s < ends[j]) rooms++;       // starts before the earliest active meeting ends: new room
        else j++;                       // that meeting ended: reuse its room (rooms unchanged)
    }
    return rooms;
}
// Heap version (same complexity): sort by start; min-heap of end times;
// for each meeting: if heap.top() <= start, pop; push end; answer = max heap size.`,
  },

  // ══════════════════════════════
  //  MATRIX  (id 99, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 99, section: "Matrix", title: "Spiral Matrix",
    difficulty: "Medium", frequency: "High", leetcode: 54,
    pattern: "Shrinking boundaries",
    intuition: "Keep four boundaries (top, bottom, left, right). Walk the top row left→right, the right column top→bottom, then, if rows remain, the bottom row right→left, and, if columns remain, the left column bottom→top. Shrink each boundary after its pass.",
    keyInsight: "The two guards (top <= bottom before the bottom row, left <= right before the left column) are the whole difficulty: they stop a single remaining row or column from being emitted twice.",
    approach: "1) Init boundaries. 2) while top<=bottom && left<=right: four passes with the two guards. 3) Return the list.",
    complexity: "Time: O(M×N) | Space: O(1) extra",
    tabCode: `vector<int> spiralOrder(vector<vector<int>>& m) {
    vector<int> out;
    if (m.empty()) return out;
    int top = 0, bottom = (int)m.size() - 1, left = 0, right = (int)m[0].size() - 1;
    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; c++) out.push_back(m[top][c]);
        top++;
        for (int r = top; r <= bottom; r++) out.push_back(m[r][right]);
        right--;
        if (top <= bottom) {                                  // guard: a single remaining row
            for (int c = right; c >= left; c--) out.push_back(m[bottom][c]);
            bottom--;
        }
        if (left <= right) {                                  // guard: a single remaining column
            for (int r = bottom; r >= top; r--) out.push_back(m[r][left]);
            left++;
        }
    }
    return out;
}`,
  },

  // ══════════════════════════════
  //  STRING PARSING  (id 100, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 100, section: "String Parsing", title: "Basic Calculator II (+ − × ÷ with precedence)",
    difficulty: "Medium", frequency: "High", leetcode: 227,
    pattern: "One-pass with a stack of signed terms",
    intuition: "Precedence without recursion: keep a stack of terms. On + or −, push the (signed) number. On × or ÷, combine the number with the top of the stack immediately, because × and ÷ bind tighter. At the end, sum the stack.",
    keyInsight: "Apply the PREVIOUS operator when you reach the NEXT one (or the end of the string). Integer division in C++ truncates toward zero, which is what the problem asks for; do not use floor.",
    approach: "1) num = 0, op = '+', stack. 2) For each char: accumulate digits; when an operator (or the last char) arrives, apply op with num, then op = char, num = 0. 3) Sum the stack.",
    complexity: "Time: O(N) | Space: O(N) for the stack (O(1) with a running total + last term)",
    tabCode: `int calculate(string s) {
    vector<long> st; long num = 0; char op = '+';
    for (size_t i = 0; i < s.size(); i++) {
        char c = s[i];
        if (isdigit((unsigned char)c)) num = num * 10 + (c - '0');
        bool isOp = !isdigit((unsigned char)c) && c != ' ';
        if (isOp || i == s.size() - 1) {                       // apply the PREVIOUS operator
            if (op == '+') st.push_back(num);
            else if (op == '-') st.push_back(-num);
            else if (op == '*') st.back() *= num;
            else st.back() /= num;                             // truncates toward zero
            op = c; num = 0;
        }
    }
    long sum = 0; for (long v : st) sum += v;
    return (int)sum;
}`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 101, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 101, section: "Design", title: "Flatten Nested List Iterator",
    difficulty: "Medium", frequency: "Medium", leetcode: 341,
    pattern: "Explicit stack of (iterator, end) pairs — lazy DFS",
    intuition: "Flattening eagerly is easy but wrong for a huge or infinite structure. Keep a stack of iterator ranges, one per nesting level; hasNext() advances until the top points at an integer, descending into lists and popping exhausted ranges.",
    keyInsight: "All the work is in a single settle() routine called by both hasNext() and next(); next() must be correct even if hasNext() was never called. Advance the parent iterator BEFORE pushing the child so the list is not revisited.",
    approach: "1) Push (begin, end) of the outer list. 2) settle(): while stack non-empty: if top exhausted pop; else if top is an integer return; else push the child's range after advancing the parent. 3) next(): settle, return *cur++.",
    complexity: "Time: amortized O(1) per element | Space: O(depth)",
    tabCode: `// Uses LeetCode's NestedInteger interface: isInteger(), getInteger(), getList().
class NestedIterator {
    using It = vector<NestedInteger>::iterator;
    vector<pair<It, It>> st;                                   // (cur, end) per nesting level
    void settle() {                                            // make the top point at an integer, or empty the stack
        while (!st.empty()) {
            if (st.back().first == st.back().second) { st.pop_back(); continue; }
            if (st.back().first->isInteger()) return;
            auto& lst = st.back().first->getList();
            ++st.back().first;                                 // advance the parent BEFORE descending
            st.push_back({lst.begin(), lst.end()});
        }
    }
public:
    NestedIterator(vector<NestedInteger>& nestedList) { st.push_back({nestedList.begin(), nestedList.end()}); }
    bool hasNext() { settle(); return !st.empty(); }
    int next() { settle(); return (st.back().first++)->getInteger(); }
};`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 102, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 102, section: "Design", title: "LFU Cache",
    difficulty: "Hard", frequency: "Medium", leetcode: 460,
    pattern: "Frequency buckets of LRU lists + key → (value, freq, iterator)",
    intuition: "LRU needs one list; LFU needs one list PER frequency (each list ordered by recency), plus the minimum frequency. get/put move a key from its frequency list to the next one in O(1) with a stored list iterator. Eviction pops the back of the min-frequency list.",
    keyInsight: "minFreq only ever needs two updates: set to 1 on any insertion, and incremented when the key you just promoted emptied the min-frequency list. Never scan for the minimum.",
    approach: "1) byFreq: freq → list<key> (front = most recent). 2) node: key → (value, freq, iterator). 3) touch(key): unlink, bump freq, push_front, fix minFreq. 4) put on full: evict byFreq[minFreq].back().",
    complexity: "Time: O(1) per get/put | Space: O(capacity)",
    tabCode: `class LFUCache {
    int cap, minFreq = 0;
    unordered_map<int, list<int>> byFreq;                                       // freq -> keys, most recent at front
    unordered_map<int, tuple<int, int, list<int>::iterator>> node;              // key -> (value, freq, position)
    void touch(int key) {
        auto& [val, freq, it] = node[key]; (void)val;
        byFreq[freq].erase(it);
        if (byFreq[freq].empty()) { byFreq.erase(freq); if (minFreq == freq) minFreq++; }
        freq++;
        byFreq[freq].push_front(key);
        it = byFreq[freq].begin();
    }
public:
    LFUCache(int capacity) : cap(capacity) {}
    int get(int key) {
        if (!cap || !node.count(key)) return -1;
        touch(key);
        return std::get<0>(node[key]);
    }
    void put(int key, int value) {
        if (!cap) return;
        if (node.count(key)) { std::get<0>(node[key]) = value; touch(key); return; }
        if ((int)node.size() == cap) {                                            // evict LRU among the least frequent
            int victim = byFreq[minFreq].back();
            byFreq[minFreq].pop_back();
            if (byFreq[minFreq].empty()) byFreq.erase(minFreq);
            node.erase(victim);
        }
        byFreq[1].push_front(key);
        node[key] = {value, 1, byFreq[1].begin()};
        minFreq = 1;
    }
};`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 103, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 103, section: "Design", title: "Time-Based Key-Value Store",
    difficulty: "Medium", frequency: "High", leetcode: 981,
    pattern: "Per-key append-only log + binary search on timestamps",
    intuition: "Timestamps arrive in increasing order per key, so each key's history is a sorted vector of (timestamp, value). get(key, t) is the last entry with timestamp <= t: one upper_bound, step back one.",
    keyInsight: "Append-only sorted vectors beat a map<int,string> per key: contiguous memory, binary search over a cache-friendly array, and no allocation per set beyond the vector's growth. This is the shape of a tick store (Guide 22).",
    approach: "1) m: key → vector<pair<timestamp,value>>. 2) set: push_back. 3) get: upper_bound by timestamp; if at begin return \"\"; else prev(p)->second.",
    complexity: "Time: set O(1) amortized, get O(log N) | Space: O(total entries)",
    tabCode: `class TimeMap {
    unordered_map<string, vector<pair<int, string>>> m;      // per key: timestamps strictly increasing
public:
    void set(string key, string value, int timestamp) { m[key].emplace_back(timestamp, std::move(value)); }
    string get(string key, int timestamp) {
        auto it = m.find(key);
        if (it == m.end()) return "";
        auto& v = it->second;
        auto p = upper_bound(v.begin(), v.end(), timestamp,
                             [](int t, const pair<int, string>& e) { return t < e.first; });   // first entry with ts > timestamp
        if (p == v.begin()) return "";
        return prev(p)->second;
    }
};`,
  },

  // ══════════════════════════════
  //  RANDOMIZED  (id 104, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 104, section: "Randomized", title: "Random Pick with Weight (+ reservoir sampling)",
    difficulty: "Medium", frequency: "Medium", leetcode: 528,
    pattern: "Prefix sums + binary search; reservoir for streams",
    intuition: "Turn weights into cumulative sums; draw a uniform integer in [1, total]; the answer is the first prefix >= the draw (lower_bound). For a stream of unknown length (LC 382/398), keep one item and replace it with probability 1/k at the k-th element: reservoir sampling.",
    keyInsight: "Precompute once, O(log N) per pick; the draw must be in [1, total] (not [0, total)) with lower_bound, or zero-weight items become pickable. Reservoir sampling's proof: the k-th item survives all later replacements with probability (k/(k+1))·((k+1)/(k+2))···((n-1)/n) = k/n times 1/k = 1/n.",
    approach: "1) prefix[i] = w[0]+…+w[i]. 2) pickIndex: r = uniform(1, prefix.back()); return lower_bound(prefix, r) - begin. 3) Reservoir: iterate, replace with probability 1/k.",
    complexity: "Time: O(N) build, O(log N) pick | Space: O(N)",
    tabCode: `class Solution {
    vector<int> prefix;
    mt19937 rng{random_device{}()};
public:
    Solution(vector<int>& w) {
        prefix.reserve(w.size());
        int s = 0; for (int x : w) { s += x; prefix.push_back(s); }
    }
    int pickIndex() {
        int target = uniform_int_distribution<int>(1, prefix.back())(rng);    // [1, total]
        return (int)(lower_bound(prefix.begin(), prefix.end(), target) - prefix.begin());
    }
};
// Reservoir sampling (stream of unknown length, pick one uniformly):
// int keep = -1, k = 0;
// for (int x : stream) { k++; if (uniform_int_distribution<int>(1, k)(rng) == 1) keep = x; }`,
  },

  // ══════════════════════════════
  //  HFT STRUCTURES  (id 105, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 105, section: "HFT Structures", title: "Price-Level Order Book: add / cancel / best bid & ask",
    difficulty: "Medium", frequency: "Medium", leetcode: 0,
    pattern: "Direct-indexed price levels, cached best, amortized scan",
    intuition: "Prices are integer ticks on a bounded grid, so a level is an array slot: add and cancel are O(1) updates to an aggregate quantity. Best bid/ask are cached indices: an add can only improve them (compare), a cancel that empties the best level scans toward worse prices until a non-empty level.",
    keyInsight: "No tree, no hash, no allocation: a dependent cache miss (~130 ns) would be the whole per-message budget. The scan on cancel is what a bitmap of non-empty levels with find-first-set turns into O(1) per 64 levels; for tens of thousands of orders per level you add an intrusive FIFO list per level for time priority (Guide 22).",
    approach: "1) bidQty[N], askQty[N] aggregates. 2) add: qty += q; bestBid = max, bestAsk = min. 3) cancel: qty -= q; if the best level emptied, walk toward worse prices. 4) top of book = the cached indices.",
    complexity: "Time: O(1) add, amortized O(1) cancel (worst case O(N) scan, O(N/64) with a bitmap) | Space: O(N) levels",
    tabCode: `// One instrument, prices as ticks in [0, N). Quantities aggregated per level.
struct Book {
    static constexpr int N = 1 << 16;
    vector<long> bidQty = vector<long>(N, 0), askQty = vector<long>(N, 0);
    int bestBid = -1, bestAsk = N;                        // -1 / N mean "no orders on that side"
    void add(bool bid, int p, long q) {
        if (bid) { bidQty[p] += q; if (p > bestBid) bestBid = p; }
        else     { askQty[p] += q; if (p < bestAsk) bestAsk = p; }
    }
    void cancel(bool bid, int p, long q) {                // precondition: q <= resting quantity at p
        if (bid) { bidQty[p] -= q; while (bestBid >= 0 && bidQty[bestBid] == 0) bestBid--; }
        else     { askQty[p] -= q; while (bestAsk < N && askQty[bestAsk] == 0) bestAsk++; }
    }
    int topBid() const { return bestBid; }                 // -1 if empty
    int topAsk() const { return bestAsk < N ? bestAsk : -1; }
    long spread() const { return (bestBid < 0 || bestAsk >= N) ? -1 : (long)bestAsk - bestBid; }
};
// Interview follow-ups: add per-level intrusive FIFO lists for order ids (O(1) cancel by id via a hash
// table of id -> node), a 64-bit bitmap per 64 levels for O(1) "next non-empty level", and a
// sequence-number check before every update (Guide 18).`,
  },

  // ══════════════════════════════
  //  INTERVALS  (id 106, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 106, section: "Intervals", title: "The Skyline Problem",
    difficulty: "Hard", frequency: "Medium", leetcode: 218,
    pattern: "Sweep line with a multiset of live heights",
    intuition: "Walk left to right. The outline changes only at building edges, and at any x the outline height is simply the tallest building currently covering x. So: turn each building into two events (its left edge enters a height, its right edge removes one), sort the events, and keep the set of live heights in a structure that gives you the maximum and supports removing one specific value.",
    keyInsight: "Everything hard is in the tie-breaking at equal x. Starts must be processed before ends (otherwise a building that ends where another begins produces a phantom dip to zero), taller starts before shorter ones (so the first emitted point is the true maximum), and shorter ends before taller ones (so a taller building's removal is not preceded by an intermediate step). Encoding a start as negative height and sorting pairs ascending gets all three for free.",
    approach: "1) For each (L, R, H) push (L, -H) and (R, +H). 2) Sort. 3) multiset<int> live{0} — the 0 is the ground and means you never check for empty. 4) For each event: insert -h or erase one copy of h. 5) If the new max differs from the last emitted height, emit (x, max).",
    complexity: "Time: O(N log N) — 2N events, each an O(log N) multiset operation | Space: O(N)",
    tabCode: `vector<vector<int>> getSkyline(vector<vector<int>>& b) {
    vector<pair<int,int>> ev;                 // (x, h): h < 0 means a building starts here, h > 0 means one ends
    for (auto& v : b) { ev.push_back({v[0], -v[2]}); ev.push_back({v[1], v[2]}); }
    sort(ev.begin(), ev.end());               // equal x: starts before ends, tallest start first, shortest end first
    multiset<int> live{0};                    // 0 = the ground; the answer at any x is *live.rbegin()
    vector<vector<int>> out;
    int prev = 0;
    for (auto [x, h] : ev) {
        if (h < 0) live.insert(-h);
        else       live.erase(live.find(h));  // erase ONE copy, not every building of that height
        int cur = *live.rbegin();
        if (cur != prev) { out.push_back({x, cur}); prev = cur; }
    }
    return out;
}
// Interview follow-ups worth having ready:
//  - A lazy-deletion max-heap works instead of the multiset: pop while the top's right edge <= x.
//  - Divide and conquer (merge two skylines like merge sort) is O(N log N) too and is the version
//    that generalizes to "union of rectangles" style questions.`,
  },

  // ══════════════════════════════
  //  INTERVALS  (id 107, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 107, section: "Intervals", title: "Maximum Overlap of Streaming Bookings (My Calendar III)",
    difficulty: "Hard", frequency: "Medium", leetcode: 732,
    pattern: "Difference array over an ordered map (interval counts)",
    intuition: "Counting how many intervals cover a point is a prefix sum over a difference array: +1 at each start, −1 at each end, then a running sum. The coordinates are sparse, so hold the difference array in an ordered map keyed by coordinate instead of a dense vector, and the running sum over the map in key order gives the overlap count at every boundary.",
    keyInsight: "The maximum overlap can only change at an interval boundary, so walking the sorted boundaries is exhaustive. Half-open intervals [s, e) mean a booking ending at e and one starting at e do not overlap — the −1 at e must be applied before the +1 at e is counted, which the running sum does naturally if both live in the same map entry.",
    approach: "1) delta[s] += 1, delta[e] -= 1. 2) Walk the map in order, accumulating; track the max. 3) Return the max. For a scalable version replace the linear walk with a segment tree over coordinate-compressed points using range-add and global-max with lazy propagation.",
    complexity: "Time: O(N) per booking with the map walk, O(N²) total; O(log N) per booking with a lazy segment tree | Space: O(N)",
    tabCode: `class MyCalendarThree {
    map<int,int> delta;                       // coordinate -> net change in "number of active bookings"
public:
    int book(int s, int e) {                  // half-open [s, e)
        ++delta[s]; --delta[e];
        int run = 0, best = 0;
        for (auto& [x, d] : delta) { run += d; best = max(best, run); }
        return best;
    }
};
// The same idea answers a whole family: "minimum rooms" (max of the running sum),
// "is any point covered k times" (any prefix >= k), "total covered length" (sum of gaps where run > 0),
// and "employee free time" (gaps where run == 0). Learn the difference array once, reuse it everywhere.
//
// When N is large and bookings stream in, the O(N) walk per call is the bottleneck. Compress the
// coordinates you have seen (or use a dynamic segment tree) and do range-add on [s, e) with lazy
// propagation, tracking the global max: O(log N) per booking.`,
  },

  // ══════════════════════════════
  //  MATRIX  (id 108, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 108, section: "Matrix", title: "Rotate Image In Place",
    difficulty: "Medium", frequency: "High", leetcode: 48,
    pattern: "Decompose the rotation into transpose + reflect",
    intuition: "A 90° clockwise rotation sends (i, j) to (j, n−1−i). Doing that as one move needs a temporary matrix or a delicate four-way cycle per element. Instead notice that rotation is two reflections composed: transpose (reflect across the main diagonal) and then reverse each row (reflect across the vertical midline). Each reflection is trivially in place.",
    keyInsight: "Any rotation of a square is a product of two reflections, and reflections are involutions you can do in place with swaps. Transpose then reverse rows is clockwise; reverse rows then transpose is counter-clockwise; transpose then reverse columns is also counter-clockwise. Derive the composition order on a 2×2 example rather than memorizing.",
    approach: "1) For i < j, swap a[i][j] with a[j][i] (upper triangle only — swapping both triangles undoes it). 2) Reverse each row. 3) Done; no extra memory.",
    complexity: "Time: O(N²) | Space: O(1) extra",
    tabCode: `void rotate(vector<vector<int>>& a) {         // 90 degrees clockwise, in place
    int n = a.size();
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)          // strictly upper triangle, or you swap everything back
            swap(a[i][j], a[j][i]);              // transpose
    for (auto& row : a) reverse(row.begin(), row.end());   // mirror left-right
}
// Counter-clockwise: reverse each row first, then transpose (or transpose, then reverse each column).
// 180 degrees: reverse rows and reverse columns (order irrelevant).
//
// The four-way cycle version (for the follow-up "do it in one pass"):
//   for each layer L from 0 to n/2, for each i in [L, n-1-L):
//     tmp = a[L][i]; a[L][i] = a[n-1-i][L]; a[n-1-i][L] = a[n-1-L][n-1-i];
//     a[n-1-L][n-1-i] = a[i][n-1-L]; a[i][n-1-L] = tmp;
// Correct but every index is a chance to be wrong under a clock. Say it exists; write the two-reflection version.`,
  },

  // ══════════════════════════════
  //  MATRIX  (id 109, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 109, section: "Matrix", title: "Game of Life In Place",
    difficulty: "Medium", frequency: "High", leetcode: 289,
    pattern: "State encoding — keep old and new in different bits",
    intuition: "Every cell's next state depends on its neighbours' current state, so you cannot overwrite a cell before its neighbours have read it. Copying the board costs O(MN) memory. Instead keep both generations in the same integer: bit 0 holds the current state, bit 1 the next. Neighbours keep reading bit 0; you write only bit 1. One final pass shifts everything right by one.",
    keyInsight: "The trick is not the bits — it is recognizing that 'in place' with a dependency on old values means you need a representation that holds two versions at once. The same idea (encode the transition, decode at the end) handles any cellular automaton and appears in graph problems that mark 'visited this round' versus 'visited earlier'.",
    approach: "1) For each cell, count live neighbours using (v & 1). 2) Apply the rules and set bit 1 if the cell is alive next. 3) Second pass: every cell >>= 1.",
    complexity: "Time: O(MN) | Space: O(1) extra",
    tabCode: `void gameOfLife(vector<vector<int>>& b) {
    int m = b.size(), n = b[0].size();
    for (int i = 0; i < m; i++) for (int j = 0; j < n; j++) {
        int live = 0;
        for (int di = -1; di <= 1; di++) for (int dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue;
            int r = i + di, c = j + dj;
            if (r >= 0 && r < m && c >= 0 && c < n) live += b[r][c] & 1;   // bit 0 is still the OLD generation
        }
        bool alive = b[i][j] & 1;
        if (( alive && (live == 2 || live == 3)) || (!alive && live == 3)) b[i][j] |= 2;   // bit 1 = NEXT generation
    }
    for (auto& row : b) for (int& x : row) x >>= 1;
}
// Follow-ups that separate candidates:
//  - Infinite board: keep only live cells in a hash set. Count, for every neighbour of every live cell,
//    how many live cells touch it (a map from coordinate to count). Cells with count 3, or count 2 and
//    currently live, survive. Memory is proportional to live cells, not the board.
//  - Board too large for memory: process in row bands; each band needs one row of context above and below.`,
  },

  // ══════════════════════════════
  //  STRING PARSING  (id 110, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 110, section: "String Parsing", title: "Expression Evaluator with Precedence and Parentheses (Basic Calculator III)",
    difficulty: "Hard", frequency: "High", leetcode: 772,
    pattern: "Recursive descent — one function per precedence level",
    intuition: "Precedence and parentheses are a grammar, and the shortest correct parser for a grammar is one function per level: an expression is a sum of terms; a term is a product of factors; a factor is a number, a parenthesised expression, or a unary minus applied to a factor. Each function consumes as much input as it can and returns its value. Parentheses fall out for free: a factor that sees '(' just calls the expression function recursively.",
    keyInsight: "The precedence table becomes the call graph. Higher precedence means deeper in the call chain, because the deeper function grabs its operands before the shallower one gets to combine them. Adding a new operator or a new precedence level is adding one function — the stack-based single-pass solution has to be redesigned each time. This is the same structure as a real compiler's front end, so say so.",
    approach: "1) Strip spaces once. 2) parseExpr: v = parseTerm(); while next is + or −, combine with the next parseTerm(). 3) parseTerm: same shape over * and / with parseFactor(). 4) parseFactor: '(' → parseExpr, expect ')'; '−' → negate parseFactor(); else read digits. 5) A shared cursor index i is the only state.",
    complexity: "Time: O(N) — every character is consumed exactly once | Space: O(depth of parentheses) on the call stack",
    tabCode: `class Solution {
    string s; size_t i = 0;                            // the cursor is the only parser state
    long expr() {                                      // expr := term (('+' | '-') term)*
        long v = term();
        while (i < s.size() && (s[i] == '+' || s[i] == '-')) {
            char op = s[i++];
            long r = term();
            v = (op == '+') ? v + r : v - r;
        }
        return v;
    }
    long term() {                                      // term := factor (('*' | '/') factor)*
        long v = factor();
        while (i < s.size() && (s[i] == '*' || s[i] == '/')) {
            char op = s[i++];
            long r = factor();
            v = (op == '*') ? v * r : v / r;           // C++ '/' truncates toward zero, which is what the problem wants
        }
        return v;
    }
    long factor() {                                    // factor := '(' expr ')' | '-' factor | number
        if (s[i] == '(') { i++; long v = expr(); i++; return v; }   // the second i++ consumes ')'
        if (s[i] == '-') { i++; return -factor(); }                 // unary minus (Basic Calculator I needs this)
        long v = 0;
        while (i < s.size() && isdigit((unsigned char)s[i])) v = v * 10 + (s[i++] - '0');
        return v;
    }
public:
    int calculate(string in) {
        for (char c : in) if (c != ' ') s += c;
        i = 0;
        return (int)expr();
    }
};
// This one parser solves Basic Calculator I (224: + - and parentheses), II (227: + - * / no parentheses)
// and III (772: everything). To add '^' with right associativity: a power() level between term and factor
// whose right operand is power() again, not factor(). To add comparison operators: one more level above expr.
//
// The single-pass stack version for II (push numbers; on * or / combine with the stack top immediately;
// sum the stack at the end) is worth knowing, but it does not extend cleanly. Offer it as the alternative.`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 111, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 111, section: "Design", title: "Peeking Iterator (one-token lookahead)",
    difficulty: "Medium", frequency: "Medium", leetcode: 284,
    pattern: "Buffer one element ahead — the tokenizer's peek",
    intuition: "The underlying iterator can only advance. To answer 'what is next' without consuming it, fetch it once and hold it in a one-slot buffer with a flag saying whether the buffer is full. peek fills the buffer if empty and returns it; next returns the buffer if full (and empties it), otherwise advances the real iterator; hasNext is true if the buffer is full or the real iterator has more.",
    keyInsight: "Every parser you have ever used is built on exactly this: a lexer with one token of lookahead. The generalization is a deque of k buffered elements for LL(k) lookahead. The subtle point in the interview is hasNext — forgetting that a buffered element counts as 'having next' is the classic bug.",
    approach: "1) Members: bool has, T cached. 2) peek: if !has, cached = base.next(), has = true; return cached. 3) next: if has, has = false, return cached; else return base.next(). 4) hasNext: has || base.hasNext().",
    complexity: "Time: O(1) per operation | Space: O(1)",
    tabCode: `class PeekingIterator : public Iterator {          // Iterator provides next() and hasNext()
    bool has = false;
    int  cached = 0;
public:
    PeekingIterator(const vector<int>& nums) : Iterator(nums) {}
    int peek() {
        if (!has) { cached = Iterator::next(); has = true; }
        return cached;
    }
    int next() {
        if (has) { has = false; return cached; }
        return Iterator::next();
    }
    bool hasNext() const { return has || Iterator::hasNext(); }   // the buffered element counts
};
// Variants that use the same skeleton:
//  - Flatten nested list / 2D vector iterator: the buffer holds the next leaf; hasNext advances through
//    empty sublists to find it, so that next() never has to search.
//  - Zigzag iterator over k lists: a queue of (list, index) pairs; pop one, yield, push back if not exhausted.
//  - "Iterator over a generator": the cached element is the only way to implement hasNext on a source
//    that cannot tell you whether it has more without producing it.`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 112, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 112, section: "Design", title: "Rate Limiter: Token Bucket and Sliding Windows",
    difficulty: "Medium", frequency: "High", leetcode: 359,
    pattern: "Lazy refill — compute the state you would have had, only when asked",
    intuition: "A limiter answers 'may this request proceed now' against a policy like 'at most R per second with bursts up to B'. The token bucket models it directly: a bucket holds up to B tokens and refills at R per second; a request takes one token or is refused. You never need a timer to refill — on each request compute how many tokens would have arrived since the last request, add them (capped at B), and proceed. That lazy refill is the whole trick and it makes the structure O(1) memory per client.",
    keyInsight: "There are four standard algorithms and they trade exactness for memory: fixed window (O(1), lets 2× the limit through at a boundary), sliding log (exact, O(limit) memory per client), sliding counter (O(1), approximates the log by weighting the previous window), token bucket (O(1), the only one that expresses burst and sustained rate as separate parameters, which is why it is what gets deployed). Know which one a question is really asking for.",
    approach: "1) Token bucket state: tokens, lastTimestamp, plus rate and burst. 2) allow(now): tokens = min(burst, tokens + (now − last) × rate); last = now; if tokens ≥ 1, take one and return true. 3) For per-client limiting, a map from client to bucket, evicted when idle. 4) Logger Rate Limiter (the easy LeetCode form): map message → earliest time it may print again.",
    complexity: "Time: O(1) per request | Space: O(1) per client (token bucket, sliding counter) or O(limit) per client (sliding log)",
    tabCode: `// Token bucket: sustained rate 'rate' per second, bursts up to 'burst'. Timestamps in nanoseconds.
class TokenBucket {
    double rate, burst, tokens;
    long long last = 0; bool primed = false;
public:
    TokenBucket(double ratePerSec, double burstSize)
        : rate(ratePerSec), burst(burstSize), tokens(burstSize) {}
    bool allow(long long nowNs, double cost = 1.0) {
        if (primed) tokens = min(burst, tokens + (nowNs - last) * 1e-9 * rate);   // lazy refill, no timer thread
        last = nowNs; primed = true;
        if (tokens < cost) return false;
        tokens -= cost;
        return true;
    }
};

// Sliding-window log: exact "at most 'limit' in any trailing 'window'". Memory O(limit) per client.
class SlidingLog {
    deque<long long> ts; long long window; size_t limit;
public:
    SlidingLog(long long windowNs, size_t limit) : window(windowNs), limit(limit) {}
    bool allow(long long now) {
        while (!ts.empty() && ts.front() <= now - window) ts.pop_front();
        if (ts.size() >= limit) return false;
        ts.push_back(now); return true;
    }
};

// Sliding-window counter: O(1) approximation. Weight the previous fixed window by how much of it is still
// inside the trailing window: est = prevCount * (1 - elapsedFractionOfCurrentWindow) + curCount.

// Logger Rate Limiter (LeetCode 359): each message may print at most once per 10 seconds.
class Logger {
    unordered_map<string,int> nextOk;
public:
    bool shouldPrintMessage(int t, const string& msg) {
        auto it = nextOk.find(msg);
        if (it != nextOk.end() && t < it->second) return false;
        nextOk[msg] = t + 10; return true;
    }
};
// Say in the interview: the token bucket is what network hardware and API gateways actually use; the
// interesting production questions are per-key memory (evict idle buckets), clock source (monotonic, not
// wall), and what happens under contention (one atomic CAS on a packed (tokens, last) word, or a bucket per core).`,
  },

  // ══════════════════════════════
  //  SYSTEM DESIGN DSA  (id 113, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 113, section: "System Design DSA", title: "Consistent Hashing Ring",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Hash both keys and nodes onto a ring; a key belongs to the next node clockwise",
    intuition: "With key % N, adding one server changes N and remaps almost every key. Instead hash the servers onto a circle of hash values and hash each key onto the same circle; a key is owned by the first server at or after it going clockwise. Adding a server only claims the keys between it and its predecessor; removing one only hands its keys to its successor. About 1/N of the keys move, which is the minimum possible.",
    keyInsight: "Two refinements make it work in practice. Virtual nodes: hash each server to many points so the load is even and a server's removal spreads across many successors instead of one. Replication: a key's replicas are the next k distinct servers clockwise. The data structure is an ordered map keyed by hash with lower_bound for the clockwise lookup, so lookup is O(log(N·V)).",
    approach: "1) ring: ordered map hash → node. 2) addNode: insert V points hash(node + '#' + i). 3) removeNode: erase those V points. 4) lookup(key): it = ring.lower_bound(hash(key)); if end, wrap to begin. 5) Replicas: walk forward collecting the first k distinct nodes.",
    complexity: "Time: O(log(NV)) lookup, O(V log(NV)) add/remove | Space: O(NV) ring points",
    tabCode: `class ConsistentHash {
    map<uint64_t, string> ring;                 // point on the circle -> node. Ordered so lower_bound = clockwise
    int vnodes;
    static uint64_t h(const string& s) {        // demo only: std::hash is not stable across implementations.
        return std::hash<string>{}(s);          // production uses a fixed, well-mixed hash (xxHash, Murmur3).
    }
public:
    explicit ConsistentHash(int virtualNodes = 128) : vnodes(virtualNodes) {}
    void addNode(const string& node) {
        for (int i = 0; i < vnodes; i++) ring[h(node + "#" + to_string(i))] = node;
    }
    void removeNode(const string& node) {
        for (int i = 0; i < vnodes; i++) ring.erase(h(node + "#" + to_string(i)));
    }
    string lookup(const string& key) const {
        if (ring.empty()) return "";
        auto it = ring.lower_bound(h(key));      // first point at or after the key, clockwise
        if (it == ring.end()) it = ring.begin(); // wrap around the circle
        return it->second;
    }
    vector<string> replicas(const string& key, int k) const {   // next k DISTINCT nodes clockwise
        vector<string> out;
        if (ring.empty()) return out;
        auto it = ring.lower_bound(h(key));
        for (size_t seen = 0; seen < ring.size() && (int)out.size() < k; seen++) {
            if (it == ring.end()) it = ring.begin();
            if (find(out.begin(), out.end(), it->second) == out.end()) out.push_back(it->second);
            ++it;
        }
        return out;
    }
};
// Alternatives to have in your pocket: jump consistent hash (no ring, O(log N), but nodes must be numbered
// 0..N-1 so it only supports removing the last one) and rendezvous / highest-random-weight hashing
// (score every node per key, pick the max: O(N) per lookup, trivial to reason about, natural for small N).
// The question behind the question is always "what moves when the membership changes" - answer that first.`,
  },

  // ══════════════════════════════
  //  DESIGN  (id 114, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 114, section: "Design", title: "LRU Cache with Per-Entry TTL",
    difficulty: "Hard", frequency: "High", leetcode: 146,
    pattern: "Doubly linked list + hash map, with lazy expiry on the read path",
    intuition: "Plain LRU is a hash map from key to a node in a doubly linked list ordered by recency; a hit splices the node to the front, an insert at capacity evicts the tail. Add a TTL by storing an expiry timestamp on each node. Do not run a timer: check the timestamp when the entry is read and treat an expired hit as a miss (removing it), and when you need room, first drain expired entries from the tail before evicting a live one.",
    keyInsight: "Two policies now interact and the interviewer wants to see that you noticed. An expired entry is dead regardless of recency, so it is removed on sight; a live entry is evicted only by capacity, in LRU order. Lazy expiry means memory may hold dead entries until touched — if that matters, add a min-heap of (expiry, key) and pop it on a schedule, or keep a second list in expiry order. State which you chose and why.",
    approach: "1) Node {key, val, expires}; list<Node> with front = most recent; unordered_map key → list iterator. 2) get(key, now): miss → −1; expired → erase, −1; else splice to front, return value. 3) put(key, val, now, ttl): existing → update and splice; else pop expired from the tail, evict tail if still full, push_front, record iterator.",
    complexity: "Time: O(1) get and put (amortized, including expiry cleanup) | Space: O(capacity)",
    tabCode: `class LRUWithTTL {
    struct Node { int key, val; long long expires; };
    size_t cap;
    list<Node> order;                                   // front = most recently used
    unordered_map<int, list<Node>::iterator> at;
public:
    explicit LRUWithTTL(size_t capacity) : cap(capacity) {}

    int get(int key, long long now) {
        auto it = at.find(key);
        if (it == at.end()) return -1;
        if (it->second->expires <= now) {               // lazy expiry: an expired hit is a miss and is removed
            order.erase(it->second); at.erase(it); return -1;
        }
        order.splice(order.begin(), order, it->second); // O(1) move to front; the iterator stays valid
        return it->second->val;
    }

    void put(int key, int val, long long now, long long ttl) {
        auto it = at.find(key);
        if (it != at.end()) {
            it->second->val = val; it->second->expires = now + ttl;
            order.splice(order.begin(), order, it->second);
            return;
        }
        while (!order.empty() && order.back().expires <= now) {   // drain dead entries before evicting a live one
            at.erase(order.back().key); order.pop_back();
        }
        if (order.size() == cap) { at.erase(order.back().key); order.pop_back(); }   // true LRU victim
        order.push_front({key, val, now + ttl});
        at[key] = order.begin();
    }
};
// The honest limitation of lazy expiry: an expired entry that is not at the tail survives until it is read,
// so a live tail can be evicted ahead of it. Correct by the contract (an expired value is never returned),
// wasteful for memory. If that matters, keep a second list in expiry order, or a min-heap of (expires, key).
// What a low-latency reviewer will push on:
//  - std::list allocates a node per insert. Use a fixed pool: a vector<Node> with prev/next indices, so
//    the cache is one contiguous block and eviction is index surgery, not malloc/free.
//  - unordered_map rehashes. Reserve for capacity up front, or use open addressing keyed by a fast hash.
//  - Time source: pass 'now' in (as here) so the cache is testable and never calls a clock itself.`,
  },

  // ══════════════════════════════
  //  BIT MANIPULATION  (id 115, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 115, section: "Bit Manipulation", title: "Counting Bits and the Bit-Idiom Table",
    difficulty: "Medium", frequency: "High", leetcode: 338,
    pattern: "Reuse a smaller answer: popcount(i) = popcount(i >> 1) + (i & 1)",
    intuition: "You need popcount for every number from 0 to n. Computing each from scratch is O(n log n). But i >> 1 is a smaller number whose answer you already have, and shifting drops exactly one bit — the low bit — so popcount(i) = popcount(i >> 1) + (i & 1). Equivalently, i & (i − 1) clears the lowest set bit, so popcount(i) = popcount(i & (i − 1)) + 1.",
    keyInsight: "The real deliverable is the idiom table below, not this one problem. Interviewers use bit questions to check that you can see numbers as bit patterns without hesitation: clearing the lowest set bit, isolating it, testing for a power of two, and reaching for the hardware popcount and count-trailing-zeros instructions instead of loops.",
    approach: "1) dp[0] = 0. 2) For i in 1..n: dp[i] = dp[i >> 1] + (i & 1). 3) Return dp. Then be able to say every line of the idiom table cold.",
    complexity: "Time: O(n) | Space: O(n) for the output",
    tabCode: `vector<int> countBits(int n) {
    vector<int> dp(n + 1, 0);
    for (int i = 1; i <= n; i++) dp[i] = dp[i >> 1] + (i & 1);   // or: dp[i & (i - 1)] + 1
    return dp;
}

// THE IDIOM TABLE - say these without thinking.
//   x & (x - 1)          clear the lowest set bit         -> popcount loop; x && !(x & (x-1)) tests power of two
//   x & -x               isolate the lowest set bit       -> Fenwick tree step, "lowest set bit" questions
//   x | (x + 1)          set the lowest clear bit
//   x ^ (x & (x - 1))    same as x & -x
//   (x >> k) & 1         test bit k;   x | (1u << k)  set;   x & ~(1u << k)  clear;   x ^ (1u << k)  flip
//   __builtin_popcount(x), __builtin_ctz(x), __builtin_clz(x)
//                        one instruction each (POPCNT/TZCNT/LZCNT on x86 with -mpopcnt/-mbmi; always on AArch64).
//                        ctz/clz of 0 is undefined: guard it. C++20 spells them std::popcount, std::countr_zero.
//   a ^ b ^ b == a       XOR cancels -> "the number that appears once", swap-free parity tricks
//   x & (x - 1) == 0     power of two (with x != 0);   (x & (x + 1)) == 0  -> x is 2^k - 1 (all ones)
//   Gosper's hack        next larger integer with the same popcount:
//                            c = x & -x;  r = x + c;  next = (((r ^ x) >> 2) / c) | r;
//                        -> iterate all k-subsets of an n-set in increasing order
//   -x == ~x + 1         two's complement; INT_MIN has no positive counterpart, so never negate before checking
//   Never: a ^= b; b ^= a; a ^= b   to swap. It zeroes both when &a == &b, and the compiler emits a
//                        better swap from std::swap anyway.
//
// Number-theory basics that share this drawer: gcd by Euclid, modular exponentiation by squaring (problem 116),
// modular inverse via Fermat when the modulus is prime, and (a * b) % m needing 128-bit intermediates when m > 2^32.`,
  },

  // ══════════════════════════════
  //  MATH  (id 116, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 116, section: "Math", title: "Pow(x, n) and Modular Exponentiation",
    difficulty: "Medium", frequency: "High", leetcode: 50,
    pattern: "Exponentiation by squaring — walk the bits of the exponent",
    intuition: "x^n by repeated multiplication is O(n). But x^n = (x^2)^(n/2) when n is even, and x·(x^2)^((n−1)/2) when odd, so halving the exponent each step gives O(log n). The iterative form walks the exponent's bits from low to high: keep a running square of x; whenever the current bit is 1, multiply it into the result.",
    keyInsight: "Two things go wrong under a clock. Negative exponents: −INT_MIN overflows an int, so widen n to 64 bits before negating. Modular version: (a · b) mod m overflows 64 bits when m exceeds 2^32, so the product needs a 128-bit intermediate (or a 32-bit modulus). The algorithm is the same one that computes Fibonacci in O(log n) by squaring a 2×2 matrix, and the same one behind RSA — it is worth being able to say that.",
    approach: "1) If n < 0: x = 1/x, n = −n (as long long). 2) r = 1; while n: if n & 1, r *= x; x *= x; n >>= 1. 3) Modular: same loop with % m after each multiply and 128-bit products.",
    complexity: "Time: O(log n) multiplications | Space: O(1) iterative, O(log n) recursive",
    tabCode: `double myPow(double x, int n0) {
    long long n = n0;                              // widen first: -INT_MIN does not fit in an int
    if (n < 0) { x = 1 / x; n = -n; }
    double r = 1;
    while (n) {
        if (n & 1) r *= x;                         // this bit of the exponent is set: fold in the current power
        x *= x;                                    // x^1 -> x^2 -> x^4 -> ...
        n >>= 1;
    }
    return r;
}

// b^e mod m for e >= 0. __int128 is a GCC/Clang extension; for m < 2^32 plain unsigned long long is enough.
long long modpow(long long b, long long e, long long m) {
    long long r = 1 % m;                           // handles m == 1
    b %= m; if (b < 0) b += m;
    while (e) {
        if (e & 1) r = (long long)((__int128)r * b % m);
        b = (long long)((__int128)b * b % m);
        e >>= 1;
    }
    return r;
}

long long gcd_(long long a, long long b) { while (b) { a %= b; swap(a, b); } return a; }   // Euclid, O(log)

// Modular inverse of a mod prime p (Fermat): a^(p-2) mod p. For a non-prime modulus use extended Euclid:
// find x, y with a*x + m*y = gcd(a, m); if the gcd is 1, x mod m is the inverse.
// Fibonacci in O(log n): square the matrix [[1,1],[1,0]] with the same loop; F(n) is the top-right entry.`,
  },

  // ══════════════════════════════
  //  HFT STRUCTURES  (id 117, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 117, section: "HFT Structures", title: "Ring Buffer, Circular Deque and Moving Average",
    difficulty: "Medium", frequency: "High", leetcode: 641,
    pattern: "Power-of-two capacity with free-running indices masked on access",
    intuition: "A fixed array with two indices, head (next to read) and tail (next to write), that wrap around. The naive version wastes a slot to tell full from empty, or keeps a separate count. The clean version lets head and tail run freely as unsigned integers and masks them on every access; then size is simply tail − head, full is size == capacity, and unsigned wraparound of the indices themselves is harmless because the subtraction is modular too.",
    keyInsight: "Capacity as a power of two turns the modulo into an AND, which matters because this structure sits on hot paths — a lock-free single-producer single-consumer queue is exactly this ring with head and tail made atomic and placed on separate cache lines. The moving-average question is the same ring plus a running sum: the element you overwrite is the one leaving the window.",
    approach: "1) buf[Cap], head = tail = 0 (size_t). 2) push_back: if full return false; buf[tail++ & mask] = v. 3) pop_front: if empty return false; out = buf[head++ & mask]. 4) push_front: buf[--head & mask] = v (unsigned wrap keeps it correct). 5) Moving average: ring of k plus sum; on push subtract the evicted value when the ring is full.",
    complexity: "Time: O(1) every operation | Space: O(capacity)",
    tabCode: `template <class T, size_t CapPow2>
class Ring {                                         // circular deque; both ends O(1); no wasted slot
    static_assert((CapPow2 & (CapPow2 - 1)) == 0, "capacity must be a power of two");
    static constexpr size_t mask = CapPow2 - 1;
    T buf[CapPow2];
    size_t head = 0, tail = 0;                       // free-running; only ever masked on access
public:
    size_t size()  const { return tail - head; }     // correct even after the counters themselves wrap (unsigned)
    bool   empty() const { return head == tail; }
    bool   full()  const { return size() == CapPow2; }
    bool push_back (const T& v) { if (full())  return false; buf[tail++ & mask] = v; return true; }
    bool push_front(const T& v) { if (full())  return false; buf[--head & mask] = v; return true; }   // wraps fine
    bool pop_front (T& out)     { if (empty()) return false; out = buf[head++ & mask]; return true; }
    bool pop_back  (T& out)     { if (empty()) return false; out = buf[--tail & mask]; return true; }
    T& front() { return buf[head & mask]; }
    T& back()  { return buf[(tail - 1) & mask]; }
};

// Moving average of the last k values from a stream (LeetCode 346): same ring, plus a running sum.
class MovingAverage {
    vector<double> buf; size_t k, n = 0; double sum = 0;
public:
    explicit MovingAverage(size_t k) : buf(k), k(k) {}
    double next(double v) {
        size_t i = n % k;                            // k need not be a power of two here; it is not on a hot path
        if (n >= k) sum -= buf[i];                   // the slot we overwrite holds the value leaving the window
        buf[i] = v; sum += v; n++;
        return sum / min(n, k);
    }
};
// The SPSC lock-free queue is this Ring with:  std::atomic<size_t> head, tail on separate cache lines
// (alignas(64)); producer loads head with acquire and stores tail with release; consumer the mirror image.
// Each side caches the other's index and re-reads it only when it appears full/empty. That is lab concurrency/03.`,
  },

  // ══════════════════════════════
  //  HFT STRUCTURES  (id 118, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 118, section: "HFT Structures", title: "Timer Wheel",
    difficulty: "Hard", frequency: "Medium", leetcode: null,
    pattern: "Bucket timers by expiry slot; advance one slot per tick",
    intuition: "A heap of timers gives O(log n) insert and O(log n) pop, and a system with a million order timeouts pays that log on every one. A timing wheel is a circular array of W slots, one per tick of time; a timer due in d ticks goes into slot (now + d) mod W, with a 'rounds' counter for delays longer than one lap. Each tick, advance one slot and fire everything there whose rounds have reached zero. Insert, cancel and tick are all O(1) amortized.",
    keyInsight: "You are trading precision for constant-time operations: a timer fires at tick granularity, never sooner and up to one tick late, which is exactly right for timeouts and heartbeats and exactly wrong for a scheduler that needs exact deadlines. Two subtleties decide the grade: the off-by-one in slot and rounds (fire delay 1 on the next tick, delay W on the W-th), and running callbacks after the slot walk, because a callback may add or cancel timers in the slot you are iterating.",
    approach: "1) slots: vector of intrusive lists; cur = current slot; a map from id to (slot, node) for O(1) cancel. 2) add(d): d = max(d,1); slot = (cur + d) mod W; rounds = (d − 1) / W. 3) tick: cur = (cur + 1) mod W; walk slot cur; rounds == 0 → collect and remove, else decrement. 4) Run collected callbacks after the walk. 5) Hierarchical wheels (a wheel per time unit: ms, s, min) cascade long timers down as they approach.",
    complexity: "Time: O(1) add, O(1) cancel, O(timers in slot) per tick | Space: O(W + timers)",
    tabCode: `class TimerWheel {
    struct Timer { uint64_t id; uint32_t rounds; function<void()> cb; };
    vector<list<Timer>> slots;
    size_t cur = 0;
    uint64_t nextId = 1;
    unordered_map<uint64_t, pair<size_t, list<Timer>::iterator>> where;   // id -> (slot, node): O(1) cancel
public:
    explicit TimerWheel(size_t wheelSize) : slots(wheelSize) {}

    uint64_t add(uint32_t delayTicks, function<void()> cb) {
        if (delayTicks == 0) delayTicks = 1;         // "fire on the next tick" is the soonest we can promise
        size_t W = slots.size();
        size_t slot   = (cur + delayTicks) % W;
        uint32_t laps = (delayTicks - 1) / W;        // delay W lands on the W-th tick, not the 2W-th
        slots[slot].push_back({nextId, laps, std::move(cb)});
        where[nextId] = {slot, std::prev(slots[slot].end())};
        return nextId++;
    }

    bool cancel(uint64_t id) {
        auto it = where.find(id);
        if (it == where.end()) return false;
        slots[it->second.first].erase(it->second.second);
        where.erase(it);
        return true;
    }

    void tick() {                                    // call once per tick of wall time
        cur = (cur + 1) % slots.size();
        auto& L = slots[cur];
        vector<function<void()>> due;
        for (auto it = L.begin(); it != L.end(); ) {
            if (it->rounds == 0) { where.erase(it->id); due.push_back(std::move(it->cb)); it = L.erase(it); }
            else                 { --it->rounds; ++it; }
        }
        for (auto& cb : due) cb();                   // outside the walk: a callback may add() or cancel()
    }
};
// Where it lives: Linux kernel timers, Netty's HashedWheelTimer, Kafka's purgatory, and every order gateway
// that needs "cancel this order if not acked in 50 ms" for a million orders. For the low-latency version:
// intrusive doubly linked nodes owned by the timer object (no std::list, no map: the handle IS the node),
// a bitmap of non-empty slots so idle ticks skip in O(1), and a hierarchy of wheels so a 1 ms wheel can
// hold a 10-minute timer without 600,000 slots. Compare honestly with a heap: the heap is exact and simpler;
// the wheel wins only when insert/cancel volume dwarfs firings, which is precisely the order-timeout workload.`,
  },

  // ══════════════════════════════
  //  STRING PARSING  (id 119, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 119, section: "String Parsing", title: "KMP: the Failure Function and What It Really Computes",
    difficulty: "Hard", frequency: "Medium", leetcode: 28,
    pattern: "Longest proper prefix that is also a suffix, reused as a fallback",
    intuition: "Naive matching restarts the pattern at every text position, throwing away everything it just learned. But a mismatch after k matched characters tells you a lot: those k characters ARE the pattern's own first k. So the only positions worth retrying are the ones where a proper prefix of the pattern also ends there — that is, the longest proper prefix that is also a suffix of pattern[0..k). Precompute that for every k and a mismatch becomes a jump, never a rewind of the text.",
    keyInsight: "lps[i] = the length of the longest proper prefix of pattern[0..i] that is also a suffix of it. The text pointer never moves backwards, which is what makes it O(n + m) and what makes it usable on a stream. Building lps is the same algorithm matching the pattern against itself — if you can see that, you can rederive it under pressure instead of memorising it.",
    approach: "1) Build lps in O(m): two pointers, len and i; on match lps[i++] = ++len; on mismatch fall back len = lps[len-1], or if len == 0 set lps[i++] = 0. 2) Scan the text with the same fallback rule. 3) On a full match, report and fall back to lps[m-1] to allow overlaps.",
    complexity: "Time: O(n + m) | Space: O(m)",
    tabCode: `vector<int> buildLps(const string& p) {
    vector<int> lps(p.size(), 0);
    int len = 0;
    for (size_t i = 1; i < p.size(); ) {
        if (p[i] == p[len]) lps[i++] = ++len;          // extend the current border
        else if (len)       len = lps[len - 1];        // fall back to the next shorter border; do NOT i++
        else                lps[i++] = 0;
    }
    return lps;
}

int strStr(const string& t, const string& p) {          // first index, or -1
    if (p.empty()) return 0;
    vector<int> lps = buildLps(p);
    for (size_t i = 0, j = 0; i < t.size(); ) {
        if (t[i] == p[j]) { i++; j++; if (j == p.size()) return (int)(i - j); }
        else if (j)       j = lps[j - 1];              // the text pointer never rewinds
        else              i++;
    }
    return -1;
}

// What the failure function is really worth (this is why the question gets asked):
//  - Shortest period of s: n - lps[n-1] IS the period when it divides n. So "is s a
//    repeated substring of itself" (LeetCode 459) is a one-liner on top of lps.
//  - Count all borders of s: walk lps[n-1], lps[lps[n-1]-1], ... to enumerate every
//    proper prefix that is also a suffix.
//  - Shortest palindrome by prepending (LeetCode 214): build lps of s + '#' + reverse(s);
//    lps.back() is the longest palindromic prefix, so prepend the rest reversed.
//  - Streaming: because i never decreases, KMP matches over a socket with O(m) memory.`,
  },

  // ══════════════════════════════
  //  STRING PARSING  (id 120, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 120, section: "String Parsing", title: "Z-Algorithm and Rolling Hash (with the collision talk)",
    difficulty: "Hard", frequency: "Medium", leetcode: 1044,
    pattern: "Z-array for exact structure; polynomial hashing for O(1) substring comparison",
    intuition: "Two different tools for 'compare substrings fast'. The Z-array gives, for each i, the length of the longest substring starting at i that is also a prefix of the whole string — computed in linear time by reusing the rightmost match window instead of recomparing. A rolling hash instead maps every substring to a number so any two can be compared in O(1), at the cost of being probabilistic.",
    keyInsight: "The interview point is knowing which one to reach for and being honest about the hash. A polynomial hash mod a prime is not a proof of equality — by the birthday bound, comparing q substrings collides with probability roughly q²/(2m), so a single 32-bit modulus over a million comparisons is a near-certainty of a false match. Use a 64-bit prime modulus (or two independent moduli), pick the base randomly at run time so no fixed input can be crafted against you, and if the answer must be exact, verify a hit with a direct comparison. Saying that unprompted is the answer.",
    approach: "Z: maintain [l, r], the match window with the largest r. For i in it, seed z[i] = min(r - i, z[i - l]) then extend by comparison. Hash: h(s[l..r)) = (H[r] - H[l]·base^(r-l)) mod M, with prefix hashes H and powers precomputed.",
    complexity: "Z: O(n) time, O(n) space | Hash: O(n) build, O(1) per substring compare",
    tabCode: `vector<int> zArray(const string& s) {
    int n = s.size();
    vector<int> z(n, 0);
    z[0] = n;
    for (int i = 1, l = 0, r = 0; i < n; i++) {
        if (i < r) z[i] = min(r - i, z[i - l]);        // reuse what the window already proved
        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) z[i]++;
        if (i + z[i] > r) { l = i; r = i + z[i]; }     // r only ever grows -> linear total work
    }
    return z;
}
// Pattern search with Z: run zArray(pattern + '\\x01' + text); any z == pattern.size() is a match.

// Polynomial rolling hash. 64-bit modulus + a random base: collisions become
// something you can quote a bound for rather than hope about.
struct RollingHash {
    static constexpr unsigned long long M = (1ULL << 61) - 1;   // Mersenne prime
    vector<unsigned long long> H, P;
    static unsigned long long mul(unsigned long long a, unsigned long long b) {
        __uint128_t c = (__uint128_t)a * b;
        unsigned long long lo = (unsigned long long)(c & M), hi = (unsigned long long)(c >> 61);
        unsigned long long r = lo + hi;
        return r >= M ? r - M : r;
    }
    explicit RollingHash(const string& s, unsigned long long base) : H(s.size() + 1, 0), P(s.size() + 1, 1) {
        for (size_t i = 0; i < s.size(); i++) {
            H[i + 1] = mul(H[i], base) + (unsigned char)s[i];
            if (H[i + 1] >= M) H[i + 1] -= M;
            P[i + 1] = mul(P[i], base);
        }
    }
    unsigned long long get(size_t l, size_t r) const {           // hash of [l, r)
        unsigned long long x = H[r] + M - mul(H[l], P[r - l]);
        return x >= M ? x - M : x;
    }
};
// Choose the base at run time, never a constant:
//   mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());
//   unsigned long long base = 131 + 2 * (rng() % ((RollingHash::M - 300) / 2));
//
// Longest duplicate substring (LeetCode 1044): binary search the length L, and for each L
// put every window's hash in a hash set — monotone because a duplicate of length L implies
// one of length L-1. O(n log n) expected. VERIFY the candidate with a real comparison before
// returning it; that turns a probabilistic algorithm into a certain answer.`,
  },

  // ══════════════════════════════
  //  HEAP  (id 121, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 121, section: "Heap", title: "Sliding Window Median (two heaps with lazy deletion)",
    difficulty: "Hard", frequency: "Medium", leetcode: 480,
    pattern: "Max-heap of the low half, min-heap of the high half, rebalanced every step",
    intuition: "The median needs the middle of a set that keeps changing. Split the window in two: a max-heap holding the smaller half (its top is the largest small value) and a min-heap holding the larger half (its top is the smallest large value). Keep their sizes within one and the median is the low top, or the average of the two tops for an even window. Insertion and removal each touch one heap and then rebalance.",
    keyInsight: "A binary heap cannot delete an arbitrary element, and the value leaving the window is arbitrary. Two honest ways out: lazy deletion — mark the outgoing value in a counter map and only actually pop it when it surfaces at a top, tracking the logical sizes separately — or use an ordered multiset and keep an iterator at the median. Say which invariant you are maintaining (the size relation) before writing code; that is what the interviewer is scoring.",
    approach: "1) Insert x: push to lo if x <= lo.top() else hi; rebalance so 0 <= |lo| - |hi| <= 1. 2) Remove x: decrement delayed[x]; adjust the logical balance; prune tops. 3) Prune: while the top's delayed count is positive, pop it. 4) Median from the tops, averaging as doubles to avoid overflow.",
    complexity: "Time: O(n log k) | Space: O(k)",
    tabCode: `vector<double> medianSlidingWindow(vector<int>& nums, int k) {
    priority_queue<int> lo;                                   // max-heap: the smaller half
    priority_queue<int, vector<int>, greater<int>> hi;        // min-heap: the larger half
    unordered_map<int, int> delayed;                          // value -> pending deletions
    int loSize = 0, hiSize = 0;                               // LOGICAL sizes, ignoring pending
    vector<double> out;

    auto prune = [&](auto& heap) {
        while (!heap.empty()) {
            auto it = delayed.find(heap.top());
            if (it == delayed.end() || it->second == 0) break;
            if (--it->second == 0) delayed.erase(it);
            heap.pop();
        }
    };
    auto rebalance = [&]() {
        if (loSize > hiSize + 1) { hi.push(lo.top()); lo.pop(); loSize--; hiSize++; prune(lo); }
        else if (loSize < hiSize) { lo.push(hi.top()); hi.pop(); hiSize--; loSize++; prune(hi); }
    };

    for (int i = 0; i < (int)nums.size(); i++) {
        if (lo.empty() || nums[i] <= lo.top()) { lo.push(nums[i]); loSize++; }
        else                                   { hi.push(nums[i]); hiSize++; }
        rebalance();

        if (i >= k) {
            int gone = nums[i - k];
            delayed[gone]++;
            if (!lo.empty() && gone <= lo.top()) { loSize--; if (gone == lo.top()) prune(lo); }
            else                                 { hiSize--; if (!hi.empty() && gone == hi.top()) prune(hi); }
            rebalance();
        }
        if (i >= k - 1)
            out.push_back(k & 1 ? (double)lo.top()
                                : ((double)lo.top() + (double)hi.top()) / 2.0);   // widen BEFORE adding
    }
    return out;
}
// Two traps that fail submissions:
//  - (lo.top() + hi.top()) / 2 overflows int when both are near INT_MAX. Cast first.
//  - Tracking heap.size() instead of logical sizes: the heaps hold ghosts, so the balance
//    condition must be about the elements that are still logically in the window.
//
// The alternative worth naming: multiset<int> with an iterator parked on the median, moved
// one step whenever an insert or erase lands on one side. Simpler to argue, same complexity.
// A policy-based order-statistic tree gives find_by_order directly, which is the "right"
// data structure and the honest answer to "what would you use in production".`,
  },

  // ══════════════════════════════
  //  MATH  (id 122, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: 122, section: "Math", title: "Computational Geometry: Orientation, Hull and Closest Pair",
    difficulty: "Hard", frequency: "Low", leetcode: 587,
    pattern: "Every geometry question is the sign of a cross product",
    intuition: "The one primitive is the cross product of two edge vectors: for points O, A, B, cross = (A−O)×(B−O). Its sign says whether OAB turns counter-clockwise, clockwise, or is collinear. Convex hull, segment intersection, point-in-polygon and polygon area are all that sign applied in a loop. Learn the primitive and its overflow behaviour, not four separate algorithms.",
    keyInsight: "Use integers and never divide. Coordinates up to 1e9 make the cross product reach 4e18, which overflows a signed 64-bit only barely — use __int128 or bound the inputs and say so. Every floating-point geometry bug traces back to comparing a computed value against zero with ==; if the inputs are integral, keep them integral and the sign is exact.",
    approach: "Hull (Andrew's monotone chain): sort by (x, y); build the lower chain popping while the last turn is not counter-clockwise; build the upper chain the same way; concatenate without the duplicated endpoints. Closest pair: sort by x, divide, recurse, then check only points within the current best distance of the split line, sorted by y — at most a constant number each.",
    complexity: "Hull: O(n log n) | Closest pair: O(n log n) | Orientation: O(1)",
    tabCode: `struct P { long long x, y; };
// > 0 counter-clockwise, < 0 clockwise, == 0 collinear. __int128 so 1e9 coords cannot overflow.
long long cross(const P& o, const P& a, const P& b) {
    __int128 v = (__int128)(a.x - o.x) * (b.y - o.y) - (__int128)(a.y - o.y) * (b.x - o.x);
    return v > 0 ? 1 : (v < 0 ? -1 : 0);
}

vector<P> convexHull(vector<P> p) {                       // Andrew's monotone chain
    sort(p.begin(), p.end(), [](const P& a, const P& b) { return a.x != b.x ? a.x < b.x : a.y < b.y; });
    p.erase(unique(p.begin(), p.end(), [](const P& a, const P& b) { return a.x == b.x && a.y == b.y; }), p.end());
    if (p.size() < 3) return p;
    vector<P> h(2 * p.size());
    int k = 0;
    for (size_t i = 0; i < p.size(); i++) {               // lower hull
        while (k >= 2 && cross(h[k - 2], h[k - 1], p[i]) <= 0) k--;   // <= 0 drops collinear points
        h[k++] = p[i];
    }
    for (int i = (int)p.size() - 2, t = k + 1; i >= 0; i--) {         // upper hull
        while (k >= t && cross(h[k - 2], h[k - 1], p[i]) <= 0) k--;
        h[k++] = p[i];
    }
    h.resize(k - 1);                                      // last point repeats the first
    return h;
}
// Use < 0 instead of <= 0 in both loops to KEEP collinear boundary points (LeetCode 587 wants them).

// Twice the signed area of a polygon (shoelace). Sign gives the winding direction.
__int128 area2(const vector<P>& poly) {
    __int128 s = 0;
    for (size_t i = 0, n = poly.size(); i < n; i++) {
        const P& a = poly[i]; const P& b = poly[(i + 1) % n];
        s += (__int128)a.x * b.y - (__int128)b.x * a.y;
    }
    return s;                                             // area = |s| / 2; s > 0 means counter-clockwise
}

// Closest pair, divide and conquer. Returns the squared distance, so it stays integral.
long long closestPair(vector<P> pts) {
    sort(pts.begin(), pts.end(), [](const P& a, const P& b) { return a.x < b.x; });
    vector<P> buf(pts.size());
    auto d2 = [](const P& a, const P& b) {
        long long dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy;
    };
    auto rec = [&](auto&& self, int lo, int hi) -> long long {        // [lo, hi)
        if (hi - lo <= 3) {
            long long best = LLONG_MAX;
            for (int i = lo; i < hi; i++) for (int j = i + 1; j < hi; j++) best = min(best, d2(pts[i], pts[j]));
            sort(pts.begin() + lo, pts.begin() + hi, [](const P& a, const P& b) { return a.y < b.y; });
            return best;
        }
        int mid = (lo + hi) / 2;
        long long midX = pts[mid].x;
        long long best = min(self(self, lo, mid), self(self, mid, hi));
        merge(pts.begin() + lo, pts.begin() + mid, pts.begin() + mid, pts.begin() + hi, buf.begin(),
              [](const P& a, const P& b) { return a.y < b.y; });
        copy(buf.begin(), buf.begin() + (hi - lo), pts.begin() + lo);
        vector<P> strip;                                              // within sqrt(best) of the split
        for (int i = lo; i < hi; i++) {
            long long dx = pts[i].x - midX;
            if (dx * dx < best) strip.push_back(pts[i]);
        }
        for (size_t i = 0; i < strip.size(); i++)                     // the classic result: at most 7 ahead
            for (size_t j = i + 1; j < strip.size() && (strip[j].y - strip[i].y) * (strip[j].y - strip[i].y) < best; j++)
                best = min(best, d2(strip[i], strip[j]));
        return best;
    };
    return rec(rec, 0, (int)pts.size());
}
// Compare squared distances, never sqrt: it keeps the arithmetic exact and it is faster.`,
  },
];

// ═══════════════════════════════════════════════════════════════════
//  NVIDIA BONUS PROBLEMS  (ids 77–81) — Compiler Verification Focus
// ═══════════════════════════════════════════════════════════════════
// Append these to PROBLEMS at runtime to keep IDs sequential.
export const NVIDIA_PROBLEMS = [
  {
    id: 77, section: "Tree", title: "Lowest Common Ancestor of a Binary Tree",
    difficulty: "Medium", frequency: "High", leetcode: 236,
    pattern: "Recursive post-order DFS — bubble up found nodes",
    intuition: "DFS returns p or q if found. If left AND right are non-null, current node is LCA. Otherwise return whichever side is non-null.",
    keyInsight: "The recursion bubbles up the first match. If both children return a node, the current root is the split point — and thus the LCA.",
    approach: "Base: null or p or q → return node. Recurse left + right. If both non-null → return root. Else return non-null child.",
    complexity: "Time: O(N) | Space: O(H) recursion",
    tabCode: `TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
    if (!root || root == p || root == q) return root;
    TreeNode* left  = lowestCommonAncestor(root->left,  p, q);
    TreeNode* right = lowestCommonAncestor(root->right, p, q);
    if (left && right) return root; // split point — this IS the LCA
    return left ? left : right;     // propagate the found node upward
}`
  },
  {
    id: 78, section: "Tree", title: "Binary Tree Level Order Traversal",
    difficulty: "Easy", frequency: "High", leetcode: 102,
    pattern: "BFS with queue — level-by-level processing",
    intuition: "Use a queue. On each 'round', iterate exactly queue.size() elements (current level) before processing next level. Record each element in a temp vector.",
    keyInsight: "Snapshot queue size AT THE START of each level-loop to know exactly how many nodes belong to the current level.",
    approach: "1) Queue with root. 2) While queue: snap size. 3) Pop size nodes, push children, record vals. 4) Add level to result.",
    complexity: "Time: O(N) | Space: O(W) — W = max width",
    tabCode: `vector<vector<int>> levelOrder(TreeNode* root) {
    if (!root) return {};
    vector<vector<int>> res;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        int sz = q.size();
        vector<int> level;
        for (int i = 0; i < sz; i++) {
            TreeNode* n = q.front(); q.pop();
            level.push_back(n->val);
            if (n->left)  q.push(n->left);
            if (n->right) q.push(n->right);
        }
        res.push_back(level);
    }
    return res;
}`
  },
  {
    id: 79, section: "Tree", title: "Diameter of Binary Tree",
    difficulty: "Easy", frequency: "Medium", leetcode: 543,
    pattern: "Post-order DFS — track global max through function return",
    intuition: "Diameter through a node = height(left) + height(right). Track global max as we compute heights bottom-up.",
    keyInsight: "The function returns height (for parent to use), but updates a global diameter as a side effect. Two pointers trick for trees.",
    approach: "dfs(node) → max(left,right)+1. Update ans = max(ans, left+right) at each node.",
    complexity: "Time: O(N) | Space: O(H)",
    tabCode: `int ans = 0;
int diameterOfBinaryTree(TreeNode* root) {
    dfs(root);
    return ans;
}
int dfs(TreeNode* node) {
    if (!node) return 0;
    int left = dfs(node->left), right = dfs(node->right);
    ans = max(ans, left + right); // diameter through this node
    return max(left, right) + 1; // height for parent
}`
  },
  {
    id: 80, section: "Graph", title: "Cycle Detection in Directed Graph",
    difficulty: "Medium", frequency: "High", leetcode: 207,
    pattern: "DFS with 3-color marking (White/Gray/Black)",
    intuition: "Track 3 states: 0=unvisited, 1=in current path (gray), 2=done (black). If we reach a gray node → back edge → cycle!",
    keyInsight: "Gray nodes are on the current recursive path. A gray→gray edge is a back edge (cycle). This is how compilers detect circular dependencies.",
    approach: "DFS: if state[v]==1 → return true (cycle). Set state[v]=1 → recurse → set state[v]=2.",
    complexity: "Time: O(V+E) | Space: O(V)",
    tabCode: `bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
    vector<vector<int>> adj(numCourses);
    for (auto& e : prerequisites) adj[e[1]].push_back(e[0]);
    vector<int> state(numCourses, 0); // 0=unvisited 1=visiting 2=done
    function<bool(int)> dfs = [&](int u) -> bool {
        if (state[u] == 1) return true;  // back edge → cycle
        if (state[u] == 2) return false; // already processed
        state[u] = 1;                    // mark as 'in path'
        for (int v : adj[u]) if (dfs(v)) return true;
        state[u] = 2;                    // mark as done
        return false;
    };
    for (int i = 0; i < numCourses; i++) if (dfs(i)) return false;
    return true;
}`
  },
  {
    id: 81, section: "Linked List", title: "Binary Tree to Doubly Linked List",
    difficulty: "Medium", frequency: "Low", leetcode: 426,
    pattern: "In-order DFS with thread weaving — NVIDIA's actual coding round problem!",
    intuition: "In-order traversal of BST gives sorted order. As we visit each node in-order, weave it into a DLL by linking prev->right=cur and cur->left=prev. Track head and prev pointers.",
    keyInsight: "This was literally the exact problem given in NVIDIA's compiler intern coding round. Pointer manipulation bugs are what they test. Key: handle head initialization (first in-order node), and circular linking at the end.",
    approach: "1) In-order recursion. 2) At each node: link prev and cur. 3) After traversal: link head and tail circularly.",
    complexity: "Time: O(N) | Space: O(H) recursion",
    memoCode: `// The BUG-LADEN version NVIDIA gives you to fix:
// BUG 1: treeToDoublyList called by VALUE, not reference for head/prev
// BUG 2: Missing null check before dereferencing prev
// BUG 3: Circular link not established at the end
void treeToDoublyList_BUGGY(Node* root, Node* head, Node* prev) { // BUG: pass by value!
    if (!root) return;
    treeToDoublyList_BUGGY(root->left, head, prev);
    if (prev) prev->right = root;   // BUG: crashes if prev is null
    root->left = prev;
    prev = root;                    // BUG: doesn't update caller's prev
    treeToDoublyList_BUGGY(root->right, head, prev);
    // BUG: no circular link-up of head<->tail
}`,
    tabCode: `Node* treeToDoublyList(Node* root) {
    if (!root) return nullptr;
    Node *head = nullptr, *prev = nullptr;
    function<void(Node*)> inorder = [&](Node* cur) {
        if (!cur) return;
        inorder(cur->left);
        if (prev) {
            prev->right = cur;   // weave: prev → cur
            cur->left  = prev;   // weave: prev ← cur
        } else {
            head = cur;          // first in-order node = head
        }
        prev = cur;
        inorder(cur->right);
    };
    inorder(root);
    // Circular: link head <-> tail
    head->left  = prev;
    prev->right = head;
    return head;
}`
  },
];

export const CPP_CONCEPTS = [
  {
    id: 1,
    title: "lvalue vs rvalue References",
    category: "Value Categories & References",
    explanation: "Every C++ expression is either an lvalue (has identity/address, can appear left of =) or an rvalue (temporary, no persistent address). lvalue refs (T&) bind only to lvalues. rvalue refs (T&&) bind only to rvalues. const T& binds to BOTH — the 'universal sink'.",
    keyInsight: "A function returning by value returns an rvalue (temporary). You cannot bind a non-const lvalue ref to a temporary. Fix: either return an actual lvalue ref (reference to persistent object) or accept const T& / T&& at call site.",
    codeExample: `int x = 5;
int& lref = x;      // OK: x is lvalue
// int& lref2 = 5;  // ERROR: 5 is rvalue

int&& rref = 5;     // OK: binds rvalue
// int&& rref2 = x; // ERROR: x is lvalue

const int& cref = 5; // OK: const ref extends rvalue lifetime`,
    qa: [
      {
        question: `int foo() { return 5; }
int main() { foo() = 10; }  // Compile?`,
        willCompile: false,
        answer: "No. foo() returns by value — a temporary (rvalue). You cannot assign to an rvalue. Compiler error: 'lvalue required as left operand of assignment'.",
        fixedCode: `// Fix: return a reference to a persistent (global/static) variable
int x = 0;
int& foo() { return x; }  // foo() is now an lvalue expression
int main() { foo() = 10; } // OK: assigns to x`,
        explanation: "Returning T& makes the function call an lvalue — it refers to an existing object. This is exactly how operator[] is implemented: vector<int>::operator[] returns int& to allow v[i] = value."
      },
      {
        question: `void bar(int& x) { x++; }
int main() { bar(10); }  // Compile?`,
        willCompile: false,
        answer: "No. 10 is an rvalue. A non-const lvalue reference cannot bind to a temporary. Compiler: 'cannot bind non-const lvalue reference of type int& to rvalue of type int'.",
        fixedCode: `// Fix 1: const lvalue ref (read-only, extends rvalue lifetime)
void bar(const int& x) { /* can read x, NOT modify */ }
int main() { bar(10); } // OK

// Fix 2: rvalue reference (can modify the temporary)
void bar(int&& x) { x++; }
int main() { bar(10); } // OK — modifies temporary

// Fix 3: accept by value (copy made, always works)
void bar(int x) { x++; }
int main() { bar(10); } // OK`,
        explanation: "const T& is the 'universal sink' — binds to both lvalues AND rvalues, extends lifetime. T&& is an 'rvalue sink'. In generic code, T&& with std::forward = forwarding reference."
      },
      {
        question: `int x = 5;
int&& r = x;  // Compile?`,
        willCompile: false,
        answer: "No. x is an lvalue. An rvalue reference cannot bind directly to an lvalue. Use std::move() to cast the lvalue to an rvalue.",
        fixedCode: `int x = 5;
int&& r = std::move(x); // OK: move() casts x to xvalue (rvalue)
// WARNING: x is now in 'moved-from' (valid but unspecified) state`,
        explanation: "std::move() does NOT physically move anything — it's just a cast to T&&. The actual resource transfer happens inside move constructors/assignment operators."
      }
    ]
  },
  {
    id: 2,
    title: "Move Semantics & Rule of Five",
    category: "Resource Management",
    explanation: "Move semantics (C++11) allow transferring resources from a dying (rvalue) object instead of copying. Rule of Five: if you define any of {destructor, copy ctor, copy assign, move ctor, move assign} you should define ALL FIVE. Move ctor/assign must leave the source in a valid but unspecified state.",
    keyInsight: "Move is NOT a guarantee of no allocation — it's stealing existing resources. Always mark move operations noexcept — std::vector reallocation uses move-if-noexcept, otherwise falls back to expensive copy.",
    codeExample: `class Buffer {
    int* data; size_t sz;
public:
    Buffer(size_t n) : data(new int[n]), sz(n) {}
    ~Buffer() { delete[] data; }

    // Copy: deep copy
    Buffer(const Buffer& o) : data(new int[o.sz]), sz(o.sz) {
        copy(o.data, o.data+sz, data);
    }

    // Move: steal resources, null out source
    Buffer(Buffer&& o) noexcept : data(o.data), sz(o.sz) {
        o.data = nullptr; o.sz = 0; // CRITICAL: prevent double-free
    }

    Buffer& operator=(const Buffer& o) { /* deep copy */ return *this; }
    Buffer& operator=(Buffer&& o) noexcept {
        if(this!=&o){delete[]data;data=o.data;sz=o.sz;o.data=nullptr;o.sz=0;}
        return *this;
    }
};`,
    qa: [
      {
        question: "What happens if you forget to null the pointer in move constructor?",
        willCompile: true,
        answer: "Undefined behavior (double-free). Both moved-from and new object point to the same memory. When either destructs, it frees the memory. The second destructor causes a double-free — crash or heap corruption.",
        fixedCode: `Buffer(Buffer&& o) noexcept : data(o.data), sz(o.sz) {
    o.data = nullptr; // CRITICAL: breaks the shared ownership
    o.sz   = 0;       // destructor calls delete[] nullptr — safe no-op
}`,
        explanation: "Moved-from object must be in 'valid but unspecified' state — destructor must be callable safely. delete[] nullptr is a no-op (C++ standard guarantees this)."
      },
      {
        question: "Why must move constructors be noexcept for optimal STL performance?",
        willCompile: true,
        answer: "std::vector reallocation uses std::move_if_noexcept. If move ctor is NOT noexcept, vector copies instead (to maintain strong exception guarantee). Non-noexcept moves → O(N) per push_back amortized instead of O(1).",
        fixedCode: `// Always mark moves noexcept when they truly can't throw:
Buffer(Buffer&& o) noexcept { ... }          // vector uses this for realloc
Buffer& operator=(Buffer&& o) noexcept { ... }`,
        explanation: "This is one of the most performance-critical details in C++. Always add noexcept to moves. Compilers can also optimize better when noexcept is guaranteed."
      }
    ]
  },
  {
    id: 3,
    title: "const Correctness",
    category: "Type System & Safety",
    explanation: "const propagates right-to-left (east const rule). const member functions cannot modify the object (except mutable members). Always const your getters — it enables const ref arguments to call them, enables compiler optimizations, communicates intent.",
    keyInsight: "Pointer const: 'const int* p' = pointer to const int (can't change *p). 'int* const p' = const pointer to int (can't change p). Read right-to-left: 'int const* const p' = const pointer to const int.",
    codeExample: `// Read right-to-left:
const int* p1 = &x;       // ptr to const int
int* const p2 = &x;       // const ptr to int
const int* const p3 = &x; // both const

class Widget {
    int value;
    mutable int cacheHits = 0; // mutable: OK in const methods
public:
    int getValue() const {     // const member fn
        cacheHits++;           // OK: mutable
        return value;          // read-only access to value
    }
    // Overloading for const vs non-const objects:
    int& operator[](int i)       { return data[i]; } // non-const obj
    const int& operator[](int i) const { return data[i]; } // const obj
};`,
    qa: [
      {
        question: `void process(const vector<int>& v) { v.push_back(1); }
// Will this compile?`,
        willCompile: false,
        answer: "No. push_back is a non-const member function (it modifies the vector). Calling it on const reference discards qualifiers. Error: 'passing const vector as this argument discards qualifiers'.",
        fixedCode: `void process(vector<int>& v) { v.push_back(1); } // non-const ref
// or: make a local copy
void process(vector<int> v) { v.push_back(1); } // copy`,
        explanation: "Only const member functions can be called on const objects/references. This is how C++ enforces the const contract at compile time."
      }
    ]
  },
  {
    id: 4,
    title: "RAII & Smart Pointers",
    category: "Resource Management",
    explanation: "RAII (Resource Acquisition Is Initialization): tie resource lifetime to object lifetime. Constructor acquires, destructor releases — guarantees cleanup even with exceptions. Smart pointers are the primary RAII tool for heap memory in modern C++.",
    keyInsight: "unique_ptr: exclusive ownership, zero overhead vs raw ptr, move-only. shared_ptr: shared ownership, reference-counted, ~2x overhead (atomic ref count). weak_ptr: non-owning observer, breaks cycles. NEVER use raw new/delete in modern C++.",
    codeExample: `// unique_ptr: sole owner, auto-freed on scope exit
auto p = std::make_unique<int>(42); // preferred over new
auto p2 = std::move(p); // transfer ownership — p is now nullptr

// shared_ptr: reference counted
auto s1 = std::make_shared<int>(10);
auto s2 = s1; // count=2
s1.reset();   // count=1, not freed
// s2 out of scope → count=0 → freed

// Cycle problem — use weak_ptr:
struct Node {
    std::weak_ptr<Node> next; // breaks cycle, doesn't own
};

// RAII file handle:
class FileHandle {
    FILE* f;
public:
    FileHandle(const char* p) : f(fopen(p,"r")) {
        if(!f) throw std::runtime_error("open failed");
    }
    ~FileHandle() { if(f) fclose(f); } // always called
};`,
    qa: [
      {
        question: "When should you use unique_ptr vs shared_ptr?",
        willCompile: true,
        answer: "Prefer unique_ptr by default (zero overhead, clear ownership semantics). Use shared_ptr only when ownership is genuinely shared among multiple owners. shared_ptr has ~2x memory overhead and atomic reference counting cost (even in single-threaded code).",
        fixedCode: `// Default: unique_ptr
auto w = std::make_unique<Widget>();

// Shared ownership (cache + live data both own it):
auto r = std::make_shared<Resource>();
cache[key] = r;
live_set.insert(r);`,
        explanation: "shared_ptr uses atomic operations for thread-safe ref counting — every increment/decrement has fence semantics. unique_ptr compiles to the same code as a raw pointer with automatic cleanup."
      }
    ]
  },
  {
    id: 5,
    title: "Virtual Dispatch & vtable Internals",
    category: "OOP & Compiler Internals",
    explanation: "Virtual functions are implemented via vtable (virtual function table): a per-class static array of function pointers. Each object containing virtual functions has a hidden vptr (pointer to its class's vtable). Virtual call: deref vptr → index into vtable → call function pointer.",
    keyInsight: "vtable is per-CLASS (shared by all instances), vptr is per-OBJECT (8 bytes overhead). Virtual destructor is MANDATORY in polymorphic base classes — without it, delete via base ptr → only base destructor called → resource leak.",
    codeExample: `class Animal {
    // Memory layout: [vptr (8B)][age (4B)][pad]
    int age;
public:
    virtual void speak() { cout << "..."; }
    virtual ~Animal() {}  // MUST be virtual for polymorphic delete
};

class Dog : public Animal {
    // Memory layout: [vptr→Dog::vtable][age][breed]
    int breed;
public:
    void speak() override { cout << "Woof"; }
};

Animal* a = new Dog();
a->speak(); // vptr → Dog::vtable → Dog::speak() — correct!
delete a;   // virtual ~Animal() → calls ~Dog() then ~Animal()

// Without virtual ~Animal():
delete a;   // UB: only ~Animal() called, ~Dog() NEVER called!

// CRTP: compile-time polymorphism, ZERO vtable overhead
template<typename D>
struct AnimalCRTP {
    void speak() { static_cast<D*>(this)->speakImpl(); }
};`,
    qa: [
      {
        question: "Does adding virtual functions increase sizeof(class)?",
        willCompile: true,
        answer: "Yes. Adding the FIRST virtual function adds a hidden vptr (8 bytes on 64-bit). All subsequent virtual functions don't increase object size — they just add entries to the vtable (which is static, not per-object).",
        fixedCode: `struct A { int x; };               // sizeof = 4
struct B { int x; virtual ~B(){}; }; // sizeof = 16 (4+pad+8 vptr)
// The vtable itself is static — one per class type, NOT per object.`,
        explanation: "vptr is added once per class hierarchy (per object). vtable is a static array shared by all instances. Two virtual functions still = only 8 bytes overhead per object."
      }
    ]
  },
  {
    id: 6,
    title: "Templates & SFINAE",
    category: "Generic Programming",
    explanation: "Templates enable compile-time code generation with zero runtime overhead. SFINAE (Substitution Failure Is Not An Error): when template substitution fails in a function signature, that overload is silently removed — not an error. Enables conditional compilation based on type properties.",
    keyInsight: "SFINAE only works in function/template parameter contexts, NOT in function bodies. C++20 Concepts replace SFINAE with cleaner requires clauses. type_traits library provides predicates: is_integral, is_pointer, is_same, etc.",
    codeExample: `// Basic function template
template<typename T>
T mymax(T a, T b) { return a > b ? a : b; }

// SFINAE: enable only for integral types
template<typename T>
typename enable_if<is_integral<T>::value, T>::type
safe_double(T x) { return x * 2; }

// C++20 Concepts (clean SFINAE replacement):
template<typename T> requires integral<T>
T safe_double(T x) { return x * 2; }

// Variadic templates with fold expression:
template<typename... Args>
void print_all(Args&&... args) {
    (cout << ... << args) << '\\n'; // C++17 fold
}

// Type traits:
static_assert(is_same_v<int, int>);
static_assert(!is_pointer_v<int>);
static_assert(is_pointer_v<int*>);`,
    qa: [
      {
        question: "What does SFINAE mean in practice — give an example.",
        willCompile: true,
        answer: "SFINAE = Substitution Failure Is Not An Error. When substituting template args causes an error IN THE SIGNATURE (return type, parameter types), that overload is silently removed from consideration. No error unless NO overloads match.",
        fixedCode: `template<typename T>
enable_if_t<is_integral_v<T>> foo(T x) { /* integers only */ }

foo(42);    // OK: int is integral → overload exists
foo(3.14);  // SFINAE: double not integral → removed from overload set
            // Error only if no other foo() exists`,
        explanation: "SFINAE works only in the function's signature context. Errors inside function bodies ARE compile errors. Use enable_if in return type or default template arguments for SFINAE."
      }
    ]
  },
  {
    id: 7,
    title: "Undefined Behavior (UB)",
    category: "Safety & Correctness",
    explanation: "Undefined Behavior: the C++ standard places NO constraints on program behavior. Compilers assume UB never occurs — this assumption enables optimizations that can produce wildly wrong results. UB is NOT just 'crashes at runtime' — it can silently corrupt surrounding code at compile time.",
    keyInsight: "Common UB: signed integer overflow (use unsigned for wrapping), out-of-bounds access, use-after-free, null dereference, data races on non-atomic types, strict aliasing violations. Use -fsanitize=address,undefined in debug builds.",
    codeExample: `// SIGNED OVERFLOW — UB (compiler assumes it never wraps)
int x = INT_MAX;
int y = x + 1;       // UB: may be optimized away entirely
// With -O2: if (x > x+1) → "if (false)" → dead-code eliminated!

// Correct: use unsigned (defined to wrap modularly)
unsigned u = UINT_MAX;
unsigned v = u + 1; // well-defined: wraps to 0

// OUT OF BOUNDS — UB
int arr[5];
arr[5] = 10;  // UB: writing past array

// USE AFTER FREE — UB
int* p = new int(42);
delete p;
*p = 10;   // UB: writes to freed memory

// STRICT ALIASING VIOLATION — UB
float f = 1.0f;
int* ip = reinterpret_cast<int*>(&f); // UB
// Fix: use memcpy (safe type punning)
int safe; memcpy(&safe, &f, sizeof(f));

// DATA RACE — UB
int shared = 0;
thread t([&]{ shared++; }); // UB without synchronization`,
    qa: [
      {
        question: "Why is signed overflow UB but unsigned overflow well-defined?",
        willCompile: true,
        answer: "The C++ standard explicitly defines unsigned arithmetic as modular (wraps at 2^N). Signed overflow is UB because the standard historically accommodated non-2's-complement architectures (now irrelevant in C++20 which mandates 2's complement, but still UB for legacy reasons). Compilers exploit signed UB for loop optimizations.",
        fixedCode: `// Detect before overflow:
bool safe_add(int a, int b, int* result) {
    return !__builtin_add_overflow(a, b, result);
}
// Or: use unsigned for wrapping math
unsigned wrap = UINT_MAX; wrap += 1; // 0, defined`,
        explanation: "GCC/Clang flags: -fsanitize=undefined catches UB at runtime. -fwrapv makes signed overflow wrap (well-defined but non-standard). -ftrapv makes signed overflow trap (crash). Use in debug/test builds."
      }
    ]
  },
  {
    id: 8,
    title: "Lambda Captures & Closures",
    category: "Functional Programming",
    explanation: "Lambdas create closure objects (anonymous functors). Capture modes: [=] all by value (copies at creation), [&] all by reference (DANGEROUS if lambda outlives scope), [x] explicit by value, [&x] explicit by ref, [this] captures this pointer.",
    keyInsight: "[=] in a member function captures 'this' implicitly — accessing members is actually this->member, still reference semantics! Use [val=val] (C++14 init capture) or [*this] (C++17) to truly copy member data.",
    codeExample: `int x = 10, y = 20;

auto f1 = [=]() { return x + y; }; // copies x,y at creation
x = 100; f1(); // returns 30 (old copies)

auto f2 = [&]() { return x + y; }; // references
x = 100; f2(); // returns 120

// DANGLING REFERENCE — common bug:
function<int()> get_adder() {
    int local = 42;
    return [&]() { return local; }; // DANGLING after return!
    return [=]() { return local; }; // OK: value copy
}

// Mutable lambda (can modify captured copies):
auto counter = [count=0]() mutable { return ++count; };

// Move capture (C++14): for move-only types
auto ptr = make_unique<int>(5);
auto f3 = [p=move(ptr)]() { return *p; }; // took ownership`,
    qa: [
      {
        question: `class Foo {
    int val = 42;
    auto make_lambda() { return [=]() { return val; }; }
};
// What does [=] capture here?`,
        willCompile: true,
        answer: "[=] in a member function captures 'this' (the pointer), not 'val' by value! Accessing 'val' is actually 'this->val'. If Foo is destroyed before the lambda is called → dangling 'this' → UB.",
        fixedCode: `// Fix 1: C++14 init capture — explicitly copy val
auto make_lambda() { return [val=val]() { return val; }; }

// Fix 2: C++17 — copy entire object
auto make_lambda() { return [*this]() { return val; }; }`,
        explanation: "[=] captures 'this' as a pointer (not *this as a copy) in member functions. Members accessed via this->member are reference semantics despite [=]. Use init captures or [*this] for true copies."
      }
    ]
  },
  {
    id: 9,
    title: "Memory Layout & Cache Efficiency",
    category: "Performance & Systems",
    explanation: "Cache line = 64 bytes (typical). Cache-friendly code accesses memory sequentially (spatial locality) and reuses recent data (temporal locality). Struct layout: each member aligned to its own size, struct padded to largest member's alignment. Reorder members largest-to-smallest to minimize padding.",
    keyInsight: "Array-of-Structs (AoS) vs Struct-of-Arrays (SoA): AoS good for accessing all fields of one object. SoA better for SIMD/vectorization (all values of one field in contiguous memory). False sharing: two threads modifying different fields in same cache line causes contention.",
    codeExample: `// ALIGNMENT PADDING:
struct Bad { char a; double b; char c; }; // sizeof = 24 (!)
// [a][7-pad][b(8)][c][7-pad]

struct Good { double b; char a; char c; }; // sizeof = 16
// [b(8)][a][c][6-pad]

// FALSE SHARING fix:
struct Data {
    alignas(64) int threadA; // own cache line
    alignas(64) int threadB; // own cache line
};

// AoS vs SoA:
struct AoS { float x, y, z, w; };  // one particle
vector<AoS> particles;              // good for: particles[i].x
// Iterating all x-values: cache miss every 16 bytes

struct SoA { vector<float> x, y, z, w; }; // all x contiguous
// Iterating all x-values: sequential access, SIMD-friendly`,
    qa: [
      {
        question: "Why does vector<bool> not behave like vector<int>?",
        willCompile: true,
        answer: "vector<bool> is a template specialization that packs bits (8 bools/byte). v[i] returns a proxy object (bit reference), NOT a real bool&. Code like 'bool& ref = v[0]' won't compile, and 'auto b = v[0]' gives you a proxy, not a bool.",
        fixedCode: `// Avoid vector<bool> pitfalls:
vector<char> v(n, 0);        // use char — no packing
vector<uint8_t> v(n, 0);     // or uint8_t
// If you need actual bit packing:
bitset<N> bs;                 // fixed size, proper interface
// Or boost::dynamic_bitset for dynamic size`,
        explanation: "vector<bool> specialization is widely considered a mistake in the C++ standard. The proxy object breaks generic code that takes bool& references. Use vector<char> in production."
      }
    ]
  },
  {
    id: 10,
    title: "C++ Memory Model & Atomics",
    category: "Concurrency & Systems",
    explanation: "The C++ memory model (C++11) defines how threads observe each other's memory operations. Key orderings: relaxed (atomicity only), acquire/release (synchronize producer/consumer), seq_cst (global total order, most expensive). Data races on non-atomic variables = UB.",
    keyInsight: "Acquire-Release is the sweet spot: producer does store-release (all prior writes visible before store), consumer does load-acquire (all subsequent ops see the prior writes). Works like a lightweight mutex but only for one variable + its protected data.",
    codeExample: `#include <atomic>

// DATA RACE — UB:
int shared = 0;
void inc() { shared++; } // NOT atomic!

// CORRECT: atomic operations
atomic<int> counter(0);
void inc() { counter.fetch_add(1, memory_order_relaxed); }

// Acquire-Release for protecting data:
atomic<bool> ready(false);
int data = 0;

void producer() {
    data = 42;
    ready.store(true, memory_order_release); // RELEASE: data write visible
}
void consumer() {
    while(!ready.load(memory_order_acquire)); // ACQUIRE: syncs
    assert(data == 42); // guaranteed!
}

// Compare-and-swap (CAS) for lock-free:
atomic<int> val(0);
int expected = 0;
val.compare_exchange_strong(expected, 1); // atomic: if val==0, set to 1`,
    qa: [
      {
        question: "Difference between memory_order_seq_cst and memory_order_acq_rel?",
        willCompile: true,
        answer: "seq_cst: ALL seq_cst operations across ALL threads have a single total order — most expensive (full fence on x86: MFENCE or LOCK prefix). acq_rel: only synchronizes between specific producer/consumer pairs — no global order guarantee. Use acq_rel when you only need one thread's writes visible to another specific thread.",
        fixedCode: `// seq_cst: global total order (default, most conservative)
counter.fetch_add(1); // implicit seq_cst

// acq_rel: faster, only syncs producer/consumer pair
flag.store(true, memory_order_release);  // producer
if(flag.load(memory_order_acquire)) {}   // consumer

// relaxed: only atomicity, no sync guarantees (fastest)
counter.fetch_add(1, memory_order_relaxed); // just atomic add`,
        explanation: "On x86/TSO model: acquire/release are essentially free (hardware provides them). seq_cst requires MFENCE. On ARM/POWER: all orderings have cost. Always benchmark on target architecture."
      }
    ]
  },
  {
    id: 11,
    title: "Rule of 0 / 3 / 5 & Special Member Functions",
    category: "Resource Management",
    explanation: "If your class manages a raw resource (owning pointer, file handle, socket), the compiler-generated special members do a SHALLOW copy — two owners, double free. The Rule of Three says: if you need a custom destructor, you almost certainly need a custom copy constructor AND copy assignment too. C++11's move semantics extend this to the Rule of Five (add move ctor + move assignment). The modern best practice is the Rule of Zero: own resources through RAII types (vector, unique_ptr, string) so you write NONE of the special members and the defaults are already correct.",
    keyInsight: "Declaring ANY of dtor / copy / move changes what the compiler generates for the others. A user-declared destructor suppresses the implicit MOVE operations (so the class silently falls back to copying) and deprecates the implicit copy. So 'I added a destructor for logging' can silently kill move semantics and tank performance. Rule of Zero sidesteps all of it.",
    codeExample: `// BAD: Rule of Three violated -> shallow copy -> double free
struct Buf {
    int* p;
    Buf(int n): p(new int[n]) {}
    ~Buf() { delete[] p; }          // custom dtor, but no copy ctrl
};
Buf a(10); Buf b = a;               // b.p == a.p; both dtors delete -> UB

// GOOD (Rule of Five): deep copy + move
struct Buf5 {
    int* p; size_t n;
    Buf5(size_t n): p(new int[n]), n(n) {}
    ~Buf5() { delete[] p; }
    Buf5(const Buf5& o): p(new int[o.n]), n(o.n) {        // copy
        std::copy(o.p, o.p+o.n, p);
    }
    Buf5& operator=(Buf5 o) noexcept {                    // copy-and-swap
        std::swap(p,o.p); std::swap(n,o.n); return *this;
    }
    Buf5(Buf5&& o) noexcept: p(o.p), n(o.n) { o.p=nullptr; o.n=0; } // move
};

// BEST (Rule of Zero): no special members needed at all
struct Buf0 { std::vector<int> data; Buf0(int n): data(n) {} };`,
    qa: [
      {
        question: `struct S {
    int* p = new int[4];
    ~S() { delete[] p; }
};
S a; S b = a; // what happens at scope end?`,
        willCompile: true,
        answer: "Compiles, but it's UB at runtime. The implicitly-generated copy constructor does a shallow copy, so a.p == b.p. At scope end BOTH destructors run delete[] on the same pointer → double free / heap corruption.",
        fixedCode: `// Fix: Rule of Zero — let a vector own the memory
struct S {
    std::vector<int> p = std::vector<int>(4);
    // no destructor, no copy/move needed; all defaults are correct
};
S a; S b = a; // deep copy, two independent buffers, no double free`,
        explanation: "The presence of a user destructor is the red flag: it means the class owns something, so the default shallow copy is wrong. Either follow the Rule of Five or (better) delegate ownership to a RAII member and write zero special members."
      },
      {
        question: `struct Logger {
    ~Logger() { /* flush */ }
    std::vector<int> data;
};
// Is 'Logger b = std::move(a);' a move or a copy?`,
        willCompile: true,
        answer: "It's a COPY, not a move. Because Logger declares a destructor, the compiler does NOT implicitly generate move operations. std::move(a) produces an rvalue, but with no move ctor available, overload resolution falls back to the copy constructor — silently copying the vector.",
        fixedCode: `struct Logger {
    ~Logger() { /* flush */ }
    std::vector<int> data;
    Logger(Logger&&) = default;             // re-enable moves explicitly
    Logger& operator=(Logger&&) = default;
    Logger(const Logger&) = default;
    Logger& operator=(const Logger&) = default;
};`,
        explanation: "User-declaring a destructor suppresses implicit move generation (Rule of Five corollary). This is a classic silent performance bug — adding a logging destructor turned every 'move' into a deep copy. Either default the moves explicitly or remove the destructor (Rule of Zero)."
      }
    ]
  },
  {
    id: 12,
    title: "Virtual Dispatch, vtables & the Virtual Destructor Rule",
    category: "OOP & Object Model",
    explanation: "A class with any virtual function gets a hidden vptr (8 bytes) at offset 0, pointing to a per-class vtable in .rodata that holds the function pointers. A call through a base pointer loads the vptr, indexes the vtable, and does an indirect call — runtime ('late') binding. Non-virtual calls bind at compile time from the STATIC type. The most dangerous rule: if you ever delete a derived object through a base pointer, the base destructor MUST be virtual, or only ~Base runs and the derived resources leak (UB).",
    keyInsight: "Three traps interviewers love: (1) deleting through a base pointer with a non-virtual destructor = UB / leak. (2) Calling a virtual function inside a constructor/destructor does NOT dispatch to the derived override — the vptr points to the class currently being (de)constructed. (3) Passing a polymorphic object BY VALUE slices it — only the base sub-object is copied and the vptr becomes the base's.",
    codeExample: `struct Base {
    virtual void who() { std::cout << "Base"; }
    virtual ~Base() {}                  // virtual dtor: REQUIRED for safe delete
};
struct Derived : Base {
    int* res = new int[100];
    void who() override { std::cout << "Derived"; }
    ~Derived() override { delete[] res; }
};

Base* b = new Derived();
b->who();                               // "Derived" — vtable dispatch
delete b;                               // ~Derived THEN ~Base run — no leak
                                        // (if ~Base weren't virtual: leak + UB)

// Slicing: pass by value loses the derived part
void take(Base x) { x.who(); }          // always prints "Base"
Derived d; take(d);                     // sliced — pass Base&/Base* instead`,
    qa: [
      {
        question: `struct A { ~A(){ std::cout<<"~A"; } };
struct B : A { ~B(){ std::cout<<"~B"; } };
A* p = new B();
delete p;   // output?`,
        willCompile: true,
        answer: "Prints only '~A'. A's destructor is NOT virtual, so 'delete p' (static type A*) calls only ~A. ~B never runs — any resources B owned leak, and deleting a derived object through a non-virtual base dtor is officially undefined behavior.",
        fixedCode: `struct A { virtual ~A(){ std::cout<<"~A"; } };  // make it virtual
struct B : A { ~B() override { std::cout<<"~B"; } };
A* p = new B();
delete p;   // now prints "~B~A" — full destruction, no leak`,
        explanation: "Rule: a class intended to be used polymorphically (deleted via base pointer) needs a virtual destructor. Cost is one vptr per object. If a class is NOT meant to be a base, leaving the dtor non-virtual is fine — and you can mark the class 'final'."
      },
      {
        question: `struct Base {
    Base(){ log(); }
    virtual void log(){ std::cout<<"Base"; }
};
struct Derived : Base {
    void log() override { std::cout<<"Derived"; }
};
Derived d;  // what prints?`,
        willCompile: true,
        answer: "Prints 'Base'. During Base's constructor the Derived part doesn't exist yet, so the vptr still points to Base's vtable — the virtual call resolves to Base::log(), not the override. Virtual dispatch is effectively disabled inside constructors and destructors.",
        fixedCode: `// Don't rely on virtual dispatch in ctors. Pass needed behavior in, or
// do two-phase init:
struct Derived : Base {
    void log() override { std::cout<<"Derived"; }
    static Derived create() { Derived d; d.log(); return d; } // call AFTER construction
};`,
        explanation: "The object is built base-first; the vptr is rewritten to each class's vtable as construction climbs the hierarchy. A pure-virtual call from a constructor is even worse — it's UB ('pure virtual method called')."
      }
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════
//  CHEATSHEET — 15 Core Patterns
// ═══════════════════════════════════════════════════════════════════
export const CHEATSHEET = [
  {
    pattern: "0/1 Knapsack",
    when: "Pick or skip each item (use at most once) with capacity/budget constraint",
    template: "for(item) for(s = max; s >= item; s--) dp[s] |= dp[s-item]",
    tip: "REVERSE inner loop = each item used once. FORWARD = unbounded reuse.",
    problems: ["Partition Equal Subset Sum", "Target Sum", "Last Stone Weight II"]
  },
  {
    pattern: "Unbounded Knapsack",
    when: "Each item can be used unlimited times; minimize/maximize/count",
    template: "for(item) for(a = item; a <= max; a++) dp[a] = min/max/+ dp[a-item]",
    tip: "Combinations: outer=items, inner=amounts. Permutations: outer=amounts, inner=items.",
    problems: ["Coin Change", "Coin Change II", "Combination Sum IV"]
  },
  {
    pattern: "Two-String DP",
    when: "Alignment, matching, or transformation of two sequences",
    template: "dp[i][j] from dp[i-1][j-1] (diagonal), dp[i-1][j] (top), dp[i][j-1] (left)",
    tip: "Match → diagonal free. Mismatch → 1 + min(3 neighbors). Foundation of edit dist, LCS, regex.",
    problems: ["Edit Distance", "LCS", "Wildcard Matching", "Regex Matching"]
  },
  {
    pattern: "Interval DP",
    when: "Subproblems on contiguous sub-ranges; think about LAST action",
    template: "for(gap) for(l) { r=l+gap; for(k=l+1..r) dp[l][r] = max(dp[l][k]+dp[k][r]+cost) }",
    tip: "Fill by INCREASING GAP. Think which action happens LAST to make subproblems independent.",
    problems: ["Burst Balloons", "LPS", "Stone Game", "Matrix Chain Multiplication"]
  },
  {
    pattern: "Bitmask DP",
    when: "N ≤ 20, need to track visited subsets (TSP-like problems)",
    template: "dp[mask | (1<<i)] from dp[mask] — 2^N states × N transitions",
    tip: "BFS + bitmask for shortest path. DP + bitmask for optimization. State: O(N × 2^N).",
    problems: ["Shortest Path All Nodes", "Can I Win", "Sticker Problem"]
  },
  {
    pattern: "Multi-Source BFS",
    when: "Simultaneous spread from multiple sources; unknown/any start point",
    template: "Enqueue ALL sources before BFS. Level-order = distance from nearest source.",
    tip: "Mark cells BEFORE enqueue (not after pop). Used in: 01 Matrix, Rotting Oranges, Pacific Atlantic.",
    problems: ["Rotting Oranges", "01 Matrix", "Pacific Atlantic Water Flow"]
  },
  {
    pattern: "Dijkstra's Algorithm",
    when: "Shortest path with NON-NEGATIVE edge weights",
    template: "min-heap {dist, node}. Pop → skip if d > dist[u]. Relax neighbors.",
    tip: "Skip stale entries for O(E log V). Once popped = finalized. Fails for negative edges.",
    problems: ["Network Delay Time", "Path with Max Probability"]
  },
  {
    pattern: "Bellman-Ford",
    when: "Negative edges, or K-steps constraint",
    template: "K+1 rounds: COPY dist array, then relax all edges from copied version",
    tip: "COPY prevents cascading in one round (enforces K-edge constraint). V-th round improving → negative cycle.",
    problems: ["Cheapest Flights K Stops", "Negative Cycle Detection"]
  },
  {
    pattern: "Topological Sort (Kahn's)",
    when: "Ordering with dependencies (DAG), cycle detection in directed graphs",
    template: "indegree array → enqueue 0-indegree → BFS: process, decrement, enqueue",
    tip: "processed < total → cycle exists. Processing order IS topological order.",
    problems: ["Course Schedule I & II", "Alien Dictionary"]
  },
  {
    pattern: "Union-Find (DSU)",
    when: "Dynamic connectivity, cycle detection in undirected graphs, MST (Kruskal)",
    template: "find(x) with path compression. unite(x,y): union by rank. False if same component.",
    tip: "unite() false = cycle detected. Track component count for connectivity queries.",
    problems: ["Redundant Connection", "Number of Provinces", "MST (Kruskal)"]
  },
  {
    pattern: "Sliding Window",
    when: "Subarray/substring satisfying a constraint; optimize window bounds",
    template: "Expand right, shrink left when invalid. Fixed: both move. Variable: have/need counting.",
    tip: "Have/need pattern: update 'have' only at exact threshold crossings.",
    problems: ["Min Window Substring", "Longest No-Repeat", "Permutation in String"]
  },
  {
    pattern: "Monotonic Stack/Deque",
    when: "Next greater/smaller element, histogram areas, sliding window max",
    template: "Stack stores indices, monotonic values. Pop when invariant violated.",
    tip: "Increasing stack → next smaller. Decreasing stack → next greater. Deque for sliding window.",
    problems: ["Largest Rectangle", "Trapping Rain", "Sliding Window Max"]
  },
  {
    pattern: "Prefix Sum + HashMap",
    when: "Count subarrays with sum/XOR/mod equal to target",
    template: "map[0]=1. curr+=num. count+=map[curr-k]. map[curr]++.",
    tip: "Init {0:1} handles subarrays from index 0. Works for: sum, XOR, mod, longest subarray.",
    problems: ["Subarray Sum = K", "XOR Queries", "Continuous Subarray Sum"]
  },
  {
    pattern: "Binary Search on Answer",
    when: "Monotonic predicate: can we achieve answer ≤ X? Find min/max feasible value.",
    template: "l=min, r=max. While l<r: mid=(l+r)/2. feasible(mid)→r=mid. else→l=mid+1.",
    tip: "Identify monotonic property first. Template: lo ≤ answer ≤ hi. Use feasible() predicate.",
    problems: ["Koko Eating Bananas", "Min Days to Bloom", "Split Array Largest Sum"]
  },
  {
    pattern: "Two Heaps",
    when: "Running median, K-th element online, schedule optimization",
    template: "max-heap (lower half) + min-heap (upper half). Balance sizes after insert.",
    tip: "Always add to small first, then rebalance. small.top() = median or left-of-median.",
    problems: ["Median Data Stream", "Sliding Window Median", "IPO Problem"]
  }
];

// ═══════════════════════════════════════════════════════════════════
//  TIPS — 6 Categories
// ═══════════════════════════════════════════════════════════════════
export const TIPS = [
  {
    title: "Pattern Recognition Decision Tree",
    tips: [
      "Shortest/min steps on unweighted graph? → BFS",
      "Shortest path with positive weights? → Dijkstra (skip stale: d > dist[u])",
      "Negative edges or K-step constraint? → Bellman-Ford (COPY array each round)",
      "Count/optimize over subsets? → DP — define states, transitions, base cases",
      "Locally optimal → globally optimal (provable)? → Greedy",
      "Dependencies / processing order? → Topological Sort (Kahn's BFS)",
      "Pick items with capacity constraint? → Knapsack DP (reverse=0/1, forward=unbounded)",
      "Two strings/sequences? → 2D prefix DP (diagonal=match, top/left=skip)",
      "Pick from ends of array? → Interval DP (fill by increasing gap, think LAST action)",
      "N ≤ 20 + track subsets? → Bitmask DP (2^N states)",
      "Connectivity/grouping? → Union-Find or BFS/DFS",
      "Subarray + condition? → Sliding Window or Prefix+HashMap ({0:1} init)",
      "Next greater/smaller / histogram? → Monotonic Stack (sentinel trick)",
      "Sorted array / search space monotone? → Binary Search on answer",
    ]
  },
  {
    title: "Complexity → Max Input Size",
    tips: [
      "O(2^N): N ≤ 20 — Bitmask DP, subsets, brute-force small N",
      "O(N!): N ≤ 10-12 — Permutations, N-Queens, TSP exact",
      "O(N³): N ≤ 500 — Floyd-Warshall, interval DP, matrix chain",
      "O(N²): N ≤ 5000 — Most 2D DP, naive LIS, Edit Distance",
      "O(N log N): N ≤ 10^6 — Sorting, LIS optimized, merge sort",
      "O(N): N ≤ 10^7 — Linear scan, sliding window, BFS/DFS",
      "O(log N): N ≤ 10^18 — Binary search, exponentiation by squaring",
    ]
  },
  {
    title: "C++ STL Quick Reference",
    tips: [
      "priority_queue<int> = max-heap. Use greater<int> for min-heap.",
      "lower_bound → first element >= x. upper_bound → first element > x.",
      "accumulate(begin, end, 0) for sum. Use 0LL for long long to avoid overflow.",
      "iota(begin, end, 0) fills 0,1,2,...,n-1. Useful for parent[] in DSU.",
      "auto [a, b] = pair; — C++17 structured bindings. Works with tuples too.",
      "__builtin_popcount(x) counts set bits. __builtin_clz(x) counts leading zeros.",
      "unordered_map: O(1) avg, O(N) worst. map: O(log N) always, ordered.",
      "emplace_back constructs in-place; push_back copies/moves existing object.",
    ]
  },
  {
    title: "Common Interview Mistakes",
    tips: [
      "Not clarifying constraints (N, value ranges, edge cases) BEFORE coding.",
      "BFS: marking visited AFTER pop instead of BEFORE enqueue → TLE from duplicates.",
      "Knapsack: using forward loop in 0/1 knapsack (should be reverse to prevent reuse).",
      "Bellman-Ford K-stops: not copying dist array → cascading relaxation violates K-limit.",
      "Dijkstra: not skipping stale heap entries (d > dist[u]) → O(VE) instead of O(E log V).",
      "LRU Cache: null pointer crash without sentinel nodes in doubly linked list.",
      "Backtracking: forgetting to undo the choice → corrupted path for next iteration.",
      "Binary search: using (l+r)/2 → overflow for large values. Always use l+(r-l)/2.",
      "Prefix sum: forgetting to initialize map with {0:1} → misses subarrays from index 0.",
      "Integer overflow: products/sums exceeding INT_MAX — always cast to long long early.",
    ]
  },
  {
    title: "Systems / Qualcomm / Nvidia Interview Focus",
    tips: [
      "Graph algorithms: DAG scheduling, dependency analysis → Topological Sort + cycle detection.",
      "Register allocation: interval graph coloring (each live range is an interval on a timeline).",
      "DP on trees/DAGs: optimal instruction scheduling, code generation DAG evaluation.",
      "Union-Find: alias analysis, points-to analysis, SSA form construction in compilers.",
      "Interval DP: live range analysis, loop optimization boundaries.",
      "Bit manipulation: popcount, reverse bits, bit field extraction — maps to CPU instructions.",
      "Know DFS tree edge types: tree/back/cross/forward edges — implications for cycle detection.",
      "LRU/cache eviction: critical for compiler cache (register window, instruction cache modelling).",
      "Multi-source BFS: pipeline stage distance, data dependence graph analysis.",
    ]
  },
  {
    title: "Interview Communication Strategy",
    tips: [
      "Restate the problem: 'So we need to find... given... return...'. Confirms understanding.",
      "Walk through an example BEFORE coding — shows pattern recognition, catches edge cases.",
      "State approach and complexity BEFORE coding — gives interviewer chance to guide you.",
      "Code clean, named variables — interviewers read your code, don't run it mentally.",
      "Dry-run your code on the example after writing — catch off-by-one and edge cases.",
      "Discuss trade-offs: 'Map for O(1) lookup at O(N) space, or binary search for O(1) space at O(log N)'.",
      "Always mention edge cases: empty input, single element, all same values, INT_MAX overflow.",
      "For DP: state definition → recurrence → base cases → fill order → space optimization.",
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════
//  NVIDIA BUG HUNT — Code Reading & Bug-Finding Exercises
//  (Based on actual NVIDIA compiler verification interview format)
// ═══════════════════════════════════════════════════════════════════
export const NVIDIA_BUG_HUNT = [
  {
    id: 1, title: "Dangling Pointer — Return Address of Local",
    category: "Memory Safety", difficulty: "High Probability",
    buggyCode: `char* getGreeting() {
    char msg[] = "Hello NVIDIA";  // local array on stack!
    return msg;                   // BUG: dangling pointer after return
}
int main() {
    char* s = getGreeting();
    printf("%s\\n", s);          // UB: stack frame is gone
}`,
    bugs: [
      "msg[] is stack-allocated — destroyed when getGreeting() returns",
      "Returning address of local variable → dangling pointer",
      "UB: accessing freed stack memory. Compiles fine, crashes at runtime"
    ],
    fixedCode: `// Fix 1: static storage duration (lives forever)
char* getGreeting() {
    static char msg[] = "Hello NVIDIA";
    return msg;
}
// Fix 2: heap allocation (caller must free)
char* getGreeting() {
    char* msg = (char*)malloc(13);
    strcpy(msg, "Hello NVIDIA");
    return msg;
}
// Fix 3 (C++): std::string — RAII, no manual memory
std::string getGreeting() { return "Hello NVIDIA"; }`,
    whatToSay: "getGreeting() returns a pointer to a local char array. Once the function returns, the stack frame is destroyed — dangling pointer. Fix: static storage, heap allocation, or std::string."
  },
  {
    id: 2, title: "Off-by-One in Loop + Array Bounds",
    category: "Bounds & Indexing", difficulty: "High Probability",
    buggyCode: `int sumArray(int* arr, int n) {
    int sum = 0;
    for (int i = 0; i <= n; i++) {  // BUG: should be i < n
        sum += arr[i];               // arr[n] is out of bounds!
    }
    return sum;
}`,
    bugs: [
      "i <= n causes arr[n] access — one past the end, UB",
      "Fix: use strict less-than: i < n"
    ],
    fixedCode: `int sumArray(int* arr, int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) { // FIXED
        sum += arr[i];
    }
    return sum;
}`,
    whatToSay: "Classic off-by-one. i <= n causes arr[n] access — OOB UB. Should be i < n."
  },
  {
    id: 3, title: "Stack — Missing Overflow/Underflow Checks",
    category: "Data Structure Safety", difficulty: "High Probability",
    buggyCode: `struct Stack {
    int data[100]; int top = -1;
    void push(int val) { data[++top] = val; }  // BUG: no overflow check
    int  pop()         { return data[top--]; }  // BUG: no underflow check
    int  peek()        { return data[top];   }  // BUG: crashes if empty
};`,
    bugs: [
      "push(): top can exceed 99 → out-of-bounds write (OOB)",
      "pop(): top can go below -1 → data[-1] UB",
      "peek(): top == -1 on empty stack → data[-1] UB"
    ],
    fixedCode: `struct Stack {
    int data[100]; int top = -1;
    bool push(int v) { if(top>=99) return false; data[++top]=v; return true; }
    bool pop(int& v) { if(top<0)   return false; v=data[top--]; return true; }
    bool peek(int& v){ if(top<0)   return false; v=data[top];   return true; }
};`,
    whatToSay: "Three bugs: no overflow check in push (top > 99), no underflow check in pop (top < 0), same for peek. All three need boundary guards."
  },
  {
    id: 4, title: "Call by Value vs. Reference — Swap Bug",
    category: "Function Semantics", difficulty: "High Probability",
    buggyCode: `void swapNodes(Node* a, Node* b) {  // BUG: by value!
    Node* temp = a; a = b; b = temp;  // swaps LOCAL copies only
}
// p and q unchanged after the call!`,
    bugs: [
      "Pointers passed by value — a and b are copies of p and q",
      "Modifying a/b only changes local vars inside swapNodes"
    ],
    fixedCode: `// Fix 1: references to pointers
void swapNodes(Node*& a, Node*& b) {
    Node* temp = a; a = b; b = temp;
}
// Fix 2: pointer to pointer (C style)
void swapNodes(Node** a, Node** b) {
    Node* temp = *a; *a = *b; *b = temp;
}`,
    whatToSay: "Classical pass-by-value pointer bug. Swapping pointer copies doesn't affect the caller. Need Node*& or Node** to modify the actual pointer variables."
  },
  {
    id: 5, title: "Precision Loss — Integer Division Before Cast",
    category: "Type Safety", difficulty: "Medium Probability",
    buggyCode: `double divide(int a, int b) {
    return a / b;  // BUG: integer division! 7/2 = 3, not 3.5
}`,
    bugs: [
      "a/b is integer division — truncates BEFORE assigning to double",
      "divide(7,2) returns 3.0, not 3.5"
    ],
    fixedCode: `double divide(int a, int b) {
    return (double)a / b;  // FIXED: cast before division
}`,
    whatToSay: "Integer division truncates before the implicit cast to double. Must cast one operand first: (double)a / b."
  },
  {
    id: 6, title: "Memory Leak — malloc Without free on All Paths",
    category: "Memory Management", difficulty: "Medium Probability",
    buggyCode: `char* processInput(const char* input) {
    char* buf = (char*)malloc(strlen(input) + 1);
    strcpy(buf, input);
    if (strlen(buf) == 0) return NULL;  // BUG: buf leaked!
    return buf;
}`,
    bugs: [
      "Early return on empty string leaks buf — free() not called before return NULL"
    ],
    fixedCode: `char* processInput(const char* input) {
    char* buf = (char*)malloc(strlen(input) + 1);
    strcpy(buf, input);
    if (strlen(buf) == 0) { free(buf); return NULL; }  // FIXED
    return buf;
}`,
    whatToSay: "The early return path forgets to free buf. Every malloc must have a corresponding free on ALL exit paths."
  },
  {
    id: 7, title: "= Instead of == (Assignment in Condition)",
    category: "Logic Error", difficulty: "Medium Probability",
    buggyCode: `if (user->role = ADMIN) { ... }  // BUG: always true!
if (code = 0)            { ... }  // BUG: always false!`,
    bugs: [
      "= assigns and evaluates to assigned value — ADMIN is truthy, so always true",
      "code = 0 always false (0 is falsy) — success branch never runs"
    ],
    fixedCode: `if (user->role == ADMIN) { ... }  // FIXED
if (code == 0)            { ... }  // FIXED
// Prevention: Yoda condition — if (ADMIN == user->role)`,
    whatToSay: "= is assignment, == is comparison. Classic logic bug. Use Yoda conditions (constant on left) to get compiler error on accidental =."
  },
  {
    id: 8, title: "NULL Pointer Dereference Without Check",
    category: "Memory Safety", difficulty: "High Probability",
    buggyCode: `int getLength(char* str) {
    return strlen(str);        // BUG: segfault if str is NULL
}
Node* find(Node* head, int v) {
    while (head->val != v) {   // BUG: segfault if head is NULL
        head = head->next;
    }
    return head;
}`,
    bugs: [
      "strlen(NULL) → undefined behavior / segfault",
      "head->val when head==NULL → segfault"
    ],
    fixedCode: `int getLength(char* str) {
    if (!str) return 0;
    return strlen(str);
}
Node* find(Node* head, int v) {
    while (head && head->val != v) head = head->next;
    return head; // NULL if not found
}`,
    whatToSay: "Always null-check before dereferencing. strlen(NULL) is UB. Loop condition needs head != NULL before accessing head->val."
  },
  {
    id: 9, title: "Iterator Invalidation During erase()",
    category: "STL & Iterators", difficulty: "High Probability",
    buggyCode: `std::vector<int> v = {1,2,3,4,5,6};
for (auto it = v.begin(); it != v.end(); ++it) {
    if (*it % 2 == 0)
        v.erase(it);   // BUG: erase invalidates 'it', then ++it is UB
}`,
    bugs: [
      "vector::erase invalidates 'it' and every iterator after it",
      "After erase, ++it advances a dangling iterator → UB / skipped elements",
      "Also shifts elements left, so the loop silently skips the value after each removal"
    ],
    fixedCode: `// Fix 1: erase returns the next valid iterator — use it
for (auto it = v.begin(); it != v.end(); ) {
    if (*it % 2 == 0) it = v.erase(it);  // reseat from return value
    else              ++it;
}
// Fix 2 (C++20, preferred): erase-remove in one line
std::erase_if(v, [](int x){ return x % 2 == 0; });
// Pre-C++20 idiom:
v.erase(std::remove_if(v.begin(), v.end(),
        [](int x){ return x % 2 == 0; }), v.end());`,
    whatToSay: "vector::erase invalidates the passed iterator and all that follow. Never ++ an iterator you just erased. Use the iterator erase() RETURNS, or the erase-remove idiom / std::erase_if. For std::map/set, erase only invalidates the erased node, so `it = m.erase(it)` also works there."
  },
  {
    id: 10, title: "Use-After-Move",
    category: "Move Semantics", difficulty: "Medium Probability",
    buggyCode: `std::unique_ptr<int> a = std::make_unique<int>(42);
std::unique_ptr<int> b = std::move(a);   // ownership transferred to b
std::cout << *a << "\\n";                 // BUG: a is now nullptr → UB`,
    bugs: [
      "After std::move, 'a' holds nullptr (unique_ptr's moved-from state is defined as null)",
      "Dereferencing *a is a null-pointer dereference → UB / crash",
      "General trap: reading the VALUE of any moved-from object (it's valid-but-unspecified)"
    ],
    fixedCode: `std::unique_ptr<int> a = std::make_unique<int>(42);
std::unique_ptr<int> b = std::move(a);
if (a) std::cout << *a;          // safe: a is null, branch skipped
std::cout << *b << "\\n";        // use b — it owns the value now
// Rule: after moving from x, only assign to it or destroy it
// before reading its value again.`,
    whatToSay: "std::move is a cast to rvalue; the move ctor leaves the source in a valid-but-unspecified state. For unique_ptr that state is defined as nullptr, so *a is a null deref. After moving from an object, only reassign or destroy it before reading its value. Enable clang-tidy bugprone-use-after-move to catch this."
  },
  {
    id: 11, title: "Rule of Three Violation — Double Free",
    category: "Memory Safety", difficulty: "High Probability",
    buggyCode: `struct Buf {
    int* data;
    Buf(int n) { data = new int[n]; }
    ~Buf() { delete[] data; }
    // BUG: no copy ctor / copy assignment defined
};
void f() {
    Buf a(10);
    Buf b = a;     // shallow copy: b.data == a.data
}                  // ~b then ~a both delete[] the SAME pointer → double free`,
    bugs: [
      "Compiler-generated copy ctor does a shallow (member-wise) copy → two objects own one buffer",
      "Both destructors delete[] the same pointer → double free (heap corruption)",
      "Violates the Rule of Three: a class managing a raw resource needs dtor + copy ctor + copy assignment"
    ],
    fixedCode: `// Fix 1 (best): own the resource with a smart container — Rule of Zero
struct Buf {
    std::vector<int> data;
    Buf(int n) : data(n) {}      // no dtor/copy/move needed at all
};
// Fix 2: obey the Rule of Five with deep copy + move
struct Buf {
    int* data; size_t n;
    Buf(size_t n): data(new int[n]), n(n) {}
    ~Buf() { delete[] data; }
    Buf(const Buf& o): data(new int[o.n]), n(o.n) {
        std::copy(o.data, o.data + o.n, data);          // deep copy
    }
    Buf& operator=(Buf o) { swap(o); return *this; }    // copy-and-swap
    Buf(Buf&& o) noexcept: data(o.data), n(o.n) { o.data=nullptr; o.n=0; }
    void swap(Buf& o) noexcept { std::swap(data,o.data); std::swap(n,o.n); }
};`,
    whatToSay: "A class with a raw owning pointer and a custom destructor MUST also define copy/move (Rule of Three/Five) or it gets a shallow copy → two owners → double free. The modern answer is the Rule of Zero: hold the resource in std::vector / std::unique_ptr so the compiler-generated special members are already correct."
  },
  {
    id: 12, title: "Data Race — Unsynchronized Shared Counter",
    category: "Concurrency", difficulty: "Medium Probability",
    buggyCode: `int counter = 0;                       // shared, non-atomic
void worker() {
    for (int i = 0; i < 100000; ++i)
        ++counter;                     // BUG: read-modify-write race
}
// std::thread t1(worker), t2(worker); t1.join(); t2.join();
// counter is < 200000 and non-deterministic`,
    bugs: [
      "++counter is load → add → store, NOT atomic; two threads interleave and lose updates",
      "Concurrent access with at least one writer and no synchronization = data race = UB",
      "Result is non-deterministic and typically less than the expected 200000"
    ],
    fixedCode: `// Fix 1: atomic (lock-free, fastest for a simple counter)
std::atomic<int> counter{0};
void worker() {
    for (int i = 0; i < 100000; ++i)
        counter.fetch_add(1, std::memory_order_relaxed); // count-only → relaxed OK
}
// Fix 2: mutex (when the update isn't a single atomic op)
std::mutex m; int counter = 0;
void worker() {
    for (int i = 0; i < 100000; ++i) {
        std::lock_guard<std::mutex> lk(m);
        ++counter;
    }
}`,
    whatToSay: "++counter on a shared plain int from two threads is a data race — it's a non-atomic read-modify-write, so updates are lost and the program has UB. Fix with std::atomic<int> and fetch_add (memory_order_relaxed is fine for a pure counter since no other memory is being published), or a mutex when more than one variable must move together."
  },
  {
    id: 13, title: "Integer Overflow in Binary Search Midpoint",
    category: "Bounds & Overflow", difficulty: "High Probability",
    buggyCode: `int binarySearch(vector<int>& a, int target) {
    int lo = 0, hi = a.size() - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;       // BUG: lo + hi can overflow int
        if (a[mid] == target) return mid;
        else if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`,
    bugs: [
      "lo + hi overflows signed int when both are large (e.g. near INT_MAX) → UB, negative mid → out-of-bounds",
      "Signed integer overflow is undefined behavior, not a defined wraparound",
      "Secondary: a.size()-1 is unsigned; on an empty vector it underflows to SIZE_MAX (separate latent bug)"
    ],
    fixedCode: `int binarySearch(vector<int>& a, int target) {
    if (a.empty()) return -1;
    int lo = 0, hi = (int)a.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;  // overflow-safe midpoint
        if (a[mid] == target) return mid;
        else if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`,
    whatToSay: "The midpoint (lo + hi) / 2 overflows when lo + hi exceeds INT_MAX — a famous bug that sat in the JDK's binary search for years. Compute mid = lo + (hi - lo) / 2 instead, which never overflows. Also guard the unsigned size()-1 underflow on empty input."
  },
  {
    id: 14, title: "Slicing — Storing Polymorphic Objects by Value",
    category: "OOP & Polymorphism", difficulty: "Medium Probability",
    buggyCode: `struct Shape { virtual double area() const { return 0; } };
struct Circle : Shape {
    double r;
    Circle(double r): r(r) {}
    double area() const override { return 3.14159 * r * r; }
};
std::vector<Shape> shapes;          // BUG: container of VALUES
shapes.push_back(Circle(2.0));      // sliced to a Shape!
double a = shapes[0].area();        // returns 0, not ~12.57`,
    bugs: [
      "vector<Shape> stores Shape VALUES; pushing a Circle copies only the Shape sub-object (slicing)",
      "The stored object's vptr is Shape's → area() dispatches to Shape::area → returns 0",
      "Polymorphism is silently lost; compiles with no warning"
    ],
    fixedCode: `// Store pointers so the dynamic type (and vtable) is preserved
std::vector<std::unique_ptr<Shape>> shapes;
shapes.push_back(std::make_unique<Circle>(2.0));
double a = shapes[0]->area();        // ~12.57 — correct virtual dispatch
// (Shape also needs a virtual destructor for safe deletion through Shape*)`,
    whatToSay: "Storing a derived object in a vector<Base> slices it — only the base part is copied and virtual dispatch is lost, so area() returns the base's 0. Polymorphic objects must be held by pointer (vector<unique_ptr<Base>>) or reference, never by value. And give Base a virtual destructor."
  },
];

// ═══════════════════════════════════════════════════════════════════
//  NVIDIA OUTPUT QUIZ — Tricky C++ Output Questions
// ═══════════════════════════════════════════════════════════════════
export const NVIDIA_OUTPUT_QUIZ = [
  {
    id: 1, title: "Pre/Post Increment in Expression",
    category: "Operator Semantics",
    code: `int x = 5;
cout << x++ << " " << ++x << endl;`,
    correctAnswer: "Undefined Behavior — compiler-dependent",
    explanation: "Modifying x and reading it in the same expression without sequencing = UB in C++ (pre-C++17) / unspecified evaluation order. Don't rely on this. In an interview, say 'This is UB — the result is compiler-dependent.'",
    keyInsight: "Pre-increment: ++x returns new value. Post-increment: x++ returns old value, increments after. But in a single expression modifying x twice → UB."
  },
  {
    id: 2, title: "Constructor/Destructor Order in Inheritance",
    category: "OOP Lifecycle",
    code: `struct A { A(){cout<<"A() ";} ~A(){cout<<"~A() ";} };
struct B:A { B(){cout<<"B() ";} ~B(){cout<<"~B() ";} };
int main() { B b; }`,
    correctAnswer: "A() B() ~B() ~A()",
    explanation: "Construction: base first, then derived (bottom-up). Destruction: derived first, then base (top-down, LIFO). This is fundamental C++ object model.",
    keyInsight: "Base ALWAYS constructed before derived. Derived ALWAYS destroyed before base. If ~A() is not virtual and you delete via Base*, ~B() is never called — UB!"
  },
  {
    id: 3, title: "Virtual Dispatch vs Non-Virtual",
    category: "Polymorphism",
    code: `struct Base {
    virtual void foo() { cout << "Base::foo "; }
    void bar()         { cout << "Base::bar "; }
};
struct Derived : Base {
    void foo() override { cout << "Derived::foo "; }
    void bar()          { cout << "Derived::bar "; }
};
int main() {
    Base* b = new Derived();
    b->foo(); b->bar();
}`,
    correctAnswer: "Derived::foo Base::bar",
    explanation: "foo() is virtual → runtime dispatch via vtable → calls Derived::foo(). bar() is non-virtual → compile-time dispatch based on static type (Base*) → calls Base::bar().",
    keyInsight: "Virtual = late binding (runtime). Non-virtual = early binding (compile-time, based on declared type of pointer)."
  },
  {
    id: 4, title: "Static Local Variable",
    category: "Storage Duration",
    code: `int counter() { static int c = 0; return ++c; }
int main() { cout << counter() << " " << counter() << " " << counter(); }`,
    correctAnswer: "1 2 3",
    explanation: "Static local variables are initialized exactly once and persist across calls. c is NOT reset to 0 on each call — it retains its value.",
    keyInsight: "static local = 'function-scoped global'. Initialized once on first call, lives until program ends. C++11: thread-safe initialization guaranteed."
  },
  {
    id: 5, title: "Signed/Unsigned Comparison Trap",
    category: "Type System — Implicit Conversion",
    code: `unsigned int u = 0;
int i = -1;
if (i < u) cout << "i < u";
else        cout << "i >= u";`,
    correctAnswer: "i >= u",
    explanation: "Comparing signed and unsigned: signed value is implicitly converted to unsigned. -1 becomes UINT_MAX (4294967295). UINT_MAX < 0 is false → else branch runs.",
    keyInsight: "This is a famous C++ pitfall. Enable -Wsign-compare to catch it. Always explicitly cast: (int)u or (unsigned)i before comparison."
  },
  {
    id: 6, title: "sizeof Array vs Pointer",
    category: "Memory & Types",
    code: `int arr[10];
int* p = arr;
cout << sizeof(arr) << " " << sizeof(p) << " " << sizeof(*p);`,
    correctAnswer: "40 8 4  (64-bit: ptr=8bytes, int=4bytes)",
    explanation: "sizeof(arr)=10*4=40. sizeof(p)=pointer size=8 on 64-bit (NOT array size). sizeof(*p)=sizeof(int)=4.",
    keyInsight: "When array decays to pointer (e.g. passed to function), sizeof only gives pointer size. Always pass array size explicitly or use std::array."
  },
  {
    id: 7, title: "Missing virtual Destructor — UB on Delete",
    category: "OOP Safety",
    code: `struct Base   { ~Base()   {cout<<"~Base ";} };  // BUG: not virtual!
struct Derived: Base { ~Derived(){cout<<"~Derived ";} };
int main() { Base* b = new Derived(); delete b; }`,
    correctAnswer: "~Base  (Derived destructor NEVER called — UB / resource leak)",
    explanation: "delete via base pointer without virtual destructor → only ~Base() called. ~Derived() and any resources it owns are leaked. UB per C++ standard.",
    keyInsight: "Rule: If a class is designed to be deleted polymorphically, its destructor MUST be virtual. This is one of the most critical C++ interview points."
  },
  {
    id: 8, title: "Integer Division Before Cast",
    category: "Implicit Conversion",
    code: `double result = 7 / 2;
cout << result;`,
    correctAnswer: "3",
    explanation: "7 and 2 are int literals. 7/2 = 3 (integer division, truncates) BEFORE being stored in double. result = 3.0. Use 7.0/2 or (double)7/2 for 3.5.",
    keyInsight: "Division type is determined by operands, not the destination type. Both operands int → integer division → then widened to double."
  },
  {
    id: 9, title: "Reference is an Alias",
    category: "Value vs Reference Semantics",
    code: `int x = 10;
int& ref = x;
int  copy = x;
ref = 20; copy = 30;
cout << x << " " << ref << " " << copy;`,
    correctAnswer: "20 20 30",
    explanation: "ref is an alias for x — same memory location. Modifying ref modifies x. copy is independent — modifying copy has no effect on x.",
    keyInsight: "References cannot be reseated (always refer to the same object). This is different from a pointer. ref = 20 is NOT the same as ref = &something_else."
  },
  {
    id: 10, title: "Lambda Capture and Dangling Reference",
    category: "Lambda & Closures",
    code: `function<int()> make_adder(int x) {
    return [&]() { return x + 1; };  // BUG: captures x by ref!
}
int main() {
    auto f = make_adder(5);
    cout << f();  // x is destroyed — UB!
}`,
    correctAnswer: "UB — dangling reference to destroyed local variable",
    explanation: "[&] captures x by reference. When make_adder returns, x is destroyed (local var). Calling f() after that dereferences a dangling reference — UB.",
    keyInsight: "Never capture local variables by reference in lambdas that outlive the scope. Use [=] (capture by value) or init-capture [x=x] for safety."
  },
  {
    id: 11, title: "Signed / Unsigned Comparison",
    category: "Integer Conversions",
    code: `int      i = -1;
unsigned u =  1;
cout << (i < u);`,
    correctAnswer: "0 (false)",
    explanation: "In a comparison between int and unsigned, the int is converted to unsigned (usual arithmetic conversions). -1 becomes UINT_MAX (4294967295), which is NOT < 1, so the result is 0. The 'obvious' answer 1 is wrong.",
    keyInsight: "Mixing signed and unsigned in a comparison promotes BOTH to unsigned. This is the #1 source of silent loop bugs: `for (unsigned i = n-1; i >= 0; --i)` never terminates. Compile with -Wsign-compare."
  },
  {
    id: 12, title: "Signed Integer Overflow",
    category: "Undefined Behavior",
    code: `int x = INT_MAX;
cout << x + 1;`,
    correctAnswer: "Undefined Behavior (NOT guaranteed INT_MIN)",
    explanation: "Signed integer overflow is UB in C++, not defined wraparound. The compiler is free to assume it never happens — at -O2 it may even optimize `x + 1 > x` to always-true. Don't say 'it wraps to INT_MIN'; that's only true for UNSIGNED types.",
    keyInsight: "Unsigned overflow = well-defined modulo 2^N wraparound. Signed overflow = UB. Optimizers exploit signed-overflow-is-UB to assume loop induction variables never wrap — say 'UB' in interviews, not 'INT_MIN'."
  },
  {
    id: 13, title: "Moved-From std::string State",
    category: "Move Semantics",
    code: `string a = "hello";
string b = std::move(a);
cout << "[" << a << "] " << b;`,
    correctAnswer: "[] hello  (a is valid but unspecified — typically empty)",
    explanation: "After std::move, a is in a 'valid but unspecified' state. You may safely destroy or REASSIGN it, but its value is unspecified — in practice libstdc++/libc++ leave it empty, so you usually see []. Relying on it being empty is non-portable; relying on it being usable (assign/destroy) is correct.",
    keyInsight: "std::move is just a cast to rvalue reference — it moves nothing by itself; the move ctor does the work. A moved-from object is not destroyed, not garbage: it's valid-but-unspecified. Only call operations with no preconditions on it (assignment, clear, destruction)."
  },
  {
    id: 14, title: "Ternary Common Type Promotion",
    category: "Type Deduction",
    code: `cout << (true ? 'A' : 65);`,
    correctAnswer: "65",
    explanation: "The two arms of ?: must have a common type. 'A' is char (65) and 65 is int → the common type is int → the char arm is promoted to int → operator<< prints it as an INTEGER, not a character. So you get 65, not 'A'.",
    keyInsight: "?: computes a single common type for both branches regardless of which is taken. Mixing char and int (or different pointer types) silently promotes — the printed type can differ from what each branch 'looks like'."
  },
  {
    id: 15, title: "Floating-Point Equality",
    category: "Floating Point",
    code: `cout << (0.1 + 0.2 == 0.3);`,
    correctAnswer: "0 (false)",
    explanation: "0.1, 0.2, and 0.3 are not exactly representable in IEEE-754 binary. 0.1 + 0.2 == 0.30000000000000004, which is not bit-equal to the nearest double to 0.3. So == returns false.",
    keyInsight: "Never compare floats with ==. Use |a - b| < epsilon (absolute) or a relative tolerance. This is a guaranteed interview trap; mention IEEE-754 representability and an epsilon-based compare."
  },
  {
    id: 16, title: "Virtual Call Inside a Constructor",
    category: "OOP Lifecycle",
    code: `struct Base {
    Base() { print(); }                 // calls Base::print
    virtual void print() { cout << "Base "; }
};
struct Derived : Base {
    void print() override { cout << "Derived "; }
};
int main() { Derived d; d.print(); }`,
    correctAnswer: "Base Derived",
    explanation: "During Base's constructor the Derived part doesn't exist yet, so the vptr still points to Base's vtable → Base::print() runs (prints 'Base'). After construction completes, d.print() dispatches normally → Derived::print() (prints 'Derived').",
    keyInsight: "Virtual dispatch is disabled during construction/destruction — it resolves to the class currently being built. A pure-virtual call from a ctor/dtor is UB ('pure virtual method called'). Never rely on overrides inside ctors."
  },
  {
    id: 17, title: "Object Slicing on Pass-by-Value",
    category: "Polymorphism",
    code: `struct Base   { virtual int id() { return 1; } };
struct Derived: Base { int id() override { return 2; } };
void show(Base b) { cout << b.id(); }   // by value!
int main() { Derived d; show(d); }`,
    correctAnswer: "1",
    explanation: "show takes Base BY VALUE, so only the Base sub-object of d is copied (sliced). The parameter b is a genuine Base, its vptr is Base's, and b.id() returns 1 — polymorphism is lost.",
    keyInsight: "Passing/storing polymorphic types by value slices them. Always pass by Base& or Base* (or smart pointer). This compiles cleanly with no warning, which is what makes slicing dangerous."
  },
  {
    id: 18, title: "map::operator[] Inserts on Read",
    category: "STL Pitfalls",
    code: `map<int,int> m;
if (m[42] == 0) cout << "absent ";
cout << "size=" << m.size();`,
    correctAnswer: "absent size=1",
    explanation: "operator[] on a map DEFAULT-CONSTRUCTS the element if the key is missing (value-initialized int = 0). So m[42] inserts {42,0}, the condition is true, AND size becomes 1 — even though you only meant to read.",
    keyInsight: "operator[] is a mutating operation on map/unordered_map. To probe without inserting, use m.find(k) != m.end() or m.contains(k) (C++20). operator[] also can't be used on a const map for this reason."
  },
  {
    id: 19, title: "Dangling std::string_view",
    category: "Lifetime & Views",
    code: `std::string_view sv = std::string("temporary");
cout << sv;`,
    correctAnswer: "Undefined Behavior (dangling view)",
    explanation: "The temporary std::string is destroyed at the end of the full expression (the semicolon), but sv still points into its freed buffer. Printing sv reads freed memory — UB. It may print garbage, 'temporary', or crash depending on the build.",
    keyInsight: "string_view is a non-owning {ptr,len}. It must never outlive the buffer it views. Returning a string_view to a local string, or binding one to a temporary, is a classic dangling bug. Lifetime extension does NOT apply through a view."
  },
  {
    id: 20, title: "char Arithmetic Promotes to int",
    category: "Integer Promotions",
    code: `char c = 'A';
cout << c << " " << c + 1 << " " << char(c + 1);`,
    correctAnswer: "A 66 B",
    explanation: "c prints as 'A' (value 65). But c + 1 triggers integer promotion: char → int, so the result is int 66 and prints as the number 66, not the character. Casting back with char(c + 1) yields 'B' (66 is 'B').",
    keyInsight: "Any arithmetic on char/short first promotes the operand to int (integer promotion). The result type is int, so operator<< prints a number. Cast back to char to get the character. This is why `c + 1` and `++c` behave differently in cout."
  },
  {
    id: 21, title: "Vector Reallocation Invalidates References",
    category: "Iterator Invalidation",
    code: `vector<int> v = {10};
int& ref = v[0];
v.push_back(20);   // may reallocate
cout << ref;       // ref may dangle`,
    correctAnswer: "Undefined Behavior (ref may be dangling)",
    explanation: "push_back can trigger reallocation (size reaches capacity), moving all elements to a new buffer and freeing the old one. ref still points into the OLD freed buffer → UB. With initial capacity 1, the push_back here reallocates, so ref dangles.",
    keyInsight: "Any vector insertion that grows past capacity invalidates ALL iterators, pointers, and references into it. Take the index instead of a reference across mutations, or reserve() up front. erase invalidates everything from the erased point onward."
  },
  {
    id: 22, title: "Static Local Initialization Is Once and Thread-Safe",
    category: "Storage Duration",
    code: `int next() {
    static int n = (cout << "init ", 100);
    return ++n;
}
int main() { cout << next() << " " << next(); }`,
    correctAnswer: "init 101 102",
    explanation: "The static local's initializer runs exactly ONCE, on first entry to next() — so 'init' prints a single time. n persists across calls: 100→101 (printed), then 101→102 (printed). The comma operator evaluates the cout then yields 100.",
    keyInsight: "Function-local statics are initialized lazily on first reach, exactly once, and (since C++11) the initialization is thread-safe — the compiler emits a guard variable. This is the canonical Meyers' Singleton and the fix for the static-init-order fiasco."
  },
  {
    id: 23, title: "Unspecified Argument Evaluation Order",
    category: "Sequencing",
    code: `int i = 0;
auto f = [&]{ return i++; };
cout << f() << " " << f() << " " << f();`,
    correctAnswer: "Unspecified order — could print 0 1 2 or 2 1 0",
    explanation: "The order in which function arguments (here, the three f() calls feeding operator<<) are evaluated is UNSPECIFIED in C++. Each f() has a side effect on i, so the printed values depend on evaluation order, which the standard does not fix (and differs between GCC and Clang).",
    keyInsight: "Don't put side effects in multiple arguments of the same call. Note: this is 'unspecified' (one of a set of valid orders), distinct from the 'undefined behavior' you'd get from modifying the same scalar twice unsequenced like i++ + i++."
  },
  {
    id: 24, title: "std::vector<bool> Is Not a Container of bool",
    category: "STL Pitfalls",
    code: `std::vector<bool> v = {true, false, true};
auto& r = v[0];        // does this compile?
bool* p = &v[0];       // and this?`,
    correctAnswer: "Neither compiles — v[0] returns a proxy, not bool&",
    explanation: "std::vector<bool> is a space-optimized SPECIALIZATION that packs bits, so operator[] returns a proxy object (std::vector<bool>::reference), not a real bool&. You can't bind a bool& to it, and you can't take a bool* address of a bit. 'auto x = v[0]' also captures the PROXY, not a bool.",
    keyInsight: "vector<bool> breaks the container contract (no bool&, no &element). For real bool storage use std::vector<char>, std::deque<bool>, std::bitset, or std::array<bool>. A frequent interview 'gotcha' and a real-world API trap."
  },
  {
    id: 25, title: "Most Vexing Parse",
    category: "Parsing & Declarations",
    code: `struct Timer { Timer() {} };
struct Widget { Widget(Timer) {} };
Widget w(Timer());     // what is w?`,
    correctAnswer: "A FUNCTION declaration, not an object — 'w' is not a Widget",
    explanation: "C++ parses 'Widget w(Timer());' as the declaration of a FUNCTION named w that returns Widget and takes a (pointer to) function returning Timer — the 'most vexing parse'. Trying to use w as an object then fails to compile in surprising ways.",
    keyInsight: "When anything could be read as a declaration, C++ reads it as one. Fix with braces: 'Widget w{Timer{}};' (uniform initialization) or an extra paren: 'Widget w((Timer()));'. Brace-init also avoids narrowing — prefer {} for variable initialization."
  },
  {
    id: 26, title: "Integer Promotion Hides a Negative",
    category: "Integer Conversions",
    code: `std::vector<int> v;          // empty
for (int i = 0; i < v.size() - 1; ++i)
    cout << v[i];
cout << "done";`,
    correctAnswer: "Crash / huge loop — NOT 'done' immediately",
    explanation: "v.size() returns size_t (UNSIGNED). For an empty vector, v.size() - 1 is 0u - 1 = SIZE_MAX (a huge unsigned). The comparison promotes i to unsigned, so 0 < SIZE_MAX is true and the loop runs billions of times indexing out of bounds → UB/crash.",
    keyInsight: "Never write `size() - 1` in a loop condition on a possibly-empty container. Use `i + 1 < v.size()`, iterators, or a range-for. Unsigned underflow is the classic source of 'loop that should be empty runs forever'."
  },
  {
    id: 27, title: "Returning std::move Defeats NRVO",
    category: "Copy Elision",
    code: `std::vector<int> make() {
    std::vector<int> v(1000);
    return std::move(v);   // 'helpful' move?
}`,
    correctAnswer: "Slower — std::move here PREVENTS copy elision (NRVO)",
    explanation: "Returning a local by name lets the compiler do NRVO: construct v directly in the caller's return slot — ZERO copies or moves. Writing 'return std::move(v)' turns the expression into an xvalue the NRVO rule no longer applies to, forcing an actual move construction. You traded a free elision for a real move.",
    keyInsight: "Just `return v;`. The compiler elides (C++17 mandates elision for prvalues; NRVO for named locals is near-universal). Adding std::move on a return of a local is a pessimization — a very common 'looks optimized but isn't' mistake."
  },
  {
    id: 28, title: "Capturing 'this' vs the Member by Value",
    category: "Lambda & Closures",
    code: `struct Worker {
    int id = 7;
    auto task() { return [=]{ return id; }; }  // captures what?
};
// Worker freed, then the returned lambda is called`,
    correctAnswer: "Dangling — [=] captures 'this', not a copy of id",
    explanation: "Inside a member function, [=] does NOT copy the member id — it copies the 'this' POINTER and accesses id through it. Once the Worker is destroyed, the stored lambda dereferences a dangling this → UB. The capture looks by-value but is effectively by-reference to the object.",
    keyInsight: "To copy the member, capture it explicitly: [id]{...} or init-capture [id=id]{...}. In C++20, [=, this] is required to capture this explicitly and [=] implicitly capturing this is deprecated. Watch this whenever a lambda outlives its enclosing object."
  },
];

// ═══════════════════════════════════════════════════════════════════
//  NVIDIA COMPILER VERIFICATION — Interview Tips
// ═══════════════════════════════════════════════════════════════════
export const NVIDIA_TIPS = [
  {
    title: "🐛 Bug-Reading Framework (5-Step Process)",
    tips: [
      "STEP 1 — Understand intent: Read comments + function names. Form mental model of what code SHOULD do.",
      "STEP 2 — Check boundaries: Every loop → question condition (< vs <=). Every array → check index range. Every pointer → check NULL before deref.",
      "STEP 3 — Trace memory: Follow every malloc/new → is there a matching free/delete on ALL exit paths including early returns?",
      "STEP 4 — Check signatures: Are pointers passed by value when they should be by reference? Are outputs being written back to caller?",
      "STEP 5 — Look for type mismatches: = vs ==. Signed/unsigned comparison. Integer division before float cast. Wrong typecast."
    ]
  },
  {
    title: "🔴 Red Flag Patterns — Memorize All 10",
    tips: [
      "return local_arr; or return &local_var; → dangling pointer/reference",
      "for(i=0; i<=n; i++) arr[i] → off-by-one, arr[n] is OOB",
      "if(a = b) → assignment not comparison, always evaluates to b",
      "fn(Node* p) modifying p → doesn't affect caller, need Node*& or Node**",
      "malloc() ... if(err) return; → memory leak on error path",
      "push()/pop() with no capacity/underflow check → OOB UB",
      "~Base() not virtual + delete via Base* → ~Derived() never called, UB",
      "return (double)(a/b) → int division truncates BEFORE cast, use (double)a/b",
      "int* p = new int; ... <exception> ... delete p → leak if exception thrown",
      "unsigned u; int i = -1; if(i < u) → -1 becomes UINT_MAX, condition flips"
    ]
  },
  {
    title: "🎯 NVIDIA Round 1 — What You'll Actually Face",
    tips: [
      "Code Reading (HIGH): 100-300 lines C/C++. Understand in 5-10 mins, find bugs, fix them.",
      "Bug Types (HIGH): Dangling ptrs, off-by-one, null deref, memory leaks, value-vs-reference, type errors",
      "DSA Problem (HIGH): One medium LeetCode — linked list, tree, or graph (cycle detection, LCA, level order)",
      "C++ Output (HIGH): Snippet shown, predict output — virtual dispatch, ctors/dtors, static vars, increment",
      "Compiler Phases (MEDIUM 40%): Lexing, parsing, semantic analysis, IR, codegen, linking",
      "Memory Model (MEDIUM): Stack vs heap, virtual destructor, object layout with vtable"
    ]
  },
  {
    title: "📢 Talk Out Loud — Narration Strategy",
    tips: [
      "Reading code: 'This function takes an int array and seems to compute... I see a loop from 0 to n...'",
      "Bug spotted: 'Wait — this uses i <= n but valid indices are 0 to n-1. That's an off-by-one, arr[n] is OOB.'",
      "Before fix: 'To fix this I'd change ≤ to <... and I'd also add a null check here...'",
      "Edge cases: 'I'd also check what happens if the array is null, or n = 0.'",
      "Interviewer WILL hint if you're on the right track — talking enables this guidance."
    ]
  },
  {
    title: "💡 Compiler Compilation Phases — Quick Reference",
    tips: [
      "1. Lexer: Source text → tokens (keywords, identifiers, literals, operators)",
      "2. Parser: Tokens → AST (Abstract Syntax Tree) — validates grammar",
      "3. Semantic Analysis: AST → type checking, scoping, symbol table",
      "4. IR Generation: AST → Intermediate Representation (e.g., LLVM IR)",
      "5. Optimization: IR → optimized IR (DCE, inlining, loop hoisting, LICM)",
      "6. Code Generation: IR → target machine code / assembly",
      "7. Linking: Object files + libraries → final executable",
      "UB from compiler perspective: Compilers assume UB never occurs → can eliminate 'impossible' branches as dead code."
    ]
  },
  {
    title: "⚡ The Night-Before Checklist",
    tips: [
      "Dangling pointer: return addr of local, or use-after-free → always segfault",
      "Double free: delete same pointer twice → heap corruption → use nullptr after delete",
      "Memory leak: malloc/new with no matching free/delete on all paths",
      "NULL dereference: *p without checking p != nullptr — segfault",
      "Off-by-one: i <= n should be i < n for 0-indexed arrays",
      "Integer overflow: INT_MAX + 1 = UB (signed) — cast to long long EARLY",
      "Signed/unsigned compare: -1 vs 0u → -1 becomes UINT_MAX → wrong result",
      "Virtual destructor: forget virtual → base dtor only → resource leak UB",
      "Array decay: sizeof passes pointer size, not array size — always pass n separately",
      "Value vs reference: fn(T* p) vs fn(T*& p) — know the difference cold"
    ]
  }
];


// ═══════════════════════════════════════════════════════════════════
//  Neutral aliases (Sep 2026). The four collections below were named for
//  one company's interview loop; the material is generic code-reading and
//  C++ semantics practice, so the UI uses these names instead.
// ═══════════════════════════════════════════════════════════════════
export const BUG_HUNTS = NVIDIA_BUG_HUNT;
export const OUTPUT_QUIZZES = NVIDIA_OUTPUT_QUIZ;
export const EXTRA_PROBLEMS = NVIDIA_PROBLEMS;
export const INTERVIEW_TIPS = NVIDIA_TIPS;
/* One bank. EXTRA_PROBLEMS fills ids 77-81, which the main list skips. */
export const ALL_PROBLEMS = [...PROBLEMS, ...NVIDIA_PROBLEMS].sort((a, b) => a.id - b.id);
