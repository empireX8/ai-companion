import type { InspectorEvidenceLinkItem } from "../inspector-object-api";
import {
  MIND_CONTEXT_EMPTY_PRIMARY,
  MIND_CONTEXT_GOVERNANCE_HREF,
  MIND_CONTEXT_SECTION_LABEL,
  type MindContextDisplayItem,
} from "../mind-context-surface";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "../public-continuity-registry";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
  type UserMapConclusionPublicApiListItem,
} from "../public-intelligence-safe-slice";
import {
  formatMapPreviewDateTime,
  MAP_MOVEMENT_EMPTY_COPY,
  MAP_MOVEMENT_SECTION_INTRO,
  MAP_MOVEMENT_SECTION_LABEL,
  MAP_MOVEMENT_VIEW_ALL_HREF,
  MAP_OPEN_QUESTIONS_EMPTY_COPY,
  MAP_OPEN_QUESTIONS_SECTION_INTRO,
  MAP_OPEN_QUESTIONS_SECTION_LABEL,
  MAP_OPEN_QUESTIONS_VIEW_ALL_HREF,
  toMapMovementRowTitle,
  type MapMovementPreviewItem,
  type MapOpenQuestionPreviewItem,
} from "../your-map-preview-surface";
import {
  formatYourMapDateTime,
  groupUserMapConclusionsByStatus,
  summarizeCentreEvidence,
  YOUR_MAP_CORRECTION_DEFERRED_COPY,
  YOUR_MAP_EMPTY_PRIMARY,
  YOUR_MAP_EMPTY_SECONDARY,
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
  YOUR_MAP_INSPECTOR_EVIDENCE_HINT,
  type YourMapRailGroupKey,
} from "../your-map-surface";

export type { YourMapRailGroupKey };

export type V0MapRailItem = {
  id: string;
  title: string;
  recentlyMoved: boolean;
};

export type V0MapRailGroup = {
  key: YourMapRailGroupKey;
  label: string;
  items: V0MapRailItem[];
};

export type V0MapHeaderStats = {
  conclusions: number;
  receipts: number;
  evolving: number;
  confidenceLabel: string;
};

export type V0MapMindContextChip = {
  id: string;
  title: string;
  inspectorObjectId: string | null;
};

export type V0MapMindContext = {
  isLoading: boolean;
  sectionLabel: string;
  emptyPrimary: string;
  governanceHref: string;
  items: V0MapMindContextChip[];
  summaryCounts: { memories: number; patterns: number };
  memoriesLabel: string | null;
  patternsLabel: string | null;
};

export type V0MapMovementRow = {
  id: string;
  updateTypeLabel: string;
  title: string;
  summary: string;
  meta: string;
};

export type V0MapOpenQuestionRow = {
  id: string;
  title: string;
  organizingQuestion: string;
  meta: string;
};

export type V0MapEvidenceLink = {
  key: string;
  href: string;
  evidenceSummaryLabel: string;
  sourceTypeLabel: string;
};

export type V0MapRelatedItem = {
  id: string;
  title: string;
  areaLabel: string;
};

export type V0MapDetailSlot = {
  id: string;
  areaLabel: string;
  updatedAt: string;
  title: string;
  summary: string | null;
  evidenceCount: number;
  sourceDiversity: number;
  timeSpreadDays: number;
  status: UserMapConclusionPublicApiDetailItem["status"];
  confidenceLabel: string;
  statusLabel: string;
  showBeforeAfter: boolean;
  beforeSummary: string | null;
  afterSummary: string | null;
  isDisputed: boolean;
};

export type V0MapViewProps = {
  isLoading: boolean;
  loadError: string | null;
  emptyPrimary: string;
  emptySecondary: string;
  showPreviewBands: boolean;
  groups: V0MapRailGroup[];
  selectedId: string | null;
  isDetailLoading: boolean;
  detail: V0MapDetailSlot | null;
  selectPromptCopy: string;
  detailUnavailableCopy: string;
  evidence: {
    preview: V0MapEvidenceLink[];
    hasMore: boolean;
    fallbackCopy: string;
    breadthIntro: string;
    inspectorHint: string;
  };
  headerStats: V0MapHeaderStats | null;
  openQuestionsCount: number;
  mindContext: V0MapMindContext;
  movementPreview: {
    isLoading: boolean;
    items: V0MapMovementRow[];
    sectionLabel: string;
    sectionIntro: string;
    viewAllHref: string;
    emptyCopy: string;
  };
  openQuestionsPreview: {
    isLoading: boolean;
    items: V0MapOpenQuestionRow[];
    sectionLabel: string;
    sectionIntro: string;
    viewAllHref: string;
    emptyCopy: string;
  };
  relatedItems: V0MapRelatedItem[];
  correctionDeferredCopy: string;
};

