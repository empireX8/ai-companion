# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-SEMANTIC-OUTPUT-COMPATIBILITY-001` (CEQR-012)

## Exact base

`57f702c7a0c8e4aa6ff568611bf4603b24243a2c` (PR #155 / CEQR-011)

## Independent-review correction

After review: the only proven CEQR-012 defect is insufficient failure
observability. Speculative prompt changes were removed so a future diagnostic
rerun can reproduce under the same CEQR-011 prompt.

## Non-negotiables observed

- No live provider run
- No provider-output mutation
- No runtime prompt change vs CEQR-011
- No source-length metadata
- No ordinary message/import wiring
- No git commit / push / PR
