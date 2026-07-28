/**
 * Explore movement proposal create / reject / publish orchestration.
 *
 * Proposed movement = ExploreMovementProposal row (NOT a ModelUpdate).
 * Published movement = ModelUpdate created at publish time, linked from the proposal.
 * Rejected proposal never creates a ModelUpdate.
 *
 * DEL-001B corrections:
 * - versioned coherent provenance required for publish;
 * - database ownership / lineage revalidation before any write;
 * - deterministic proposal + ModelUpdate IDs for concurrency-safe idempotency;
 * - target beforeSummary must still match the canonical UMC summary.
 */

import {
  CanonicalRevisionDecisionSource,
  CanonicalRevisionOperation,
  ExploreMovementAuthorityMode,
  ExploreMovementProposalStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type PrismaClient,
  type UserMapConclusionStatus,
  type UserMapConfidenceLevel,
} from "@prisma/client";

import type { ExploreGroundingSource } from "./explore-grounding-contract";
import {
  isCanonicalModelAuthorityEnabledForUser,
} from "./canonical-model-authority-flag";
import {
  CanonicalModelAuthorityError,
  isCanonicalModelAuthorityError,
} from "./canonical-model-authority-errors";
import {
  resolveOrRegisterCanonicalConceptFromUserMapConclusion,
  type CanonicalAuthorityTransactionClient,
} from "./canonical-concept-registration";
import {
  prepareCanonicalProposalEvidence,
  insertPreparedCanonicalRevisionEvidence,
  type CanonicalRevisionEvidenceDb,
} from "./canonical-revision-evidence";
import { deriveCanonicalUmcSnapshotHash } from "./canonical-umc-snapshot-hash";
import {
  EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS,
  matchesUnsafeFixedExploreMovementSignature,
  type ExploreMovementBlockedUnsafeFixedSemantics,
} from "./explore-movement-fixed-semantics-containment";
import {
  deriveExploreMovementModelUpdateId,
  deriveExploreMovementProposalId,
  EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
  extractExploreMovementProposalSources,
  normalizeExploreMovementAfterSummaryForIdentity,
  parseExploreMovementProposalProvenance,
  type ExploreMovementBlockedUnverifiedSemanticProvenance,
  type ExploreMovementProposalProvenance,
} from "./explore-movement-proposal-provenance";
import { isQualifyingExploreUserMapConclusion } from "./explore-movement-semantic-adjudicator";
import {
  isSupportedEvidenceLinkPair,
} from "./orvek-intelligence-object-authority";
import {
  PublishModelUpdateCandidateError,
  publishModelUpdateCandidate,
} from "./model-update-candidate-publish-helper";
import { encodeMovementRationaleInInternalNotes } from "./model-movement-rationale";
import { verifyUnderstandingEvidenceLinkSourceOwnership } from "./understanding-evidence-link-writer";

export const EXPLORE_PROPOSAL_MARKER = "exploreMovementProposal:v1";

export type ExploreProposalRecord = {
  proposalId: string;
  modelUpdateId: string | null;
  status: "proposed" | "published" | "rejected";
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
};

function sourceTypeToLinkSource(
  sourceType: ExploreGroundingSource["sourceType"]
): UnderstandingLinkSourceType | null {
  switch (sourceType) {
    case "journal_entry":
      return UnderstandingLinkSourceType.journal_entry;
    case "pattern_claim":
      return UnderstandingLinkSourceType.pattern_claim;
    case "pattern_claim_evidence":
      return UnderstandingLinkSourceType.pattern_claim_evidence;
    case "reference_item":
      return UnderstandingLinkSourceType.reference_item;
    case "message":
      return UnderstandingLinkSourceType.message;
    case "session":
      return UnderstandingLinkSourceType.session;
    case "usermap_conclusion":
      return null;
    default:
      return null;
  }
}

