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
 * Candidate lifecycle values that must not appear on public Active Questions surfaces.
 * Null (legacy/manual rows) and promoted (operator-accepted) remain eligible when user_visible.
 */
export const PUBLIC_INVESTIGATION_EXCLUDED_CANDIDATE_LIFECYCLE_STATUSES: CandidateLifecycleStatus[] =
  [
    CandidateLifecycleStatus.proposed,
    CandidateLifecycleStatus.held_for_more_evidence,
    CandidateLifecycleStatus.rejected,
    CandidateLifecycleStatus.superseded,
    CandidateLifecycleStatus.expired,
  ];

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
    OR: [
      { candidateLifecycleStatus: null },
      { candidateLifecycleStatus: CandidateLifecycleStatus.promoted },
    ],
  };
}

export function isPublicActiveInvestigationCandidateLifecycle(
  status: CandidateLifecycleStatus | null | undefined
): boolean {
  if (status === null || status === undefined) {
    return true;
  }
  if (status === CandidateLifecycleStatus.promoted) {
    return true;
  }
  return !PUBLIC_INVESTIGATION_EXCLUDED_CANDIDATE_LIFECYCLE_STATUSES.includes(
    status
  );
}
