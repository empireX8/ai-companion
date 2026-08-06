# ORVEK SUBSYSTEM ORDER AND EXPECTED INCOMPLETENESS 001

**Status:** controlling execution ledger
**Date:** 2026-07-31
**Repository:** `empireX8/ai-companion`
**Base branch:** `staging`
**Purpose:** define one objective subsystem order, the current status of every major subsystem, the behaviour expected while later subsystems remain unbuilt, and the exact boundary between `NOT BUILT` and `BROKEN`.

This ledger controls implementation ordering and capability classification after Canonical Model Authority V1. It does not replace the detailed object, schema, transaction, projection, or Inspector contracts. It reconciles those contracts into one operational sequence.

## 1. Controlling sources

This ledger incorporates and orders the relevant accepted repository records:

- `docs/audits/FULL-ORVEK-LIVE-DATA-INTELLIGENCE-ARCHITECTURE-AUDIT-001.md`
- `docs/audits/FULL-ORVEK-WHOLE-PRODUCT-TRUTH-COHERENCE-AUDIT-001.md`
- `docs/architecture/ORVEK-INTELLIGENCE-OBJECT-AUTHORITY-001.json`
- `docs/architecture/ORVEK-CANONICAL-MODELUPDATE-INSPECTOR-READER-CONTRACT-001.md`
- `docs/architecture/ORVEK-CANONICAL-INSPECTOR-DRILLDOWN-CONTRACT-001.md`
- `docs/agent-runs/receipts/ORVEK-CANONICAL-MODEL-AUTHORITY-V1/00-final-receipt.md`

Where an older roadmap conflicts with a later accepted implementation or contract, the later accepted state is controlling. This ledger must be updated whenever a subsystem status changes.

## 2. Core distinction: unfinished versus defective

### 2.1 `NOT_BUILT`

A capability is `NOT_BUILT` when its controlling subsystem has not passed its exit gate.

Expected behaviour is one of:

- the control is disabled;
- the control is hidden by the approved product boundary;
- the surface shows an honest neutral or unavailable state;
- the route fails closed with a defined unsupported result;
- the section remains empty;
- no authoritative state change is claimed.

A missing result in a declared `NOT_BUILT` pathway is not itself a defect.

### 2.2 `BROKEN`

A capability is `BROKEN` when either:

1. it is declared supported and violates its invariants; or
2. the product presents an unsupported capability as if it were supported.

Examples:

- No persistent canonical correction workflow yet: `NOT_BUILT`.
- UI says the canonical model was corrected without creating a new revision: `BROKEN`.
- Evidence relationship section remains empty because no explicit relationship exists: correct unfinished or empty behaviour.
- One evidence source is copied into receipt, supporting, context, and related-object pathways without explicit relationships: `BROKEN`.

### 2.3 No inference from visual emptiness alone

A sparse or empty section must be classified against this ledger before being treated as a bug. The controlling question is:

> Is this subsystem declared supported, and what exact output is its contract required to produce at this stage?

## 3. Status vocabulary

| Status | Meaning |
|---|---|
| `PROVEN_BOUNDED` | The declared narrow path has passed persistence, ownership, refresh, and product proof. It is not a whole-domain completion claim. |
| `SUPPORTED_PARTIAL` | Genuine behaviour exists, but named operations, objects, consumers, or rollout boundaries remain incomplete. |
| `DESIGNED_NOT_BUILT` | An accepted contract exists but runtime implementation has not passed. |
| `NOT_ACCEPTED` | Runtime implementation exists or is proposed, but violates its controlling contract or has not passed acceptance. |
| `NOT_BUILT` | No accepted implementation exists. |
| `LEGACY_COMPATIBILITY` | Existing behaviour remains for compatibility and is not canonical current truth. |
| `MASKED_OR_DISABLED` | Deliberately unavailable through the current product boundary. |
| `OPERATIONAL_UNKNOWN` | Requires deployed data, configuration, provider, or production inspection not yet completed. |

## 4. Non-negotiable construction rules

