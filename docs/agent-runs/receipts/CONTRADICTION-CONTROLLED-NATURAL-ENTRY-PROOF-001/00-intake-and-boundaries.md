# 00 — Intake and boundaries

**Task:** CONTRADICTION-CONTROLLED-NATURAL-ENTRY-PROOF-001 (CEQR-010)
**Phase:** IMPLEMENTATION + independent review correction
**Branch:** `desktop-contradiction-controlled-natural-entry-proof-001`
**Base / HEAD at start:** `22e786bdf77aed7e736a34a44e1b91ec2c0b9839`

## Kay decision locked

- Deterministic injected model runners only
- No live provider
- No provider credentials
- No real account database mutation
- No ordinary message-send wiring
- No ChatGPT/import wiring
- Existing 25 contradiction rows untouched

## Independent review corrections applied

1. Public entry is persisted `CurrentMessageSource` + `SameSessionReferenceRow[]` (not preassembled KernelSourceUnits)
2. Authorised plan capability never egresses the orchestrator
3. Post-write presentation failure is honest (`presentationStatus: failed`)
4. `gateStoppedAt` is null on success; cross-session mapping corrected
5. Receipts distinguish injected transaction boundary vs actual isolated DB

## Forbidden

- Live AI / Objectivity Referee provider
- `POST /api/message` or import path wiring
- Schema / migration changes
- Real Kay account writes
- Re-evaluation of the 25 legacy nodes
- Claiming production readiness or natural UI entry
- Exposing WeakSet-authorised plans on results
