import {
  CandidateLifecycleStatus,
  InvestigationStatus,
  InvestigationVisibility,
  type Prisma,
} from "@prisma/client";

import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";

export const PUBLIC_INVESTIGATION_VISIBILITY =
  InvestigationVisibility.user_visible;

/**
 * Complementary public statuses for Explore Investigations threads.
 * Excludes rows owned by the Active Questions public list contract.
 */
export const EXPLORE_INVESTIGATION_VISIBLE_STATUSES = (
  Object.values(InvestigationStatus) as InvestigationStatus[]
).filter((status) => !ACTIVE_QUESTION_VISIBLE_STATUSES.includes(status));

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

export type PublicExploreInvestigationWhereInput = {
  userId: string;
  id?: string;
};

/**
 * Public Explore Investigations list guard.
 * Same visibility/lifecycle fail-closed rules as Active Questions, but excludes
 * statuses owned by the Active Questions public contract.
 */
export function buildPublicExploreInvestigationWhere(
  input: PublicExploreInvestigationWhereInput
): Prisma.InvestigationWhereInput {
  return {
    userId: input.userId,
    ...(input.id ? { id: input.id } : {}),
    visibility: PUBLIC_INVESTIGATION_VISIBILITY,
    status: {
      notIn: [...ACTIVE_QUESTION_VISIBLE_STATUSES],
    },
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
