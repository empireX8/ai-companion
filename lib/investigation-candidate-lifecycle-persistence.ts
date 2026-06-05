/**
 * investigation-candidate-lifecycle-persistence.ts
 *
 * Internal helper for changing Investigation.candidateLifecycleStatus safely
 * using the shared Phase 2K transition policy (transitionOrThrow).
 *
 * Mutates only candidateLifecycleStatus. Does not change Investigation.status
 * or visibility.
 */

import {
  CandidateLifecycleStatus,
  type InvestigationStatus,
  type InvestigationVisibility,
  type PrismaClient,
} from "@prisma/client";

import { transitionOrThrow } from "./candidate-lifecycle-transitions";
import prismadb from "./prismadb";

export type UpdateInvestigationLifecycleStatusResult = {
  id: string;
  userId: string;
  previousStatus: CandidateLifecycleStatus;
  newStatus: CandidateLifecycleStatus;
  updatedAt: Date;
};

export class InvestigationLifecyclePersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "InvestigationLifecyclePersistenceError";
  }
}

export async function updateInvestigationCandidateLifecycleStatus(
  userId: string,
  investigationId: string,
  newStatus: CandidateLifecycleStatus,
  options?: {
    db?: PrismaClient;
    now?: Date;
  }
): Promise<UpdateInvestigationLifecycleStatusResult> {
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
      candidateLifecycleStatus: true,
      status: true,
      visibility: true,
    },
  });

  if (!investigation) {
    throw new InvestigationLifecyclePersistenceError(
      `Investigation not found for id=${investigationId} and userId=${userId}`,
      "INVESTIGATION_NOT_FOUND"
    );
  }

  if (investigation.candidateLifecycleStatus === null) {
    throw new InvestigationLifecyclePersistenceError(
      `Cannot transition Investigation id=${investigationId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit initial status (e.g. proposed) before transitioning.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  let nextStatus: CandidateLifecycleStatus;
  try {
    nextStatus = transitionOrThrow(
      investigation.candidateLifecycleStatus,
      newStatus
    );
  } catch (error) {
    throw new InvestigationLifecyclePersistenceError(
      error instanceof Error
        ? error.message
        : `Transition from '${investigation.candidateLifecycleStatus}' to '${newStatus}' is not allowed.`,
      "FORBIDDEN_TRANSITION"
    );
  }

  const previousStatus = investigation.candidateLifecycleStatus;
  const previousInvestigationStatus = investigation.status as InvestigationStatus;
  const previousVisibility = investigation.visibility as InvestigationVisibility;

  const updated = await db.investigation.update({
    where: { id: investigationId },
    data: {
      candidateLifecycleStatus: nextStatus,
      updatedAt: now,
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

  if (updated.status !== previousInvestigationStatus) {
    throw new InvestigationLifecyclePersistenceError(
      `Investigation status changed unexpectedly during lifecycle update for id=${investigationId}`,
      "INTERNAL_INVARIANT_VIOLATION"
    );
  }

  if (updated.visibility !== previousVisibility) {
    throw new InvestigationLifecyclePersistenceError(
      `Investigation visibility changed unexpectedly during lifecycle update for id=${investigationId}`,
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
