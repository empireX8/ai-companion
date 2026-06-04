import {
  ModelUpdateType,
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import type { DarkRunUserMapEvaluation } from "./dark-run-evaluator";
import { evaluateModelUpdateObjectivityGates } from "./objectivity-gates";
import type { UserMapCandidateEvidenceSelection } from "./user-map-candidate-persistence";
import type { EvidencePacket, EvidencePacketItem, ModelUpdateDeltaInput } from "./types";

const USER_FACING_SUMMARY_MAX_LENGTH = 600;

const MODEL_UPDATE_SUMMARY_PREFIX = "There is early evidence that ";

const SURFACED_ACTION_PUBLIC_SAFE_ANCHOR_SUMMARY =
  "Structured action feedback is available across sources.";

const DISALLOWED_PROPOSAL_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

const ANCHOR_SOURCE_TYPE_PRIORITY: UnderstandingLinkSourceType[] = [
  "pattern_claim",
  "contradiction_node",
  "surfaced_action",
];

const LINK_TARGET_BY_SOURCE_TYPE: Partial<
  Record<UnderstandingLinkSourceType, UnderstandingLinkTargetType>
> = {
  pattern_claim: UnderstandingLinkTargetType.pattern_claim,
  contradiction_node: UnderstandingLinkTargetType.contradiction_node,
  surfaced_action: UnderstandingLinkTargetType.surfaced_action,
};

const MODEL_UPDATE_CANDIDATE_UPDATE_TYPE =
  "link_detected" as const satisfies ModelUpdateType;

export type StructuredModelUpdateCandidateProposal = {
  updateType: typeof MODEL_UPDATE_CANDIDATE_UPDATE_TYPE;
  userFacingSummary: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  evidenceSelections: UserMapCandidateEvidenceSelection[];
};

export const MODEL_UPDATE_CANDIDATE_SAFE_SUMMARY_PATTERNS = [
  /^There is early evidence\b/i,
  /^This may suggest\b/i,
  /^This looks worth watching\b/i,
] as const;

export const MODEL_UPDATE_CANDIDATE_DISALLOWED_OVERCLAIM_PATTERNS = [
  /\bmodel learned\b/i,
  /\byou are now\b/i,
  /\bthis proves\b/i,
  /\bthis pattern changed\b/i,
  /\bthe model changed\b/i,
] as const;

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

function truncateTitleAtWordBoundary(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const bounded = normalized.slice(0, maxLength);
  const lastSpace = bounded.lastIndexOf(" ");
  if (lastSpace > 0) {
    return bounded.slice(0, lastSpace);
  }

  return normalized.slice(0, maxLength);
}

function packetItemKey(item: Pick<EvidencePacketItem, "sourceType" | "sourceId">): string {
  return `${item.sourceType}|${item.sourceId}`;
}

function compareProposalEvidenceSelections(
  left: UserMapCandidateEvidenceSelection,
  right: UserMapCandidateEvidenceSelection
): number {
  const sourceTypeCompare = left.sourceType.localeCompare(right.sourceType);
  if (sourceTypeCompare !== 0) {
    return sourceTypeCompare;
  }

  return left.sourceId.localeCompare(right.sourceId);
}

function selectModelUpdateEvidenceSelections(
  packet: EvidencePacket
): UserMapCandidateEvidenceSelection[] | null {
  const selections: UserMapCandidateEvidenceSelection[] = [];

  for (const item of packet.items) {
    if (!item.linkable || !item.ownershipResolvable) {
      continue;
    }
    if (DISALLOWED_PROPOSAL_SOURCE_TYPES.has(item.sourceType)) {
      continue;
    }

    selections.push({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
    });
  }

  if (selections.length < 2) {
    return null;
  }

  const sourceTypeCount = new Set(selections.map((selection) => selection.sourceType)).size;
  if (sourceTypeCount < 2) {
    return null;
  }

  return [...selections].sort(compareProposalEvidenceSelections);
}

function pickSafeSummaryAnchorItem(args: {
  packet: EvidencePacket;
  evidenceSelections: UserMapCandidateEvidenceSelection[];
}): EvidencePacketItem | null {
  const packetLookup = new Map<string, EvidencePacketItem>();
  for (const item of args.packet.items) {
    packetLookup.set(packetItemKey(item), item);
  }

  const resolveSelectionItem = (
    selection: UserMapCandidateEvidenceSelection
  ): EvidencePacketItem | null => {
    return packetLookup.get(`${selection.sourceType}|${selection.sourceId}`) ?? null;
  };

  const isModelUpdateAnchorItem = (item: EvidencePacketItem | null): item is EvidencePacketItem => {
    return !!item && readModelUpdateAnchorSummary(item) !== null;
  };

  for (const sourceType of ANCHOR_SOURCE_TYPE_PRIORITY) {
    const selection = args.evidenceSelections.find(
      (candidate) => candidate.sourceType === sourceType
    );
    if (!selection) {
      continue;
    }
    const item = resolveSelectionItem(selection);
    if (isModelUpdateAnchorItem(item)) {
      return item;
    }
  }

  for (const selection of args.evidenceSelections) {
    const item = resolveSelectionItem(selection);
    if (isModelUpdateAnchorItem(item)) {
      return item;
    }
  }

  return null;
}

function readModelUpdateAnchorSummary(item: EvidencePacketItem): string | null {
  if (item.publicSafetyLevel === "safe_summary") {
    const summary = item.publicSafeSummary?.trim();
    return summary ? normalizeWhitespace(summary) : null;
  }

  if (item.sourceType === "surfaced_action") {
    return SURFACED_ACTION_PUBLIC_SAFE_ANCHOR_SUMMARY;
  }

  return null;
}

function resolveAffectedObjectFromAnchor(
  item: EvidencePacketItem
): { affectedObjectType: UnderstandingLinkTargetType; affectedObjectId: string } | null {
  const affectedObjectType = LINK_TARGET_BY_SOURCE_TYPE[item.sourceType];
  if (!affectedObjectType) {
    return null;
  }

  return {
    affectedObjectType,
    affectedObjectId: item.sourceId,
  };
}

export function deriveModelUpdateDeltaInput(args: {
  packet: EvidencePacket;
  evaluation: DarkRunUserMapEvaluation;
}): ModelUpdateDeltaInput {
  const linkableItems = args.packet.items.filter(
    (item) => item.linkable && item.ownershipResolvable
  );
  const sourceTypes = new Set(linkableItems.map((item) => item.sourceType));

  const hasSurfacedAction = linkableItems.some(
    (item) => item.sourceType === "surfaced_action"
  );

  const isSyntheticInsight =
    args.evaluation.result.reasons.includes("SYNTHETIC_INSIGHT_BLOCKED") ||
    args.evaluation.result.warnings.includes("SYNTHETIC_INSIGHT_BLOCKED");

  const newLinkCount =
    args.packet.metrics.linkableEvidenceCount >= 2 && sourceTypes.size >= 2
      ? linkableItems.length
      : 0;

  return {
    hasEvidenceLink: args.packet.metrics.linkableEvidenceCount > 0,
    newLinkCount,
    actionOutcomeModelImpact: hasSurfacedAction,
    isStatusTransition: false,
    investigationStateMoved: false,
    confidenceDelta: null,
    isSyntheticInsight,
  };
}

function buildModelUpdateUserFacingSummary(anchorSummary: string): string {
  const normalizedAnchor = normalizeWhitespace(anchorSummary);
  const core = truncateTitleAtWordBoundary(
    normalizedAnchor,
    USER_FACING_SUMMARY_MAX_LENGTH - MODEL_UPDATE_SUMMARY_PREFIX.length
  );
  return `${MODEL_UPDATE_SUMMARY_PREFIX}${core}`;
}

export function usesModelUpdateCandidateSafeWording(proposal: {
  userFacingSummary: string;
}): boolean {
  const summary = proposal.userFacingSummary.trim();
  if (!summary) {
    return false;
  }

  const hasSafePrefix = MODEL_UPDATE_CANDIDATE_SAFE_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(summary)
  );
  if (!hasSafePrefix) {
    return false;
  }

  return !MODEL_UPDATE_CANDIDATE_DISALLOWED_OVERCLAIM_PATTERNS.some((pattern) =>
    pattern.test(summary)
  );
}

