import {
  TIMELINE_SEMANTIC_FILTERS,
} from "../../timeline-semantic-layers";
import { mapTimelineDataToV0Props } from "../../orvek-adapters/timeline";
import type { MapTimelineDataInput } from "../../orvek-adapters/timeline";
import type { OrvekDataApi, OrvekTimelineGroup } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";

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

  for (const group of view.groups) {
    for (const row of group.rows) {
      objects[row.id] = {
        id: row.id,
        type: "timeline-event",
        title: row.title,
        summary: row.summary ?? undefined,
        eventType: row.eventLabel,
        before: row.beforeSummary ?? undefined,
        after: row.afterSummary ?? undefined,
        tags: [row.eventLabel],
        inspectorObjectType: row.inspectorTarget?.objectType,
        inspectorObjectId: row.inspectorTarget?.objectId,
      };
    }
  }

  const timelineGroups: OrvekTimelineGroup[] = TIMELINE_SHELL_GROUP_HEADINGS.map((heading) => {
    const populated = view.groups.find((group) => group.heading === heading);
    return {
      heading,
      ids: populated?.rows.map((row) => row.id) ?? [],
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
