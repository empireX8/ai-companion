/**
 * candidate-publish-helper.ts
 *
 * Phase 2Q — Internal helper for publishing a promoted UserMapConclusion candidate.
 *
 * Changes visibility from internal_only to user_visible.
 * Does NOT change status, candidateLifecycleStatus, or evidence links.
 * Does NOT create ModelUpdate records.
 *
 * Preconditions:
 * - Conclusion must belong to the requesting user
 * - candidateLifecycleStatus must be non-null (not legacy/pre-lifecycle)
 * - candidateLifecycleStatus must be "promoted"
 * - visibility must be "internal_only"
 */

import { type PrismaClient, UserMapConclusionVisibility } from "@prisma/client";

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

/**
 * Internal helper to publish a promoted UserMapConclusion candidate.
 *
 * Enforces:
 * - User ownership (the conclusion must belong to the requesting user)
 * - Non-null candidateLifecycleStatus (null = legacy/pre-lifecycle)
 * - candidateLifecycleStatus must be "promoted"
 * - visibility must be "internal_only"
 *
 * @param userId - The user who owns the conclusion
 * @param conclusionId - The UserMapConclusion ID to publish
 * @param options - Optional db override and timestamp
 * @returns The publish result with previous and new visibility
 * @throws {PublishCandidateError} If preconditions are not met
 */
export async function publishCandidate(
  userId: string,
  conclusionId: string,
  options?: {
    db?: PrismaClient;
    now?: Date;
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

  // 5. Perform the update — only mutate visibility and updatedAt
  const updated = await db.userMapConclusion.update({
    where: { id: conclusionId },
    data: {
      visibility: UserMapConclusionVisibility.user_visible,
      updatedAt: now,
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    previousVisibility: UserMapConclusionVisibility.internal_only,
    newVisibility: updated.visibility,
    updatedAt: updated.updatedAt,
  };
}
