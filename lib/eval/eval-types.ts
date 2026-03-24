/**
 * Evaluation Types — Phase 5 Max-Out
 *
 * Shared types for the pattern detection evaluation harness.
 * Covers message-level and grouped/claim-level evaluation.
 */

// ── Dataset schema ─────────────────────────────────────────────────────────────

export type BehavioralLabel = "behavioral" | "non_behavioral";

export type FamilyLabel =
  | "trigger_condition"
  | "inner_critic"
  | "repetitive_loop"
  | "recovery_stabilizer"
  | "none";

export type QuoteLabel = "suitable" | "unsuitable" | "borderline";

export type DataSource = "live_user" | "imported_user" | "synthetic_edge_case";

/**
 * Quote false-positive taxonomy.
 * Used to categorize why a quote was labeled unsuitable but predicted safe.
 */
export type QuoteFpCategory =
  | "raw_self_attack"        // harsh self-condemnation: "hate myself", "such a failure"
  | "too_long"               // exceeds MAX_QUOTE_LENGTH
  | "vague_or_generic"       // no behavioral language; generic enough to be misleading
  | "assistant_directed"     // addresses the assistant
  | "structured_or_pasted"   // code, logs, URLs, or transcript format
  | "borderline_first_person" // starts with My/Me/Here rather than I; or no I-start
  | "topic_or_question"      // ends with ? or is a topic query
  | "other";

export type AdjudicationEntry = {
  id: string;
  text: string;
  source: DataSource;
  behavioral_label: BehavioralLabel;
  family_label: FamilyLabel;
  quote_label: QuoteLabel;
  should_abstain: boolean;
  /** Explicit category when this entry is expected to be a quote FP. */
  quote_fp_category?: QuoteFpCategory;
  notes?: string;
};

// ── Grouped-history adjudication schema ───────────────────────────────────────

/** A single message within an adjudication group. */
export type GroupEntry = {
  text: string;
  session_id: string;
  role: "user" | "assistant";
  source: DataSource;
  /** Optional ordering index; used as createdAt proxy. */
  seq?: number;
};

/**
 * A labeled history bundle for grouped / claim-level evaluation.
 * Tests real detector threshold and session-accumulation behavior.
 */
export type AdjudicationGroup = {
  id: string;
  description: string;
  entries: GroupEntry[];
  expected_behavioral: boolean;
  expected_families: {
    trigger_condition: boolean;
    inner_critic: boolean;
    repetitive_loop: boolean;
    recovery_stabilizer: boolean;
  };
  /** True when NO family claim should be emitted for this bundle. */
  expected_abstain: boolean;
  /** True when at least one emitted clue should carry a display-safe quote. */
  expected_quote_safe: boolean;
  notes?: string;
};

// ── Message-level system output ────────────────────────────────────────────────

/**
 * Per-family marker signals — independent, not mutually exclusive.
 * All false when behavioral gate rejects the message.
 * RL here is marker-level only; session gate tested via evaluateRepetitiveLoopSessionGate.
 */
export type FamilySignals = {
  trigger_condition: boolean;
  inner_critic: boolean;
  /** Marker-level only. Real RL claim requires RL_MIN_SESSIONS distinct sessions. */
  repetitive_loop: boolean;
  recovery_stabilizer: boolean;
};

export type SystemPrediction = {
  behavioral: boolean;
  families: FamilySignals;
  quoteSafe: boolean;
};

// ── Message-level per-example result ──────────────────────────────────────────

export type ExampleResult = {
  entry: AdjudicationEntry;
  prediction: SystemPrediction;
  behavioralCorrect: boolean;
  /**
   * For family_label != "none": labeled family's signal fired AND behavioral passed.
   * For "none": no spurious family fired.
   */
  familySignalCorrect: boolean;
  quoteCorrect: boolean;
  abstainedCorrectly: boolean | null;
};

// ── Visible claim abstention scoring (evaluator-time simulation) ──────────────

/**
 * Per-family visible abstention score simulated in the evaluator.
 * Mirrors the online scoreVisiblePatternClaim() call in pattern-visible-claim.ts.
 * Only produced for families that cleared the summary gate.
 */
export type VisibleClaimScoreRecord = {
  family: ActiveFamily;
  /** Composite abstention score in [0, 1]. Higher = safer to surface. */
  score: number;
  /** True when score < VISIBLE_ABSTENTION_THRESHOLD (claim suppressed). */
  triggered: boolean;
  evidenceCount: number;
  sessionCount: number;
  hasDisplaySafeQuote: boolean;
};

