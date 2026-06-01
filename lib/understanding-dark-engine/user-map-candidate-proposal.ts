import {
  UserMapConclusionArea,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import type { DarkRunUserMapEvaluation } from "./dark-run-evaluator";
import type { UserMapCandidateEvidenceSelection } from "./user-map-candidate-persistence";
import type { EvidencePacket, EvidencePacketItem, GateEvaluationTarget } from "./types";

const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 600;

const DISALLOWED_PROPOSAL_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

const ANCHOR_SOURCE_TYPE_PRIORITY: UnderstandingLinkSourceType[] = [
  "pattern_claim",
  "contradiction_node",
];

const AREA_BY_ANCHOR_SOURCE_TYPE: Partial<
  Record<UnderstandingLinkSourceType, UserMapConclusionArea>
> = {
  pattern_claim: UserMapConclusionArea.operating_logic,
  contradiction_node: UserMapConclusionArea.tension_architecture,
};

export type StructuredUserMapCandidateProposal = {
  area: UserMapConclusionArea;
  title: string;
  summary: string;
  target: GateEvaluationTarget;
  evidenceSelections?: UserMapCandidateEvidenceSelection[];
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncateSummaryText(value: string, maxLength: number): string {
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

function packetItemKey(item: Pick<EvidencePacketItem, "sourceType" | "sourceId">): string {
  return `${item.sourceType}|${item.sourceId}`;
}

function selectProposalEvidenceSelections(
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

  const isSafeSummaryAnchor = (item: EvidencePacketItem | null): item is EvidencePacketItem => {
    return (
      !!item &&
      item.publicSafetyLevel === "safe_summary" &&
      typeof item.publicSafeSummary === "string" &&
      item.publicSafeSummary.trim().length > 0
    );
  };

  for (const sourceType of ANCHOR_SOURCE_TYPE_PRIORITY) {
    const selection = args.evidenceSelections.find(
      (candidate) => candidate.sourceType === sourceType
    );
    if (!selection) {
      continue;
    }
    const item = resolveSelectionItem(selection);
    if (isSafeSummaryAnchor(item)) {
      return item;
    }
  }

  for (const selection of args.evidenceSelections) {
    const item = resolveSelectionItem(selection);
    if (isSafeSummaryAnchor(item)) {
      return item;
    }
  }

  return null;
}

function inferAreaFromAnchorItem(item: EvidencePacketItem): UserMapConclusionArea | null {
  return AREA_BY_ANCHOR_SOURCE_TYPE[item.sourceType] ?? null;
}

/**
 * Builds structured internal candidate proposal output for no-write dark runs.
 * Returns null when gates abstain or when evidence cannot support a safe proposal shape.
 */
export function buildStructuredUserMapCandidateProposal(args: {
  packet: EvidencePacket;
  evaluation: DarkRunUserMapEvaluation;
  target: GateEvaluationTarget;
}): StructuredUserMapCandidateProposal | null {
  if (args.evaluation.result.decision === "abstain") {
    return null;
  }

  const evidenceSelections = selectProposalEvidenceSelections(args.packet);
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

  const area = inferAreaFromAnchorItem(anchorItem);
  if (!area) {
    return null;
  }

  const evidenceBackedSummary = anchorItem.publicSafeSummary?.trim() ?? "";
  if (!evidenceBackedSummary) {
    return null;
  }

  const title = truncateTitleAtWordBoundary(evidenceBackedSummary, TITLE_MAX_LENGTH);
  const summary = truncateSummaryText(evidenceBackedSummary, SUMMARY_MAX_LENGTH);

  return {
    area,
    title,
    summary,
    target: {
      requestedStatus: args.evaluation.result.allowedStatus,
      identityLevelClaim: args.target.identityLevelClaim,
      proposedSummary: summary,
      requiresReceipt: args.target.requiresReceipt,
    },
    evidenceSelections,
  };
}
