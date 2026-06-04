import {
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import type { RejectionReasonCode } from "./constants";
import type { DarkRunUserMapEvaluation } from "./dark-run-evaluator";
import type { UserMapCandidateEvidenceSelection } from "./user-map-candidate-persistence";
import type { EvidencePacket, EvidencePacketItem } from "./types";

const PROMPT_MAX_LENGTH = 120;
const REASON_MAX_LENGTH = 600;

const FIELDWORK_PROMPT_PREFIX = "Notice whether ";
const FIELDWORK_REASON_PREFIX = "This may be worth watching in practice. ";

const DISALLOWED_PROPOSAL_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

const ANCHOR_SOURCE_TYPE_PRIORITY: UnderstandingLinkSourceType[] = [
  "contradiction_node",
  "pattern_claim",
  "surfaced_action",
];

const FIELDWORK_FRAMING_ABSTAIN_REASONS = new Set<RejectionReasonCode>([
  "PROFILE_ARTIFACT_CAP",
]);

const FIELDWORK_FRAMING_WARNING_CODES = new Set<RejectionReasonCode>([
  "CORRECTION_DOWNGRADE_ACTIVE",
]);

const LINK_TARGET_BY_SOURCE_TYPE: Partial<
  Record<UnderstandingLinkSourceType, UnderstandingLinkTargetType>
> = {
  pattern_claim: UnderstandingLinkTargetType.pattern_claim,
  contradiction_node: UnderstandingLinkTargetType.contradiction_node,
  surfaced_action: UnderstandingLinkTargetType.surfaced_action,
};

export type StructuredFieldworkCandidateProposal = {
  prompt: string;
  reason: string;
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string;
  abstainReasons: RejectionReasonCode[];
  evidenceSelections: UserMapCandidateEvidenceSelection[];
};

export const FIELDWORK_CANDIDATE_SAFE_WORDING_PATTERNS = [
  /^Notice whether\b/i,
  /^This may be worth watching in practice\./i,
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

function selectFieldworkEvidenceSelections(
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

  if (selections.length === 0) {
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

export function hasFieldworkFramingAbstainSignal(
  evaluation: DarkRunUserMapEvaluation
): boolean {
  const codes = [
    ...evaluation.result.reasons,
    ...evaluation.result.warnings,
  ] as RejectionReasonCode[];

  return codes.some(
    (code) =>
      FIELDWORK_FRAMING_ABSTAIN_REASONS.has(code) ||
      FIELDWORK_FRAMING_WARNING_CODES.has(code)
  );
}

function collectFieldworkAbstainReasons(
  evaluation: DarkRunUserMapEvaluation
): RejectionReasonCode[] {
  const codes = [
    ...evaluation.result.reasons,
    ...evaluation.result.warnings,
  ] as RejectionReasonCode[];

  return [
    ...new Set(
      codes.filter(
        (code) =>
          FIELDWORK_FRAMING_ABSTAIN_REASONS.has(code) ||
          FIELDWORK_FRAMING_WARNING_CODES.has(code)
      )
    ),
  ];
}

function resolveLinkedObjectFromAnchor(
  anchorItem: EvidencePacketItem
): Pick<StructuredFieldworkCandidateProposal, "linkedObjectType" | "linkedObjectId"> | null {
  const linkedObjectType = LINK_TARGET_BY_SOURCE_TYPE[anchorItem.sourceType];
  if (!linkedObjectType) {
    return null;
  }

  const linkedObjectId = anchorItem.sourceId.trim();
  if (!linkedObjectId) {
    return null;
  }

  return {
    linkedObjectType,
    linkedObjectId,
  };
}

export function usesFieldworkCandidateSafeWording(proposal: {
  prompt: string;
  reason: string;
}): boolean {
  return FIELDWORK_CANDIDATE_SAFE_WORDING_PATTERNS.some(
    (pattern) => pattern.test(proposal.prompt) || pattern.test(proposal.reason)
  );
}

/**
 * Builds structured internal FieldworkAssignment candidate proposal for no-write dark runs.
 * Emitted when UserMap and Investigation proposals are absent and fieldwork-framing abstain signals exist.
 */
export function buildStructuredFieldworkCandidateProposal(args: {
  packet: EvidencePacket;
  evaluation: DarkRunUserMapEvaluation;
}): StructuredFieldworkCandidateProposal | null {
  if (args.evaluation.result.decision !== "abstain") {
    return null;
  }

  if (!hasFieldworkFramingAbstainSignal(args.evaluation)) {
    return null;
  }

  const abstainReasons = collectFieldworkAbstainReasons(args.evaluation);
  if (abstainReasons.length === 0) {
    return null;
  }

  const evidenceSelections = selectFieldworkEvidenceSelections(args.packet);
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

  const linkedObject = resolveLinkedObjectFromAnchor(anchorItem);
  if (!linkedObject) {
    return null;
  }

  const evidenceBackedSummary = anchorItem.publicSafeSummary?.trim() ?? "";
  if (!evidenceBackedSummary) {
    return null;
  }

  const normalizedAnchor = normalizeWhitespace(evidenceBackedSummary);
  const promptCore = truncateTitleAtWordBoundary(
    normalizedAnchor,
    PROMPT_MAX_LENGTH - FIELDWORK_PROMPT_PREFIX.length
  );
  const prompt = `${FIELDWORK_PROMPT_PREFIX}${promptCore}`;
  const reasonBody = truncateText(
    normalizedAnchor,
    REASON_MAX_LENGTH - FIELDWORK_REASON_PREFIX.length
  );
  const reason = `${FIELDWORK_REASON_PREFIX}${reasonBody}`;

  return {
    prompt,
    reason,
    linkedObjectType: linkedObject.linkedObjectType,
    linkedObjectId: linkedObject.linkedObjectId,
    abstainReasons,
    evidenceSelections,
  };
}

export function extractStructuredFieldworkCandidateProposal(output: {
  fieldworkCandidateProposal?: StructuredFieldworkCandidateProposal | null;
}): StructuredFieldworkCandidateProposal | null {
  const proposal = output.fieldworkCandidateProposal;
  if (!proposal || typeof proposal !== "object") {
    return null;
  }

  const prompt = typeof proposal.prompt === "string" ? proposal.prompt.trim() : "";
  const reason = typeof proposal.reason === "string" ? proposal.reason.trim() : "";

  if (!prompt || !reason) {
    return null;
  }

  return {
    ...proposal,
    prompt,
    reason,
  };
}