function parseUpdateType(
  value: unknown
): typeof MODEL_UPDATE_CANDIDATE_UPDATE_TYPE | null {
  if (value !== MODEL_UPDATE_CANDIDATE_UPDATE_TYPE) {
    return null;
  }

  return MODEL_UPDATE_CANDIDATE_UPDATE_TYPE;
}

function parseAffectedObjectType(value: unknown): UnderstandingLinkTargetType | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !Object.values(UnderstandingLinkTargetType).includes(trimmed as UnderstandingLinkTargetType)) {
    return null;
  }

  return trimmed as UnderstandingLinkTargetType;
}

function parseEvidenceSelections(
  value: unknown
): UserMapCandidateEvidenceSelection[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parsed: UserMapCandidateEvidenceSelection[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const record = entry as {
      sourceType?: unknown;
      sourceId?: unknown;
    };
    const sourceType =
      typeof record.sourceType === "string" ? record.sourceType.trim() : "";
    const sourceId = typeof record.sourceId === "string" ? record.sourceId.trim() : "";

    if (!sourceType || !sourceId) {
      return null;
    }

    parsed.push({
      sourceType: sourceType as UnderstandingLinkSourceType,
      sourceId,
    });
  }

  return [...parsed].sort(compareProposalEvidenceSelections);
}

