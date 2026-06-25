import type { ExploreActionHandoffContext } from "../explore-action-handoff";
import type { ActiveQuestionItem } from "../active-questions";
import type { WatchForItem } from "../watch-for";
import {
  EXPLORE_CHAT_EMPTY_PROMPT,
  EXPLORE_CHAT_PLACEHOLDER,
  EXPLORE_GROUNDING_SECTION_INTRO,
  EXPLORE_GROUNDING_SECTION_LABEL,
  EXPLORE_HANDOFF_BANNER_LABEL,
  EXPLORE_HANDOFF_LOADING_COPY,
  EXPLORE_HANDOFF_UNAVAILABLE_COPY,
  EXPLORE_HANDOFF_VIEW_DECISION_LABEL,
  EXPLORE_PAGE_INTRO,
  EXPLORE_PAGE_TITLE,
} from "../explore-surface";

export type V0ExploreTabId = "free" | "investigations" | "questions" | "fieldwork";

export type V0ExploreTab = {
  id: V0ExploreTabId;
  label: string;
};

export type V0ExploreMessage = {
  id: string;
  role: "user" | "orvek";
  content: string;
  isThinking: boolean;
};

export type V0ExploreGroundingChip = {
  id: string;
  label: string;
  disabled: boolean;
  inspectorObjectId: string | null;
};

export type V0ExploreInvestigationItem = {
  id: string;
  title: string;
  statusLabel: string;
  meta: string;
};

export type V0ExploreQuestionItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  statusLabel: string;
  evidenceMeta: string;
};

export type V0ExploreFieldworkItem = {
  id: string;
  title: string;
  reason: string;
  statusLabel: string;
  href: string | null;
};

export type V0ExploreHandoffContext = {
  title: string;
  bucketLabel: string;
  statusLabel: string;
  viewDecisionHref: string;
};

export type V0ExploreHandoffSlot = {
  show: boolean;
  isLoading: boolean;
  error: string | null;
  context: V0ExploreHandoffContext | null;
  bannerLabel: string;
  loadingCopy: string;
  unavailableCopy: string;
  viewDecisionLabel: string;
};

export type V0ExploreViewProps = {
  pageTitle: string;
  pageIntro: string;
  tabs: V0ExploreTab[];
  activeTab: V0ExploreTabId;
  handoff: V0ExploreHandoffSlot;
  groundingSectionLabel: string;
  groundingSectionIntro: string;
  groundingChips: V0ExploreGroundingChip[];
  liveDetectionCopy: string;
  messages: V0ExploreMessage[];
  emptyPrompt: string;
  chatLoadingCopy: string;
  composerDraft: string;
  composerPlaceholder: string;
  isBooting: boolean;
  isSending: boolean;
  errorMessage: string | null;
  quickPrompts: readonly string[];
  inspectorMovementCta: string;
  investigations: {
    isLoading: boolean;
    items: V0ExploreInvestigationItem[];
    emptyListCopy: string;
    emptyDetailCopy: string;
    selectedId: string | null;
  };
  questions: {
    isLoading: boolean;
    items: V0ExploreQuestionItem[];
    emptyListCopy: string;
    emptyDetailCopy: string;
    selectedId: string | null;
    resolveYesEmptyCopy: string;
    resolveNoEmptyCopy: string;
    relatedEmptyCopy: string;
  };
  fieldwork: {
    isLoading: boolean;
    items: V0ExploreFieldworkItem[];
    emptyListCopy: string;
    emptyDetailCopy: string;
    selectedId: string | null;
    fieldsEmptyCopy: string;
  };
};

const EXPLORE_TABS: V0ExploreTab[] = [
  { id: "free", label: "Free Explore" },
  { id: "investigations", label: "Investigations" },
  { id: "questions", label: "Active Questions" },
  { id: "fieldwork", label: "Fieldwork Bridge" },
];

const QUICK_PROMPTS = [
  "Explore a pattern",
  "Talk through a decision",
  "Start an investigation",
  "Inspect a conflict",
] as const;