function toProposalRecord(row: {
  id: string;
  modelUpdateId: string | null;
  status: ExploreMovementProposalStatus;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
}): ExploreProposalRecord {
  return {
    proposalId: row.id,
    modelUpdateId: row.modelUpdateId,
    status: row.status,
    beforeSummary: row.beforeSummary,
    afterSummary: row.afterSummary,
    rationale: row.rationale,
    userFacingSummary: row.userFacingSummary,
  };
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Thrown inside a publication transaction when the proposal CAS loses. */
export class ExploreMovementPublicationClaimLostError extends Error {
  constructor() {
    super("explore_movement_publication_claim_lost");
    this.name = "ExploreMovementPublicationClaimLostError";
  }
}

function buildExploreMovementModelUpdateLineageNotes(args: {
  proposalId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  rationale: string;
}): string {
  return encodeMovementRationaleInInternalNotes(
    `${EXPLORE_PROPOSAL_MARKER};proposalId=${args.proposalId};conversationId=${args.conversationId};assistantMessageId=${args.assistantMessageId};userMessageId=${args.userMessageId}`,
    args.rationale
  );
}

function modelUpdateMatchesExploreProposalIdentity(args: {
  row: {
    userId: string;
    updateType: string;
    affectedObjectType: string;
    affectedObjectId: string;
    beforeSummary: string | null;
    afterSummary: string | null;
    userFacingSummary: string;
    internalNotes: string | null;
  };
  userId: string;
  proposalId: string;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  userFacingSummary: string;
}): boolean {
  if (args.row.userId !== args.userId) return false;
  if (args.row.updateType !== ModelUpdateType.conclusion_strengthened) return false;
  if (args.row.affectedObjectType !== UnderstandingLinkTargetType.usermap_conclusion) {
    return false;
  }
  if (args.row.affectedObjectId !== args.affectedObjectId) return false;
  if (args.row.beforeSummary !== args.beforeSummary) return false;
  if (args.row.afterSummary !== args.afterSummary) return false;
  if (args.row.userFacingSummary !== args.userFacingSummary) return false;
  const notes = args.row.internalNotes ?? "";
  if (!notes.includes(`proposalId=${args.proposalId}`)) return false;
  if (!notes.includes(EXPLORE_PROPOSAL_MARKER)) return false;
  return true;
}

/**
 * Best-effort PostgreSQL row lock. Missing $queryRaw (test fakes) is a no-op;
 * production interactive transactions still re-read + CAS under isolation.
 */
async function lockRowForUpdate(args: {
  db: {
    $queryRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  };
  table: "ExploreMovementProposal" | "UserMapConclusion";
  id: string;
  userId: string;
}): Promise<void> {
  if (typeof args.db.$queryRaw !== "function") return;
  if (args.table === "ExploreMovementProposal") {
    await args.db.$queryRaw`
      SELECT id FROM "ExploreMovementProposal"
      WHERE id = ${args.id} AND "userId" = ${args.userId}
      FOR UPDATE
    `;
    return;
  }
  await args.db.$queryRaw`
    SELECT id FROM "UserMapConclusion"
    WHERE id = ${args.id} AND "userId" = ${args.userId}
    FOR UPDATE
  `;
}

/** @deprecated Marker helpers retained for leftover ModelUpdate cleanup only. */
export function isExploreProposalRejected(internalNotes: string | null | undefined): boolean {
  return Boolean(internalNotes && internalNotes.includes("exploreMovementProposal:rejected"));
}

/** @deprecated Marker helpers retained for leftover ModelUpdate cleanup only. */
export function isExploreProposalNotes(internalNotes: string | null | undefined): boolean {
  return Boolean(internalNotes && internalNotes.includes(EXPLORE_PROPOSAL_MARKER));
}

async function verifyOwnedUserMapConclusionSource(args: {
  userId: string;
  sourceId: string;
  db: PrismaClient;
}): Promise<boolean> {
  const row = await args.db.userMapConclusion.findFirst({
    where: { id: args.sourceId, userId: args.userId },
    select: { id: true },
  });
  return Boolean(row);
}

async function verifyProvenanceSourceOwnershipAndType(args: {
  userId: string;
  db: PrismaClient;
  source: ExploreGroundingSource;
}): Promise<boolean> {
  if (args.source.sourceType === "usermap_conclusion") {
    return verifyOwnedUserMapConclusionSource({
      userId: args.userId,
      sourceId: args.source.sourceId,
      db: args.db,
    });
  }

  // Message provenance: trust the Message row role, never sourcesJson implication.
  // Assistant-role messages are never eligible as semantic evidence sources.
  if (args.source.sourceType === "message") {
    const row = await args.db.message.findFirst({
      where: { id: args.source.sourceId, userId: args.userId },
      select: { id: true, role: true },
    });
    if (!row) return false;
    if (row.role === "assistant") return false;
    return row.role === "user";
  }

  const mapped = sourceTypeToLinkSource(args.source.sourceType);
  if (!mapped) return false;

  // Type must match a real owned row of that source type in the database.
  return verifyUnderstandingEvidenceLinkSourceOwnership({
    userId: args.userId,
    sourceType: mapped,
    sourceId: args.source.sourceId,
    db: args.db as never,
  });
}

/**
 * Confirm a deterministic-ID occupant is a coherent semantic reuse candidate.
 * Invalid / unversioned / identity-mismatched rows fail closed.
 * Publisher-family authority shape must match the requested mode.
 */
function isReusableSemanticExploreMovementProposal(args: {
  row: {
    conversationId: string;
    assistantMessageId: string;
    userMessageId: string;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectId: string;
    afterSummary: string;
    rationale: string;
    userFacingSummary: string;
    sourcesJson: unknown;
    status: ExploreMovementProposalStatus;
    authorityMode?: ExploreMovementAuthorityMode | null;
    canonicalConceptId?: string | null;
    expectedCurrentRevisionId?: string | null;
    expectedLegacySnapshotHash?: string | null;
    revisionOperation?: CanonicalRevisionOperation | null;
  };
  expected: {
    conversationId: string;
    assistantMessageId: string;
    userMessageId: string;
    affectedObjectId: string;
    afterSummary: string;
    authorityMode: ExploreMovementAuthorityMode;
  };
}): boolean {
  const rowMode =
    args.row.authorityMode ?? ExploreMovementAuthorityMode.legacy;
  if (rowMode !== args.expected.authorityMode) return false;

  if (rowMode === ExploreMovementAuthorityMode.canonical_v1) {
    if (
      typeof args.row.canonicalConceptId !== "string" ||
      args.row.canonicalConceptId.length === 0
    ) {
      return false;
    }
    if (
      typeof args.row.expectedCurrentRevisionId !== "string" ||
      args.row.expectedCurrentRevisionId.length === 0
    ) {
      return false;
    }
    if (args.row.expectedLegacySnapshotHash != null) return false;
    if (args.row.revisionOperation !== CanonicalRevisionOperation.strengthen) {
      return false;
    }
  } else {
    if (args.row.canonicalConceptId != null) return false;
    if (args.row.expectedCurrentRevisionId != null) return false;
    if (args.row.revisionOperation != null) return false;
    // Legacy rows must keep snapshot expectation null (schema authority check).
    if (args.row.expectedLegacySnapshotHash != null) return false;
  }

  const parsed = parseExploreMovementProposalProvenance(args.row.sourcesJson);
  if (!parsed.ok) return false;

  if (
    args.row.affectedObjectType !== UnderstandingLinkTargetType.usermap_conclusion
  ) {
    return false;
  }
  if (args.row.affectedObjectId !== args.expected.affectedObjectId) return false;
  if (args.row.conversationId !== args.expected.conversationId) return false;
  if (args.row.assistantMessageId !== args.expected.assistantMessageId) {
    return false;
  }
  if (args.row.userMessageId !== args.expected.userMessageId) return false;

  if (
    normalizeExploreMovementAfterSummaryForIdentity(args.row.afterSummary) !==
    normalizeExploreMovementAfterSummaryForIdentity(args.expected.afterSummary)
  ) {
    return false;
  }

  const decision = parsed.provenance.semanticDecision;
  if (decision.outcome !== "PROPOSE_CONCLUSION_STRENGTHENING") return false;
  if (decision.targetObjectId !== args.row.affectedObjectId) return false;
  if (
    decision.afterSummary !== args.row.afterSummary ||
    decision.rationale !== args.row.rationale ||
    decision.userFacingSummary !== args.row.userFacingSummary
  ) {
    return false;
  }

  return true;
}

async function materializeEvidenceLinksForModelUpdate(args: {
  userId: string;
  db: PrismaClient;
  modelUpdateId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  sources: ExploreGroundingSource[];
}): Promise<void> {
  const linkRows: Array<{
    sourceType: UnderstandingLinkSourceType;
    sourceId: string;
    role: UnderstandingLinkRole;
    summary: string;
    snippet: string;
    quote: string;
  }> = [
    {
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.conversationId,
      role: UnderstandingLinkRole.context,
      summary: "Explore conversation lineage",
      snippet: args.conversationId,
      quote: args.conversationId,
    },
    {
      // Assistant reply is conversational context only — never supporting evidence.
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.assistantMessageId,
      role: UnderstandingLinkRole.context,
      summary: "Explore assistant reply that proposed movement",
      snippet: args.assistantMessageId,
      quote: args.assistantMessageId,
    },
    {
      // Authoritative Explore user message supports the movement claim.
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.userMessageId,
      role: UnderstandingLinkRole.supports,
      summary: "Explore user message that triggered review",
      snippet: args.userMessageId,
      quote: args.userMessageId,
    },
  ];

  for (const source of args.sources) {
    const mapped = sourceTypeToLinkSource(source.sourceType);
    if (!mapped) continue;

    if (mapped === UnderstandingLinkSourceType.message) {
      const messageRow = await args.db.message.findFirst({
        where: { id: source.sourceId, userId: args.userId },
        select: { id: true, role: true },
      });
      if (!messageRow || messageRow.role !== "user") {
        throw new Error(
          `explore_movement_message_evidence_role_rejected: ${source.sourceId}`
        );
      }
    }

    // Assistant reply must never receive a supporting-evidence role, even if a
    // provenance source incorrectly cites it (blocked above for assistant role).
    const role =
      source.sourceId === args.assistantMessageId
        ? UnderstandingLinkRole.context
        : source.claimSupport === "verifies"
          ? UnderstandingLinkRole.supports
          : UnderstandingLinkRole.context;

    linkRows.push({
      sourceType: mapped,
      sourceId: source.sourceId,
      role,
      summary: source.retrievalReason,
      snippet: source.extract.slice(0, 240),
      quote: source.extract.slice(0, 240),
    });
  }

  for (const row of linkRows) {
    if (
      !isSupportedEvidenceLinkPair({
        sourceType: row.sourceType,
        targetType: UnderstandingLinkTargetType.model_update,
      })
    ) {
      throw new Error(
        `explore_movement_unsupported_evidence_pair: ${row.sourceType} → model_update`
      );
    }

    if (
      row.sourceType === UnderstandingLinkSourceType.message &&
      row.sourceId === args.assistantMessageId &&
      row.role === UnderstandingLinkRole.supports
    ) {
      throw new Error("explore_movement_assistant_message_must_not_support");
    }

    const owned = await verifyUnderstandingEvidenceLinkSourceOwnership({
      userId: args.userId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      db: args.db as never,
    });
    if (!owned) {
      throw new Error(
        `explore_movement_evidence_source_not_owned: ${row.sourceType}:${row.sourceId}`
      );
    }

    await args.db.understandingEvidenceLink.upsert({
      where: {
        userId_targetType_targetId_sourceType_sourceId_role: {
          userId: args.userId,
          targetType: UnderstandingLinkTargetType.model_update,
          targetId: args.modelUpdateId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          role: row.role,
        },
      },
      create: {
        userId: args.userId,
        targetType: UnderstandingLinkTargetType.model_update,
        targetId: args.modelUpdateId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        role: row.role,
        summary: row.summary,
        snippet: row.snippet,
        quote: row.quote,
      },
      update: {
        summary: row.summary,
        snippet: row.snippet,
        quote: row.quote,
      },
    });
  }
}

/**
 * Publication provenance + database lineage gate for still-proposed semantic rows.
 * Blocking occurs before ModelUpdate / UEL / proposal mutation.
 */
export async function evaluateExploreMovementPublicationProvenance(args: {
  userId: string;
  db: PrismaClient;
  proposal: {
    conversationId: string;
    assistantMessageId: string;
    userMessageId: string;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectId: string;
    beforeSummary: string;
    afterSummary: string;
    rationale: string;
    userFacingSummary: string;
    sourcesJson: unknown;
  };
  /** Route session ID — must equal proposal.conversationId when provided. */
  routeConversationId?: string;
}): Promise<
  | {
      ok: true;
      provenance: ExploreMovementProposalProvenance;
      sources: ExploreGroundingSource[];
    }
  | {
      ok: false;
      block:
        | ExploreMovementBlockedUnverifiedSemanticProvenance
        | ExploreMovementBlockedUnsafeFixedSemantics;
    }
> {
  if (
    matchesUnsafeFixedExploreMovementSignature({
      afterSummary: args.proposal.afterSummary,
      rationale: args.proposal.rationale,
      userFacingSummary: args.proposal.userFacingSummary,
    })
  ) {
    return { ok: false, block: EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS };
  }

  if (
    args.routeConversationId != null &&
    args.routeConversationId !== args.proposal.conversationId
  ) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const parsed = parseExploreMovementProposalProvenance(args.proposal.sourcesJson);
  if (!parsed.ok) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const provenance = parsed.provenance;
  const decision = provenance.semanticDecision;

  if (decision.outcome !== "PROPOSE_CONCLUSION_STRENGTHENING") {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  if (args.proposal.affectedObjectType !== UnderstandingLinkTargetType.usermap_conclusion) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  if (decision.targetObjectId !== args.proposal.affectedObjectId) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  if (
    decision.afterSummary !== args.proposal.afterSummary ||
    decision.rationale !== args.proposal.rationale ||
    decision.userFacingSummary !== args.proposal.userFacingSummary
  ) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const session = await args.db.session.findFirst({
    where: {
      id: args.proposal.conversationId,
      userId: args.userId,
      surfaceType: "explore_chat",
    },
    select: { id: true },
  });
  if (!session) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const userMessage = await args.db.message.findFirst({
    where: {
      id: args.proposal.userMessageId,
      userId: args.userId,
      sessionId: args.proposal.conversationId,
      role: "user",
    },
    select: { id: true },
  });
  if (!userMessage) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const assistantMessage = await args.db.message.findFirst({
    where: {
      id: args.proposal.assistantMessageId,
      userId: args.userId,
      sessionId: args.proposal.conversationId,
      role: "assistant",
    },
    select: { id: true },
  });
  if (!assistantMessage) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  const sources = provenance.sources as ExploreGroundingSource[];
  for (const source of sources) {
    const owned = await verifyProvenanceSourceOwnershipAndType({
      userId: args.userId,
      db: args.db,
      source,
    });
    if (!owned) {
      return {
        ok: false,
        block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
      };
    }

    const mapped = sourceTypeToLinkSource(source.sourceType);
    if (mapped) {
      if (
        !isSupportedEvidenceLinkPair({
          sourceType: mapped,
          targetType: UnderstandingLinkTargetType.model_update,
        })
      ) {
        return {
          ok: false,
          block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
        };
      }
    }
  }

  const target = await args.db.userMapConclusion.findFirst({
    where: {
      id: args.proposal.affectedObjectId,
      userId: args.userId,
    },
    select: {
      id: true,
      visibility: true,
      status: true,
      supersededById: true,
      candidateLifecycleStatus: true,
      summary: true,
    },
  });

  if (
    !target ||
    !isQualifyingExploreUserMapConclusion({
      visibility: target.visibility,
      status: target.status,
      supersededById: target.supersededById,
      candidateLifecycleStatus: target.candidateLifecycleStatus,
      summary: target.summary,
    })
  ) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  // Stale semantic baseline: canonical summary changed after proposal creation.
  if (target.summary !== args.proposal.beforeSummary) {
    return {
      ok: false,
      block: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
    };
  }

  return { ok: true, provenance, sources };
}

async function requireCanonicalProposalProvenance(args: {
  provenance?: ExploreMovementProposalProvenance;
  sourcesJson?: unknown;
  affectedObjectId: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
}): Promise<ExploreMovementProposalProvenance> {
  const raw = args.provenance ?? args.sourcesJson;
  if (raw === undefined || raw === null) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore proposal requires versioned provenance",
    );
  }

  const parsed = parseExploreMovementProposalProvenance(raw);
  if (!parsed.ok) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      parsed.legacyArray
        ? "Canonical Explore proposal rejects legacy array-only sources"
        : `Canonical Explore proposal provenance invalid: ${parsed.errors.join(" | ")}`,
    );
  }

  const decision = parsed.provenance.semanticDecision;
  if (decision.outcome !== "PROPOSE_CONCLUSION_STRENGTHENING") {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore provenance must propose conclusion strengthening",
    );
  }
  if (decision.targetObjectId !== args.affectedObjectId) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore provenance targetObjectId must match affectedObjectId",
    );
  }
  if (decision.afterSummary !== args.afterSummary) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore provenance afterSummary must match proposal afterSummary",
    );
  }
  if (decision.rationale !== args.rationale) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore provenance rationale must match proposal rationale",
    );
  }
  if (decision.userFacingSummary !== args.userFacingSummary) {
    throw new CanonicalModelAuthorityError(
      "INVALID_PROPOSAL_PROVENANCE",
      "Canonical Explore provenance userFacingSummary must match proposal userFacingSummary",
    );
  }

  return parsed.provenance;
}

