/**
 * fieldwork-publish-helper.ts
 *
 * Internal helper for publishing a promoted FieldworkAssignment candidate.
 *
 * Changes visibility from internal_only to user_visible and creates a
 * ModelUpdate (`fieldwork_assigned`) synchronously in the same transaction.
 * Does NOT change FieldworkAssignment.status, candidateLifecycleStatus, or evidence links.
 */

import {
  type FieldworkStatus,
  type PrismaClient,
  FieldworkAssignmentVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import { WATCH_FOR_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";
import prismadb from "./prismadb";

export function isFieldworkStatusPublishable(status: FieldworkStatus): boolean {
  return WATCH_FOR_VISIBLE_STATUSES.includes(status);
}

export type PublishFieldworkCandidateResult = {
  id: string;
  userId: string;
  previousVisibility: FieldworkAssignmentVisibility;
  newVisibility: FieldworkAssignmentVisibility;
  updatedAt: Date;
};

export class PublishFieldworkCandidateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PublishFieldworkCandidateError";
  }
}

function defaultPublishSummary(prompt: string): string {
  return `New watch-for prompt: ${prompt}`;
}

const PUBLISH_INTERNAL_NOTE =
  "Published via internal Fieldwork candidate publish action.";

export async function publishFieldworkCandidate(
  userId: string,
  fieldworkAssignmentId: string,
  options?: {
    db?: PrismaClient;
    now?: Date;
    userFacingSummary?: string;
    sourceRunId?: string | null;
  }
): Promise<PublishFieldworkCandidateResult> {
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
      visibility: true,
      candidateLifecycleStatus: true,
      status: true,
      prompt: true,
    },
  });

  if (!assignment) {
    throw new PublishFieldworkCandidateError(
      `FieldworkAssignment not found for id=${fieldworkAssignmentId} and userId=${userId}`,
      "FIELDWORK_NOT_FOUND"
    );
  }

  if (assignment.candidateLifecycleStatus === null) {
    throw new PublishFieldworkCandidateError(
      `Cannot publish FieldworkAssignment id=${fieldworkAssignmentId}: candidateLifecycleStatus is null. ` +
        "null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit lifecycle status before publishing.",
      "NULL_LIFECYCLE_STATUS"
    );
  }

  if (assignment.candidateLifecycleStatus !== "promoted") {
    throw new PublishFieldworkCandidateError(
      `Cannot publish FieldworkAssignment id=${fieldworkAssignmentId}: candidateLifecycleStatus is '${assignment.candidateLifecycleStatus}', expected 'promoted'.`,
      "NOT_PROMOTED"
    );
  }

  if (assignment.visibility !== FieldworkAssignmentVisibility.internal_only) {
    throw new PublishFieldworkCandidateError(
      `Cannot publish FieldworkAssignment id=${fieldworkAssignmentId}: visibility is '${assignment.visibility}', expected 'internal_only'.`,
      "ALREADY_VISIBLE"
    );
  }

  if (!isFieldworkStatusPublishable(assignment.status)) {
    throw new PublishFieldworkCandidateError(
      `Cannot publish FieldworkAssignment id=${fieldworkAssignmentId}: status is '${assignment.status}', expected one of [${WATCH_FOR_VISIBLE_STATUSES.join(", ")}].`,
      "FIELDWORK_STATUS_NOT_PUBLISHABLE"
    );
  }

  const userFacingSummary =
    options?.userFacingSummary ?? defaultPublishSummary(assignment.prompt);
  const sourceRunId = options?.sourceRunId ?? null;
  const previousStatus = assignment.status;

  const updated = await db.$transaction(async (tx) => {
    const updateResult = await tx.fieldworkAssignment.updateMany({
      where: {
        id: fieldworkAssignmentId,
        userId,
        visibility: FieldworkAssignmentVisibility.internal_only,
        candidateLifecycleStatus: "promoted",
        status: { in: WATCH_FOR_VISIBLE_STATUSES },
      },
      data: {
        visibility: FieldworkAssignmentVisibility.user_visible,
        updatedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new PublishFieldworkCandidateError(
        `Cannot publish FieldworkAssignment id=${fieldworkAssignmentId}: visibility is not 'internal_only' or candidate is no longer publishable. ` +
          "The assignment may have been published concurrently.",
        "ALREADY_VISIBLE"
      );
    }

    const published = await tx.fieldworkAssignment.findFirst({
      where: {
        id: fieldworkAssignmentId,
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
      throw new PublishFieldworkCandidateError(
        `FieldworkAssignment not found for id=${fieldworkAssignmentId} and userId=${userId}`,
        "FIELDWORK_NOT_FOUND"
      );
    }

    if (published.status !== previousStatus) {
      throw new PublishFieldworkCandidateError(
        `FieldworkAssignment status changed unexpectedly during publish for id=${fieldworkAssignmentId}`,
        "INTERNAL_INVARIANT_VIOLATION"
      );
    }

    if (published.candidateLifecycleStatus !== "promoted") {
      throw new PublishFieldworkCandidateError(
        `FieldworkAssignment candidateLifecycleStatus changed unexpectedly during publish for id=${fieldworkAssignmentId}`,
        "INTERNAL_INVARIANT_VIOLATION"
      );
    }

    await tx.modelUpdate.create({
      data: {
        userId,
        updateType: ModelUpdateType.fieldwork_assigned,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.fieldwork_assignment,
        affectedObjectId: fieldworkAssignmentId,
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
    previousVisibility: FieldworkAssignmentVisibility.internal_only,
    newVisibility: updated.visibility,
    updatedAt: updated.updatedAt,
  };
}
