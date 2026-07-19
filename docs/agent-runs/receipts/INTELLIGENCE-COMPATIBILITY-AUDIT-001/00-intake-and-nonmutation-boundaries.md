# 00 — Intake and non-mutation boundaries

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Repository:** `/Users/user/ai-companion-worktrees/desktop-intelligence-compatibility-audit-001`
**Branch:** `desktop-intelligence-compatibility-audit-001`
**HEAD / baseline:** `58e4d01365f3be465e1c55a732c344e31785a486` (= `staging` @ `58e4d01`)
**Mode:** read-only audit only
**Production readiness:** NO

---

## Purpose

Produce the controlling map for the remaining data-replacement programme: how every important intelligence concept travels through Understanding → Model/Storage → Product Experience, where pathways break, and where synthetic data masks the truth.

This audit is the **implementation plan authority**. It does not implement repairs.

---

## Non-negotiable boundaries (enforced)

| Forbidden | Status |
|-----------|--------|
| Commit / push / PR / merge | Forbidden |
| Product code changes | Forbidden |
| Schema / migrations | Forbidden |
| Mutate Kay’s database | Forbidden |
| Accept / reject candidates | Forbidden |
| Create / update / delete model objects | Forbidden |
| Clean synthetic reference data | Forbidden |
| Build ChatGPT uploader | Forbidden |
| Repair dead buttons | Forbidden |
| Start an implementation campaign inside this audit | Forbidden |
| Infer pathway works from table/helper existence alone | Forbidden |
| Treat provider result as human-visible without mounted canonical render | Forbidden |
| Analyse only quarantined `orvek-v0` when route mounts `orvek-v0-canonical` | Forbidden |
| Collapse human concepts, DB models, and UI sections into one category | Forbidden |

| Allowed | Status |
|---------|--------|
| Read-only scripts and receipts under `docs/agent-runs/receipts/INTELLIGENCE-COMPATIBILITY-AUDIT-001/` | Allowed |
| Focused existing tests for traced contracts | Allowed (tests ≠ runtime proof) |

---

## Account state to preserve (query, do not assume)

Kay user id: `user_34TUYA53pI1QRLK73O22Kve1a1G`

Expected gate (from prior SINGLE-REAL-IMPORT proof + this campaign):

| Check | Expected |
|-------|----------|
| Pending import candidates total | 53 |
| ReferenceItem pending (import-linked) | 28 |
| ContradictionNode pending (import-linked) | 25 |
| Selected chicken-burger ReferenceItem | active (`3a6163dd-0f85-4bf5-8eb8-924579f1db62`) |
| PatternClaims | 7 |
| No new ModelUpdate from this audit | unchanged |
| No candidate status change | unchanged |

Live smoke at intake confirmed: pending 53 (28+25), chicken active 1, patterns 7, imported sessions 640, imported messages 18,582.

---

## Three-layer model (required lens)

1. **Understanding** — analysis, extraction, classification, inference
2. **Model and storage** — Prisma / JSON / enum representations
3. **Product experience** — actual mounted canonical runtime surfaces

---

## Workstreams → receipts

| WS | Receipt |
|----|---------|
| Architecture | `01-three-layer-architecture-map.md` |
| Ontology | `02-conceptual-intelligence-ontology.md` |
| Schema | `03-prisma-and-storage-object-inventory.md` |
| Genuine counts | `04-genuine-record-counts-and-provenance.md` |
| Old MindLabs | `05-old-mindlabs-intelligence-trace.md` |
| Import write | `06-imported-history-write-path.md` |
| Live write | `07-current-live-entry-paths.md` |
| Provider→surface | `08-provider-to-actual-runtime-surface-matrix.md` |
| Profile/Goals | `09-profile-and-goals-special-audit.md` |
| Mock register | `10-mock-and-fallback-mask-register.md` |
| Quality sample | `11-quality-and-coverage-sample.md` |
| Classification | `12-compatibility-classification-matrix.md` |
| Repair waves | `13-repair-wave-sequence.md` |
| Controlling result | `14-controlling-result-for-kay.md` |

Artifacts: `readonly-intelligence-inventory.{mjs,json}`, `intelligence-compatibility-matrix.json`, `surface-mock-mask-register.json`, `repair-wave-sequence.json`.

---

## Prior receipts consulted (not re-run as mutations)

- `CHATGPT-IMPORT-MATERIALISATION-AUDIT-001`
- `DB-BACKED-IMPORT-CANDIDATE-MATERIALISATION-001`
- `SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001` (one genuine ReferenceItem pathway proven)

---

## Explicit non-mutation pledge

This campaign will not accept, reject, create, update, or delete any of Kay’s records. Inventory scripts use Prisma `find*` / `count` / `groupBy` / `aggregate` / read-only `SELECT` only.
