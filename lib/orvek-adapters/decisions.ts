import type { ActionBucket, ActionStatus, SurfacedActionView } from "../actions-api";
import {
  DECISIONS_BUILD_TAB_LABEL,
  DECISIONS_EMPTY_COPY,
  DECISIONS_ERROR_COPY,
  DECISIONS_LOADING_COPY,
  DECISIONS_PAGE_INTRO,
  DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
  DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL,
  DECISIONS_SEND_TO_FIELDWORK_LABEL,
  DECISIONS_STABILIZE_TAB_LABEL,
  formatDecisionDateTime,
  getDecisionTabIntro,
  groupDecisionsByResolution,
  toDecisionStatusLabel,
} from "../decisions-surface";
import { buildExploreActionHandoffHref } from "../explore-action-handoff";
import { buildPublicReceiptHref } from "../public-continuity-registry";

export type V0DecisionSidebarItem = {
  id: string;
  title: string;
  status: ActionStatus;
  showActiveDot: boolean;
};

export type V0DecisionSidebarGroup = {
  heading: string;
  tone?: "action";
  items: V0DecisionSidebarItem[];
};

export type V0DecisionWorkspace = {
  id: string;
  title: string;
  whySuggested: string;
  status: ActionStatus;
  statusLabel: string;
  updatedAtLabel: string;
  note: string | null;
  linkedClaimId: string | null;
  linkedClaimSummary: string | null;
  linkedGoalStatement: string | null;
  linkedSourceLabel: string;
  effort: string;
  reflectHref: string | null;
  receiptHref: string | null;
  receiptQuote: string;
  showConstraints: boolean;
  showFieldwork: boolean;
  fieldworkLabel: string;
  fieldworkLoadingLabel: string;
  fieldworkError: string | null;
};

export type V0DecisionsViewProps = {
  pageIntro: string;
  tabIntro: string;
  tab: ActionBucket;
  stabilizeTabLabel: string;
  buildTabLabel: string;
  isLoading: boolean;
  loadingCopy: string;
  errorMessage: string | null;
  emptyCopy: string;
  headerStats: { openCount: number; reviewedCount: number } | null;
  sidebarGroups: V0DecisionSidebarGroup[];
  selectedDecisionId: string | null;
  stageIndex: number;
  decision: V0DecisionWorkspace | null;
  showWorkspace: boolean;
};

function deriveStageIndex(action: SurfacedActionView): number {
  if (action.status === "helped" || action.status === "didnt_help") {
    return 4;
  }
  if (action.status === "done") {
    return 3;
  }
  return 0;
}

function mapWorkspace(
  decision: SurfacedActionView,
  createErrorByActionId: Record<string, string>
): V0DecisionWorkspace {
  const reflectHref = buildExploreActionHandoffHref(decision.id);
  const receiptHref = buildPublicReceiptHref({
    namespace: "receipt-pattern",
    id: decision.linkedClaimId,
  });

  return {
    id: decision.id,
    title: decision.title,
    whySuggested: decision.whySuggested,
    status: decision.status,
    statusLabel: toDecisionStatusLabel(decision.status),
    updatedAtLabel: formatDecisionDateTime(decision.updatedAt),
    note: decision.note,
    linkedClaimId: decision.linkedClaimId,
    linkedClaimSummary: decision.linkedClaimSummary,
    linkedGoalStatement: decision.linkedGoalStatement,
    linkedSourceLabel: decision.linkedSourceLabel,
    effort: decision.effort,
    reflectHref,
    receiptHref,
    receiptQuote: decision.linkedClaimSummary ?? decision.title,
    showConstraints: Boolean(
      decision.linkedClaimSummary ||
        decision.linkedGoalStatement ||
        decision.linkedSourceLabel
    ),
    showFieldwork: decision.status === "not_started" && !decision.note,
    fieldworkLabel: DECISIONS_SEND_TO_FIELDWORK_LABEL,
    fieldworkLoadingLabel: DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL,
    fieldworkError: createErrorByActionId[decision.id] ?? null,
  };
}

export type MapDecisionsDataInput = {
  tab: ActionBucket;
  list: SurfacedActionView[];
  selectedDecisionId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  createErrorByActionId: Record<string, string>;
};

export function mapDecisionsDataToV0Props(input: MapDecisionsDataInput): V0DecisionsViewProps {
  const {
    tab,
    list,
    selectedDecisionId,
    isLoading,
    errorMessage,
    createErrorByActionId,
  } = input;

  const openCount = list.filter((item) => item.status === "not_started").length;
  const reviewedCount = list.filter(
    (item) =>
      item.status === "done" || item.status === "helped" || item.status === "didnt_help"
  ).length;

  const sidebarGroups: V0DecisionSidebarGroup[] = groupDecisionsByResolution(list).map(
    (group) => ({
      heading: group.key === "open" ? "Active" : "Reviewed",
      tone: group.key === "open" ? undefined : undefined,
      items: group.items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        showActiveDot: group.key === "open",
      })),
    })
  );

  const selected = list.find((item) => item.id === selectedDecisionId) ?? null;

  return {
    pageIntro: DECISIONS_PAGE_INTRO,
    tabIntro: getDecisionTabIntro(tab),
    tab,
    stabilizeTabLabel: DECISIONS_STABILIZE_TAB_LABEL,
    buildTabLabel: DECISIONS_BUILD_TAB_LABEL,
    isLoading,
    loadingCopy: DECISIONS_LOADING_COPY,
    errorMessage,
    emptyCopy: DECISIONS_EMPTY_COPY,
    headerStats:
      !isLoading && list.length > 0 ? { openCount, reviewedCount } : null,
    sidebarGroups,
    selectedDecisionId,
    stageIndex: selected ? deriveStageIndex(selected) : 0,
    decision: selected ? mapWorkspace(selected, createErrorByActionId) : null,
    showWorkspace: !isLoading && !errorMessage && list.length > 0,
  };
}
