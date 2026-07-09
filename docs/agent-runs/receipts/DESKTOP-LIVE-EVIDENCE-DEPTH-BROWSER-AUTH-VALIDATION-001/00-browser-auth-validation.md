# Desktop Live Evidence Depth Browser/Auth Validation 001

## Baseline

Branch: desktop-live-evidence-depth-browser-auth-validation-001
Base: staging @ 24feeaf
Production-ready: NO

## Scope

Validate the live Evidence Pointer depth path after migration repair and runtime fixture landing.

Target path:

local fixture seed
→ publishModelUpdateCandidate
→ SurfacedEvidencePointer materialized
→ /api/today/evidence-pointers
→ Today Evidence Pointer UI
→ cleanup

## Results

### Local DB fixture execute

PASS.

The guarded runtime fixture executed against the local PostgreSQL database using the real local Clerk user id:

user_34TUYA53pI1QRLK73O22Kve1a1G

The fixture reported:

ok: true
publish.status: materialized
pointerExists: true
pointerPublicEligible: true
rationaleStored: true
graphSlotLinkCount: 1
inspectorDepthListReady: true
storedPointerReplacesFallback: true
unsafe fallback preserved: true

Materialized pointer:

receipt-pattern-dev-live-evidence-depth-claim

### HTTP route/auth validation

PASS.

The /api/today/evidence-pointers route returned a depth-safe pointer graph for the logged-in local user.

Returned pointer:

receipt-pattern-dev-live-evidence-depth-claim

Returned linked object:

dev-live-evidence-depth-conclusion

Route result confirmed:

inspectorDepthListReady: true
rejectedPointers: []

### Browser Today validation

PASS.

The main Today UI showed the stored Evidence Pointer while fixture data was kept.

Observed Evidence Pointer title:

I keep working past the stop point even when I said I would not

This confirms Today used the stored depth-safe pointer instead of the fallback rows.

### Cleanup

PASS.

After browser validation, the fixture was rerun without --keep-data.

Cleanup result:

cleanupPerformed: true

The fixture completed successfully after cleanup.

## What this proves

The live Evidence Pointer depth path works locally across:

authoring inputs
→ publish
→ materialization
→ persisted SurfacedEvidencePointer
→ authenticated evidence pointer API response
→ Today stored pointer replacement
→ safe cleanup

## What this does not prove

- Production deployment readiness.
- External production DB behavior.
- A real production caller passing evidenceDepthAuthoring during candidate creation.
- Full launch/security readiness.

## Files changed

Receipt only.

## UI code changed

NO.

## Runtime/visual required

Completed manually.

## Production-ready

NO.

## Remaining blocker

No production caller currently passes evidenceDepthAuthoring on candidate create.

## Recommended next branch

desktop-live-evidence-depth-authoring-caller-wiring-001

Purpose: wire a real internal review/operator path to pass evidenceDepthAuthoring into model update candidate creation.
