# Wiring Matrix - CONTRACT-001 Acceptance

**Date:** 2026-06-29

## Source of Truth

| Layer | Path | Role |
|-------|------|------|
| Report builder | `lib/what-changed-reality-report.ts` | Generates the reality-tracking report that the app and tests consume |
| Contract constants | `lib/reality-tracking-output-contract.ts` | Defines allowed evidence statuses and legacy compatibility |
| Acceptance test | `lib/__tests__/what-changed-reality-report.test.ts` | Exercises the real builder with the exact bad fixture |

## Execution Path

1. Build a real packet in the test harness.
2. Call `buildDeterministicModelMovementRealityReport(packet)`.
3. Inspect the report sections that already power the app/report route.
4. Assert the contract-safe output and legacy compatibility.

## Assertions Bound to the Builder

| Assertion | Checked On |
|-----------|------------|
| `IDENTITY CLAIM REJECTED` appears | `report.overreachGuardrails.items` |
| `people pleaser` is not verified as a fact or supported claim | `allClaimItems(report)` |
| No fresh `mixed` evidence status appears | `allClaimItems(report)` |
| `REALITY GATE: PENDING EVIDENCE` appears | `report.realityGate.items` |
| Timestamped fieldwork copy appears | `report.fieldworkWatchFor.items` |
| Legacy `mixed` constant still exists | `REALITY_TRACKING_LEGACY_EVIDENCE_STATUS` |

## Excluded Paths

- UI routes
- Visual acceptance
- Schema changes
- Separate duplicate implementation