1. **Producer before consumer.** A consumer cannot be implemented until the producer emits the exact authoritative contract it needs.
2. **Authority before projection.** A screen adapter may format authoritative data; it may not create identity, meaning, relationships, evidence roles, or current truth.
3. **One active subsystem boundary.** A PR must identify one subsystem ID from this ledger. It may not silently implement a downstream subsystem.
4. **Honest incompleteness.** Missing downstream capability remains neutral, empty, disabled, masked, or unavailable. It is never simulated with fixture, padding, generic fan-out, or invented relationships.
5. **No status promotion by test count.** A subsystem changes status only when its own exit criteria pass. Broad test totals do not substitute for the required proof.
6. **Same identity after refresh.** Every persisted supported pathway must return the same authoritative object identity after hard refresh and route reopen.
7. **Explicit negative proof.** Every subsystem PR must test at least one capability that must remain unavailable because a later subsystem is not built.
8. **Ledger update rule.** A subsystem implementation PR must update this ledger in the same PR, or depend on a preceding ledger-only PR, before claiming a new supported state.

## 5. Objective subsystem order

The sequence below controls the current core Orvek product. Future specialised applications are outside this ledger.

### SUBSYS-000 — Execution ledger and capability classifier

**Status:** `SUPPORTED_PARTIAL`.

**Supported by the accepted SUBSYS-000 controls:**

- the Markdown and JSON ledgers define the controlling subsystem order and current status;
- every Orvek PR must declare exactly one active subsystem;
- the static order/scope gate checks base-branch upstream status, changed-path scope, both Git-reported rename paths, and Markdown/JSON status parity;
- properly declared non-Orvek PRs remain permitted.

**Explicitly not built by SUBSYS-000:**

- runtime semantic correctness enforcement;
- runtime result envelopes or protected selectable-object factories;
- private-data runtime enforcement;
- copy-source provenance;
- guard self-protection, base-owned validator execution, and repository-administrator resistance.

**Purpose:** provide one source for subsystem order, status, expected unavailable behaviour, defect thresholds, entrance gates, and exit proofs.

**Exit gate:**

- all major subsystems are represented;
- every subsystem has explicit current status;
- supported and unsupported behaviour is stated;
- every future PR names a subsystem ID;
- no conflicting roadmap is treated as independently controlling.

### SUBSYS-001 — Canonical Model Authority V1

**Status:** `PROVEN_BOUNDED`.

**Supported path:**

```text
existing owned UserMapConclusion
→ canonical concept registration
→ immutable revision 1
→ eligible canonical Explore strengthening proposal
→ accepted publication
→ immutable revision 2
→ current revision pointer moves
→ one canonical ModelUpdate
→ canonical product/AI projection
```

**Supported invariants:**

- stable concept identity;
- immutable accepted revisions;
- exactly one current revision pointer;
- bounded `created` and `strengthened` flow;
- exact previous/resulting revision lineage;
- ownership and cross-user isolation;
- accepted history remains readable when creation gate is disabled;
- bound legacy `UserMapConclusion` does not replace canonical current truth.

**Explicitly not supported yet:**

- mass historical backfill;
- revision 3+ product workflow;
- weaken, dispute, retire, merge, split, or broad supersession operations;
- persistent canonical correction from `Correct the model`;
- production-wide activation;
- security certification;
- canonicalisation of every intelligence family.

**Defect threshold:** this subsystem is broken only if the bounded registered-conclusion strengthening path violates its stated invariants. A missing later operation is not a SUBSYS-001 failure.

### SUBSYS-002 — Canonical ModelUpdate Inspector reader

**Status:** `PROVEN_BOUNDED`.

**Supported path:**

```text
canonical ModelUpdate id
→ authenticated server lineage verification
→ browser-safe movement projection
→ permanent Inspector shell
```

**Supported behaviour:**

- verified before and after movement;
- exact canonical lineage is resolved server-side;
- direct movement evidence and resulting-revision evidence are labelled distinctly when verified;
- canonical corruption fails closed;
- browser does not reconstruct lineage from raw authority rows.