/**
 * Aggregate visible abstention summary across all grouped results.
 * Written to EvalReport.visibleAbstention.
 */
export type VisibleAbstentionSummary = {
  /** Total emitted family claims that also cleared the summary gate. */
  totalEmittedClaims: number;
  /** Claims that cleared the abstention score threshold and would be surfaced. */
  totalSurfaced: number;
  /** Claims suppressed by the abstention score even though a summary existed. */
  totalAbstained: number;
  /** totalSurfaced / totalEmittedClaims — null when totalEmittedClaims === 0. */
  coverageRate: number | null;
  /** totalAbstained / totalEmittedClaims — null when totalEmittedClaims === 0. */
  abstentionRate: number | null;
  scoreDistribution: {
    min: number | null;
    max: number | null;
    mean: number | null;
  };
  /**
   * Among claims that survived visible abstention, fraction that are also faithful
   * according to evaluator-time faithfulness scoring.
   * Null when faithfulness scores are unavailable or no claims were surfaced.
   */
  conditionalFaithfulnessRate: number | null;
  /** Threshold value used to compute triggered — from VISIBLE_ABSTENTION_THRESHOLD. */
  abstentionThreshold: number;
};

// ── Grouped / claim-level result ───────────────────────────────────────────────

export type ActiveFamily =
  | "trigger_condition"
  | "inner_critic"
  | "repetitive_loop"
  | "recovery_stabilizer";

export type EmittedFamilies = Record<ActiveFamily, boolean>;

export type GroupResult = {
  group: AdjudicationGroup;
  /** True if the real behavioral filter leaves any user-authored entries. */
  behavioral: boolean;
  /** Which families the real detectors emitted claims for. */
  emittedFamilies: EmittedFamilies;
  /** True if any family emitted a claim. */
  anyClaimed: boolean;
  /** True if any emitted clue carried a display-safe quote. */
  quoteSafe: boolean;
  behavioralCorrect: boolean;
  /** All four expected families match emitted families. */
  familiesCorrect: boolean;
  abstainCorrect: boolean;
  quoteSafeCorrect: boolean;
  falsePositiveFamilies: ActiveFamily[];
  falseNegativeFamilies: ActiveFamily[];
  /** Quote strings emitted per family by the real detectors — used for faithfulness scoring. */
  clueQuotes: Record<ActiveFamily, string[]>;
  /**
   * Per-family visible abstention scores for claims that cleared the summary gate.
   * Empty for families whose clueQuotes are insufficient to generate a visible summary.
   */
  visibleAbstentionScores: VisibleClaimScoreRecord[];
  /**
   * Deterministic review routing flag computed from signals available at evaluateGroup time.
   * Faithfulness and LLM LF signals are absent here; see EvalReport.reviewRouting for the
   * enriched version that includes all signals.
   */
  reviewFlag: GroupReviewFlag;
};

// ── RL session gate result ─────────────────────────────────────────────────────

export type RlSessionGateResult = {
  rlLabeledCount: number;
  sessionCount: number;
  detectorFired: boolean;
  singleSessionGateBlocks: boolean;
};

// ── Grouped-level metrics ──────────────────────────────────────────────────────

export type FamilyEmissionStats = {
  expected: number;
  emitted: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number | null;
  recall: number | null;
};

export type GroupMetrics = {
  groupsEvaluated: number;
  behavioralExpected: number;
  behavioralPredicted: number;
  behavioralCorrect: number;
  exactFamilyMatches: number;
  abstentionTotal: number;
  abstentionCorrect: number;
  abstentionRate: number | null;
  quoteSafePredicted: number;
  quoteSafeExpected: number;
  quotePrecision: number | null;
  quoteRecall: number | null;
  quotePresenceCorrect: number;
  quotePresenceTotal: number;
  familyEmission: Record<ActiveFamily, FamilyEmissionStats>;
  falsePositiveBundles: GroupResult[];
  falseNegativeBundles: GroupResult[];
};

// ── Message-level per-family metrics ──────────────────────────────────────────

export type FamilyMetrics = {
  family: Exclude<FamilyLabel, "none">;
  precision: number | null;
  recall: number | null;
  support: number;
  predicted: number;
};

// ── Regression gates ───────────────────────────────────────────────────────────

