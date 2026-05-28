/**
 * candidate-lifecycle-persistence.ts
 *
 * Phase 2L — UserMapConclusion candidate lifecycle persistence helper.
 *
 * Provides a narrow internal helper for changing UserMapConclusion.candidateLifecycleStatus
 * safely using the Phase 2K transition policy (transitionOrThrow).
 *
 * Null semantics:
 *   null means legacy/pre-lifecycle/not lifecycle-managed.
 *   The helper requires existing candidateLifecycleStatus to be non-null before transition.
 *   Legacy records must be explicitly initialized before lifecycle management.
 */

import {
  CandidateLifecycleStatus,
  type PrismaClient,
} from "@prisma/client";

import { transitionOrThrow } from "./candidate-lifecycle-transitions";
import prismadb from "./prismadb";

/**
 * Result of a successful lifecycle status update.
 */
export type UpdateLifecycleStatusResult = {
  id: string;
  userId: string;
  previousStatus: CandidateLifecycleStatus;
  newStatus: CandidateLifecycleStatus;
  updatedAt: Date;
};

/**
 * Error types for lifecycle persistence operations.
 */
export class LifecyclePersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LifecyclePersistenceError";
  }
}

/**
 * Internal helper to update a UserMapConclusion's candidateLifecycleStatus safely.
 *
 * Enforces:
 * - User ownership (the conclusion must belong to the requesting user)
 * - Non-null existing status (null = legacy/pre-lifecycle, must be initialized first)
 * - Legal transitions via transitionOrThrow from Phase 2K
 *
 * @param userId - The user who owns the conclusion
 * @param conclusionId - The UserMapConclusion ID to update
 * @param newStatus - The desired new CandidateLifecycleStatus
 * @param options - Optional db override and timestamp
 * @returns The update result with previous and new status
 * @throws {LifecyclePersistenceError} If the conclusion is not found, not owned, has null lifecycle status, or the transition is forbidden
 */
export async function updateCandidateLifecycleStatus(
  userId: string,
  conclusionId: string,
  newStatus: CandidateLifecycleStatus,
  options?: {
    db?: PrismaClient;
    now?: Date;
  }
): Promise<UpdateLifecycleStatusResult> {
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
      candidateLifecycleStatus: true,
    },
  });

  if (!conclusion) {
    throw new LifecyclePersistenceError(
      `UserMapConclusion not found for id=${conclusionId} and userId=${userId}`,
      "CONCLUSION_NOT_FOUND"
    );
  }

  // 2. Enforce non-null existing status (null = legacy/pre-lifecycle)
  if (conclusion.candidateLifecycleStatus === null) {
    throw new LifecyclePersistenceError(
      `Cannot transition UserMapConclusion id=${conclusionId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit initial status (e.g. proposed) before transitioning.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  // 3. Enforce legal transition using Phase 2K policy
  let nextStatus: CandidateLifecycleStatus;
  try {
    nextStatus = transitionOrThrow(
      conclusion.candidateLifecycleStatus,
      newStatus
    );
  } catch (error) {
    throw new LifecyclePersistenceError(
      error instanceof Error ? error.message : `Transition from '${conclusion.candidateLifecycleStatus}' to '${newStatus}' is not allowed.`,
      "FORBIDDEN_TRANSITION"
    );
  }

  // 4. Perform the update
  const updated = await db.userMapConclusion.update({
    where: { id: conclusionId },
    data: {
      candidateLifecycleStatus: nextStatus,
      updatedAt: now,
    },
    select: {
      id: true,
      userId: true,
      candidateLifecycleStatus: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    previousStatus: conclusion.candidateLifecycleStatus,
    newStatus: updated.candidateLifecycleStatus as CandidateLifecycleStatus,
    updatedAt: updated.updatedAt,
  };
}
