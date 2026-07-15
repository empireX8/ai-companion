# 06 — Authentication, ownership, and negative proof

## Status

**PASS** (Playwright test 4)

| Case | Exact status |
|---|---|
| Unauthenticated grounding GET | `404` |
| Unauthenticated publish POST | `404` |
| Authed user → cross-user session list | `404` |
| Cross-user cookie → owner session list | `404` |
| Cross-user publish | `404` |
| Missing conversation | `404` |
| Missing message | `404` |
| Missing proposal publish | `404` |
| Malformed publication payload | `400` |
| Malformed list (no sessionId) | `400` |
| Malformed grounding request | `400` |

Failed publication remains absent after reload (rejection path + negatives).
