import * as fs from "fs";
import * as path from "path";
import type { PatternClaimView } from "./patterns-api";
import {
  buildPersistedClaimEvidenceBundle,
  type PersistedPatternClaimEvidenceRecord,
} from "./pattern-claim-evidence";
import {
  buildCanonicalVisibleSupportBundle,
  type VisiblePatternClaimRecord,
} from "./pattern-visible-claim";
import type { VisibleAbstentionPolicyArtifact } from "./eval/eval-types";

export const DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH = path.join(
  process.cwd(),
  "eval/patterns/reports/persisted-claim-replay.json"
);

export type PersistedClaimReplayDivergenceReason =
  | "summary_mismatch"
  | "surfaced_mismatch"
  | "evidence_count_mismatch"
  | "threshold_mismatch"
  | "display_safe_mismatch"
  | "rationale_bundle_mismatch"
  | "support_bundle_incomplete";

export type PersistedClaimReplaySummary = {
  replayedClaims: number;
  completeSupportBundles: number;
  incompleteSupportBundles: number;
  divergentClaims: number;
  cleanMatchClaims: number;
  cleanMatchPartialHistoricalStateClaims: number;
  incompleteSupportBundleClaims: number;
  summaryDriftClaims: number;
  surfaceStateDriftClaims: number;
  supportBundleDriftClaims: number;
  multiDriftClaims: number;
  summaryMismatchClaims: number;
  surfacedMismatchClaims: number;
  evidenceCountMismatchClaims: number;
  thresholdMismatchClaims: number;
  displaySafeMismatchClaims: number;
  rationaleBundleMismatchClaims: number;
  policyArtifactThresholdClaims: number;
  constantFallbackThresholdClaims: number;
  contradictionDriftClaims: number;
  replaySurfacedClaims: number;
  replaySuppressedClaims: number;
  missingSummaryTextClaims: number;
  missingEvidenceClaims: number;
  missingReplayableQuotesClaims: number;
  missingThresholdClaims: number;
  missingRationaleBundleClaims: number;
  missingDisplaySafeClaims: number;
  divergenceReasonCounts: Record<PersistedClaimReplayDivergenceReason, number>;
};

export type PersistedClaimReplayResult = {
  claimId: string;
  patternType: PatternClaimView["patternType"];
  replayOutcome:
    | "clean_match"
    | "clean_match_partial_historical_state"
    | "incomplete_support_bundle"
    | "summary_drift"
    | "surface_state_drift"
    | "support_bundle_drift"
    | "multi_drift";
  replayOutcomeSeverityRank: number;
  persisted: {
    summaryText: string | null;
    surfaced: boolean | null;
    evidenceCount: number | null;
    thresholdUsed: number | null;
    displaySafeQuoteStatus: boolean | null;
    rationaleBundleQuotes: string[];
  };
  replayed: {
    summaryText: string | null;
    surfaced: boolean;
    evidenceCount: number;
    thresholdUsed: number;
    thresholdSource: "policy_artifact" | "constant_fallback";
    displaySafeQuoteStatus: boolean;
    rationaleBundleSource: "persisted_evidence_quotes";
    supportBundleSource: "replay_derived";
    rationaleBundleQuotes: string[];
  };
  canonicalSupportBundle: {
    summaryText: string | null;
    evidenceCount: number;
    displaySafeQuoteStatus: boolean;
    thresholdUsed: number;
    thresholdSource: "policy_artifact" | "constant_fallback";
    rationaleBundleSource: "persisted_evidence_quotes";
    supportBundleSource: "replay_derived";
    rationaleBundleQuotes: string[];
  };
  completeness: {
    supportBundleComplete: boolean;
    missingFields: string[];
    hasSummaryText: boolean;
    hasEvidence: boolean;
    hasReplayableQuotes: boolean;
    hasThreshold: boolean;
    hasRationaleBundle: boolean;
  };
  divergence: {
    summaryMismatch: boolean;
    surfacedMismatch: boolean;
    evidenceCountMismatch: boolean;
    thresholdMismatch: boolean;
    displaySafeMismatch: boolean;
    rationaleBundleMismatch: boolean;
    incompleteSupportBundle: boolean;
    divergenceReasons: PersistedClaimReplayDivergenceReason[];
    any: boolean;
  };
};

