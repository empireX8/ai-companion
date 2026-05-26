import {
  UnderstandingLinkSourceType as SourceType,
  UserMapConclusionStatus,
} from "@prisma/client";

import {
  evaluateDarkRunUserMapCandidate,
  type DarkRunUserMapEvaluation,
} from "./dark-run-evaluator";
import {
  assembleEvidencePacketV1,
  type AssembleEvidencePacketInput,
} from "./evidence-packet";
import type {
  DarkRunDiagnostics,
  EvidencePacketItem,
  EvidencePacketMetrics,
  GateEvaluationTarget,
} from "./types";

function defaultGateTarget(): GateEvaluationTarget {
  return {
    requestedStatus: UserMapConclusionStatus.emerging,
    identityLevelClaim: false,
    proposedSummary: "Manual no-write dark-run diagnostics candidate.",
    requiresReceipt: true,
  };
}

function cloneDiagnostics(diagnostics: DarkRunDiagnostics): DarkRunDiagnostics {
  return {
    packetsAssembled: diagnostics.packetsAssembled,
    candidatesProposed: diagnostics.candidatesProposed,
    candidatesWritten: diagnostics.candidatesWritten,
    abstentions: diagnostics.abstentions,
    rejectionCountsByReason: { ...diagnostics.rejectionCountsByReason },
    sourceCounts: { ...diagnostics.sourceCounts },
    sourceDiversity: diagnostics.sourceDiversity,
    timeSpreadDays: diagnostics.timeSpreadDays,
    importedVsNative: { ...diagnostics.importedVsNative },
    highEmotionCaps: diagnostics.highEmotionCaps,
    singleEpisodeBlocks: diagnostics.singleEpisodeBlocks,
    nonLinkableContextItems: diagnostics.nonLinkableContextItems,
    linkIntegrityWarnings: [...diagnostics.linkIntegrityWarnings],
    notes: [...diagnostics.notes],
  };
}

function toSanitizedPacketItem(
  item: EvidencePacketItem
): NoWriteDarkRunSanitizedPacketItem {
  const sanitized: NoWriteDarkRunSanitizedPacketItem = {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    timestamp: item.timestamp.toISOString(),
    authoredAt: item.authoredAt ? item.authoredAt.toISOString() : null,
    role: item.role,
    weightClass: item.weightClass,
    sourceFamily: item.sourceFamily,
    publicSafetyLevel: item.publicSafetyLevel,
    containsRawPrivateText: item.containsRawPrivateText,
    provenanceRefs: { ...item.provenanceRefs },
    qualityFlags: [...item.qualityFlags],
    linkable: item.linkable,
    ownershipResolvable: item.ownershipResolvable,
    highEmotionSignal: item.highEmotionSignal,
    origin: item.origin,
    episodeKey: item.episodeKey,
  };

  if (item.publicSafetyLevel === "safe_summary") {
    sanitized.publicSafeSummary = item.publicSafeSummary ?? null;
  }

  return sanitized;
}

function buildPhaseHCompatibilityMetadata(items: EvidencePacketItem[]): {
  required: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (items.some((item) => item.sourceType === SourceType.surfaced_action)) {
    reasons.push("surfaced_action_evidence_present");
  }

  return {
    required: reasons.length > 0,
    reasons,
  };
}

export type RunNoWriteUnderstandingDarkRunInput = {
  userId: string;
  db?: AssembleEvidencePacketInput["db"];
  now?: Date;
  windowDays?: number;
  target?: GateEvaluationTarget;
  includeTimelineAggregationContext?: boolean;
  includeUserCorrectionContext?: boolean;
};

export type NoWriteDarkRunSanitizedPacketItem = {
  sourceType: EvidencePacketItem["sourceType"];
  sourceId: string;
  timestamp: string;
  authoredAt: string | null;
  role: EvidencePacketItem["role"];
  weightClass: EvidencePacketItem["weightClass"];
  sourceFamily: EvidencePacketItem["sourceFamily"];
  publicSafetyLevel: EvidencePacketItem["publicSafetyLevel"];
  publicSafeSummary?: string | null;
  containsRawPrivateText: boolean;
  provenanceRefs: EvidencePacketItem["provenanceRefs"];
  qualityFlags: string[];
  linkable: boolean;
  ownershipResolvable: boolean;
  highEmotionSignal: boolean;
  origin: EvidencePacketItem["origin"];
  episodeKey: string | null;
};

export type NoWriteDarkRunPacketSummary = {
  assembledAt: string;
  windowStart: string;
  windowEnd: string;
  metrics: EvidencePacketMetrics;
  items: NoWriteDarkRunSanitizedPacketItem[];
};

export type RunNoWriteUnderstandingDarkRunResult = {
  mode: "no_write_dark_run";
  userId: string;
  packet: NoWriteDarkRunPacketSummary;
  userMapEvaluation: DarkRunUserMapEvaluation["result"];
  diagnostics: DarkRunDiagnostics;
  phaseHCompatibility: {
    required: boolean;
    reasons: string[];
  };
};

export async function runNoWriteUnderstandingDarkRun(
  input: RunNoWriteUnderstandingDarkRunInput
): Promise<RunNoWriteUnderstandingDarkRunResult> {
  const target = input.target ?? defaultGateTarget();

  const packet = await assembleEvidencePacketV1({
    userId: input.userId,
    now: input.now,
    windowDays: input.windowDays,
    includeTimelineAggregationContext: input.includeTimelineAggregationContext,
    includeUserCorrectionContext: input.includeUserCorrectionContext,
    db: input.db,
  });

  const evaluation = evaluateDarkRunUserMapCandidate({
    packet,
    target,
  });

  const phaseHCompatibility = buildPhaseHCompatibilityMetadata(packet.items);
  const diagnostics = cloneDiagnostics(evaluation.diagnostics);

  if (phaseHCompatibility.required) {
    diagnostics.notes.push(
      `phase_h_compatibility_required:${phaseHCompatibility.reasons.join(",")}`
    );
  }

  return {
    mode: "no_write_dark_run",
    userId: packet.userId,
    packet: {
      assembledAt: packet.assembledAt.toISOString(),
      windowStart: packet.windowStart.toISOString(),
      windowEnd: packet.windowEnd.toISOString(),
      metrics: packet.metrics,
      items: packet.items.map(toSanitizedPacketItem),
    },
    userMapEvaluation: evaluation.result,
    diagnostics,
    phaseHCompatibility,
  };
}