export type RegressionGate = {
  name: string;
  description: string;
  threshold: number;
  actual: number | null;
  passed: boolean;
};

// ── Optional LLM LF comparison (shadow-mode only) ────────────────────────────

export type LlmLfLabel = "trigger_condition" | "inner_critic" | "abstain";

export type LlmLfParseStatus =
  | "parsed"
  | "malformed_json"
  | "schema_invalid"
  | "request_failed";

export type LlmLfComparisonInput = {
  entryId: string;
  modelId: string;
  promptVersion: string;
  label: LlmLfLabel;
  rationale: string;
  confidence: number | null;
  abstain: boolean;
  parseStatus: LlmLfParseStatus;
  shadowMode: boolean;
  usedForProductDecision: boolean;
  rawOutput?: string | null;
  parseError?: string | null;
  notes?: string;
};

export type LlmLfFamilyMetrics = {
  family: Exclude<LlmLfLabel, "abstain">;
  support: number;
  predicted: number;
  precision: number | null;
  recall: number | null;
};

export type LlmLfDisagreement = {
  entryId: string;
  text: string;
  goldLabel: FamilyLabel;
  heuristicLabel: LlmLfLabel;
  llmLabel: LlmLfLabel;
  parseStatus: LlmLfParseStatus;
  rationale: string;
};

export type LlmLfExample = LlmLfDisagreement;

export type LlmLfComparisonReport = {
  totalCompared: number;
  parsedCount: number;
  parseFailures: number;
  parseFailureRate: number | null;
  abstained: number;
  abstentionRate: number | null;
  disagreementCount: number;
  disagreementRate: number | null;
  malformedAcceptedCount: number;
  authoritativeViolations: number;
  helpedWhereHeuristicsAbstained: number;
  overreachedWhereHeuristicsAbstained: number;
  familyMetrics: LlmLfFamilyMetrics[];
  disagreements: LlmLfDisagreement[];
  falsePositiveExamples: LlmLfExample[];
  helpfulExamples: LlmLfExample[];
  overreachExamples: LlmLfExample[];
  parseFailureExamples: Array<{
    entryId: string;
    parseStatus: LlmLfParseStatus;
    rationale: string;
  }>;
};

// ── Faithfulness scoring (evaluator-time only) ────────────────────────────────

/**
 * Per-claim faithfulness score produced by an evaluator-time shadow pass.
 * Never used for product decisions — shadowMode is always true.
 */
export type FaithfulnessClaimScore = {
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  receiptQuotes: string[];
  /** LLM judge verdict — null when parse failed or invoker threw. */
  faithful: boolean | null;
  /** 0..1 confidence from the judge — null when not provided or parse failed. */
  score: number | null;
  /** Short justification from the judge (≤240 chars). */
  rationale: string;
  parseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed";
  shadowMode: true;
  /** Must always be false — faithfulness scoring is evaluator-time shadow only. */
  usedForProductDecision: boolean;
  /** Optional human annotation for dataset records. */
  notes?: string;
};

export type FaithfulnessReport = {
  scoredClaims: number;
  faithfulCount: number;
  unfaithfulCount: number;
  parseFailureCount: number;
  /** faithfulCount / scoredClaims — null when scoredClaims === 0. */
  faithfulRate: number | null;
  /** Claims scored unfaithful or with parse failures, for inspection. */
  unfaithfulClaims: FaithfulnessClaimScore[];
  /** Scores with usedForProductDecision=true — must always be 0. */
  authoritativeViolations: number;
  regressionGate: {
    name: "faithfulness_floor";
    threshold: number;
    actual: number | null;
    passed: boolean;
  };
};

export type RationaleSufficiencyClaimScore = {
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  fullEvidenceQuotes: string[];
  rationaleReceiptQuotes: string[];
  originalReceiptCount: number;
  rationaleReceiptCount: number;
  originalFaithful: boolean | null;
  originalParseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed";
  summaryStableFromRationale: boolean | null;
  rationaleFaithful: boolean | null;
  rationaleFaithfulnessParseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed";
  rationaleFaithfulnessScore: number | null;
  faithfulnessStableFromRationale: boolean | null;
  rationaleSufficient: boolean | null;
  rationaleBundleSource: "preferred_receipts" | "matching_pair" | "ranked_fallback";
  sufficiencyReasons: Array<
    | "original_parse_failure"
    | "rationale_parse_failure"
    | "summary_drift"
    | "faithfulness_drift"
    | "no_rationale_receipts"
    | "fallback_bundle_used"
  >;
  shadowMode: true;
  usedForProductDecision: false;
  notes?: string;
};

