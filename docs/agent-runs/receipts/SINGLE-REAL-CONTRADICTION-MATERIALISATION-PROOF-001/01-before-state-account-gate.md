# 01 — Before-state account gate

**Script:** `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.mjs`
**Run timestamp:** `2026-07-20T08:32:48.958Z` (first successful live run this session)
**User:** `user_34TUYA53pI1QRLK73O22Kve1a1G`
**Mode:** read-only (`mutationsPerformed: false`)

---

## Gate table

| Check | Expected | Observed | Match |
|-------|----------|----------|-------|
| Pending total | 53 | **53** | ✓ |
| ReferenceItem pending (import) | 28 | **28** | ✓ |
| ContradictionNode pending (import) | 25 | **25** | ✓ |
| Open genuine ContradictionNodes | 0 | **0** (all 25 `candidate`) | ✓ |
| Chicken-burger ReferenceItem active | 1 | **1** | ✓ |
| Selected RI status | `active` | **`active`** (`3a6163dd-0f85-4bf5-8eb8-924579f1db62`) | ✓ |
| PatternClaims | 7 | **7** | ✓ |
| ModelUpdates | 1 | **1** (`cmq6h8ewn0000qlbwlg485jx1`) | ✓ |
| UnderstandingEvidenceLinks | 50 | **50** | ✓ |
| UserMapConclusions | unchanged | **1** | ✓ |
| `matchesExpected` | true | **true** | ✓ |

---

## Selected ReferenceItem (chicken-burger)

| Field | Value |
|-------|-------|
| id | `3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| type | `preference` |
| status | `active` |
| confidence | `low` |
| statement preview | I think prefer chicken burgers to beef burgers 😳 |
| sourceSessionId | `7dd386eb-e6ba-493a-856d-fc8815895248` |
| sourceMessageId | `d1060934-f19d-4693-b255-d23570af50e1` |
| updatedAt | `2026-07-19T14:14:39.275Z` |

---

## Composition seed

| Field | Value |
|-------|-------|
| id | `dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-today-composition` |
| source | **`full_reference_round_trip_seed`** |
| seedLikely | true |

Seed Import overlay candidates (4) remain in composition JSON; production Import path uses live DB query and does not surface seed ids.

---

## ContradictionNode summary

| Metric | Value |
|--------|-------|
| Total | 25 |
| By status | `candidate`: 25 |
| By type | `goal_behavior_gap`: 22 · `constraint_conflict`: 3 |
| ContradictionEvidence rows (account) | 28 |
| From IMPORTED_ARCHIVE | 25 |

---

## Existing ModelUpdate

| Field | Value |
|-------|-------|
| id | `cmq6h8ewn0000qlbwlg485jx1` |
| updateType | (UM for UserMapConclusion publish) |
| affectedObjectType | `usermap_conclusion` |
| affectedObjectId | `cmq6frqdx0000ql8h6nkavzue` |
| summary preview | New conclusion: Trigger-response pattern (social appeasement)… |

No ModelUpdate targets any pending ContradictionNode id.

---

## Non-mutation confirmation

- Inventory script uses count/findMany/groupBy/read-only `$queryRaw` SELECT only.
- No call to `POST /api/import-review/candidates/[key]/decide`.
- No Prisma write methods invoked by campaign scripts.
