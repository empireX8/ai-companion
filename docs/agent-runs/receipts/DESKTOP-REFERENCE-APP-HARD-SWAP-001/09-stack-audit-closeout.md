# 09 Stack Audit Closeout

## Verdict
Today parity passed after the Evidence Pointer regression was patched.
Delta Log is preserved.
Continue from what changed preserves the reference path.
Evidence Pointer opens Inspector.
Non-Today surfaces still use temporary reference/mock baseline.
`createMockOrvekDataApi` remains in use for unwired surfaces.
The stack is not production-ready.
No PR should be merged yet unless we intentionally choose to consolidate.

## PR Stack

| PR | Branch | Based on | What it does | Visual status |
| --- | --- | --- | --- | --- |
| #81 | `desktop-reference-app-hard-swap-001` | `staging` | Hard swaps the production desktop to the reference workbench, quarantines the old desktop shell UI, and keeps the old shell as backup-only code. | Visual hard swap passed; the active production render path is the reference workbench shell. |
| #82 | `desktop-today-intent-metadata-001` | `desktop-reference-app-hard-swap-001` | Adds Today intent metadata to the adapter/types and stamps live Today data with workbench-native intent fields while preserving href fallbacks. | No direct visual change; this is a contract/data-shaping step. |
| #83 | `desktop-today-intent-consumption-001` | `desktop-today-intent-metadata-001` | Consumes the Today metadata in the Today page via `resolveTodayWorkbenchCommands` / `runTodayWorkbenchCommands`, replacing browser routing with workbench-native commands. | Visual path is preserved; the Today surface now responds through workbench state instead of router pushes. |
| #84 | `desktop-today-production-data-parity-bridge-001` | `desktop-today-intent-consumption-001` | Bridges live Today production data into the reference workbench without changing the reference contract. It injects a hybrid data API that overlays live Today receipts and Today props onto the mock baseline. | Today parity passed; Evidence Pointer opens Inspector and the reference layout remains intact. |

## What Each PR Contributes

- `#81` establishes the reference-workbench hard swap and leaves the old shell quarantined.
- `#82` adds the Today intent metadata layer: `selectionId`, `inspectSelectId`, `movementId`, `reportId`, `pageId`, `overlayId`, and `inspectorTab`.
- `#83` consumes that metadata in Today, so the visible controls stay in the reference path while the command layer becomes workbench-native.
- `#84` adds the hybrid Today production bridge, which hydrates live Today receipt objects and Today props while keeping all other surfaces on the temporary baseline.

## What Is Visually Passed

- The production desktop shell hard swap is visually passed.
- The Today hero/report path is visually passed.
- The Evidence Pointer path opens Inspector.
- The Delta Log is preserved.
- `Continue from what changed` preserves the reference path.
- The Today receipts and workbench-native Today actions render without changing the reference layout.

## What Is Still Mock Or Reference Baseline

- Map is still on the temporary reference/mock baseline.
- Decisions is still on the temporary reference/mock baseline.
- Timeline is still on the temporary reference/mock baseline.
- Explore is still on the temporary reference/mock baseline.
- Any unwired Today slots still fall back to the reference baseline instead of inventing live data.
- The hybrid bridge still starts from `createMockOrvekDataApi()` and only overlays the live Today surface.
- The quarantined old shell files remain backup-only code, not runtime code.

## Why The Stack Is Still WIP

- The stack only completes Today parity; it does not finish the full desktop data migration.
- Non-Today surfaces still depend on the temporary reference/mock baseline.
- The bridge is intentionally layered and temporary, not a final production data architecture.
- The current workbench still carries the reference baseline as the fallback path, so the production contract is not complete.
- The stack is intentionally scoped to parity, not consolidation or release.

## Risks If We Keep Stacking More PRs

- Each added surface increases the chance of breaking the stable reference path while debugging the bridge.
- More layers make it harder to tell whether a regression came from shell parity, Today metadata, or the newest surface.
- A wider bridge before consolidation increases fallback drift and makes rollback and review less reliable.
- The stack becomes more brittle as more surfaces depend on partially bridged data contracts.

## Next Safest Move

- If we continue, the next safest single-surface bridge is `Map`.
- Recommendation: consolidate first instead of stacking another surface now.
- No PR should be merged yet unless we intentionally choose to consolidate.

