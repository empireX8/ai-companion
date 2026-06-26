import type { UserMapConclusionPublicApiListItem } from "../public-intelligence-safe-slice";
import type { InspectorEvidenceLinkItem } from "../inspector-object-api";
import {
  MIND_CONTEXT_SECTION_LABEL,
  type MindContextDisplayItem,
} from "../mind-context-surface";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "../public-continuity-registry";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
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
  summarizeCentreEvidence,
  YOUR_MAP_CORRECTION_DEFERRED_COPY,
  YOUR_MAP_EMPTY_PRIMARY,
  YOUR_MAP_EMPTY_SECONDARY,
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
  YOUR_MAP_INSPECTOR_EVIDENCE_HINT,
} from "../your-map-surface";

export const V0_MAP_CORRECTION_CHIP_LABELS = [
  "Not quite",
  "Missing evidence",
  "Too strong",
  "Outdated",
  "Wrong link",
  "Needs review",
] as const;

export const V0_MAP_CONFLICTING_EMPTY_COPY =
  "No conflicting signal is linked to this object yet.";
export const V0_MAP_RELATED_EMPTY_COPY =
  "No related objects are linked in this projection yet.";

export type V0MapOntologyRailKey =
  | "patterns"
  | "claims"
  | "conflicts"
  | "goals"
  | "context"
  | "questions"
  | "model_updates"
  | "uncertainty";

export type V0MapOntologyRailItemKind =
  | "conclusion"
  | "mind_context"
  | "open_question"
  | "model_update";

export type V0MapOntologyRailItem = {
  id: string;
  rawId: string;
  title: string;
  statusLabel: string;
  recentlyMoved: boolean;
  kind: V0MapOntologyRailItemKind;
  inspectorObjectId: string | null;
};

export type V0MapOntologyRailGroup = {
  key: V0MapOntologyRailKey;
  label: string;
  items: V0MapOntologyRailItem[];
};

export const V0_MAP_ONTOLOGY_RAIL_ORDER: V0MapOntologyRailKey[] = [
  "patterns",
  "claims",
  "conflicts",
  "goals",
  "context",
  "questions",
  "model_updates",
  "uncertainty",
];

export const V0_MAP_ONTOLOGY_RAIL_LABELS: Record<V0MapOntologyRailKey, string> = {
  patterns: "Patterns",
  claims: "Claims",
  conflicts: "Active conflicts",
  goals: "Goals / directions",
  context: "Background / Context",
  questions: "Active questions",
  model_updates: "Model updates",
  uncertainty: "Uncertainty",
};

export type V0MapHeaderStats = {
  conclusions: number;
  receipts: number;
  evolving: number;
  confidenceLabel: string;
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
  typeLabel: string;
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

export type V0MapViewProps = {
  isLoading: boolean;
  loadError: string | null;
  emptyPrimary: string;
  emptySecondary: string;
  showSecondaryPanels: boolean;
  ontologyGroups: V0MapOntologyRailGroup[];
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
    supportingEmptyCopy: string;
    conflictingEmptyCopy: string;
  };
  headerStats: V0MapHeaderStats | null;
  openQuestionsCount: number;
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
  relatedEmptyCopy: string;
  correctionChipLabels: readonly string[];
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

function resolveConclusionOntology(
  item: UserMapConclusionPublicApiListItem
): V0MapOntologyRailKey {
  if (item.status === "disputed") {
    return "conflicts";
  }
  if (item.status === "superseded") {
    return "uncertainty";
  }
  if (
    item.area === "developmental_vector" ||
    item.area === "current_frontier" ||
    item.area === "meaning_system"
  ) {
    return "goals";
  }
  if (item.area === "relational_field" || item.area === "recovery_architecture") {
    return "context";
  }
  if (
    item.status === "hypothesis" ||
    item.status === "tentative" ||
    item.status === "emerging"
  ) {
    return "patterns";
  }
  return "claims";
}

function isRecentlyMoved(item: UserMapConclusionPublicApiListItem): boolean {
  return (
    item.status === "emerging" || item.status === "superseded" || item.status === "disputed"
  );
}

function buildOntologyRailGroups(input: MapMapDataInput): V0MapOntologyRailGroup[] {
  const buckets = new Map<V0MapOntologyRailKey, V0MapOntologyRailItem[]>(
    V0_MAP_ONTOLOGY_RAIL_ORDER.map((key) => [key, []])
  );
  const seen = new Set<string>();

  const push = (key: V0MapOntologyRailKey, item: V0MapOntologyRailItem) => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    buckets.get(key)!.push(item);
  };

  for (const item of input.items) {
    push(resolveConclusionOntology(item), {
      id: `conclusion-${item.id}`,
      rawId: item.id,
      title: item.title,
      statusLabel: formatUserMapStatus(item.status),
      recentlyMoved: isRecentlyMoved(item),
      kind: "conclusion",
      inspectorObjectId: null,
    });
  }

  for (const item of input.mindContext.items) {
    push("context", {
      id: `context-${item.id}`,
      rawId: item.id,
      title: item.title,
      statusLabel: MIND_CONTEXT_SECTION_LABEL,
      recentlyMoved: false,
      kind: "mind_context",
      inspectorObjectId: item.inspectorObjectId,
    });
  }

  for (const item of input.openQuestionsPreview.items) {
    push("questions", {
      id: `question-${item.id}`,
      rawId: item.id,
      title: item.title,
      statusLabel: item.statusLabel,
      recentlyMoved: false,
      kind: "open_question",
      inspectorObjectId: null,
    });
  }

  for (const item of input.movementPreview.items) {
    push("model_updates", {
      id: `movement-${item.id}`,
      rawId: item.id,
      title: toMapMovementRowTitle(item),
      statusLabel: item.updateTypeLabel,
      recentlyMoved: true,
      kind: "model_update",
      inspectorObjectId: null,
    });
  }

  return V0_MAP_ONTOLOGY_RAIL_ORDER.map((key) => ({
    key,
    label: V0_MAP_ONTOLOGY_RAIL_LABELS[key],
    items: buckets.get(key) ?? [],
  }));
}

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

