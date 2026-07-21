# 02 — Current legacy / repaired persistence audit

| Concern | Current contract | Repaired persistence requirement | Decision |
| ------- | ---------------- | -------------------------------- | -------- |
| Upstream lineage values | CEQR-005 `DualSideLineageSuccess` with descriptors, quotes, offsets, hashes, user/session; `persistable:false` | Consume success + continuation/readiness flags without mutation | Accept full lineage result; require `ok`, `lineageReadyForPersistenceGate`, `continuationReady`, validated lineage |
| Upstream confidence values | CEQR-006 success with `recommendedStorageConfidence`, floor flags; `persistable:false` | Require floor + continuation; use recommended storage band | Accept full confidence result; block when `meetsCandidateFloor`/`continuationReady` false |
| Title | Legacy detector invents title; semantic adjudicator has no title | Schema requires nonblank title | Deterministic presentation label from normalized propositions (not eligibility) |
| Side A / Side B text | Legacy detector strings; semantic has `normalizedProposition` | Must not accept arbitrary caller text as authority | Derive only from selected-pair adjudication `normalizedProposition` |
| ContradictionType | Legacy detector enum; same-session Side A is goal/constraint | Schema requires enum | Derive after eligibility: `goal`→`goal_behavior_gap`, `constraint`→`constraint_conflict`; else fail closed |
| Plan shape | None | Pure authorised plan for writer | `buildContradictionPersistencePlan` deep-freezes + WeakSet-registers plan |
| Message revalidation | Lineage validated at build time against resolved messages | Writer must re-resolve before write | Re-resolve both messages in transaction; verify ownership, session, exact slice, hash |
| `ensureEvidenceSpan` | Idempotent unique identity; **no** ownership check | Reuse identity; verify ownership/complete descriptor | Writer-local ensure/reuse with full descriptor + ownership verification |
| `ContradictionEvidence` | Legacy singular evidence rows via materialiser | Dual span FKs are repaired authority | **Leave untouched** in this slice — no evidence rows created |
| Singular `sourceSessionId` / `sourceMessageId` | Legacy Side-B-anchored metadata | Must not imply single-side grounding | Shared session + `sourceMessageId: null`; dual span FKs are authority; optional `sideBTriggerMessageId` metadata only |
| Transaction interface | Injectable materialisation DB pattern | Injectable; not Prisma-only | New `ContradictionRepairedPersistenceDb`; **no** default to prismadb |
| Persistence result for CEQR-007 | None | Inspectable IDs + explicit non-claim of dedup | Return node ID + both span IDs + create/reuse outcomes + `contradictionDeduplicationProven: false` |
| Legacy materialiser | `DetectedContradiction` + singular evidence | Must not silently route repaired path | **Separate** repaired writer; legacy code retained, not broadened |
| CEQR-007 boundary | Not started | No user-wide fuzzy collision / title similarity dedup | Span ensure may be idempotent; one invocation → at most one node; repeat invocations may still need CEQR-007 |

## Audit answers (summary)

1. **Available upstream values:** selected-pair adjudication (propositions, claims, referee), CEQR-005 lineage (user/session/spans), CEQR-006 confidence recommendation/floor.
2. **Authoritative vs invented:** selected pair + lineage + confidence are authoritative when bound together. Title is deterministic presentation only. Type is derived from supported Side A `sourceType` after eligibility — never caller-supplied, never default `belief_conflict`.
3. **Writer input:** pure validated persistence plan minted only by the plan gate and registered in module WeakSet.
4. **Re-resolve messages:** yes — ownership, session, exact offsets/slice, content hash inside the transaction.
5. **Span ensure reuse:** identity contract reusable; ownership verification required and implemented in the writer.
6. **ContradictionEvidence:** remain untouched (legacy compatibility data, not repaired dual-side lineage).
7. **Singular source fields:** `sourceSessionId` = shared session; `sourceMessageId` = null; dual span FKs remain authority.
8. **Transaction interface:** reusable pattern; new injected interface without prismadb default.
9. **Result for CEQR-007:** node + span IDs + outcomes; dedup explicitly unproven.
10. **Left for CEQR-007:** contradiction-level duplicate prevention / idempotency across invocations.
