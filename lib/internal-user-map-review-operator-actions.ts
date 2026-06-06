import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  type FieldworkStatus,
  InvestigationStatus,
  InvestigationVisibility,
  UserMapConclusionVisibility,
} from "@prisma/client";

import { getAllowedNextStatuses } from "./candidate-lifecycle-transitions";
import { isFieldworkStatusPublishable } from "./fieldwork-status-publishability";
import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";

export type InternalOperatorLifecycleAction =
  | "promote"
  | "hold_for_more_evidence"
  | "reject";

export const INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS: Record<
  InternalOperatorLifecycleAction,
  string
> = {
  promote: "Promote",
  hold_for_more_evidence: "Hold for more evidence",
  reject: "Reject",
};

const LIFECYCLE_ACTION_ORDER: InternalOperatorLifecycleAction[] = [
  "hold_for_more_evidence",
  "promote",
  "reject",
];

export function lifecycleActionToStatus(
  action: InternalOperatorLifecycleAction
): CandidateLifecycleStatus {
  switch (action) {
    case "promote":
      return CandidateLifecycleStatus.promoted;
    case "hold_for_more_evidence":
      return CandidateLifecycleStatus.held_for_more_evidence;
    case "reject":
      return CandidateLifecycleStatus.rejected;
  }
}

export function getInternalOperatorLifecycleActions(
  candidateLifecycleStatus: CandidateLifecycleStatus | null
): InternalOperatorLifecycleAction[] {
  const allowed = getAllowedNextStatuses(candidateLifecycleStatus);

  return LIFECYCLE_ACTION_ORDER.filter((action) =>
    allowed.has(lifecycleActionToStatus(action))
  );
}

export function canPublishInternalCandidate(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: UserMapConclusionVisibility;
}): boolean {
  return (
    input.candidateLifecycleStatus === CandidateLifecycleStatus.promoted &&
    input.visibility === UserMapConclusionVisibility.internal_only
  );
}

export function internalCandidateLifecycleApiPath(conclusionId: string): string {
  return `/api/internal/user-map/candidates/${encodeURIComponent(conclusionId)}/lifecycle`;
}

export function internalCandidatePublishApiPath(conclusionId: string): string {
  return `/api/internal/user-map/candidates/${encodeURIComponent(conclusionId)}/publish`;
}

export function isActiveQuestionVisibleInvestigationStatus(
  status: InvestigationStatus
): boolean {
  return ACTIVE_QUESTION_VISIBLE_STATUSES.includes(status);
}

export function canPublishInternalInvestigationCandidate(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: InvestigationVisibility;
  status: InvestigationStatus;
}): boolean {
  return (
    input.candidateLifecycleStatus === CandidateLifecycleStatus.promoted &&
    input.visibility === InvestigationVisibility.internal_only &&
    isActiveQuestionVisibleInvestigationStatus(input.status)
  );
}

export function internalInvestigationCandidateLifecycleApiPath(
  investigationId: string
): string {
  return `/api/internal/investigations/candidates/${encodeURIComponent(investigationId)}/lifecycle`;
}

export function internalInvestigationCandidatePublishApiPath(
  investigationId: string
): string {
  return `/api/internal/investigations/candidates/${encodeURIComponent(investigationId)}/publish`;
}

export function canPublishInternalFieldworkCandidate(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: FieldworkAssignmentVisibility;
  status: FieldworkStatus;
}): boolean {
  return (
    input.candidateLifecycleStatus === CandidateLifecycleStatus.promoted &&
    input.visibility === FieldworkAssignmentVisibility.internal_only &&
    isFieldworkStatusPublishable(input.status)
  );
}

export function internalFieldworkCandidateLifecycleApiPath(
  fieldworkAssignmentId: string
): string {
  return `/api/internal/fieldwork/candidates/${encodeURIComponent(fieldworkAssignmentId)}/lifecycle`;
}

export function internalFieldworkCandidatePublishApiPath(
  fieldworkAssignmentId: string
): string {
  return `/api/internal/fieldwork/candidates/${encodeURIComponent(fieldworkAssignmentId)}/publish`;
}
