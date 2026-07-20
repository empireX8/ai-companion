# 02 — Marker nomination versus eligibility contract

## Principle

Markers and token overlap are **retrieval / nomination hints only**.

They are never sufficient to:

- classify a pair as a contradiction;
- authorize a new `ContradictionNode` candidate;
- authorize materialisation;
- bypass model-assisted semantic adjudication;
- update an existing `ContradictionNode` merely because generated sides look textually similar.

## Types

### `DetectedContradiction` (persistable)

Public detection result historically consumed by `materializeContradictions`.
CEQR-002: the legacy public path returns **zero** of these until semantic adjudication is wired.

### `ContradictionMarkerNomination` (non-persistable)

```ts
{
  kind: "marker_nomination";
  persistable: false;
  quarantineReason: "semantic_adjudication_required";
  markerFamily: "goal_mismatch" | "constraint_violation";
  markerMatched: string;
  referenceId / referenceType / referenceStatement;
  messageContent;
  similarExistingNodeId?: string; // duplicate hint only — not eligibility
}
```

Produced only by `nominateContradictionMarkersFromData`.

Structural separation:

- nominations lack `type`, `sideA`, `sideB`, `confidence`, `title`;
- `persistable: false` is explicit;
- cannot be passed directly to materialisation as a `DetectedContradiction` without an invalid cast that still lacks required fields.

## Eligibility

| Signal | Role after CEQR-002 |
|--------|---------------------|
| Rhetorical markers | Nomination only |
| Goal/constraint reference presence | Nomination only |
| Token overlap | Import rejection / relevance / later dedupe — never eligibility |
| Textual similarity to existing node | Duplicate hint on nomination only — never evidence update authorization |
| Behavioral-admission regex | Removed as affirmative import eligibility |
| Validated semantic adjudication | Not wired in this slice → zero candidates |

**Zero semantic authorization ⇒ zero candidate creation.**
**No deterministic semantic fallback.**
