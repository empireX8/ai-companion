import {
  TIMELINE_SEMANTIC_FILTERS,
} from "../../timeline-semantic-layers";
import { mapTimelineDataToV0Props } from "../../orvek-adapters/timeline";
import type { MapTimelineDataInput } from "../../orvek-adapters/timeline";
import {
  buildMovementReportOrvekObject,
  enrichOrvekObjectWithMovementDepth,
  type ModelMovementDepthById,
} from "../../model-movement-report-contract";
import type { OrvekDataApi, OrvekTimelineGroup } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";
import { normalizeTimelineProductionDataApi } from "./timeline-presentation";

const TIMELINE_SHELL_GROUP_HEADINGS = [
  "Today",
  "This week",
  "Last week",
  "Earlier",
  "Imported history",
] as const;

export function buildTimelineProductionDataApi(input: MapTimelineDataInput): OrvekDataApi {
  const view = mapTimelineDataToV0Props(input);
  const objects: Record<string, OrvekObject> = {};
  const movementDepthById: ModelMovementDepthById = input.movementDepthById ?? {};

  for (const group of view.groups) {
    for (const row of group.rows) {
      const dateLabel =
        row.time && row.date ? `${row.date} · ${row.time}` : row.date ?? undefined;

      const inspectorObjectId = row.inspectorTarget?.objectId;
      const movementDepth =
        row.isModelChange && inspectorObjectId
          ? movementDepthById[inspectorObjectId]
          : movementDepthById[row.selectableObjectId ?? ""];

      const base: OrvekObject = {
        id: row.id,
        type: "timeline-event",
        title: row.title,
        summary: row.summary ?? undefined,
        eventType: row.eventLabel,
        date: dateLabel,
        lastUpdated: dateLabel,
        before: row.beforeSummary ?? undefined,
        after: row.afterSummary ?? undefined,
        tags: [row.eventLabel],
        inspectorObjectType: row.inspectorTarget?.objectType,
        inspectorObjectId: row.inspectorTarget?.objectId,
      };

      objects[row.id] = movementDepth
        ? enrichOrvekObjectWithMovementDepth(base, movementDepth)
        : base;

      if (inspectorObjectId && inspectorObjectId !== row.id) {
        const movementObject: OrvekObject = {
          ...objects[row.id],
          id: inspectorObjectId,
          type: "model-update",
          inspectorObjectType: "model_update",
          inspectorObjectId,
        };
        objects[inspectorObjectId] = movementDepth
          ? enrichOrvekObjectWithMovementDepth(movementObject, movementDepth)
          : movementObject;
      }
    }
  }

  for (const depth of Object.values(movementDepthById)) {
    const reportObject = buildMovementReportOrvekObject(depth);
    if (reportObject) {
      objects[depth.id] = {
        ...(objects[depth.id] ?? reportObject),
        ...reportObject,
      };
    } else if (!objects[depth.id]) {
      objects[depth.id] = enrichOrvekObjectWithMovementDepth(
        {
          id: depth.id,
          type: "model-update",
          title: depth.movementSummary,
          summary: depth.movementSummary,
          eventType: "Model update",
          inspectorObjectType: "model_update",
          inspectorObjectId: depth.id,
        },
        depth,
      );
    }
  }

  const depthIdsReadyForTimeline = Object.values(movementDepthById)
    .filter((depth) => Boolean(depth.before?.trim() && depth.after?.trim()))
    .map((depth) => depth.id);

  const timelineGroups: OrvekTimelineGroup[] = TIMELINE_SHELL_GROUP_HEADINGS.map((heading) => {
    const populated = view.groups.find((group) => group.heading === heading);
    const ids = populated?.rows.map((row) => row.id) ?? [];
    if (heading === "Today") {
      for (const depthId of depthIdsReadyForTimeline) {
        if (!ids.includes(depthId)) {
          ids.unshift(depthId);
        }
      }
    }
    return {
      heading,
      ids,
    };
  });

  const timelineFilters = TIMELINE_SEMANTIC_FILTERS.map((filter) => filter.label);

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    timelineGroups,
    timelineFilters,
    timelineIsLoading: input.isLoadingActivity || input.isLoadingModelLayers || input.isLoadingSemantic,
    emptyCopyBySlot: {
      timelineEmpty: view.emptyCopy,
    },
  });
}

export function buildNormalizedTimelineProductionDataApi(
  input: MapTimelineDataInput,
): OrvekDataApi {
  return normalizeTimelineProductionDataApi(buildTimelineProductionDataApi(input));
}
