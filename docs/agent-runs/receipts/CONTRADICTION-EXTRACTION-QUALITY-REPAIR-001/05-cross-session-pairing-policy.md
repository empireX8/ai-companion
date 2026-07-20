# 05 — Cross-session pairing policy

**Phase:** A — policy recommendation for new candidate creation
**Clarification:** Shared-kernel architecture correction (zero-or-one eligible match)
**Account context:** 17 / 25 existing pending CNs are cross-session false positives

---

## Options evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **1. Same-message only** | Side A and Side B must come from the same message (dual clause or self-contrast) | Strongest precision; simplest lineage | Misses valid same-session dual-message tensions |
| **2. Same-session, dual-message lineage** | Side A evidence from session S; Side B message from session S; both FKs persisted | Matches how import refs are extracted; allows goal-in-msg-1 vs admission-in-msg-2 | Requires session match + semantic gate |
| **3. Cross-session under strict conditions** | Allow cross-session only for explicit temporal change markers ("I used to…", dated statements) | Captures belief change | High false-positive risk; qualifier loss; stale refs |
| **4. Disable cross-session entirely (v1)** | Hard reject any Side A session ≠ Side B session | Eliminates 17/25 failure mode immediately | Cannot detect cross-time genuine change until later slice |

---

## Recommended policy

**For the first repaired version: Option 2 — same-session with explicit dual-message lineage, under a zero-or-one eligible-match rule.**

### Hard rules (v1)

1. **Side A and Side B must be from the same session.**
2. **Candidate generation may select zero or one reference** for Side A.
3. A reference is **selectable only after** it passes the semantic compatibility and contradiction contract (model-assisted adjudication — see `04-target-semantic-contract.md`, `11-shared-intelligence-kernel-architecture.md`).
4. When **no** reference passes the semantic threshold → **create no ContradictionNode candidate**.
5. **Ranking first among ineligible references is not sufficient** — highest score among failing refs must not produce a candidate.
6. **No fallback candidate** may be created merely because one reference has the highest token-overlap score.
7. **Fan-out is prohibited** — never emit one candidate per matching ref.
8. **Forced-one selection is prohibited** — “pick the best ref” must not mean “always pick one.”
9. **Keyword markers and token overlap may assist retrieval only** — nominate material for review.
10. **Keyword markers and token overlap may never establish semantic eligibility.**

### What “zero or one” means

| Outcome | Condition | Action |
|---------|-----------|--------|
| **Zero** | No same-session ref passes semantic adjudication | Abstain — no CN |
| **One** | Exactly one same-session ref (or same-message clause pair) passes semantic adjudication | Create at most one CN candidate |
| **Zero (collision)** | Multiple refs appear eligible | Do not fan-out; either resolve via adjudicator to a single eligible pair with distinct evidence, or **abstain** if ambiguous |

“Single best-match” in earlier draft language is **superseded**. Ranking may order candidates for review **after** eligibility; it must not force a match.

### Side A / Side B construction

1. **Side B** = current message being processed (detection trigger), with exact evidence span(s).
2. **Side A pool (retrieval only)** = same-session `ReferenceItem`s (or same-message dual clause) where type/status are in allowed sets — **nomination**, not eligibility.
3. **Side A selection** = zero or one after semantic adjudication + Objectivity Referee path (later slices).
4. **Persist** only when selected: Side A session/message/**span** (or guaranteed chain), Side B session/message/span, and reference link without orphan refs (see `03-dual-side-lineage-and-schema-audit.md`).

### Live chat and import

Apply **identical** same-session + zero-or-one semantic gate on both paths. Import keyword/token filters remain **retrieval assists only** and cannot override abstention.

### Backfill script

**Disable or gate** until session-scoped zero-or-one kernel path ships — backfill currently skips import classifier and defaults `open`.

---

## Cross-session in later campaigns

Option 3 may be added **only if**:

- Explicit temporal marker detected in Side B (`"I used to"`, `"no longer"`, dated clause)
- Side A ref tagged or inferred as superseded belief
- Human-review-only candidate by default
- Dual-side lineage includes **both** sessions **and** exact spans on CN row
- Stale ReferenceItem guard (ref updatedAt vs Side B message time)
- Zero-or-one rule still applies — no fan-out across sessions

Until then, **cross-session generation disabled** (Option 4 as interim subset of Option 2).

---

## Policy interaction with defect classes

| Concern | Same-session + zero-or-one effect |
|---------|-----------------------------------|
| Time changes | Legitimate change-over-time **not** detected in v1 — acceptable deferral |
| Changed opinions | Same — defer to later cross-session slice |
| Different modes/contexts | Reduced — refs tied to session context |
| Unrelated topic overlap | Reduced — session boundary + semantic abstention |
| Stale ReferenceItems | Still possible within session — semantic gate + span validation required |
| Qualifier loss | **Not solved by session scope alone** — model-assisted semantic contract |
| Forced false positives | Eliminated by zero-match abstention |
| Evidence burden | Lower — Inspector can show one conversation with exact spans |
| User correction | Unaffected — no Phase A status changes on existing 25 |

---

## What would change this conclusion

| Event | Policy adjustment |
|-------|-------------------|
| Product requires belief-change detection on import | Add Option 3 slice with strict temporal markers + human gate |
| Same-session yields zero candidates on Kay account after repair | First run controlled natural-entry proof (CEQR-010) before widening scope — **do not** weaken to forced-one |
| ReferenceItem extraction often cross-message within session but wrong sessionId | Fix ref extraction provenance first — blocks Option 2 |
| Schema migration rejected | Wire guaranteed provenance chain without premature migration — policy unchanged |

---

## Explicit non-goals (v1)

- Do not pair Side A from conversation A with Side B from conversation B
- Do not use user-wide ref query (`take: 50` without session filter)
- Do not treat token overlap or markers as eligibility
- Do not fan-out all same-session refs
- Do not force selection of a “best” ineligible ref

---

## Summary

**Recommended:** Same-session dual-message lineage with **zero-or-one eligible** Side A selection after semantic adjudication; markers/overlap for retrieval only; fan-out and forced-one prohibited.

**Cross-session:** Disabled for first repaired version; revisit in later campaign after trustworthy same-session candidates exist.
