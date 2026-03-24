# Pattern Detection Evaluation Harness

Offline regression harness for the MindLab pattern detection pipeline.

It now has three distinct adjudication artifacts:
- `adjudication-set.jsonl`: message-level evaluation
- `adjudication-groups.jsonl`: grouped-history / claim-level evaluation
- `llm-lf-shadow-set.jsonl`: repo-local shadow LLM LF outputs for repeatable offline comparison
- `faithfulness-shadow-set.jsonl`: repo-local faithfulness baseline — pre-scored claim records for default offline faithfulness regression

## Label Schema

### `behavioral_label`
| Value | Meaning |
|---|---|
| `behavioral` | Message describes a recurring personal behavioral pattern — eligible for pattern detection |
| `non_behavioral` | Topic question, assistant-directed, filler, autobiographical event, or pasted content |

**Behavioral eligibility rules (mirrors `analyzeBehavioralEligibility`):**
- Must have first-person pronoun (I/me/my/myself)
- Must contain at least one of: habit language, self-judgment language, progress language
- Disqualifiers: question ending in `?`, assistant-directed (`can you`, `you're`), imperative start (`let me`, `tell me`, `show me`), topic query (`What is`, `How does`), pasted/structured content (code fences, URLs, stack traces), too short (<15 chars)

### `family_label`
Which pattern family the message most strongly signals. Each family is evaluated independently — a single message may carry markers for multiple families simultaneously.

| Value | Markers from |
|---|---|
| `trigger_condition` | `TRIGGER_MARKERS` in `trigger-condition-detector.ts` |
| `inner_critic` | `INNER_CRITIC_MARKERS` in `inner-critic-adapter.ts` |
| `repetitive_loop` | `REPETITIVE_LOOP_MARKERS` in `repetitive-loop-adapter.ts` |
| `recovery_stabilizer` | `RECOVERY_STABILIZER_MARKERS` in `recovery-stabilizer-adapter.ts` |
| `none` | No family markers fire, or message is non-behavioral |

**Important — RL evaluation levels:**
- Message-level: tests whether RL markers fire on the text (as for all families)
- Session-level: the real RL detector additionally requires `RL_MIN_SESSIONS` distinct sessions. Evaluated separately via the RL session gate test in `pattern-evaluator.ts`.

### `quote_label`
Whether the message text is suitable as a display quote shown to the user.

| Value | Meaning |
|---|---|
| `suitable` | Passes `isDisplaySafePatternQuote` — first-person, behavioral language, under 250 chars, not a question |
| `unsuitable` | Fails display-safe threshold — too long, question form, no behavioral language, starts with label, or pasted |
| `borderline` | Ambiguous; evaluator does not penalize either prediction |

### `should_abstain`
`true` when the system should NOT emit a behavioral signal for this message (the behavioral filter must reject it). Measures abstention rate.

### `source`
| Value | Meaning |
|---|---|
| `live_user` | Representative of real conversational user messages |
| `imported_user` | Representative of imported/pasted content that users might submit |
| `synthetic_edge_case` | Crafted to probe specific boundary conditions |

## Message-Level Dataset Composition (85 examples)

| Category | Count |
|---|---|
| trigger_condition positives | 10 |
| inner_critic positives | 10 |
| repetitive_loop positives | 8 |
| recovery_stabilizer positives | 7 |
| **Behavioral positives subtotal** | **35** |
| Topic questions (non-behavioral) | 8 |
| Assistant-directed (non-behavioral) | 7 |
| Filler/short (non-behavioral) | 5 |
| Autobiographical events (non-behavioral) | 5 |
| Pasted/structured content (non-behavioral) | 5 |
| **Non-behavioral subtotal** | **30** |
| Edge cases / boundary conditions | 20 |
| **Total** | **85** |

Edge cases span: cross-family marker overlap, messages over `MAX_QUOTE_LENGTH`, questions containing behavioral language, imperative starts, My-starting TC markers, anticipatory self-doubt, and recovery-while-looping.

## Grouped-History Dataset

`adjudication-groups.jsonl` evaluates the actual grouped detector behavior:
- threshold accumulation for TC / IC / RS
- real RL multi-session gating
- grouped abstention correctness
- quote-presence safety at claim level
- mixed-family bundle behavior

The current grouped set covers:
1. TC threshold met across multiple messages
2. TC false-positive bundle that should abstain
3. IC threshold met across multiple messages
4. IC overlap with TC
5. RS threshold met across multiple messages
6. RS false-positive ambiguous bundle
7. RL true positive across multiple sessions
8. RL false positive across one session only
9. mixed bundle with multiple families active
10. grouped bundle with a valid claim but no display-safe quote

## Running the Evaluator

```bash
npm run eval:patterns
```

