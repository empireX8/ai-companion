# 06 — Imported-history write path

**Campaign:** INTELLIGENCE-COMPATIBILITY-AUDIT-001
**Expands** CHATGPT-IMPORT + DB-BACKED audits into full intelligence architecture.

---

## End-to-end path

```
ChatGPT zip
  → POST /api/upload/init|chunk|finalize
  → enqueueImportProcessing (import-upload-queue)
  → processChatImportSession (import-upload-processor)
  → importExtractedConversations (import-chatgpt)
       → Session(IMPORTED_ARCHIVE) + Message
       → DerivationRun(scope=import)
       → processMessageForProfile → EvidenceSpan + ProfileArtifact
       → extractReferenceFromImportedMessage → ReferenceItem(candidate)
       → detectContradictions + materialize → ContradictionNode(candidate)
  → onImportComplete
       → patternBatchOrchestrator → PatternClaim(active) + evidence
       → tryCreateInternalUserMapCandidateFromImportCompletion (gated)
  → Review UI
       → GET /api/import-review/candidates (live DB; overrides composition)
       → POST …/decide (accept|reject) — NOT run this campaign
  → Providers → mounted canonical surfaces
```

**Legacy blocked:** `POST /api/import/chatgpt` → 410; `/import` page voided by shell.

---

## Kay funnel (read-only truth)

| Stage | Count / rate |
|-------|-------------:|
| Conversations imported | 640 / 640 processed |
| Messages imported | 18,582 |
| Derivation runs import completed | 635 (0 failed) |
| Sessions with spans | 622 / 640 (~97%) |
| Sessions producing ReferenceItems | 28 (~4.4%) |
| Sessions producing ContradictionNodes | 14 (~2.2%) |
| Approx sessions with no span/ref/contra | 18 |
| Pending candidates | 53 (28 RI + 25 CN) |
| Accepted RI | 1 |
| Accepted CN | 0 |
| Auto PatternClaims | 7 (active, no human review) |
| Import-linked UM | 1 |
| Import-linked MU | 1 (for UM, not for RI accept) |

---

## Candidate types that exist today

| Source table | Types present (Kay) | Accept destination |
|--------------|---------------------|--------------------|
| ReferenceItem | goal, preference, constraint | status→active (no MU on RI accept) |
| ContradictionNode | goal_behavior_gap, constraint_conflict | status→open + UEL + MU link_detected |

Not observed as pending RI types for Kay: pattern, assumption, hypothesis, rule, source.

---

## What cannot currently be materialised (or is weakly materialised)

| Concept | Gap |
|---------|-----|
| ProfileArtifact → Map | No accept→Map path; Orvek ignores ProfileArtifact |
| ReferenceItem → ModelUpdate | Schema/path does not create MU on RI accept |
| ReferenceItem → UEL | Prior proof noted UEL gap on RI accept |
| Dedicated Goal / Decision / Outcome objects | No tables; proxies only |
| Identity/values/working-style profile sections from import | Extraction may write ProfileArtifact; Map sections composition/static |
| Bulk quality-gated promotion | Human review one-by-one; 53 still pending |

---

## Filters / noise entry points

- High rejection inside successful derivation (prior audit: thousands of rejected ref extracts)
- Coding/project ChatGPT threads still create sessions/messages; pattern/ref extractors can lift surface noise
- `goal_behavior_gap` dominates contradictions (22/25) — often shallow goal-vs-text heuristics
- Pattern auto-promote to `active` bypasses human review (unlike RI/CN)

---

## Semantic depth gained / lost

| Stage | Depth |
|-------|-------|
| Message → span | Quote preserved |
| Span → ProfileArtifact | Typed but stuck candidate; unused by Map |
| Message → ReferenceItem | Often near-verbatim preference/goal snippets; low confidence |
| Message → ContradictionNode | Generic titles (“Goal behavior gap”) |
| Batch → PatternClaim | Some behavioral structure (people-pleaser, overload); some shallow loops |
| Dark-engine → UM | Mostly restates pattern + conflict labels; not deep synthesis |

---

## Schema gaps affecting evidence / ModelUpdate linkage

1. RI accept without MU / incomplete UEL
2. No first-class Goal linking decisions↔goals on Decisions densograph (`linkedGoal*` not projected)
3. Composition seed report/movements compete with genuine MU in UI

---

## Relation to prior audits

- Ingestion + analysis: **worked**
- Review queue wiring: **worked** (DB-BACKED)
- Single RI accept → Map fact: **proven** (SINGLE-REAL-IMPORT)
- Remaining: bulk quality, CN accept proof, MU/UEL completeness, composition unmask, ProfileArtifact fate
