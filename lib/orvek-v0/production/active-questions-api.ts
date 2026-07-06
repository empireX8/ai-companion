import { V0_EXPLORE_QUESTIONS_EMPTY_LIST } from "../../orvek-adapters/explore";
import type { ActiveQuestionItem } from "../../active-questions";
import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import type { OrvekObject } from "../orvek-types";
import {
  activeQuestionItemToActiveQuestionObject,
  buildLinkedActiveQuestionObjectAlias,
} from "./active-questions-presentation";

export function buildActiveQuestionsProductionDataApi(
  items: ActiveQuestionItem[],
  linkedAliases: Array<{ linkedObjectType: string; linkedObjectId: string }> = [],
): OrvekDataApi {
  const objects: Record<string, OrvekObject> = {};

  for (const item of items) {
    objects[item.id] = activeQuestionItemToActiveQuestionObject(item);
  }

  for (const link of linkedAliases) {
    const alias = buildLinkedActiveQuestionObjectAlias(link);
    if (alias) {
      objects[link.linkedObjectId] = alias;
    }
  }

  const exploreQuestionIds = items.map((item) => item.id);
  const exploreQuestionSelectedId = exploreQuestionIds[0] ?? null;

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    getObject: (id) => (id ? objects[id] : undefined),
    getObjects: (ids) =>
      (ids ?? [])
        .map((id) => objects[id])
        .filter((object): object is OrvekObject => Boolean(object)),
    exploreQuestionIds,
    exploreQuestionSelectedId,
    activeQuestionsIsLoading: false,
    emptyCopyBySlot: {
      exploreQuestionsEmptyList: V0_EXPLORE_QUESTIONS_EMPTY_LIST,
    },
  });
}
