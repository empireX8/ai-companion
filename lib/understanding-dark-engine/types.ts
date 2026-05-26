import type {
  UnderstandingLinkSourceType,
  UserMapConclusionStatus,
} from "@prisma/client";

import type { RejectionReasonCode } from "./constants";

export type EvidenceWeightClass =
  | "critical"
  | "high"
  | "moderate_high"
  | "moderate"
  | "low_to_moderate"
  | "low";

export type EvidenceSourceFamily =
  | "pattern_claim"
  | "pattern_claim_evidence"
  | "contradiction_node"
  | "contradiction_evidence"
  | "profile_artifact"
  | "evidence_span"
  | "reference_item"
  | "surfaced_action"
  | "quick_check_in"
  | "journal_entry"
  | "session"
  | "message"
  | "timeline_aggregation"
  | "import_record"
  | "user_correction";

export type EvidenceRole =
  | "signal"
  | "receipt"
  | "context"
  | "calibration"
  | "outcome"
  | "container";

export type EvidenceOriginMarker = "native" | "imported" | "mixed" | "unknown";

export type EvidencePublicSafetyLevel =
  | "internal_only"
  | "safe_summary"
  | "public_safe_id_only"
  | "not_public_safe";

export type EvidenceProvenanceRefs = {
  patternClaimId?: string;
  contradictionNodeId?: string;
  sessionId?: string;
  messageId?: string;
  journalEntryId?: string;
  importSessionId?: string;
  importChunkId?: string;
  referenceItemId?: string;
};

export type EvidencePacketItem = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: EvidenceRole;
  weightClass: EvidenceWeightClass;
  sourceFamily: EvidenceSourceFamily;
  timestamp: Date;
  authoredAt?: Date | null;
  /**
   * Internal-only text excerpt. Never implicitly public-safe.
   */
  snippet?: string | null;
  /**
   * Internal-only quote text. Never implicitly public-safe.
   */
  quote?: string | null;
  /**
   * Explicit packet-level projection safety marker for this source item.
   */
  publicSafetyLevel: EvidencePublicSafetyLevel;
  /**
   * Safe projection label/summary (optional) when the item is `safe_summary`.
   */
  publicSafeSummary?: string | null;
  /**
   * True when the item contains raw/private user-authored prose.
   */
  containsRawPrivateText: boolean;
  provenanceRefs: EvidenceProvenanceRefs;
  qualityFlags: string[];
  linkable: boolean;
  ownershipResolvable: boolean;
  highEmotionSignal: boolean;
  origin: EvidenceOriginMarker;
  episodeKey: string | null;
};

export type EvidencePacketMetrics = {
  evidenceCount: number;
  linkableEvidenceCount: number;
  ownershipResolvableCount: number;
  sourceCounts: Partial<Record<UnderstandingLinkSourceType, number>>;
  sourceDiversity: number;
  timeSpreadDays: number;
  importedCount: number;
  nativeCount: number;
  mixedCount: number;
  unknownOriginCount: number;
  highEmotionItemCount: number;
  nonLinkableContextItems: number;
  quoteQualityLowCount: number;
  receiptCount: number;
  unresolvedContradictionCount: number;
  correctionSignalCount: number;
  distinctEpisodeCount: number;
};

export type EvidencePacket = {
  userId: string;
  assembledAt: Date;
  windowStart: Date;
  windowEnd: Date;
  items: EvidencePacketItem[];
  metrics: EvidencePacketMetrics;
};

export type GateEvaluationTarget = {
  requestedStatus: UserMapConclusionStatus;
  identityLevelClaim: boolean;
  proposedSummary: string;
  requiresReceipt: boolean;
};

export type GateEvaluationResult = {
  decision: "pass" | "pass_with_cap" | "abstain";
  allowedStatus: UserMapConclusionStatus;
  confidenceCap: number;
  reasons: RejectionReasonCode[];
  warnings: RejectionReasonCode[];
  metrics: {
    evidenceCount: number;
    sourceDiversity: number;
    timeSpreadDays: number;
    highEmotionDominanceRatio: number;
    distinctEpisodeCount: number;
  };
};

export type ModelUpdateDeltaInput = {
  isStatusTransition?: boolean;
  confidenceDelta?: number | null;
  newLinkCount?: number;
  investigationStateMoved?: boolean;
  actionOutcomeModelImpact?: boolean;
  hasEvidenceLink?: boolean;
  isSyntheticInsight?: boolean;
};

export type ModelUpdateGateResult = {
  isMeaningful: boolean;
  reasons: RejectionReasonCode[];
};

export type DarkRunDiagnostics = {
  packetsAssembled: number;
  candidatesProposed: number;
  candidatesWritten: number;
  abstentions: number;
  rejectionCountsByReason: Partial<Record<RejectionReasonCode, number>>;
  sourceCounts: Partial<Record<UnderstandingLinkSourceType, number>>;
  sourceDiversity: number;
  timeSpreadDays: number;
  importedVsNative: {
    imported: number;
    native: number;
    mixed: number;
    unknown: number;
  };
  highEmotionCaps: number;
  singleEpisodeBlocks: number;
  nonLinkableContextItems: number;
  linkIntegrityWarnings: string[];
  notes: string[];
};
