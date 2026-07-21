# 07 — Duplicate and concurrency proof

Exact ordered identity: `userId + sideASourceSpanId + sideBSourceSpanId`

| Case | Result |
| --- | --- |
| Same ordered pair, second invocation | `reused`, `writeExecuted: false`, one node |
| Reversed A/B | Second distinct ordered identity; second node allowed |
| Concurrent race | One created + one reused; single node remains |
| Transaction failure mid-write | Spans + node rolled back |

No reverse-side equivalence.
