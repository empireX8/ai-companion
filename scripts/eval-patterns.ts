/**
 * Pattern Detection Evaluator CLI (Phase 5 Max-Out)
 *
 * Runs the evaluator on both adjudication datasets:
 *   1. message-level adjudication-set.jsonl
 *   2. grouped-history adjudication-groups.jsonl
 *
 * Produces:
 *   - structured terminal output
 *   - machine-readable baseline report at eval/patterns/reports/latest.json
 *
 * Exits non-zero when a regression gate fails.
 */

import * as fs from "fs";
import * as path from "path";
import {
  compareLlmLfOutputs,
  computeAbstentionCalibration,
  computeFaithfulnessReport,
  computeGroupMetrics,
  computeMetrics,
  computeReviewRoutingReport,
  computeVisibleAbstentionSummary,
  evaluateExample,
  evaluateGroup,
  FAITHFULNESS_DATASET_FLOOR,
  FAITHFULNESS_FLOOR,
  REGRESSION_THRESHOLDS,
  runRegressionGates,
  scoreFaithfulnessForGroup,
  validateAdjudicationEntry,
  validateAdjudicationGroup,
  type FaithfulnessInvoker,
} from "../lib/eval/pattern-evaluator";
import {
  CALIBRATION_TARGET_FAILURE_RATE,
  CALIBRATION_COVERAGE_FLOOR,
  CALIBRATION_DATA_SUFFICIENCY_FLOOR,
} from "../lib/eval/pattern-abstention-calibration";
import {
  DEFAULT_VISIBLE_ABSTENTION_POLICY_PATH,
  summarizeVisibleAbstentionPolicyArtifact,
  VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION,
} from "../lib/visible-abstention-policy";
import {
  computeRationaleSufficiencyReport,
  computeRationaleSufficiencyScores,
} from "../lib/eval/pattern-rationale-sufficiency";
import {
  computeRationaleMinimalityReport,
  computeRationaleMinimalityScores,
} from "../lib/eval/pattern-rationale-minimality";
import {
  buildReviewQueueArtifact,
  DEFAULT_REVIEW_QUEUE_CSV_PATH,
  DEFAULT_REVIEW_QUEUE_JSON_PATH,
  writeReviewQueueCsv,
  writeReviewQueueJson,
} from "../lib/eval/pattern-review-queue";
import {
  DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH,
  DEFAULT_REVIEWED_GROUPED_DATASET_PATH,
  ensureReviewResolutionLog,
  loadMergedFaithfulnessDataset,
  loadMergedGroupedDataset,
} from "../lib/eval/pattern-review-resolution";
import type {
  AdjudicationEntry,
  AdjudicationGroup,
  EvalReport,
  FaithfulnessClaimScore,
  FaithfulnessReport,
  GroupResult,
  LlmLfComparisonInput,
  RationaleMinimalityReport,
  RationaleSufficiencyReport,
  ReviewQueueArtifact,
  VisibleAbstentionPolicyArtifact,
  VisibleAbstentionCalibrationReport,
  VisibleAbstentionSummary,
} from "../lib/eval/eval-types";

const EVAL_DIR = path.join(__dirname, "../eval/patterns");
const MESSAGE_DATASET_PATH = path.join(EVAL_DIR, "adjudication-set.jsonl");
const GROUPED_DATASET_PATH = path.join(EVAL_DIR, "adjudication-groups.jsonl");
const LLM_LF_DATASET_PATH = path.join(EVAL_DIR, "llm-lf-shadow-set.jsonl");
const FAITHFULNESS_SHADOW_PATH = path.join(EVAL_DIR, "faithfulness-shadow-set.jsonl");
const REPORTS_DIR = path.join(EVAL_DIR, "reports");
const LATEST_REPORT_PATH = path.join(REPORTS_DIR, "latest.json");

type DatasetLoaderOptions<T> = {
  path: string;
  validate: (obj: unknown) => obj is T;
  label: string;
};

function loadJsonlDataset<T>({
  path: datasetPath,
  validate,
  label,
}: DatasetLoaderOptions<T>): T[] {
  const raw = fs.readFileSync(datasetPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const entries: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let obj: unknown;
    try {
      obj = JSON.parse(lines[i]!);
    } catch {
      errors.push(`Line ${i + 1}: invalid JSON`);
      continue;
    }

    if (!validate(obj)) {
      const id = (obj as Record<string, unknown>)?.["id"] ?? "?";
      errors.push(`Line ${i + 1}: schema validation failed for id=${String(id)}`);
      continue;
    }

    entries.push(obj);
  }

  if (errors.length > 0) {
    const prefix = `${label} validation errors:`;
    throw new Error([prefix, ...errors.map((e) => `  ${e}`)].join("\n"));
  }

  return entries;
}

export function loadMessageDataset(datasetPath = MESSAGE_DATASET_PATH): AdjudicationEntry[] {
  return loadJsonlDataset({
    path: datasetPath,
    validate: validateAdjudicationEntry,
    label: "Message-level dataset",
  });
}

export function loadRawGroupedDataset(datasetPath = GROUPED_DATASET_PATH): AdjudicationGroup[] {
  return loadJsonlDataset({
    path: datasetPath,
    validate: validateAdjudicationGroup,
    label: "Grouped dataset",
  });
}

export function loadGroupedDataset(
  datasetPath = GROUPED_DATASET_PATH,
  reviewedOverlayPath = DEFAULT_REVIEWED_GROUPED_DATASET_PATH
): AdjudicationGroup[] {
  return loadMergedGroupedDataset(datasetPath, reviewedOverlayPath);
}

