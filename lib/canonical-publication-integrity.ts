/**
 * Shared canonical publication integrity validators.
 *
 * Used by Explore publication (Phase 3B) and the canonical read projection
 * (Phase 4). Do not duplicate these rules in either caller.
 */

import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  CanonicalModelAuthorityError,
  type CanonicalModelAuthorityErrorCode,
} from "./canonical-model-authority-errors";
import { deriveExploreMovementModelUpdateId } from "./explore-movement-proposal-provenance";
import { encodeMovementRationaleInInternalNotes } from "./model-movement-rationale";

/** Marker embedded in ModelUpdate.internalNotes for Explore lineage. */
export const EXPLORE_PROPOSAL_MARKER = "exploreMovementProposal:v1";

export type CanonicalPublicationProposalIdentity = {
  id: string;
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: ExploreMovementProposalStatus;
  authorityMode: ExploreMovementAuthorityMode;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sourcesJson: unknown;
  modelUpdateId: string | null;
  expectedCurrentRevisionId: string | null;
  expectedLegacySnapshotHash: string | null;
  canonicalConceptId: string | null;
  revisionOperation: CanonicalRevisionOperation | null;
};

export function buildExploreMovementModelUpdateLineageNotes(args: {
  proposalId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  rationale: string;
}): string {
  return encodeMovementRationaleInInternalNotes(
    `${EXPLORE_PROPOSAL_MARKER};proposalId=${args.proposalId};conversationId=${args.conversationId};assistantMessageId=${args.assistantMessageId};userMessageId=${args.userMessageId}`,
    args.rationale,
  );
}

function fail(
  code: CanonicalModelAuthorityErrorCode,
  message: string,
): never {
  throw new CanonicalModelAuthorityError(code, message);
}

export function assertCanonicalProposalAuthorityShape(
  proposal: CanonicalPublicationProposalIdentity,
  failureCode: CanonicalModelAuthorityErrorCode = "BROKEN_CANONICAL_PUBLICATION",
): void {
  if (proposal.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
    fail(failureCode, "Canonical publisher requires authorityMode=canonical_v1");
  }
  if (
    typeof proposal.canonicalConceptId !== "string" ||
    proposal.canonicalConceptId.length === 0
  ) {
    fail(failureCode, "Canonical proposal missing canonicalConceptId");
  }
  if (
    typeof proposal.expectedCurrentRevisionId !== "string" ||
    proposal.expectedCurrentRevisionId.length === 0
  ) {
    fail(failureCode, "Canonical proposal missing expectedCurrentRevisionId");
  }
  if (proposal.expectedLegacySnapshotHash != null) {
    fail(
      failureCode,
      "Canonical proposal must not carry expectedLegacySnapshotHash",
    );
  }
  if (proposal.revisionOperation !== CanonicalRevisionOperation.strengthen) {
    fail(failureCode, "Canonical proposal revisionOperation must be strengthen");
  }
  if (
    proposal.affectedObjectType !==
    UnderstandingLinkTargetType.usermap_conclusion
  ) {
    fail(
      failureCode,
      "Canonical proposal affectedObjectType must be usermap_conclusion",
    );
  }
}

export function assertExactCanonicalResultingRevision(args: {
  resultingRevision: {
    id: string;
    summary: string;
    rationale: string | null;
    registrationSnapshotHash: string | null;
    title: string;
    status: string;
    confidenceScore: number;
    confidenceLevel: string;
    previousRevisionId: string | null;
    version: number;
    operation: CanonicalRevisionOperation;
    decisionSource: CanonicalRevisionDecisionSource;
  };
  previousRevision: {
    id: string;
    title: string;
    status: string;
    confidenceScore: number;
    confidenceLevel: string;
    summary: string;
  };
  proposal: CanonicalPublicationProposalIdentity;
  failureCode?: CanonicalModelAuthorityErrorCode;
}): void {
  const code = args.failureCode ?? "BROKEN_CANONICAL_PUBLICATION";

  if (args.resultingRevision.summary !== args.proposal.afterSummary) {
    fail(
      code,
      "Canonical resulting revision summary must equal proposal.afterSummary",
    );
  }
  if (args.resultingRevision.rationale !== args.proposal.rationale) {
    fail(
      code,
      "Canonical resulting revision rationale must equal proposal.rationale",
    );
  }
  if (args.resultingRevision.registrationSnapshotHash != null) {
    fail(
      code,
      "Canonical resulting revision registrationSnapshotHash must be null",
    );
  }
  if (args.resultingRevision.title !== args.previousRevision.title) {
    fail(code, "Canonical resulting revision title must match previous revision");
  }
  if (args.resultingRevision.status !== args.previousRevision.status) {
    fail(
      code,
      "Canonical resulting revision status must match previous revision",
    );
  }
  if (
    args.resultingRevision.confidenceScore !==
    args.previousRevision.confidenceScore
  ) {
    fail(
      code,
      "Canonical resulting revision confidenceScore must match previous revision",
    );
  }
  if (
    args.resultingRevision.confidenceLevel !==
    args.previousRevision.confidenceLevel
  ) {
    fail(
      code,
      "Canonical resulting revision confidenceLevel must match previous revision",
    );
  }
  if (args.resultingRevision.previousRevisionId !== args.previousRevision.id) {
    fail(code, "Canonical resulting revision previousRevisionId mismatch");
  }
  if (args.resultingRevision.version !== 2) {
    fail(code, "Canonical resulting revision must be version 2");
  }
  if (args.resultingRevision.operation !== CanonicalRevisionOperation.strengthen) {
    fail(code, "Canonical resulting revision operation must be strengthen");
  }
  if (
    args.resultingRevision.decisionSource !==
    CanonicalRevisionDecisionSource.explore_proposal
  ) {
    fail(
      code,
      "Canonical resulting revision decisionSource must be explore_proposal",
    );
  }
}

