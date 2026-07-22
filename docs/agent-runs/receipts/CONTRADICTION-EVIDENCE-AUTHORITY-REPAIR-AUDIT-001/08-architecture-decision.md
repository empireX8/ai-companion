# 08 — Architecture decision

## Path selected: A — NARROW STRUCTURAL REPAIR

### Why Path A
- Authoritative Side A/B `sourceId` + `sourceText` already present at adjudication time
- Persistence and Objectivity Referee consume validated semantic claims, not raw transport
- No non-contradiction kernel consumers of `contradictionModelResultSchema`
- Domain `ExactEvidenceClaim` can remain unchanged

### Rejected
- Path B: not required; no multi-consumer migration
- Path C: proposed split matches landed architecture
- Path D: not applicable; no unsafe mutation/live/DB breach

## Classification target
`PASS_WITH_DETERMINISTIC_EVIDENCE_AUTHORITY_REPAIR`

## Kernel-contract honesty (independent review correction)
- Generic kernel contract changed: **NO** — `KERNEL_CONTRACT_VERSION` remains `orvek-intelligence-kernel-v1`
- Contradiction provider transport contract changed: **YES** (schema-v2)
- Transport schema changed: **YES**
- Domain ExactEvidenceClaim shape changed: **NO**
- Kernel adjudication envelope changed: **NO**
