import { V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST } from "../../orvek-adapters/explore";
import type { ExploreInvestigationItem } from "../../investigations";
import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";
import {
  buildLinkedInvestigationObjectAlias,
  exploreInvestigationItemToInvestigationObject,
  isInvestigationItemBridgeEligible,
  type InvestigationRowEnrichment,
} from "./investigations-presentation";

export function buildInvestigationsProductionDataApi(
  items: ExploreInvestigationItem[],
  options: {
    linkedAliases?: Array<{ linkedObjectType: string; linkedObjectId: string }>;
    enrichments?: Record<string, InvestigationRowEnrichment>;
  } = {},
): OrvekDataApi {
  const objects: Record<string, OrvekObject> = {};
  const eligibleItems = items.filter(isInvestigationItemBridgeEligible);

  for (const item of eligibleItems) {
    const object = exploreInvestigationItemToInvestigationObject(
      item,
      options.enrichments?.[item.id],
    );
    if (object) {
      objects[item.id] = object;
    }
  }

  for (const link of options.linkedAliases ?? []) {
    const alias = buildLinkedInvestigationObjectAlias(link);
    if (alias) {
      objects[link.linkedObjectId] = alias;
    }
  }

  const exploreInvestigationIds = eligibleItems
    .map((item) => item.id)
    .filter((id) => Boolean(objects[id]));
  const exploreInvestigationSelectedId = exploreInvestigationIds[0] ?? null;

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    exploreInvestigationIds,
    exploreInvestigationSelectedId,
    investigationsIsLoading: false,
    emptyCopyBySlot: {
      exploreInvestigationsEmptyList: V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST,
    },
  });
}