export function validateLlmLfShadowRecord(obj: unknown): obj is LlmLfComparisonInput {
  if (typeof obj !== "object" || obj === null) return false;
  const row = obj as Record<string, unknown>;
  if (typeof row["entryId"] !== "string" || row["entryId"].length === 0) return false;
  if (typeof row["modelId"] !== "string" || row["modelId"].length === 0) return false;
  if (typeof row["promptVersion"] !== "string" || row["promptVersion"].length === 0) return false;
  if (
    row["label"] !== "trigger_condition" &&
    row["label"] !== "inner_critic" &&
    row["label"] !== "abstain"
  ) {
    return false;
  }
  if (typeof row["rationale"] !== "string") return false;
  if (row["confidence"] !== null && typeof row["confidence"] !== "number") return false;
  if (typeof row["abstain"] !== "boolean") return false;
  if (
    row["parseStatus"] !== "parsed" &&
    row["parseStatus"] !== "malformed_json" &&
    row["parseStatus"] !== "schema_invalid" &&
    row["parseStatus"] !== "request_failed"
  ) {
    return false;
  }
  if (typeof row["shadowMode"] !== "boolean") return false;
  if (typeof row["usedForProductDecision"] !== "boolean") return false;
  if (row["rawOutput"] !== undefined && row["rawOutput"] !== null && typeof row["rawOutput"] !== "string") {
    return false;
  }
  if (row["parseError"] !== undefined && row["parseError"] !== null && typeof row["parseError"] !== "string") {
    return false;
  }
  if (row["notes"] !== undefined && typeof row["notes"] !== "string") return false;
  return true;
}

export function loadLlmLfShadowDataset(
  datasetPath = LLM_LF_DATASET_PATH
): LlmLfComparisonInput[] {
  if (!fs.existsSync(datasetPath)) {
    return [];
  }
  return loadJsonlDataset({
    path: datasetPath,
    validate: validateLlmLfShadowRecord,
    label: "LLM LF shadow dataset",
  });
}

export function validateFaithfulnessShadowRecord(obj: unknown): obj is import("../lib/eval/eval-types").FaithfulnessClaimScore {
  if (typeof obj !== "object" || obj === null) return false;
  const row = obj as Record<string, unknown>;
  if (typeof row["groupId"] !== "string" || row["groupId"].length === 0) return false;
  if (
    row["family"] !== "trigger_condition" &&
    row["family"] !== "inner_critic" &&
    row["family"] !== "repetitive_loop" &&
    row["family"] !== "recovery_stabilizer"
  ) return false;
  if (typeof row["visibleSummary"] !== "string" || row["visibleSummary"].length === 0) return false;
  if (!Array.isArray(row["receiptQuotes"])) return false;
  if (!(row["receiptQuotes"] as unknown[]).every((q) => typeof q === "string")) return false;
  if (row["faithful"] !== true && row["faithful"] !== false && row["faithful"] !== null) return false;
  if (row["score"] !== null && typeof row["score"] !== "number") return false;
  if (typeof row["rationale"] !== "string") return false;
  if (
    row["parseStatus"] !== "parsed" &&
    row["parseStatus"] !== "malformed_json" &&
    row["parseStatus"] !== "schema_invalid" &&
    row["parseStatus"] !== "request_failed"
  ) return false;
  if (row["shadowMode"] !== true) return false;
  if (typeof row["usedForProductDecision"] !== "boolean") return false;
  if (row["notes"] !== undefined && typeof row["notes"] !== "string") return false;
  return true;
}

export function loadRawFaithfulnessShadowDataset(
  datasetPath = FAITHFULNESS_SHADOW_PATH
): import("../lib/eval/eval-types").FaithfulnessClaimScore[] {
  if (!fs.existsSync(datasetPath)) {
    return [];
  }
  return loadJsonlDataset({
    path: datasetPath,
    validate: validateFaithfulnessShadowRecord,
    label: "Faithfulness shadow dataset",
  });
}

export function loadFaithfulnessShadowDataset(
  datasetPath = FAITHFULNESS_SHADOW_PATH,
  reviewedOverlayPath = DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH
): import("../lib/eval/eval-types").FaithfulnessClaimScore[] {
  return loadMergedFaithfulnessDataset(datasetPath, reviewedOverlayPath);
}

function pct(n: number | null): string {
  if (n === null) return "  n/a ";
  return (n * 100).toFixed(1).padStart(5) + "%";
}

