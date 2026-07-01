import type { MapMapDataInput } from "../../orvek-adapters/map";
import {
  mapMapDataToV0Props,
  V0_MAP_CONFLICTING_EMPTY_COPY,
  V0_MAP_ONTOLOGY_RAIL_LABELS,
  V0_MAP_ONTOLOGY_RAIL_ORDER,
  V0_MAP_RELATED_EMPTY_COPY,
  type V0MapOntologyRailItem,
  type V0MapViewProps,
} from "../../orvek-adapters/map";
import { filterDefined } from "../../orvek-adapters/today";
import type { InspectorSelectableObjectType } from "../../inspector-selection";
import { summarizeMindContextEvidence } from "../../mind-context-surface";
import { PUBLIC_OBJECT_LINK_HREF_PREFIXES } from "../../public-continuity-registry";
import { formatUserMapStatus } from "../../public-intelligence-safe-slice";
import {
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
} from "../../your-map-surface";

import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

const V0_SAFE_CONTEXT_DETAIL_HREF_PREFIXES = Object.values(
  PUBLIC_OBJECT_LINK_HREF_PREFIXES
).filter((prefix) => prefix !== "/patterns");

function resolveClickableMindContextDetailHref(
  href: string | null | undefined
): string | undefined {
  if (!href) {
    return undefined;
  }

  let pathname = href;
  try {
    pathname = new URL(href, "http://mindlab.local").pathname;
  } catch {
    // Keep the raw path if it cannot be parsed as a URL.
  }

  for (const prefix of V0_SAFE_CONTEXT_DETAIL_HREF_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return pathname;
    }
  }

  return undefined;
}

function railItemToOrvekObject(
  item: V0MapOntologyRailItem,
  input: MapMapDataInput
): OrvekObject {
  let type: OrvekObject["type"] = "map-object";
  let inspectorObjectType: InspectorSelectableObjectType | undefined;
  let inspectorObjectId = item.rawId;
  const mindContextItem =
    item.kind === "mind_context"
      ? input.mindContext.items.find((entry) => entry.id === item.rawId)
      : undefined;
  const mindContextEvidence = mindContextItem
    ? summarizeMindContextEvidence(mindContextItem)
    : null;
  const listItem =
    item.kind === "conclusion"
      ? input.items.find((entry) => entry.id === item.rawId)
      : undefined;
  let summary = listItem?.summary?.trim() || mindContextItem?.title?.trim() || undefined;
  let whyItMatters: string | undefined;
  let supporting: string[] | undefined;
  let conflicting: string[] | undefined;
  let confidence: string | undefined;
  let lastUpdated: string | undefined;
  let evidenceCount: number | undefined;
  let detailHref: string | undefined;
  let missingEvidence: string[] | undefined;
  let whatWouldChange: string[] | undefined;

  if (item.kind === "model_update") {
    type = "model-update";
    inspectorObjectType = "model_update";
  } else if (item.kind === "open_question") {
    type = "active-question";
  } else if (item.kind === "mind_context") {
    type = "context";
    inspectorObjectType = "context_profile";
    inspectorObjectId = item.rawId;
    if (mindContextItem) {
      summary = mindContextItem.title;
      whyItMatters = mindContextItem.categoryLabel;
      const linkedPath = mindContextItem.detailHref?.trim() || undefined;
      supporting = [mindContextEvidence?.evidenceSummary ?? mindContextItem.categoryLabel];
      if (linkedPath) {
        supporting.push(`Linked path: ${linkedPath}`);
      }
      conflicting = mindContextEvidence?.uncertaintyLabel
        ? [mindContextEvidence.uncertaintyLabel]
        : undefined;
      confidence = mindContextEvidence?.confidenceLabel;
      detailHref = resolveClickableMindContextDetailHref(linkedPath);
      lastUpdated = mindContextItem.updatedAt;
      evidenceCount = mindContextItem.evidenceCount ?? undefined;
      missingEvidence = mindContextEvidence?.uncertaintyLabel
        ? [mindContextEvidence.uncertaintyLabel]
        : undefined;
      whatWouldChange = ["Capture correction in Capture Life Data"];
    }
  } else if (item.kind === "conclusion") {
    inspectorObjectType = "usermap_conclusion";
  }

  return {
    id: item.id,
    type,
    title: item.title,
    summary,
    recommendation: summary,
    whyItMatters,
    supporting,
    conflicting,
    confidence,
    lastUpdated,
    evidenceCount,
    detailHref,
    missingEvidence,
    whatWouldChange,
    tags: [item.statusLabel],
    inspectorObjectType,
    inspectorObjectId,
    before: item.recentlyMoved ? "Previously held understanding" : undefined,
  };
}

function buildSupportingEvidence(view: V0MapViewProps): string[] {
  return view.evidence.preview
    .map((link) => link.evidenceSummaryLabel.trim())
    .filter((label) => label.length > 0);
}

function buildConflictingEvidence(view: V0MapViewProps): string[] {
  if (!view.detail?.isDisputed) {
    return [];
  }

  return [`Marked ${formatUserMapStatus(view.detail.status).toLowerCase()} in your map.`];
}