async function resolveOwnedQualifyingUserMapConclusionForCanonicalProposal(args: {
  userId: string;
  affectedObjectId: string;
  db: PrismaClient;
}): Promise<{
  id: string;
  title: string;
  summary: string;
  status: UserMapConclusionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  updatedAt: Date;
}> {
  const owned = await args.db.userMapConclusion.findFirst({
    where: { id: args.affectedObjectId, userId: args.userId },
    select: {
      id: true,
      userId: true,
      title: true,
      summary: true,
      status: true,
      visibility: true,
      supersededById: true,
      candidateLifecycleStatus: true,
      confidenceScore: true,
      confidenceLevel: true,
      updatedAt: true,
    },
  });

  if (!owned) {
    const any = await args.db.userMapConclusion.findFirst({
      where: { id: args.affectedObjectId },
      select: { id: true, userId: true },
    });
    if (!any) {
      throw new CanonicalModelAuthorityError(
        "NOT_FOUND",
        `UserMapConclusion not found: ${args.affectedObjectId}`,
      );
    }
    throw new CanonicalModelAuthorityError(
      "WRONG_OWNER",
      `UserMapConclusion ownership mismatch: ${args.affectedObjectId}`,
    );
  }

  if (
    !isQualifyingExploreUserMapConclusion({
      visibility: owned.visibility,
      status: owned.status,
      supersededById: owned.supersededById,
      candidateLifecycleStatus: owned.candidateLifecycleStatus,
      summary: owned.summary,
    })
  ) {
    throw new CanonicalModelAuthorityError(
      "NOT_QUALIFYING_CONCLUSION",
      `UserMapConclusion is not qualifying for canonical proposal: ${owned.id}`,
    );
  }

  return {
    id: owned.id,
    title: owned.title,
    summary: owned.summary,
    status: owned.status,
    confidenceScore: Number(owned.confidenceScore),
    confidenceLevel: owned.confidenceLevel,
    updatedAt: owned.updatedAt,
  };
}

async function createLegacyExploreMovementProposal(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sources?: ExploreGroundingSource[];
  provenance?: ExploreMovementProposalProvenance;
  id?: string;
}): Promise<ExploreProposalRecord> {
  const sourcesJson =
    args.provenance ??
    args.sources ??
    ([] as ExploreGroundingSource[]);

  const data = {
    ...(args.id ? { id: args.id } : {}),
    userId: args.userId,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    status: ExploreMovementProposalStatus.proposed,
    authorityMode: ExploreMovementAuthorityMode.legacy,
    affectedObjectType: args.affectedObjectType,
    affectedObjectId: args.affectedObjectId,
    beforeSummary: args.beforeSummary,
    afterSummary: args.afterSummary,
    rationale: args.rationale,
    userFacingSummary: args.userFacingSummary,
    sourcesJson,
    modelUpdateId: null,
    expectedCurrentRevisionId: null,
    expectedLegacySnapshotHash: null,
    canonicalConceptId: null,
    revisionOperation: null,
  };

  // Deterministic-ID P2002 must propagate — race recovery lives only in
  // createOrReuseSemanticExploreMovementProposal.
  const created = await args.db.exploreMovementProposal.create({ data });
  return toProposalRecord(created);
}