Output includes:
- separate `MESSAGE-LEVEL EVALUATION` and `GROUPED / CLAIM-LEVEL EVALUATION` sections
- default `SHADOW LLM LF COMPARISON` section from the repo-local shadow dataset
- behavioral gate precision/recall/F1 (real `analyzeBehavioralEligibility`)
- per-family message-level signal metrics
- grouped family emission metrics using the real detector path
- quote precision/recall and grouped quote-presence metrics
- quote false-positive taxonomy summary
- LLM LF parse failure rate, abstention rate, disagreements, false positives, helpful catches, and overreach cases
- explicit PASS / FAIL regression gates
- machine-readable baseline report at `eval/patterns/reports/latest.json`

The evaluator command exits non-zero if any regression gate fails.

## Regression Gates

Current gates enforced by `npm run eval:patterns`:
- behavioral precision floor: `0.95`
- message-level abstention rate floor: `0.95`
- quote precision floor: `0.80`
- grouped abstention correctness floor: `0.90`
- RL single-session false positive must remain blocked
- raw self-attack quotes must never count as acceptable display-safe quotes
- LLM LF parse failure rate ceiling: `0.17`
- LLM LF malformed outputs treated as valid labels: `0`
- LLM LF authoritative/product-decision violations: `0`
- LLM LF disagreement visibility must remain on when disagreements exist
- LLM LF `trigger_condition` precision floor: `0.66`
- LLM LF `inner_critic` precision floor: `0.50`
- LLM LF abstention support: at least one abstain output preserved in the baseline
- faithfulness floor: `0.30` (calibrated to intentional mixed dataset; separate from live `0.80` floor)
- faithfulness parse failure ceiling: `0.60`
- faithfulness shadow-only: authoritative violations must be 0
- faithfulness cases visible: unfaithful and parse-failure cases must be surfaced when present
- grouped TC emission precision floor: `0.70`
- grouped TC emission recall floor: `0.60`
- grouped IC emission precision floor: `0.40` (lower floor — IC has known detection weakness)
- grouped IC emission recall floor: `0.25` (lower floor — IC has known detection weakness)
- grouped RL emission precision floor: `0.70`
- grouped RL emission recall floor: `0.70`
- grouped RS emission precision floor: `0.70`
- grouped RS emission recall floor: `0.70`
- all per-family floors are null-safe: null precision/recall (no expected positives) always passes

## LLM LF Shadow Baseline

`llm-lf-shadow-set.jsonl` is the offline protected baseline for the shadow LLM labeling function.

Hard rules:
- no live model call is required for verification
- the dataset is intentionally mixed, not flattering
- it includes agreement, abstention, parse failure, disagreement, and overreach cases
- the LLM LF remains shadow-only and non-authoritative even when its outputs are evaluated

Stored `DerivationArtifact.payload` rows of kind `pattern_llm_labeling_function` can be normalized into the same evaluator shape via `normalizePatternLlmLfArtifactPayload(...)` in `lib/pattern-llm-labeling-function.ts`.

These thresholds are baseline-protection thresholds, not idealized targets. The latest machine-readable report is the operative baseline for future phases.

## Faithfulness Shadow Baseline

`faithfulness-shadow-set.jsonl` is the offline protected baseline for evaluator-time faithfulness scoring.

Each row is an auditable `FaithfulnessClaimScore`-shaped record containing:
- `groupId` — references an adjudication group
- `family` — the pattern family being scored
- `visibleSummary` — the summary being assessed for faithfulness
- `receiptQuotes` — supporting receipt quotes from the group
- `faithful` — boolean verdict (null for parse/schema failures)
- `score` — confidence score 0..1 (null on failure)
- `rationale` — short justification
- `parseStatus` — parsed / malformed_json / schema_invalid / request_failed
- `shadowMode` — always true
- `usedForProductDecision` — always false (shadow-only)
- `notes` — optional human annotation

Hard rules:
- no live model call is required for verification (`npm run eval:patterns` uses this file directly)
- the dataset is intentionally mixed, not flattering
- it includes at least: one clearly faithful case, one clearly unfaithful case, one parse failure, one schema invalid case, and one borderline-but-accepted case
- `usedForProductDecision` is always `false` — faithfulness scoring is evaluator-time shadow-only and does not influence visible product claims
- faithfulness gates use `FAITHFULNESS_DATASET_FLOOR` (calibrated to the intentional mixed composition), not the live-scoring `FAITHFULNESS_FLOOR`

## Visible Claim Abstention Calibration (Phase 10)

`lib/eval/pattern-abstention-calibration.ts` implements an offline calibration loop that replaces fixed abstention thresholding with a measured, auditable policy.

### Calibration dataset source

Calibration candidates are drawn from `GroupResult.visibleAbstentionScores` — emitted visible-claim families that already cleared the summary gate (Layer 1). Each candidate records a deterministic abstention score from `scoreVisiblePatternClaim`.

Failure labels come from `faithfulness-shadow-set.jsonl`: a claim is "bad" when `faithful===false` OR `parseStatus!=="parsed"`. When faithfulness data is absent, `isBadClaim` defaults to `false`.

### Decision unit

One emitted visible-claim candidate per family per adjudication group — not raw message-level items.