function buildRelatedItems(input: MapMapDataInput): V0MapRelatedItem[] {
  const selectedListItem = input.items.find((entry) => entry.id === input.selectedId);
  if (!selectedListItem) {
    return [];
  }

  const related: V0MapRelatedItem[] = [];

  for (const item of input.items.filter(
    (entry) =>
      entry.id !== selectedListItem.id &&
      (entry.area === selectedListItem.area || entry.status === selectedListItem.status)
  )) {
    related.push({
      id: `conclusion-${item.id}`,
      title: item.title,
      areaLabel: formatUserMapArea(item.area),
      typeLabel: formatUserMapStatus(item.status),
    });
  }

  for (const item of input.openQuestionsPreview.items.slice(0, 2)) {
    related.push({
      id: `question-${item.id}`,
      title: item.title,
      areaLabel: "Active question",
      typeLabel: item.statusLabel,
    });
  }

  for (const item of input.mindContext.items.slice(0, 1)) {
    related.push({
      id: `context-${item.id}`,
      title: item.title,
      areaLabel: MIND_CONTEXT_SECTION_LABEL,
      typeLabel: "Context",
    });
  }

  return related.slice(0, 4);
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

export function mapMapDataToV0Props(input: MapMapDataInput): V0MapViewProps {
  const { items, evidence, selectedId, detail } = input;
  const ontologyGroups = buildOntologyRailGroups(input);
  const selectedListItem = items.find((entry) => entry.id === selectedId);
  const { preview, hasMore } = summarizeCentreEvidence(evidence);
  const ontologyItemCount = ontologyGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const hasItems = ontologyItemCount > 0;
  const showMainContent = !input.isLoading && !input.loadError && hasItems;

  return {
    isLoading: input.isLoading,
    loadError: input.loadError,
    emptyPrimary: YOUR_MAP_EMPTY_PRIMARY,
    emptySecondary: YOUR_MAP_EMPTY_SECONDARY,
    showSecondaryPanels: showMainContent,
    ontologyGroups,
    selectedId,
    isDetailLoading: input.isDetailLoading,
    detail: detail ? mapDetailSlot(detail, selectedListItem) : null,
    selectPromptCopy:
      "Select an object from the model workspace to inspect current understanding and evidence.",
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
      supportingEmptyCopy: PUBLIC_EVIDENCE_FALLBACK_COPY,
      conflictingEmptyCopy: V0_MAP_CONFLICTING_EMPTY_COPY,
    },
    headerStats:
      !input.isLoading && !input.loadError && items.length > 0
        ? buildHeaderStats(items)
        : null,
    openQuestionsCount: input.openQuestionsCount,
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
    relatedItems: buildRelatedItems(input),
    relatedEmptyCopy: V0_MAP_RELATED_EMPTY_COPY,
    correctionChipLabels: V0_MAP_CORRECTION_CHIP_LABELS,
    correctionDeferredCopy: YOUR_MAP_CORRECTION_DEFERRED_COPY,
  };
}
