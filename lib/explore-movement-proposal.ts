/**
 * Explore movement proposal create / reject / publish orchestration.
 *
 * Proposed movement = ExploreMovementProposal row (NOT a ModelUpdate).
 * Published movement = ModelUpdate created at publish time, linked from the proposal.
 * Rejected proposal never creates a ModelUpdate.
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
  PublishModelUpdateCandidateError,
  publishModelUpdateCandidate,
} from "./model-update-candidate-publish-helper";
import { encodeMovementRationaleInInternalNotes } from "./model-movement-rationale";

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

function parseSourcesJson(value: unknown): ExploreGroundingSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExploreGroundingSource => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ExploreGroundingSource>;
    return (
      typeof candidate.sourceId === "string" &&
      typeof candidate.sourceType === "string" &&
      typeof candidate.userId === "string"
    );
  });
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

/** @deprecated Marker helpers retained for leftover ModelUpdate cleanup only. */
export function isExploreProposalRejected(internalNotes: string | null | undefined): boolean {
  return Boolean(internalNotes && internalNotes.includes("exploreMovementProposal:rejected"));
}

/** @deprecated Marker helpers retained for leftover ModelUpdate cleanup only. */
export function isExploreProposalNotes(internalNotes: string | null | undefined): boolean {
  return Boolean(internalNotes && internalNotes.includes(EXPLORE_PROPOSAL_MARKER));
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
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.assistantMessageId,
      role: UnderstandingLinkRole.supports,
      summary: "Explore assistant reply that proposed movement",
      snippet: args.assistantMessageId,
      quote: args.assistantMessageId,
    },
    {
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.userMessageId,
      role: UnderstandingLinkRole.context,
      summary: "Explore user message that triggered review",
      snippet: args.userMessageId,
      quote: args.userMessageId,
    },
  ];

  for (const source of args.sources) {
    const mapped = sourceTypeToLinkSource(source.sourceType);
    if (!mapped) continue;
    if (source.userId !== args.userId) continue;
    linkRows.push({
      sourceType: mapped,
      sourceId: source.sourceId,
      role:
        source.claimSupport === "verifies"
          ? UnderstandingLinkRole.supports
          : UnderstandingLinkRole.context,
      summary: source.retrievalReason,
      snippet: source.extract.slice(0, 240),
      quote: source.extract.slice(0, 240),
    });
  }

  for (const row of linkRows) {
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
  sources: ExploreGroundingSource[];
}): Promise<ExploreProposalRecord> {
  const created = await args.db.exploreMovementProposal.create({
    data: {
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
      sourcesJson: args.sources,
      modelUpdateId: null,
    },
  });

  return toProposalRecord(created);
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

  await args.db.exploreMovementProposal.update({
    where: { id: existing.id },
    data: { status: ExploreMovementProposalStatus.rejected },
  });

  return { proposalId: existing.id, status: "rejected" };
}

export async function publishExploreMovementProposal(args: {
  userId: string;
  proposalId: string;
  db: PrismaClient;
}): Promise<
  | { modelUpdateId: string; status: "published"; idempotent: boolean }
  | "not_found"
  | "rejected"
  | "missing_evidence"
> {
  const existing = await args.db.exploreMovementProposal.findFirst({
    where: { id: args.proposalId, userId: args.userId },
  });

  if (!existing) return "not_found";
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

  const sources = parseSourcesJson(existing.sourcesJson);

  const createdUpdate = await args.db.modelUpdate.create({
    data: {
      userId: args.userId,
      updateType: ModelUpdateType.conclusion_strengthened,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: existing.affectedObjectType,
      affectedObjectId: existing.affectedObjectId,
      userFacingSummary: existing.userFacingSummary,
      isMeaningful: false,
      beforeSummary: existing.beforeSummary,
      afterSummary: existing.afterSummary,
      internalNotes: encodeMovementRationaleInInternalNotes(
        `${EXPLORE_PROPOSAL_MARKER};proposalId=${existing.id};conversationId=${existing.conversationId};assistantMessageId=${existing.assistantMessageId};userMessageId=${existing.userMessageId}`,
        existing.rationale
      ),
    },
    select: { id: true },
  });

  await materializeEvidenceLinksForModelUpdate({
    userId: args.userId,
    db: args.db,
    modelUpdateId: createdUpdate.id,
    conversationId: existing.conversationId,
    assistantMessageId: existing.assistantMessageId,
    userMessageId: existing.userMessageId,
    sources,
  });

  try {
    const published = await publishModelUpdateCandidate(args.userId, createdUpdate.id, {
      db: args.db,
    });

    await args.db.exploreMovementProposal.update({
      where: { id: existing.id },
      data: {
        status: ExploreMovementProposalStatus.published,
        modelUpdateId: published.id,
      },
    });

    return { modelUpdateId: published.id, status: "published", idempotent: false };
  } catch (error) {
    if (error instanceof PublishModelUpdateCandidateError) {
      if (error.code === "ALREADY_VISIBLE" || error.code === "ALREADY_MEANINGFUL") {
        await args.db.exploreMovementProposal.update({
          where: { id: existing.id },
          data: {
            status: ExploreMovementProposalStatus.published,
            modelUpdateId: createdUpdate.id,
          },
        });
        return { modelUpdateId: createdUpdate.id, status: "published", idempotent: true };
      }
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
