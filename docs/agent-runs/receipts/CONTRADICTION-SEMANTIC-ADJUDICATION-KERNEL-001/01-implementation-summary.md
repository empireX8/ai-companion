# 01 — Implementation summary

**Slice:** CEQR-001
**Result:** Shared kernel foundation + ContradictionNode adjudicator implemented; **no runtime wiring**.

## What was added

### Shared kernel (`lib/orvek-intelligence-kernel/`)

| Module | Role |
|--------|------|
| `types.ts` | Evidence context, source units, exact claims, audit, adjudication envelope |
| `contracts.ts` | Version constants + classification taxonomy |
| `model-runner.ts` | Injectable `StructuredModelRunner` + AI SDK adapter (`generateText` + `Output.object`) |
| `structured-output.ts` | Zod schema for contradiction model result |
| `evidence-validation.ts` | Deterministic span validation (zero-based, start inclusive, end exclusive) |
| `objectivity-referee.ts` | Referee interface + outcome union only |
| `index.ts` | Re-exports |

### Contradiction adjudicator

- `lib/contradiction-adjudicator.ts` — `adjudicateContradiction(...)`
- Returns validated semantic result / abstention / validation failure / model failure
- `persistenceDecision: null`; no `createCandidate: true`
- Referee defaults to `not_run`

### Tests

- `lib/__tests__/contradiction-adjudication-contract.test.ts` — matrix A–R + runtime non-wiring

## What was not changed

- `app/api/message/route.ts`
- `lib/contradiction-detection.ts`
- `lib/contradiction-materialization.ts`
- `lib/import-chatgpt.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- Existing 25 pending ContradictionNode candidates

## Shared foundation vs contradiction-only

Kernel types are reusable (source units, evidence claims, model runner, referee, audit). Contradiction adjudication is the first object-specific consumer — not a pipeline that must later be duplicated wholesale.
