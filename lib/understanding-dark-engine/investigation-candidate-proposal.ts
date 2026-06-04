import {
  InvestigationSeedType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import type { RejectionReasonCode } from "./constants";
import type { DarkRunUserMapEvaluation } from "./dark-run-evaluator";
import type { UserMapCandidateEvidenceSelection } from "./user-map-candidate-persistence";
import type { EvidencePacket, EvidencePacketItem } from "./types";

const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 600;
const ORGANIZING_QUESTION_MAX_LENGTH = 240;

const INVESTIGATION_SUMMARY_PREFIX =
  "This looks worth watching as an open question. ";
const INVESTIGATION_TITLE_PREFIX = "Worth exploring: ";

const DISALLOWED_PROPOSAL_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

const ANCHOR_SOURCE_TYPE_PRIORITY: UnderstandingLinkSourceType[] = [
  "contradiction_node",
  "pattern_claim",
];

const INVESTIGATION_FRAMING_ABSTAIN_REASONS = new Set<RejectionReasonCode>([
  "INSUFFICIENT_EVIDENCE_COUNT",
  "INSUFFICIENT_SOURCE_DIVERSITY",
  "INSUFFICIENT_TIME_SPREAD",
  "HIGH_EMOTION_IDENTITY_BLOCK",
  "SINGLE_EPISODE_SUPPORTED_BLOCK",
  "DISCONFIRMATION_UNRESOLVED",
]);

const INVESTIGATION_FRAMING_WARNING_CODES = new Set<RejectionReasonCode>([
  "HIGH_EMOTION_DOMINANCE_CAP",
]);

export type StructuredInvestigationCandidateProposal = {
  seedType: InvestigationSeedType;
  title: string;
  organizingQuestion: string;
  summary: string;
  abstainReasons: RejectionReasonCode[];
  evidenceSelections: UserMapCandidateEvidenceSelection[];
};

export const INVESTIGATION_CANDIDATE_SAFE_WORDING_PATTERNS = [
  /^This looks worth watching\b/i,
  /^This may be worth\b/i,
  /^Worth exploring:/i,
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

function selectInvestigationEvidenceSelections(
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

export function hasInvestigationFramingAbstainSignal(
  evaluation: DarkRunUserMapEvaluation
): boolean {
  const codes = [
    ...evaluation.result.reasons,
    ...evaluation.result.warnings,
  ] as RejectionReasonCode[];

  return codes.some(
    (code) =>
      INVESTIGATION_FRAMING_ABSTAIN_REASONS.has(code) ||
      INVESTIGATION_FRAMING_WARNING_CODES.has(code)
  );
}

function collectInvestigationAbstainReasons(
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
          INVESTIGATION_FRAMING_ABSTAIN_REASONS.has(code) ||
          INVESTIGATION_FRAMING_WARNING_CODES.has(code)
      )
    ),
  ];
}

function inferSeedType(
  abstainReasons: RejectionReasonCode[],
  anchorSourceType: UnderstandingLinkSourceType
): InvestigationSeedType {
  if (abstainReasons.includes("DISCONFIRMATION_UNRESOLVED")) {
    return InvestigationSeedType.contradiction;
  }

  if (
    abstainReasons.includes("HIGH_EMOTION_IDENTITY_BLOCK") ||
    abstainReasons.includes("HIGH_EMOTION_DOMINANCE_CAP")
  ) {
    return InvestigationSeedType.state_switch;
  }

  if (abstainReasons.includes("SINGLE_EPISODE_SUPPORTED_BLOCK")) {
    return InvestigationSeedType.pattern;
  }

  if (anchorSourceType === "contradiction_node") {
    return InvestigationSeedType.contradiction;
  }

  if (anchorSourceType === "pattern_claim") {
    return InvestigationSeedType.pattern;
  }

  return InvestigationSeedType.model_uncertainty;
}

function buildOrganizingQuestion(anchorSummary: string): string {
  const core = truncateTitleAtWordBoundary(anchorSummary, ORGANIZING_QUESTION_MAX_LENGTH - 32);
  const question = `What would clarify whether ${core}?`;
  return truncateText(question, ORGANIZING_QUESTION_MAX_LENGTH);
}

export function usesInvestigationCandidateSafeWording(proposal: {
  title: string;
  summary: string;
}): boolean {
  return INVESTIGATION_CANDIDATE_SAFE_WORDING_PATTERNS.some(
    (pattern) => pattern.test(proposal.title) || pattern.test(proposal.summary)
  );
}

/**
 * Builds structured internal Investigation candidate proposal for no-write dark runs.
 * Emitted when UserMap gates abstain with investigation-framing signals and safe-summary anchors exist.
 */
export function buildStructuredInvestigationCandidateProposal(args: {
  packet: EvidencePacket;
  evaluation: DarkRunUserMapEvaluation;
}): StructuredInvestigationCandidateProposal | null {
  if (args.evaluation.result.decision !== "abstain") {
    return null;
  }

  if (!hasInvestigationFramingAbstainSignal(args.evaluation)) {
    return null;
  }

  const abstainReasons = collectInvestigationAbstainReasons(args.evaluation);
  if (abstainReasons.length === 0) {
    return null;
  }

  const evidenceSelections = selectInvestigationEvidenceSelections(args.packet);
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

  const evidenceBackedSummary = anchorItem.publicSafeSummary?.trim() ?? "";
  if (!evidenceBackedSummary) {
    return null;
  }

  const normalizedAnchor = normalizeWhitespace(evidenceBackedSummary);
  const titleCore = truncateTitleAtWordBoundary(
    normalizedAnchor,
    TITLE_MAX_LENGTH - INVESTIGATION_TITLE_PREFIX.length
  );
  const title = `${INVESTIGATION_TITLE_PREFIX}${titleCore}`;
  const summaryBody = truncateText(normalizedAnchor, SUMMARY_MAX_LENGTH - INVESTIGATION_SUMMARY_PREFIX.length);
  const summary = `${INVESTIGATION_SUMMARY_PREFIX}${summaryBody}`;
  const organizingQuestion = buildOrganizingQuestion(normalizedAnchor);
  const seedType = inferSeedType(abstainReasons, anchorItem.sourceType);

  return {
    seedType,
    title,
    organizingQuestion,
    summary,
    abstainReasons,
    evidenceSelections,
  };
}

export function extractStructuredInvestigationCandidateProposal(output: {
  investigationCandidateProposal?: StructuredInvestigationCandidateProposal | null;
}): StructuredInvestigationCandidateProposal | null {
  const proposal = output.investigationCandidateProposal;
  if (!proposal || typeof proposal !== "object") {
    return null;
  }

  const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
  const summary = typeof proposal.summary === "string" ? proposal.summary.trim() : "";
  const organizingQuestion =
    typeof proposal.organizingQuestion === "string"
      ? proposal.organizingQuestion.trim()
      : "";

  if (!title || !summary || !organizingQuestion) {
    return null;
  }

  return {
    ...proposal,
    title,
    summary,
    organizingQuestion,
  };
}
