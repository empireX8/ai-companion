# 05 — Old MindLabs intelligence trace

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Verdict:** Old MindLabs write machinery is **largely still alive** on archive import + journal/explore message paths. Orvek shell **reads a subset** via adapters; ProfileArtifact and LLM shadow labeling are **orphaned for product**.

---

## Subsystem status table

| Subsystem | Still called? | By | Writes | Orvek reads? | Status |
|-----------|---------------|-----|--------|--------------|--------|
| Pattern-family definitions (`PATTERN_FAMILY_SECTIONS`) | Yes | detectors / Map | constants | via PatternClaim | **Active** |
| Rule extraction (`profile-derivation`, detectors, behavioral-filter) | Yes | import + message | ProfileArtifact, spans, PatternClaim | PatternClaim yes; ProfileArtifact **no** on Map | **Partial** |
| LLM pattern labeling LF | Yes (shadow) | eval | derivation artifacts only | No product | **Orphaned-from-product** |
| Candidate builders (import refs + dark-engine) | Yes | import; gated bridges | RI/CN candidates; internal UM/MU | Import overlay; published UM | **Active / partial** |
| Pattern generation (v1 batch) | Yes | onImportComplete; native trigger | PatternClaim (+evidence) often active | Map patterns | **Active** |
| Evidence linking (spans, PCE, UEL, pointers) | Yes | import/message/publish | multi | Inspector / depth | **Active** |
| Contradiction logic | Yes | import; message after(); APIs | ContradictionNode | Map after accept/`open` | **Active** |
| Import processors | Yes (API) | upload finalize queue | full import stack | Timeline + Import review | **Active backend; legacy upload UI** |
| Old profile model-building | Yes writes | import/message | ProfileArtifact (203 candidates Kay) | Orvek Map **does not** | **Orphaned for Orvek Map** |
| Live-entry interpretation | Yes | journal_chat / explore_chat | same as message after() | Explore + Map after publish | **Active on chat; not Capture overlay** |

---

## Concrete genuine traces (Kay)

### Trace A — Import → PatternClaim (active, auto)

1. Upload `cmp2ftxhj0000qlsyxi55jo20` → 640 sessions / 18,582 messages
2. `onImportComplete` → pattern batch `sourceRunId=7fa7862d-…`
3. Seven PatternClaims created `2026-05-12`, status `active`
4. PatternClaimEvidence cites imported sessions (33)
5. Map patterns rail **can** read these — **unless** composition workbench replaces rails

### Trace B — Import → ReferenceItem candidate → human accept → Map fact

1. Extracted RI `3a6163dd-…` preference from imported session
2. Human accept (prior campaign) → `active`
3. `map-profile-facts` attaches to Preferences / interests
4. Proven on canonical `/your-map` in prior proof
5. **No ModelUpdate** created for this accept

### Trace C — Import → ContradictionNode stuck candidate

1. 25 CN created during import (22 goal_behavior_gap, 3 constraint_conflict)
2. Still `candidate` — not on Map as open conflicts until accept
3. Accept path would open + UEL + ModelUpdate `link_detected` (code; bulk real-account accepts not done this audit)

### Trace D — ProfileArtifact orphan

1. 203 ProfileArtifacts all `candidate` (BELIEF 84, IDENTITY 41, HABIT 34, GOAL 28, …)
2. Written by `processMessageForProfile` during import
3. Orvek Map profile layer ignores them

### Trace E — Dark-engine / UM

1. One UserMapConclusion `cmq6frqdx…` promoted, area operating_logic, 50 UELs including import_record
2. One ModelUpdate `conclusion_added` user_visible
3. Title/summary largely restate a PatternClaim — shallow translation, not deep new synthesis

---

## Translation layer

There is **no wholesale rewrite** of MindLabs objects into a new Orvek store. Translation is **hybrid read adapters**:

- `useOrvekHybridWorkbenchDataApi` / `hybrid-workbench-api.ts`
- `lib/orvek-v0/production/*-api.ts` + `lib/orvek-adapters/*`
- `lib/map-profile-facts.ts`

---

## Duplication old vs new

| Old | New | Overlap |
|-----|-----|---------|
| ProfileArtifact | ReferenceItem + UserMapConclusion | Parallel claims; Map uses RI/UM only |
| Pattern detectors | PatternClaim | Active path |
| ContradictionNode | Investigation seed contradiction | CN is primary conflict object |
| WeeklyAudit | CanonicalModelMovementReport | Seed report currently masks |
