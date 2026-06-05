/**
 * fieldwork-candidate-lifecycle-persistence.ts
 *
 * Internal helper for changing FieldworkAssignment.candidateLifecycleStatus safely
 * using the shared Phase 2K transition policy (transitionOrThrow).
 *
 * Mutates only candidateLifecycleStatus. Does not change FieldworkAssignment.status
 * or visibility.
 */

import {
  CandidateLifecycleStatus,
  type FieldworkAssignmentVisibility,
  type FieldworkStatus,
  type PrismaClient,
} from "@prisma/client";

import { transitionOrThrow } from "./candidate-lifecycle-transitions";
import prismadb from "./prismadb";

export type UpdateFieldworkLifecycleStatusResult = {
  id: string;
  userId: string;
  previousStatus: CandidateLifecycleStatus;
  newStatus: CandidateLifecycleStatus;
  updatedAt: Date;
};

export class FieldworkLifecyclePersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "FieldworkLifecyclePersistenceError";
  }
}

export async function updateFieldworkCandidateLifecycleStatus(
  userId: string,
  fieldworkAssignmentId: string,
  newStatus: CandidateLifecycleStatus,
  options?: {
    db?: PrismaClient;
    now?: Date;
  }
): Promise<UpdateFieldworkLifecycleStatusResult> {
  const db = options?.db ?? prismadb;
  const now = options?.now ?? new Date();

  const assignment = await db.fieldworkAssignment.findFirst({
    where: {
      id: fieldworkAssignmentId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      candidateLifecycleStatus: true,
      status: true,
      visibility: true,
    },
  });

  if (!assignment) {
    throw new FieldworkLifecyclePersistenceError(
      `FieldworkAssignment not found for id=${fieldworkAssignmentId} and userId=${userId}`,
      "FIELDWORK_NOT_FOUND"
    );
  }

  if (assignment.candidateLifecycleStatus === null) {
    throw new FieldworkLifecyclePersistenceError(
      `Cannot transition FieldworkAssignment id=${fieldworkAssignmentId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit initial status (e.g. proposed) before transitioning.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  let nextStatus: CandidateLifecycleStatus;
  try {
    nextStatus = transitionOrThrow(assignment.candidateLifecycleStatus, newStatus);
  } catch (error) {
    throw new FieldworkLifecyclePersistenceError(
      error instanceof Error
        ? error.message
        : `Transition from '${assignment.candidateLifecycleStatus}' to '${newStatus}' is not allowed.`,
      "FORBIDDEN_TRANSITION"
    );
  }

  const previousStatus = assignment.candidateLifecycleStatus;
  const previousFieldworkStatus = assignment.status as FieldworkStatus;
  const previousVisibility = assignment.visibility as FieldworkAssignmentVisibility;

  const updateResult = await db.fieldworkAssignment.updateMany({
    where: {
      id: fieldworkAssignmentId,
      userId,
    },
    data: {
      candidateLifecycleStatus: nextStatus,
      updatedAt: now,
    },
  });

  if (updateResult.count === 0) {
    throw new FieldworkLifecyclePersistenceError(
      `FieldworkAssignment not found for id=${fieldworkAssignmentId} and userId=${userId}`,
      "FIELDWORK_NOT_FOUND"
    );
  }

  const updated = await db.fieldworkAssignment.findFirst({
    where: {
      id: fieldworkAssignmentId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      candidateLifecycleStatus: true,
      status: true,
      visibility: true,
      updatedAt: true,
    },
  });

  if (!updated) {
    throw new FieldworkLifecyclePersistenceError(
      `FieldworkAssignment not found for id=${fieldworkAssignmentId} and userId=${userId}`,
      "FIELDWORK_NOT_FOUND"
    );
  }

  if (updated.status !== previousFieldworkStatus) {
    throw new FieldworkLifecyclePersistenceError(
      `FieldworkAssignment status changed unexpectedly during lifecycle update for id=${fieldworkAssignmentId}`,
      "INTERNAL_INVARIANT_VIOLATION"
    );
  }

  if (updated.visibility !== previousVisibility) {
    throw new FieldworkLifecyclePersistenceError(
      `FieldworkAssignment visibility changed unexpectedly during lifecycle update for id=${fieldworkAssignmentId}`,
      "INTERNAL_INVARIANT_VIOLATION"
    );
  }

  return {
    id: updated.id,
    userId: updated.userId,
    previousStatus,
    newStatus: updated.candidateLifecycleStatus as CandidateLifecycleStatus,
    updatedAt: updated.updatedAt,
  };
}
