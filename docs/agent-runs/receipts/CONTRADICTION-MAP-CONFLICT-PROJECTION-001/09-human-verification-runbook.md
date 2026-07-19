# 09 — Human verification runbook

## Purpose

Prove **click selection** for an open ContradictionNode on the mounted canonical Map — without Kay DB mutation and without Wave 2.1 accept.

This does **not** prove Kay currently has an open contradiction (account still has 0 open / 25 candidate).

## Fixture route (dev/test only)

**Route:** `/dev/contradiction-map-projection`

Initial state (required for click gate):

- Map page is shown
- Initial centre selection is **Fixture claim (dev only)** (`conclusion-dev-fixture-claim-001`)
- Active conflicts still lists **Fixture open contradiction (dev only)** (`contradiction-dev-fixture-open-contradiction-001`)
- Contradiction is **not** auto-selected

### Click gate steps

1. Open `/dev/contradiction-map-projection`
2. Confirm initial centre panel shows the claim (not the contradiction)
3. Confirm Inspector reflects the claim (`usermap_conclusion` / claim rail id)
4. Click **Fixture open contradiction (dev only)** in Active conflicts
5. Confirm centre panel changes to the contradiction
6. Confirm Inspector changes to the contradiction
7. Confirm selection id is `contradiction-dev-fixture-open-contradiction-001`
8. Confirm Inspector metadata:
   - `inspectorObjectType: contradiction_node`
   - `inspectorObjectId: dev-fixture-open-contradiction-001`
9. Refresh the fixture route — returns to claim-initialised fixture state (still valid; contradiction remains listed)
10. Confirm `/your-map` is unchanged (production hybrid path; not this fixture)

## Isolation guarantees

- Fixture builds objects via `buildMapProductionDataApi` + `buildCanonicalLiveRuntimeData`
- Does **not** call hybrid live DB Map fetch
- Does **not** accept candidates / write CN / create MU / UEL
- Cannot leak into root/live production data paths
- Production `/your-map` selection semantics untouched

## Wave 2.1 (later)

Human accept of one genuine Kay candidate remains reserved for Wave 2.1 after this campaign PASSes.

## Human result — FINAL PASS

**Status: HUMAN CLICK GATE PASS**

Kay verified:

| Step | Result |
|------|--------|
| Fixture initially selected Fixture claim (dev only) | PASS |
| Click Fixture open contradiction (dev only) highlighted conflict row | PASS |
| Centre panel switched to the contradiction | PASS |
| Inspector switched to the contradiction | PASS |
| Side A / Side B remained truthful | PASS |
| No fabricated Model Movement | PASS |
| Refresh reconstruction | PASS |
| Ordinary `/your-map` unaffected | PASS |

- Automated fixture click-gate contract: PASS
- Kay open CN Map visibility on live account: deferred to Wave 2.1 (account has 0 open)
