import type { ExploreActionHandoffContext } from "../explore-action-handoff";
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

export type V0ExplorePlaceholderTabCopy = {
  investigations: string;
  questions: string;
  fieldwork: string;
};

export type V0ExploreViewProps = {
  pageTitle: string;
  pageIntro: string;
  tabs: V0ExploreTab[];
  activeTab: V0ExploreTabId;
  handoff: V0ExploreHandoffSlot;
  groundingSectionLabel: string;
  groundingSectionIntro: string;
  messages: V0ExploreMessage[];
  emptyPrompt: string;
  chatLoadingCopy: string;
  composerDraft: string;
  composerPlaceholder: string;
  isBooting: boolean;
  isSending: boolean;
  errorMessage: string | null;
  quickPrompts: readonly string[];
  placeholderTabs: V0ExplorePlaceholderTabCopy;
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

const PLACEHOLDER_SUFFIX =
  "will appear here when linked threads and fieldwork are available in this surface.";

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

export function mapExploreDataToV0Props(input: MapExploreDataInput): V0ExploreViewProps {
  return {
    pageTitle: EXPLORE_PAGE_TITLE,
    pageIntro: EXPLORE_PAGE_INTRO,
    tabs: EXPLORE_TABS,
    activeTab: input.activeTab,
    handoff: mapHandoff(input),
    groundingSectionLabel: EXPLORE_GROUNDING_SECTION_LABEL,
    groundingSectionIntro: EXPLORE_GROUNDING_SECTION_INTRO,
    messages: input.messages.map(mapMessage),
    emptyPrompt: EXPLORE_CHAT_EMPTY_PROMPT,
    chatLoadingCopy: "Loading conversation…",
    composerDraft: input.composerDraft,
    composerPlaceholder: EXPLORE_CHAT_PLACEHOLDER,
    isBooting: input.isBooting,
    isSending: input.isSending,
    errorMessage: input.errorMessage,
    quickPrompts: QUICK_PROMPTS,
    placeholderTabs: {
      investigations: `Investigations ${PLACEHOLDER_SUFFIX}`,
      questions: `Active questions ${PLACEHOLDER_SUFFIX}`,
      fieldwork: `Fieldwork bridge ${PLACEHOLDER_SUFFIX}`,
    },
  };
}
