# 04 — Genuine record counts and provenance

**User:** `user_34TUYA53pI1QRLK73O22Kve1a1G`
**QueriedAt:** `2026-07-19T19:15:31.317Z` (see `readonly-intelligence-inventory.json`)
**Mutations:** none (`mutationsPerformed: false`)
**Gate match:** `matchesExpected: true`

---

## Non-mutation gate (preserved)

| Check | Value |
|-------|------:|
| Pending total (import-linked RI+CN candidates) | **53** |
| ReferenceItem pending | **28** |
| ContradictionNode pending | **25** |
| Chicken-burger active RI | **1** (`3a6163dd-0f85-4bf5-8eb8-924579f1db62`) |
| PatternClaims | **7** |
| ModelUpdates | **1** (unchanged; no new MU from this audit) |

---

## Provenance rules

| Bucket | Proof |
|--------|-------|
| Genuine import-derived | `Session.origin=IMPORTED_ARCHIVE` + upload `cmp2ftxhj0000qlsyxi55jo20`; objects with sourceSession origin import |
| Native APP | `Session.origin=APP` |
| Synthetic seed | `CanonicalTodayComposition.source=full_reference_round_trip_seed`; ids `dev-exact-rt-*`; seed report row |
| Unknown | No strong lineage — declared when applicable |

Titles alone never classify genuineness.

---

## Counts by model

| Model / metric | Genuine import | Native | Seed table/JSON | Notes |
|----------------|---------------:|-------:|----------------:|-------|
| Imported conversations | **640** | 0 | — | all with externalId+importedAt |
| Imported messages | **18,582** | — | — | |
| APP sessions / messages | — | **3 / 44** | — | |
| EvidenceSpan | **5,922** | **19** | 0 as rows | densograph “receipts” are JSON |
| DerivationRun import completed | **635** | native 22; manual 20 | — | 0 import failed |
| ReferenceItem | **29** (28 cand + 1 active) | 0 | 0 seed-prefixed rows | all import-session linked |
| ContradictionNode | **25** (all candidate) | 0 | 0 | |
| PatternClaim | **7** active | 0 | 0 | evidence citing import: 33 |
| ProfileArtifact | **203** all candidate | — | — | orphaned for Orvek Map |
| UserMapConclusion | **1** promoted, import-linked via UEL | — | 0 | area=operating_logic |
| ModelUpdate | **1** user_visible conclusion_added | — | 0 seed-prefixed | |
| Investigation | **0** | 0 | densograph only | |
| FieldworkAssignment | **1** (“Wind down…”) | not import-proven | densograph | |
| SurfacedAction | **7** | lineage weak | densograph | 0 linkedGoalRefId |
| UnderstandingEvidenceLink | **50** → one UM | — | — | includes 6 import_record |
| CanonicalTodayComposition | — | — | **1** full_reference_round_trip_seed | **masks rails** |
| CanonicalModelMovementReport | — | — | **1** seed weekly | |
| JournalEntry | see inventory | | | |
| Import upload sessions | **1** complete | | | |

### ReferenceItem by type×status

| | candidate | active |
|--|----------:|-------:|
| goal | 17 | 0 |
| preference | 7 | 1 |
| constraint | 4 | 0 |

### ContradictionNode by type

| Type | Count |
|------|------:|
| goal_behavior_gap | 22 |
| constraint_conflict | 3 |

### PatternClaim by type

| Type | Count |
|------|------:|
| repetitive_loop | 3 |
| trigger_condition | 2 |
| inner_critic | 1 |
| recovery_stabilizer | 1 |

---

## Import coverage funnel

| Stage | Count |
|-------|------:|
| Imported sessions | 640 |
| Sessions with EvidenceSpans | 622 |
| Sessions with ReferenceItems | 28 |
| Sessions with ContradictionNodes | 14 |
| Approx unprocessed (no span/ref/contra) | 18 |
| Pending review candidates | 53 |
| Accepted RI (human) | 1 |
| Accepted CN | 0 |

---

## Goals proxy reality

| Proxy | Count | Status |
|-------|------:|--------|
| ReferenceItem goals | 17 | all candidate |
| ProfileArtifact GOAL | 28 | all candidate |
| UserMap “model goal” areas | **0** | UM is operating_logic only |
| SurfacedActions with linkedGoalRefId | **0** | |

---

## Separation summary

- **Genuine intelligence inventory is thin at the accepted layer** (1 RI, 7 patterns, 1 UM, 1 MU) and **thick at candidate/extraction layers**.
- **Synthetic full-reference composition is present** and can replace workbench rails on root.
- **Import review live path overrides** composition import candidates (seed ic* not shown when live pending exist).