**Explicitly not supported by this subsystem:**

- evidence object drill-down;
- canonical concept related-object drill-down;
- Map or Timeline redesign;
- canonical writes;
- navigation-policy repair.

**Expected unavailable behaviour:** related-object drill-down remains unavailable until SUBSYS-004 passes. Canonical evidence drill-down is owned by SUBSYS-003.

### SUBSYS-003 — Canonical evidence drill-down

**Status:** `PROVEN_BOUNDED`.

**Controlling contract:** `ORVEK-CANONICAL-INSPECTOR-DRILLDOWN-CONTRACT-001`, Slice A.

**Controlling architecture record:** `docs/architecture/ORVEK-CANONICAL-EVIDENCE-REFERENCE-TO-AUTHORITY-MATRIX-001.md`.

**Receipt identity decision:** `PROJECTION_ONLY` — no Receipt table or writer is authorised.

**Accepted bounded verdict:** PR #206 merged as `f4ce52045fb756ef8406d2ed8ef7aa89ab299c67` with implementation head `5b39ff6b07cbbe7c220d2cb9bc4dc22dd16f77b4`. The bounded Slice A evidence drill-down passed its exit gate. Earlier PR #192 remains superseded and must not be treated as acceptance authority.

**Supported path:**

```text
canonical ModelUpdate
→ exact independently persisted evidence relationship
→ owned eligible source
→ Inspector-safe browser projection
→ exact server-issued opaque selected evidence object
→ Back to the originating canonical ModelUpdate
```

**Required invariants:**

- evidence class identifies direct movement evidence or resulting-revision evidence from persisted target binding only;
- source identity and link role are preserved;
- one source is not manufactured into multiple semantic relationships;
- `supporting`, `conflicting`, `contextIds`, and `relatedIds` remain empty unless independently explicit;
- no permanent-shell padding creates apparent objects;
- redacted or unavailable text remains absent;
- public continuity labels are not presented as evidence meaning;
- noncanonical behaviour remains unchanged.

**Exit proof:**

- one explicit relationship produces exactly one selected evidence object;
- exact server-issued opaque identity survives;
- evidence class, source type, role, title, disclosure, provenance and recorded date survive;
- redacted/unavailable text remains absent;
- no synthetic supporting/conflicting/context/related fan-out;
- direct-movement and resulting-revision evidence are not confused;
- Back returns to the originating canonical ModelUpdate;
- hard refresh/reopen preserves authoritative relationship identity;
- noncanonical receipt behaviour remains unchanged;
- public continuity disclosure and eligibility remain unchanged;
- formal tea four-row live-shape regression PASS (`reproduces the deployed tea four-row resulting-revision live shape without fan-out`);
- producer suite PASS 10 / 10;
- focused SUBSYS-003 suite PASS 66;
- full `verify-mindlab.sh` PASS 7 / FAIL 0 / SKIP 0;
- Vitest PASS 4958;
- all remote checks PASS;
- deployed proof timestamps `2026-08-06T12:01:00.392Z` and `2026-08-06T12:10:01.713Z`;
- stable Assistant Context evidence ID `canonical-evidence-41deb4c3eaf7e498b09ec41a24cc051edba5962716b665798fbb18939a146db4`;
- Reference-item remained fail-closed redacted with null snippet.

**Expected unavailable after acceptance:**

- SUBSYS-004 related canonical-concept drill-down;
- invented satellite relationships;
- Receipt persistence;
- canonical writers;
- whole-product completion;
- production-wide readiness;
- security certification.

**Defect threshold:** positional replacement of server-issued selection identity; general public continuity labels presented as evidence meaning; source or edge fields invented by the browser; generic evidence-pool fan-out; target classification inferred rather than persisted; redacted text exposure; padding-created objects or relationships; Context evidence labelled Supporting.

### SUBSYS-004 — Canonical concept related-object drill-down

**Status:** `DESIGNED_NOT_BUILT`.

**Controlling contract:** `ORVEK-CANONICAL-INSPECTOR-DRILLDOWN-CONTRACT-001`, Slice B.

