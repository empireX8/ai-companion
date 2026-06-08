import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  type FieldworkStatus,
  InvestigationStatus,
  InvestigationVisibility,
  ModelUpdateVisibility,
  UserMapConclusionVisibility,
} from "@prisma/client";

import { getAllowedNextStatuses } from "./candidate-lifecycle-transitions";
import { isFieldworkStatusPublishable } from "./fieldwork-status-publishability";
import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "./public-intelligence-safe-slice";

export type InternalOperatorLifecycleAction =
  | "promote"
  | "hold_for_more_evidence"
  | "reject"
  | "expire";

export const INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS: Record<
  InternalOperatorLifecycleAction,
  string
> = {
  promote: "Promote",
  hold_for_more_evidence: "Hold for more evidence",
  reject: "Reject",
  expire: "Expire",
};

const LIFECYCLE_ACTION_ORDER: InternalOperatorLifecycleAction[] = [
  "hold_for_more_evidence",
  "promote",
  "reject",
  "expire",
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
    case "expire":
      return CandidateLifecycleStatus.expired;
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

export function canPublishInternalModelUpdateCandidate(input: {
  visibility: ModelUpdateVisibility;
  isMeaningful: boolean;
  evidenceLinkCount: number;
}): boolean {
  return (
    input.visibility === ModelUpdateVisibility.internal_only &&
    input.isMeaningful === false &&
    input.evidenceLinkCount > 0
  );
}

export function internalModelUpdateCandidatePublishApiPath(
  modelUpdateId: string
): string {
  return `/api/internal/model-updates/candidates/${encodeURIComponent(modelUpdateId)}/publish`;
}

export type ReviewTriageFilter = "all" | "publish_ready" | "needs_action";

export type LifecycleReviewTriageBucket =
  | "publish_ready"
  | "needs_lifecycle"
  | "blocked";

export type ModelUpdateReviewTriageBucket =
  | "publish_ready"
  | "needs_evidence"
  | "blocked";

export const LIFECYCLE_TRIAGE_BUCKET_LABELS: Record<
  LifecycleReviewTriageBucket,
  string
> = {
  publish_ready: "Ready to publish",
  needs_lifecycle: "Needs lifecycle review",
  blocked: "No actions available",
};

export const MODEL_UPDATE_TRIAGE_BUCKET_LABELS: Record<
  ModelUpdateReviewTriageBucket,
  string
> = {
  publish_ready: "Ready to publish",
  needs_evidence: "Needs linked evidence",
  blocked: "No actions available",
};

export const LIFECYCLE_TRIAGE_BUCKET_ORDER: LifecycleReviewTriageBucket[] = [
  "publish_ready",
  "needs_lifecycle",
  "blocked",
];

export const MODEL_UPDATE_TRIAGE_BUCKET_ORDER: ModelUpdateReviewTriageBucket[] = [
  "publish_ready",
  "needs_evidence",
  "blocked",
];

export function formatReviewTabLabel(
  label: string,
  totalCount: number,
  publishReadyCount = 0
): string {
  const countSuffix = totalCount > 0 ? ` (${totalCount})` : "";
  const readySuffix =
    publishReadyCount > 0 ? ` · ${publishReadyCount} ready` : "";
  return `${label}${countSuffix}${readySuffix}`;
}

export function matchesReviewTriageFilter(
  bucket: LifecycleReviewTriageBucket | ModelUpdateReviewTriageBucket,
  filter: ReviewTriageFilter
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "publish_ready") {
    return bucket === "publish_ready";
  }

  return bucket === "needs_lifecycle" || bucket === "needs_evidence";
}

export function getUserMapReviewTriageBucket(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: UserMapConclusionVisibility;
}): LifecycleReviewTriageBucket {
  if (canPublishInternalCandidate(input)) {
    return "publish_ready";
  }

  if (getInternalOperatorLifecycleActions(input.candidateLifecycleStatus).length > 0) {
    return "needs_lifecycle";
  }

  return "blocked";
}

export function getInvestigationReviewTriageBucket(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: InvestigationVisibility;
  status: InvestigationStatus;
}): LifecycleReviewTriageBucket {
  if (canPublishInternalInvestigationCandidate(input)) {
    return "publish_ready";
  }

  if (getInternalOperatorLifecycleActions(input.candidateLifecycleStatus).length > 0) {
    return "needs_lifecycle";
  }

  return "blocked";
}

export function getFieldworkReviewTriageBucket(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  visibility: FieldworkAssignmentVisibility;
  status: FieldworkStatus;
}): LifecycleReviewTriageBucket {
  if (canPublishInternalFieldworkCandidate(input)) {
    return "publish_ready";
  }

  if (getInternalOperatorLifecycleActions(input.candidateLifecycleStatus).length > 0) {
    return "needs_lifecycle";
  }

  return "blocked";
}

export function getModelUpdateReviewTriageBucket(input: {
  visibility: ModelUpdateVisibility;
  isMeaningful: boolean;
  evidenceLinkCount: number;
}): ModelUpdateReviewTriageBucket {
  if (canPublishInternalModelUpdateCandidate(input)) {
    return "publish_ready";
  }

  if (input.evidenceLinkCount === 0) {
    return "needs_evidence";
  }

  return "blocked";
}

export function groupReviewCandidatesByTriage<
  T,
  B extends LifecycleReviewTriageBucket | ModelUpdateReviewTriageBucket,
>(args: {
  items: T[];
  getBucket: (item: T) => B;
  filter: ReviewTriageFilter;
  bucketOrder: readonly B[];
  getSortTimestamp: (item: T) => string;
}): Array<{ bucket: B; items: T[] }> {
  const filtered = args.items.filter((item) =>
    matchesReviewTriageFilter(args.getBucket(item), args.filter)
  );

  const grouped = new Map<B, T[]>();
  for (const bucket of args.bucketOrder) {
    grouped.set(bucket, []);
  }

  for (const item of filtered) {
    const bucket = args.getBucket(item);
    const bucketItems = grouped.get(bucket);
    if (bucketItems) {
      bucketItems.push(item);
    }
  }

  for (const bucketItems of grouped.values()) {
    bucketItems.sort((left, right) => {
      const leftTime = Date.parse(args.getSortTimestamp(left));
      const rightTime = Date.parse(args.getSortTimestamp(right));
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return 0;
      }
      return rightTime - leftTime;
    });
  }

  return args.bucketOrder
    .map((bucket) => ({
      bucket,
      items: grouped.get(bucket) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}