function buildDetailOrvekObject(view: V0MapViewProps, objectId: string): OrvekObject {
  const detail = view.detail!;
  const summary = detail.summary?.trim() || undefined;
  const relatedIds = view.relatedItems.map((related) => related.id);

  return {
    id: objectId,
    type: "map-object",
    title: detail.title,
    summary,
    recommendation: summary,
    before: detail.beforeSummary ?? undefined,
    after: detail.afterSummary ?? undefined,
    supporting: buildSupportingEvidence(view),
    conflicting: buildConflictingEvidence(view),
    confidence: detail.confidenceLabel,
    lastUpdated: detail.updatedAt,
    evidenceCount: detail.evidenceCount,
    inspectorObjectType: "usermap_conclusion",
    inspectorObjectId: detail.id,
    relatedIds,
  };
}

function registerRelatedObjects(
  objects: Record<string, OrvekObject>,
  view: V0MapViewProps
): void {
  for (const related of view.relatedItems) {
    if (objects[related.id]) {
      continue;
    }

    let type: OrvekObject["type"] = "map-object";
    if (related.id.startsWith("question-")) {
      type = "active-question";
    } else if (related.id.startsWith("context-")) {
      type = "context";
    }

    objects[related.id] = {
      id: related.id,
      type,
      title: related.title,
      tags: [related.typeLabel, related.areaLabel],
    };
  }
}

function resolveMapSelectedId(
  input: MapMapDataInput,
  view: V0MapViewProps,
  objects: Record<string, OrvekObject>,
  mapCategories: { id: string; label: string; ids: string[] }[]
): string | null {
  const selectedConclusionId = view.selectedId ?? view.detail?.id ?? input.selectedId ?? null;

  if (selectedConclusionId) {
    const railId = `conclusion-${selectedConclusionId}`;
    if (objects[railId]) {
      return railId;
    }
    if (objects[selectedConclusionId]) {
      return selectedConclusionId;
    }
  }

  for (const id of mapCategories.flatMap((category) => category.ids)) {
    if (objects[id]) {
      return id;
    }
  }

  return null;
}

export function buildMapProductionDataApi(input: MapMapDataInput): OrvekDataApi {
  const view = mapMapDataToV0Props(input);
  const objects: Record<string, OrvekObject> = {};

  for (const group of view.ontologyGroups) {
    for (const item of group.items) {
      const object = railItemToOrvekObject(item, input);
      objects[item.id] = object;
      if (item.kind === "mind_context") {
        objects[item.rawId] = {
          ...object,
          id: item.rawId,
        };
      }
    }
  }

  if (view.detail) {
    const railId = `conclusion-${view.detail.id}`;
    const selectedId = view.selectedId ?? railId;
    const detailObject = buildDetailOrvekObject(view, selectedId);

    objects[selectedId] = detailObject;
    objects[railId] = {
      ...detailObject,
      id: railId,
    };

    registerRelatedObjects(objects, view);
  }

  const mapCategories = V0_MAP_ONTOLOGY_RAIL_ORDER.map((key) => {
    const group = view.ontologyGroups.find((entry) => entry.key === key);
    return {
      id: key,
      label: V0_MAP_ONTOLOGY_RAIL_LABELS[key],
      ids: group?.items.map((item) => item.id) ?? [],
    };
  });

  const mapHasContent = mapCategories.some((category) => category.ids.length > 0);
  const mapSelectedId = resolveMapSelectedId(input, view, objects, mapCategories);

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      filterDefined((ids ?? []).map((id) => (id ? objects[id] : undefined))),
    mapCategories,
    mapSelectedId,
    mapIsLoading: input.isLoading,
    mapLoadError: input.loadError,
    mapHasContent,
    mapHeader:
      input.isLoading || input.loadError
        ? null
        : view.headerStats
          ? {
              confidenceLabel: view.headerStats.confidenceLabel,
              receiptsLabel: String(view.headerStats.receipts),
              openQuestionsLabel: String(view.openQuestionsCount),
            }
          : {
              confidenceLabel: "—",
              receiptsLabel: "0",
              openQuestionsLabel: String(input.openQuestionsCount),
            },
    emptyCopyBySlot: {
      mapEmpty: view.emptyPrimary,
      mapSelectPrompt: view.selectPromptCopy,
      mapCurrentUnderstandingEmpty: "No current understanding summary is recorded yet.",
      mapWhyEmpty: YOUR_MAP_EVIDENCE_BREADTH_INTRO,
      mapSupportingEmpty: view.evidence.supportingEmptyCopy,
      mapConflictingEmpty: view.evidence.conflictingEmptyCopy,
      mapRelatedEmpty: view.relatedEmptyCopy || V0_MAP_RELATED_EMPTY_COPY,
    },
  });
}

export function mergeMapDetailIntoApi(
  api: OrvekDataApi,
  input: MapMapDataInput
): OrvekDataApi {
  return buildMapProductionDataApi(input);
}
