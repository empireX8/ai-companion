# 18 — Live candidate review

Verdict: **LIVE CANDIDATE PASSED — READY FOR ROOT CUTOVER REVIEW**

No hard fail reason recorded.

## What this phase delivered

1. **Blue/green live candidate route** `/dev/orvek-v0-canonical-live`
   - Client entry: `components/orvek-v0-canonical/canonical-live-entry.tsx`
   - Same `CanonicalWorkbench` + pages as `/dev/orvek-v0-canonical-reference`
   - Provider: `buildCanonicalLiveRuntimeData` ← `useOrvekHybridWorkbenchDataApi`
   - Candidate forces `syncRoutesFromPathname: false` so it does not jump onto production pathnames

2. **Live provider honesty**
   - `referenceSurface: false`, `canonicalRuntime: true`
   - No fixture identities (`d1`, `rep-weekly`, `aq-2`, …)
   - Empty live users get restrained empty states (not mock content)

3. **Canonical page empty-safety (required for live)**
   - Map / Decisions / Explore / Timeline no longer crash on missing selection
   - Hardcoded fixture counts and Explore fallback copy removed from the live path
   - Fieldwork / Investigations / Questions render truthful empties when ids are absent

4. **Root `/` not cut over in this phase**
   - Cold `/dev/orvek-v0-reference` and fixture `/dev/orvek-v0-canonical-reference` untouched
   - Parallel `components/orvek-v0/pages/*` remain inactive

## Captures (1440×900)

Fresh Clerk user (empty model) — structure + honesty proof:

- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/01-today.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/02-today-selected.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/03-evidence-context.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/04-linked-receipt.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/05-linked-context.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/06-back-restoration.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/07-model-movement.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/08-report-overlay.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/09-map.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/10-decision.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/11-experiment-investigation.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/12-explore.png`
- `docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/screenshots/step5-live-candidate/13-timeline.png`

## Notes

- Live candidate route mounted under auth.
- Fixture route still mounts independently after live candidate visit.
- Map capture shows truthful empty: “Nothing on your map yet” / “0 mapped” (no fixture 243/7).
- Content values differ from fixture by design (live empty vs fixture sample).
- See `16-live-capability-trace.md` and `17-capability-preservation-matrix.md`.
- Script: `scripts/step5-canonical-live-candidate.playwright.ts`
- Manifest: `step5-live-candidate-manifest.json`

## Gate checklist

| Requirement | Status |
|-------------|--------|
| Canonical live route running | Pass |
| Same canonical presentation family as fixture | Pass |
| Live data only (no fixture leak) | Pass |
| Major production capabilities preserved via adapter | Pass (see matrix 17) |
| No dependence on parallel production pages | Pass |
| Equivalent interaction paths (nav → page family) | Pass |
| No root cutover | Pass |

## Known residual for cutover review

- Deep Investigations production-only detail cards were not re-hosted as a parallel page; typed objects + Inspector remain the path (`MISSING` / deferred in matrix 17).
- Candidate disables pathname sync; production shell retains it.
- Fresh-user captures prove empty honesty; populated-account visual content will differ from fixture and should be reviewed at cutover with a real owned model.
