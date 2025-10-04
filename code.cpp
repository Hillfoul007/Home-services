#include <bits/stdc++.h>
using namespace std;

// DP[i][k]: minimum sum of max efforts for first i buildings with k workers
int main() {
    int N, K;
    cin >> N;
    vector<int> effort(N);
    for (int i = 0; i < N; ++i) cin >> effort[i];
    cin >> K;

    // If K == N, answer is sum of all efforts
    if (K == N) {
        int ans = accumulate(effort.begin(), effort.end(), 0);
        cout << ans << endl;
        return 0;
    }

    // If K == 1, answer is max of all efforts
    if (K == 1) {
        int ans = *max_element(effort.begin(), effort.end());
        cout << ans << endl;
        return 0;
    }

    // DP approach: O(N*K)
    vector<vector<int>> dp(K+1, vector<int>(N+1, INT_MAX));
    dp[0][0] = 0;

    for (int k = 1; k <= K; ++k) {
        for (int i = k; i <= N; ++i) {
            int mx = 0;
            // Try all possible previous splits
            for (int j = i; j >= k; --j) {
                mx = max(mx, effort[j-1]);
                if (dp[k-1][j-1] != INT_MAX)
                    dp[k][i] = min(dp[k][i], dp[k-1][j-1] + mx);
            }
        }
    }

    cout << dp[K][N] << endl;
    return 0;
}
