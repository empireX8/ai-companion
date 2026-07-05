import { V0_EXPLORE_FIELDWORK_EMPTY_LIST } from "../../orvek-adapters/explore";
import type { WatchForItem } from "../../watch-for";
import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";
import {
  buildLinkedFieldworkObjectAlias,
  watchForItemToFieldworkObject,
} from "./experiment-presentation";

export function buildExperimentProductionDataApi(items: WatchForItem[]): OrvekDataApi {
  const objects: Record<string, OrvekObject> = {};

  for (const item of items) {
    objects[item.id] = watchForItemToFieldworkObject(item);

    if (item.linkedObjectId) {
      const alias = buildLinkedFieldworkObjectAlias({
        linkedObjectType: item.linkedObjectType,
        linkedObjectId: item.linkedObjectId,
      });
      if (alias) {
        objects[item.linkedObjectId] = alias;
      }
    }
  }

  const exploreFieldworkIds = items.map((item) => item.id);
  const exploreFieldworkSelectedId = exploreFieldworkIds[0] ?? null;

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    exploreFieldworkIds,
    exploreFieldworkSelectedId,
    experimentIsLoading: false,
    emptyCopyBySlot: {
      exploreFieldworkEmpty: V0_EXPLORE_FIELDWORK_EMPTY_LIST,
    },
  });
}