`contradiction_drift` is not an `ActiveFamily` and cannot appear in `visibleAbstentionScores`. It bypasses the score gate in the online path and is excluded from calibration by design.

### Threshold grid

Fixed deterministic grid: `0.00, 0.05, 0.10, ..., 1.00` (21 values). No adaptive search.

### Selection rule (priority order)

1. Keep only thresholds where `failureRate <= TARGET_FAILURE_RATE` (`0.25`).
2. Among those, choose the threshold with the highest `coverageRate`.
3. Tie-breaker: lowest threshold.
4. If no threshold satisfies the target failure rate:
   - choose the threshold with the lowest `failureRate`
   - then highest `coverageRate`
   - then lowest threshold
   - `policy.fallbackUsed = true`; `selectionReason` documents the fallback path.

### Target failure rate

`CALIBRATION_TARGET_FAILURE_RATE = 0.25` — named constant in `pattern-abstention-calibration.ts`, not a magic number.

### Fallback behavior

When no calibrated policy is available (or `policy.fallbackUsed === true`), `resolveVisibleAbstentionThreshold()` in `lib/pattern-visible-claim.ts` returns `VISIBLE_ABSTENTION_THRESHOLD` (the compile-time constant, currently `0.55`).

The runtime path never reads `latest.json` directly. Calibrated threshold consumption is exclusively through the dedicated repo-local policy artifact described below.

### Live constant vs calibrated threshold

| Source | Value | When used |
|---|---|---|
| `VISIBLE_ABSTENTION_THRESHOLD` | `0.55` (compile-time) | Default; fallback when no policy or fallbackUsed=true |
| `policy.selectedThreshold` | Empirically selected | When calibration ran and satisfied the target failure rate |

### Calibration in the eval report

`EvalReport.visibleCalibration` contains:
- `rows`: per-threshold metrics table (21 rows)
- `eligibleClaims`: total calibration candidates
- `selectedThreshold`: chosen threshold (null when no eligible claims)
- `targetFailureRate`: the constant used for selection
- `selectedRow`: full metrics for the chosen threshold
- `policy`: `{ selectedThreshold, targetFailureRate, selectionReason, fallbackUsed }`

## Runtime Visible Abstention Policy Artifact (Phase 13)

`npm run eval:patterns` now writes a second repo-local artifact alongside `latest.json`:

- `eval/patterns/reports/visible-abstention-policy.json`

This is a versioned, deterministic, offline-generated runtime-consumable artifact for visible-claim threshold selection. It is derived from the already-computed calibration report plus the existing calibration regression gate outcomes. It is not a new authority surface and does not expose any product-facing certainty metadata.

Current shape:

- `version`
- `generatedAt`
- `sourceReportPath`
- `selectedThreshold`
- `targetFailureRate`
- `coverageFloor`
- `eligibleClaims`
- `fallbackUsed`
- `selectionReason`
- `calibrationGateStatus.thresholdSelected`
- `calibrationGateStatus.coverageFloorPassed`
- `calibrationGateStatus.failureTargetRespected`
- `calibrationGateStatus.dataSufficient`

Runtime consumption rules:

- use `selectedThreshold` only when the artifact parses successfully
- `selectedThreshold` must be a finite number
- `fallbackUsed` must be `false`
- all `calibrationGateStatus` booleans must be `true`
- otherwise runtime falls back to `VISIBLE_ABSTENTION_THRESHOLD`

Hard fallback cases include:

- artifact missing
- malformed JSON
- incomplete or invalid shape
- `selectedThreshold: null`
- `fallbackUsed: true`
- any failed calibration gate

This artifact is repo-local, deterministic, offline-generated, and non-authoritative beyond threshold selection. `fallbackUsed=true` means runtime must not consume the calibrated threshold.

Diagnostic helpers now make every fallback path explicit and deterministic:

- `thresholdSource`: `policy_artifact` | `constant_fallback` | `explicit_override`
- `fallbackReason`: `missing_artifact` | `malformed_json` | `invalid_shape` | `threshold_missing` | `fallback_flagged` | `failed_gate` | `constant_override`
- artifact consumption summaries expose presence, validity, consumability, gate states, selected threshold, and the final threshold actually used

## Deterministic Review Queue Export (Phase 14)

`npm run eval:patterns` now also writes review handoff artifacts:

- `eval/patterns/reports/review-queue.json`
- `eval/patterns/reports/review-queue.csv`

These artifacts are evaluator-only, shadow-only, and non-authoritative. They do not alter product behavior. Their purpose is operational handoff: turning `reviewRouting` into a stable queue a human can inspect immediately.

Each JSON queue item contains:

- `groupId`
- `priority`
- `reviewReasons`
- `emittedFamilies`
- `visibleSummaryCandidates`
- `faithfulness`
- `llmDisagreement`
- `weakSupport`
- `quoteSafe`
- `expectedAbstain`
- `expectedQuoteSafe`
- `sourceDescription`

Data sources:

- `report.reviewRouting.flaggedGroups` for membership, priority, and reasons
- grouped dataset re-evaluation from `report.datasets.groupedLevelPath` for emitted families, quote-safe state, and visible summary candidates
- `report.faithfulness.unfaithfulClaims` for per-group faithfulness status rows
- `report.llmLfComparison` plus review reasons for LLM disagreement / overreach context

Sort order is deterministic and explicit:

1. `priority`: `high` before `medium` before `low`
2. reasons by severity:
   `FAITHFULNESS_PARSE_FAILURE`
   `LOW_FAITHFULNESS`
   `LLM_HEURISTIC_DISAGREEMENT` / `LLM_OVERREACH`
   `SURFACED_WITH_WEAK_SUPPORT`
   `NO_SAFE_VISIBLE_SUMMARY`
   `LOW_VISIBLE_COVERAGE`
3. more reasons before fewer reasons
4. lexical `groupId` tie-break

Hard invariants:

- one flagged group appears exactly once
- non-flagged groups are excluded
- multi-family groups remain one queue row with embedded family data
- repeated runs with unchanged datasets produce byte-stable JSON

Audit metadata now also includes:

- per-item `priorityRank`
- per-item `reasonSeverityVector`
- per-item `sortKey`
- per-item source annotations showing whether the row was derived from review routing, faithfulness, LLM comparison, and grouped replay context
- artifact-level summary counts and completeness checks for queue coverage / ordering

## Review Resolution Ingestion Loop (Phase 15)

Phase 15 closes the evaluator-only review loop without mutating the committed gold baselines in place.

Input log:

- `eval/patterns/review-resolutions.jsonl`

Overlay outputs:

- `eval/patterns/adjudication-groups.reviewed.jsonl`
- `eval/patterns/faithfulness-shadow-reviewed.jsonl`

Optional promotion summary:

- `eval/patterns/reports/review-promotion-summary.json`

Hard invariants:

- `adjudication-groups.jsonl` is never rewritten in place
- `faithfulness-shadow-set.jsonl` is never rewritten in place
- only the reviewed overlay files are rewritten
- queue export remains evaluator-only
- resolution promotion remains evaluator-only
- runtime product behavior remains unchanged

Promotion outcomes are classified explicitly and deterministically. Current outcome taxonomy includes:

- `grouped_promoted`
- `faithfulness_promoted`
- `grouped_and_faithfulness_promoted`
- `duplicate_ignored`
- `rejected_no_promotion`
- `no_explicit_payload`
- `invalid_missing_base_group`
- supersession tracked separately via `supersededGroupedCount` and `supersededFaithfulnessCount`

### Review queue artifact wrapper

`review-queue.json` is now a top-level artifact object:

- `version`
- `generatedAt`
- `sourceReportPath`
- `groupedDatasetPath`
- `items`

`generatedAt` is the stable queue-run identity used by review provenance as `sourceQueueRun`.

### Resolution log schema

Each `review-resolutions.jsonl` row contains:

- `version`
- `sourceQueueRun`
- `reviewedAt`
- `reviewer`
- `resolutionReason`
- `groupId`
- `status`: `confirmed` | `rejected` | `modified`
- optional `groupedResolution`
- optional `faithfulnessResolutions`

Conservative promotion rule:

- only explicit `groupedResolution` payloads produce grouped overlay rows
- only explicit `faithfulnessResolutions` payloads produce faithfulness overlay rows
- `rejected` rows are logged but do not promote dataset rows
- the promoter never invents gold labels from queue state alone

### Provenance metadata

Every promoted overlay row carries:

- `sourceQueueRun`
- `reviewedAt`
- `reviewer`
- `resolutionReason`
- `resolutionStatus`

### Deterministic merge semantics

Evaluator loading merges:

- base `adjudication-groups.jsonl` + reviewed `adjudication-groups.reviewed.jsonl`
- base `faithfulness-shadow-set.jsonl` + reviewed `faithfulness-shadow-reviewed.jsonl`

Merge keys:

- grouped overlay key: `id`
- faithfulness overlay key: `groupId + ":" + family`

Overlay wins on key collision.

### Deterministic promotion semantics

Resolution-level dedupe key:

- `sourceQueueRun`
- `groupId`
- `status`
- `reviewedAt`
- `reviewer`
- `resolutionReason`

Dataset-level collision rule:

- latest `reviewedAt` wins
- tie-break by lexical JSON serialization of the full promoted row
- only one final promoted row is written per dataset key

This makes promotion idempotent and byte-stable across repeated runs with unchanged inputs.

Promotion summaries now expose explicit audit counts for:

- valid vs duplicate vs rejected resolution rows
- no-explicit-payload rows
- superseded grouped rows
- superseded faithfulness rows
- invalid missing-base-group resolutions
- per-resolution outcome classifications
- deterministic SHA-256 hashes for grouped overlay rows, faithfulness overlay rows, and the promotion summary payload

The promotion summary hashes are audit hashes over deterministic serialized payloads:

- `groupedOverlaySha256`
- `faithfulnessOverlaySha256`
- `summaryPayloadSha256`

