import { UserMapConclusionStatus } from "@prisma/client";
import { UnderstandingLinkSourceType as SourceTypeAlias } from "@prisma/client";

import {
  PHASE2_OBJECTIVITY_CONSTANTS,
  type RejectionReasonCode,
} from "./constants";
import { computeHighEmotionDominance } from "./high-emotion-guard";
import { evaluateModelUpdateMeaningfulDelta } from "./meaningful-delta";
import type {
  EvidencePacket,
  GateEvaluationResult,
  GateEvaluationTarget,
  ModelUpdateDeltaInput,
  ModelUpdateGateResult,
} from "./types";

const OVERCLAIMING_RE =
  /\b(always|never|fundamentally|core\s+self|you\s+are|this\s+proves)\b/i;

const WEIGHT_CLASS_SCORE = {
  critical: 1,
  high: 0.8,
  moderate_high: 0.7,
  moderate: 0.6,
  low_to_moderate: 0.35,
  low: 0.25,
} as const;

function confidenceCapForEvidenceCount(evidenceCount: number): number {
  if (evidenceCount <= 2) {
    return PHASE2_OBJECTIVITY_CONSTANTS.UMAP_CONF_CAP_2_EVIDENCE;
  }
  if (evidenceCount <= 5) {
    return PHASE2_OBJECTIVITY_CONSTANTS.UMAP_CONF_CAP_3_TO_5_EVIDENCE;
  }
  if (evidenceCount <= 10) {
    return PHASE2_OBJECTIVITY_CONSTANTS.UMAP_CONF_CAP_6_TO_10_EVIDENCE;
  }
  return PHASE2_OBJECTIVITY_CONSTANTS.UMAP_CONF_CAP_10_PLUS_EVIDENCE;
}

function applyCorrectionConfidenceCap(
  baseConfidenceCap: number,
  hasCorrectionSignal: boolean
): number {
  if (!hasCorrectionSignal) {
    return baseConfidenceCap;
  }

  return Number(
    (
      baseConfidenceCap *
      PHASE2_OBJECTIVITY_CONSTANTS.CORRECTION_CONFIDENCE_MULTIPLIER
    ).toFixed(4)
  );
}

