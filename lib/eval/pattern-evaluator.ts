/**
 * Pattern Evaluator (Phase 5 Max-Out)
 *
 * Two evaluation levels:
 *
 * MESSAGE-LEVEL (TC, IC, RS, RL marker signal):
 *   Each adjudication entry evaluated independently.
 *   Real behavioral gate + real marker arrays, independent per-family signals.
 *   No first-match exclusion.
 *
 * GROUPED / CLAIM-LEVEL:
 *   Each adjudication group run through the full real detector pipeline.
 *   Real filterBehavioralMessages + real detectXxxClues for all four families.
 *   Tests threshold accumulation and session-aware RL behavior.
 */

import { analyzeBehavioralEligibility, filterBehavioralMessages } from "../behavioral-filter";
import { generateVisiblePatternSummary } from "../pattern-visible-summary";
import {
  isDisplaySafePatternQuote,
  scorePatternQuoteCandidate,
} from "../pattern-quote-selection";
import {
  scoreVisiblePatternClaim,
  VISIBLE_ABSTENTION_THRESHOLD,
} from "../pattern-visible-claim";
import {
  CALIBRATION_TARGET_FAILURE_RATE,
  CALIBRATION_COVERAGE_FLOOR,
  CALIBRATION_DATA_SUFFICIENCY_FLOOR,
} from "./pattern-abstention-calibration";
import {
  RATIONALE_FAITHFULNESS_STABILITY_FLOOR,
  RATIONALE_PARSE_FAILURE_CEILING,
  RATIONALE_SUFFICIENCY_FLOOR,
} from "./pattern-rationale-sufficiency";
import {
  RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR,
  RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING,
  RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING,
  RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR,
} from "./pattern-rationale-minimality";
export { computeAbstentionCalibration } from "./pattern-abstention-calibration";
import { TRIGGER_MARKERS, detectTriggerConditionClues } from "../trigger-condition-detector";
import { INNER_CRITIC_MARKERS, detectInnerCriticClues } from "../inner-critic-adapter";
import { RECOVERY_STABILIZER_MARKERS, detectRecoveryStabilizerClues } from "../recovery-stabilizer-adapter";
import {
  REPETITIVE_LOOP_MARKERS,
  detectRepetitiveLoopClues,
  RL_MIN_SESSIONS,
} from "../repetitive-loop-adapter";
import type { NormalizedHistoryEntry } from "../history-synthesis";
import type {
  AdjudicationEntry,
  AdjudicationGroup,
  ActiveFamily,
  EmittedFamilies,
  ExampleResult,
  EvalReport,
  FamilyLabel,
  FamilyMetrics,
  FaithfulnessClaimScore,
  FaithfulnessReport,
  RationaleMinimalityReport,
  RationaleSufficiencyReport,
  FamilySignals,
  GroupEntry,
  GroupMetrics,
  GroupResult,
  LlmLfComparisonInput,
  LlmLfComparisonReport,
  LlmLfDisagreement,
  LlmLfFamilyMetrics,
  LlmLfLabel,
  QuoteFpCategory,
  RegressionGate,
  RlSessionGateResult,
  SystemPrediction,
  VisibleClaimScoreRecord,
  VisibleAbstentionSummary,
  GroupReviewFlag,
  ReviewReason,
  ReviewPriority,
  ReviewRoutingReport,
  VisibleAbstentionCalibrationReport,
} from "./eval-types";

// ── Faithfulness floor ─────────────────────────────────────────────────────────

/** Minimum acceptable faithfulness rate when faithfulness scoring is active. */
export const FAITHFULNESS_FLOOR = 0.80;

/**
 * Faithfulness floor for the repo-local shadow baseline dataset.
 * Lower than FAITHFULNESS_FLOOR because the dataset intentionally includes
 * unfaithful and parse-failure cases for regression coverage.
 */
export const FAITHFULNESS_DATASET_FLOOR = 0.30;

/** Maximum acceptable parse failure rate in the faithfulness scoring baseline. */
export const FAITHFULNESS_PARSE_FAILURE_CEILING = 0.60;
export { RATIONALE_SUFFICIENCY_FLOOR, RATIONALE_PARSE_FAILURE_CEILING };

// ── Regression gate thresholds ─────────────────────────────────────────────────

export const REGRESSION_THRESHOLDS = {
  /** Behavioral gate must not let non-behavioral content through. */
  BEHAVIORAL_PRECISION_FLOOR: 0.95,
  /** Should-abstain messages must be rejected at high rate. */
  ABSTENTION_RATE_FLOOR: 0.95,
  /** Quote precision floor — of predicted-safe, fraction labeled suitable. */
  QUOTE_PRECISION_FLOOR: 0.80,
  /** Grouped bundle abstention correctness floor. */
  GROUPED_ABSTENTION_FLOOR: 0.90,
  /** LLM LF parse failures may exist in baseline, but must not exceed it. */
  LLM_PARSE_FAILURE_RATE_CEILING: 0.17,
  /** Supported-family baseline precision floors for shadow LLM LF. */
  LLM_TC_PRECISION_FLOOR: 0.66,
  LLM_IC_PRECISION_FLOOR: 0.5,
  /**
   * Max raw_self_attack quotes allowed in predicted-safe set.
   * Zero tolerance: raw self-attack must never be displayed.
   * This gate currently FAILS at baseline — documents a known open quality issue.
   */
  MAX_RAW_ATTACK_IN_SAFE_QUOTES: 0,
  /**
   * Fraction of grouped emitted claims (that cleared the summary gate) that must
   * survive the visible abstention score threshold.
   * Guards against over-suppression from miscalibrated weights.
   */
  VISIBLE_COVERAGE_FLOOR: 0.50,

  // ── Grouped per-family emission floors (Phase 11) ─────────────────────────
  // Conservative floors calibrated to current baseline — prevent silent degradation.
  /** trigger_condition grouped precision floor. */
  GROUPED_TC_PRECISION_FLOOR: 0.70,
  /** trigger_condition grouped recall floor. */
  GROUPED_TC_RECALL_FLOOR: 0.60,
  /** inner_critic grouped precision floor (lower — IC has known detection weakness). */
  GROUPED_IC_PRECISION_FLOOR: 0.40,
  /** inner_critic grouped recall floor (lower — IC has known detection weakness). */
  GROUPED_IC_RECALL_FLOOR: 0.25,
  /** repetitive_loop grouped precision floor. */
  GROUPED_RL_PRECISION_FLOOR: 0.70,
  /** repetitive_loop grouped recall floor. */
  GROUPED_RL_RECALL_FLOOR: 0.70,
  /** recovery_stabilizer grouped precision floor. */
  GROUPED_RS_PRECISION_FLOOR: 0.70,
  /** recovery_stabilizer grouped recall floor. */
  GROUPED_RS_RECALL_FLOOR: 0.70,
} as const;

// ── Review Routing ─────────────────────────────────────────────────────────────

/**
 * Score margin above VISIBLE_ABSTENTION_THRESHOLD below which a surfaced claim
 * is considered "weakly supported." Claims in [threshold, threshold + margin)
 * trigger SURFACED_WITH_WEAK_SUPPORT.
 */
export const WEAK_SUPPORT_SCORE_MARGIN = 0.15;

/**
 * Compute a per-group review routing flag from available signals.
 *
 * Called twice:
 *  1. From evaluateGroup — deterministic signals only (visible abstention, summary gate).
 *     faithfulnessScores and llmLfComparison are null → faithfulnessIncluded=false.
 *  2. From computeReviewRoutingReport — enriched with faithfulness and LLM LF signals.
 *
 * Never throws. Never makes network calls. Shadow-only, non-authoritative.
 */
