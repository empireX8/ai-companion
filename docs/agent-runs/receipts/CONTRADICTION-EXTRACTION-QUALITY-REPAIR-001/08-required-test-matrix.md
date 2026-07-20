# 08 — Required test matrix

**Phase:** A — test specification for repair slices (not implemented in Phase A)
**Clarification:** Model-assisted contract, zero-or-one match, exact span provenance
**Constraint:** Classification-only tests must not mutate the database.

---

## Test infrastructure conventions

| Convention | Detail |
|------------|--------|
| Adjudication contract tests | Validate structured AI result schema + deterministic validators — **mock model**; no Prisma writes |
| Detection / nomination tests | Markers/token overlap nominate only; mock DB reads |
| Materialization tests | Mock transaction; assert span FKs / chain; reject orphan Side A |
| Integration | Test DB only; Kay account **never** in CI |

**Forbidden interpretation of CEQR-001 tests:** An enlarged regex/compatibility-rule suite that pretends to be semantic adjudication.

---

## Matrix

### 1. Generic `"but i"` no longer sufficient

| Case | Expected |
|------|----------|
| T1.1–T1.3 Marker present, model abstains or Class C/D | No CN |
| T1.4 Marker present, highest token-overlap ref is Class C | **No CN** — ranking among ineligible insufficient |

---

### 2. Compatible states rejected

| Case | Expected |
|------|----------|
| T2.1 Identity-trigger vs objectivity (exemplar pattern) | Class C — no CN |
| T2.2 Soft honesty / softening feedback | Class C or B — no CN |

---

### 3. Identity-trigger sensation vs objectivity → compatible

| Case | Expected |
|------|----------|
| T3.1 Structured result flags emotional/physiological vs reasoning standard | Class C — no candidate |

---

### 4. Goal plus obstacle not automatically contradictory

| Case | Expected |
|------|----------|
| T4.1 Dense book / retention obstacle | Class B — no CN |
| T4.3 Explicit same-day skip of stated goal | Class A eligible only after model + span validation |

---

### 5. Changed belief over time

| Case | Expected |
|------|----------|
| T5.1 Cross-session belief change | No CN in v1 |
| T5.2 Same-session “used to / now” | Not Class A simultaneous |

---

### 6. True same-message / same-session contradiction accepted

| Case | Expected |
|------|----------|
| T6.1 Explicit incompatible propositions + validated spans | Class A candidate eligible |
| T6.2 Zero eligible same-session refs | **No CN** |

---

### 7. Qualifiers retained

| Case | Expected |
|------|----------|
| T7.1 Partial compliance in structured qualifications | Class B — not A |
| T7.2 Uncertainty ≠ negation | Class C/B |

---

### 8. Actor / scope / time

| Case | Expected |
|------|----------|
| T8.* Model fields for actor/subject/timeframe drive Class C/D when mismatched | No CN |

---

### 9. Cross-user isolation

| Case | Expected |
|------|----------|
| T9.1 User A evidence never appears in User B assembly | Empty / abstain |

---

### 10. Dual-side lineage and exact spans

| Case | Expected |
|------|----------|
| T10.1 Persist Design A `sideASourceSpanId` **or** Design B chain to exact span | Assert |
| T10.2 Side B exact span persisted / resolvable | Assert |
| T10.3 Orphan Side A reference rejected | Create fails / abstain |
| T10.4 Fabricated / inferred span rejected | Validator fails |
| T10.5 AI-selected text not substring of source at claimed offsets | Reject |
| T10.6 Accept UEL includes Side A + Side B exact sources | Assert |
| T10.7 Presentation does not claim symmetric lineage when spans missing | Assert |

---

### 11. Zero-or-one selection / no fan-out / no forced-one

| Case | Expected |
|------|----------|
| T11.a Multiple same-session refs, none pass semantic threshold | **Zero** CN |
| T11.b Multiple refs, one passes | **One** CN |
| T11.c Multiple refs appear eligible / ambiguous | Abstain or single resolved pair with distinct evidence — **never fan-out** |
| T11.d Forced selection of top token-overlap among failing refs | **Forbidden** — no CN |

---

### 12. Idempotency and duplicate prevention

| Case | Expected |
|------|----------|
| T12.1 Same message twice | One CN or evidence dedup |
| T12.2 Sibling identical Side B | Single CN |

---

### 13. No DB mutation in classification-only tests

| Case | Expected |
|------|----------|
| T13.1 Mock model + pure validators | No Prisma write |

---

### 14. Map projection compatible with valid open CNs

| Case | Expected |
|------|----------|
| T14.1 Candidates excluded; open post-repair CN with truthful spans projects | Pass |

---

### 15. Model-assisted contract schema

| Case | Expected |
|------|----------|
| T15.1 Missing required structured fields | Reject / abstain path |
| T15.2 Classification C/D with abstention reason | No CN |
| T15.3 Markers used as eligibility in stub | Test fails contract |

---

### 16. Objectivity Referee interface (mock)

| Case | Expected |
|------|----------|
| T16.1 PASS / PASS_WITH_LOWER_CONFIDENCE / ROUTE_TO_DIFFERENT_OBJECT_TYPE / REQUEST_MORE_EVIDENCE / ABSTAIN | Persistence respects outcome |
| T16.2 Referee cannot bypass deterministic span/schema validation | Assert |

---

## Import nomination regression

| Case | Expected |
|------|----------|
| Unrelated pair | Not eligible after adjudication |
| Fan-out of repeated Side A | Prohibited (not “cap and allow 3”) |

---

## Verification command

```bash
bash scripts/verify-mindlab.sh
```

---

## Coverage gap vs current suite

| Gap | Priority |
|-----|----------|
| Model-assisted structured result contract tests | P0 |
| Zero-or-one / no forced-one | P0 |
| Exact span validation | P0 |
| Compatible-state / qualifier cases | P0 |
| Referee interface mock | P1 |
| Dual-side presentation honesty | P1 |

---

## Phase A confirmation

This matrix is **specification only**. No tests added in Phase A.