/**
 * Exact identity validator for the canonical ModelUpdate produced by a proposal.
 * Used after insertion, on idempotent published returns, projection reads,
 * and after claim-race recovery.
 */
export function assertExactCanonicalModelUpdateIdentity(args: {
  modelUpdate: {
    id: string;
    userId: string;
    updateType: string;
    visibility: string;
    isMeaningful: boolean;
    affectedObjectType: string;
    affectedObjectId: string;
    beforeSummary: string | null;
    afterSummary: string | null;
    userFacingSummary: string;
    internalNotes: string | null;
    confidenceDelta: number | null;
    canonicalConceptId: string | null;
    previousRevisionId: string | null;
    resultingRevisionId: string | null;
    exploreProposalId: string | null;
  };
  proposal: CanonicalPublicationProposalIdentity;
  previousRevision: { id: string; summary: string };
  resultingRevision: { id: string; summary: string };
  failureCode?: CanonicalModelAuthorityErrorCode;
}): void {
  const code = args.failureCode ?? "BROKEN_CANONICAL_PUBLICATION";
  const expectedId = deriveExploreMovementModelUpdateId(args.proposal.id);
  const expectedNotes = buildExploreMovementModelUpdateLineageNotes({
    proposalId: args.proposal.id,
    conversationId: args.proposal.conversationId,
    assistantMessageId: args.proposal.assistantMessageId,
    userMessageId: args.proposal.userMessageId,
    rationale: args.proposal.rationale,
  });

  if (args.modelUpdate.id !== expectedId) {
    fail(
      code,
      "Canonical ModelUpdate id must be deriveExploreMovementModelUpdateId(proposal.id)",
    );
  }
  if (args.modelUpdate.userId !== args.proposal.userId) {
    fail(code, "Canonical ModelUpdate userId mismatch");
  }
  if (args.modelUpdate.updateType !== ModelUpdateType.conclusion_strengthened) {
    fail(code, "Canonical ModelUpdate updateType must be conclusion_strengthened");
  }
  if (args.modelUpdate.visibility !== ModelUpdateVisibility.user_visible) {
    fail(code, "Canonical ModelUpdate visibility must be user_visible");
  }
  if (args.modelUpdate.isMeaningful !== true) {
    fail(code, "Canonical ModelUpdate isMeaningful must be true");
  }
  if (
    args.modelUpdate.affectedObjectType !==
    UnderstandingLinkTargetType.canonical_concept_revision
  ) {
    fail(
      code,
      "Canonical ModelUpdate affectedObjectType must be canonical_concept_revision",
    );
  }
  if (args.modelUpdate.affectedObjectId !== args.resultingRevision.id) {
    fail(
      code,
      "Canonical ModelUpdate affectedObjectId must equal resultingRevision.id",
    );
  }
  if (args.modelUpdate.beforeSummary !== args.previousRevision.summary) {
    fail(
      code,
      "Canonical ModelUpdate beforeSummary must equal previousRevision.summary",
    );
  }
  if (args.modelUpdate.afterSummary !== args.resultingRevision.summary) {
    fail(
      code,
      "Canonical ModelUpdate afterSummary must equal resultingRevision.summary",
    );
  }
  if (args.modelUpdate.userFacingSummary !== args.proposal.userFacingSummary) {
    fail(
      code,
      "Canonical ModelUpdate userFacingSummary must equal proposal.userFacingSummary",
    );
  }
  if (args.modelUpdate.internalNotes !== expectedNotes) {
    fail(code, "Canonical ModelUpdate internalNotes must match exact lineage notes");
  }
  if (args.modelUpdate.confidenceDelta != null) {
    fail(code, "Canonical ModelUpdate confidenceDelta must be null");
  }
  if (args.modelUpdate.canonicalConceptId !== args.proposal.canonicalConceptId) {
    fail(code, "Canonical ModelUpdate canonicalConceptId mismatch");
  }
  if (
    args.modelUpdate.previousRevisionId !==
    args.proposal.expectedCurrentRevisionId
  ) {
    fail(code, "Canonical ModelUpdate previousRevisionId mismatch");
  }
  if (args.modelUpdate.resultingRevisionId !== args.resultingRevision.id) {
    fail(code, "Canonical ModelUpdate resultingRevisionId mismatch");
  }
  if (args.modelUpdate.exploreProposalId !== args.proposal.id) {
    fail(code, "Canonical ModelUpdate exploreProposalId mismatch");
  }

  if (args.proposal.status === ExploreMovementProposalStatus.published) {
    if (args.proposal.modelUpdateId !== args.modelUpdate.id) {
      fail(code, "Published proposal.modelUpdateId must equal ModelUpdate.id");
    }
  } else if (
    args.proposal.modelUpdateId != null &&
    args.proposal.modelUpdateId !== args.modelUpdate.id
  ) {
    fail(code, "proposal.modelUpdateId must equal ModelUpdate.id when set");
  }
}