`summaryPayloadSha256` intentionally excludes the wall-clock `generatedAt` timestamp so repeated runs with identical logical promotion results keep the same audit hash.

## Rationale Sufficiency Evaluation (Phase 16)

Phase 16 max-out strengthens rationale sufficiency into a two-axis evaluator-only check:

- faithfulness asks whether the visible summary is supported by the full enriched evidence bundle
- rationale sufficiency asks whether the selected rationale receipt bundle preserves:
  - the same visible summary
  - the same faithfulness verdict

This is evaluator-only, shadow-only, and non-authoritative. It does not change detector behavior or runtime product behavior.

Audit additions in the sufficiency layer:

- `rationaleBundleSource`: `preferred_receipts` | `matching_pair` | `ranked_fallback`
- ordered `sufficiencyReasons[]` categorizing parse failures, summary drift, faithfulness drift, missing rationale receipts, and fallback-bundle use
- report-level counters for original parse failures, rationale parse failures, preferred-bundle use, and fallback-bundle use
- inspectable claims are ordered by diagnostic severity rather than plain lexical order

### Full bundle vs rationale bundle

For each faithfulness-scored `(groupId, family)` pair, the evaluator compares:

- the full enriched evidence bundle reconstructed from grouped user-authored entries
- the selected rationale receipt bundle

When `FaithfulnessClaimScore.receiptQuotes` already exists, that bundle is used first as the primary rationale candidate. Only when it is absent or unusable does the evaluator deterministically fall back to a selected bundle from the full evidence set.

### Deterministic rationale selection

Selection policy:

- try the original `receiptQuotes` bundle first when present
- otherwise search deterministic 2-quote pairs from the full evidence bundle
- prefer the first pair that regenerates the exact same visible summary
- if no such pair exists, fall back to deterministic ranking:
  - display-safe quotes first
  - then higher deterministic quote score
  - then stable original order
- remove lexical duplicates
- no randomness

### Summary preservation

Using only the selected rationale receipts, the evaluator re-runs `generateVisiblePatternSummary(...)`.

Outcomes:

- exact same visible summary: `summaryStableFromRationale = true`
- different summary or no summary: `summaryStableFromRationale = false`
- original faithfulness parse/schema/request failure: `summaryStableFromRationale = null`

### Rationale-only faithfulness preservation

The evaluator also scores the original `visibleSummary` against the rationale receipt bundle alone, using a deterministic repo-local faithfulness comparator. This produces:

- `rationaleFaithful`
- `rationaleFaithfulnessParseStatus`
- `rationaleFaithfulnessScore`
- `faithfulnessStableFromRationale`

Rules:

- if either the original or rationale-only faithfulness row is a parse/schema/request failure, `faithfulnessStableFromRationale = null`
- otherwise `faithfulnessStableFromRationale = (rationaleFaithful === originalFaithful)`

### Final sufficiency rule

- `rationaleSufficient = null` when rationale-only faithfulness is non-parsed
- `rationaleSufficient = true` only when:
  - `summaryStableFromRationale === true`
  - `faithfulnessStableFromRationale === true`
- otherwise `rationaleSufficient = false`

### Report and denominators

`EvalReport.rationaleSufficiency` records:

- total claims considered
- scored claims
- sufficient / insufficient / parse-failure counts
- summary stability / drift counts
- faithfulness stability / drift counts
- sufficiency, summary-stability, and faithfulness-stability rates
- inspectable insufficient or failed claims

Denominators:

- `totalClaimsConsidered` tracks every faithfulness-scored pair considered
- `scoredClaims` tracks parsed original-faithful claims used for the sufficiency and faithfulness-stability floors
- parse failure ceiling is computed over `totalClaimsConsidered`

New regression gates:

- `rationale_sufficiency_floor`
- `rationale_faithfulness_stability_floor`
- `rationale_parse_failure_ceiling`
- `rationale_shadow_only`
- `rationale_insufficiency_visible`
- `rationale_summary_stability_visible`

This makes rationale-quality failures explicitly inspectable without adding any live model dependency or changing the product runtime path.

## Rationale Minimality / Comprehensiveness Evaluation (Phase 17)

Phase 17 adds a third evaluator-only layer on top of rationale sufficiency. It does not ask whether the rationale bundle is merely sufficient; it asks whether the bundle is tight and whether the non-rationale complement can still preserve the same path.

This phase is complete in bounded deterministic form. It does not attempt unbounded exhaustive search.
Remaining work belongs to future scaling/performance passes, not Phase 17 evaluation semantics.

This layer is:

- evaluator-only
- shadow-only
- deterministic
- non-authoritative

### Eligibility

A claim is eligible for Phase 17 only when:

- `originalParseStatus === "parsed"`
- `rationaleFaithfulnessParseStatus === "parsed"`
- `rationaleSufficient === true`
- `rationaleReceiptQuotes.length >= 1`

### Bounded Exhaustive Subset Search

Phase 17 max-out strengthens the earlier leave-one-out / whole-complement checks with bounded exhaustive subset search.

