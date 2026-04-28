import type { PatternClaimActionView, PatternClaimView, PatternReceiptView } from "./patterns-api";
import { generateVisiblePatternSummary } from "./pattern-visible-summary";
import { isDisplaySafePatternQuote } from "./pattern-quote-selection";
import {
  loadVisibleAbstentionPolicyArtifact,
  isConsumableVisibleAbstentionPolicyArtifact,
  resolveVisibleAbstentionPolicyThreshold,
} from "./visible-abstention-policy";
import type { VisibleAbstentionPolicyArtifact } from "./eval/eval-types";

type VisibleEvidenceRecord = {
  id: string;
  source: string;
  sessionId: string | null;
  messageId: string | null;
  journalEntryId?: string | null;
  quote: string | null;
  createdAt: Date;
};

type VisibleActionRecord = {
  id: string;
  claimId: string;
  prompt: string;
  status: string;
  outcomeSignal: string | null;
  reflectionNote: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type CanonicalVisibleSupportBundle = {
  summaryText: string | null;
  evidenceCount: number;
  displaySafeQuoteStatus: boolean;
  thresholdUsed: number;
  thresholdSource: "policy_artifact" | "constant_fallback";
  rationaleBundleSource: "persisted_evidence_quotes";
  supportBundleSource: "replay_derived";
  rationaleBundleQuotes: string[];
  surfaced: boolean;
  sessionCount: number;
  journalEvidenceCount: number;
  journalDaySpread: number;
};

export type VisiblePatternClaimRecord = {
  id: string;
  patternType: PatternClaimView["patternType"];
  summary: string;
  status: PatternClaimView["status"];
  strengthLevel: PatternClaimView["strengthLevel"];
  createdAt: Date;
  updatedAt: Date;
  evidence: VisibleEvidenceRecord[];
  actions?: VisibleActionRecord[];
};

// ── Visible Claim Abstention Scoring ──────────────────────────────────────────

/**
 * Signal saturation points — at or above these values each signal contributes
 * its full weight to the abstention score.
 */
export const VISIBLE_CLAIM_EVIDENCE_SATURATION = 5;
export const VISIBLE_CLAIM_SESSION_SATURATION = 3;

/**
 * Per-signal weights for the visible claim abstention score.
 * Weights sum to 1.0.
 *
 *   evidence   0.35 — more receipts = stronger grounding
 *   session    0.35 — spread across more sessions = less overfitting to one context
 *   quote      0.30 — at least one display-safe quote shows the pattern is legible
 */
export const VISIBLE_CLAIM_WEIGHT_EVIDENCE = 0.35;
export const VISIBLE_CLAIM_WEIGHT_SESSION  = 0.35;
export const VISIBLE_CLAIM_WEIGHT_QUOTE    = 0.30;

/**
 * Score floor for visible surfacing.
 * Claims that score BELOW this threshold are suppressed even when a visible
 * summary exists (selective projection, not binary summary-gate only).
 *
 * This is the compile-time default. Use resolveVisibleAbstentionThreshold() in
 * any code that should respect an empirically calibrated policy when available.
 */
export const VISIBLE_ABSTENTION_THRESHOLD = 0.55;

/**
 * Minimal policy shape needed by resolveVisibleAbstentionThreshold.
 * Compatible with VisibleAbstentionPolicy from eval-types but does not import it,
 * keeping the production path free of evaluator-only type dependencies.
 */
export type CalibratedAbstentionPolicy = {
  /** Empirically selected threshold from calibration. */
  selectedThreshold: number;
  /**
   * True when no threshold satisfied the target failure rate and the
   * least-bad threshold was chosen as a fallback.
   * When true, the calibrated threshold should NOT override the constant —
   * the calibration did not find a satisfying solution.
   */
  fallbackUsed: boolean;
};

/**
 * Safely resolve the effective abstention threshold at runtime.
 *
 * Rules:
 *   - If a policy is provided AND fallbackUsed is false:
 *     returns the calibrated selectedThreshold.
 *   - Otherwise (no policy, null, or fallback mode):
 *     returns VISIBLE_ABSTENTION_THRESHOLD (the compile-time constant).
 *
 * contradiction_drift bypasses the score gate entirely and must not call
 * this function — the existing gate logic in projectVisiblePatternClaim
 * already handles that bypass.
 */
export function resolveVisibleAbstentionThreshold(
  policy?: CalibratedAbstentionPolicy | null
): number {
  if (
    policy &&
    !policy.fallbackUsed &&
    typeof policy.selectedThreshold === "number" &&
    Number.isFinite(policy.selectedThreshold)
  ) {
    return policy.selectedThreshold;
  }
  return VISIBLE_ABSTENTION_THRESHOLD;
}

export function resolveRuntimeVisibleAbstentionThreshold(
  policyArtifact?: VisibleAbstentionPolicyArtifact | null
): number {
  return resolveVisibleAbstentionPolicyThreshold({
    policyArtifact,
    constantThreshold: VISIBLE_ABSTENTION_THRESHOLD,
  }).thresholdUsed;
}

function extractRationaleBundleQuotes(receipts: PatternReceiptView[]): string[] {
  return receipts
    .map((receipt) => receipt.quote)
    .filter((quote): quote is string => typeof quote === "string" && quote.trim().length > 0);
}

/** Result of a visible claim abstention score computation. */
export type VisibleClaimAbstentionScore = {
  /** Composite score in [0, 1]. Higher = stronger evidence for surfacing. */
  score: number;
  /**
   * True when score < VISIBLE_ABSTENTION_THRESHOLD.
   * When triggered the claim should NOT be surfaced.
   */
  triggered: boolean;
  /** Human-readable signal summary for audit / report output. */
  reasons: string[];
};

/**
 * Compute a deterministic abstention score for a visible claim candidate.
 *
 * Called AFTER the summary gate — generateVisiblePatternSummary must return
 * non-null before this is invoked. Returns a score in [0, 1]:
 *   - 0.0 → strong abstention pressure (no evidence, no sessions, no safe quote)
 *   - 1.0 → fully saturated on all three signals
 *
 * No network calls. No LLM. Deterministic.
 */
export function scoreVisiblePatternClaim(inputs: {
  evidenceCount: number;
  sessionCount: number;
  hasDisplaySafeQuote: boolean;
}): VisibleClaimAbstentionScore {
  const { evidenceCount, sessionCount, hasDisplaySafeQuote } = inputs;
  const reasons: string[] = [];

  const evidenceFraction = Math.min(evidenceCount / VISIBLE_CLAIM_EVIDENCE_SATURATION, 1);
  const sessionFraction  = Math.min(sessionCount  / VISIBLE_CLAIM_SESSION_SATURATION,  1);
  const quoteFraction    = hasDisplaySafeQuote ? 1 : 0;

  reasons.push(evidenceCount > 0 ? `evidence=${evidenceCount}` : "no-evidence");
  reasons.push(sessionCount  > 0 ? `sessions=${sessionCount}`  : "no-sessions");
  reasons.push(hasDisplaySafeQuote ? "quote-safe" : "no-safe-quote");

  const score =
    VISIBLE_CLAIM_WEIGHT_EVIDENCE * evidenceFraction +
    VISIBLE_CLAIM_WEIGHT_SESSION  * sessionFraction  +
    VISIBLE_CLAIM_WEIGHT_QUOTE    * quoteFraction;

  return { score, triggered: score < VISIBLE_ABSTENTION_THRESHOLD, reasons };
}

/**
 * Convenience predicate — returns true when the claim should be suppressed.
 * Defaults to true (abstain) on any computation error.
 */
export function shouldAbstainVisiblePatternClaim(inputs: {
  evidenceCount: number;
  sessionCount: number;
  hasDisplaySafeQuote: boolean;
  abstentionThreshold?: number;
}): boolean {
  try {
    const { abstentionThreshold, ...scoreInputs } = inputs;
    return scoreVisiblePatternClaim(scoreInputs).score < (abstentionThreshold ?? VISIBLE_ABSTENTION_THRESHOLD);
  } catch {
    return true; // safe default
  }
}

// ── View helpers ──────────────────────────────────────────────────────────────

function toReceiptViews(evidence: VisibleEvidenceRecord[]): PatternReceiptView[] {
  return evidence.map((ev) => ({
    id: ev.id,
    source: ev.source,
    sessionId: ev.sessionId,
    messageId: ev.messageId,
    journalEntryId: ev.journalEntryId ?? null,
    quote: ev.quote,
    createdAt: ev.createdAt.toISOString(),
  }));
}

function toActionView(action: VisibleActionRecord | null | undefined): PatternClaimActionView | null {
  if (!action) return null;
  return {
    id: action.id,
    claimId: action.claimId,
    prompt: action.prompt,
    status: action.status as PatternClaimActionView["status"],
    outcomeSignal: action.outcomeSignal as PatternClaimActionView["outcomeSignal"],
    reflectionNote: action.reflectionNote,
    createdAt: action.createdAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null,
  };
}

export function buildCanonicalVisibleSupportBundle(
  claim: VisiblePatternClaimRecord,
  options?: {
    policyArtifact?: VisibleAbstentionPolicyArtifact | null;
    policyArtifactPath?: string;
    abstentionThreshold?: number;
  }
): CanonicalVisibleSupportBundle {
  const receipts = toReceiptViews(claim.evidence);
  const summaryText = generateVisiblePatternSummary({
    patternType: claim.patternType,
    persistedSummary: claim.summary,
    receipts,
  });
  const sessionCount = new Set(
    claim.evidence
      .map((ev) => ev.sessionId)
      .filter((sessionId): sessionId is string => sessionId !== null)
  ).size;
  const journalEvidence = claim.evidence.filter((ev) => ev.journalEntryId != null);
  const journalEvidenceCount = journalEvidence.length;
  const journalDaySpread = new Set(
    journalEvidence.map((ev) => ev.createdAt.toISOString().slice(0, 10))
  ).size;
  const policyArtifact =
    options?.policyArtifact ??
    loadVisibleAbstentionPolicyArtifact(options?.policyArtifactPath);
  const thresholdUsed =
    resolveVisibleAbstentionPolicyThreshold({
      policyArtifact,
      policyPath: options?.policyArtifactPath,
      explicitOverride: options?.abstentionThreshold,
      constantThreshold: VISIBLE_ABSTENTION_THRESHOLD,
    }).thresholdUsed;
  const thresholdSource =
    isConsumableVisibleAbstentionPolicyArtifact(policyArtifact)
      ? "policy_artifact"
      : "constant_fallback";
  const displaySafeQuoteStatus = receipts.some(
    (receipt) => receipt.quote !== null && isDisplaySafePatternQuote(receipt.quote as string)
  );
  const rationaleBundleQuotes = extractRationaleBundleQuotes(receipts);
  const surfaced =
    summaryText !== null &&
    (claim.patternType === "contradiction_drift" ||
      !shouldAbstainVisiblePatternClaim({
        evidenceCount: claim.evidence.length,
        sessionCount,
        hasDisplaySafeQuote: displaySafeQuoteStatus,
        abstentionThreshold: thresholdUsed,
      }));

  return {
    summaryText,
    evidenceCount: claim.evidence.length,
    displaySafeQuoteStatus,
    thresholdUsed,
    thresholdSource,
    rationaleBundleSource: "persisted_evidence_quotes",
    supportBundleSource: "replay_derived",
    rationaleBundleQuotes,
    surfaced,
    sessionCount,
    journalEvidenceCount,
    journalDaySpread,
  };
}

/**
 * Shared visible projection gate used by both /api/patterns and /api/patterns/actions.
 *
 * Decision layers (in order):
 *  1. Summary gate   — generateVisiblePatternSummary must return non-null.
 *  2. Abstention score — deterministic signal score must clear VISIBLE_ABSTENTION_THRESHOLD.
 *
 * Returns null (claim suppressed) when either gate fails.
 * Never makes network calls. Deterministic.
 */
export function projectVisiblePatternClaim(
  claim: VisiblePatternClaimRecord,
  options?: {
    policyArtifact?: VisibleAbstentionPolicyArtifact | null;
    policyArtifactPath?: string;
    abstentionThreshold?: number;
  }
): PatternClaimView | null {
  const receipts = toReceiptViews(claim.evidence);
  const supportBundle = buildCanonicalVisibleSupportBundle(claim, options);
  if (!supportBundle.summaryText || !supportBundle.surfaced) return null;

  return {
    id: claim.id,
    patternType: claim.patternType,
    summary: supportBundle.summaryText,
    status: claim.status,
    strengthLevel: claim.strengthLevel,
    evidenceCount: supportBundle.evidenceCount,
    sessionCount: supportBundle.sessionCount,
    journalEvidenceCount: supportBundle.journalEvidenceCount,
    journalDaySpread: supportBundle.journalDaySpread,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    receipts,
    action: toActionView(claim.actions?.[0] ?? null),
  };
}
