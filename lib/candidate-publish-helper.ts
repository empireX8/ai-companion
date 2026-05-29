/**
 * candidate-publish-helper.ts
 *
 * Phase 2Q/2T — Internal helper for publishing a promoted UserMapConclusion candidate.
 *
 * Changes visibility from internal_only to user_visible and creates a ModelUpdate
 * synchronously in the same database transaction.
 * Does NOT change status, candidateLifecycleStatus, or evidence links.
 *
 * Preconditions:
 * - Conclusion must belong to the requesting user
 * - candidateLifecycleStatus must be non-null (not legacy/pre-lifecycle)
 * - candidateLifecycleStatus must be "promoted"
 * - visibility must be "internal_only"
 */

import {
  type PrismaClient,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
} from "@prisma/client";

import prismadb from "./prismadb";

/**
 * Result of a successful publish operation.
 */
export type PublishCandidateResult = {
  id: string;
  userId: string;
  previousVisibility: UserMapConclusionVisibility;
  newVisibility: UserMapConclusionVisibility;
  updatedAt: Date;
};

/**
 * Error types for publish operations.
 */
export class PublishCandidateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PublishCandidateError";
  }
}

function defaultPublishSummary(title: string): string {
  return `New conclusion: ${title}`;
}

/**
 * Internal helper to publish a promoted UserMapConclusion candidate.
 *
 * Enforces:
 * - User ownership (the conclusion must belong to the requesting user)
 * - Non-null candidateLifecycleStatus (null = legacy/pre-lifecycle)
 * - candidateLifecycleStatus must be "promoted"
 * - visibility must be "internal_only"
 *
 * On success, updates visibility to user_visible and creates a ModelUpdate
 * (`conclusion_added`, `isMeaningful: true`) in one transaction.
 *
 * @param userId - The user who owns the conclusion
 * @param conclusionId - The UserMapConclusion ID to publish
 * @param options - Optional db override, timestamp, and userFacingSummary override
 * @returns The publish result with previous and new visibility
 * @throws {PublishCandidateError} If preconditions are not met
 */
export async function publishCandidate(
  userId: string,
  conclusionId: string,
  options?: {
    db?: PrismaClient;
    now?: Date;
    userFacingSummary?: string;
  }
): Promise<PublishCandidateResult> {
  const db = options?.db ?? prismadb;
  const now = options?.now ?? new Date();

  // 1. Fetch the conclusion with ownership check
  const conclusion = await db.userMapConclusion.findFirst({
    where: {
      id: conclusionId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      candidateLifecycleStatus: true,
      title: true,
    },
  });

  if (!conclusion) {
    throw new PublishCandidateError(
      `UserMapConclusion not found for id=${conclusionId} and userId=${userId}`,
      "CONCLUSION_NOT_FOUND"
    );
  }

  // 2. Enforce non-null candidateLifecycleStatus
  if (conclusion.candidateLifecycleStatus === null) {
    throw new PublishCandidateError(
      `Cannot publish UserMapConclusion id=${conclusionId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit lifecycle status before publishing.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  // 3. Enforce candidateLifecycleStatus === "promoted"
  if (conclusion.candidateLifecycleStatus !== "promoted") {
    throw new PublishCandidateError(
      `Cannot publish UserMapConclusion id=${conclusionId}: candidateLifecycleStatus is '${conclusion.candidateLifecycleStatus}', expected 'promoted'.`,
      "NOT_PROMOTED"
    );
  }

  // 4. Enforce visibility === "internal_only"
  if (conclusion.visibility !== "internal_only") {
    throw new PublishCandidateError(
      `Cannot publish UserMapConclusion id=${conclusionId}: visibility is '${conclusion.visibility}', expected 'internal_only'.`,
      "ALREADY_VISIBLE"
    );
  }

  const userFacingSummary =
    options?.userFacingSummary ?? defaultPublishSummary(conclusion.title);

  // 5. Conditionally publish visibility, then create ModelUpdate atomically.
  // updateMany guards against concurrent publishes that both pass the precheck.
  const updated = await db.$transaction(async (tx) => {
    const updateResult = await tx.userMapConclusion.updateMany({
      where: {
        id: conclusionId,
        userId,
        visibility: UserMapConclusionVisibility.internal_only,
        candidateLifecycleStatus: "promoted",
      },
      data: {
        visibility: UserMapConclusionVisibility.user_visible,
        updatedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new PublishCandidateError(
        `Cannot publish UserMapConclusion id=${conclusionId}: visibility is not 'internal_only' or candidate is no longer publishable. ` +
          "The conclusion may have been published concurrently.",
        "ALREADY_VISIBLE"
      );
    }

    const published = await tx.userMapConclusion.findFirst({
      where: {
        id: conclusionId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        visibility: true,
        updatedAt: true,
      },
    });

    if (!published) {
      throw new PublishCandidateError(
        `UserMapConclusion not found for id=${conclusionId} and userId=${userId}`,
        "CONCLUSION_NOT_FOUND"
      );
    }

    await tx.modelUpdate.create({
      data: {
        userId,
        updateType: ModelUpdateType.conclusion_added,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: conclusionId,
        userFacingSummary,
        isMeaningful: true,
      },
    });

    return published;
  });

  return {
    id: updated.id,
    userId: updated.userId,
    previousVisibility: UserMapConclusionVisibility.internal_only,
    newVisibility: updated.visibility,
    updatedAt: updated.updatedAt,
  };
}
