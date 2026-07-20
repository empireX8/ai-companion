# 09 — Controlled natural-entry proof design

**Phase:** A — design only (do not execute)
**Purpose:** Later proof that repaired extraction produces one trustworthy candidate through the normal ingestion path.

---

## Preconditions (must be true before execution)

| Precondition | Slice |
|--------------|-------|
| Semantic evaluator + marker quarantine deployed | CEQR-001, CEQR-002 |
| Same-session provenance enforced | CEQR-004 |
| Dual-side lineage persisted | CEQR-005 |
| Import review + Inspector show both sources | CEQR-008, CEQR-009 |
| Existing 25 excluded from proof | CEQR-011 |

---

## Proof objective

Establish end-to-end chain:

```
natural user entry
  → extraction (Explore or journal POST /api/message)
  → contradiction detection (repaired)
  → ContradictionNode candidate
  → dual-side evidence on row + links
  → Import review OR candidate review surface
  → human Accept (Kay)
  → Map Active conflict projection
  → Inspector symmetric lineage
```

**No direct database insertion.** No `POST /api/contradiction` manual create.

---

## Entry design options

### Option A — Genuine explicit contradiction (preferred for Wave 2.1)

Kay authors **one message** in **Free Explore** or **journal** session containing incompatible commitments in the same scope, for example:

- A stated goal/constraint clause the system can extract or match to an existing same-session ref
- An explicit behavioural admission that contradicts that commitment in the same message or immediate follow-up **within the same session**

**Requirements:**

- Message length ≥ 15 (detector floor)
- Contains genuine semantic opposition, not rhetorical `"but I mean"`
- Same session as Side A reference (or self-contained dual clause)
- Avoid coding noise, pasted plans, technical chatter (import classifier patterns)

**Example structure (illustrative — Kay must author natural wording):**

> Side A ref (extracted or pre-existing in session): "I do not eat after 9pm."
>
> Same session message: "…I know I said I don't eat late, but I ate at 11 again tonight because…"

### Option B — Genuine unresolved tension (labeled)

If no clean Class A is achievable, author a **Class B** tension with clear labeling intent:

> "I want to review after every reading, but I keep wondering if reading dense books is pointless when I forget so much — I'm not sure the review habit is working."

**Expected under repaired contract:** **No ContradictionNode** unless product adds tension object. Option B proof would validate **non-creation** + optional future tension surfacing — **not** Wave 2.1 Map conflict proof.

**Wave 2.1 requires Option A.**

---

## Execution runbook (Phase B+ — not now)

### Step 1 — Before gate

Run `readonly-phase-a-account-gate.mjs --label proof-before`

Record: pending 53, CN pending 25, open genuine 0

### Step 2 — Author entry

| Field | Value |
|-------|-------|
| Surface | Free Explore chat or journal (`POST /api/message`) |
| Session | New or existing APP session (not import) |
| Actor | Kay |
| Content | Natural wording per Option A |

### Step 3 — Wait for background detection

`app/api/message/route.ts` `after()` block runs `detectContradictions` → `materializeContradictions`

### Step 4 — Verify candidate created

Read-only query:

- Exactly **one new** `ContradictionNode` with `status: candidate`
- `sideASource*` and Side B `sourceMessageId` populated (post Slice 5)
- Same session for both sides
- Evaluator class A in receipt script

### Step 5 — Import review / candidate surface

If APP-origin CN appears in candidate review API, verify dual-source display.

(Note: current import review query filters `IMPORTED_ARCHIVE` — **Slice 8 may need APP candidate path** or use contradictions candidate page for APP-origin. Flag as implementation gap if APP candidates not in Import overlay.)

### Step 6 — Human Accept

Kay invokes `POST /api/import-review/candidates/[key]/decide` with `decision: accept` **or** equivalent accept path for APP candidates.

**Authorized only in proof phase with Kay explicit approval.**

### Step 7 — After accept verification

| Check | Expected |
|-------|----------|
| CN status | `open` |
| Open genuine import CN | 0 or 1 depending on APP vs import origin |
| ModelUpdate | +1 linked to CN (if accept path writes MU) |
| UEL | Links for Side A ref + Side B message/spans |
| Map | Shows Active conflict |
| Inspector | Both sides + both source sessions |

### Step 8 — After gate

Run account gate; document delta (exactly +1 open CN, +N UEL, etc.)

---

## Success criteria

| Criterion | Required |
|-----------|----------|
| Proof-eligible Class A | Yes |
| Dual-side lineage truthful | Yes |
| Kay human Accept | Yes |
| Map projection | Shows conflict |
| Inspector | No session-local overstatement |
| Pre-repair 25 unchanged unless Kay individually acts | Yes |

---

## Failure handling

| Failure | Action |
|---------|--------|
| No candidate created | Receipt failure; tune evaluator — do not loosen to markers |
| Class C/D candidate | Do not accept; revise entry |
| Cross-session Side A | Block deploy — session slice bug |
| APP candidate not in review UI | Implement APP candidate surfacing slice before proof |
| Accept path missing UEL for Side A | Block — lineage slice incomplete |

---

## Artifacts to produce (proof phase)

| File | Content |
|------|---------|
| `10-controlled-natural-entry-proof-before.json` | Gate snapshot |
| `11-controlled-natural-entry-proof-run.md` | Step-by-step with ids |
| `12-controlled-natural-entry-proof-after.json` | Gate snapshot |
| Redacted excerpt of entry | Their words only — no full private dump in public receipts |

---

## Phase A status

| Item | Status |
|------|--------|
| Entry authored | **Not done** |
| Database mutated | **No** |
| Proof executed | **No** |

Design complete; execution deferred to Slice CEQR-010.