**Required path:**

```text
canonical ModelUpdate
→ explicit related canonical concept selection
→ stable concept identity
→ current revision
→ current title and current meaning
→ permanent Inspector shell
```

**Required invariants:**

- title and meaning come from the same current revision;
- stable concept identity does not change when wording changes;
- legacy seed data is historical source material only;
- missing current revision fails closed;
- browser does not reconstruct canonical lineage.

**Expected behaviour until built:**

- related canonical concept click remains unavailable or neutral;
- stale legacy title must not be used as a fallback;
- no mixed old-title/current-summary object is permitted.

### SUBSYS-005 — Complete canonical revision lifecycle

**Status:** `NOT_BUILT` beyond the bounded V1 strengthening operation.

**Operations to add through separate bounded slices:**

1. revision 3+ strengthening;
2. correction;
3. weakening/confidence reduction;
4. dispute;
5. retirement;
6. supersession;
7. concept merge/split where justified.

**Required invariant:** every accepted operation creates an immutable next revision, conditionally moves the current pointer, and creates exact movement lineage. No operation updates canonical meaning in place.

**Expected behaviour until built:**

- `Correct the model` may hand off context but must not claim persisted correction;
- reload may clear an in-memory correction handoff;
- weaken, dispute, retire, merge, and revision-3 controls remain unavailable;
- absence of these operations is not a defect.

### SUBSYS-006 — PatternClaim and contradiction canonical integration

**Status:** `SUPPORTED_PARTIAL` as specialised intelligence; `NOT_BUILT` as unified canonical concept authority.

**Order inside this subsystem:**

1. map existing identity and evidence authority;
2. define canonical registration/binding rule;
3. define revision operations appropriate to the family;
4. create one atomic writer path;
5. expose one canonical projection;
6. connect one consumer;
7. connect remaining consumers and AI context;
8. disable competing current-truth paths.

**Expected behaviour until built:**

- current specialised contradiction and pattern pathways may continue within their accepted contracts;
- they must not be described as canonical concept revisions unless registered and projected through that authority;
- discrepancies between specialised displays are defects only when they violate the existing specialised contract, not merely because canonical integration is incomplete.

### SUBSYS-007 — Investigation and Fieldwork canonical integration

**Status:** `SUPPORTED_PARTIAL` as existing objects; `NOT_BUILT` as complete canonical lifecycle.

**Required path:** open question/investigation → evidence gathering → fieldwork/observation → governed conclusion movement.

**Expected behaviour until built:**

- existing records may appear where currently supported;
- they need not revise canonical concepts automatically;
- no UI may claim an investigation or fieldwork result changed the model unless an accepted canonical transaction exists.

### SUBSYS-008 — Decision and Outcome authority

**Status:** `NOT_BUILT` as first-class governed Decision/Outcome truth.

**Required minimum:**

- durable decision identity;
- decision statement and context/tension;
- linked evidence;
- chosen direction;
- lifecycle/status;
- durable outcome;
- outcome evidence;
- later model effect through explicit movement.

**Expected behaviour until built:**

- `SurfacedAction` is not automatically a Decision;
- local React outcome success is not durable outcome authority;
- controls must remain disabled or honestly partial where durability is absent;
- static recommendations must not be labelled as completed governed decisions.

### SUBSYS-009 — Goals, Watch Fors, and Experiments

**Status:** `SUPPORTED_PARTIAL` across existing object types and UI; unified lifecycle `NOT_BUILT`.

**Required path:** current goal/question → watch-for/experiment → observed evidence → outcome → possible canonical movement.

**Expected behaviour until built:**

- existing goals, investigations, or assignments may appear independently;
- they do not automatically form one complete experiment lifecycle;
- missing automatic model effect is expected unless a canonical movement transaction is invoked.

### SUBSYS-010 — Full shared consumer parity

**Status:** `SUPPORTED_PARTIAL` for the bounded V1 concept path; `NOT_BUILT` for all intelligence families.

**Consumers:**

