# 01 — Sequence reconciliation

## Documentation inconsistency (recorded; not rewritten)

There is a documentation inconsistency in the controlling campaign sequence:

1. **CEQR-005** explicitly prepared validated dual-side span descriptors for a later persistence-wiring slice (`docs/agent-runs/receipts/CONTRADICTION-DUAL-SIDE-LINEAGE-MIGRATION-001/10-next-slice-boundary.md`).
2. The broader controlling roadmap places a separate persistence-wiring slice **after CEQR-006** and **before CEQR-007**.
3. The merged **CEQR-006** receipt `11-next-slice-boundary.md` calls **CEQR-007** the “next campaign slice” while simultaneously stating that candidate creation and `ContradictionNode` / `EvidenceSpan` persistence are **not started**.

## Decision for this worktree

Treat **CONTRADICTION-PERSISTENCE-WIRING-001** as the **unnumbered dependency gate** required before the next numbered slice, **CEQR-007**.

## Historical artifact rule

The merged CEQR-006 receipt is a **historical artifact**.

This slice does **not** edit or rewrite:

- `docs/agent-runs/receipts/CONTRADICTION-CONFIDENCE-CALIBRATION-001/11-next-slice-boundary.md`
- any other merged CEQR-001…CEQR-006 receipt

Reconciliation is recorded only in this persistence-wiring receipt set.

## Sequence after this slice

1. CEQR-001 … CEQR-006 — landed (historical)
2. **CONTRADICTION-PERSISTENCE-WIRING-001** — this slice (capability only; not live-wired)
3. **CEQR-007** — contradiction duplicate prevention (next numbered campaign slice)
4. Later presentation / natural-entry slices remain blocked