For each eligible claim, the evaluator now searches:

- all non-empty subsets of `rationaleReceiptQuotes`
- all non-empty subsets of `complementReceiptQuotes = fullEvidenceQuotes - rationaleReceiptQuotes`

Every candidate subset is evaluated on the same two Phase 16 axes:

- summary preservation
- rationale-only faithfulness preservation

A subset preserves the path only if it preserves both axes.

The search is deterministic:

- smaller subset size first
- then higher deterministic aggregate quote quality
- then stable original-order tie-break
- then lexical quote tie-break

`RATIONALE_SUBSET_SEARCH_MAX_QUOTES` bounds search for unusually large bundles. Repo-local rationale bundles are small enough that common cases are searched exhaustively.

When a rationale bundle or complement bundle exceeds that cap:

- subset search is skipped deterministically
- global minimality / alternative-support conclusions are marked `null` rather than inferred
- those claims are forced into inspectable output
- dedicated visibility gates ensure skipped / unknown cases remain visible

Unknown results can arise from two distinct causes:

- `subset_search_skipped`: the bundle exceeded the configured search cap
- `path_indeterminate`: subset search ran, but preservation remained unresolved for the searched subsets

Both are surfaced explicitly; neither is inferred into a false resolved value.

### Minimality Signals

The evaluator retains leave-one-out outputs because they remain useful for quote-level inspection:

- `criticalQuoteCount`
- `redundantQuoteCount`
- `minimalityRate`

It now also records global subset-search outputs:

- `rationaleSubsetSearchPerformed`
- `rationaleSubsetCountChecked`
- `minimalPreservingSubsetQuotes`
- `minimalPreservingSubsetSize`
- `rationaleGloballyMinimal`
- `smallerSupportingSubsetExists`

Skipped-search / unknown counters are also aggregated at report level:

- `rationaleSubsetSearchSkippedClaims`
- `complementSubsetSearchSkippedClaims`
- `unknownMinimalityClaims`
- `unknownAlternativeSupportClaims`
- `searchedRationaleSubsetRate`
- `searchedComplementSubsetRate`
- `unknownMinimalityRate`
- `unknownAlternativeSupportRate`

Phase 17 now treats search adequacy as a gated property, not just an inspectable note. The current repo-local dataset runs at full coverage, so adequacy floors and unknown-rate ceilings are intentionally strict.

### Quantified Non-Minimality / Alternative Support

Claim-level outputs now quantify how strong the diagnosis is:

- `rationaleQuoteCount`
- `chosenVsMinimalSubsetDelta`
- `complementVsMinimalSubsetDelta`
- `competitiveAlternativeSupport`

Interpretation:

- `chosenVsMinimalSubsetDelta > 0` means the chosen rationale is larger than the best preserving subset
- `competitiveAlternativeSupport = true` means a complement subset can preserve the path with support no larger than the chosen rationale
- `competitiveAlternativeSupport = false` means complement support exists, but only with a larger subset
- over-cap / unresolved cases remain `null`, never inferred

Interpretation:

- `rationaleGloballyMinimal = true` means no smaller rationale subset preserves both axes
- `rationaleGloballyMinimal = false` means the chosen rationale is sufficient but not minimal
- leave-one-out criticality alone is no longer treated as proof of minimality

### Alternative Support / Comprehensiveness

The evaluator still computes whole-complement behavior:

- `complementSummaryStable`
- `complementFaithfulnessStable`
- `comprehensivenessEffect`:
  - `strong`: full complement preserves neither axis
  - `partial`: full complement preserves one axis
  - `none`: full complement preserves both axes

It now also searches complement subsets and records:

- `complementSubsetSearchPerformed`
- `complementSubsetCountChecked`
- `complementSupportingSubsetExists`
- `minimalComplementSupportingSubsetQuotes`
- `minimalComplementSupportingSubsetSize`
- `alternativeSupportStrength`

Interpretation:

- `alternativeSupportStrength = "none"` means no complement subset preserves both axes
- `alternativeSupportStrength = "weak"` means some alternative non-rationale subset preserves both axes, but only with a larger bundle than the chosen rationale
- `alternativeSupportStrength = "strong"` means a complement subset preserves both axes with support no larger than the chosen rationale

This removes the earlier blind spot where the whole complement could fail even though a smaller non-rationale subset still preserved the path.

### Report and Gates

`EvalReport.rationaleMinimality` records:

- eligible claims
- minimal vs bloated claim counts
- mean minimality rate
- strong / partial / none comprehensiveness counts
- globally minimal vs non-minimal claim counts
- alternative-support vs no-alternative-support claim counts
- inspectable minimality/comprehensiveness cases

New regression gates:

- `rationale_minimality_floor`
- `rationale_minimality_visible`
- `rationale_comprehensiveness_visible`
- `rationale_minimality_shadow_only`
- `rationale_global_minimality_visible`
- `rationale_alternative_support_visible`
- `rationale_subset_search_skip_visible`
- `rationale_unknown_minimality_visible`
- `rationale_subset_search_coverage_floor`
- `rationale_complement_search_coverage_floor`
- `rationale_unknown_minimality_ceiling`
- `rationale_unknown_alternative_support_ceiling`