async function createCanonicalExploreMovementProposal(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sources?: ExploreGroundingSource[];
  provenance?: ExploreMovementProposalProvenance;
  id?: string;
}): Promise<ExploreProposalRecord> {
  if (
    args.affectedObjectType !== UnderstandingLinkTargetType.usermap_conclusion
  ) {
    throw new CanonicalModelAuthorityError(
      "NOT_QUALIFYING_CONCLUSION",
      "Canonical Explore proposals require a usermap_conclusion target",
    );
  }

  // Canonical path never accepts array-only sources as a provenance fallback.
  const provenance = await requireCanonicalProposalProvenance({
    provenance: args.provenance,
    affectedObjectId: args.affectedObjectId,
    afterSummary: args.afterSummary,
    rationale: args.rationale,
    userFacingSummary: args.userFacingSummary,
  });
  const groundingSources = provenance.sources as ExploreGroundingSource[];

  const umc = await resolveOwnedQualifyingUserMapConclusionForCanonicalProposal({
    userId: args.userId,
    affectedObjectId: args.affectedObjectId,
    db: args.db,
  });

  if (args.beforeSummary !== umc.summary) {
    throw new CanonicalModelAuthorityError(
      "STALE_CURRENT_REVISION",
      "Canonical Explore beforeSummary does not match live UserMapConclusion.summary",
    );
  }

  const expectedLegacySnapshotHash = deriveCanonicalUmcSnapshotHash({
    id: umc.id,
    title: umc.title,
    summary: umc.summary,
    status: umc.status,
    confidenceScore: umc.confidenceScore,
    confidenceLevel: umc.confidenceLevel,
    updatedAt: umc.updatedAt,
  });

  const created = await args.db.$transaction(async (tx) => {
    // Lock order for Phase 3A/3B: UserMapConclusion → CanonicalConcept.
    // Registration locks the owned UMC first.
    const registration =
      await resolveOrRegisterCanonicalConceptFromUserMapConclusion({
        userId: args.userId,
        userMapConclusionId: umc.id,
        expectedLegacySnapshotHash,
        tx: tx as unknown as CanonicalAuthorityTransactionClient,
      });

    // Lock the concept before freezing its current revision expectation.
    const lockedConceptRows = (await tx.$queryRaw`
      SELECT id
      FROM "CanonicalConcept"
      WHERE id = ${registration.conceptId}
        AND "userId" = ${args.userId}
      FOR UPDATE
    `) as Array<{ id: string }>;
    if (!lockedConceptRows[0]) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Registered canonical concept missing under FOR UPDATE",
      );
    }

    const concept = await tx.canonicalConcept.findFirst({
      where: { id: registration.conceptId, userId: args.userId },
    });
    if (!concept || concept.userId !== args.userId) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Registered canonical concept missing or ownership mismatch",
      );
    }
    if (!concept.currentRevisionId) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Registered canonical concept has no currentRevisionId",
      );
    }

    const currentRevision = await tx.canonicalConceptRevision.findFirst({
      where: {
        id: concept.currentRevisionId,
        conceptId: concept.id,
        userId: args.userId,
      },
    });
    if (!currentRevision) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_LEGACY_REGISTRATION",
        "Registered canonical current revision missing",
      );
    }

    if (currentRevision.id !== registration.currentRevisionId) {
      throw new CanonicalModelAuthorityError(
        "STALE_CURRENT_REVISION",
        "Canonical concept current revision drifted after registration",
      );
    }

    if (currentRevision.version !== 1 || registration.revisionVersion !== 1) {
      throw new CanonicalModelAuthorityError(
        "STALE_CURRENT_REVISION",
        "Canonical Explore proposal creation requires current revision version 1",
      );
    }

    // Validation/preparation only — do not persist UnderstandingEvidenceLink rows.
    await prepareCanonicalProposalEvidence({
      userId: args.userId,
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      userMessageId: args.userMessageId,
      sources: groundingSources,
      db: tx as unknown as CanonicalRevisionEvidenceDb,
    });

    return tx.exploreMovementProposal.create({
      data: {
        ...(args.id ? { id: args.id } : {}),
        userId: args.userId,
        conversationId: args.conversationId,
        assistantMessageId: args.assistantMessageId,
        userMessageId: args.userMessageId,
        status: ExploreMovementProposalStatus.proposed,
        authorityMode: ExploreMovementAuthorityMode.canonical_v1,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: args.affectedObjectId,
        beforeSummary: args.beforeSummary,
        afterSummary: args.afterSummary,
        rationale: args.rationale,
        userFacingSummary: args.userFacingSummary,
        sourcesJson: provenance,
        modelUpdateId: null,
        canonicalConceptId: concept.id,
        expectedCurrentRevisionId: currentRevision.id,
        expectedLegacySnapshotHash: null,
        revisionOperation: CanonicalRevisionOperation.strengthen,
      },
    });
  });

  return toProposalRecord(created);
}

async function createExploreMovementProposalForAuthorityMode(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sources?: ExploreGroundingSource[];
  provenance?: ExploreMovementProposalProvenance;
  id?: string;
  authorityMode: ExploreMovementAuthorityMode;
}): Promise<ExploreProposalRecord> {
  if (args.authorityMode === ExploreMovementAuthorityMode.canonical_v1) {
    // Never fall back to legacy creation on canonical failure.
    return createCanonicalExploreMovementProposal(args);
  }
  return createLegacyExploreMovementProposal(args);
}

export async function createExploreMovementProposal(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  /** Legacy array-only sources (not publishable under DEL-001B). */
  sources?: ExploreGroundingSource[];
  /** Required for new semantically restored proposals. */
  provenance?: ExploreMovementProposalProvenance;
  /** Optional deterministic ID for concurrency-safe semantic proposals. */
  id?: string;
}): Promise<ExploreProposalRecord> {
  const authorityMode = isCanonicalModelAuthorityEnabledForUser(args.userId)
    ? ExploreMovementAuthorityMode.canonical_v1
    : ExploreMovementAuthorityMode.legacy;

  return createExploreMovementProposalForAuthorityMode({
    ...args,
    authorityMode,
  });
}

/**
 * Create-or-reuse a semantic ExploreMovementProposal using a deterministic ID.
 * Unversioned legacy rows are never trusted as the valid semantic duplicate.
 * Legacy and canonical_v1 publisher families never satisfy each other's dedupe.
 */
export async function createOrReuseSemanticExploreMovementProposal(args: {
  userId: string;
  db: PrismaClient;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  provenance: ExploreMovementProposalProvenance;
}): Promise<{
  record: ExploreProposalRecord;
  created: boolean;
  reusedStatus: "proposed" | "published" | "rejected" | null;
}> {
  // Resolve once for ID, reuse validation, creation path, and persistence.
  const authorityMode = isCanonicalModelAuthorityEnabledForUser(args.userId)
    ? ExploreMovementAuthorityMode.canonical_v1
    : ExploreMovementAuthorityMode.legacy;

  const proposalId = deriveExploreMovementProposalId({
    userId: args.userId,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
    affectedObjectId: args.affectedObjectId,
    afterSummary: args.afterSummary,
    authorityMode,
  });

  const reuseExpected = {
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    affectedObjectId: args.affectedObjectId,
    afterSummary: args.afterSummary,
    authorityMode,
  };

  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: proposalId, userId: args.userId },
  });

  if (existing) {
    if (
      !isReusableSemanticExploreMovementProposal({
        row: existing,
        expected: reuseExpected,
      })
    ) {
      throw new Error(
        "explore_movement_deterministic_id_occupied_by_invalid_provenance"
      );
    }

    if (existing.status === ExploreMovementProposalStatus.published) {
      return {
        record: toProposalRecord(existing),
        created: false,
        reusedStatus: "published",
      };
    }
    if (existing.status === ExploreMovementProposalStatus.rejected) {
      return {
        record: toProposalRecord(existing),
        created: false,
        reusedStatus: "rejected",
      };
    }
    return {
      record: toProposalRecord(existing),
      created: false,
      reusedStatus: "proposed",
    };
  }

  try {
    const created = await createExploreMovementProposalForAuthorityMode({
      ...args,
      id: proposalId,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      provenance: args.provenance,
      authorityMode,
    });
    return { record: created, created: true, reusedStatus: null };
  } catch (error) {
    // Only unique-conflict race recovery. Canonical typed failures never fall
    // back to legacy creation, and P2002 recovery stays within the same
    // authorityMode identity (proposalId already encodes the publisher family).
    if (!isPrismaUniqueConflict(error)) throw error;

    const raced = await args.db.exploreMovementProposal.findFirst({
      where: { id: proposalId, userId: args.userId },
    });
    if (
      !raced ||
      !isReusableSemanticExploreMovementProposal({
        row: raced,
        expected: reuseExpected,
      })
    ) {
      throw new Error(
        "explore_movement_deterministic_id_race_invalid_or_unversioned"
      );
    }

    return {
      record: toProposalRecord(raced),
      created: false,
      reusedStatus: raced.status,
    };
  }
}

