/**
 * Explore reply grounding + reality-tracking contract.
 *
 * Grounding cites authenticated user-owned stored objects only.
 * Epistemic status must not be upgraded by confident tone.
 */

export const EXPLORE_GROUNDING_CONTRACT_VERSION = "explore-grounding-v1" as const;

export const EXPLORE_GROUNDING_EPISTEMIC_STATUSES = [
  "VERIFIED",
  "INFERRED",
  "UNVERIFIED",
  "PENDING_EVIDENCE",
] as const;

export type ExploreGroundingEpistemicStatus =
  (typeof EXPLORE_GROUNDING_EPISTEMIC_STATUSES)[number];

export const EXPLORE_GROUNDING_CLAIM_SUPPORTS = [
  "verifies",
  "infers",
  "context",
  "insufficient",
] as const;

export type ExploreGroundingClaimSupport =
  (typeof EXPLORE_GROUNDING_CLAIM_SUPPORTS)[number];

export type ExploreGroundingPayloadStatus =
  | "grounded"
  | "ungrounded"
  | "insufficient_evidence";

export const EXPLORE_GROUNDING_SOURCE_FAMILIES = [
  "journal_entry",
  "pattern_claim",
  "pattern_claim_evidence",
  "usermap_conclusion",
  "reference_item",
  "message",
  "session",
] as const;

export type ExploreGroundingSourceFamily =
  (typeof EXPLORE_GROUNDING_SOURCE_FAMILIES)[number];

export type ExploreGroundingSource = {
  sourceId: string;
  sourceType: ExploreGroundingSourceFamily;
  sourceFamily: ExploreGroundingSourceFamily;
  userId: string;
  title: string;
  extract: string;
  retrievalReason: string;
  claimSupport: ExploreGroundingClaimSupport;
  epistemicStatus: ExploreGroundingEpistemicStatus;
};

export type ExploreGroundingClaim = {
  text: string;
  epistemicStatus: ExploreGroundingEpistemicStatus;
  sourceIds: string[];
};

export type ExploreMovementProposalStatus =
  | "proposed"
  | "published"
  | "rejected"
  | "insufficient_evidence"
  | "none";

export type ExploreGroundingPayload = {
  version: typeof EXPLORE_GROUNDING_CONTRACT_VERSION;
  status: ExploreGroundingPayloadStatus;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  sources: ExploreGroundingSource[];
  claims: ExploreGroundingClaim[];
  movementProposal: {
    status: ExploreMovementProposalStatus;
    proposalId: string | null;
    modelUpdateId: string | null;
    beforeSummary: string | null;
    afterSummary: string | null;
    rationale: string | null;
  };
};

export const EXPLORE_PROPOSED_MOVEMENT_LABEL = "PROPOSED MODEL MOVEMENT";
export const EXPLORE_PUBLISHED_MOVEMENT_LABEL = "PUBLISHED MODEL UPDATE";
export const EXPLORE_REJECTED_MOVEMENT_LABEL = "REJECTED / DISMISSED PROPOSAL";
export const EXPLORE_NO_MOVEMENT_LABEL = "NO MOVEMENT — INSUFFICIENT EVIDENCE";

export const EXPLORE_GROUNDING_EMPTY_COPY =
  "No linked evidence for this reply yet.";
export const EXPLORE_GROUNDING_INSUFFICIENT_COPY =
  "Evidence was retrieved but is insufficient to ground model movement.";
export const EXPLORE_REFERENCE_GROUNDING_FORBIDDEN_COPY =
  "Reference grounding is not used in live Explore chat.";

export function isExploreGroundingPayload(
  value: unknown
): value is ExploreGroundingPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExploreGroundingPayload>;
  return (
    candidate.version === EXPLORE_GROUNDING_CONTRACT_VERSION &&
    typeof candidate.status === "string" &&
    typeof candidate.conversationId === "string" &&
    typeof candidate.assistantMessageId === "string" &&
    typeof candidate.userMessageId === "string" &&
    Array.isArray(candidate.sources) &&
    Array.isArray(candidate.claims) &&
    typeof candidate.movementProposal === "object" &&
    candidate.movementProposal !== null
  );
}

export function groundingSourceIds(
  payload: ExploreGroundingPayload | null | undefined
): string[] {
  if (!payload) return [];
  return payload.sources.map((source) => source.sourceId);
}

export function payloadHasVerifiedAndInferred(
  payload: ExploreGroundingPayload
): boolean {
  const statuses = new Set(payload.sources.map((source) => source.epistemicStatus));
  return statuses.has("VERIFIED") && statuses.has("INFERRED");
}

export function emptyExploreGroundingPayload(args: {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  status?: ExploreGroundingPayloadStatus;
}): ExploreGroundingPayload {
  return {
    version: EXPLORE_GROUNDING_CONTRACT_VERSION,
    status: args.status ?? "ungrounded",
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    sources: [],
    claims: [],
    movementProposal: {
      status: args.status === "insufficient_evidence" ? "insufficient_evidence" : "none",
      proposalId: null,
      modelUpdateId: null,
      beforeSummary: null,
      afterSummary: null,
      rationale: null,
    },
  };
}
