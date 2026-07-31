## ORVEK EXECUTION PREFLIGHT

**Orvek applicability:** APPLICABLE
**Why not Orvek work:** NOT_APPLICABLE
**Ledger revision:** REPLACE_WITH_COMMIT_SHA_ACTUALLY_READ
**Active subsystem:** SUBSYS-NNN
**Current status:** REPLACE_WITH_LEDGER_STATUS
**Upstream proofs:** REPLACE_WITH_ACCEPTED_PR_RECEIPTS_OR_CONTRACTS
**Expected unavailable after this work:** REPLACE_WITH_CAPABILITIES_THAT_MUST_REMAIN_UNAVAILABLE
**Issue classification:** BROKEN | NOT_BUILT | OPERATIONAL_UNKNOWN | MIXED
**Controlling invariant:** REPLACE_WITH_EXACT_INVARIANT
**Permitted scope:** REPLACE_WITH_BOUNDED_SCOPE
**Prohibited scope:** REPLACE_WITH_DOWNSTREAM_OR_UNRELATED_WORK
**Exit proof:** REPLACE_WITH_REQUIRED_PROOF
**Ledger status change:** NO

> For genuinely non-Orvek work, set `Orvek applicability` to `NOT_APPLICABLE`, replace `Why not Orvek work` with a concrete reason, and leave the remaining fields unchanged. Do not use `NOT_APPLICABLE` to bypass the ledger for work touching Orvek intelligence, canonical authority, evidence, Inspector, Map, Today, Timeline, Explore, reports, capture, imports, AI context, or related infrastructure.

## What changed

- 

## Why


## Expected behaviour after merge

### Supported by this PR

- 

### Must remain unavailable or unchanged

- 

## Verification

- [ ] Relevant subsystem exit proof passed.
- [ ] At least one downstream capability was proven to remain unavailable.
- [ ] Ownership and cross-user isolation were tested where applicable.
- [ ] Refresh or route-reopen identity was tested where persistence is involved.
- [ ] `bash scripts/verify-mindlab.sh` passed, or failures are recorded precisely.
- [ ] Both subsystem ledger files were updated if `Ledger status change` is `YES`.

## Scope confirmation

- [ ] One active subsystem only.
- [ ] Producer passed before consumer implementation began.
- [ ] No fixture intelligence, padding, generic fan-out, or invented relationships.
- [ ] No downstream subsystem was silently implemented.