export async function rejectExploreMovementProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
}): Promise<{ proposalId: string; status: "rejected" } | "not_found" | "already_published"> {
  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: args.proposalId, userId: args.userId },
    select: {
      id: true,
      status: true,
      modelUpdateId: true,
    },
  });

  if (!existing) return "not_found";
  if (
    existing.status === ExploreMovementProposalStatus.published ||
    existing.modelUpdateId
  ) {
    return "already_published";
  }

  const claim = await args.db.exploreMovementProposal.updateMany({
    where: {
      id: existing.id,
      userId: args.userId,
      status: ExploreMovementProposalStatus.proposed,
      modelUpdateId: null,
    },
    data: { status: ExploreMovementProposalStatus.rejected },
  });
  if (claim.count !== 1) {
    const reread = await args.db.exploreMovementProposal.findFirst({
      where: { id: args.proposalId, userId: args.userId },
      select: { status: true, modelUpdateId: true },
    });
    if (
      reread?.status === ExploreMovementProposalStatus.published ||
      reread?.modelUpdateId
    ) {
      return "already_published";
    }
    if (reread?.status === ExploreMovementProposalStatus.rejected) {
      return { proposalId: existing.id, status: "rejected" };
    }
    return "not_found";
  }

  return { proposalId: existing.id, status: "rejected" };
}

class ExploreMovementPublicationRejectedError extends Error {
  constructor() {
    super("explore_movement_publication_rejected");
    this.name = "ExploreMovementPublicationRejectedError";
  }
}

type ExploreMovementProposalRow = {
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

function assertCanonicalProposalAuthorityShape(
  proposal: ExploreMovementProposalRow,
): void {
  if (proposal.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical publisher requires authorityMode=canonical_v1",
    );
  }
  if (
    typeof proposal.canonicalConceptId !== "string" ||
    proposal.canonicalConceptId.length === 0
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical proposal missing canonicalConceptId",
    );
  }
  if (
    typeof proposal.expectedCurrentRevisionId !== "string" ||
    proposal.expectedCurrentRevisionId.length === 0
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical proposal missing expectedCurrentRevisionId",
    );
  }
  if (proposal.expectedLegacySnapshotHash != null) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical proposal must not carry expectedLegacySnapshotHash",
    );
  }
  if (proposal.revisionOperation !== CanonicalRevisionOperation.strengthen) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical proposal revisionOperation must be strengthen",
    );
  }
  if (
    proposal.affectedObjectType !==
    UnderstandingLinkTargetType.usermap_conclusion
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical proposal affectedObjectType must be usermap_conclusion",
    );
  }
}

function assertExactCanonicalResultingRevision(args: {
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
  proposal: ExploreMovementProposalRow;
}): void {
  if (args.resultingRevision.summary !== args.proposal.afterSummary) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision summary must equal proposal.afterSummary",
    );
  }
  if (args.resultingRevision.rationale !== args.proposal.rationale) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision rationale must equal proposal.rationale",
    );
  }
  if (args.resultingRevision.registrationSnapshotHash != null) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision registrationSnapshotHash must be null",
    );
  }
  if (args.resultingRevision.title !== args.previousRevision.title) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision title must match previous revision",
    );
  }
  if (args.resultingRevision.status !== args.previousRevision.status) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision status must match previous revision",
    );
  }
  if (
    args.resultingRevision.confidenceScore !==
    args.previousRevision.confidenceScore
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision confidenceScore must match previous revision",
    );
  }
  if (
    args.resultingRevision.confidenceLevel !==
    args.previousRevision.confidenceLevel
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision confidenceLevel must match previous revision",
    );
  }
  if (args.resultingRevision.previousRevisionId !== args.previousRevision.id) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision previousRevisionId mismatch",
    );
  }
  if (args.resultingRevision.version !== 2) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision must be version 2",
    );
  }
  if (args.resultingRevision.operation !== CanonicalRevisionOperation.strengthen) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision operation must be strengthen",
    );
  }
  if (
    args.resultingRevision.decisionSource !==
    CanonicalRevisionDecisionSource.explore_proposal
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical resulting revision decisionSource must be explore_proposal",
    );
  }
}

/**
 * Exact identity validator for the canonical ModelUpdate produced by a proposal.
 * Used after insertion, on idempotent published returns, and after claim-race recovery.
 */
function assertExactCanonicalModelUpdateIdentity(args: {
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
  proposal: ExploreMovementProposalRow;
  previousRevision: { id: string; summary: string };
  resultingRevision: { id: string; summary: string };
}): void {
  const expectedId = deriveExploreMovementModelUpdateId(args.proposal.id);
  const expectedNotes = buildExploreMovementModelUpdateLineageNotes({
    proposalId: args.proposal.id,
    conversationId: args.proposal.conversationId,
    assistantMessageId: args.proposal.assistantMessageId,
    userMessageId: args.proposal.userMessageId,
    rationale: args.proposal.rationale,
  });

  if (args.modelUpdate.id !== expectedId) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate id must be deriveExploreMovementModelUpdateId(proposal.id)",
    );
  }
  if (args.modelUpdate.userId !== args.proposal.userId) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate userId mismatch",
    );
  }
  if (args.modelUpdate.updateType !== ModelUpdateType.conclusion_strengthened) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate updateType must be conclusion_strengthened",
    );
  }
  if (args.modelUpdate.visibility !== ModelUpdateVisibility.user_visible) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate visibility must be user_visible",
    );
  }
  if (args.modelUpdate.isMeaningful !== true) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate isMeaningful must be true",
    );
  }
  if (
    args.modelUpdate.affectedObjectType !==
    UnderstandingLinkTargetType.canonical_concept_revision
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate affectedObjectType must be canonical_concept_revision",
    );
  }
  if (args.modelUpdate.affectedObjectId !== args.resultingRevision.id) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate affectedObjectId must equal resultingRevision.id",
    );
  }
  if (args.modelUpdate.beforeSummary !== args.previousRevision.summary) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate beforeSummary must equal previousRevision.summary",
    );
  }
  if (args.modelUpdate.afterSummary !== args.resultingRevision.summary) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate afterSummary must equal resultingRevision.summary",
    );
  }
  if (args.modelUpdate.userFacingSummary !== args.proposal.userFacingSummary) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate userFacingSummary must equal proposal.userFacingSummary",
    );
  }
  if (args.modelUpdate.internalNotes !== expectedNotes) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate internalNotes must match exact lineage notes",
    );
  }
  if (args.modelUpdate.confidenceDelta != null) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate confidenceDelta must be null",
    );
  }
  if (args.modelUpdate.canonicalConceptId !== args.proposal.canonicalConceptId) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate canonicalConceptId mismatch",
    );
  }
  if (
    args.modelUpdate.previousRevisionId !==
    args.proposal.expectedCurrentRevisionId
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate previousRevisionId mismatch",
    );
  }
  if (args.modelUpdate.resultingRevisionId !== args.resultingRevision.id) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate resultingRevisionId mismatch",
    );
  }
  if (args.modelUpdate.exploreProposalId !== args.proposal.id) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical ModelUpdate exploreProposalId mismatch",
    );
  }

  // Published / idempotent paths must have the proposal link set.
  if (args.proposal.status === ExploreMovementProposalStatus.published) {
    if (args.proposal.modelUpdateId !== args.modelUpdate.id) {
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PUBLICATION",
        "Published proposal.modelUpdateId must equal ModelUpdate.id",
      );
    }
  } else if (
    args.proposal.modelUpdateId != null &&
    args.proposal.modelUpdateId !== args.modelUpdate.id
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "proposal.modelUpdateId must equal ModelUpdate.id when set",
    );
  }
}