export function computeGroupReviewFlag(
  groupResult: {
    group: { id: string };
    emittedFamilies: EmittedFamilies;
    visibleAbstentionScores: VisibleClaimScoreRecord[];
  },
  faithfulnessScores: FaithfulnessClaimScore[] | null = null,
  llmLfComparison: LlmLfComparisonReport | null = null
): GroupReviewFlag {
  const groupId = groupResult.group.id;
  const emittedList: ActiveFamily[] = (
    ["trigger_condition", "inner_critic", "repetitive_loop", "recovery_stabilizer"] as const
  ).filter((f) => groupResult.emittedFamilies[f]);

  const reasons: ReviewReason[] = [];

  // NO_SAFE_VISIBLE_SUMMARY: any emitted family has no score record (summary gate failed).
  if (
    emittedList.length > 0 &&
    emittedList.some(
      (f) => !groupResult.visibleAbstentionScores.some((s) => s.family === f)
    )
  ) {
    reasons.push("NO_SAFE_VISIBLE_SUMMARY");
  }

  // LOW_VISIBLE_COVERAGE: any score record was suppressed by the score gate.
  if (groupResult.visibleAbstentionScores.some((s) => s.triggered)) {
    reasons.push("LOW_VISIBLE_COVERAGE");
  }

  // SURFACED_WITH_WEAK_SUPPORT: surfaced but score is near the threshold.
  const weakCeiling = VISIBLE_ABSTENTION_THRESHOLD + WEAK_SUPPORT_SCORE_MARGIN;
  if (
    groupResult.visibleAbstentionScores.some(
      (s) => !s.triggered && s.score < weakCeiling
    )
  ) {
    reasons.push("SURFACED_WITH_WEAK_SUPPORT");
  }

  // Faithfulness signals — only when faithfulnessScores are provided.
  const faithfulnessIncluded = faithfulnessScores !== null;
  if (faithfulnessScores !== null) {
    const groupFScores = faithfulnessScores.filter((s) => s.groupId === groupId);
    if (groupFScores.some((s) => s.faithful === false)) {
      reasons.push("LOW_FAITHFULNESS");
    }
    if (groupFScores.some((s) => s.parseStatus !== "parsed")) {
      reasons.push("FAITHFULNESS_PARSE_FAILURE");
    }
  }

  // LLM LF signals — only for families covered by the LLM LF comparison (TC, IC).
  if (llmLfComparison && emittedList.length > 0) {
    const emittedLlmSet = new Set<string>(
      emittedList.filter((f) => f === "trigger_condition" || f === "inner_critic")
    );
    if (emittedLlmSet.size > 0) {
      if (
        llmLfComparison.disagreements.some(
          (d) =>
            emittedLlmSet.has(d.heuristicLabel) || emittedLlmSet.has(d.llmLabel)
        )
      ) {
        reasons.push("LLM_HEURISTIC_DISAGREEMENT");
      }
      if (
        llmLfComparison.overreachExamples.some((d) => emittedLlmSet.has(d.llmLabel))
      ) {
        reasons.push("LLM_OVERREACH");
      }
    }
  }

  const review_needed = reasons.length > 0;
  const review_priority = review_needed
    ? determineReviewPriority(reasons, groupResult.visibleAbstentionScores)
    : null;

  return {
    groupId,
    emittedFamilies: emittedList,
    review_needed,
    review_priority,
    review_reasons: reasons,
    faithfulnessIncluded,
  };
}

function determineReviewPriority(
  reasons: ReviewReason[],
  visibleAbstentionScores: VisibleClaimScoreRecord[]
): ReviewPriority {
  const hasSurfacedClaims = visibleAbstentionScores.some((s) => !s.triggered);

  // HIGH: critical failures combined with surfaced claims, or ≥3 reasons stacking.
  if (reasons.includes("LOW_FAITHFULNESS") && hasSurfacedClaims) return "high";
  if (reasons.includes("FAITHFULNESS_PARSE_FAILURE") && hasSurfacedClaims) return "high";
  if (reasons.includes("LLM_OVERREACH") && hasSurfacedClaims) return "high";
  if (reasons.length >= 3) return "high";

  // MEDIUM: LLM disagreement, weak visible support, or ≥2 reasons.
  if (reasons.includes("LLM_HEURISTIC_DISAGREEMENT")) return "medium";
  if (reasons.includes("SURFACED_WITH_WEAK_SUPPORT")) return "medium";
  if (reasons.length >= 2) return "medium";

  // LOW: single minor signal.
  return "low";
}

/**
 * Compute the aggregate review routing report across all grouped results.
 * Calls computeGroupReviewFlag for each group with the full signal set, so
 * flaggedGroups in the result include faithfulness and LLM LF signals.
 */
export function computeReviewRoutingReport(
  groupResults: GroupResult[],
  faithfulnessAllScores: FaithfulnessClaimScore[] | null = null,
  llmLfComparison: LlmLfComparisonReport | null = null
): ReviewRoutingReport {
  const flags = groupResults.map((gr) =>
    computeGroupReviewFlag(gr, faithfulnessAllScores, llmLfComparison)
  );

  const flaggedGroups = flags.filter((f) => f.review_needed);
  const flaggedCount = flaggedGroups.length;
  const totalGroups = groupResults.length;

  const priorityDistribution: Record<ReviewPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };
  const reasonDistribution: Partial<Record<ReviewReason, number>> = {};

  for (const flag of flaggedGroups) {
    if (flag.review_priority) {
      priorityDistribution[flag.review_priority]++;
    }
    for (const reason of flag.review_reasons) {
      reasonDistribution[reason] = (reasonDistribution[reason] ?? 0) + 1;
    }
  }

  return {
    totalGroups,
    flaggedCount,
    flaggedRate: totalGroups === 0 ? null : flaggedCount / totalGroups,
    priorityDistribution,
    reasonDistribution,
    flaggedGroups,
    faithfulnessIncluded: faithfulnessAllScores !== null,
  };
}

// ── Validators ─────────────────────────────────────────────────────────────────

const VALID_BEHAVIORAL_LABELS = new Set(["behavioral", "non_behavioral"]);
const VALID_FAMILY_LABELS = new Set([
  "trigger_condition",
  "inner_critic",
  "repetitive_loop",
  "recovery_stabilizer",
  "none",
]);
const VALID_QUOTE_LABELS = new Set(["suitable", "unsuitable", "borderline"]);
const VALID_SOURCES = new Set([
  "live_user",
  "imported_user",
  "synthetic_edge_case",
]);
const VALID_QUOTE_FP_CATEGORIES = new Set<string>([
  "raw_self_attack",
  "too_long",
  "vague_or_generic",
  "assistant_directed",
  "structured_or_pasted",
  "borderline_first_person",
  "topic_or_question",
  "other",
]);
const VALID_ROLES = new Set(["user", "assistant"]);

export function validateAdjudicationEntry(
  obj: unknown
): obj is AdjudicationEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const e = obj as Record<string, unknown>;
  if (typeof e["id"] !== "string" || e["id"].length === 0) return false;
  if (typeof e["text"] !== "string" || e["text"].length === 0) return false;
  if (!VALID_SOURCES.has(e["source"] as string)) return false;
  if (!VALID_BEHAVIORAL_LABELS.has(e["behavioral_label"] as string)) return false;
  if (!VALID_FAMILY_LABELS.has(e["family_label"] as string)) return false;
  if (!VALID_QUOTE_LABELS.has(e["quote_label"] as string)) return false;
  if (typeof e["should_abstain"] !== "boolean") return false;
  if (e["notes"] !== undefined && typeof e["notes"] !== "string") return false;
  if (
    e["quote_fp_category"] !== undefined &&
    !VALID_QUOTE_FP_CATEGORIES.has(e["quote_fp_category"] as string)
  )
    return false;
  return true;
}

function validateGroupEntry(obj: unknown): obj is GroupEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const e = obj as Record<string, unknown>;
  if (typeof e["text"] !== "string" || e["text"].length === 0) return false;
  if (typeof e["session_id"] !== "string" || e["session_id"].length === 0) return false;
  if (!VALID_ROLES.has(e["role"] as string)) return false;
  if (!VALID_SOURCES.has(e["source"] as string)) return false;
  if (e["seq"] !== undefined && typeof e["seq"] !== "number") return false;
  return true;
}

export function validateAdjudicationGroup(obj: unknown): obj is AdjudicationGroup {
  if (typeof obj !== "object" || obj === null) return false;
  const g = obj as Record<string, unknown>;
  if (typeof g["id"] !== "string" || g["id"].length === 0) return false;
  if (typeof g["description"] !== "string") return false;
  if (!Array.isArray(g["entries"]) || g["entries"].length === 0) return false;
  if (!(g["entries"] as unknown[]).every(validateGroupEntry)) return false;
  if (typeof g["expected_behavioral"] !== "boolean") return false;
  if (typeof g["expected_abstain"] !== "boolean") return false;
  if (typeof g["expected_quote_safe"] !== "boolean") return false;
  const ef = g["expected_families"] as Record<string, unknown>;
  if (!ef || typeof ef !== "object") return false;
  for (const k of ["trigger_condition", "inner_critic", "repetitive_loop", "recovery_stabilizer"]) {
    if (typeof ef[k] !== "boolean") return false;
  }
  if (g["notes"] !== undefined && typeof g["notes"] !== "string") return false;
  return true;
}

// ── Message-level prediction ───────────────────────────────────────────────────

const SILENT_FAMILY_SIGNALS: FamilySignals = {
  trigger_condition: false,
  inner_critic: false,
  repetitive_loop: false,
  recovery_stabilizer: false,
};

/** Test each family's real marker set independently. Multiple may return true. */
function detectFamilySignals(text: string): FamilySignals {
  return {
    trigger_condition: TRIGGER_MARKERS.some((p) => p.test(text)),
    inner_critic: INNER_CRITIC_MARKERS.some((p) => p.test(text)),
    repetitive_loop: REPETITIVE_LOOP_MARKERS.some((p) => p.test(text)),
    recovery_stabilizer: RECOVERY_STABILIZER_MARKERS.some((p) => p.test(text)),
  };
}

export function predictForEntry(entry: AdjudicationEntry): SystemPrediction {
  const { eligible } = analyzeBehavioralEligibility(entry.text);
  const families = eligible
    ? detectFamilySignals(entry.text)
    : { ...SILENT_FAMILY_SIGNALS };
  const quoteSafe = isDisplaySafePatternQuote(entry.text);
  return { behavioral: eligible, families, quoteSafe };
}

// ── Message-level per-example evaluation ──────────────────────────────────────

