# 14 — Controlling result for Kay

## READY FOR INTELLIGENCE REPAIR WAVES — READ-ONLY AUDIT COMPLETE

**Branch:** `desktop-intelligence-compatibility-audit-001` @ `58e4d01365f3be465e1c55a732c344e31785a486` (= staging baseline)
**Production readiness:** NO
**Kay account mutated:** NO

---

## Current genuine object counts (read-only truth)

| Object | Count |
|--------|------:|
| Imported conversations | 640 |
| Imported messages | 18,582 |
| Evidence spans (imported) | 5,922 |
| Pending import candidates | **53** (RI 28 + CN 25) |
| ReferenceItem active (chicken-burger) | **1** |
| ContradictionNode open | 0 |
| PatternClaims | **7** (all active) |
| UserMapConclusions | **1** |
| ModelUpdates | **1** |
| ProfileArtifacts | 203 (all candidate; Map-orphaned) |
| SurfacedActions | 7 |
| Investigations | 0 |
| FieldworkAssignments | 1 |
| CanonicalTodayComposition | 1 (`full_reference_round_trip_seed`) |
| Seed movement report | 1 |

Gate `matchesExpected: true` — pending 53 / RI 28 / CN 25 / chicken active / patterns 7 / MU still 1.

---

## Conceptual family summary

Intelligence concepts split across **first-class stores** (ReferenceItem, ContradictionNode, PatternClaim, UserMapConclusion, ModelUpdate), **proxies** (SurfacedAction “decisions”, Investigation questions, multi-home “goals”), **legacy orphans** (ProfileArtifact), and **presentation/seed densograph**. Many human concepts (strengths, working style, dedicated relationships) are **unsupported**. Do not treat name similarity as duplication without contract trace — see `02` and `12`.

---

## Old MindLabs status

**Still active** on archive import + journal/explore message paths (extraction, contradictions, pattern batch, profile derivation writes).
**Orvek reads** PatternClaim / ReferenceItem / ContradictionNode / UM via hybrid adapters.
**Orphaned for Orvek Map:** ProfileArtifact (203).
**Shadow-only:** pattern LLM labeling.
Translation is **adapters**, not a second store.

---

## Profile and Goals status

**Profile:** thin genuine layer (1 preference fact + 7 patterns in mind-context) under seed/static section summaries; accepted facts do not rewrite summaries; active RIs **do** enter chat memory.
**Goals:** fragmented (17 RI goal candidates + 28 ProfileArtifact GOAL + 0 Map model-goal UM areas); visible Map goal cards under composition are **seeded**.

---

## Top synthetic masks on live/root

1. **`full_reference_round_trip_seed` composition** — replaces Today + Map/Timeline/Decisions/Explore rails
2. **Seed Map header / modelStatusCard** (243/7 style badges)
3. **Seed weekly Model Movement report** (`dev-exact-rt-…-report-weekly`)
4. Static profile section default summaries when shells created for facts

**Exception:** Import review is **live** (overrides seed candidates).

---

## Compatibility classification totals

| Status | n |
|--------|--:|
| FULLY_CONNECTED | 1 |
| PARTIALLY_CONNECTED | 8 |
| STORED_NOT_SURFACED | 0 |
| SURFACED_THROUGH_SYNTHETIC_FALLBACK | 5 |
| MISSING_WRITE_PATH | 3 |
| MISSING_READ_PATH | 1 |
| LEGACY_ORPHANED | 2 |
| DUPLICATED_OR_CONFLICTING | 2 |
| FIXTURE_ONLY | 1 |
| UNKNOWN_NEEDS_PROOF | 1 |

(Only Import review is fully connected end-to-end. Conflict = MISSING_READ_PATH — see receipt 15.)

---

## Ordered repair waves

0. Unmask readiness (**this audit**)
1.R Residual translation (goals / ProfileArtifact / RI MU schema — deferred, non-blocking)
1.1 **ContradictionNode → Map Active-conflicts live projection (**NEXT**)**
2. Distinct genuine-object proofs (starts with Wave 2.1 CN accept **after** 1.1)
3. Surface-by-surface cutovers (Map → Timeline → Decisions → Explore → Today → Reports)
4. Extraction quality
5. Controlled natural-entry
6. Final mock removal
7. ChatGPT uploader
8. Dead-button completion
9. Security / production-readiness

Clarification: `15-wave-sequencing-clarification.md` — prior WAVE 2.1 recommendation was **premature** (Map does not consume open ContradictionNodes yet).

---

## Exact recommended next implementation campaign

**WAVE 1.1 — ContradictionNode → canonical Map Active-conflicts live projection**

**Why:** Accept→open+UEL+MU write path exists; Map Active conflicts rail does not project ContradictionNode (it uses disputed UserMapConclusion). Seed composition can also mask Map. Wave 2.1 Map-conflict proof is invalid until 1.1 PASSes.

**Then:** WAVE 2.1 single genuine CN accept proof (safety contract in receipt 15).

---

## Changed files (this audit only)

All under `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/`:

- `00`–`15` markdown receipts (clarification updates to `13`/`14`)
- `readonly-intelligence-inventory.mjs` + `.json`
- `intelligence-compatibility-matrix.json`
- `surface-mock-mask-register.json`
- `repair-wave-sequence.json`

**No product code, schema, or migrations changed.**

---

## Verification commands

```bash
git rev-parse --abbrev-ref HEAD   # desktop-intelligence-compatibility-audit-001
git rev-parse HEAD               # 58e4d01…

set -a && source .env && set +a
node docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/readonly-intelligence-inventory.mjs

# write-method search on audit scripts
rg -n "\\.(create|update|upsert|delete|createMany|updateMany|deleteMany|\\$executeRaw|\\$executeRawUnsafe)\\(" \
  docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/*.mjs

git diff --check
git status --short
git diff --stat
```

---

## Explicit non-mutation confirmation

- No accept/reject
- No create/update/delete of model objects
- Selected chicken-burger RI remains `active`
- Pending remains 53 / 28 / 25
- PatternClaims remain 7
- ModelUpdates remain 1
- Inventory script: SELECT/count/groupBy/find only + `writeFileSync` of receipts

**Do not commit or push from this campaign.**
