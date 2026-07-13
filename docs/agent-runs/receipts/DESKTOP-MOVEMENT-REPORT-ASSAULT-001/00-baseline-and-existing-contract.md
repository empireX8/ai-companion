# Checkpoint 0 — Baseline and Existing Contract

**Branch:** `desktop-movement-report-assault-001`
**Baseline:** `bb00df1` (staging — PR #129 Inspector assault merge)
**Worktree:** isolated
**Result:** **PASS**

---

## Git baseline

| Check | Result |
|---|---|
| `HEAD` | `bb00df18775dc846f8c94bf08c46b2a78b13cffa` |
| Matches `bb00df1` | **YES** |
| Clean tree at start | **YES** |
| Commits made | **NONE** |

---

## Existing storage inventory

| Capability | Storage | Notes |
|---|---|---|
| Movement row | `ModelUpdate` | Append-only; `beforeSummary` / `afterSummary` nullable |
| Evidence links | `UnderstandingEvidenceLink` | Required for publish; target `model_update` |
| Movement copy | `ModelUpdate.userFacingSummary` | Public list surfaces |
| Movement rationale | `ModelUpdate.internalNotes` prefix `movementRationale::` | **No new schema** — encoded in assault slice |
| Full report identity | `ModelUpdate.id` | `/api/what-changed/[id]` + `RealityTrackingModelMovementReport` |
| Reference zip reports | `orvek-data` (`rep-weekly`, etc.) | Guarded; not used when live depth missing |

**Schema/migration:** **NONE** — existing fields sufficient.

---

## Existing read/write paths (pre-assault gaps)

| Path | Pre-assault state | Code-only vs storage |
|---|---|---|
| Publish candidate | Visibility flip only; no after snapshot | Code |
| Conclusion publish | ModelUpdate without before/after | Code |
| `/api/today/intelligence-updates` | Summary-only (correct) | Code |
| `/api/timeline/model-layers` | Summary-only (correct) | Code |
| `/api/what-changed/[id]` | Full report when row exists | Storage + code |
| Today production API | Objects without before/after | Code |
| Timeline adapter | `afterSummary = userFacingSummary` (incorrect) | Code |
| Today report slot | Hard-coded `rep-weekly` | Code |

---

## Pre-existing Vitest failures (reproduced on assault branch)

**7 failed / 3720 passed** (3727 total after new tests)

| File | Nature |
|---|---|
| `evidence-pointer-surfacing-rationale-schema.test.ts` (2) | Prisma client / migration contract |
| `surfaced-evidence-pointer-schema.test.ts` (2) | Prisma client / migration contract |
| `explore-composer-wireup.test.ts` (1) | Explore chat wiring |
| `free-explore-chat-hybrid-fetch.test.ts` (1) | Explore hybrid fetch |

All seven reproduce on clean `bb00df1` baseline (not introduced by this assault).

---

## Checkpoint verdict

**PASS** — baseline confirmed; contract inventory complete; failures classified as pre-existing.