export function evaluateExample(entry: AdjudicationEntry): ExampleResult {
  const prediction = predictForEntry(entry);

  const behavioralCorrect =
    prediction.behavioral === (entry.behavioral_label === "behavioral");

  let familySignalCorrect: boolean;
  if (entry.family_label === "none") {
    const anyFired =
      prediction.families.trigger_condition ||
      prediction.families.inner_critic ||
      prediction.families.repetitive_loop ||
      prediction.families.recovery_stabilizer;
    familySignalCorrect = !anyFired;
  } else {
    familySignalCorrect =
      prediction.behavioral &&
      prediction.families[entry.family_label as keyof FamilySignals];
  }

  const quoteCorrect =
    entry.quote_label === "suitable"
      ? prediction.quoteSafe
      : entry.quote_label === "unsuitable"
        ? !prediction.quoteSafe
        : true;

  const abstainedCorrectly = entry.should_abstain ? !prediction.behavioral : null;

  return {
    entry,
    prediction,
    behavioralCorrect,
    familySignalCorrect,
    quoteCorrect,
    abstainedCorrectly,
  };
}

// ── Quote FP taxonomy ──────────────────────────────────────────────────────────

const RAW_SELF_ATTACK_PATTERN =
  /\b(?:hate\s+myself|such\s+a\s+(?:failure|mess|burden|disappointment)|destroy\s+everything|worthless|despise\s+myself|loathe\s+myself)\b/i;

/**
 * Classify why a quote was labeled unsuitable but predicted safe.
 * Uses explicit label if present; infers from text features otherwise.
 */
export function classifyQuoteFpCategory(
  text: string,
  explicit?: QuoteFpCategory
): QuoteFpCategory {
  if (explicit) return explicit;
  const t = text.trim();
  const s = scorePatternQuoteCandidate(t);
  if (RAW_SELF_ATTACK_PATTERN.test(t)) return "raw_self_attack";
  if (s.isTooLong) return "too_long";
  if (s.isQuestion) return "topic_or_question";
  if (s.isAssistantDirected) return "assistant_directed";
  if (s.isQuotedOrPasted) return "structured_or_pasted";
  if (s.isVague) return "vague_or_generic";
  if (!s.firstPersonOwnership) return "borderline_first_person";
  return "other";
}

// ── Message-level metrics ──────────────────────────────────────────────────────

