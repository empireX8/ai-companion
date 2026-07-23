# 00 — Intake and boundaries

## Slice

`CONTRADICTION-LIVE-EVIDENCE-OFFSET-FORENSIC-REPAIR-001` / campaign slice `CEQR-020`

## Purpose

Offline root-cause and repair for the evidence-offset boundary exposed by the
immutable CEQR-019 live result `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN`.

## Hard boundaries observed

- No live provider calls (OpenAI / Anthropic / Z.ai / DeepSeek).
- No CEQR-019 live guards set; CEQR-019 one-shot claim not altered.
- No second CEQR-019 live receipt.
- No real account / database / writer / persistence calls.
- No Prisma migrations; no production route wiring.
- No clamping, fuzzy matching, silent offset repair, or inclusive→exclusive conversion after receipt.
- Provider does not author `sourceId` or `exactQuote`.
- Lexical-boundary validation not weakened to pass provider output.
- CEQR-019 raw offsets are **unknown** (not retained); not claimed as known.

## Classification target

`PASS_OFFLINE_OFFSET_FORENSIC_REPAIR_READY_FOR_NEW_LIVE_PROOF` (not live proof;
production readiness remains NO).

## Counts for this slice

- CEQR-019 live provider attempts (historical, immutable): 3
- CEQR-020 live provider attempts: 0
- Real account queries: 0
- Real database queries/mutations: 0
- Writer/persistence calls: 0
- Production readiness: NO
- No future live run is authorised automatically.
