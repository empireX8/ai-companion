import type { InspectorSelectableObjectType } from "./inspector-selection";
import { ORVEK_COPY } from "./trust-language";

export const EXPLORE_CONVERSATION_REVIEW_LIMIT = 8;

export type ExploreConversationReviewItemKind =
  | "receipt_extracted"
  | "context_profile_update"
  | "active_question_proposed"
  | "model_update_candidate"
  | "fieldwork_suggestion"
  | "pattern_signal"
  | "contradiction_signal";

export type ExploreConversationReviewStatus =
  | "draft"
  | "needs_review"
  | "confirmed"
  | "rejected"
  | "deferred";

export type ExploreConversationReviewSelectableObject = {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  selectedModelUpdateId?: string | null;
  title?: string | null;
};

export type ExploreConversationReviewReferenceAction = {
  referenceId: string;
};

export type ExploreConversationReviewItem = {
  id: string;
  kind: ExploreConversationReviewItemKind;
  kindLabel: string;
  title: string;
  summary: string;
  sourceLabel?: string;
  linkedObjectLabel?: string;
  linkedObjectHref?: string | null;
  confidenceLabel?: string;
  status: ExploreConversationReviewStatus;
  statusLabel: string;
  selectableObject: ExploreConversationReviewSelectableObject | null;
  referenceAction: ExploreConversationReviewReferenceAction | null;
  actions: {
    canConfirm: boolean;
    canEdit: boolean;
    canReject: boolean;
  };
};

export const EXPLORE_REVIEW_LOADING_COPY = "Checking proposed updates…";
export const EXPLORE_REVIEW_EMPTY_COPY =
  "No proposed updates from this conversation yet.";
export const EXPLORE_REVIEW_EMPTY_SUBCOPY =
  `Draft or proposed items appear here when the conversation surfaces something to review. Published ${ORVEK_COPY.mindModelMovement} is shown separately below.`;
export const EXPLORE_REVIEW_HAS_ITEMS_HEADLINE = "Proposed updates to review";
export const EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY =
  `These are drafts or proposals — ${ORVEK_COPY.reviewBeforeApplying}. Published ${ORVEK_COPY.mindModelMovement} appears separately.`;
export const EXPLORE_REVIEW_DRAFT_BADGE = "Draft / proposed";
export const EXPLORE_REVIEW_ACTIONS_DEFERRED_COPY = "Review actions for this item are not available yet.";
export const EXPLORE_REVIEW_INSPECTOR_SECTION_LABEL = "Conversation review";

export const EXPLORE_SESSION_REVIEW_ITEMS_ENDPOINT = (sessionId: string): string =>
  `/api/explore/sessions/${encodeURIComponent(sessionId)}/review-items`;

export function buildExploreReviewItemsMeta(count: number): string {
  return `${count} draft update${count === 1 ? "" : "s"} to review`;
}

export const EXPLORE_REVIEW_KIND_LABELS: Record<ExploreConversationReviewItemKind, string> = {
  receipt_extracted: "Receipt",
  context_profile_update: "Map draft",
  active_question_proposed: "Active question",
  model_update_candidate: "Possible movement",
  fieldwork_suggestion: "Fieldwork",
  pattern_signal: "Pattern signal",
  contradiction_signal: "Tension signal",
};

export async function fetchExploreSessionReviewItems(
  sessionId: string
): Promise<ExploreConversationReviewItem[]> {
  const response = await fetch(EXPLORE_SESSION_REVIEW_ITEMS_ENDPOINT(sessionId), {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error("Could not load conversation review items.");
  }

  const payload = (await response.json()) as { items?: ExploreConversationReviewItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function confirmExploreReferenceReviewItem(referenceId: string): Promise<void> {
  const response = await fetch(`/api/reference/${encodeURIComponent(referenceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "confirm_governance" }),
  });

  if (!response.ok) {
    throw new Error("Could not confirm this receipt.");
  }
}

export async function rejectExploreReferenceReviewItem(referenceId: string): Promise<void> {
  const response = await fetch(`/api/reference/${encodeURIComponent(referenceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "dismiss_governance" }),
  });

  if (!response.ok) {
    throw new Error("Could not dismiss this receipt.");
  }
}