async function assertCoherentCanonicalPublication(args: {
  userId: string;
  proposal: ExploreMovementProposalRow;
  db: PrismaClient;
}): Promise<{ modelUpdateId: string }> {
  assertCanonicalProposalAuthorityShape(args.proposal);

  if (
    args.proposal.status !== ExploreMovementProposalStatus.published ||
    typeof args.proposal.modelUpdateId !== "string" ||
    args.proposal.modelUpdateId.length === 0
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical proposal missing modelUpdateId",
    );
  }

  const produced = await args.db.canonicalConceptRevision.findMany({
    where: {
      createdFromProposalId: args.proposal.id,
      userId: args.userId,
      conceptId: args.proposal.canonicalConceptId!,
    },
  });
  if (produced.length !== 1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical proposal must produce exactly one revision",
    );
  }
  const revision = produced[0]!;

  const previousRevision = await args.db.canonicalConceptRevision.findFirst({
    where: {
      id: args.proposal.expectedCurrentRevisionId!,
      conceptId: args.proposal.canonicalConceptId!,
      userId: args.userId,
    },
  });
  if (!previousRevision) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical previous revision missing",
    );
  }

  assertExactCanonicalResultingRevision({
    resultingRevision: revision,
    previousRevision,
    proposal: args.proposal,
  });

  const concept = await args.db.canonicalConcept.findFirst({
    where: {
      id: args.proposal.canonicalConceptId!,
      userId: args.userId,
    },
  });
  if (!concept || concept.currentRevisionId !== revision.id) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical concept pointer does not match produced revision",
    );
  }

  const supportsCount = await args.db.understandingEvidenceLink.count({
    where: {
      userId: args.userId,
      targetType: UnderstandingLinkTargetType.canonical_concept_revision,
      targetId: revision.id,
      role: UnderstandingLinkRole.supports,
    },
  });
  if (revision.evidenceCount !== supportsCount) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical revision evidenceCount does not match supports links",
    );
  }

  const modelUpdate = await args.db.modelUpdate.findFirst({
    where: {
      id: args.proposal.modelUpdateId,
      userId: args.userId,
    },
  });
  if (!modelUpdate) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Published canonical ModelUpdate missing",
    );
  }

  assertExactCanonicalModelUpdateIdentity({
    modelUpdate,
    proposal: args.proposal,
    previousRevision,
    resultingRevision: revision,
  });

  return { modelUpdateId: modelUpdate.id };
}

async function publishCanonicalExploreMovementProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
  conversationId?: string;
}): Promise<
  | { modelUpdateId: string; status: "published"; idempotent: boolean }
  | "not_found"
  | "rejected"
