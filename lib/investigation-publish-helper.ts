/**
 * investigation-publish-helper.ts
 *
 * Internal helper for publishing a promoted Investigation candidate.
 *
 * Changes visibility from internal_only to user_visible and creates a
 * ModelUpdate (`investigation_opened`) synchronously in the same transaction.
 * Does NOT change Investigation.status, candidateLifecycleStatus, or evidence links.
 */

import {
  type PrismaClient,
  InvestigationVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "./prismadb";

export type PublishInvestigationCandidateResult = {
  id: string;
  userId: string;
  previousVisibility: InvestigationVisibility;
  newVisibility: InvestigationVisibility;
  updatedAt: Date;
};

export class PublishInvestigationCandidateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PublishInvestigationCandidateError";
  }
}

function defaultPublishSummary(title: string): string {
  return `New active question: ${title}`;
}

const PUBLISH_INTERNAL_NOTE =
  "Published via internal Investigation candidate publish action.";

export async function publishInvestigationCandidate(
  userId: string,
  investigationId: string,
  options?: {
    db?: PrismaClient;
    now?: Date;
    userFacingSummary?: string;
    sourceRunId?: string | null;
  }
): Promise<PublishInvestigationCandidateResult> {
  const db = options?.db ?? prismadb;
  const now = options?.now ?? new Date();

  const investigation = await db.investigation.findFirst({
    where: {
      id: investigationId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      candidateLifecycleStatus: true,
      status: true,
      title: true,
    },
  });

  if (!investigation) {
    throw new PublishInvestigationCandidateError(
      `Investigation not found for id=${investigationId} and userId=${userId}`,
      "INVESTIGATION_NOT_FOUND"
    );
  }

  if (investigation.candidateLifecycleStatus === null) {
    throw new PublishInvestigationCandidateError(
      `Cannot publish Investigation id=${investigationId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit lifecycle status before publishing.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  if (investigation.candidateLifecycleStatus !== "promoted") {
    throw new PublishInvestigationCandidateError(
      `Cannot publish Investigation id=${investigationId}: candidateLifecycleStatus is '${investigation.candidateLifecycleStatus}', expected 'promoted'.`,
      "NOT_PROMOTED"
    );
  }

  if (investigation.visibility !== InvestigationVisibility.internal_only) {
    throw new PublishInvestigationCandidateError(
      `Cannot publish Investigation id=${investigationId}: visibility is '${investigation.visibility}', expected 'internal_only'.`,
      "ALREADY_VISIBLE"
    );
  }

  const userFacingSummary =
    options?.userFacingSummary ?? defaultPublishSummary(investigation.title);
  const sourceRunId = options?.sourceRunId ?? null;
  const previousStatus = investigation.status;

  const updated = await db.$transaction(async (tx) => {
    const updateResult = await tx.investigation.updateMany({
      where: {
        id: investigationId,
        userId,
        visibility: InvestigationVisibility.internal_only,
        candidateLifecycleStatus: "promoted",
      },
      data: {
        visibility: InvestigationVisibility.user_visible,
        updatedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new PublishInvestigationCandidateError(
        `Cannot publish Investigation id=${investigationId}: visibility is not 'internal_only' or candidate is no longer publishable. ` +
          "The investigation may have been published concurrently.",
        "ALREADY_VISIBLE"
      );
    }

    const published = await tx.investigation.findFirst({
      where: {
        id: investigationId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        visibility: true,
        candidateLifecycleStatus: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!published) {
      throw new PublishInvestigationCandidateError(
        `Investigation not found for id=${investigationId} and userId=${userId}`,
        "INVESTIGATION_NOT_FOUND"
      );
    }

    if (published.status !== previousStatus) {
      throw new PublishInvestigationCandidateError(
        `Investigation status changed unexpectedly during publish for id=${investigationId}`,
        "INTERNAL_INVARIANT_VIOLATION"
      );
    }

    if (published.candidateLifecycleStatus !== "promoted") {
      throw new PublishInvestigationCandidateError(
        `Investigation candidateLifecycleStatus changed unexpectedly during publish for id=${investigationId}`,
        "INTERNAL_INVARIANT_VIOLATION"
      );
    }

    await tx.modelUpdate.create({
      data: {
        userId,
        updateType: ModelUpdateType.investigation_opened,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.investigation,
        affectedObjectId: investigationId,
        userFacingSummary,
        isMeaningful: true,
        sourceRunId,
        internalNotes: PUBLISH_INTERNAL_NOTE,
      },
    });

    return published;
  });

  return {
    id: updated.id,
    userId: updated.userId,
    previousVisibility: InvestigationVisibility.internal_only,
    newVisibility: updated.visibility,
    updatedAt: updated.updatedAt,
  };
}