export type RationaleSufficiencyReport = {
  allClaims: RationaleSufficiencyClaimScore[];
  totalClaimsConsidered: number;
  scoredClaims: number;
  sufficientCount: number;
  insufficientCount: number;
  parseFailureCount: number;
  originalParseFailureClaims: number;
  rationaleParseFailureClaims: number;
  summaryStableCount: number;
  summaryDriftCount: number;
  faithfulnessStableCount: number;
  faithfulnessDriftCount: number;
  preferredReceiptBundleClaims: number;
  fallbackReceiptBundleClaims: number;
  sufficiencyRate: number | null;
  summaryStabilityRate: number | null;
  faithfulnessStabilityRate: number | null;
  inspectableClaims: RationaleSufficiencyClaimScore[];
  authoritativeViolations: number;
  regressionGate: {
    name: "rationale_sufficiency_floor";
    threshold: number;
    actual: number | null;
    passed: boolean;
  };
};

export type RationaleMinimalityLeaveOneOutCheck = {
  removedQuote: string;
  summaryStableFromRationale: boolean | null;
  faithfulnessStableFromRationale: boolean | null;
  critical: boolean | null;
};

export type RationaleMinimalityClaimScore = RationaleSufficiencyClaimScore & {
  rationaleQuoteCount: number;
  complementReceiptQuotes: string[];
  leaveOneOutChecks: RationaleMinimalityLeaveOneOutCheck[];
  criticalQuoteCount: number;
  redundantQuoteCount: number;
  minimalityRate: number | null;
  complementSummaryStable: boolean | null;
  complementFaithfulnessStable: boolean | null;
  comprehensivenessEffect: "strong" | "partial" | "none" | null;
  rationaleSubsetSearchPerformed: boolean;
  rationaleSubsetSearchOverCap: boolean;
  rationaleSearchCapUsed: number;
  rationaleSubsetCountChecked: number;
  minimalPreservingSubsetQuotes: string[];
  minimalPreservingSubsetSize: number | null;
  rationaleGloballyMinimal: boolean | null;
  smallerSupportingSubsetExists: boolean | null;
  unknownMinimalityReason: "subset_search_skipped" | "path_indeterminate" | null;
  complementSubsetSearchPerformed: boolean;
  complementSubsetSearchOverCap: boolean;
  complementSearchCapUsed: number;
  complementSubsetCountChecked: number;
  complementSupportingSubsetExists: boolean | null;
  minimalComplementSupportingSubsetQuotes: string[];
  minimalComplementSupportingSubsetSize: number | null;
  unknownAlternativeSupportReason: "subset_search_skipped" | "path_indeterminate" | null;
  chosenVsMinimalSubsetDelta: number | null;
  complementVsMinimalSubsetDelta: number | null;
  competitiveAlternativeSupport: boolean | null;
  alternativeSupportStrength: "none" | "weak" | "strong" | null;
};

export type RationaleMinimalityReport = {
  totalEligibleClaims: number;
  minimalClaims: number;
  bloatedClaims: number;
  meanMinimalityRate: number | null;
  totalRationaleSubsetChecks: number;
  totalComplementSubsetChecks: number;
  meanRationaleSubsetChecksPerClaim: number | null;
  meanComplementSubsetChecksPerClaim: number | null;
  maxRationaleSubsetChecksPerClaim: number;
  maxComplementSubsetChecksPerClaim: number;
  rationaleSubsetSearchSkippedClaims: number;
  complementSubsetSearchSkippedClaims: number;
  rationaleSubsetSearchOverCapClaims: number;
  complementSubsetSearchOverCapClaims: number;
  unknownMinimalityClaims: number;
  unknownAlternativeSupportClaims: number;
  unknownMinimalityReasonCounts: {
    subset_search_skipped: number;
    path_indeterminate: number;
  };
  unknownAlternativeSupportReasonCounts: {
    subset_search_skipped: number;
    path_indeterminate: number;
  };
  searchedRationaleSubsetRate: number | null;
  searchedComplementSubsetRate: number | null;
  unknownMinimalityRate: number | null;
  unknownAlternativeSupportRate: number | null;
  globallyMinimalClaims: number;
  nonMinimalClaims: number;
  globallyMinimalRate: number | null;
  bloatedByDeltaClaims: number;
  meanChosenVsMinimalSubsetDelta: number | null;
  alternativeSupportClaims: number;
  noAlternativeSupportClaims: number;
  alternativeSupportRate: number | null;
  competitiveAlternativeSupportClaims: number;
  nonCompetitiveAlternativeSupportClaims: number;
  competitiveAlternativeSupportRate: number | null;
  strongComprehensivenessCount: number;
  partialComprehensivenessCount: number;
  noComprehensivenessCount: number;
  skippedSearchInspectableCount: number;
  indeterminateInspectableCount: number;
  nonMinimalInspectableCount: number;
  competitiveAlternativeSupportInspectableCount: number;
  bloatedInspectableCount: number;
  inspectableClaims: RationaleMinimalityClaimScore[];
  authoritativeViolations: number;
  regressionGate: {
    name: "rationale_minimality_floor";
    threshold: number;
    actual: number | null;
    passed: boolean;
  };
};