function safeDiv(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

function f1(p: number | null, r: number | null): number | null {
  if (p === null || r === null) return null;
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

const ACTIVE_FAMILIES = [
  "trigger_condition",
  "inner_critic",
  "repetitive_loop",
  "recovery_stabilizer",
] as const;

const LLM_LF_FAMILIES = ["trigger_condition", "inner_critic"] as const;

export function deriveHeuristicLfLabel(
  prediction: SystemPrediction
): LlmLfLabel {
  if (!prediction.behavioral) return "abstain";

  const fired = LLM_LF_FAMILIES.filter(
    (family) => prediction.families[family]
  );

  if (fired.length !== 1) return "abstain";
  return fired[0];
}

export function compareLlmLfOutputs(
  entries: AdjudicationEntry[],
  outputs: LlmLfComparisonInput[]
): LlmLfComparisonReport {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const comparisonRows = outputs
    .map((output) => {
      const entry = entriesById.get(output.entryId);
      if (!entry) return null;
      const llmLabel: LlmLfLabel =
        output.parseStatus === "parsed" && !output.abstain ? output.label : "abstain";
      const heuristicLabel = deriveHeuristicLfLabel(predictForEntry(entry));
      return { entry, output, llmLabel, heuristicLabel };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const disagreements: LlmLfDisagreement[] = [];
  const falsePositiveExamples: LlmLfDisagreement[] = [];
  const helpfulExamples: LlmLfDisagreement[] = [];
  const overreachExamples: LlmLfDisagreement[] = [];
  const parseFailureExamples: Array<{
    entryId: string;
    parseStatus: import("./eval-types").LlmLfParseStatus;
    rationale: string;
  }> = [];

  const parsedCount = comparisonRows.filter(
    (row) => row.output.parseStatus === "parsed"
  ).length;
  const parseFailures = comparisonRows.length - parsedCount;
  const abstained = comparisonRows.filter((row) => row.llmLabel === "abstain").length;
  const malformedAcceptedCount = comparisonRows.filter(
    (row) => row.output.parseStatus !== "parsed" && (!row.output.abstain || row.output.label !== "abstain")
  ).length;
  const authoritativeViolations = comparisonRows.filter(
    (row) => !row.output.shadowMode || row.output.usedForProductDecision
  ).length;

  for (const row of comparisonRows) {
    if (row.output.parseStatus !== "parsed") {
      parseFailureExamples.push({
        entryId: row.entry.id,
        parseStatus: row.output.parseStatus,
        rationale: row.output.rationale,
      });
    }
    if (row.heuristicLabel !== row.llmLabel) {
      disagreements.push({
        entryId: row.entry.id,
        text: row.entry.text,
        goldLabel: row.entry.family_label,
        heuristicLabel: row.heuristicLabel,
        llmLabel: row.llmLabel,
        parseStatus: row.output.parseStatus,
        rationale: row.output.rationale,
      });
    }
    if (row.llmLabel !== "abstain" && row.entry.family_label !== row.llmLabel) {
      falsePositiveExamples.push({
        entryId: row.entry.id,
        text: row.entry.text,
        goldLabel: row.entry.family_label,
        heuristicLabel: row.heuristicLabel,
        llmLabel: row.llmLabel,
        parseStatus: row.output.parseStatus,
        rationale: row.output.rationale,
      });
    }
    if (
      row.heuristicLabel === "abstain" &&
      row.llmLabel !== "abstain" &&
      row.entry.family_label === row.llmLabel
    ) {
      helpfulExamples.push({
        entryId: row.entry.id,
        text: row.entry.text,
        goldLabel: row.entry.family_label,
        heuristicLabel: row.heuristicLabel,
        llmLabel: row.llmLabel,
        parseStatus: row.output.parseStatus,
        rationale: row.output.rationale,
      });
    }
    if (
      row.heuristicLabel === "abstain" &&
      row.llmLabel !== "abstain" &&
      row.entry.family_label !== row.llmLabel
    ) {
      overreachExamples.push({
        entryId: row.entry.id,
        text: row.entry.text,
        goldLabel: row.entry.family_label,
        heuristicLabel: row.heuristicLabel,
        llmLabel: row.llmLabel,
        parseStatus: row.output.parseStatus,
        rationale: row.output.rationale,
      });
    }
  }

  const familyMetrics: LlmLfFamilyMetrics[] = LLM_LF_FAMILIES.map((family) => {
    let support = 0;
    let predicted = 0;
    let truePositive = 0;

    for (const entry of entries) {
      if (entry.family_label === family) support++;
    }

    for (const row of comparisonRows) {
      if (row.llmLabel === family) predicted++;
      if (row.llmLabel === family && row.entry.family_label === family) truePositive++;
    }

    return {
      family,
      support,
      predicted,
      precision: safeDiv(truePositive, predicted),
      recall: safeDiv(truePositive, support),
    };
  });

  const totalCompared = comparisonRows.length;
  return {
    totalCompared,
    parsedCount,
    parseFailures,
    parseFailureRate: safeDiv(parseFailures, totalCompared),
    abstained,
    abstentionRate: safeDiv(abstained, totalCompared),
    disagreementCount: disagreements.length,
    disagreementRate: safeDiv(disagreements.length, totalCompared),
    malformedAcceptedCount,
    authoritativeViolations,
    helpedWhereHeuristicsAbstained: helpfulExamples.length,
    overreachedWhereHeuristicsAbstained: overreachExamples.length,
    familyMetrics,
    disagreements,
    falsePositiveExamples,
    helpfulExamples,
    overreachExamples,
    parseFailureExamples,
  };
}

export function computeMetrics(results: ExampleResult[]): Omit<
  EvalReport,
  | "generatedAt"
  | "datasets"
  | "totalGroups"
  | "groupedMetrics"
  | "visibleAbstention"
  | "llmLfComparison"
  | "regressionGates"
  | "allRegressionGatesPassed"
  | "faithfulness"
  | "rationaleSufficiency"
  | "rationaleMinimality"
  | "reviewRouting"
  | "visibleCalibration"
> {
  const sourceBreakdown = { live_user: 0, imported_user: 0, synthetic_edge_case: 0 };
  for (const r of results) sourceBreakdown[r.entry.source]++;

  const byFamily: Record<FamilyLabel, number> = {
    trigger_condition: 0, inner_critic: 0, repetitive_loop: 0,
    recovery_stabilizer: 0, none: 0,
  };
  let behavioralCount = 0, nonBehavioralCount = 0, shouldAbstainCount = 0;
  for (const r of results) {
    if (r.entry.behavioral_label === "behavioral") behavioralCount++;
    else nonBehavioralCount++;
    byFamily[r.entry.family_label]++;
    if (r.entry.should_abstain) shouldAbstainCount++;
  }

  let tp = 0, fp = 0, fn = 0;
  const behavioralFP: ExampleResult[] = [];
  for (const r of results) {
    const predBeh = r.prediction.behavioral;
    const labelBeh = r.entry.behavioral_label === "behavioral";
    if (predBeh && labelBeh) tp++;
    else if (predBeh && !labelBeh) { fp++; behavioralFP.push(r); }
    else if (!predBeh && labelBeh) fn++;
  }
  const behavioralPrecision = safeDiv(tp, tp + fp);
  const behavioralRecall = safeDiv(tp, tp + fn);

  const familyFP: ExampleResult[] = [];
  const families: FamilyMetrics[] = ACTIVE_FAMILIES.map((family) => {
    let fTp = 0, fFp = 0, fFn = 0;
    for (const r of results) {
      const pred = r.prediction.behavioral && r.prediction.families[family];
      const label = r.entry.family_label === family;
      if (pred && label) fTp++;
      else if (pred && !label) { fFp++; familyFP.push(r); }
      else if (!pred && label) fFn++;
    }
    return {
      family: family as Exclude<FamilyLabel, "none">,
      precision: safeDiv(fTp, fTp + fFp),
      recall: safeDiv(fTp, fTp + fFn),
      support: byFamily[family as FamilyLabel],
      predicted: fTp + fFp,
    };
  });

  const rlEntries = results
    .filter((r) => r.entry.family_label === "repetitive_loop" && r.entry.behavioral_label === "behavioral")
    .map((r) => r.entry);
  const rlSessionGate = evaluateRepetitiveLoopSessionGate(rlEntries);

  const suitableLabeled = results.filter((r) => r.entry.quote_label === "suitable");
  const predictedSafe = results.filter((r) => r.prediction.quoteSafe);
  const quoteTp = predictedSafe.filter((r) => r.entry.quote_label === "suitable").length;
  const quoteFP = predictedSafe.filter((r) => r.entry.quote_label === "unsuitable");

  const abstentionOnShouldAbstain =
    shouldAbstainCount > 0
      ? results.filter((r) => r.entry.should_abstain && r.abstainedCorrectly === true).length /
        shouldAbstainCount
      : null;

  const correctlyAbstained = results.filter((r) => r.abstainedCorrectly === true).length;

  // Quote FP taxonomy
  const quoteFpByCategory: Record<QuoteFpCategory, number> = {
    raw_self_attack: 0, too_long: 0, vague_or_generic: 0,
    assistant_directed: 0, structured_or_pasted: 0, borderline_first_person: 0,
    topic_or_question: 0, other: 0,
  };
  for (const r of quoteFP) {
    const cat = classifyQuoteFpCategory(r.entry.text, r.entry.quote_fp_category);
    quoteFpByCategory[cat]++;
  }

  return {
    totalExamples: results.length,
    sourceBreakdown,
    labelBreakdown: {
      behavioral: behavioralCount,
      non_behavioral: nonBehavioralCount,
      by_family: byFamily,
      should_abstain: shouldAbstainCount,
    },
    behavioral: {
      precision: behavioralPrecision,
      recall: behavioralRecall,
      f1: f1(behavioralPrecision, behavioralRecall),
      predictedBehavioral: tp + fp,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
    },
    families,
    rlSessionGate,
    quote: {
      predictedSafe: predictedSafe.length,
      precision: safeDiv(quoteTp, predictedSafe.length),
      recall: safeDiv(quoteTp, suitableLabeled.length),
      abstentionOnShouldAbstain,
    },
    abstention: { shouldAbstainCount, correctlyAbstained, rate: safeDiv(correctlyAbstained, shouldAbstainCount) },
    quoteFpByCategory,
    falsePredictions: { behavioralFP, familyFP, quoteFP },
  };
}

// ── RL session gate ────────────────────────────────────────────────────────────

function toHistoryEntry(
  entry: AdjudicationEntry,
  sessionId: string,
  index: number
): NormalizedHistoryEntry {
  return {
    messageId: `eval-${entry.id}`,
    sessionId,
    sessionOrigin: "APP",
    sessionStartedAt: new Date(0),
    role: "user",
    content: entry.text,
    createdAt: new Date(index * 1000),
  };
}

export function evaluateRepetitiveLoopSessionGate(
  rlEntries: AdjudicationEntry[]
): RlSessionGateResult {
  if (rlEntries.length === 0) {
    return { rlLabeledCount: 0, sessionCount: 0, detectorFired: false, singleSessionGateBlocks: true };
  }
  const sessionCount = RL_MIN_SESSIONS;
  const multi = rlEntries.map((e, i) =>
    toHistoryEntry(e, `eval-rl-session-${(i % sessionCount) + 1}`, i)
  );
  const clues = detectRepetitiveLoopClues({ userId: "eval-user", entries: multi });
  const single = rlEntries.map((e, i) =>
    toHistoryEntry(e, "eval-rl-single-session", i)
  );
  const singleClues = detectRepetitiveLoopClues({ userId: "eval-user", entries: single });
  return {
    rlLabeledCount: rlEntries.length,
    sessionCount,
    detectorFired: clues.length > 0,
    singleSessionGateBlocks: singleClues.length === 0,
  };
}

// ── Grouped / claim-level evaluation ──────────────────────────────────────────

function groupEntryToHistoryEntry(ge: GroupEntry, index: number): NormalizedHistoryEntry {
  return {
    messageId: `group-${ge.session_id}-${index}`,
    sessionId: ge.session_id,
    sessionOrigin: "APP",
    sessionStartedAt: new Date(0),
    role: ge.role,
    content: ge.text,
    createdAt: new Date((ge.seq ?? index) * 1000),
  };
}

/**
 * Evaluate a group using the real full detector pipeline.
 *
 * Steps:
 * 1. Convert group entries to NormalizedHistoryEntry
 * 2. Run real filterBehavioralMessages (determines behavioral eligibility)
 * 3. Run all four real family detectors (real thresholds + real session logic)
 * 4. Compare emitted families to expected_families
 * 5. Compare abstain/quote correctness
 */
export function evaluateGroup(group: AdjudicationGroup): GroupResult {
  const entries = group.entries.map((ge, i) => groupEntryToHistoryEntry(ge, i));
  const userId = `eval-group-${group.id}`;
  const behavioralEntries = filterBehavioralMessages(entries);
  const behavioral = behavioralEntries.length > 0;

  // Mirror the real pipeline: role + behavioral filter, then family detectors.
  const tcClues = detectTriggerConditionClues({ userId, entries: behavioralEntries });
  const icClues = detectInnerCriticClues({ userId, entries: behavioralEntries });
  const rsClues = detectRecoveryStabilizerClues({ userId, entries: behavioralEntries });
  const rlClues = detectRepetitiveLoopClues({ userId, entries: behavioralEntries });

  const emittedFamilies: EmittedFamilies = {
    trigger_condition: tcClues.length > 0,
    inner_critic: icClues.length > 0,
    repetitive_loop: rlClues.length > 0,
    recovery_stabilizer: rsClues.length > 0,
  };

  const anyClaimed = Object.values(emittedFamilies).some(Boolean);

  // Quote: does any emitted clue carry a display-safe quote?
  const allClues = [...tcClues, ...icClues, ...rsClues, ...rlClues];
  const quoteSafe = allClues.some(
    (c) => c.quote !== undefined && c.quote.length > 0 && isDisplaySafePatternQuote(c.quote)
  );

  // Collect quote strings per family for evaluator-time faithfulness scoring.
  const clueQuotes: Record<ActiveFamily, string[]> = {
    trigger_condition: tcClues.flatMap((c) => (c.quote != null ? [c.quote] : [])),
    inner_critic: icClues.flatMap((c) => (c.quote != null ? [c.quote] : [])),
    repetitive_loop: rlClues.flatMap((c) => (c.quote != null ? [c.quote] : [])),
    recovery_stabilizer: rsClues.flatMap((c) => (c.quote != null ? [c.quote] : [])),
  };

  // Enrich clueQuotes for emitted families with all behavioral user entry texts.
  // Detectors emit at most one representative quote per group; generateVisiblePatternSummary
  // requires ≥2 receipts. Using all behavioral entries gives the evaluator-time scoring path
  // enough signal to generate visible summaries — deterministic, from actual group entries.
  const behavioralUserTexts = behavioralEntries
    .filter((e) => e.role === "user")
    .map((e) => e.content);
  for (const f of ACTIVE_FAMILIES) {
    if (!emittedFamilies[f]) continue;
    const existing = new Set(clueQuotes[f]);
    const additional = behavioralUserTexts.filter((t) => !existing.has(t));
    if (additional.length > 0) {
      clueQuotes[f] = [...clueQuotes[f], ...additional];
    }
  }

  // Simulate the online visible abstention score for each emitted family.
  // Only scored for families whose clueQuotes produce a non-null visible summary
  // (mirrors the layered decision in projectVisiblePatternClaim).
  const groupSessionCount = new Set(group.entries.map((e) => e.session_id)).size;
  const visibleAbstentionScores: VisibleClaimScoreRecord[] = [];
  for (const f of ACTIVE_FAMILIES) {
    if (!emittedFamilies[f]) continue;
    const quotes = clueQuotes[f];
    // Layer 1 check: would the summary gate pass?
    const summaryReceipts = quotes.map((q) => ({ quote: q }));
    const candidateSummary = generateVisiblePatternSummary({
      patternType: f,
      persistedSummary: "",
      receipts: summaryReceipts,
    });
    if (!candidateSummary) continue; // hard abstain; no score record
    // Layer 2: compute deterministic abstention score.
    const hasDisplaySafeQuote = quotes.some((q) => isDisplaySafePatternQuote(q));
    const { score, triggered } = scoreVisiblePatternClaim({
      evidenceCount: quotes.length,
      sessionCount: groupSessionCount,
      hasDisplaySafeQuote,
    });
    visibleAbstentionScores.push({
      family: f,
      score,
      triggered,
      evidenceCount: quotes.length,
      sessionCount: groupSessionCount,
      hasDisplaySafeQuote,
    });
  }

  const ef = group.expected_families;
  const behavioralCorrect = behavioral === group.expected_behavioral;
  const familiesCorrect =
    emittedFamilies.trigger_condition === ef.trigger_condition &&
    emittedFamilies.inner_critic === ef.inner_critic &&
    emittedFamilies.repetitive_loop === ef.repetitive_loop &&
    emittedFamilies.recovery_stabilizer === ef.recovery_stabilizer;

  const abstainCorrect = group.expected_abstain === !anyClaimed;
  const quoteSafeCorrect = group.expected_quote_safe === quoteSafe;

  const falsePositiveFamilies = ACTIVE_FAMILIES.filter(
    (f) => emittedFamilies[f] && !ef[f]
  );
  const falseNegativeFamilies = ACTIVE_FAMILIES.filter(
    (f) => !emittedFamilies[f] && ef[f]
  );

  // Compute deterministic review flag from signals available at evaluation time.
  // Faithfulness and LLM LF signals are absent here; see computeReviewRoutingReport.
  const reviewFlag = computeGroupReviewFlag(
    { group, emittedFamilies, visibleAbstentionScores }
  );

  return {
    group,
    behavioral,
    emittedFamilies,
    anyClaimed,
    quoteSafe,
    behavioralCorrect,
    familiesCorrect,
    abstainCorrect,
    quoteSafeCorrect,
    falsePositiveFamilies,
    falseNegativeFamilies,
    clueQuotes,
    visibleAbstentionScores,
    reviewFlag,
  };
}

export function computeGroupMetrics(results: GroupResult[]): GroupMetrics {
  const familyEmission = {} as Record<ActiveFamily, import("./eval-types").FamilyEmissionStats>;
  for (const fam of ACTIVE_FAMILIES) {
    let expected = 0, emitted = 0, fTp = 0, fFp = 0, fFn = 0;
    for (const r of results) {
      const exp = r.group.expected_families[fam];
      const em = r.emittedFamilies[fam];
      if (exp) expected++;
      if (em) emitted++;
      if (exp && em) fTp++;
      else if (!exp && em) fFp++;
      else if (exp && !em) fFn++;
    }
    familyEmission[fam] = {
      expected, emitted,
      truePositive: fTp, falsePositive: fFp, falseNegative: fFn,
      precision: safeDiv(fTp, fTp + fFp),
      recall: safeDiv(fTp, fTp + fFn),
    };
  }

  const abstentionTotal = results.filter((r) => r.group.expected_abstain).length;
  const abstentionCorrect = results.filter((r) => r.group.expected_abstain && !r.anyClaimed).length;
  const quoteSafeExpected = results.filter((r) => r.group.expected_quote_safe).length;
  const quoteSafePredicted = results.filter((r) => r.quoteSafe).length;
  const quoteSafeTruePositive = results.filter(
    (r) => r.group.expected_quote_safe && r.quoteSafe
  ).length;

  return {
    groupsEvaluated: results.length,
    behavioralExpected: results.filter((r) => r.group.expected_behavioral).length,
    behavioralPredicted: results.filter((r) => r.behavioral).length,
    behavioralCorrect: results.filter((r) => r.behavioralCorrect).length,
    exactFamilyMatches: results.filter((r) => r.familiesCorrect).length,
    abstentionTotal,
    abstentionCorrect,
    abstentionRate: safeDiv(abstentionCorrect, abstentionTotal),
    quoteSafePredicted,
    quoteSafeExpected,
    quotePrecision: safeDiv(quoteSafeTruePositive, quoteSafePredicted),
    quoteRecall: safeDiv(quoteSafeTruePositive, quoteSafeExpected),
    quotePresenceCorrect: results.filter((r) => r.quoteSafeCorrect).length,
    quotePresenceTotal: results.length,
    familyEmission,
    falsePositiveBundles: results.filter((r) => r.falsePositiveFamilies.length > 0),
    falseNegativeBundles: results.filter((r) => r.falseNegativeFamilies.length > 0),
  };
}

// ── Visible claim abstention summary ──────────────────────────────────────────

/**
 * Aggregate visible abstention scores from all group results into a summary
 * suitable for EvalReport.visibleAbstention.
 *
 * Only covers families that cleared the summary gate (visibleAbstentionScores
 * entries are produced only when generateVisiblePatternSummary returned non-null).
 *
 * When faithfulnessAllScores is provided, computes conditionalFaithfulnessRate:
 * the faithfulness rate restricted to claims that also survived the score threshold.
 */
export function computeVisibleAbstentionSummary(
  groupResults: GroupResult[],
  faithfulnessAllScores: FaithfulnessClaimScore[] | null = null
): VisibleAbstentionSummary {
  const allScores = groupResults.flatMap((r) => r.visibleAbstentionScores);
  const totalEmittedClaims = allScores.length;
  const totalSurfaced = allScores.filter((s) => !s.triggered).length;
  const totalAbstained = allScores.filter((s) => s.triggered).length;

  const scoreValues = allScores.map((s) => s.score);
  const min = scoreValues.length > 0 ? Math.min(...scoreValues) : null;
  const max = scoreValues.length > 0 ? Math.max(...scoreValues) : null;
  const mean =
    scoreValues.length > 0
      ? scoreValues.reduce((acc, v) => acc + v, 0) / scoreValues.length
      : null;

  // Conditional faithfulness: among surfaced claims, what fraction are faithful?
  let conditionalFaithfulnessRate: number | null = null;
  if (faithfulnessAllScores && faithfulnessAllScores.length > 0) {
    // Build set of surfaced keys (groupId:family)
    const surfacedKeys = new Set<string>();
    for (const gr of groupResults) {
      for (const s of gr.visibleAbstentionScores) {
        if (!s.triggered) surfacedKeys.add(`${gr.group.id}:${s.family}`);
      }
    }
    // Among faithfulness scores whose claim was surfaced, compute faithful fraction
    const surfacedFaith = faithfulnessAllScores.filter((s) =>
      surfacedKeys.has(`${s.groupId}:${s.family}`)
    );
    const surfacedFaithful = surfacedFaith.filter((s) => s.faithful === true).length;
    conditionalFaithfulnessRate =
      surfacedFaith.length > 0 ? surfacedFaithful / surfacedFaith.length : null;
  }

  return {
    totalEmittedClaims,
    totalSurfaced,
    totalAbstained,
    coverageRate: safeDiv(totalSurfaced, totalEmittedClaims),
    abstentionRate: safeDiv(totalAbstained, totalEmittedClaims),
    scoreDistribution: { min, max, mean },
    conditionalFaithfulnessRate,
    abstentionThreshold: VISIBLE_ABSTENTION_THRESHOLD,
  };
}

// ── Faithfulness scoring (evaluator-time shadow pass) ─────────────────────────

/**
 * Injectable invoker for the faithfulness shadow judge.
 * Receives the visible summary and receipt quotes; returns raw LLM output.
 * Use a mock in tests; wire to a real model via flag in the CLI.
 */
export type FaithfulnessInvoker = (args: {
  visibleSummary: string;
  receiptQuotes: string[];
}) => Promise<{ rawOutput: string }>;

export function buildFaithfulnessPrompt(args: {
  visibleSummary: string;
  receiptQuotes: string[];
}): string {
  const quotesText = args.receiptQuotes
    .map((q, i) => `  ${i + 1}. ${JSON.stringify(q)}`)
    .join("\n");
  return [
    "You are a faithfulness judge for a behavioral pattern detection system.",
    "Assess whether the summary is directly supported by the receipt quotes.",
    "",
    "Summary:",
    JSON.stringify(args.visibleSummary),
    "",
    "Receipt quotes:",
    quotesText,
    "",
    "Return strict JSON with these fields only:",
    '{"faithful":true|false,"score":0.0-1.0,"rationale":"short justification"}',
    "",
    "faithful=true  — the summary describes a pattern clearly evidenced in the quotes.",
    "faithful=false — the summary overstates, mischaracterizes, or is not grounded in the quotes.",
    "",
    "Do not include chain-of-thought.",
    "Do not include markdown fences.",
  ].join("\n");
}

export function parseFaithfulnessOutput(args: {
  rawOutput: string;
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  receiptQuotes: string[];
}): FaithfulnessClaimScore {
  const base = {
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    receiptQuotes: args.receiptQuotes,
    shadowMode: true as const,
    usedForProductDecision: false as const,
  };

  const trimmed = args.rawOutput.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return {
      ...base,
      faithful: null,
      score: null,
      rationale: "Malformed faithfulness output; shadow-mode abstain.",
      parseStatus: "malformed_json",
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {
      ...base,
      faithful: null,
      score: null,
      rationale: "Malformed faithfulness output; shadow-mode abstain.",
      parseStatus: "malformed_json",
    };
  }

  const faithful = parsed["faithful"];
  const score = parsed["score"];
  const rationale = parsed["rationale"];

  if (
    typeof faithful !== "boolean" ||
    typeof rationale !== "string" ||
    rationale.trim().length === 0
  ) {
    return {
      ...base,
      faithful: null,
      score: null,
      rationale: "Invalid faithfulness schema; shadow-mode abstain.",
      parseStatus: "schema_invalid",
    };
  }

  const normalizedScore =
    typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1
      ? score
      : null;

  return {
    ...base,
    faithful,
    score: normalizedScore,
    rationale: rationale.trim().slice(0, 240),
    parseStatus: "parsed",
  };
}

export function buildFaithfulnessRequestFailure(args: {
  error: unknown;
  groupId: string;
  family: ActiveFamily;
  visibleSummary: string;
  receiptQuotes: string[];
}): FaithfulnessClaimScore {
  return {
    groupId: args.groupId,
    family: args.family,
    visibleSummary: args.visibleSummary,
    receiptQuotes: args.receiptQuotes,
    faithful: null,
    score: null,
    rationale: "Faithfulness invoker failed; shadow-mode abstain.",
    parseStatus: "request_failed",
    shadowMode: true,
    usedForProductDecision: false,
  };
}

/**
 * Score faithfulness for all emitted families in one GroupResult.
 * For each active family:
 *  1. Build receipts from clueQuotes
 *  2. Call generateVisiblePatternSummary — skip if null
 *  3. Call the injectable invoker — record failure safely
 * Returns one FaithfulnessClaimScore per scoreable family.
 * Never throws.
 */
export async function scoreFaithfulnessForGroup(
  groupResult: GroupResult,
  invoker: FaithfulnessInvoker
): Promise<FaithfulnessClaimScore[]> {
  const scores: FaithfulnessClaimScore[] = [];

  for (const family of ACTIVE_FAMILIES) {
    if (!groupResult.emittedFamilies[family]) continue;

    const quotes = groupResult.clueQuotes[family];
    if (quotes.length === 0) continue;

    const receipts = quotes.map((q) => ({ quote: q }));
    const visibleSummary = generateVisiblePatternSummary({
      patternType: family,
      persistedSummary: "",
      receipts,
    });

    if (!visibleSummary) continue;

    let score: FaithfulnessClaimScore;
    try {
      const { rawOutput } = await invoker({ visibleSummary, receiptQuotes: quotes });
      score = parseFaithfulnessOutput({
        rawOutput,
        groupId: groupResult.group.id,
        family,
        visibleSummary,
        receiptQuotes: quotes,
      });
    } catch (error) {
      score = buildFaithfulnessRequestFailure({
        error,
        groupId: groupResult.group.id,
        family,
        visibleSummary,
        receiptQuotes: quotes,
      });
    }

    scores.push(score);
  }

  return scores;
}

/**
 * Aggregate per-claim faithfulness scores into a report with a regression gate.
 *
 * @param floor — faithfulness rate threshold for the regression gate.
 *   Use FAITHFULNESS_FLOOR (0.80) for live LLM scoring.
 *   Use FAITHFULNESS_DATASET_FLOOR (0.30) for the repo-local shadow baseline.
 */
export function computeFaithfulnessReport(
  scores: FaithfulnessClaimScore[],
  floor = FAITHFULNESS_FLOOR
): FaithfulnessReport {
  const scoredClaims = scores.length;
  const faithfulCount = scores.filter((s) => s.faithful === true).length;
  const unfaithfulCount = scores.filter((s) => s.faithful === false).length;
  const parseFailureCount = scores.filter((s) => s.parseStatus !== "parsed").length;
  const faithfulRate = scoredClaims === 0 ? null : faithfulCount / scoredClaims;
  const unfaithfulClaims = scores.filter(
    (s) => s.faithful === false || s.parseStatus !== "parsed"
  );
  const authoritativeViolations = scores.filter(
    (s) => s.usedForProductDecision === true
  ).length;

  return {
    scoredClaims,
    faithfulCount,
    unfaithfulCount,
    parseFailureCount,
    faithfulRate,
    unfaithfulClaims,
    authoritativeViolations,
    regressionGate: {
      name: "faithfulness_floor",
      threshold: floor,
      actual: faithfulRate,
      passed: (faithfulRate ?? 0) >= floor,
    },
  };
}

// ── Regression gates ───────────────────────────────────────────────────────────

export function runRegressionGates(
  msgReport: ReturnType<typeof computeMetrics>,
  groupMetrics: GroupMetrics,
  llmLfComparison: LlmLfComparisonReport | null = null,
  faithfulnessReport: FaithfulnessReport | null = null,
  visibleAbstentionSummary: VisibleAbstentionSummary | null = null,
  visibleCalibration: VisibleAbstentionCalibrationReport | null = null,
  rationaleSufficiencyReport: RationaleSufficiencyReport | null = null,
  rationaleMinimalityReport: RationaleMinimalityReport | null = null
): { gates: RegressionGate[]; allPassed: boolean } {
  const T = REGRESSION_THRESHOLDS;
  const gates: RegressionGate[] = [
    {
      name: "behavioral_precision_floor",
      description: `Behavioral gate precision ≥ ${T.BEHAVIORAL_PRECISION_FLOOR * 100}%`,
      threshold: T.BEHAVIORAL_PRECISION_FLOOR,
      actual: msgReport.behavioral.precision,
      passed: (msgReport.behavioral.precision ?? 0) >= T.BEHAVIORAL_PRECISION_FLOOR,
    },
    {
      name: "abstention_rate_floor",
      description: `Message-level abstention rate ≥ ${T.ABSTENTION_RATE_FLOOR * 100}%`,
      threshold: T.ABSTENTION_RATE_FLOOR,
      actual: msgReport.abstention.rate,
      passed: (msgReport.abstention.rate ?? 0) >= T.ABSTENTION_RATE_FLOOR,
    },
    {
      name: "quote_precision_floor",
      description: `Quote precision ≥ ${T.QUOTE_PRECISION_FLOOR * 100}%`,
      threshold: T.QUOTE_PRECISION_FLOOR,
      actual: msgReport.quote.precision,
      passed: (msgReport.quote.precision ?? 0) >= T.QUOTE_PRECISION_FLOOR,
    },
    {
      name: "grouped_abstention_floor",
      description: `Grouped bundle abstention correctness ≥ ${T.GROUPED_ABSTENTION_FLOOR * 100}%`,
      threshold: T.GROUPED_ABSTENTION_FLOOR,
      actual: groupMetrics.abstentionRate,
      passed: (groupMetrics.abstentionRate ?? 0) >= T.GROUPED_ABSTENTION_FLOOR,
    },
    {
      name: "rl_single_session_blocked",
      description: "RL single-session gate must block (real detectRepetitiveLoopClues)",
      threshold: 1,
      actual: msgReport.rlSessionGate.singleSessionGateBlocks ? 1 : 0,
      passed: msgReport.rlSessionGate.singleSessionGateBlocks,
    },
    {
      name: "no_raw_attack_in_safe_quotes",
      description: `≤ ${T.MAX_RAW_ATTACK_IN_SAFE_QUOTES} raw_self_attack quotes predicted display-safe`,
      threshold: T.MAX_RAW_ATTACK_IN_SAFE_QUOTES,
      actual: msgReport.quoteFpByCategory.raw_self_attack,
      passed: msgReport.quoteFpByCategory.raw_self_attack <= T.MAX_RAW_ATTACK_IN_SAFE_QUOTES,
    },
  ];

  if (llmLfComparison) {
    const tcPrecision =
      llmLfComparison.familyMetrics.find((metric) => metric.family === "trigger_condition")
        ?.precision ?? null;
    const icPrecision =
      llmLfComparison.familyMetrics.find((metric) => metric.family === "inner_critic")
        ?.precision ?? null;
    gates.push(
      {
        name: "llm_lf_parse_failure_ceiling",
        description: `LLM LF parse failure rate ≤ ${T.LLM_PARSE_FAILURE_RATE_CEILING * 100}%`,
        threshold: T.LLM_PARSE_FAILURE_RATE_CEILING,
        actual: llmLfComparison.parseFailureRate,
        passed:
          (llmLfComparison.parseFailureRate ?? 0) <=
          T.LLM_PARSE_FAILURE_RATE_CEILING,
      },
      {
        name: "llm_lf_no_malformed_as_valid_label",
        description: "Malformed LLM LF outputs must not be treated as valid labels",
        threshold: 0,
        actual: llmLfComparison.malformedAcceptedCount,
        passed: llmLfComparison.malformedAcceptedCount === 0,
      },
      {
        name: "llm_lf_shadow_only",
        description: "LLM LF outputs must remain shadow-only and non-authoritative",
        threshold: 0,
        actual: llmLfComparison.authoritativeViolations,
        passed: llmLfComparison.authoritativeViolations === 0,
      },
      {
        name: "llm_lf_disagreements_visible",
        description: "LLM LF disagreements must be surfaced in the report when present",
        threshold: 1,
        actual:
          llmLfComparison.disagreementCount === 0
            ? 1
            : llmLfComparison.disagreements.length > 0
              ? 1
              : 0,
        passed:
          llmLfComparison.disagreementCount === 0 ||
          llmLfComparison.disagreements.length > 0,
      },
      {
        name: "llm_lf_trigger_precision_floor",
        description: `LLM LF trigger_condition precision ≥ ${T.LLM_TC_PRECISION_FLOOR * 100}%`,
        threshold: T.LLM_TC_PRECISION_FLOOR,
        actual: tcPrecision,
        passed: (tcPrecision ?? 0) >= T.LLM_TC_PRECISION_FLOOR,
      },
      {
        name: "llm_lf_inner_critic_precision_floor",
        description: `LLM LF inner_critic precision ≥ ${T.LLM_IC_PRECISION_FLOOR * 100}%`,
        threshold: T.LLM_IC_PRECISION_FLOOR,
        actual: icPrecision,
        passed: (icPrecision ?? 0) >= T.LLM_IC_PRECISION_FLOOR,
      },
      {
        name: "llm_lf_abstention_supported",
        description: "LLM LF repo-local baseline must preserve at least one abstain output",
        threshold: 1,
        actual: llmLfComparison.abstained,
        passed: llmLfComparison.abstained >= 1,
      }
    );
  }
  if (faithfulnessReport) {
    gates.push({
      name: faithfulnessReport.regressionGate.name,
      description: `Faithfulness rate ≥ ${(faithfulnessReport.regressionGate.threshold * 100).toFixed(0)}% (floor calibrated to scoring context)`,
      threshold: faithfulnessReport.regressionGate.threshold,
      actual: faithfulnessReport.regressionGate.actual,
      passed: faithfulnessReport.regressionGate.passed,
    });
    const parseFailureRate =
      faithfulnessReport.scoredClaims === 0
        ? null
        : faithfulnessReport.parseFailureCount / faithfulnessReport.scoredClaims;
    gates.push({
      name: "faithfulness_parse_failure_ceiling",
      description: `Faithfulness parse failure rate ≤ ${FAITHFULNESS_PARSE_FAILURE_CEILING * 100}%`,
      threshold: FAITHFULNESS_PARSE_FAILURE_CEILING,
      actual: parseFailureRate,
      passed: (parseFailureRate ?? 0) <= FAITHFULNESS_PARSE_FAILURE_CEILING,
    });
    gates.push({
      name: "faithfulness_shadow_only",
      description: "Faithfulness scores must remain shadow-only and non-authoritative",
      threshold: 0,
      actual: faithfulnessReport.authoritativeViolations,
      passed: faithfulnessReport.authoritativeViolations === 0,
    });
    gates.push({
      name: "faithfulness_cases_visible",
      description: "Unfaithful and parse-failure cases must be surfaced in report when present",
      threshold: 1,
      actual:
        faithfulnessReport.unfaithfulCount === 0 && faithfulnessReport.parseFailureCount === 0
          ? 1
          : faithfulnessReport.unfaithfulClaims.length > 0
            ? 1
            : 0,
      passed:
        (faithfulnessReport.unfaithfulCount === 0 && faithfulnessReport.parseFailureCount === 0) ||
        faithfulnessReport.unfaithfulClaims.length > 0,
    });
  }
  if (rationaleSufficiencyReport) {
    const parseFailureRate =
      rationaleSufficiencyReport.totalClaimsConsidered === 0
        ? null
        : rationaleSufficiencyReport.parseFailureCount /
          rationaleSufficiencyReport.totalClaimsConsidered;
    gates.push({
      name: rationaleSufficiencyReport.regressionGate.name,
      description: `Rationale sufficiency rate ≥ ${(rationaleSufficiencyReport.regressionGate.threshold * 100).toFixed(0)}%`,
      threshold: rationaleSufficiencyReport.regressionGate.threshold,
      actual: rationaleSufficiencyReport.regressionGate.actual,
      passed: rationaleSufficiencyReport.regressionGate.passed,
    });
    gates.push({
      name: "rationale_parse_failure_ceiling",
      description: `Rationale sufficiency parse failure rate ≤ ${RATIONALE_PARSE_FAILURE_CEILING * 100}%`,
      threshold: RATIONALE_PARSE_FAILURE_CEILING,
      actual: parseFailureRate,
      passed: (parseFailureRate ?? 0) <= RATIONALE_PARSE_FAILURE_CEILING,
    });
    gates.push({
      name: "rationale_faithfulness_stability_floor",
      description:
        `Rationale-only faithfulness preservation rate ≥ ${(RATIONALE_FAITHFULNESS_STABILITY_FLOOR * 100).toFixed(0)}%`,
      threshold: RATIONALE_FAITHFULNESS_STABILITY_FLOOR,
      actual: rationaleSufficiencyReport.faithfulnessStabilityRate,
      passed:
        (rationaleSufficiencyReport.faithfulnessStabilityRate ?? 0) >=
        RATIONALE_FAITHFULNESS_STABILITY_FLOOR,
    });
    gates.push({
      name: "rationale_shadow_only",
      description: "Rationale sufficiency must remain shadow-only and non-authoritative",
      threshold: 0,
      actual: rationaleSufficiencyReport.authoritativeViolations,
      passed: rationaleSufficiencyReport.authoritativeViolations === 0,
    });
    gates.push({
      name: "rationale_insufficiency_visible",
      description: "Insufficient rationale cases must be surfaced when present",
      threshold: 1,
      actual:
        rationaleSufficiencyReport.insufficientCount === 0 &&
        rationaleSufficiencyReport.parseFailureCount === 0
          ? 1
          : rationaleSufficiencyReport.inspectableClaims.length > 0
            ? 1
            : 0,
      passed:
        (rationaleSufficiencyReport.insufficientCount === 0 &&
          rationaleSufficiencyReport.parseFailureCount === 0) ||
        rationaleSufficiencyReport.inspectableClaims.length > 0,
    });
    gates.push({
      name: "rationale_summary_stability_visible",
      description: "Summary drift cases must be surfaced in inspectable output when present",
      threshold: 1,
      actual:
        rationaleSufficiencyReport.summaryDriftCount === 0
          ? 1
          : rationaleSufficiencyReport.inspectableClaims.some(
                (claim) => claim.summaryStableFromRationale === false
              )
            ? 1
            : 0,
      passed:
        rationaleSufficiencyReport.summaryDriftCount === 0 ||
        rationaleSufficiencyReport.inspectableClaims.some(
          (claim) => claim.summaryStableFromRationale === false
        ),
    });
  }
  if (rationaleMinimalityReport) {
    gates.push({
      name: rationaleMinimalityReport.regressionGate.name,
      description: `Rationale minimality rate ≥ ${(rationaleMinimalityReport.regressionGate.threshold * 100).toFixed(0)}%`,
      threshold: rationaleMinimalityReport.regressionGate.threshold,
      actual: rationaleMinimalityReport.regressionGate.actual,
      passed: rationaleMinimalityReport.regressionGate.passed,
    });
    gates.push({
      name: "rationale_minimality_visible",
      description: "Bloated rationale claims must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.bloatedClaims === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) => claim.redundantQuoteCount > 0
              )
            ? 1
            : 0,
      passed:
        rationaleMinimalityReport.bloatedClaims === 0 ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) => claim.redundantQuoteCount > 0
        ),
    });
    gates.push({
      name: "rationale_comprehensiveness_visible",
      description: "Weak complement-isolation cases must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.partialComprehensivenessCount === 0 &&
        rationaleMinimalityReport.noComprehensivenessCount === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) => claim.comprehensivenessEffect !== "strong"
              )
            ? 1
            : 0,
      passed:
        (rationaleMinimalityReport.partialComprehensivenessCount === 0 &&
          rationaleMinimalityReport.noComprehensivenessCount === 0) ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) => claim.comprehensivenessEffect !== "strong"
        ),
    });
    gates.push({
      name: "rationale_minimality_shadow_only",
      description: "Rationale minimality must remain shadow-only and non-authoritative",
      threshold: 0,
      actual: rationaleMinimalityReport.authoritativeViolations,
      passed: rationaleMinimalityReport.authoritativeViolations === 0,
    });
    gates.push({
      name: "rationale_global_minimality_visible",
      description: "Globally non-minimal rationale claims must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.nonMinimalClaims === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) => claim.rationaleGloballyMinimal === false
              )
            ? 1
            : 0,
      passed:
        rationaleMinimalityReport.nonMinimalClaims === 0 ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) => claim.rationaleGloballyMinimal === false
        ),
    });
    gates.push({
      name: "rationale_alternative_support_visible",
      description: "Alternative non-rationale support subsets must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.alternativeSupportClaims === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) => claim.complementSupportingSubsetExists === true
              )
            ? 1
            : 0,
      passed:
        rationaleMinimalityReport.alternativeSupportClaims === 0 ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) => claim.complementSupportingSubsetExists === true
        ),
    });
    gates.push({
      name: "rationale_subset_search_skip_visible",
      description: "Skipped rationale/complement subset-search claims must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.rationaleSubsetSearchSkippedClaims === 0 &&
        rationaleMinimalityReport.complementSubsetSearchSkippedClaims === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) =>
                  !claim.rationaleSubsetSearchPerformed ||
                  !claim.complementSubsetSearchPerformed
              )
            ? 1
            : 0,
      passed:
        (rationaleMinimalityReport.rationaleSubsetSearchSkippedClaims === 0 &&
          rationaleMinimalityReport.complementSubsetSearchSkippedClaims === 0) ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) =>
            !claim.rationaleSubsetSearchPerformed || !claim.complementSubsetSearchPerformed
        ),
    });
    gates.push({
      name: "rationale_unknown_minimality_visible",
      description: "Unknown minimality or alternative-support cases must be surfaced when present",
      threshold: 1,
      actual:
        rationaleMinimalityReport.unknownMinimalityClaims === 0 &&
        rationaleMinimalityReport.unknownAlternativeSupportClaims === 0
          ? 1
          : rationaleMinimalityReport.inspectableClaims.some(
                (claim) =>
                  claim.rationaleGloballyMinimal === null ||
                  claim.smallerSupportingSubsetExists === null ||
                  claim.complementSupportingSubsetExists === null ||
                  claim.alternativeSupportStrength === null
              )
            ? 1
            : 0,
      passed:
        (rationaleMinimalityReport.unknownMinimalityClaims === 0 &&
          rationaleMinimalityReport.unknownAlternativeSupportClaims === 0) ||
        rationaleMinimalityReport.inspectableClaims.some(
          (claim) =>
            claim.rationaleGloballyMinimal === null ||
            claim.smallerSupportingSubsetExists === null ||
            claim.complementSupportingSubsetExists === null ||
            claim.alternativeSupportStrength === null
        ),
    });
    gates.push({
      name: "rationale_subset_search_coverage_floor",
      description:
        `Rationale subset-search coverage ≥ ${(
          RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR * 100
        ).toFixed(0)}%`,
      threshold: RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR,
      actual: rationaleMinimalityReport.searchedRationaleSubsetRate,
      passed:
        (rationaleMinimalityReport.searchedRationaleSubsetRate ?? 0) >=
        RATIONALE_SUBSET_SEARCH_COVERAGE_FLOOR,
    });
    gates.push({
      name: "rationale_complement_search_coverage_floor",
      description:
        `Complement subset-search coverage ≥ ${(
          RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR * 100
        ).toFixed(0)}%`,
      threshold: RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR,
      actual: rationaleMinimalityReport.searchedComplementSubsetRate,
      passed:
        (rationaleMinimalityReport.searchedComplementSubsetRate ?? 0) >=
        RATIONALE_COMPLEMENT_SEARCH_COVERAGE_FLOOR,
    });
    gates.push({
      name: "rationale_unknown_minimality_ceiling",
      description:
        `Unknown minimality rate ≤ ${(
          RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING * 100
        ).toFixed(0)}%`,
      threshold: RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING,
      actual: rationaleMinimalityReport.unknownMinimalityRate,
      passed:
        (rationaleMinimalityReport.unknownMinimalityRate ?? 0) <=
        RATIONALE_UNKNOWN_MINIMALITY_RATE_CEILING,
    });
    gates.push({
      name: "rationale_unknown_alternative_support_ceiling",
      description:
        `Unknown alternative-support rate ≤ ${(
          RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING * 100
        ).toFixed(0)}%`,
      threshold: RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING,
      actual: rationaleMinimalityReport.unknownAlternativeSupportRate,
      passed:
        (rationaleMinimalityReport.unknownAlternativeSupportRate ?? 0) <=
        RATIONALE_UNKNOWN_ALTERNATIVE_SUPPORT_RATE_CEILING,
    });
  }
  if (visibleAbstentionSummary !== null) {
    // When totalEmittedClaims === 0, coverageRate is null (no data — not a failure).
    // The gate fires only when there are scored claims to evaluate against.
    const coverageRate = visibleAbstentionSummary.coverageRate;
    gates.push({
      name: "visible_coverage_floor",
      description: `Visible claim coverage ≥ ${T.VISIBLE_COVERAGE_FLOOR * 100}% (guards against over-suppression; null = no data)`,
      threshold: T.VISIBLE_COVERAGE_FLOOR,
      actual: coverageRate,
      passed: coverageRate === null || coverageRate >= T.VISIBLE_COVERAGE_FLOOR,
    });
  }

  // ── Calibration gates ──────────────────────────────────────────────────────
  if (visibleCalibration !== null) {
    // Gate 1: A threshold must be selected when eligible claims exist.
    const thresholdSelected =
      visibleCalibration.eligibleClaims === 0 ||
      visibleCalibration.selectedThreshold !== null;
    gates.push({
      name: "visible_calibration_threshold_selected",
      description:
        "Calibration must select a threshold when eligible claims exist (null = no data)",
      threshold: 1,
      actual: thresholdSelected ? 1 : 0,
      passed: thresholdSelected,
    });

    // Gate 2: Selected coverage must meet the floor when data is sufficient.
    const selectedCoverage = visibleCalibration.selectedRow?.coverageRate ?? null;
    gates.push({
      name: "visible_calibration_coverage_floor",
      description: `Calibrated coverage ≥ ${CALIBRATION_COVERAGE_FLOOR * 100}% when eligible claims exist (null = no data)`,
      threshold: CALIBRATION_COVERAGE_FLOOR,
      actual: selectedCoverage,
      passed: selectedCoverage === null || selectedCoverage >= CALIBRATION_COVERAGE_FLOOR,
    });

    // Gate 3: Selected failure rate must respect the target OR fallback must be documented.
    const selectedFailureRate = visibleCalibration.selectedRow?.failureRate ?? null;
    const policy = visibleCalibration.policy;
    const failureTargetRespected =
      selectedFailureRate === null ||
      selectedFailureRate <= visibleCalibration.targetFailureRate ||
      // Fallback path: no threshold met the target — acceptable when policy
      // explicitly records fallbackUsed=true and selectionReason is documented.
      (policy !== null && policy.fallbackUsed && policy.selectionReason.length > 0);
    gates.push({
      name: "visible_calibration_failure_target_respected",
      description: `Selected failure rate ≤ target (${CALIBRATION_TARGET_FAILURE_RATE}) OR fallback documented`,
      threshold: visibleCalibration.targetFailureRate,
      actual: selectedFailureRate,
      passed: failureTargetRespected,
    });

    // Gate 4: Calibration data must be non-trivially small.
    gates.push({
      name: "visible_calibration_data_sufficient",
      description: `Calibration eligible claims ≥ ${CALIBRATION_DATA_SUFFICIENCY_FLOOR} (guards against trivially small baseline)`,
      threshold: CALIBRATION_DATA_SUFFICIENCY_FLOOR,
      actual: visibleCalibration.eligibleClaims,
      passed: visibleCalibration.eligibleClaims >= CALIBRATION_DATA_SUFFICIENCY_FLOOR,
    });
  }

  // ── Grouped per-family emission gates (Phase 11) ──────────────────────────
  // Null-safe: gates are omitted when groupMetrics is absent (no grouped data).
  const fe = groupMetrics.familyEmission;
  const familyGates: Array<{ key: keyof typeof fe; label: string; precisionFloor: number; recallFloor: number }> = [
    { key: "trigger_condition",    label: "TC",  precisionFloor: T.GROUPED_TC_PRECISION_FLOOR, recallFloor: T.GROUPED_TC_RECALL_FLOOR },
    { key: "inner_critic",         label: "IC",  precisionFloor: T.GROUPED_IC_PRECISION_FLOOR, recallFloor: T.GROUPED_IC_RECALL_FLOOR },
    { key: "repetitive_loop",      label: "RL",  precisionFloor: T.GROUPED_RL_PRECISION_FLOOR, recallFloor: T.GROUPED_RL_RECALL_FLOOR },
    { key: "recovery_stabilizer",  label: "RS",  precisionFloor: T.GROUPED_RS_PRECISION_FLOOR, recallFloor: T.GROUPED_RS_RECALL_FLOOR },
  ];
  for (const { key, label, precisionFloor, recallFloor } of familyGates) {
    const stats = fe[key];
    gates.push(
      {
        name: `grouped_${key}_precision_floor`,
        description: `Grouped ${label} emission precision ≥ ${precisionFloor * 100}% (null = no expected positives)`,
        threshold: precisionFloor,
        actual: stats.precision,
        passed: stats.precision === null || stats.precision >= precisionFloor,
      },
      {
        name: `grouped_${key}_recall_floor`,
        description: `Grouped ${label} emission recall ≥ ${recallFloor * 100}% (null = no expected positives)`,
        threshold: recallFloor,
        actual: stats.recall,
        passed: stats.recall === null || stats.recall >= recallFloor,
      }
    );
  }

  return { gates, allPassed: gates.every((g) => g.passed) };
}