function bar(n: number | null, width = 20): string {
  if (n === null) return " ".repeat(width);
  const filled = Math.round(n * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function truncate(s: string, max = 88): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function pass(b: boolean): string {
  return b ? "PASS" : "FAIL";
}

function formatGateValue(name: string, value: number | null): string {
  if (value === null) return "n/a";
  if (
    name === "no_raw_attack_in_safe_quotes" ||
    name === "rl_single_session_blocked" ||
    name === "llm_lf_no_malformed_as_valid_label" ||
    name === "llm_lf_shadow_only" ||
    name === "llm_lf_disagreements_visible" ||
    name === "llm_lf_abstention_supported" ||
    name === "faithfulness_shadow_only" ||
    name === "faithfulness_cases_visible" ||
    name === "rationale_shadow_only" ||
    name === "rationale_insufficiency_visible" ||
    name === "rationale_summary_stability_visible" ||
    name === "rationale_minimality_visible" ||
    name === "rationale_comprehensiveness_visible" ||
    name === "rationale_minimality_shadow_only" ||
    name === "rationale_global_minimality_visible" ||
    name === "rationale_alternative_support_visible" ||
    name === "rationale_subset_search_skip_visible" ||
    name === "rationale_unknown_minimality_visible" ||
    name === "visible_calibration_threshold_selected" ||
    name === "visible_calibration_data_sufficient"
  ) {
    return String(value);
  }
  return pct(value);
}

// ── Faithfulness support ───────────────────────────────────────────────────────

export function shouldRunFaithfulnessScoring(): boolean {
  const flag = (process.env.MINDLAB_FAITHFULNESS_SCORING ?? "").toLowerCase();
  return (flag === "1" || flag === "true") && Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Aggregate faithfulness scores across all grouped results.
 * Returns both the aggregated report and the full flat scores list.
 * The allScores list is needed for conditional faithfulness rate computation.
 */
export async function computeFaithfulnessForGroups(
  groupedResults: GroupResult[],
  invoker: FaithfulnessInvoker
): Promise<{ report: FaithfulnessReport; allScores: FaithfulnessClaimScore[] }> {
  const allScores: FaithfulnessClaimScore[] = [];
  for (const gr of groupedResults) {
    const scores = await scoreFaithfulnessForGroup(gr, invoker);
    allScores.push(...scores);
  }
  return { report: computeFaithfulnessReport(allScores), allScores };
}

export function buildEvalReport(
  messageEntries: AdjudicationEntry[],
  groupedEntries: AdjudicationGroup[],
  reportPath = LATEST_REPORT_PATH,
  llmLfOutputs?: LlmLfComparisonInput[],
  faithfulnessReport?: FaithfulnessReport | null,
  faithfulnessAllScores?: FaithfulnessClaimScore[] | null
): EvalReport {
  const effectiveLlmLfOutputs = llmLfOutputs ?? loadLlmLfShadowDataset();

  // When faithfulnessReport is undefined (not explicitly provided), load the repo-local
  // faithfulness shadow baseline — analogous to how LLM LF shadow is loaded by default.
  // When faithfulnessReport is explicitly null, faithfulness is intentionally disabled.
  // When faithfulnessReport is a FaithfulnessReport, use it directly (live scoring path).
  let effectiveFaithfulnessReport: FaithfulnessReport | null = faithfulnessReport ?? null;
  let effectiveFaithfulnessAllScores: FaithfulnessClaimScore[] | null = faithfulnessAllScores ?? null;
  if (faithfulnessReport === undefined) {
    const repoLocalScores = loadFaithfulnessShadowDataset();
    if (repoLocalScores.length > 0) {
      effectiveFaithfulnessReport = computeFaithfulnessReport(repoLocalScores, FAITHFULNESS_DATASET_FLOOR);
      effectiveFaithfulnessAllScores = repoLocalScores;
    }
  }

  const messageResults = messageEntries.map(evaluateExample);
  const groupedResults = groupedEntries.map(evaluateGroup);

  const messageReport = computeMetrics(messageResults);
  const groupedMetrics = computeGroupMetrics(groupedResults);
  const visibleAbstention = computeVisibleAbstentionSummary(
    groupedResults,
    effectiveFaithfulnessAllScores
  );
  const llmLfComparison =
    effectiveLlmLfOutputs.length > 0
      ? compareLlmLfOutputs(messageEntries, effectiveLlmLfOutputs)
      : null;
  const rationaleSufficiencyScores =
    effectiveFaithfulnessAllScores && effectiveFaithfulnessAllScores.length > 0
      ? computeRationaleSufficiencyScores(groupedResults, effectiveFaithfulnessAllScores)
      : [];
  const rationaleSufficiency: RationaleSufficiencyReport | null =
    rationaleSufficiencyScores.length > 0
      ? computeRationaleSufficiencyReport(rationaleSufficiencyScores)
      : null;
  const rationaleMinimality: RationaleMinimalityReport | null =
    rationaleSufficiency
      ? computeRationaleMinimalityReport(
          computeRationaleMinimalityScores(rationaleSufficiency.allClaims)
        )
      : null;
  const reviewRouting = groupedResults.length > 0
    ? computeReviewRoutingReport(groupedResults, effectiveFaithfulnessAllScores, llmLfComparison)
    : null;

  // Compute calibration from grouped results and faithfulness scores.
  // Deterministic: same inputs → same selected threshold.
  const visibleCalibration: VisibleAbstentionCalibrationReport =
    computeAbstentionCalibration(groupedResults, effectiveFaithfulnessAllScores);

  const gateResults = runRegressionGates(
    messageReport,
    groupedMetrics,
    llmLfComparison,
    effectiveFaithfulnessReport,
    visibleAbstention,
    visibleCalibration,
    rationaleSufficiency,
    rationaleMinimality
  );

  return {
    generatedAt: new Date().toISOString(),
    datasets: {
      messageLevelPath: MESSAGE_DATASET_PATH,
      groupedLevelPath: GROUPED_DATASET_PATH,
      groupedReviewedOverlayPath: fs.existsSync(DEFAULT_REVIEWED_GROUPED_DATASET_PATH)
        ? DEFAULT_REVIEWED_GROUPED_DATASET_PATH
        : null,
      llmLfShadowPath:
        effectiveLlmLfOutputs.length > 0 ? LLM_LF_DATASET_PATH : null,
      faithfulnessShadowPath: FAITHFULNESS_SHADOW_PATH,
      faithfulnessReviewedOverlayPath: fs.existsSync(DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH)
        ? DEFAULT_REVIEWED_FAITHFULNESS_DATASET_PATH
        : null,
      reportPath,
    },
    ...messageReport,
    totalGroups: groupedEntries.length,
    groupedMetrics,
    visibleAbstention,
    llmLfComparison,
    regressionGates: gateResults.gates,
    allRegressionGatesPassed: gateResults.allPassed,
    faithfulness: effectiveFaithfulnessReport,
    rationaleSufficiency,
    rationaleMinimality,
    reviewRouting,
    visibleCalibration,
  };
}

export function writeLatestReport(
  report: EvalReport,
  reportPath = LATEST_REPORT_PATH
): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
}

function readGatePassed(report: EvalReport, gateName: string): boolean {
  return report.regressionGates.find((gate) => gate.name === gateName)?.passed === true;
}

export function buildVisibleAbstentionPolicyArtifact(
  report: EvalReport
): VisibleAbstentionPolicyArtifact {
  const visibleCalibration = report.visibleCalibration;
  const policy = visibleCalibration?.policy;

  return {
    version: VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION,
    generatedAt: report.generatedAt,
    sourceReportPath: report.datasets.reportPath,
    selectedThreshold: visibleCalibration?.selectedThreshold ?? null,
    targetFailureRate:
      visibleCalibration?.targetFailureRate ?? CALIBRATION_TARGET_FAILURE_RATE,
    coverageFloor: CALIBRATION_COVERAGE_FLOOR,
    eligibleClaims: visibleCalibration?.eligibleClaims ?? 0,
    fallbackUsed: policy?.fallbackUsed ?? true,
    selectionReason: policy?.selectionReason ?? "no_visible_calibration_policy",
    calibrationGateStatus: {
      thresholdSelected: readGatePassed(report, "visible_calibration_threshold_selected"),
      coverageFloorPassed: readGatePassed(report, "visible_calibration_coverage_floor"),
      failureTargetRespected: readGatePassed(report, "visible_calibration_failure_target_respected"),
      dataSufficient: readGatePassed(report, "visible_calibration_data_sufficient"),
    },
  };
}

export function writeVisibleAbstentionPolicyArtifact(
  artifact: VisibleAbstentionPolicyArtifact,
  policyPath = DEFAULT_VISIBLE_ABSTENTION_POLICY_PATH
): void {
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(policyPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

export function printReport(report: EvalReport): void {
  const sep = "─".repeat(78);
  const dbl = "═".repeat(78);

  console.log("\n" + dbl);
  console.log("  PATTERN DETECTION EVALUATION REPORT");
  console.log(dbl);
  console.log(`  Generated: ${report.generatedAt}`);
  console.log(`  Message examples: ${report.totalExamples}  |  Grouped bundles: ${report.totalGroups}`);
  console.log(`  Report artifact: ${report.datasets.reportPath}`);

  console.log("\n" + sep);
  console.log("  MESSAGE-LEVEL EVALUATION");
  console.log(sep);
  console.log(
    `  Sources: live_user=${report.sourceBreakdown.live_user}  imported_user=${report.sourceBreakdown.imported_user}  synthetic_edge_case=${report.sourceBreakdown.synthetic_edge_case}`
  );
  console.log(
    `  Labels: behavioral=${report.labelBreakdown.behavioral}  non_behavioral=${report.labelBreakdown.non_behavioral}  should_abstain=${report.labelBreakdown.should_abstain}`
  );

  const b = report.behavioral;
  console.log("\n  Behavioral Gate  (real analyzeBehavioralEligibility)");
  console.log(`  Predicted behavioral : ${b.predictedBehavioral}`);
  console.log(`  True positives       : ${b.truePositives}`);
  console.log(`  False positives      : ${b.falsePositives}`);
  console.log(`  False negatives      : ${b.falseNegatives}`);
  console.log(`  Precision  ${pct(b.precision)}  ${bar(b.precision)}`);
  console.log(`  Recall     ${pct(b.recall)}  ${bar(b.recall)}`);
  console.log(`  F1         ${pct(b.f1)}  ${bar(b.f1)}`);

  console.log("\n  Message-Level Family Signals");
  console.log("  Family                  Support  Predicted  Precision  Recall");
  console.log("  " + "─".repeat(70));
  for (const fm of report.families) {
    console.log(
      `  ${fm.family.padEnd(24)}${String(fm.support).padStart(7)}  ${String(fm.predicted).padStart(9)}  ${pct(fm.precision)}  ${pct(fm.recall)}`
    );
  }

  console.log("\n  Quote Safety  (real isDisplaySafePatternQuote)");
  console.log(`  Predicted quote-safe : ${report.quote.predictedSafe}`);
  console.log(`  Precision ${pct(report.quote.precision)}  ${bar(report.quote.precision)}`);
  console.log(`  Recall    ${pct(report.quote.recall)}  ${bar(report.quote.recall)}`);

  console.log("\n  Abstention");
  console.log(`  Should-abstain count : ${report.abstention.shouldAbstainCount}`);
  console.log(`  Correctly abstained  : ${report.abstention.correctlyAbstained}`);
  console.log(`  Rate      ${pct(report.abstention.rate)}  ${bar(report.abstention.rate)}`);

  const rl = report.rlSessionGate;
  console.log("\n  RL Session Gate  (real detectRepetitiveLoopClues)");
  console.log(`  RL-labeled entries used : ${rl.rlLabeledCount}`);
  console.log(`  Simulated sessions      : ${rl.sessionCount}`);
  console.log(`  Multi-session detector  : ${pass(rl.detectorFired)}`);
  console.log(`  Single-session blocked  : ${pass(rl.singleSessionGateBlocks)}`);

  console.log("\n" + sep);
  console.log("  GROUPED / CLAIM-LEVEL EVALUATION");
  console.log(sep);
  const g = report.groupedMetrics;
  console.log(`  Bundles evaluated        : ${g.groupsEvaluated}`);
  console.log(`  Behavioral correctness   : ${g.behavioralCorrect}/${g.groupsEvaluated}`);
  console.log(`  Exact family matches     : ${g.exactFamilyMatches}/${g.groupsEvaluated}`);
  console.log(`  Abstention correctness   : ${g.abstentionCorrect}/${g.abstentionTotal}  (${pct(g.abstentionRate)})`);
  console.log(
    `  Quote presence precision : ${pct(g.quotePrecision)}  |  recall ${pct(g.quoteRecall)}`
  );
  console.log(
    `  Quote presence correct   : ${g.quotePresenceCorrect}/${g.quotePresenceTotal}`
  );

  console.log("\n  Claim-Level Family Emission");
  console.log("  Family                  Expected  Emitted  Precision  Recall");
  console.log("  " + "─".repeat(70));
  for (const family of Object.keys(g.familyEmission) as Array<keyof typeof g.familyEmission>) {
    const stats = g.familyEmission[family];
    console.log(
      `  ${family.padEnd(24)}${String(stats.expected).padStart(8)}  ${String(stats.emitted).padStart(7)}  ${pct(stats.precision)}  ${pct(stats.recall)}`
    );
  }

  console.log("\n" + sep);
  console.log("  QUOTE FAILURE TAXONOMY");
  console.log(sep);
  for (const [category, count] of Object.entries(report.quoteFpByCategory)) {
    console.log(`  ${category.padEnd(24)} ${String(count).padStart(3)}`);
  }

  if (report.llmLfComparison) {
    console.log("\n" + sep);
    console.log("  SHADOW LLM LF COMPARISON");
    console.log(sep);
    console.log(`  Compared entries    : ${report.llmLfComparison.totalCompared}`);
    console.log(`  Parsed outputs      : ${report.llmLfComparison.parsedCount}`);
    console.log(`  Parse failures      : ${report.llmLfComparison.parseFailures}`);
    console.log(`  Parse failure rate  : ${pct(report.llmLfComparison.parseFailureRate)}`);
    console.log(`  Abstained outputs   : ${report.llmLfComparison.abstained}`);
    console.log(
      `  Abstention rate     : ${pct(report.llmLfComparison.abstentionRate)}`
    );
    console.log(
      `  Disagreement rate   : ${pct(report.llmLfComparison.disagreementRate)}`
    );
    console.log(
      `  Helpful vs heuristic abstain  : ${report.llmLfComparison.helpedWhereHeuristicsAbstained}`
    );
    console.log(
      `  Overreach vs heuristic abstain: ${report.llmLfComparison.overreachedWhereHeuristicsAbstained}`
    );
    console.log("  Family                  Support  Predicted  Precision  Recall");
    console.log("  " + "─".repeat(70));
    for (const fm of report.llmLfComparison.familyMetrics) {
      console.log(
        `  ${fm.family.padEnd(24)}${String(fm.support).padStart(7)}  ${String(fm.predicted).padStart(9)}  ${pct(fm.precision)}  ${pct(fm.recall)}`
      );
    }
  }

  if (report.falsePredictions.behavioralFP.length > 0) {
    console.log("\n" + sep);
    console.log("  MESSAGE-LEVEL BEHAVIORAL FALSE POSITIVES");
    console.log(sep);
    for (const r of report.falsePredictions.behavioralFP) {
      console.log(`  [${r.entry.id}] ${truncate(r.entry.text)}`);
    }
  }

  if (report.falsePredictions.quoteFP.length > 0) {
    console.log("\n" + sep);
    console.log("  MESSAGE-LEVEL QUOTE FALSE POSITIVES");
    console.log(sep);
    for (const r of report.falsePredictions.quoteFP) {
      const category = r.entry.quote_fp_category ?? "inferred";
      console.log(`  [${r.entry.id}] ${category}  ${truncate(r.entry.text)}`);
    }
  }

  if (g.falsePositiveBundles.length > 0) {
    console.log("\n" + sep);
    console.log("  GROUPED FALSE POSITIVE BUNDLES");
    console.log(sep);
    for (const r of g.falsePositiveBundles) {
      console.log(
        `  [${r.group.id}] spurious=${r.falsePositiveFamilies.join(", ")}  ${r.group.description}`
      );
    }
  }

  if (g.falseNegativeBundles.length > 0) {
    console.log("\n" + sep);
    console.log("  GROUPED FALSE NEGATIVE BUNDLES");
    console.log(sep);
    for (const r of g.falseNegativeBundles) {
      console.log(
        `  [${r.group.id}] missing=${r.falseNegativeFamilies.join(", ")}  ${r.group.description}`
      );
    }
  }

  if (report.llmLfComparison?.parseFailureExamples.length) {
    console.log("\n" + sep);
    console.log("  LLM LF PARSE FAILURES");
    console.log(sep);
    for (const example of report.llmLfComparison.parseFailureExamples) {
      console.log(
        `  [${example.entryId}] ${example.parseStatus}  ${truncate(example.rationale)}`
      );
    }
  }

  if (report.llmLfComparison?.falsePositiveExamples.length) {
    console.log("\n" + sep);
    console.log("  LLM LF FALSE POSITIVES");
    console.log(sep);
    for (const example of report.llmLfComparison.falsePositiveExamples) {
      console.log(
        `  [${example.entryId}] llm=${example.llmLabel} gold=${example.goldLabel}  ${truncate(example.text)}`
      );
    }
  }

  if (report.llmLfComparison?.disagreements.length) {
    console.log("\n" + sep);
    console.log("  LLM LF DISAGREEMENTS");
    console.log(sep);
    for (const example of report.llmLfComparison.disagreements) {
      console.log(
        `  [${example.entryId}] heuristic=${example.heuristicLabel} llm=${example.llmLabel} gold=${example.goldLabel}`
      );
    }
  }

  console.log("\n" + sep);
  console.log("  REGRESSION GATES");
  console.log(sep);
  for (const gate of report.regressionGates) {
    const actual = formatGateValue(gate.name, gate.actual);
    const threshold =
      gate.threshold === 1 && gate.name.includes("blocked")
        ? "required"
        : formatGateValue(gate.name, gate.threshold);
    console.log(`  ${pass(gate.passed).padEnd(4)}  ${gate.name}  actual=${actual}  threshold=${threshold}`);
  }

  {
    const va = report.visibleAbstention;
    console.log("\n" + sep);
    console.log("  VISIBLE CLAIM ABSTENTION SCORING");
    console.log(sep);
    console.log(`  Emitted claims scored    : ${va.totalEmittedClaims}`);
    console.log(`  Surfaced                 : ${va.totalSurfaced}`);
    console.log(`  Abstained                : ${va.totalAbstained}`);
    console.log(
      `  Coverage rate            : ${pct(va.coverageRate)}  (threshold=${(va.abstentionThreshold * 100).toFixed(0)}%)`
    );
    console.log(`  Abstention rate          : ${pct(va.abstentionRate)}`);
    if (va.scoreDistribution.min !== null) {
      console.log(
        `  Score distribution       : min=${va.scoreDistribution.min.toFixed(3)}  max=${(va.scoreDistribution.max ?? 0).toFixed(3)}  mean=${(va.scoreDistribution.mean ?? 0).toFixed(3)}`
      );
    }
    if (va.conditionalFaithfulnessRate !== null) {
      console.log(`  Conditional faithfulness : ${pct(va.conditionalFaithfulnessRate)}`);
    }
  }

  if (report.visibleCalibration) {
    const cal = report.visibleCalibration;
    const policyDiagnostics = summarizeVisibleAbstentionPolicyArtifact({
      policyArtifact: buildVisibleAbstentionPolicyArtifact(report),
    });
    console.log("\n" + sep);
    console.log("  VISIBLE CLAIM CALIBRATION");
    console.log(sep);
    console.log(`  Target failure rate      : ${(CALIBRATION_TARGET_FAILURE_RATE * 100).toFixed(0)}%`);
    console.log(`  Coverage floor (gate)    : ${(CALIBRATION_COVERAGE_FLOOR * 100).toFixed(0)}%`);
    console.log(`  Sufficiency floor (gate) : ${CALIBRATION_DATA_SUFFICIENCY_FLOOR} eligible claims`);
    console.log(`  Eligible claims          : ${cal.eligibleClaims}`);
    if (cal.eligibleClaims === 0) {
      console.log(`  Selected threshold       : n/a  (no eligible claims)`);
    } else if (cal.selectedThreshold === null) {
      console.log(`  Selected threshold       : n/a`);
    } else {
      const sr = cal.selectedRow!;
      const policy = cal.policy!;
      console.log(`  Selected threshold       : ${cal.selectedThreshold.toFixed(2)}${policy.fallbackUsed ? "  (fallback — no threshold met target)" : ""}`);
      console.log(`  Selection reason         : ${policy.selectionReason}`);
      console.log(`  Coverage at selected     : ${pct(sr.coverageRate)}  (${sr.surfacedClaims}/${sr.eligibleClaims} surfaced)`);
      console.log(`  Failure rate at selected : ${pct(sr.failureRate)}  (${sr.failureCount} bad of ${sr.surfacedClaims} surfaced)`);
      console.log(`  Fallback used            : ${policy.fallbackUsed ? "yes" : "no"}`);
      console.log(`  Runtime threshold source : ${policyDiagnostics.thresholdSource}`);
      console.log(`  Runtime threshold used   : ${policyDiagnostics.thresholdUsed.toFixed(2)}`);
      console.log(`  Runtime fallback reason  : ${policyDiagnostics.fallbackReason ?? "none"}`);
      console.log(`  Artifact consumable      : ${policyDiagnostics.artifactConsumable ? "yes" : "no"}`);
      // Print compact threshold table: just the rows near the selected threshold
      // and the rows that satisfy the target failure rate
      console.log(`\n  Threshold grid (threshold / coverage / failure rate):`);
      console.log(`  ${"threshold".padEnd(12)} ${"coverage".padStart(9)} ${"failure".padStart(9)} ${"surfaced".padStart(9)}`);
      console.log(`  ${"─".repeat(44)}`);
      for (const row of cal.rows) {
        const isSel = row.threshold === cal.selectedThreshold ? " ← selected" : "";
        const meetsTarget =
          row.failureRate === null || row.failureRate <= cal.targetFailureRate;
        const flag = isSel || (!meetsTarget && row.eligibleClaims > 0) ? isSel || " (over target)" : "";
        console.log(
          `  ${row.threshold.toFixed(2).padEnd(12)} ${pct(row.coverageRate).padStart(9)} ${pct(row.failureRate).padStart(9)} ${String(row.surfacedClaims).padStart(9)}${flag}`
        );
      }
    }
  }

  if (report.faithfulness) {
    const f = report.faithfulness;
    console.log("\n" + sep);
    console.log("  FAITHFULNESS SCORING  (shadow-mode, evaluator-time only)");
    console.log(sep);
    console.log(`  Scored claims          : ${f.scoredClaims}`);
    console.log(`  Faithful               : ${f.faithfulCount}`);
    console.log(`  Unfaithful             : ${f.unfaithfulCount}`);
    console.log(`  Parse failures         : ${f.parseFailureCount}`);
    console.log(`  Authority violations   : ${f.authoritativeViolations}`);
    console.log(
      `  Faithful rate          : ${pct(f.faithfulRate)}  (floor=${(f.regressionGate.threshold * 100).toFixed(0)}%)`
    );
    console.log(
      `  Gate  ${pass(f.regressionGate.passed).padEnd(4)}  faithfulness_floor  actual=${pct(f.faithfulRate)}  threshold=${pct(f.regressionGate.threshold)}`
    );
    if (f.unfaithfulClaims.length > 0) {
      console.log(`\n  Unfaithful / failed claims:`);
      for (const claim of f.unfaithfulClaims) {
        console.log(
          `  [${claim.groupId}:${claim.family}] ${claim.parseStatus}  ${truncate(claim.rationale)}`
        );
        console.log(`    summary: ${truncate(claim.visibleSummary)}`);
      }
    }
  }

  if (report.rationaleSufficiency) {
    const r = report.rationaleSufficiency;
    console.log("\n" + sep);
    console.log("  RATIONALE SUFFICIENCY  (shadow-mode, evaluator-time only)");
    console.log(sep);
    console.log(`  Total claims considered: ${r.totalClaimsConsidered}`);
    console.log(`  Scored claims          : ${r.scoredClaims}`);
    console.log(`  Sufficient             : ${r.sufficientCount}`);
    console.log(`  Insufficient           : ${r.insufficientCount}`);
    console.log(`  Parse failures         : ${r.parseFailureCount}`);
    console.log(`  Original parse failures: ${r.originalParseFailureClaims}`);
    console.log(`  Rationale parse failures: ${r.rationaleParseFailureClaims}`);
    console.log(`  Summary stable         : ${r.summaryStableCount}`);
    console.log(`  Summary drift          : ${r.summaryDriftCount}`);
    console.log(`  Faithfulness stable    : ${r.faithfulnessStableCount}`);
    console.log(`  Faithfulness drift     : ${r.faithfulnessDriftCount}`);
    console.log(`  Preferred bundles      : ${r.preferredReceiptBundleClaims}`);
    console.log(`  Fallback bundles       : ${r.fallbackReceiptBundleClaims}`);
    console.log(`  Sufficiency rate       : ${pct(r.sufficiencyRate)}`);
    console.log(`  Summary stability rate : ${pct(r.summaryStabilityRate)}`);
    console.log(`  Faithfulness stab. rate: ${pct(r.faithfulnessStabilityRate)}`);
    if (r.inspectableClaims.length > 0) {
      console.log(`\n  Inspectable insufficient / failed cases:`);
      for (const claim of r.inspectableClaims) {
        console.log(
          `  [${claim.groupId}:${claim.family}] originalFaithful=${String(claim.originalFaithful)} rationaleFaithful=${String(claim.rationaleFaithful)}`
        );
        console.log(
          `    originalParse=${claim.originalParseStatus} rationaleParse=${claim.rationaleFaithfulnessParseStatus} summaryStable=${String(claim.summaryStableFromRationale)} faithfulnessStable=${String(claim.faithfulnessStableFromRationale)} sufficient=${String(claim.rationaleSufficient)}`
        );
        console.log(
          `    bundleSource=${claim.rationaleBundleSource} originalReceipts=${claim.originalReceiptCount} rationaleReceipts=${claim.rationaleReceiptCount} reasons=${claim.sufficiencyReasons.join(", ") || "none"}`
        );
        console.log(`    summary: ${truncate(claim.visibleSummary)}`);
        console.log(`    rationale receipts: ${truncate(claim.rationaleReceiptQuotes.join(" | "))}`);
      }
    }
  }

  if (report.rationaleMinimality) {
    const r = report.rationaleMinimality;
    console.log("\n" + sep);
    console.log("  RATIONALE MINIMALITY / COMPREHENSIVENESS");
    console.log(sep);
    console.log(`  Eligible claims        : ${r.totalEligibleClaims}`);
    console.log(`  Minimal claims         : ${r.minimalClaims}`);
    console.log(`  Bloated claims         : ${r.bloatedClaims}`);
    console.log(`  Globally minimal       : ${r.globallyMinimalClaims}`);
    console.log(`  Non-minimal            : ${r.nonMinimalClaims}`);
    console.log(`  Global minimality rate : ${pct(r.globallyMinimalRate)}`);
    console.log(`  Mean minimality rate   : ${pct(r.meanMinimalityRate)}`);
    console.log(`  Total rationale checks : ${r.totalRationaleSubsetChecks}`);
    console.log(`  Total complement checks: ${r.totalComplementSubsetChecks}`);
    console.log(`  Mean rationale checks  : ${r.meanRationaleSubsetChecksPerClaim?.toFixed(2) ?? "n/a"}`);
    console.log(`  Mean complement checks : ${r.meanComplementSubsetChecksPerClaim?.toFixed(2) ?? "n/a"}`);
    console.log(`  Max rationale checks   : ${r.maxRationaleSubsetChecksPerClaim}`);
    console.log(`  Max complement checks  : ${r.maxComplementSubsetChecksPerClaim}`);
    console.log(`  Rationale search skipped: ${r.rationaleSubsetSearchSkippedClaims}`);
    console.log(`  Complement search skipped: ${r.complementSubsetSearchSkippedClaims}`);
    console.log(`  Over-cap rationale claims: ${r.rationaleSubsetSearchOverCapClaims}`);
    console.log(`  Over-cap complement claims: ${r.complementSubsetSearchOverCapClaims}`);
    console.log(`  Unknown minimality    : ${r.unknownMinimalityClaims}`);
    console.log(`  Unknown alt support   : ${r.unknownAlternativeSupportClaims}`);
    console.log(
      `  Unknown min reasons   : skipped=${r.unknownMinimalityReasonCounts.subset_search_skipped} indeterminate=${r.unknownMinimalityReasonCounts.path_indeterminate}`
    );
    console.log(
      `  Unknown alt reasons   : skipped=${r.unknownAlternativeSupportReasonCounts.subset_search_skipped} indeterminate=${r.unknownAlternativeSupportReasonCounts.path_indeterminate}`
    );
    console.log(`  Rationale search rate : ${pct(r.searchedRationaleSubsetRate)}`);
    console.log(`  Complement search rate: ${pct(r.searchedComplementSubsetRate)}`);
    console.log(`  Unknown minimality rt : ${pct(r.unknownMinimalityRate)}`);
    console.log(`  Unknown alt sup. rt   : ${pct(r.unknownAlternativeSupportRate)}`);
    console.log(`  Bloated by delta      : ${r.bloatedByDeltaClaims}`);
    console.log(`  Mean chosen-min delta : ${r.meanChosenVsMinimalSubsetDelta?.toFixed(2) ?? "n/a"}`);
    console.log(`  Alternative support    : ${r.alternativeSupportClaims}`);
    console.log(`  No alt support         : ${r.noAlternativeSupportClaims}`);
    console.log(`  Alternative sup. rate  : ${pct(r.alternativeSupportRate)}`);
    console.log(`  Competitive alt sup.   : ${r.competitiveAlternativeSupportClaims}`);
    console.log(`  Noncompetitive alt sup.: ${r.nonCompetitiveAlternativeSupportClaims}`);
    console.log(`  Competitive alt rate   : ${pct(r.competitiveAlternativeSupportRate)}`);
    console.log(`  Strong comprehensive   : ${r.strongComprehensivenessCount}`);
    console.log(`  Partial comprehensive  : ${r.partialComprehensivenessCount}`);
    console.log(`  No comprehensiveness   : ${r.noComprehensivenessCount}`);
    console.log(`  Inspectable skipped    : ${r.skippedSearchInspectableCount}`);
    console.log(`  Inspectable indeterminate: ${r.indeterminateInspectableCount}`);
    console.log(`  Inspectable non-minimal: ${r.nonMinimalInspectableCount}`);
    console.log(`  Inspectable competitive: ${r.competitiveAlternativeSupportInspectableCount}`);
    console.log(`  Inspectable bloated    : ${r.bloatedInspectableCount}`);
    if (r.inspectableClaims.length > 0) {
      console.log(`\n  Inspectable minimality/comprehensiveness cases:`);
      for (const claim of r.inspectableClaims) {
        console.log(
          `  [${claim.groupId}:${claim.family}] critical=${claim.criticalQuoteCount} redundant=${claim.redundantQuoteCount} minimality=${pct(claim.minimalityRate)} globalMinimal=${String(claim.rationaleGloballyMinimal)} altSupport=${claim.alternativeSupportStrength ?? "null"} comprehensiveness=${claim.comprehensivenessEffect ?? "null"}`
        );
        console.log(`    rationale: ${truncate(claim.rationaleReceiptQuotes.join(" | "))}`);
        console.log(`    complement: ${truncate(claim.complementReceiptQuotes.join(" | "))}`);
        console.log(
          `    unknown reasons: minimality=${claim.unknownMinimalityReason ?? "null"} altSupport=${claim.unknownAlternativeSupportReason ?? "null"}`
        );
        console.log(
          `    quote counts: rationale=${claim.rationaleQuoteCount} minimal=${claim.minimalPreservingSubsetSize ?? "null"} chosenDelta=${claim.chosenVsMinimalSubsetDelta ?? "null"}`
        );
        console.log(
          `    complement deltas: minimalComplement=${claim.minimalComplementSupportingSubsetSize ?? "null"} complementDelta=${claim.complementVsMinimalSubsetDelta ?? "null"} competitive=${String(claim.competitiveAlternativeSupport)}`
        );
        console.log(
          `    rationale subset search: performed=${String(claim.rationaleSubsetSearchPerformed)} overCap=${String(claim.rationaleSubsetSearchOverCap)} cap=${claim.rationaleSearchCapUsed} checked=${claim.rationaleSubsetCountChecked} best=${truncate(claim.minimalPreservingSubsetQuotes.join(" | "))} size=${claim.minimalPreservingSubsetSize ?? "null"}`
        );
        console.log(
          `    complement subset search: performed=${String(claim.complementSubsetSearchPerformed)} overCap=${String(claim.complementSubsetSearchOverCap)} cap=${claim.complementSearchCapUsed} checked=${claim.complementSubsetCountChecked} exists=${String(claim.complementSupportingSubsetExists)} best=${truncate(claim.minimalComplementSupportingSubsetQuotes.join(" | "))} size=${claim.minimalComplementSupportingSubsetSize ?? "null"}`
        );
      }
    }
  }

  if (report.reviewRouting) {
    const rr = report.reviewRouting;
    console.log("\n" + sep);
    console.log("  REVIEW ROUTING  (shadow-mode, evaluator-time only)");
    console.log(sep);
    console.log(`  Groups evaluated   : ${rr.totalGroups}`);
    console.log(`  Flagged for review : ${rr.flaggedCount}  (${pct(rr.flaggedRate)})`);
    console.log(
      `  Priority dist      : high=${rr.priorityDistribution.high}  medium=${rr.priorityDistribution.medium}  low=${rr.priorityDistribution.low}`
    );
    console.log(
      `  Faithfulness incl. : ${rr.faithfulnessIncluded ? "yes" : "no (scoring off)"}`
    );
    if (Object.keys(rr.reasonDistribution).length > 0) {
      console.log(`\n  Reason distribution:`);
      for (const [reason, count] of Object.entries(rr.reasonDistribution)) {
        console.log(`  ${reason.padEnd(30)} ${String(count).padStart(3)}`);
      }
    }
    if (rr.flaggedGroups.length > 0) {
      console.log(`\n  Flagged groups:`);
      for (const flag of rr.flaggedGroups) {
        const families = flag.emittedFamilies.join(", ") || "none";
        const priority = flag.review_priority ?? "—";
        const reasons = flag.review_reasons.join(", ");
        console.log(
          `  [${flag.groupId}] priority=${priority}  families=${families}`
        );
        console.log(`    reasons: ${reasons}`);
      }
    }
  }

  console.log(`\n  Overall gates: ${pass(report.allRegressionGatesPassed)}`);
  console.log("\n" + dbl + "\n");
}

export async function runPatternEvaluator(): Promise<EvalReport> {
  ensureReviewResolutionLog();
  const messageEntries = loadMessageDataset();
  const groupedEntries = loadGroupedDataset();
  const llmLfOutputs = loadLlmLfShadowDataset();

  // undefined = not yet determined (repo-local fallback in buildEvalReport)
  // non-null = live scoring succeeded
  let faithfulnessReport: FaithfulnessReport | undefined = undefined;
  let faithfulnessAllScores: FaithfulnessClaimScore[] | undefined = undefined;
  if (shouldRunFaithfulnessScoring()) {
    try {
      // Re-evaluate groups to get clueQuotes; deterministic so result is identical to buildEvalReport's run.
      const groupedResults = groupedEntries.map(evaluateGroup);
      // Default invoker: uses OpenAI gpt-4o-mini — only active when flag is on and OPENAI_API_KEY is set.
      // Dynamically imported to keep the default path free of LLM dependencies.
      const { generateText } = await import("ai");
      const { openai } = await import("@ai-sdk/openai");
      const modelId =
        process.env.MINDLAB_FAITHFULNESS_MODEL ?? "gpt-4o-mini";
      const defaultFaithfulnessInvoker: FaithfulnessInvoker = async ({ visibleSummary, receiptQuotes }) => {
        const { buildFaithfulnessPrompt } = await import("../lib/eval/pattern-evaluator");
        const prompt = buildFaithfulnessPrompt({ visibleSummary, receiptQuotes });
        const response = await generateText({
          model: openai(modelId),
          prompt,
          temperature: 0,
          maxOutputTokens: 120,
        });
        return { rawOutput: response.text };
      };
      const faithfulnessResult = await computeFaithfulnessForGroups(groupedResults, defaultFaithfulnessInvoker);
      faithfulnessReport = faithfulnessResult.report;
      faithfulnessAllScores = faithfulnessResult.allScores;
    } catch {
      // Invoker error — remain undefined so buildEvalReport falls back to repo-local baseline.
    }
  }

  const report = buildEvalReport(messageEntries, groupedEntries, undefined, llmLfOutputs, faithfulnessReport, faithfulnessAllScores);
  writeLatestReport(report);
  writeVisibleAbstentionPolicyArtifact(buildVisibleAbstentionPolicyArtifact(report));
  const reviewQueueArtifact: ReviewQueueArtifact = buildReviewQueueArtifact(report);
  writeReviewQueueJson(reviewQueueArtifact, DEFAULT_REVIEW_QUEUE_JSON_PATH);
  writeReviewQueueCsv(reviewQueueArtifact.items, DEFAULT_REVIEW_QUEUE_CSV_PATH);
  console.log(
    `[review-queue] ${reviewQueueArtifact.items.length} items written to ${DEFAULT_REVIEW_QUEUE_JSON_PATH}` +
    ` | complete=${reviewQueueArtifact.completeness.orderingChecksPassed ? "yes" : "no"}` +
    ` | multi_family=${reviewQueueArtifact.summary.multiFamilyItemCount}` +
    (reviewQueueArtifact.items.length > 0
      ? ` | top=${reviewQueueArtifact.items.slice(0, 3).map((item) => `${item.groupId}:${item.priority}`).join(", ")}`
      : "")
  );
  printReport(report);
  return report;
}

function main(): void {
  runPatternEvaluator()
    .then((report) => {
      process.exitCode = report.allRegressionGatesPassed ? 0 : 1;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

if (require.main === module) {
  main();
}
