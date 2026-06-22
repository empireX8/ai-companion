export type ExploreConversationReviewKind =
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
  objectType:
    | "usermap_conclusion"
    | "model_update"
    | "pattern_claim"
    | "contradiction_node";
  objectId: string;
  selectedModelUpdateId?: string | null;
  title?: string | null;
};

export type ExploreConversationReviewActions = {
  canConfirm: boolean;
  canEdit: boolean;
  canReject: boolean;
};

export type ExploreConversationReviewItem = {
  id: string;
  kind: ExploreConversationReviewKind;
  title: string;
  summary: string;
  sourceLabel?: string;
  linkedObjectLabel?: string;
  linkedObjectHref?: string;
  confidenceLabel?: string;
  status: ExploreConversationReviewStatus;
  selectableObject?: ExploreConversationReviewSelectableObject | null;
  actions: ExploreConversationReviewActions;
};

export type ExploreConversationReviewItemsResponse = {
  items: ExploreConversationReviewItem[];
  sourceAvailable: boolean;
};