function computeLinkableEvidenceStats(packet: EvidencePacket) {
  const linkable = packet.items.filter(
    (item) => item.linkable && item.ownershipResolvable
  );

  const sourceTypes = new Set(linkable.map((item) => item.sourceType));

  const timestamps = linkable
    .map((item) => item.authoredAt ?? item.timestamp)
    .sort((a, b) => a.getTime() - b.getTime());

  const timeSpreadDays =
    timestamps.length > 0
      ? Math.floor(
          (timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  return {
    linkable,
    linkableEvidenceCount: linkable.length,
    sourceDiversity: sourceTypes.size,
    timeSpreadDays,
  };
}

function evaluateProfileArtifactCap(packet: EvidencePacket): boolean {
  const linkable = packet.items.filter(
    (item) => item.linkable && item.ownershipResolvable
  );

  if (linkable.length === 0) return false;

  let total = 0;
  let profileArtifactTotal = 0;

  for (const item of linkable) {
    const baseWeight = WEIGHT_CLASS_SCORE[item.weightClass];
    total += baseWeight;

    if (item.sourceType === SourceTypeAlias.profile_artifact) {
      const capped = Math.min(
        baseWeight,
        PHASE2_OBJECTIVITY_CONSTANTS.PROFILE_ARTIFACT_MAX_CONTRIBUTION
      );
      profileArtifactTotal += capped;
    }
  }

  if (total === 0) return false;
  const ratio = profileArtifactTotal / total;
  return ratio > PHASE2_OBJECTIVITY_CONSTANTS.PROFILE_ARTIFACT_MAX_CONTRIBUTION;
}

function hasOnlyProfileArtifactLinkableEvidence(packet: EvidencePacket): boolean {
  const linkable = packet.items.filter(
    (item) => item.linkable && item.ownershipResolvable
  );

  if (linkable.length === 0) return false;
  return linkable.every((item) => item.sourceType === SourceTypeAlias.profile_artifact);
}

export function evaluateUserMapConclusionObjectivityGates(args: {
  packet: EvidencePacket;
  target: GateEvaluationTarget;
}): GateEvaluationResult {
  const { packet, target } = args;

  const reasons: RejectionReasonCode[] = [];
  const warnings: RejectionReasonCode[] = [];

  const linkableStats = computeLinkableEvidenceStats(packet);
  const highEmotion = computeHighEmotionDominance(packet.items);

  const hasNonLinkableContextOnly =
    packet.metrics.nonLinkableContextItems > 0 && linkableStats.linkableEvidenceCount === 0;
  const hasCorrectionSignal = packet.metrics.correctionSignalCount > 0;
  const baseConfidenceCap = confidenceCapForEvidenceCount(
    linkableStats.linkableEvidenceCount
  );
  const effectiveConfidenceCap = applyCorrectionConfidenceCap(
    baseConfidenceCap,
    hasCorrectionSignal
  );

  if (hasNonLinkableContextOnly) {
    reasons.push("NON_LINKABLE_CONTEXT_ONLY");
  }

  if (linkableStats.linkableEvidenceCount === 0) {
    reasons.push("MISSING_PROVENANCE");
  }

  if (target.requestedStatus === UserMapConclusionStatus.emerging) {
    if (
      linkableStats.linkableEvidenceCount <
      PHASE2_OBJECTIVITY_CONSTANTS.UMAP_MIN_EVIDENCE_EMERGING
    ) {
      reasons.push("INSUFFICIENT_EVIDENCE_COUNT");
    }
    if (
      linkableStats.sourceDiversity <
      PHASE2_OBJECTIVITY_CONSTANTS.UMAP_MIN_SOURCE_TYPES_EMERGING
    ) {
      reasons.push("INSUFFICIENT_SOURCE_DIVERSITY");
    }
  }

  if (target.requestedStatus === UserMapConclusionStatus.supported) {
    if (
      linkableStats.linkableEvidenceCount <
      PHASE2_OBJECTIVITY_CONSTANTS.UMAP_MIN_EVIDENCE_SUPPORTED
    ) {
      reasons.push("INSUFFICIENT_EVIDENCE_COUNT");
    }

    if (
      linkableStats.sourceDiversity <
      PHASE2_OBJECTIVITY_CONSTANTS.UMAP_MIN_SOURCE_TYPES_SUPPORTED
    ) {
      reasons.push("INSUFFICIENT_SOURCE_DIVERSITY");
    }

    if (
      linkableStats.timeSpreadDays <
      PHASE2_OBJECTIVITY_CONSTANTS.UMAP_MIN_TIME_SPREAD_DAYS_SUPPORTED
    ) {
      reasons.push("INSUFFICIENT_TIME_SPREAD");
    }

    if (
      PHASE2_OBJECTIVITY_CONSTANTS.SINGLE_EPISODE_SUPPORTED_BLOCK &&
      packet.metrics.distinctEpisodeCount <= 1 &&
      linkableStats.linkableEvidenceCount > 0
    ) {
      reasons.push("SINGLE_EPISODE_SUPPORTED_BLOCK");
    }

    if (
      PHASE2_OBJECTIVITY_CONSTANTS.RECEIPT_REQUIRED_FOR_PROMOTION &&
      packet.metrics.receiptCount === 0
    ) {
      reasons.push("MISSING_PROVENANCE");
      if (packet.metrics.quoteQualityLowCount > 0) {
        reasons.push("LOW_QUOTE_QUALITY");
      }
    }

    if (packet.metrics.unresolvedContradictionCount > 0) {
      reasons.push("DISCONFIRMATION_UNRESOLVED");
    }
  }

  if (evaluateProfileArtifactCap(packet) || hasOnlyProfileArtifactLinkableEvidence(packet)) {
    reasons.push("PROFILE_ARTIFACT_CAP");
  }

  if (hasCorrectionSignal) {
    warnings.push("CORRECTION_DOWNGRADE_ACTIVE");
  }

  if (
    PHASE2_OBJECTIVITY_CONSTANTS.LANGUAGE_OVERCLAIMING_BLOCK &&
    target.identityLevelClaim &&
    OVERCLAIMING_RE.test(target.proposedSummary)
  ) {
    reasons.push("LANGUAGE_OVERCLAIMING_BLOCKED");
  }

  let allowedStatus = target.requestedStatus;

  if (highEmotion.dominant) {
    if (
      target.requestedStatus === UserMapConclusionStatus.supported &&
      PHASE2_OBJECTIVITY_CONSTANTS.HIGH_EMOTION_STATUS_CAP === "emerging"
    ) {
      warnings.push("HIGH_EMOTION_DOMINANCE_CAP");
      allowedStatus = UserMapConclusionStatus.emerging;
    }

    if (target.identityLevelClaim && PHASE2_OBJECTIVITY_CONSTANTS.HIGH_EMOTION_IDENTITY_CLAIM_BLOCK) {
      reasons.push("HIGH_EMOTION_IDENTITY_BLOCK");
    }
  }

  const dedupedReasons = [...new Set(reasons)];
  const dedupedWarnings = [...new Set(warnings)];

  if (dedupedReasons.length > 0) {
    return {
      decision: "abstain",
      allowedStatus,
      confidenceCap: effectiveConfidenceCap,
      reasons: dedupedReasons,
      warnings: dedupedWarnings,
      metrics: {
        evidenceCount: linkableStats.linkableEvidenceCount,
        sourceDiversity: linkableStats.sourceDiversity,
        timeSpreadDays: linkableStats.timeSpreadDays,
        highEmotionDominanceRatio: highEmotion.dominanceRatio,
        distinctEpisodeCount: packet.metrics.distinctEpisodeCount,
      },
    };
  }

  if (
    allowedStatus !== target.requestedStatus &&
    target.requestedStatus === UserMapConclusionStatus.supported
  ) {
    return {
      decision: "pass_with_cap",
      allowedStatus,
      confidenceCap: effectiveConfidenceCap,
      reasons: [],
      warnings: dedupedWarnings,
      metrics: {
        evidenceCount: linkableStats.linkableEvidenceCount,
        sourceDiversity: linkableStats.sourceDiversity,
        timeSpreadDays: linkableStats.timeSpreadDays,
        highEmotionDominanceRatio: highEmotion.dominanceRatio,
        distinctEpisodeCount: packet.metrics.distinctEpisodeCount,
      },
    };
  }

  return {
    decision: "pass",
    allowedStatus,
    confidenceCap: effectiveConfidenceCap,
    reasons: [],
    warnings: dedupedWarnings,
    metrics: {
      evidenceCount: linkableStats.linkableEvidenceCount,
      sourceDiversity: linkableStats.sourceDiversity,
      timeSpreadDays: linkableStats.timeSpreadDays,
      highEmotionDominanceRatio: highEmotion.dominanceRatio,
      distinctEpisodeCount: packet.metrics.distinctEpisodeCount,
    },
  };
}

export function evaluateModelUpdateObjectivityGates(args: {
  delta: ModelUpdateDeltaInput;
  packet: EvidencePacket;
}): ModelUpdateGateResult {
  const base = evaluateModelUpdateMeaningfulDelta(args.delta);

  const reasons = [...base.reasons];

  if (
    PHASE2_OBJECTIVITY_CONSTANTS.MODEL_UPDATE_REQUIRES_EVIDENCE_LINK &&
    args.packet.metrics.linkableEvidenceCount === 0
  ) {
    reasons.push("MISSING_PROVENANCE");
  }

  return {
    isMeaningful: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}
