# 06 — Provider wiring

## Hook

`components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`

1. Parallel authenticated fetch: `fetchMapOpenContradictions()` (alongside UMC conclusions).
2. Pass `openContradictions` into `buildMapProductionDataApi`.
3. Hybrid merge applies composition-safe conflicts overlay automatically.
4. Selection: preferred URL/raw/prefixed CN id → `contradiction-<id>` rail id.
5. UMC detail fetch skipped when selection is a live contradiction (Inspector bridge owns CN fetch).
6. Loading includes open-contradiction fetch; errors → empty CN list (no fake conflicts).
7. Import live override unchanged.
8. Fixture/reference routes do not use this hook; `/dev/contradiction-map-projection` is isolated.
