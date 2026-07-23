# 13 — Next repair slice boundary

## Not created in this task

No CEQR-020 implementation files are created here.

## Suggested next slice

- Task: `CONTRADICTION-LIVE-EVIDENCE-OFFSET-FORENSIC-REPAIR-001`
- Campaign slice: `CEQR-020`
- Must be separately named from CEQR-019
- Must **not** re-run CEQR-019
- Must **not** reuse or overwrite the CEQR-019 one-shot claim

## Offline purpose of the next slice

1. Preserve inspectable failed transport offsets without secrets.
2. Identify exact failing side and boundary characters.
3. Reproduce likely inclusive/exclusive and one-short outputs offline.
4. Determine whether provider output or deterministic validation is wrong.
5. Repair the contract without clamping, fuzzy matching, silent offset changes,
   substring fallback, or fabricated quotes.
6. Prove source authority remains code-owned.
7. Prepare a separately authorised future live proof (new claim path, new budget).

## Explicit non-goals for the next slice until authorised

- Live provider execution
- Schema weakening to obtain provider acceptance
- Production route wiring
- Real-account or real-database mutation