// ── Review Routing (evaluator-time shadow, non-authoritative) ─────────────────

/**
 * Reasons a grouped pattern output is flagged for human review.
 * All signals are evaluator-time only — never used for product decisions.
 */
export type ReviewReason =
  | "LOW_VISIBLE_COVERAGE"        // score gate suppressed at least one emitted claim
  | "LOW_FAITHFULNESS"            // faithfulness judge returned false for this group
  | "FAITHFULNESS_PARSE_FAILURE"  // faithfulness judge parse failed for this group
  | "LLM_HEURISTIC_DISAGREEMENT"  // LLM LF disagrees with heuristic for a covered family
  | "LLM_OVERREACH"               // LLM LF claimed a family where heuristic abstained
  | "SURFACED_WITH_WEAK_SUPPORT"  // claim surfaced but score is near the threshold
  | "NO_SAFE_VISIBLE_SUMMARY";    // summary gate failed for at least one emitted family

export type ReviewPriority = "low" | "medium" | "high";

/**
 * Per-group review routing flag.
 * Produced deterministically from available signals; shadow-only, non-authoritative.
 */
export type GroupReviewFlag = {
  groupId: string;
  /** Families emitted by the real detectors for this group. */
  emittedFamilies: ActiveFamily[];
  review_needed: boolean;
  /** null when review_needed is false. */
  review_priority: ReviewPriority | null;
  review_reasons: ReviewReason[];
  /** True when faithfulness scores were included in the computation. */
  faithfulnessIncluded: boolean;
};

/**
 * Aggregate review routing report across all grouped results.
 * Written to EvalReport.reviewRouting.
 */
export type ReviewRoutingReport = {
  totalGroups: number;
  flaggedCount: number;
  /** flaggedCount / totalGroups — null when totalGroups === 0. */
  flaggedRate: number | null;
  priorityDistribution: Record<ReviewPriority, number>;
  reasonDistribution: Partial<Record<ReviewReason, number>>;
  flaggedGroups: GroupReviewFlag[];
  /** True when faithfulness was included in the routing computation. */
  faithfulnessIncluded: boolean;
};

export type ReviewQueueItem = {
  groupId: string;
  priority: ReviewPriority;
  priorityRank: number;
  reviewReasons: ReviewReason[];
  reasonSeverityVector: number[];
  sortKey: string;
  emittedFamilies: ActiveFamily[];
  visibleSummaryCandidates: Array<{
    family: ActiveFamily;
    summary: string | null;
    score: number | null;
    triggered: boolean | null;
  }>;
  faithfulness: {
    present: boolean;
    statuses: Array<{
      family: ActiveFamily;
      faithful: boolean | null;
      parseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed";
      score: number | null;
    }>;
    hasLowFaithfulness: boolean;
    hasParseFailure: boolean;
  };
  llmDisagreement: {
    present: boolean;
    families: string[];
    overreach: boolean;
  };
  weakSupport: boolean;
  quoteSafe: boolean;
  expectedAbstain: boolean;
  expectedQuoteSafe: boolean;
  sourceDescription: string;
  sourceAnnotations: {
    fromReviewRouting: boolean;
    fromFaithfulness: boolean;
    fromLlmComparison: boolean;
    fromGroupedReplay: boolean;
  };
};

