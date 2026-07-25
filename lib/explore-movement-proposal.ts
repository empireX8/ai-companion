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
  ExploreMovementProposalStatus,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import type { ExploreGroundingSource } from "./explore-grounding-contract";
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
  };
  expected: {
    conversationId: string;
    assistantMessageId: string;
    userMessageId: string;
    affectedObjectId: string;
    afterSummary: string;
  };
}): boolean {
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
    affectedObjectType: args.affectedObjectType,
    affectedObjectId: args.affectedObjectId,
    beforeSummary: args.beforeSummary,
    afterSummary: args.afterSummary,
    rationale: args.rationale,
    userFacingSummary: args.userFacingSummary,
    sourcesJson,
    modelUpdateId: null,
  };

  // Deterministic-ID P2002 must propagate — race recovery lives only in
  // createOrReuseSemanticExploreMovementProposal.
  const created = await args.db.exploreMovementProposal.create({ data });
  return toProposalRecord(created);
}

/**
 * Create-or-reuse a semantic ExploreMovementProposal using a deterministic ID.
 * Unversioned legacy rows are never trusted as the valid semantic duplicate.
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
  const proposalId = deriveExploreMovementProposalId({
    userId: args.userId,
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
    affectedObjectId: args.affectedObjectId,
    afterSummary: args.afterSummary,
  });

  const reuseExpected = {
    conversationId: args.conversationId,
    assistantMessageId: args.assistantMessageId,
    userMessageId: args.userMessageId,
    affectedObjectId: args.affectedObjectId,
    afterSummary: args.afterSummary,
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
    const created = await createExploreMovementProposal({
      ...args,
      id: proposalId,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      provenance: args.provenance,
    });
    return { record: created, created: true, reusedStatus: null };
  } catch (error) {
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
  });

  if (!existing) return "not_found";

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
