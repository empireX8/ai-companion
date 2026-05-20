# Phase 5 Receipt and Link Architecture Standardization Contract

Date: 2026-05-20
Type: Phase 5 contract (doc only)
Scope: `/Users/user/ai-companion`

## 1. Purpose

Phase 5 standardizes public object links, evidence continuity links, and receipt namespaces after Full Phase 3 closure.

The goal is to keep public trust surfaces coherent while preserving the safety posture established during Phase 3:
- public links use real persisted IDs only,
- evidence continuity is projected through public-safe helpers only,
- receipt namespaces are limited to explicitly contracted provenance semantics,
- unsupported or unsafe continuity remains honest non-link fallback copy.

## 2. Roadmap Position

- Full Phase 3 is `CLOSED`.
- Phase 5 is `PARTIAL` and owns broader receipt/link architecture standardization.
- Phase 6 owns mobile parity and broader mobile expansion.
- Promotion workflow remains a later product decision outside this Phase 5 contract.

## 3. Current Production Receipt Namespaces

Current production public Library receipt namespaces:
- `receipt-pattern-*`
- `receipt-tension-*`

Prohibited/deferred public receipt namespaces:
- `receipt-action-*`
- `receipt-user-map-*`
- `receipt-investigation-*`
- `receipt-fieldwork-*`
- `receipt-model-update-*`

Raw persisted receipt/evidence row IDs are not public Library route namespaces. A stored evidence row ID can look receipt-like, but it does not define a public `/library/{id}` receipt namespace unless this contract or a later contract explicitly allows it.

## 4. Current Link Systems

Current public-safe link and receipt systems:
- public linked-object continuity helper: `lib/public-linked-object-continuity.ts`
- public evidence continuity helper: `lib/public-evidence-continuity.ts`
- public safe-slice affected-object links: `lib/public-intelligence-safe-slice.ts`
- Library receipts: `lib/library-surface.ts`
- Today receipt links: `lib/today-surface.ts`
- UnderstandingEvidenceLink foundation: `app/api/understanding/evidence-links/route.ts`

The raw `/api/understanding/evidence-links` route is authenticated and user-scoped, but it is not public-safe for direct UI consumption because it can return fields such as `summary`, `snippet`, `quote`, `weight`, `confidenceContribution`, and `meta`.

## 5. Architecture Gaps

Current gaps to standardize in Phase 5:
- allowlists are split across multiple helpers,
- object-link and evidence-link policies overlap but are not centralized,
- receipt namespace policy is mostly convention/test enforced,
- fallback copy is consistent but not centralized,
- Library receipts and `UnderstandingEvidenceLink` continuity are distinct systems and must not be conflated,
- the raw evidence-link route exposes fields unsuitable for public UI.

## 6. Canonical Taxonomy

### A. Object Detail Links

Purpose:
- Link from one public object surface to another public object detail page.

Allowed public use:
- Use only when the target object exists, belongs to the authenticated user, and satisfies visibility/status safety rules.

Safety requirements:
- real IDs only,
- no label/title/body-derived IDs,
- ownership verified before href emission,
- visibility/status safety enforced where applicable.

Fallback behavior:
- `No linked detail available yet.`

### B. Evidence Continuity Links

Purpose:
- Show safe, read-only continuity between a public object and its supporting public-safe source objects.

Allowed public use:
- Use only through projected public-safe helpers with source/target allowlists.

Safety requirements:
- no raw `/api/understanding/evidence-links` UI consumption,
- no raw quote/snippet/summary/meta leakage unless explicitly contracted later,
- source and target ownership verified before href emission,
- unsupported sources omitted or rendered as honest fallback.

Fallback behavior:
- `No linked evidence available yet.`

### C. Receipt Links

Purpose:
- Link to a provenance view with established receipt semantics.

Allowed public use:
- Current public receipt links are Library pattern/tension receipt routes only.

Safety requirements:
- no synthetic receipts,
- no new namespace without a semantic contract,
- route IDs must be real backend object IDs under an approved namespace.

