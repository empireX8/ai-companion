# Current Desktop Reference Authority

Status: active
Date: `2026-07-17`
Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`

## Current Phase

The current phase is **exact desktop reference restoration**, not redesign.

The accepted target is the approved v0 desktop reference presentation. Production may substitute authenticated real data and durable actions. Production may **not** introduce an independent Inspector presentation and call it parity.

## Authority Order

1. Kay's human confirmation on `2026-07-17`:
   - historical accepted app at commit `5c56ba0` on `http://localhost:3001`
   - current frozen route at `http://localhost:3000/dev/orvek-v0-reference`
   - result: visually and behaviorally the same
   - effect: the current frozen route is a valid authority source and the deleted original recording is not required for this repair
2. Current frozen reference route and package:
   - `app/dev/orvek-v0-reference/page.tsx`
   - `components/orvek-v0-reference-frozen/**`
3. Frozen code provenance:
   - `.reference/v0-orvek-workbench/**`
   - provenance-matched Inspector companion files from commit `6ad723216088987953cac776c8119693ea3bc982` where `.reference/` is incomplete
4. Explicit product-owner instructions in `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
5. Current production implementation under repair
6. Deferred redesign contracts and historical visual PASS receipts

Current discovery status:

- Repo-local stored visual media for the approved recording/screenshots was **not found** in this repository on `2026-07-17`.
- Visual authority is **not blocked** because Kay directly validated the frozen route against the historical accepted app.

## Active Rules

- Frozen reference assets are the target.
- Production data substitution is allowed.
- Independent visual divergence is not allowed.
- Future light mode, dark mode, color redesign, and broader product redesign are deferred.
- Future Explore redesign is deferred.
- Historical visual PASS claims are not current acceptance authority.
- No visual-completion verdict is valid without Kay's side-by-side production review.

## Required Interpretation

For desktop Orvek workbench and Inspector work:

- Treat `/dev/orvek-v0-reference` as the frozen authority route for this campaign.
- Do not treat the current production Inspector as its own target.
- Do not treat archived redesign contracts as permission to re-theme, re-space, or re-structure the restored Inspector.
- If a frozen source is incomplete, supplement it only with provenance-matched code from the same frozen commit rather than with fresh redesign work.
- A production ModelUpdate selection must preserve the live ModelUpdate identity while hydrating the richer Inspector read model required by the shared authority presentation.

## Supporting Records

- Phase 0 intake receipt:
  `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/00-intake-and-reference-inventory.md`
- Authority manifest:
  `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/reference-authority-manifest.json`
- Frozen route receipt:
  `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/02-frozen-reference-route.md`
- Root cutover (pending Kay visual review; not a visual-acceptance claim):
  `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/21-root-cutover-review.md`
- Deferred redesign supersession index:
  `docs/archive/deferred-redesign/SUPERSESSION-INDEX.md`

## Production root mount (pre-visual-acceptance)

Production `/` currently mounts the shared canonical + live runtime
(`CanonicalLiveRuntimeEntry` via `OrvekWorkbenchShell`). Cold authority remains
`/dev/orvek-v0-reference`. Temporary parallel rollback (non-authoritative):
`/dev/orvek-v0-parallel-production-rollback`.