/**
 * Builds structured internal ModelUpdate candidate proposal for no-write dark runs.
 * Emitted only when meaningful-delta gates pass and a public-safe summary anchor exists.
 */
export function buildStructuredModelUpdateCandidateProposal(args: {
  packet: EvidencePacket;
  evaluation: DarkRunUserMapEvaluation;
}): StructuredModelUpdateCandidateProposal | null {
  const delta = deriveModelUpdateDeltaInput(args);
  const gateResult = evaluateModelUpdateObjectivityGates({
    packet: args.packet,
    delta,
  });

  if (!gateResult.isMeaningful) {
    return null;
  }

  const evidenceSelections = selectModelUpdateEvidenceSelections(args.packet);
  if (!evidenceSelections) {
    return null;
  }

  const anchorItem = pickSafeSummaryAnchorItem({
    packet: args.packet,
    evidenceSelections,
  });
  if (!anchorItem) {
    return null;
  }

  const affectedObject = resolveAffectedObjectFromAnchor(anchorItem);
  if (!affectedObject) {
    return null;
  }

  const evidenceBackedSummary = readModelUpdateAnchorSummary(anchorItem);
  if (!evidenceBackedSummary) {
    return null;
  }

  const userFacingSummary = buildModelUpdateUserFacingSummary(evidenceBackedSummary);
  const proposal: StructuredModelUpdateCandidateProposal = {
    updateType: MODEL_UPDATE_CANDIDATE_UPDATE_TYPE,
    userFacingSummary,
    affectedObjectType: affectedObject.affectedObjectType,
    affectedObjectId: affectedObject.affectedObjectId,
    evidenceSelections,
  };

  if (!usesModelUpdateCandidateSafeWording(proposal)) {
    return null;
  }

  return proposal;
}

export function extractStructuredModelUpdateCandidateProposal(output: {
  modelUpdateCandidateProposal?: StructuredModelUpdateCandidateProposal | null;
}): StructuredModelUpdateCandidateProposal | null {
  const proposal = output.modelUpdateCandidateProposal;
  if (!proposal || typeof proposal !== "object") {
    return null;
  }

  const userFacingSummary =
    typeof proposal.userFacingSummary === "string" ? proposal.userFacingSummary.trim() : "";
  const affectedObjectId =
    typeof proposal.affectedObjectId === "string" ? proposal.affectedObjectId.trim() : "";
  const updateType = parseUpdateType(proposal.updateType);
  const affectedObjectType = parseAffectedObjectType(proposal.affectedObjectType);
  const evidenceSelections = parseEvidenceSelections(proposal.evidenceSelections);

  if (!userFacingSummary || !affectedObjectId || !updateType || !affectedObjectType) {
    return null;
  }

  if (!evidenceSelections) {
    return null;
  }

  return {
    updateType,
    userFacingSummary,
    affectedObjectType,
    affectedObjectId,
    evidenceSelections,
  };
}