export type MapMapDataInput = {
  items: UserMapConclusionPublicApiListItem[];
  isLoading: boolean;
  loadError: string | null;
  selectedId: string | null;
  detail: UserMapConclusionPublicApiDetailItem | null;
  isDetailLoading: boolean;
  evidence: InspectorEvidenceLinkItem[];
  openQuestionsCount: number;
  mindContext: {
    isLoading: boolean;
    items: MindContextDisplayItem[];
    summaryCounts: { memories: number; patterns: number };
  };
  movementPreview: {
    isLoading: boolean;
    items: MapMovementPreviewItem[];
  };
  openQuestionsPreview: {
    isLoading: boolean;
    items: MapOpenQuestionPreviewItem[];
  };
};

function buildHeaderStats(items: UserMapConclusionPublicApiListItem[]): V0MapHeaderStats {
  const totalReceipts = items.reduce((sum, item) => sum + item.evidenceCount, 0);
  const evolvingCount = items.filter(
    (item) =>
      item.status === "emerging" ||
      item.status === "tentative" ||
      item.status === "hypothesis" ||
      item.status === "disputed"
  ).length;
  const hasConflicting = items.some((item) => item.status === "disputed");
  const confidenceLabel =
    items.length === 0
      ? "—"
      : hasConflicting
        ? "mixed / evolving"
        : evolvingCount > 0
          ? "evolving"
          : "settling";

  return {
    conclusions: items.length,
    receipts: totalReceipts,
    evolving: evolvingCount,
    confidenceLabel,
  };
}

function buildRelatedItems(
  items: UserMapConclusionPublicApiListItem[],
  selectedListItem: UserMapConclusionPublicApiListItem | undefined
): V0MapRelatedItem[] {
  if (!selectedListItem) {
    return [];
  }

  return items
    .filter(
      (item) =>
        item.id !== selectedListItem.id &&
        (item.area === selectedListItem.area || item.status === selectedListItem.status)
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title,
      areaLabel: formatUserMapArea(item.area),
    }));
}

function mapDetailSlot(
  detail: UserMapConclusionPublicApiDetailItem,
  selectedListItem: UserMapConclusionPublicApiListItem | undefined
): V0MapDetailSlot {
  return {
    id: detail.id,
    areaLabel: formatUserMapArea(detail.area),
    updatedAt: formatYourMapDateTime(detail.updatedAt),
    title: detail.title,
    summary: detail.summary,
    evidenceCount: detail.evidenceCount,
    sourceDiversity: detail.sourceDiversity,
    timeSpreadDays: detail.timeSpreadDays,
    status: detail.status,
    confidenceLabel: formatUserMapConfidenceLevel(detail.confidenceLevel),
    statusLabel: formatUserMapStatus(detail.status),
    showBeforeAfter: detail.status === "superseded",
    beforeSummary: selectedListItem?.summary ?? null,
    afterSummary: detail.summary,
    isDisputed: detail.status === "disputed",
  };
}

function formatMindContextCounts(summaryCounts: { memories: number; patterns: number }): {
  memoriesLabel: string | null;
  patternsLabel: string | null;
} {
  const { memories, patterns } = summaryCounts;
  return {
    memoriesLabel:
      memories > 0 ? `${memories} memor${memories === 1 ? "y" : "ies"}` : null,
    patternsLabel:
      patterns > 0 ? `${patterns} active pattern${patterns === 1 ? "" : "s"}` : null,
  };
}

