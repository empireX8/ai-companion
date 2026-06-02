import {
  CandidateLifecycleStatus,
  InvestigationVisibility,
  type InvestigationStatus,
  type Prisma,
} from "@prisma/client";

import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";

export const PUBLIC_INVESTIGATION_VISIBILITY =
  InvestigationVisibility.user_visible;

/**
 * Fail-closed allow-list for Investigation rows on public Active Questions surfaces.
 * Only legacy/manual null and operator-promoted lifecycle values are eligible.
 */
export const PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES: readonly (
  | null
  | CandidateLifecycleStatus
)[] = [null, CandidateLifecycleStatus.promoted];

export function buildPublicInvestigationCandidateLifecycleOrFilter(): Prisma.InvestigationWhereInput["OR"] {
  return PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES.map(
    (candidateLifecycleStatus) => ({ candidateLifecycleStatus })
  );
}

export type PublicActiveInvestigationWhereInput = {
  userId: string;
  id?: string;
  status?: InvestigationStatus | { in: InvestigationStatus[] };
};

export function buildPublicActiveInvestigationWhere(
  input: PublicActiveInvestigationWhereInput
): Prisma.InvestigationWhereInput {
  const statusFilter =
    input.status === undefined
      ? { in: ACTIVE_QUESTION_VISIBLE_STATUSES }
      : input.status;

  return {
    userId: input.userId,
    ...(input.id ? { id: input.id } : {}),
    visibility: PUBLIC_INVESTIGATION_VISIBILITY,
    status: statusFilter,
    OR: buildPublicInvestigationCandidateLifecycleOrFilter(),
  };
}

export function isPublicActiveInvestigationCandidateLifecycle(
  status: CandidateLifecycleStatus | null | undefined
): boolean {
  if (status === undefined) {
    return false;
  }
  return PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES.includes(
    status
  );
}
