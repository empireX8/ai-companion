import type { MapMapDataInput } from "@/lib/orvek-adapters/map";
import {
  mapMapDataToV0Props,
  V0_MAP_ONTOLOGY_RAIL_LABELS,
  V0_MAP_ONTOLOGY_RAIL_ORDER,
  type V0MapOntologyRailItem,
} from "@/lib/orvek-adapters/map";
import type { InspectorSelectableObjectType } from "@/lib/inspector-selection";
import {
  V0_MAP_CONFLICTING_EMPTY_COPY,
  V0_MAP_RELATED_EMPTY_COPY,
} from "@/lib/orvek-adapters/map";

import type { OrvekDataApi } from "../data-provider";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

function railItemToOrvekObject(item: V0MapOntologyRailItem): OrvekObject {
  let type: OrvekObject["type"] = "map-object";
  let inspectorObjectType: InspectorSelectableObjectType | undefined;
  let inspectorObjectId = item.rawId;

  if (item.kind === "model_update") {
    type = "model-update";
    inspectorObjectType = "model_update";
  } else if (item.kind === "open_question") {
    type = "active-question";
  } else if (item.kind === "mind_context") {
    type = "context";
    if (item.inspectorObjectId) {
      inspectorObjectType = "pattern_claim";
      inspectorObjectId = item.inspectorObjectId;
    }
  } else if (item.kind === "conclusion") {
    inspectorObjectType = "usermap_conclusion";
  }

  return {
    id: item.id,
    type,
    title: item.title,
    tags: [item.statusLabel],
    inspectorObjectType,
    inspectorObjectId,
    before: item.recentlyMoved ? "Previously held understanding" : undefined,
  };
}

export function buildMapProductionDataApi(input: MapMapDataInput): OrvekDataApi {
  const view = mapMapDataToV0Props(input);
  const objects: Record<string, OrvekObject> = {};

  for (const group of view.ontologyGroups) {
    for (const item of group.items) {
      objects[item.id] = railItemToOrvekObject(item);
    }
  }

  if (view.detail) {
    const detailKey = view.selectedId ?? `conclusion-${view.detail.id}`;
    objects[detailKey] = {
      id: detailKey,
      type: "map-object",
      title: view.detail.title,
      summary: view.detail.summary ?? undefined,
      recommendation: view.detail.summary ?? undefined,
      before: view.detail.beforeSummary ?? undefined,
      after: view.detail.afterSummary ?? undefined,
      supporting: view.evidence.preview.map((link) => link.evidenceSummaryLabel),
      conflicting: [],
      confidence: view.detail.confidenceLabel,
      lastUpdated: view.detail.updatedAt,
      evidenceCount: view.detail.evidenceCount,
      inspectorObjectType: "usermap_conclusion",
      inspectorObjectId: view.detail.id,
      relatedIds: view.relatedItems.map((related) => related.id),
    };

    for (const related of view.relatedItems) {
      if (!objects[related.id]) {
        objects[related.id] = {
          id: related.id,
          type: "map-object",
          title: related.title,
          tags: [related.typeLabel, related.areaLabel],
        };
      }
    }
  }

  const mapCategories = V0_MAP_ONTOLOGY_RAIL_ORDER.map((key) => {
    const group = view.ontologyGroups.find((entry) => entry.key === key);
    return {
      id: key,
      label: V0_MAP_ONTOLOGY_RAIL_LABELS[key],
      ids: group?.items.map((item) => item.id) ?? [],
    };
  });

  const selectedId =
    view.selectedId ??
    mapCategories.flatMap((category) => category.ids)[0] ??
    null;

  return {
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    mapCategories,
    mapSelectedId: selectedId,
    mapHeader: view.headerStats
      ? {
          confidenceLabel: view.headerStats.confidenceLabel,
          receiptsLabel: String(view.headerStats.receipts),
          openQuestionsLabel: String(view.openQuestionsCount),
        }
      : null,
    emptyCopyBySlot: {
      mapEmpty: view.emptyPrimary,
      mapSupportingEmpty: view.evidence.supportingEmptyCopy,
      mapConflictingEmpty: view.evidence.conflictingEmptyCopy,
      mapRelatedEmpty: view.relatedEmptyCopy || V0_MAP_RELATED_EMPTY_COPY,
    },
  };
}

export function mergeMapDetailIntoApi(
  api: OrvekDataApi,
  input: MapMapDataInput
): OrvekDataApi {
  return buildMapProductionDataApi(input);
}