export function mapMapDataToV0Props(input: MapMapDataInput): V0MapViewProps {
  const { items, evidence, selectedId, detail, mindContext } = input;
  const groups = groupUserMapConclusionsByStatus(items).map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.map((item) => ({
      id: item.id,
      title: item.title,
      recentlyMoved:
        item.status === "emerging" ||
        item.status === "superseded" ||
        item.status === "disputed",
    })),
  }));

  const selectedListItem = items.find((entry) => entry.id === selectedId);
  const { preview, hasMore } = summarizeCentreEvidence(evidence);
  const countLabels = formatMindContextCounts(mindContext.summaryCounts);
  const hasItems = items.length > 0;
  const showMainContent = !input.isLoading && !input.loadError && hasItems;

  return {
    isLoading: input.isLoading,
    loadError: input.loadError,
    emptyPrimary: YOUR_MAP_EMPTY_PRIMARY,
    emptySecondary: YOUR_MAP_EMPTY_SECONDARY,
    showPreviewBands: showMainContent,
    groups,
    selectedId,
    isDetailLoading: input.isDetailLoading,
    detail: detail ? mapDetailSlot(detail, selectedListItem) : null,
    selectPromptCopy:
      "Select a conclusion from the list to inspect current understanding and evidence.",
    detailUnavailableCopy: "This conclusion is not available through the public projection.",
    evidence: {
      preview: preview.map((link) => ({
        key: `${link.sourceObjectHref}-${link.createdAt}`,
        href: link.sourceObjectHref,
        evidenceSummaryLabel: link.evidenceSummaryLabel,
        sourceTypeLabel: link.sourceTypeLabel,
      })),
      hasMore,
      fallbackCopy: PUBLIC_EVIDENCE_FALLBACK_COPY,
      breadthIntro: YOUR_MAP_EVIDENCE_BREADTH_INTRO,
      inspectorHint: YOUR_MAP_INSPECTOR_EVIDENCE_HINT,
    },
    headerStats: showMainContent ? buildHeaderStats(items) : null,
    openQuestionsCount: input.openQuestionsCount,
    mindContext: {
      isLoading: mindContext.isLoading,
      sectionLabel: MIND_CONTEXT_SECTION_LABEL,
      emptyPrimary: MIND_CONTEXT_EMPTY_PRIMARY,
      governanceHref: MIND_CONTEXT_GOVERNANCE_HREF,
      items: mindContext.items.map((item) => ({
        id: item.id,
        title: item.title,
        inspectorObjectId: item.inspectorObjectId,
      })),
      summaryCounts: mindContext.summaryCounts,
      ...countLabels,
    },
    movementPreview: {
      isLoading: input.movementPreview.isLoading,
      items: input.movementPreview.items.map((item) => ({
        id: item.id,
        updateTypeLabel: item.updateTypeLabel,
        title: toMapMovementRowTitle(item),
        summary: item.userFacingSummary,
        meta: `${item.affectedObjectTypeLabel} · Recorded ${formatMapPreviewDateTime(item.createdAt)}`,
      })),
      sectionLabel: MAP_MOVEMENT_SECTION_LABEL,
      sectionIntro: MAP_MOVEMENT_SECTION_INTRO,
      viewAllHref: MAP_MOVEMENT_VIEW_ALL_HREF,
      emptyCopy: MAP_MOVEMENT_EMPTY_COPY,
    },
    openQuestionsPreview: {
      isLoading: input.openQuestionsPreview.isLoading,
      items: input.openQuestionsPreview.items.map((item) => ({
        id: item.id,
        title: item.title,
        organizingQuestion: item.organizingQuestion,
        meta: `${item.statusLabel} · Updated ${formatMapPreviewDateTime(item.updatedAt)}`,
      })),
      sectionLabel: MAP_OPEN_QUESTIONS_SECTION_LABEL,
      sectionIntro: MAP_OPEN_QUESTIONS_SECTION_INTRO,
      viewAllHref: MAP_OPEN_QUESTIONS_VIEW_ALL_HREF,
      emptyCopy: MAP_OPEN_QUESTIONS_EMPTY_COPY,
    },
    relatedItems: buildRelatedItems(items, selectedListItem),
    correctionDeferredCopy: YOUR_MAP_CORRECTION_DEFERRED_COPY,
  };
}