- Today;
- Map;
- Timeline;
- Inspector;
- What Changed;
- Explore;
- Reports;
- AI context.

**Required invariant:** every consumer reads the same authoritative object identity and current revision. A consumer may add presentation context but cannot create an alternative current truth.

**Expected behaviour until built:**

- one canonical concept family may have cross-surface parity while other families remain specialised or partial;
- whole-product parity must not be inferred from the bounded V1 proof;
- a surface lacking an unintegrated family is incomplete, not necessarily broken.

### SUBSYS-011 — Capture and ingestion

**Status:** `SUPPORTED_PARTIAL` for Explore text and some existing persistence/import substrate; broader product integration `NOT_BUILT`.

**Ordered slices:**

1. approved-shell text Capture entry;
2. durable input persistence and provenance;
3. canonical import entry connection;
4. restart-safe import processing;
5. exact upload-batch-to-derived-object lineage;
6. voice capture;
7. image/screenshot capture.

**Expected behaviour until built:**

- top-bar Capture, canonical import entry, voice, and image may be disabled, masked, or unavailable;
- existing legacy routes or backend substrate do not make the approved product control complete;
- unfinished controls must not redirect to unrelated legacy experiences merely because those routes exist.

### SUBSYS-012 — Reports, checkpoints, and Today re-entry

**Status:** `SUPPORTED_PARTIAL` for bounded canonical ModelUpdate/What Changed reading; full model reporting `NOT_BUILT`.

**Required eventual path:**

```text
all supported canonical movements
+ decision/outcome results
+ experiment observations
+ evidence changes
→ checkpoint report
→ Today re-entry
```

**Expected behaviour until built:**

- What Changed may truthfully report one bounded canonical movement;
- it must not claim to be a complete account of all model change;
- missing unmigrated families are expected until their authority and consumer integration pass.

### SUBSYS-013 — Historical migration and legacy authority shutdown

**Status:** `NOT_BUILT`.

**Required slices:**

- read-only deployed inventory;
- duplicate/orphan classification;
- controlled registration/backfill policy;
- idempotent migration;
- legacy writer disablement;
- removal of current-truth fallbacks;
- retained historical provenance;
- rollback-compatible database handling.

**Expected behaviour until built:**

- legacy and canonical records may coexist;
- registered canonical concepts must still outrank their bound legacy seeds;
- unregistered historical records are not automatically canonical;
- lack of mass backfill is expected and must be disclosed.

### SUBSYS-014 — Operational and launch hardening

**Status:** `OPERATIONAL_UNKNOWN` / `NOT_BUILT` as a full launch gate.

**Required scope:**

- deployed migration state;
- deployed row and orphan inspection;
- environment and feature-gate verification;
- provider availability and budgets;
- security review;
- performance and scaling;
- observability;
- failure recovery;
- controlled production rollout;
- rollback rehearsal.

**Expected behaviour until built:** controlled rollout claims only. No bounded subsystem proof may be represented as whole-product production readiness.

## 6. Current capability matrix

