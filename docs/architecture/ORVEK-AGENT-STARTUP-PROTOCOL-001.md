# ORVEK AGENT STARTUP PROTOCOL 001

**Status:** mandatory execution preflight
**Repository:** `empireX8/ai-companion`
**Base branch:** `staging`

## Purpose

The subsystem ledger is external project memory. It does not improve an AI agent's internal memory merely by existing in the repository. It becomes useful only when every Orvek engineering task begins by retrieving and applying it.

This protocol makes that retrieval mandatory.

## Mandatory preflight

Before diagnosing, planning, reviewing, writing, or merging any Orvek engineering change, the acting agent must:

1. Fetch the current `staging` version of:
   - `docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md`
   - `docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.json`
2. Fetch the current PR or branch being discussed.
3. State the active subsystem ID.
4. State its current ledger status.
5. State its proven upstream dependencies.
6. State which capabilities are expected to remain unavailable after the proposed work.
7. Classify the observed behaviour as exactly one of:
   - `SUPPORTED_AND_CORRECT`
   - `EXPECTED_NOT_BUILT`
   - `ACTUAL_CONTRACT_BREACH`
   - `OPERATIONAL_UNKNOWN`
8. Quote or reference the controlling invariant that determines that classification.
9. Refuse to start a downstream consumer when its producer exit gate has not passed.
10. Update the ledger in the same PR whenever a subsystem status genuinely changes.

No Orvek implementation plan is valid without this preflight.

## Required opening block for every Orvek engineering task

```text
ORVEK EXECUTION PREFLIGHT
Ledger revision: <commit SHA>
Active subsystem: <SUBSYS-ID and name>
Current status: <ledger status>
Upstream proofs: <passed dependencies>
Expected unavailable after this work: <capabilities>
Observed issue classification: <one allowed classification>
Controlling invariant: <exact rule>
Permitted scope: <bounded work>
Prohibited scope: <downstream or unrelated work>
```

If the agent cannot retrieve the ledger or current branch state, the classification is `OPERATIONAL_UNKNOWN`. The agent may explain the retrieval failure, but must not invent the current order or proceed from conversational memory alone.

## New-chat and handoff rule

A new conversation, context handoff, agent switch, or resumed task must be treated as having no reliable execution memory.

The agent must re-fetch the ledger and current GitHub state even when:

- the user says the plan was already agreed;
- a prior chat summary describes the subsystem;
- the agent believes it remembers the current step;
- a local document or pasted excerpt appears familiar.

Conversation history may explain intent. It cannot replace repository verification of current execution state.

## Defect-classification rule

The agent must not infer architecture failure from visual emptiness or missing functionality alone.

- A capability listed as unavailable and failing closed is `EXPECTED_NOT_BUILT`.
- A supported capability violating its invariant is `ACTUAL_CONTRACT_BREACH`.
- An unsupported capability presented as completed is `ACTUAL_CONTRACT_BREACH`.
- A conclusion requiring uninspected deployed data, flags, or provider state is `OPERATIONAL_UNKNOWN`.

## PR gate

Every Orvek PR description must include:

```text
Subsystem:
Ledger revision read:
Status before:
Status after:
Upstream exit gates relied upon:
Capabilities intentionally still unavailable:
Negative proof:
Ledger update included:
```

A PR lacking this block is not ready for review.

## Current application

For the evidence drill-down work discussed in PR #192:

- Active subsystem: `SUBSYS-003 — Canonical evidence drill-down`.
- Status: `NOT_ACCEPTED`.
- Classification: `ACTUAL_CONTRACT_BREACH`.
- Reason: one flat evidence pool is projected into multiple semantic pathways without explicit relationships, violating the Slice A contract.
- Permitted next work: correct or replace SUBSYS-003 against its contract and live-shape regression.
- Prohibited next work: SUBSYS-004 canonical concept drill-down or broader UI expansion before SUBSYS-003 passes.