> {
  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: args.proposalId, userId: args.userId },
  });
  if (!existing) return "not_found";

  if (existing.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PUBLICATION",
      "Canonical publisher invoked for non-canonical proposal",
    );
  }

  if (existing.status === ExploreMovementProposalStatus.rejected) {
    return "rejected";
  }

  if (existing.status === ExploreMovementProposalStatus.published) {
    const coherent = await assertCoherentCanonicalPublication({
      userId: args.userId,
      proposal: existing as ExploreMovementProposalRow,
      db: args.db,
    });
    return {
      modelUpdateId: coherent.modelUpdateId,
      status: "published",
      idempotent: true,
    };
  }

  const modelUpdateId = deriveExploreMovementModelUpdateId(existing.id);

  try {
    return await args.db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM "ExploreMovementProposal"
        WHERE id = ${existing.id}
          AND "userId" = ${args.userId}
        FOR UPDATE
      `;

      const proposal = (await tx.exploreMovementProposal.findFirst({
        where: { id: existing.id, userId: args.userId },
      })) as ExploreMovementProposalRow | null;
      if (!proposal) {
        throw new ExploreMovementPublicationClaimLostError();
      }
      if (proposal.authorityMode !== ExploreMovementAuthorityMode.canonical_v1) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PUBLICATION",
          "Locked proposal authorityMode is not canonical_v1",
        );
      }
      if (proposal.status === ExploreMovementProposalStatus.rejected) {
        throw new ExploreMovementPublicationRejectedError();
      }
      if (proposal.status === ExploreMovementProposalStatus.published) {
        const coherent = await assertCoherentCanonicalPublication({
          userId: args.userId,
          proposal,
          db: tx as unknown as PrismaClient,
        });
        return {
          modelUpdateId: coherent.modelUpdateId,
          status: "published" as const,
          idempotent: true,
        };
      }
      if (proposal.status !== ExploreMovementProposalStatus.proposed) {
        throw new ExploreMovementPublicationClaimLostError();
      }
      if (proposal.modelUpdateId != null) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PUBLICATION",
          "Proposed canonical proposal unexpectedly has modelUpdateId",
        );
      }

      assertCanonicalProposalAuthorityShape(proposal);

      const provenance = await requireCanonicalProposalProvenance({
        sourcesJson: proposal.sourcesJson,
        affectedObjectId: proposal.affectedObjectId,
        afterSummary: proposal.afterSummary,
        rationale: proposal.rationale,
        userFacingSummary: proposal.userFacingSummary,
      });
      const groundingSources = provenance.sources as ExploreGroundingSource[];

      await tx.$queryRaw`
        SELECT id
        FROM "CanonicalConcept"
        WHERE id = ${proposal.canonicalConceptId!}
          AND "userId" = ${args.userId}
        FOR UPDATE
      `;

      const concept = await tx.canonicalConcept.findFirst({
        where: {
          id: proposal.canonicalConceptId!,
          userId: args.userId,
        },
      });
      if (!concept) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_LEGACY_REGISTRATION",
          "Canonical concept missing under publication lock",
        );
      }

      const expectedRevision = await tx.canonicalConceptRevision.findFirst({
        where: {
          id: proposal.expectedCurrentRevisionId!,
          conceptId: concept.id,
          userId: args.userId,
        },
      });
      if (!expectedRevision) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_LEGACY_REGISTRATION",
          "Expected canonical revision missing under publication lock",
        );
      }

      if (concept.currentRevisionId !== proposal.expectedCurrentRevisionId) {
        throw new CanonicalModelAuthorityError(
          "STALE_CURRENT_REVISION",
          "Canonical concept pointer does not match proposal expectation",
        );
      }
      if (expectedRevision.version !== 1) {
        throw new CanonicalModelAuthorityError(
          "STALE_CURRENT_REVISION",
          "Canonical publication requires expected revision version 1",
        );
      }
      if (
        expectedRevision.operation !== CanonicalRevisionOperation.registered ||
        expectedRevision.decisionSource !==
          CanonicalRevisionDecisionSource.legacy_registration
      ) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_LEGACY_REGISTRATION",
          "Expected revision is not a registration revision",
        );
      }

      const evidence = await prepareCanonicalProposalEvidence({
        userId: args.userId,
        conversationId: proposal.conversationId,
        assistantMessageId: proposal.assistantMessageId,
        userMessageId: proposal.userMessageId,
        sources: groundingSources,
        db: tx as unknown as CanonicalRevisionEvidenceDb,
      });

      const acceptedAt = new Date();
      const revision2 = await tx.canonicalConceptRevision.create({
        data: {
          userId: args.userId,
          conceptId: concept.id,
          version: expectedRevision.version + 1,
          title: expectedRevision.title,
          summary: proposal.afterSummary,
          status: expectedRevision.status,
          confidenceScore: expectedRevision.confidenceScore,
          confidenceLevel: expectedRevision.confidenceLevel,
          evidenceCount: evidence.supportingLinkCount,
          rationale: proposal.rationale,
          operation: CanonicalRevisionOperation.strengthen,
          decisionSource: CanonicalRevisionDecisionSource.explore_proposal,
          acceptedAt,
          registrationSnapshotHash: null,
          previousRevisionId: proposal.expectedCurrentRevisionId!,
          createdFromProposalId: proposal.id,
        },
      });

      await insertPreparedCanonicalRevisionEvidence({
        userId: args.userId,
        revisionId: revision2.id,
        evidence,
        db: tx as never,
      });

      const supportsCount = await tx.understandingEvidenceLink.count({
        where: {
          userId: args.userId,
          targetType: UnderstandingLinkTargetType.canonical_concept_revision,
          targetId: revision2.id,
          role: UnderstandingLinkRole.supports,
        },
      });
      if (supportsCount !== evidence.supportingLinkCount) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PUBLICATION",
          "Materialised supports count does not match prepared evidenceCount",
        );
      }

      const pointerMove = await tx.canonicalConcept.updateMany({
        where: {
          id: concept.id,
          userId: args.userId,
          currentRevisionId: proposal.expectedCurrentRevisionId!,
        },
        data: { currentRevisionId: revision2.id },
      });
      if (pointerMove.count !== 1) {
        throw new CanonicalModelAuthorityError(
          "STALE_CURRENT_REVISION",
          "Canonical concept pointer CAS failed",
        );
      }

      const expectedInternalNotes = buildExploreMovementModelUpdateLineageNotes({
        proposalId: proposal.id,
        conversationId: proposal.conversationId,
        assistantMessageId: proposal.assistantMessageId,
        userMessageId: proposal.userMessageId,
        rationale: proposal.rationale,
      });

      let createdUpdate;
      try {
        const insert = await tx.modelUpdate.createMany({
          data: [
            {
              id: modelUpdateId,
              userId: args.userId,
              updateType: ModelUpdateType.conclusion_strengthened,
              visibility: ModelUpdateVisibility.user_visible,
              isMeaningful: true,
              affectedObjectType:
                UnderstandingLinkTargetType.canonical_concept_revision,
              affectedObjectId: revision2.id,
              userFacingSummary: proposal.userFacingSummary,
              beforeSummary: expectedRevision.summary,
              afterSummary: revision2.summary,
              internalNotes: expectedInternalNotes,
              confidenceDelta: null,
              canonicalConceptId: concept.id,
              previousRevisionId: expectedRevision.id,
              resultingRevisionId: revision2.id,
              exploreProposalId: proposal.id,
            },
          ],
        });
        if (insert.count !== 1) {
          throw new CanonicalModelAuthorityError(
            "BROKEN_CANONICAL_PUBLICATION",
            "Canonical ModelUpdate insert must create exactly one row",
          );
        }
        createdUpdate = await tx.modelUpdate.findFirst({
          where: { id: modelUpdateId, userId: args.userId },
        });
      } catch (error) {
        if (isCanonicalModelAuthorityError(error)) throw error;
        // Proposal is locked while proposed — uniqueness collision is not a
        // legitimate concurrent publish and must not reuse a pre-existing row.
        if (isPrismaUniqueConflict(error)) {
          throw new CanonicalModelAuthorityError(
            "BROKEN_CANONICAL_PUBLICATION",
            "Unexpected ModelUpdate uniqueness collision while proposal is proposed",
          );
        }
        throw error;
      }

      if (!createdUpdate) {
        throw new CanonicalModelAuthorityError(
          "BROKEN_CANONICAL_PUBLICATION",
          "Canonical ModelUpdate missing after insert",
        );
      }

      assertExactCanonicalResultingRevision({
        resultingRevision: revision2,
        previousRevision: expectedRevision,
        proposal,
      });
      assertExactCanonicalModelUpdateIdentity({
        modelUpdate: createdUpdate,
        proposal,
        previousRevision: expectedRevision,
        resultingRevision: revision2,
      });

      const claim = await tx.exploreMovementProposal.updateMany({
        where: {
          id: proposal.id,
          userId: args.userId,
          status: ExploreMovementProposalStatus.proposed,
          modelUpdateId: null,
          authorityMode: ExploreMovementAuthorityMode.canonical_v1,
          canonicalConceptId: proposal.canonicalConceptId,
          expectedCurrentRevisionId: proposal.expectedCurrentRevisionId,
          revisionOperation: CanonicalRevisionOperation.strengthen,
        },
        data: {
          status: ExploreMovementProposalStatus.published,
          modelUpdateId,
        },
      });
      if (claim.count !== 1) {
        throw new ExploreMovementPublicationClaimLostError();
      }

      return {
        modelUpdateId,
        status: "published" as const,
        idempotent: false,
      };
    });
  } catch (error) {
    if (error instanceof ExploreMovementPublicationRejectedError) {
      return "rejected";
    }
    if (error instanceof ExploreMovementPublicationClaimLostError) {
      const reread = await args.db.exploreMovementProposal.findFirst({
        where: { id: args.proposalId, userId: args.userId },
      });
      if (!reread) return "not_found";
      if (reread.status === ExploreMovementProposalStatus.rejected) {
        return "rejected";
      }
      if (reread.status === ExploreMovementProposalStatus.published) {
        const coherent = await assertCoherentCanonicalPublication({
          userId: args.userId,
          proposal: reread as ExploreMovementProposalRow,
          db: args.db,
        });
        return {
          modelUpdateId: coherent.modelUpdateId,
          status: "published",
          idempotent: true,
        };
      }
      throw new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PUBLICATION",
        "Canonical publication claim lost without coherent terminal state",
      );
    }
    if (isCanonicalModelAuthorityError(error)) {
      throw error;
    }
    throw error;
  }
}

async function publishLegacyExploreMovementProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
  conversationId?: string;
}): Promise<
  | { modelUpdateId: string; status: "published"; idempotent: boolean }
  | "not_found"
  | "rejected"
  | "missing_evidence"
  | ExploreMovementBlockedUnsafeFixedSemantics
  | ExploreMovementBlockedUnverifiedSemanticProvenance
> {
  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: args.proposalId, userId: args.userId },
  });

  if (!existing) return "not_found";

  if (existing.authorityMode !== ExploreMovementAuthorityMode.legacy &&
      existing.authorityMode != null) {
    throw new Error("explore_movement_legacy_publisher_mode_mismatch");
  }

  // Route session match before rejected / already-published short-circuits.
  // Omitting conversationId preserves trusted internal (non-route) callers.
  if (
    args.conversationId != null &&
    args.conversationId !== existing.conversationId
  ) {
    return EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE;
  }

  if (existing.status === ExploreMovementProposalStatus.rejected) return "rejected";

  if (
    existing.status === ExploreMovementProposalStatus.published &&
    existing.modelUpdateId
  ) {
    return {
      modelUpdateId: existing.modelUpdateId,
      status: "published",
      idempotent: true,
    };
  }

  const provenanceGate = await evaluateExploreMovementPublicationProvenance({
    userId: args.userId,
    db: args.db,
    routeConversationId: args.conversationId,
    proposal: {
      conversationId: existing.conversationId,
      assistantMessageId: existing.assistantMessageId,
      userMessageId: existing.userMessageId,
      affectedObjectType: existing.affectedObjectType,
      affectedObjectId: existing.affectedObjectId,
      beforeSummary: existing.beforeSummary,
      afterSummary: existing.afterSummary,
      rationale: existing.rationale,
      userFacingSummary: existing.userFacingSummary,
      sourcesJson: existing.sourcesJson,
    },
  });

  if (!provenanceGate.ok) {
    return provenanceGate.block;
  }

  const sources = provenanceGate.sources;
  const modelUpdateId = deriveExploreMovementModelUpdateId(existing.id);
  const expectedInternalNotes = buildExploreMovementModelUpdateLineageNotes({
    proposalId: existing.id,
    conversationId: existing.conversationId,
    assistantMessageId: existing.assistantMessageId,
    userMessageId: existing.userMessageId,
    rationale: existing.rationale,
  });

  try {
    const publishedResult = await args.db.$transaction(async (tx) => {
      await lockRowForUpdate({
        db: tx as never,
        table: "ExploreMovementProposal",
        id: existing.id,
        userId: args.userId,
      });

      const lockedProposal = await tx.exploreMovementProposal.findFirst({
        where: { id: existing.id, userId: args.userId },
      });
      if (!lockedProposal) {
        throw new ExploreMovementPublicationClaimLostError();
      }
      if (
        lockedProposal.authorityMode != null &&
        lockedProposal.authorityMode !== ExploreMovementAuthorityMode.legacy
      ) {
        throw new Error("explore_movement_legacy_publisher_mode_mismatch");
      }
      if (lockedProposal.status !== ExploreMovementProposalStatus.proposed) {
        throw new ExploreMovementPublicationClaimLostError();
      }
      if (lockedProposal.modelUpdateId != null) {
        throw new ExploreMovementPublicationClaimLostError();
      }
      if (
        args.conversationId != null &&
        lockedProposal.conversationId !== args.conversationId
      ) {
        throw new Error("explore_movement_publication_conversation_drift");
      }
      if (lockedProposal.conversationId !== existing.conversationId) {
        throw new Error("explore_movement_publication_conversation_drift");
      }
      if (
        lockedProposal.assistantMessageId !== existing.assistantMessageId ||
        lockedProposal.userMessageId !== existing.userMessageId ||
        lockedProposal.affectedObjectType !== existing.affectedObjectType ||
        lockedProposal.affectedObjectId !== existing.affectedObjectId ||
        lockedProposal.beforeSummary !== existing.beforeSummary ||
        lockedProposal.afterSummary !== existing.afterSummary ||
        lockedProposal.rationale !== existing.rationale ||
        lockedProposal.userFacingSummary !== existing.userFacingSummary
      ) {
        throw new Error("explore_movement_publication_proposal_field_drift");
      }

      await lockRowForUpdate({
        db: tx as never,
        table: "UserMapConclusion",
        id: lockedProposal.affectedObjectId,
        userId: args.userId,
      });

      const target = await tx.userMapConclusion.findFirst({
        where: {
          id: lockedProposal.affectedObjectId,
          userId: args.userId,
        },
        select: {
          id: true,
          visibility: true,
          status: true,
          supersededById: true,
          candidateLifecycleStatus: true,
          summary: true,
        },
      });
      if (
        !target ||
        !isQualifyingExploreUserMapConclusion({
          visibility: target.visibility,
          status: target.status,
          supersededById: target.supersededById,
          candidateLifecycleStatus: target.candidateLifecycleStatus,
          summary: target.summary,
        }) ||
        target.summary !== lockedProposal.beforeSummary
      ) {
        throw new Error("explore_movement_publication_target_baseline_invalid");
      }

      // Conflict-free create: never raise P2002 inside this transaction.
      await tx.modelUpdate.createMany({
        data: [
          {
            id: modelUpdateId,
            userId: args.userId,
            updateType: ModelUpdateType.conclusion_strengthened,
            visibility: ModelUpdateVisibility.internal_only,
            affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
            affectedObjectId: lockedProposal.affectedObjectId,
            userFacingSummary: lockedProposal.userFacingSummary,
            isMeaningful: false,
            beforeSummary: lockedProposal.beforeSummary,
            afterSummary: lockedProposal.afterSummary,
            internalNotes: expectedInternalNotes,
          },
        ],
        skipDuplicates: true,
      });

      const createdOrReused = await tx.modelUpdate.findFirst({
        where: { id: modelUpdateId, userId: args.userId },
        select: {
          id: true,
          userId: true,
          updateType: true,
          affectedObjectType: true,
          affectedObjectId: true,
          beforeSummary: true,
          afterSummary: true,
          userFacingSummary: true,
          internalNotes: true,
          visibility: true,
          isMeaningful: true,
        },
      });
      if (
        !createdOrReused ||
        !modelUpdateMatchesExploreProposalIdentity({
          row: createdOrReused,
          userId: args.userId,
          proposalId: lockedProposal.id,
          affectedObjectId: lockedProposal.affectedObjectId,
          beforeSummary: lockedProposal.beforeSummary,
          afterSummary: lockedProposal.afterSummary,
          userFacingSummary: lockedProposal.userFacingSummary,
        })
      ) {
        throw new Error("explore_movement_model_update_identity_mismatch");
      }

      const createdUpdateId = createdOrReused.id;

      await materializeEvidenceLinksForModelUpdate({
        userId: args.userId,
        db: tx as unknown as PrismaClient,
        modelUpdateId: createdUpdateId,
        conversationId: lockedProposal.conversationId,
        assistantMessageId: lockedProposal.assistantMessageId,
        userMessageId: lockedProposal.userMessageId,
        sources,
      });

      let publishedId = createdUpdateId;
      try {
        const published = await publishModelUpdateCandidate(
          args.userId,
          createdUpdateId,
          {
            db: tx as unknown as PrismaClient,
            alreadyInTransaction: true,
          }
        );
        publishedId = published.id;
      } catch (error) {
        if (
          error instanceof PublishModelUpdateCandidateError &&
          (error.code === "ALREADY_VISIBLE" || error.code === "ALREADY_MEANINGFUL")
        ) {
          publishedId = createdUpdateId;
        } else {
          throw error;
        }
      }

      const claim = await tx.exploreMovementProposal.updateMany({
        where: {
          id: lockedProposal.id,
          userId: args.userId,
          status: ExploreMovementProposalStatus.proposed,
          modelUpdateId: null,
          authorityMode: ExploreMovementAuthorityMode.legacy,
        },
        data: {
          status: ExploreMovementProposalStatus.published,
          modelUpdateId: publishedId,
        },
      });
      if (claim.count !== 1) {
        throw new ExploreMovementPublicationClaimLostError();
      }

      return {
        modelUpdateId: publishedId,
        status: "published" as const,
        idempotent: false,
      };
    });

    return publishedResult;
  } catch (error) {
    if (error instanceof ExploreMovementPublicationClaimLostError) {
      const reread = await args.db.exploreMovementProposal.findFirst({
        where: { id: args.proposalId, userId: args.userId },
      });
      if (
        reread?.status === ExploreMovementProposalStatus.published &&
        reread.modelUpdateId === modelUpdateId
      ) {
        return {
          modelUpdateId: reread.modelUpdateId,
          status: "published",
          idempotent: true,
        };
      }
      if (reread?.status === ExploreMovementProposalStatus.rejected) {
        return "rejected";
      }
      return EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE;
    }

    if (
      error instanceof Error &&
      (error.message === "explore_movement_publication_target_baseline_invalid" ||
        error.message === "explore_movement_publication_conversation_drift" ||
        error.message === "explore_movement_publication_proposal_field_drift" ||
        error.message === "explore_movement_model_update_identity_mismatch")
    ) {
      return EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE;
    }

    // Semantic validation already completed before the mutation boundary.
    // Infrastructure / publish-helper failures must not become provenance blocks.
    if (error instanceof PublishModelUpdateCandidateError) {
      if (error.code === "MODEL_UPDATE_NOT_FOUND") return "not_found";
      if (error.code === "MODEL_UPDATE_MISSING_EVIDENCE") return "missing_evidence";
    }
    throw error;
  }
}

export async function publishExploreMovementProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
  /** Route session ID — must match proposal.conversationId. */
  conversationId?: string;
}): Promise<
  | { modelUpdateId: string; status: "published"; idempotent: boolean }
  | "not_found"
  | "rejected"
  | "missing_evidence"
  | ExploreMovementBlockedUnsafeFixedSemantics
  | ExploreMovementBlockedUnverifiedSemanticProvenance
> {
  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: args.proposalId, userId: args.userId },
    select: {
      id: true,
      authorityMode: true,
      status: true,
      conversationId: true,
    },
  });

  if (!existing) return "not_found";

  if (
    args.conversationId != null &&
    args.conversationId !== existing.conversationId
  ) {
    return EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE;
  }

  if (existing.status === ExploreMovementProposalStatus.rejected) {
    return "rejected";
  }

  // Dispatch from stored authorityMode — never the live feature flag.
  // Absent/null authorityMode is treated as legacy (schema default + fake DBs).
  const storedMode =
    existing.authorityMode ?? ExploreMovementAuthorityMode.legacy;
  if (storedMode === ExploreMovementAuthorityMode.canonical_v1) {
    return publishCanonicalExploreMovementProposal(args);
  }

  return publishLegacyExploreMovementProposal(args);
}

export async function findOpenExploreProposalForSession(args: {
  userId: string;
  conversationId: string;
  db: PrismaClient;
}): Promise<ExploreProposalRecord | null> {
  const open = await args.db.exploreMovementProposal.findFirst({
    where: {
      userId: args.userId,
      conversationId: args.conversationId,
      status: ExploreMovementProposalStatus.proposed,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!open) return null;
  return toProposalRecord(open);
}

// Re-export for callers that need display-safe source extraction.
export { extractExploreMovementProposalSources };