export type ReviewQueueArtifact = {
  version: 1;
  generatedAt: string;
  sourceReportPath: string;
  groupedDatasetPath: string;
  summary: {
    totalItems: number;
    countsByPriority: Record<ReviewPriority, number>;
    countsByReason: Partial<Record<ReviewReason, number>>;
    multiFamilyItemCount: number;
    faithfulnessParseFailureItems: number;
    weakSupportItems: number;
    llmDisagreementItems: number;
    noVisibleSummaryCandidateItems: number;
    quoteSafeFalseItems: number;
  };
  completeness: {
    everyFlaggedGroupAppearsExactlyOnce: boolean;
    noNonFlaggedGroupsAppear: boolean;
    allGroupIdsResolvable: boolean;
    emittedFamilyOrderingDeterministic: boolean;
    nestedOrderingDeterministic: boolean;
    orderingChecksPassed: boolean;
  };
  items: ReviewQueueItem[];
};

export type ReviewResolutionStatus = "confirmed" | "rejected" | "modified";

export type ReviewMetadata = {
  sourceQueueRun: string;
  reviewedAt: string;
  reviewer: string;
  resolutionReason: string;
  resolutionStatus: "confirmed" | "modified";
};

export type ReviewResolutionRecord = {
  version: 1;
  sourceQueueRun: string;
  reviewedAt: string;
  reviewer: string;
  resolutionReason: string;
  groupId: string;
  status: ReviewResolutionStatus;
  groupedResolution?: {
    description?: string;
    expected_behavioral?: boolean;
    expected_families?: {
      trigger_condition: boolean;
      inner_critic: boolean;
      repetitive_loop: boolean;
      recovery_stabilizer: boolean;
    };
    expected_abstain?: boolean;
    expected_quote_safe?: boolean;
  };
  faithfulnessResolutions?: Array<{
    family: ActiveFamily;
    visibleSummary: string;
    receiptQuotes: string[];
    faithful: boolean | null;
    score: number | null;
    rationale: string;
    parseStatus: "parsed" | "malformed_json" | "schema_invalid" | "request_failed";
    notes?: string;
  }>;
};

export type ReviewResolutionOutcome =
  | "duplicate_ignored"
  | "rejected_no_promotion"
  | "grouped_promoted"
  | "faithfulness_promoted"
  | "grouped_and_faithfulness_promoted"
  | "superseded_by_newer_resolution"
  | "invalid_missing_base_group"
  | "no_explicit_payload";

export type ReviewedAdjudicationGroup = AdjudicationGroup & {
  reviewMetadata: ReviewMetadata;
};

export type ReviewedFaithfulnessClaimScore = FaithfulnessClaimScore & {
  reviewMetadata: ReviewMetadata;
};

// ── Visible claim abstention calibration ──────────────────────────────────────

/**
 * Per-threshold metrics row for visible claim abstention calibration.
 * Computed for each candidate threshold in the deterministic grid.
 */
export type VisibleCalibrationRow = {
  threshold: number;
  eligibleClaims: number;
  surfacedClaims: number;
  abstainedClaims: number;
  /** surfacedClaims / eligibleClaims — null when eligibleClaims === 0. */
  coverageRate: number | null;
  /** surfaced claims where faithful===false OR parseStatus!=="parsed". */
  failureCount: number;
  /** failureCount / surfacedClaims — null when surfacedClaims === 0. */
  failureRate: number | null;
  /** surfaced claims that are NOT marked as bad (faithful or no faithfulness data). */
  faithfulSurfacedCount: number;
  /** faithfulSurfacedCount / surfacedClaims — null when surfacedClaims === 0. */
  faithfulSurfacedRate: number | null;
};

/**
 * Selected calibration policy — the chosen threshold and the reasoning behind it.
 * Written to EvalReport and can be consumed by resolveVisibleAbstentionThreshold.
 */
export type VisibleAbstentionPolicy = {
  /** Empirically selected threshold from calibration. */
  selectedThreshold: number;
  /** Target failure rate used during selection. */
  targetFailureRate: number;
  /** Human-readable description of the selection path taken. */
  selectionReason: string;
  /**
   * True when no threshold satisfied the target failure rate and the
   * least-bad threshold was chosen instead.
   */
  fallbackUsed: boolean;
};

export type VisibleAbstentionPolicyArtifact = {
  /** Versioned artifact shape for repo-local runtime consumption. */
  version: number;
  generatedAt: string;
  sourceReportPath: string;
  selectedThreshold: number | null;
  targetFailureRate: number;
  coverageFloor: number;
  eligibleClaims: number;
  fallbackUsed: boolean;
  selectionReason: string;
  calibrationGateStatus: {
    thresholdSelected: boolean;
    coverageFloorPassed: boolean;
    failureTargetRespected: boolean;
    dataSufficient: boolean;
  };
};

