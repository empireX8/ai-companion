# 10 — Tests and validation

## Focused commands

```bash
npx vitest run lib/__tests__/contradiction-persistence-plan.test.ts
npx vitest run lib/__tests__/contradiction-repaired-persistence.test.ts
```

## Related regression commands

```bash
npx vitest run \
  lib/__tests__/contradiction-dual-side-lineage.test.ts \
  lib/__tests__/contradiction-confidence-calibration.test.ts \
  lib/__tests__/contradiction-adjudication-contract.test.ts \
  lib/__tests__/objectivity-referee-interface-contract.test.ts \
  lib/__tests__/contradiction-source.test.ts \
  lib/__tests__/contradiction-materialization.test.ts \
  lib/__tests__/contradiction-detection.test.ts
```

## Other gates

```bash
npx prisma validate
npx tsc --noEmit
npm run build
npx vitest run
git diff --check
```

## Account gates

```bash
node docs/agent-runs/receipts/CONTRADICTION-PERSISTENCE-WIRING-001/readonly-account-gate.mjs \
  --label contradiction-persistence-wiring-before
node docs/agent-runs/receipts/CONTRADICTION-PERSISTENCE-WIRING-001/readonly-account-gate.mjs \
  --label contradiction-persistence-wiring-after
```

Results are recorded in `11-tests-and-validation-results.md` and `validation-summary.json`.