export type PersistedPatternClaimReplayBatchResult = {
  results: PersistedClaimReplayResult[];
  inspectableResults: PersistedClaimReplayResult[];
  summary: PersistedClaimReplaySummary;
};

export type PersistedPatternClaimReplayInput = {
  claim: VisiblePatternClaimRecord;
  evidence: PersistedPatternClaimEvidenceRecord[];
  persistedSurfaceState?: {
    surfaced?: boolean | null;
    evidenceCount?: number | null;
    thresholdUsed?: number | null;
    displaySafeQuoteStatus?: boolean | null;
    rationaleBundleQuotes?: string[] | null;
  };
  policyArtifact?: VisibleAbstentionPolicyArtifact | null;
  policyArtifactPath?: string;
  abstentionThreshold?: number;
};

function normalizeQuoteArray(quotes: string[] | null | undefined): string[] {
  return (quotes ?? [])
    .map((quote) => quote.trim())
    .filter((quote) => quote.length > 0);
}

export function areNormalizedRationaleBundlesEqual(
  a: string[] | null | undefined,
  b: string[] | null | undefined
): boolean {
  const normalizedA = normalizeQuoteArray(a);
  const normalizedB = normalizeQuoteArray(b);
  return arraysEqual(normalizedA, normalizedB);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function buildDivergenceReasons(flags: Omit<PersistedClaimReplayResult["divergence"], "any" | "divergenceReasons">): PersistedClaimReplayDivergenceReason[] {
  return [
    flags.summaryMismatch ? "summary_mismatch" : null,
    flags.surfacedMismatch ? "surfaced_mismatch" : null,
    flags.evidenceCountMismatch ? "evidence_count_mismatch" : null,
    flags.thresholdMismatch ? "threshold_mismatch" : null,
    flags.displaySafeMismatch ? "display_safe_mismatch" : null,
    flags.rationaleBundleMismatch ? "rationale_bundle_mismatch" : null,
    flags.incompleteSupportBundle ? "support_bundle_incomplete" : null,
  ].filter((reason): reason is PersistedClaimReplayDivergenceReason => reason !== null);
}

function getReplayOutcome(
  result: Omit<PersistedClaimReplayResult, "replayOutcome" | "replayOutcomeSeverityRank">
): PersistedClaimReplayResult["replayOutcome"] {
  if (result.divergence.incompleteSupportBundle) return "incomplete_support_bundle";
  if (!result.divergence.any) {
    const partialHistoricalState =
      result.persisted.surfaced === null ||
      result.persisted.evidenceCount === null ||
      result.persisted.thresholdUsed === null ||
      result.persisted.displaySafeQuoteStatus === null ||
      result.persisted.rationaleBundleQuotes.length === 0;
    return partialHistoricalState ? "clean_match_partial_historical_state" : "clean_match";
  }
  const mismatchCount = result.divergence.divergenceReasons.filter(
    (reason) => reason !== "support_bundle_incomplete"
  ).length;
  if (mismatchCount > 1) return "multi_drift";
  if (result.divergence.summaryMismatch) return "summary_drift";
  if (result.divergence.surfacedMismatch) return "surface_state_drift";
  return "support_bundle_drift";
}

function getReplayOutcomeSeverityRank(
  outcome: PersistedClaimReplayResult["replayOutcome"]
): number {
  switch (outcome) {
    case "incomplete_support_bundle":
      return 0;
    case "summary_drift":
      return 1;
    case "surface_state_drift":
      return 2;
    case "support_bundle_drift":
      return 3;
    case "multi_drift":
      return 4;
    case "clean_match_partial_historical_state":
      return 5;
    case "clean_match":
      return 6;
  }
}

function compareReplayResults(a: PersistedClaimReplayResult, b: PersistedClaimReplayResult): number {
  const severity = a.replayOutcomeSeverityRank - b.replayOutcomeSeverityRank;
  if (severity !== 0) return severity;
  const reasonsA = a.divergence.divergenceReasons.join("|");
  const reasonsB = b.divergence.divergenceReasons.join("|");
  const reasonCmp = reasonsA.localeCompare(reasonsB);
  if (reasonCmp !== 0) return reasonCmp;
  return a.claimId.localeCompare(b.claimId);
}

export function assessPersistedClaimSupportBundleCompleteness(args: {
  summaryText: string | null;
  evidenceCount: number;
  replayableQuotes: string[];
  thresholdUsed: number | null;
  displaySafeQuoteStatus: boolean | null;
}): PersistedClaimReplayResult["completeness"] {
  const hasSummaryText = typeof args.summaryText === "string" && args.summaryText.trim().length > 0;
  const hasEvidence = args.evidenceCount > 0;
  const hasReplayableQuotes = args.replayableQuotes.length > 0;
  const hasThreshold =
    typeof args.thresholdUsed === "number" && Number.isFinite(args.thresholdUsed);
  const hasRationaleBundle = args.replayableQuotes.length > 0;
  const missingFields = [
    !hasSummaryText ? "summaryText" : null,
    !hasEvidence ? "evidence" : null,
    !hasReplayableQuotes ? "replayableQuotes" : null,
    !hasThreshold ? "thresholdUsed" : null,
    !hasRationaleBundle ? "rationaleBundleQuotes" : null,
    args.displaySafeQuoteStatus === null ? "displaySafeQuoteStatus" : null,
  ].filter((field): field is string => field !== null);

  return {
    supportBundleComplete: missingFields.length === 0,
    missingFields,
    hasSummaryText,
    hasEvidence,
    hasReplayableQuotes,
    hasThreshold,
    hasRationaleBundle,
  };
}

export function comparePersistedClaimToReplay(args: {
  persisted: PersistedClaimReplayResult["persisted"];
  replayed: PersistedClaimReplayResult["replayed"];
  completeness: PersistedClaimReplayResult["completeness"];
  compareFlags: {
    surfaced: boolean;
    evidenceCount: boolean;
    thresholdUsed: boolean;
    displaySafeQuoteStatus: boolean;
    rationaleBundleQuotes: boolean;
  };
}): PersistedClaimReplayResult["divergence"] {
  const summaryMismatch = args.persisted.summaryText !== args.replayed.summaryText;
  const surfacedMismatch =
    args.compareFlags.surfaced && args.persisted.surfaced !== args.replayed.surfaced;
  const evidenceCountMismatch =
    args.compareFlags.evidenceCount &&
    args.persisted.evidenceCount !== args.replayed.evidenceCount;
  const thresholdMismatch =
    args.compareFlags.thresholdUsed &&
    args.persisted.thresholdUsed !== args.replayed.thresholdUsed;
  const displaySafeMismatch =
    args.compareFlags.displaySafeQuoteStatus &&
    args.persisted.displaySafeQuoteStatus !== args.replayed.displaySafeQuoteStatus;
  const rationaleBundleMismatch =
    args.compareFlags.rationaleBundleQuotes &&
    !areNormalizedRationaleBundlesEqual(
      args.persisted.rationaleBundleQuotes,
      args.replayed.rationaleBundleQuotes
    );
  const incompleteSupportBundle = !args.completeness.supportBundleComplete;
  const divergenceReasons = buildDivergenceReasons({
    summaryMismatch,
    surfacedMismatch,
    evidenceCountMismatch,
    thresholdMismatch,
    displaySafeMismatch,
    rationaleBundleMismatch,
    incompleteSupportBundle,
  });
  const any =
    divergenceReasons.length > 0;

  return {
    summaryMismatch,
    surfacedMismatch,
    evidenceCountMismatch,
    thresholdMismatch,
    displaySafeMismatch,
    rationaleBundleMismatch,
    incompleteSupportBundle,
    divergenceReasons,
    any,
  };
}

export function computePersistedClaimReplaySummary(
  results: PersistedClaimReplayResult[]
): PersistedClaimReplaySummary {
  return results.reduce<PersistedClaimReplaySummary>(
    (summary, result) => ({
      replayedClaims: summary.replayedClaims + 1,
      completeSupportBundles:
        summary.completeSupportBundles + (result.completeness.supportBundleComplete ? 1 : 0),
      incompleteSupportBundles:
        summary.incompleteSupportBundles + (result.completeness.supportBundleComplete ? 0 : 1),
      divergentClaims: summary.divergentClaims + (result.divergence.any ? 1 : 0),
      cleanMatchClaims: summary.cleanMatchClaims + (result.replayOutcome === "clean_match" ? 1 : 0),
      cleanMatchPartialHistoricalStateClaims:
        summary.cleanMatchPartialHistoricalStateClaims +
        (result.replayOutcome === "clean_match_partial_historical_state" ? 1 : 0),
      incompleteSupportBundleClaims:
        summary.incompleteSupportBundleClaims +
        (result.replayOutcome === "incomplete_support_bundle" ? 1 : 0),
      summaryDriftClaims: summary.summaryDriftClaims + (result.replayOutcome === "summary_drift" ? 1 : 0),
      surfaceStateDriftClaims:
        summary.surfaceStateDriftClaims + (result.replayOutcome === "surface_state_drift" ? 1 : 0),
      supportBundleDriftClaims:
        summary.supportBundleDriftClaims + (result.replayOutcome === "support_bundle_drift" ? 1 : 0),
      multiDriftClaims: summary.multiDriftClaims + (result.replayOutcome === "multi_drift" ? 1 : 0),
      summaryMismatchClaims:
        summary.summaryMismatchClaims + (result.divergence.summaryMismatch ? 1 : 0),
      surfacedMismatchClaims:
        summary.surfacedMismatchClaims + (result.divergence.surfacedMismatch ? 1 : 0),
      evidenceCountMismatchClaims:
        summary.evidenceCountMismatchClaims +
        (result.divergence.evidenceCountMismatch ? 1 : 0),
      thresholdMismatchClaims:
        summary.thresholdMismatchClaims + (result.divergence.thresholdMismatch ? 1 : 0),
      displaySafeMismatchClaims:
        summary.displaySafeMismatchClaims + (result.divergence.displaySafeMismatch ? 1 : 0),
      rationaleBundleMismatchClaims:
        summary.rationaleBundleMismatchClaims +
        (result.divergence.rationaleBundleMismatch ? 1 : 0),
      policyArtifactThresholdClaims:
        summary.policyArtifactThresholdClaims +
        (result.replayed.thresholdSource === "policy_artifact" ? 1 : 0),
      constantFallbackThresholdClaims:
        summary.constantFallbackThresholdClaims +
        (result.replayed.thresholdSource === "constant_fallback" ? 1 : 0),
      contradictionDriftClaims:
        summary.contradictionDriftClaims + (result.patternType === "contradiction_drift" ? 1 : 0),
      replaySurfacedClaims: summary.replaySurfacedClaims + (result.replayed.surfaced ? 1 : 0),
      replaySuppressedClaims: summary.replaySuppressedClaims + (result.replayed.surfaced ? 0 : 1),
      missingSummaryTextClaims:
        summary.missingSummaryTextClaims +
        (result.completeness.missingFields.includes("summaryText") ? 1 : 0),
      missingEvidenceClaims:
        summary.missingEvidenceClaims +
        (result.completeness.missingFields.includes("evidence") ? 1 : 0),
      missingReplayableQuotesClaims:
        summary.missingReplayableQuotesClaims +
        (result.completeness.missingFields.includes("replayableQuotes") ? 1 : 0),
      missingThresholdClaims:
        summary.missingThresholdClaims +
        (result.completeness.missingFields.includes("thresholdUsed") ? 1 : 0),
      missingRationaleBundleClaims:
        summary.missingRationaleBundleClaims +
        (result.completeness.missingFields.includes("rationaleBundleQuotes") ? 1 : 0),
      missingDisplaySafeClaims:
        summary.missingDisplaySafeClaims +
        (result.completeness.missingFields.includes("displaySafeQuoteStatus") ? 1 : 0),
      divergenceReasonCounts: {
        summary_mismatch:
          summary.divergenceReasonCounts.summary_mismatch +
          (result.divergence.divergenceReasons.includes("summary_mismatch") ? 1 : 0),
        surfaced_mismatch:
          summary.divergenceReasonCounts.surfaced_mismatch +
          (result.divergence.divergenceReasons.includes("surfaced_mismatch") ? 1 : 0),
        evidence_count_mismatch:
          summary.divergenceReasonCounts.evidence_count_mismatch +
          (result.divergence.divergenceReasons.includes("evidence_count_mismatch") ? 1 : 0),
        threshold_mismatch:
          summary.divergenceReasonCounts.threshold_mismatch +
          (result.divergence.divergenceReasons.includes("threshold_mismatch") ? 1 : 0),
        display_safe_mismatch:
          summary.divergenceReasonCounts.display_safe_mismatch +
          (result.divergence.divergenceReasons.includes("display_safe_mismatch") ? 1 : 0),
        rationale_bundle_mismatch:
          summary.divergenceReasonCounts.rationale_bundle_mismatch +
          (result.divergence.divergenceReasons.includes("rationale_bundle_mismatch") ? 1 : 0),
        support_bundle_incomplete:
          summary.divergenceReasonCounts.support_bundle_incomplete +
          (result.divergence.divergenceReasons.includes("support_bundle_incomplete") ? 1 : 0),
      },
    }),
    {
      replayedClaims: 0,
      completeSupportBundles: 0,
      incompleteSupportBundles: 0,
      divergentClaims: 0,
      cleanMatchClaims: 0,
      cleanMatchPartialHistoricalStateClaims: 0,
      incompleteSupportBundleClaims: 0,
      summaryDriftClaims: 0,
      surfaceStateDriftClaims: 0,
      supportBundleDriftClaims: 0,
      multiDriftClaims: 0,
      summaryMismatchClaims: 0,
      surfacedMismatchClaims: 0,
      evidenceCountMismatchClaims: 0,
      thresholdMismatchClaims: 0,
      displaySafeMismatchClaims: 0,
      rationaleBundleMismatchClaims: 0,
      policyArtifactThresholdClaims: 0,
      constantFallbackThresholdClaims: 0,
      contradictionDriftClaims: 0,
      replaySurfacedClaims: 0,
      replaySuppressedClaims: 0,
      missingSummaryTextClaims: 0,
      missingEvidenceClaims: 0,
      missingReplayableQuotesClaims: 0,
      missingThresholdClaims: 0,
      missingRationaleBundleClaims: 0,
      missingDisplaySafeClaims: 0,
      divergenceReasonCounts: {
        summary_mismatch: 0,
        surfaced_mismatch: 0,
        evidence_count_mismatch: 0,
        threshold_mismatch: 0,
        display_safe_mismatch: 0,
        rationale_bundle_mismatch: 0,
        support_bundle_incomplete: 0,
      },
    }
  );
}

export function replayPersistedPatternClaim(
  input: PersistedPatternClaimReplayInput
): PersistedClaimReplayResult {
  const evidenceBundle = buildPersistedClaimEvidenceBundle(input.evidence);
  const replayRecord: VisiblePatternClaimRecord = {
    ...input.claim,
    evidence: input.evidence,
  };
  const supportBundle = buildCanonicalVisibleSupportBundle(replayRecord, {
    policyArtifact: input.policyArtifact,
    policyArtifactPath: input.policyArtifactPath,
    abstentionThreshold: input.abstentionThreshold,
  });
  const persistedRationaleBundleQuotes = normalizeQuoteArray(
    input.persistedSurfaceState?.rationaleBundleQuotes
  );
  const replayedRationaleBundleQuotes = normalizeQuoteArray(supportBundle.rationaleBundleQuotes);
  const persisted = {
    summaryText: input.claim.summary ?? null,
    surfaced: input.persistedSurfaceState?.surfaced ?? null,
    evidenceCount: input.persistedSurfaceState?.evidenceCount ?? null,
    thresholdUsed: input.persistedSurfaceState?.thresholdUsed ?? null,
    displaySafeQuoteStatus: input.persistedSurfaceState?.displaySafeQuoteStatus ?? null,
    rationaleBundleQuotes: persistedRationaleBundleQuotes,
  };
  const replayed = {
    summaryText: supportBundle.summaryText,
    surfaced: supportBundle.surfaced,
    evidenceCount: supportBundle.evidenceCount,
    thresholdUsed: supportBundle.thresholdUsed,
    thresholdSource: supportBundle.thresholdSource,
    displaySafeQuoteStatus: supportBundle.displaySafeQuoteStatus,
    rationaleBundleSource: supportBundle.rationaleBundleSource,
    supportBundleSource: supportBundle.supportBundleSource,
    rationaleBundleQuotes: replayedRationaleBundleQuotes,
  };
  const completeness = assessPersistedClaimSupportBundleCompleteness({
    summaryText: supportBundle.summaryText,
    evidenceCount: evidenceBundle.evidenceCount,
    replayableQuotes: evidenceBundle.replayableQuotes,
    thresholdUsed: supportBundle.thresholdUsed,
    displaySafeQuoteStatus: supportBundle.displaySafeQuoteStatus,
  });
  const divergence = comparePersistedClaimToReplay({
    persisted,
    replayed,
    completeness,
    compareFlags: {
      surfaced: input.persistedSurfaceState?.surfaced !== undefined,
      evidenceCount: input.persistedSurfaceState?.evidenceCount !== undefined,
      thresholdUsed: input.persistedSurfaceState?.thresholdUsed !== undefined,
      displaySafeQuoteStatus:
        input.persistedSurfaceState?.displaySafeQuoteStatus !== undefined,
      rationaleBundleQuotes:
        input.persistedSurfaceState?.rationaleBundleQuotes !== undefined,
    },
  });

  const baseResult = {
    claimId: input.claim.id,
    patternType: input.claim.patternType,
    persisted,
    replayed,
    canonicalSupportBundle: {
      summaryText: supportBundle.summaryText,
      evidenceCount: supportBundle.evidenceCount,
      displaySafeQuoteStatus: supportBundle.displaySafeQuoteStatus,
      thresholdUsed: supportBundle.thresholdUsed,
      thresholdSource: supportBundle.thresholdSource,
      rationaleBundleSource: supportBundle.rationaleBundleSource,
      supportBundleSource: supportBundle.supportBundleSource,
      rationaleBundleQuotes: replayedRationaleBundleQuotes,
    },
    completeness,
    divergence,
  };
  const replayOutcome = getReplayOutcome(baseResult);

  return {
    ...baseResult,
    replayOutcome,
    replayOutcomeSeverityRank: getReplayOutcomeSeverityRank(replayOutcome),
  };
}

export function replayPersistedPatternClaimsBatch(
  inputs: PersistedPatternClaimReplayInput[]
): PersistedPatternClaimReplayBatchResult {
  const results = inputs.map((input) => replayPersistedPatternClaim(input)).sort(compareReplayResults);
  return {
    inspectableResults: results.filter(
      (result) => result.divergence.any || !result.completeness.supportBundleComplete
    ),
    summary: computePersistedClaimReplaySummary(results),
    results,
  };
}

export function writePersistedClaimReplayArtifact(
  artifact: PersistedPatternClaimReplayBatchResult,
  outPath = DEFAULT_PERSISTED_CLAIM_REPLAY_ARTIFACT_PATH
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}