This makes “sufficient but non-minimal” and “sufficient but alternatively supported outside the chosen rationale” explicit in the evaluator output without changing the runtime product path.

### Regression gates added (Phase 10)

- `visible_calibration_threshold_selected`: passes if `eligibleClaims === 0` OR `selectedThreshold !== null`
- `visible_calibration_coverage_floor`: passes if `selectedCoverage === null` OR `selectedCoverage >= 0.40`
- `visible_calibration_failure_target_respected`: passes if `selectedFailureRate === null` OR `selectedFailureRate <= targetFailureRate` OR fallback is explicitly documented

## Grouped Evidence Enrichment

Grouped evaluator scoring uses an enriched receipt bundle per emitted family. Because pattern detectors emit at most one representative quote per group, `generateVisiblePatternSummary` (which requires ≥2 receipts) would otherwise produce no scoreable claims. The evaluator-time path enriches `clueQuotes` for each emitted family with all behavioral user-authored entry texts from the group. This is:

- deterministic (always the same result for the same group)
- derived from actual group entries (not invented text)
- evaluator-path only (does not affect the live product projection path)
- scoped to emitted families only (non-emitting families remain empty)

## Canonical Support-Bundle Replay (Phase 18)

Phase 18 adds a deterministic replay harness at the persisted claim boundary.

Replay takes:

- persisted `PatternClaim`
- persisted `PatternClaimEvidence[]`
- the same visible-claim support logic used for live surfacing

The canonical replayed support bundle contains:

- `summaryText`
- `evidenceCount`
- `displaySafeQuoteStatus`
- `thresholdUsed`
- `thresholdSource`
- `rationaleBundleSource`
- `supportBundleSource`
- `rationaleBundleQuotes`

Replay reuses the same repo-native seams for:

- threshold resolution
- display-safe quote computation
- visible summary generation
- surfaced / abstained decision

Completeness means the persisted state is rich enough to reconstruct that canonical support bundle. Incomplete bundles are explicit via `supportBundleComplete=false` and ordered `missingFields[]`; they are never silently treated as a clean pass.

`missingFields[]` ordering is fixed:
- `summaryText`
- `evidence`
- `replayableQuotes`
- `thresholdUsed`
- `rationaleBundleQuotes`
- `displaySafeQuoteStatus`

Divergence means persisted claim state and replayed surfaced state no longer match. Replay flags at least:

- summary mismatch
- surfaced mismatch
- evidence-count mismatch
- threshold mismatch when comparable
- display-safe mismatch when comparable
- rationale-bundle mismatch when comparable
- incomplete support bundle

Replay also emits ordered `divergenceReasons[]` with fixed values:
- `summary_mismatch`
- `surfaced_mismatch`
- `evidence_count_mismatch`
- `threshold_mismatch`
- `display_safe_mismatch`
- `rationale_bundle_mismatch`
- `support_bundle_incomplete`

Source annotations are conservative:
- `thresholdSource = "policy_artifact"` only when replay used a consumable visible-abstention policy artifact
- otherwise `thresholdSource = "constant_fallback"`
- `rationaleBundleSource = "persisted_evidence_quotes"`
- `supportBundleSource = "replay_derived"`

Replay can also be summarized in batch form for diagnostics:
- aggregate complete vs incomplete support-bundle counts
- divergence reason counts
- threshold-source counts
- missing-field counts
- surfaced vs suppressed replay counts
- contradiction-drift replay counts

Replay audit artifacts can be written deterministically to:
- `eval/patterns/reports/persisted-claim-replay.json`

Phase 18 final completion adds the standalone persisted-boundary runner:
- `scripts/replay-persisted-pattern-claims.ts`

The runner is read-only. It loads persisted `PatternClaim` plus `PatternClaimEvidence`
from the real storage boundary, reuses the existing replay seam, writes the replay
artifact, and prints a compact deterministic audit summary plus artifact SHA-256.

Defined compatibility rules:
- zero persisted claims still produce a valid deterministic empty artifact
- partial historical state stays non-comparable rather than being forced into mismatch
- no replay-only interpretation path is introduced; the live visible-claim seam is reused
- storage-boundary failures such as an unavailable local DB fail explicitly; they do not mutate persisted state

That artifact contains:
- ordered replay results
- inspectable replay slice
- replay summary
- divergence reason counts
- completeness breakdown
- threshold-source counts
- surfaced vs suppressed counts

Replay outcomes remain deterministic and ordered for inspection:
- `clean_match`
- `clean_match_partial_historical_state`
- `incomplete_support_bundle`
- `summary_drift`
- `surface_state_drift`
- `support_bundle_drift`
- `multi_drift`

This phase is deterministic, repo-local, and diagnostic only. It does not add model behavior, detector semantics, or new runtime authority.

## Grouped Per-Family Emission Regression Protection (Phase 11)

