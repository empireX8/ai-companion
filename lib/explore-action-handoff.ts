import type {
  ActionBucket,
  ActionStatus,
  ActionsPageData,
} from "./actions-api";

export const EXPLORE_ACTION_ID_PARAM = "actionId";

const MAX_ACTION_ID_LENGTH = 128;
const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ExploreActionHandoffContext = {
  actionId: string;
  title: string;
  bucket: ActionBucket;
  whySuggested: string;
  linkedClaimSummary: string | null;
  linkedSourceLabel: string;
  linkedClaimId: string | null;
  status: ActionStatus;
};

function normalizeActionId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ACTION_ID_LENGTH) {
    return null;
  }

  if (!ACTION_ID_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function parseExploreActionIdParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return normalizeActionId(value);
}

export function buildExploreActionHandoffHref(actionId: string): string | null {
  const safeId = normalizeActionId(actionId);
  if (!safeId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set(EXPLORE_ACTION_ID_PARAM, safeId);
  return `/explore?${params.toString()}`;
}

export function resolveExploreActionHandoffContext(
  data: ActionsPageData | null,
  actionId: string | null
): ExploreActionHandoffContext | null {
  if (!data || !actionId) {
    return null;
  }

  const surfaced = [...data.stabilizeNow, ...data.buildForward];
  const action = surfaced.find((candidate) => candidate.id === actionId);
  if (!action) {
    return null;
  }

  return {
    actionId: action.id,
    title: action.title,
    bucket: action.bucket,
    whySuggested: action.whySuggested,
    linkedClaimSummary: action.linkedClaimSummary,
    linkedSourceLabel: action.linkedSourceLabel,
    linkedClaimId: action.linkedClaimId,
    status: action.status,
  };
}