Fallback behavior:
- use existing receipt empty-state behavior; do not synthesize receipts.

### D. Internal Review Links

Purpose:
- Support internal-only inspection or review workflows.

Allowed public use:
- None.

Safety requirements:
- internal review links and APIs must not appear in public continuity surfaces.

Fallback behavior:
- public surfaces should not mention internal review availability.

### E. Unsupported/Deferred Links

Purpose:
- Represent targets that are not yet safe or contracted for public continuity.

Allowed public use:
- Non-link fallback copy only.

Safety requirements:
- no fake canonical links,
- no inferred IDs,
- no synthetic receipts.

Fallback behavior:
- object detail fallback: `No linked detail available yet.`
- evidence fallback: `No linked evidence available yet.`

## 7. Canonical Safety Rules

- real IDs only
- no label/title/body-derived IDs
- verify ownership before href emission
- enforce visibility/status safety where applicable
- no internal/candidate exposure
- no raw evidence/meta leakage
- no synthetic receipts
- no `receipt-action-*` unless explicitly contracted later
- no new receipt namespace without semantic contract
- no mobile work in this Phase 5 web standardization pass
- no schema changes unless a later audit proves necessary

## 8. Canonical Fallback Copy

Unsupported or missing object detail:
- `No linked detail available yet.`

Missing evidence:
- `No linked evidence available yet.`

Missing receipt/provenance:
- use existing receipt empty-state behavior; do not synthesize receipts.

## 9. Receipt Namespace Policy

Production receipt namespaces remain pattern/tension only for now:
- `receipt-pattern-*`
- `receipt-tension-*`

New receipt namespaces are prohibited until explicitly contracted.

Any new receipt namespace must define:
- semantic meaning,
- persisted evidence source,
- ownership and visibility rules,
- route behavior,
- fallback behavior,
- no-synthetic guarantee,
- regression tests.

## 10. Canonical Allowlist Registry Recommendation

Phase 5 should introduce a canonical public allowlist registry that records:
- object type,
- allowed href pattern,
- ownership check,
- visibility/status rule,
- public display label,
- supported surfaces,
- fallback behavior.

Current allowed object detail links:
- `usermap_conclusion -> /your-map/{id}`
- `pattern_claim -> /patterns/{id}`
- `contradiction_node -> /contradictions/{id}`

Current receipt links:
- `receipt-pattern-* -> Library receipt pattern route`
- `receipt-tension-* -> Library receipt tension route`

## 11. Public Evidence Continuity Policy

- public UI must not consume raw `/api/understanding/evidence-links`
- public evidence continuity must use projected helpers only
- first supported target remains `usermap_conclusion`
- current source allowlist:
  - `pattern_claim`
  - `contradiction_node`
- quote/snippet/summary/meta display remains deferred unless explicitly contracted later

## 12. Implementation Sequencing

Recommended sequence:
1. Contract doc first.
2. Registry/helper consolidation audit.
3. Add public link/evidence allowlist registry.
4. Add receipt namespace guard tests.
5. Run Library/Today receipt regression pass.
6. Then consider optional new receipt namespace design.

## 13. Non-Goals

Explicitly deferred:
- mobile work
- new receipt namespaces
- schema changes
- promotion workflow
- Phase 6 mobile parity
- Phase 7 agents/lenses
- raw evidence text rendering

## 14. Test Contract

Future implementation must include tests for:
- namespace guardrails for `receipt-pattern-*` and `receipt-tension-*` only,
- no synthetic receipt IDs,
- no `receipt-action-*` regression,
- no unsupported receipt namespace routing/rendering,
- real-ID-only links,
- ownership/visibility/status verification before href emission,
- fallback copy consistency,
- no raw metadata/quote/snippet/summary/`confidenceContribution`/`weight`/`meta` leakage,
- existing pattern/tension receipts unchanged,
- existing Phase 3 continuity links unchanged.