export const V0_EXPLORE_GROUNDING_EMPTY_CHIPS = [
  { id: "grounding-empty-receipts", label: "No linked receipts yet" },
  { id: "grounding-empty-object", label: "No selected model object" },
  { id: "grounding-empty-question", label: "No active question linked" },
] as const;

export const V0_EXPLORE_LIVE_DETECTION_COPY = "No live model signal detected yet.";
export const V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST =
  "No investigation is active yet.";
export const V0_EXPLORE_INVESTIGATIONS_EMPTY_DETAIL =
  "Select an investigation thread or start one in Free Explore when evidence is ready.";
export const V0_EXPLORE_QUESTIONS_EMPTY_LIST = "No active questions are open yet.";
export const V0_EXPLORE_QUESTIONS_EMPTY_DETAIL =
  "Select a question to review what would resolve it toward yes or no.";
export const V0_EXPLORE_QUESTIONS_RESOLVE_YES_EMPTY =
  "No yes-resolution signals are linked yet.";
export const V0_EXPLORE_QUESTIONS_RESOLVE_NO_EMPTY =
  "No no-resolution signals are linked yet.";
export const V0_EXPLORE_QUESTIONS_RELATED_EMPTY =
  "No linked model objects for this question yet.";
export const V0_EXPLORE_FIELDWORK_EMPTY_LIST = "No fieldwork bridge is active yet.";
export const V0_EXPLORE_FIELDWORK_EMPTY_DETAIL =
  "Select a fieldwork prompt to review expected signal and observation framing.";
export const V0_EXPLORE_FIELDWORK_FIELDS_EMPTY =
  "Fieldwork framing is not available for this prompt yet.";

export type MapExploreMessageInput = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type MapExploreDataInput = {
  activeTab: V0ExploreTabId;
  hasActionHandoffRequest: boolean;
  handoffContext: ExploreActionHandoffContext | null;
  isLoadingHandoff: boolean;
  handoffError: string | null;
  messages: MapExploreMessageInput[];
  composerDraft: string;
  isBooting: boolean;
  isSending: boolean;
  errorMessage: string | null;
  groundingChips?: V0ExploreGroundingChip[];
  investigations?: {
    isLoading: boolean;
    items: V0ExploreInvestigationItem[];
    selectedId: string | null;
  };
  questions?: {
    isLoading: boolean;
    items: V0ExploreQuestionItem[];
    selectedId: string | null;
  };
  fieldwork?: {
    isLoading: boolean;
    items: V0ExploreFieldworkItem[];
    selectedId: string | null;
  };
};

function toBucketLabel(bucket: ExploreActionHandoffContext["bucket"]): string {
  return bucket === "build" ? "Build Forward" : "Stabilize Now";
}

function toStatusLabel(status: ExploreActionHandoffContext["status"]): string {
  if (status === "done") return "Done";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return "Not started";
}

function mapMessage(message: MapExploreMessageInput): V0ExploreMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "orvek",
    content: message.content,
    isThinking: message.role === "assistant" && !message.content,
  };
}

function mapHandoff(input: MapExploreDataInput): V0ExploreHandoffSlot {
  const context = input.handoffContext
    ? {
        title: input.handoffContext.title,
        bucketLabel: toBucketLabel(input.handoffContext.bucket),
        statusLabel: toStatusLabel(input.handoffContext.status),
        viewDecisionHref: `/actions?bucket=${input.handoffContext.bucket}`,
      }
    : null;

  return {
    show: input.hasActionHandoffRequest,
    isLoading: input.isLoadingHandoff,
    error: input.handoffError,
    context,
    bannerLabel: EXPLORE_HANDOFF_BANNER_LABEL,
    loadingCopy: EXPLORE_HANDOFF_LOADING_COPY,
    unavailableCopy: EXPLORE_HANDOFF_UNAVAILABLE_COPY,
    viewDecisionLabel: EXPLORE_HANDOFF_VIEW_DECISION_LABEL,
  };
}

