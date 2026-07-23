# 01 — CEQR-019 and CEQR-020 baseline

## CEQR-019 immutable live baseline

- Classification: `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN`
- Live provider attempts: 3
- Referee attempts: 0
- Writer/persistence calls: 0
- Status: immutable historical failure. Never rerun.

CEQR-019 exposed truncated or invalid evidence spans under the prior transport.
That failure is the reason schema-v4 boundary-index transport exists. CEQR-021
must not mutate CEQR-019 artifacts or attempt a second CEQR-019 live receipt.

## CEQR-020 offline repair baseline

- Classification: `PASS_OFFLINE_OFFSET_FORENSIC_REPAIR_READY_FOR_NEW_LIVE_PROOF`
- Outcome: offline forensic repair selected schema-v4 boundary indices.
- `sourceId` and `exactQuote` are code-owned (not provider-authored).
- Max source length: 512 UTF-16 code units.
- Max catalog entries: 256.

CEQR-020 did not authorise live proof. CEQR-021 continues that offline posture
while preparing a separately gated future live harness.

## Inheritance into CEQR-021

CEQR-021 reuses CEQR-019 frozen synthetic scenarios byte-identically and builds
on CEQR-020 schema-v4 / catalog limits. No live execution is inherited.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