`runRegressionGates` in `lib/eval/pattern-evaluator.ts` now enforces 8 grouped emission floors — one precision gate and one recall gate per active family.

### Floor constants (in `REGRESSION_THRESHOLDS`)

| Constant | Value | Notes |
|---|---|---|
| `GROUPED_TC_PRECISION_FLOOR` | `0.70` | Calibrated to current TC baseline (1.0) with headroom |
| `GROUPED_TC_RECALL_FLOOR` | `0.60` | Calibrated to current TC baseline (0.889) with headroom |
| `GROUPED_IC_PRECISION_FLOOR` | `0.40` | Lower — IC has known detection weakness (baseline: 0.667) |
| `GROUPED_IC_RECALL_FLOOR` | `0.25` | Lower — IC has known detection weakness (baseline: 0.50) |
| `GROUPED_RL_PRECISION_FLOOR` | `0.70` | Calibrated to current RL baseline (1.0) with headroom |
| `GROUPED_RL_RECALL_FLOOR` | `0.70` | Calibrated to current RL baseline (1.0) with headroom |
| `GROUPED_RS_PRECISION_FLOOR` | `0.70` | Calibrated to current RS baseline (1.0) with headroom |
| `GROUPED_RS_RECALL_FLOOR` | `0.70` | Calibrated to current RS baseline (1.0) with headroom |

### Null-safety rule

When a family has no expected positives in the grouped dataset (`precision === null` OR `recall === null`), the corresponding gate automatically passes. This prevents false failures when the grouped dataset does not include a specific family scenario.

`contradiction_drift` is not an `ActiveFamily` and is never gated.

### Lifecycle threshold pinning (companion)

`lib/__tests__/pattern-build-gates.test.ts` now pins exact values for `STRENGTH_ADVANCEMENT_THRESHOLDS`:
- `tentative`: `evidenceRequired=1`, `minSessionSpread=1`
- `developing`: `evidenceRequired=3`, `minSessionSpread=2`
- `established`: `evidenceRequired=7`, `minSessionSpread=3`

Any change to these values requires a deliberate test update, ensuring advancement logic drift is caught immediately.

## Dataset Adequacy (Phase 12)

Phase 12 expanded the evaluation datasets from the minimal demo baselines to a level sufficient for meaningful calibration, faithfulness review, and grouped emission analysis.

### Grouped Dataset (22 bundles)

| ID | Families | Abstain | Shape |
|---|---|---|---|
| tc-group-threshold | TC | no | shutdown/go-quiet (original) |
| tc-group-abstain | — | yes | topic questions |
| tc-avoidance | TC | no | avoidance/procrastination |
| tc-people-pleasing | TC | no | people-pleasing/appeasing |
| tc-no-summary | TC | no | TC emits but no visible summary |
| ic-group-threshold | IC | no | incapability/catastrophizing (original) |
| ic-tc-overlap | TC+IC | no | IC/TC co-occurrence |
| ic-self-doubt | IC | no | self-doubt/capability-assessment |
| ic-incapability | IC | no | incapability/self-dismissal |
| ic-no-quote | IC | no | IC visible summary but no display-safe quote |
| no-display-quote | IC | no | no display-safe quote (original) |
| rl-group-multisession | RL | no | multi-session loop (original) |
| rl-multisession-b | RL | no | multi-session loop (second bundle) |
| rl-group-singlesession | — | yes | RL single-session gate blocked (original) |
| rl-insufficient-recurrence | — | yes | RL single-session gate blocked (second bundle) |
| rs-group-threshold | RS | no | follow-through/consistency (original) |
| rs-group-ambiguous | — | yes | ambiguous progress (original) |
| rs-follow-through | RS | no | follow-through/consistency |
| rs-pressure | RS | no | steady-under-pressure/de-escalation |
| rs-momentum | RS | no | momentum/progress |
| rs-fp-questions | — | yes | progress questions blocked by behavioral filter |
| mixed-bundle | TC+IC+RS | no | mixed family co-occurrence (original) |

### Faithfulness Shadow Dataset (13 records)

Coverage: TC (2), IC (2), RL (2), RS (4), mixed (3).
Cases: 6 faithful, 3 unfaithful, 2 malformed_json, 2 schema_invalid.
All records: `shadowMode=true`, `usedForProductDecision=false`.

### Calibration Data Sufficiency Gate

| Constant | Value | Purpose |
|---|---|---|
| `CALIBRATION_DATA_SUFFICIENCY_FLOOR` | `8` | Minimum eligible claims for calibration to be non-trivially small |

Gate: `visible_calibration_data_sufficient` — fails if `eligibleClaims < 8`.

Calibration-eligible claims are those that passed both the detector threshold AND the visible summary gate. After Phase 12 expansion, `eligibleClaims` should be ≥ 8 (typically ≥ 10).

### Regression gates added (Phase 12)

- `visible_calibration_data_sufficient`: passes if `eligibleClaims ≥ CALIBRATION_DATA_SUFFICIENCY_FLOOR (8)`