/**
 * Full calibration report for visible claim abstention.
 * Written to EvalReport.visibleCalibration.
 */
export type VisibleAbstentionCalibrationReport = {
  /** Per-threshold metrics across the full grid. */
  rows: VisibleCalibrationRow[];
  /** Total emitted visible-claim candidates used for calibration. */
  eligibleClaims: number;
  /** Threshold selected by the calibration routine — null when eligibleClaims === 0. */
  selectedThreshold: number | null;
  /** Target failure rate constant used for selection. */
  targetFailureRate: number;
  /** The full row for the selected threshold — null when selectedThreshold is null. */
  selectedRow: VisibleCalibrationRow | null;
  /** Policy object for runtime consumption — null when selectedThreshold is null. */
  policy: VisibleAbstentionPolicy | null;
};

// ── Full eval report ───────────────────────────────────────────────────────────

export type EvalReport = {
  generatedAt: string;
  datasets: {
    messageLevelPath: string;
    groupedLevelPath: string;
    groupedReviewedOverlayPath: string | null;
    llmLfShadowPath: string | null;
    faithfulnessShadowPath: string | null;
    faithfulnessReviewedOverlayPath: string | null;
    reportPath: string;
  };
  totalExamples: number;
  totalGroups: number;
  sourceBreakdown: Record<DataSource, number>;
  labelBreakdown: {
    behavioral: number;
    non_behavioral: number;
    by_family: Record<FamilyLabel, number>;
    should_abstain: number;
  };

  /** Message-level behavioral gate metrics. */
  behavioral: {
    precision: number | null;
    recall: number | null;
    f1: number | null;
    predictedBehavioral: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  };

  /**
   * Message-level family signal metrics — independent, not mutually exclusive.
   * RL marker-level only; see rlSessionGate for real session-aware result.
   */
  families: FamilyMetrics[];

  /** Real two-stage RL detector (session-aware). */
  rlSessionGate: RlSessionGateResult;

  quote: {
    predictedSafe: number;
    precision: number | null;
    recall: number | null;
    abstentionOnShouldAbstain: number | null;
  };

  abstention: {
    shouldAbstainCount: number;
    correctlyAbstained: number;
    rate: number | null;
  };

  /** Quote FP counts by taxonomy category. */
  quoteFpByCategory: Record<QuoteFpCategory, number>;

  falsePredictions: {
    behavioralFP: ExampleResult[];
    familyFP: ExampleResult[];
    quoteFP: ExampleResult[];
  };

  /** Grouped / claim-level metrics using real detectors. */
  groupedMetrics: GroupMetrics;

  /** Visible claim abstention scoring — deterministic, evaluator-time simulation. */
  visibleAbstention: VisibleAbstentionSummary;

  /** Optional shadow-mode comparison of LLM LF vs heuristic LFs. */
  llmLfComparison: LlmLfComparisonReport | null;

  /** Regression gate results. */
  regressionGates: RegressionGate[];
  allRegressionGatesPassed: boolean;

  /** Optional evaluator-time faithfulness scoring — null when flag is off or no visible summaries. */
  faithfulness: FaithfulnessReport | null;

  /** Optional evaluator-time rationale sufficiency scoring — null when faithfulness scores are unavailable. */
  rationaleSufficiency: RationaleSufficiencyReport | null;

  /** Optional evaluator-time rationale minimality/comprehensiveness scoring — null when sufficiency is unavailable. */
  rationaleMinimality: RationaleMinimalityReport | null;

  /**
   * Review routing report — deterministic, evaluator-time, shadow-only.
   * Marks high-risk grouped outputs for human review using visible abstention,
   * faithfulness, and LLM LF signals. Never influences product behavior.
   * Null only when no grouped results are available.
   */
  reviewRouting: ReviewRoutingReport | null;

  /**
   * Visible claim abstention calibration — offline, deterministic, evaluator-time only.
   * Evaluates threshold candidates against adjudicated grouped outcomes.
   * Selects a calibrated threshold with known coverage/failure trade-offs.
   * Never directly influences the online path — consumed through resolveVisibleAbstentionThreshold.
   */
  visibleCalibration: VisibleAbstentionCalibrationReport | null;
};
