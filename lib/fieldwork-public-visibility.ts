import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  type FieldworkStatus,
  type Prisma,
} from "@prisma/client";

import { WATCH_FOR_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";

export const PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY =
  FieldworkAssignmentVisibility.user_visible;

/**
 * Fail-closed allow-list for FieldworkAssignment rows on public Watch For surfaces.
 * Only legacy/manual null and operator-promoted lifecycle values are eligible.
 */
export const PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES: readonly (
  | null
  | CandidateLifecycleStatus
)[] = [null, CandidateLifecycleStatus.promoted];

export function buildPublicFieldworkCandidateLifecycleOrFilter(): Prisma.FieldworkAssignmentWhereInput["OR"] {
  return PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES.map(
    (candidateLifecycleStatus) => ({ candidateLifecycleStatus })
  );
}

export type PublicWatchForWhereInput = {
  userId: string;
  id?: string;
  status?: FieldworkStatus | { in: FieldworkStatus[] };
};

export function buildPublicWatchForWhere(
  input: PublicWatchForWhereInput
): Prisma.FieldworkAssignmentWhereInput {
  const statusFilter =
    input.status === undefined
      ? { in: WATCH_FOR_VISIBLE_STATUSES }
      : input.status;

  return {
    userId: input.userId,
    ...(input.id !== undefined ? { id: input.id } : {}),
    visibility: PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY,
    status: statusFilter,
    OR: buildPublicFieldworkCandidateLifecycleOrFilter(),
  };
}

export function isPublicWatchForCandidateLifecycle(
  status: CandidateLifecycleStatus | null | undefined
): boolean {
  if (status === undefined) {
    return false;
  }
  return PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES.includes(status);
}