| Capability | Current classification | Expected now | Defect threshold |
|---|---|---|---|
| Eligible owned UMC → canonical revision 1 → strengthening proposal → revision 2 | `PROVEN_BOUNDED` | Exact revision and movement persistence across refresh | Wrong pointer, mutable history, duplicate movement, ownership failure, or consumer disagreement |
| Registered canonical concept current projection | `PROVEN_BOUNDED` | Current canonical revision outranks bound UMC | Any integrated consumer uses bound UMC as current truth |
| Canonical ModelUpdate Inspector summary | `PROVEN_BOUNDED` | Verified before/after and safe labels | Browser reconstructs lineage or displays mismatched lineage |
| Canonical evidence drill-down | `PROVEN_BOUNDED` | Exact opaque selection identity, class/role/disclosure survival, no synthetic fan-out | Synthetic fan-out, positional selection ids, continuity labels as evidence meaning, or false source detail |
| Evidence-object supporting/conflicting/context/related sections | `NOT_BUILT` unless explicitly projected | Empty neutral states | Populated from generic evidence without explicit relationships |
| Canonical concept related-object drill-down | `DESIGNED_NOT_BUILT` | Unavailable or neutral | Stale seed fallback or mixed revision state |
| Persistent canonical correction | `NOT_BUILT` | Honest handoff only; no persisted-success claim | UI claims model changed without new revision |
| Revision 3+, weaken, dispute, retire, merge | `NOT_BUILT` | Absent/disabled/unavailable | In-place canonical mutation or false success |
| Pattern/contradiction unified canonical lifecycle | `NOT_BUILT` | Existing specialised paths only | Presented as canonical revision authority without registration/transaction |
| Durable Decisions and Outcomes | `NOT_BUILT` | Honest partial/static/unavailable state | Local or static state presented as durable governed truth |
| Capture/import/voice/image through approved shell | `SUPPORTED_PARTIAL` / `NOT_BUILT` | Disabled, masked, or bounded existing path | Synthetic completion or routing drift |
| Full cross-surface parity for every intelligence family | `NOT_BUILT` | Bounded V1 parity only | Whole-product parity claim from one family |
| Whole-product production readiness | `NOT_BUILT` | Controlled-rollout language only | Product-wide readiness or security claim without launch gate |

## 7. Immediate execution order from current repository state

1. Accept SUBSYS-000 ledger.
2. Close or supersede PR #192; do not merge it as-is. Completed: PR #206 replaced the rejected path.
3. Reimplement SUBSYS-003 only against the existing Slice A contract and the live failing shape. Completed in PR #206.
4. Pass SUBSYS-003 exit gate before beginning SUBSYS-004. Completed; SUBSYS-003 is `PROVEN_BOUNDED`.
5. Implement SUBSYS-004 canonical concept drill-down.
6. Decide and document the first SUBSYS-005 lifecycle operation; do not implement all operations in one PR.
7. Continue family-by-family through SUBSYS-006 to SUBSYS-009.
8. Expand shared consumer parity only after each family authority passes.
9. Connect Capture/import and later capture modes without routing drift.
10. Complete reporting/re-entry, historical migration, legacy shutdown, and operational hardening in that dependency order.

## 8. Mandatory PR declaration

Every future implementation PR must include this block in its description:

```text
Subsystem: SUBSYS-XXX
Starting status:
Target status:
Upstream dependencies proven:
Supported path added or changed:
Capabilities that must remain unavailable:
Expected unavailable UI/API behaviour:
Defect threshold:
Exit proof:
Ledger update included: YES/NO
```

A PR is not reviewable if it cannot state which later capabilities must remain unavailable after merge.

## 9. Acceptance rule for sparse or surprising UI

When a tester sees an empty, duplicated, stale, disabled, or missing element:

1. identify the subsystem that owns it;
2. read its current status;
3. compare the observed result to the declared expected behaviour;
4. classify it as `EXPECTED_INCOMPLETENESS`, `ACTUAL_DEFECT`, or `OPERATIONAL_UNKNOWN`;
5. do not change architecture until the classification is supported by the controlling contract and live data.

## 10. Historical verdict on PR #192

`ACTUAL_DEFECT`, not merely expected incompleteness. Historical record only.

Reason at the time:

- SUBSYS-003 was not accepted;
- however, its accepted Slice A contract already forbade synthetic relationships;
- the PR #192 implementation presented one flat evidence pool through multiple semantic pathways;
- therefore it violated the contract rather than simply omitting an unbuilt downstream capability.

The correct unavailable state would have been empty neutral satellite sections, not repeated evidence objects.

PR #206 superseded that path and is the acceptance authority for bounded SUBSYS-003 Slice A.

## 11. What would change this order

This order changes only if repo-grounded evidence proves one of:

- an upstream subsystem is not actually proven within its declared boundary;
- a security or data-integrity defect requires immediate containment;
- a dependency currently listed as downstream is technically necessary to make an upstream invariant possible;
- an accepted product decision removes or changes a subsystem.

Frustration, visual sparsity, PR size, or the existence of reusable legacy code do not by themselves justify reordering the dependency graph.