function defaultGroundingChips(): V0ExploreGroundingChip[] {
  return V0_EXPLORE_GROUNDING_EMPTY_CHIPS.map((chip) => ({
    id: chip.id,
    label: chip.label,
    disabled: true,
    inspectorObjectId: null,
  }));
}

export function mapActiveQuestionsToExploreQuestions(
  items: ActiveQuestionItem[]
): V0ExploreQuestionItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    organizingQuestion: item.organizingQuestion,
    statusLabel: item.statusLabel,
    evidenceMeta: `${item.statusLabel} · updated recently`,
  }));
}

export function mapInvestigationRowsToExploreItems(
  rows: Array<{ id: string; title: string; status?: string; organizingQuestion?: string }>
): V0ExploreInvestigationItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    statusLabel: row.status ?? "Open",
    meta: row.organizingQuestion
      ? `${row.organizingQuestion.slice(0, 48)}…`
      : "No linked detail yet",
  }));
}

export function mapWatchForToExploreFieldwork(items: WatchForItem[]): V0ExploreFieldworkItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.prompt,
    reason: item.reason,
    statusLabel: item.statusLabel,
    href: item.linkedObjectHref ?? `/watch-for/${item.id}`,
  }));
}

export function mapExploreDataToV0Props(input: MapExploreDataInput): V0ExploreViewProps {
  const groundingChips =
    input.groundingChips && input.groundingChips.length > 0
      ? input.groundingChips
      : defaultGroundingChips();

  return {
    pageTitle: EXPLORE_PAGE_TITLE,
    pageIntro: EXPLORE_PAGE_INTRO,
    tabs: EXPLORE_TABS,
    activeTab: input.activeTab,
    handoff: mapHandoff(input),
    groundingSectionLabel: EXPLORE_GROUNDING_SECTION_LABEL,
    groundingSectionIntro: EXPLORE_GROUNDING_SECTION_INTRO,
    groundingChips,
    liveDetectionCopy: V0_EXPLORE_LIVE_DETECTION_COPY,
    messages: input.messages.map(mapMessage),
    emptyPrompt: EXPLORE_CHAT_EMPTY_PROMPT,
    chatLoadingCopy: "Loading conversation…",
    composerDraft: input.composerDraft,
    composerPlaceholder: EXPLORE_CHAT_PLACEHOLDER,
    isBooting: input.isBooting,
    isSending: input.isSending,
    errorMessage: input.errorMessage,
    quickPrompts: QUICK_PROMPTS,
    inspectorMovementCta:
      "Review possible model movement and confirm what is true in the inspector.",
    investigations: {
      isLoading: input.investigations?.isLoading ?? false,
      items: input.investigations?.items ?? [],
      emptyListCopy: V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST,
      emptyDetailCopy: V0_EXPLORE_INVESTIGATIONS_EMPTY_DETAIL,
      selectedId: input.investigations?.selectedId ?? null,
    },
    questions: {
      isLoading: input.questions?.isLoading ?? false,
      items: input.questions?.items ?? [],
      emptyListCopy: V0_EXPLORE_QUESTIONS_EMPTY_LIST,
      emptyDetailCopy: V0_EXPLORE_QUESTIONS_EMPTY_DETAIL,
      selectedId: input.questions?.selectedId ?? null,
      resolveYesEmptyCopy: V0_EXPLORE_QUESTIONS_RESOLVE_YES_EMPTY,
      resolveNoEmptyCopy: V0_EXPLORE_QUESTIONS_RESOLVE_NO_EMPTY,
      relatedEmptyCopy: V0_EXPLORE_QUESTIONS_RELATED_EMPTY,
    },
    fieldwork: {
      isLoading: input.fieldwork?.isLoading ?? false,
      items: input.fieldwork?.items ?? [],
      emptyListCopy: V0_EXPLORE_FIELDWORK_EMPTY_LIST,
      emptyDetailCopy: V0_EXPLORE_FIELDWORK_EMPTY_DETAIL,
      selectedId: input.fieldwork?.selectedId ?? null,
      fieldsEmptyCopy: V0_EXPLORE_FIELDWORK_FIELDS_EMPTY,
    },
  };
}
