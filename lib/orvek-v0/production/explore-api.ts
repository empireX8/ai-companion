import { mapExploreDataToV0Props, type MapExploreDataInput } from "../../orvek-adapters/explore";
import type { OrvekDataApi } from "../data-provider";
import { withProductionContract } from "../display-contract";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";

export function buildExploreProductionDataApi(input: MapExploreDataInput): OrvekDataApi {
  const view = mapExploreDataToV0Props(input);

  const exploreMessages =
    input.messages.length > 0
      ? input.messages
          .filter((message) => message.content.trim().length > 0 || message.role === "user")
          .map((message) => ({
            id: message.id,
            role: message.role === "assistant" ? ("orvek" as const) : ("user" as const),
            content: message.content,
          }))
      : [];

  return withProductionContract({
    ...EMPTY_ORVEK_DATA_API,
    exploreMessages,
    exploreGrounding: [],
    exploreMovement: [],
    exploreQuestionIds: [],
    exploreInvestigationIds: [],
    exploreLiveDetectionCopy:
      exploreMessages.length > 0 ? undefined : view.liveDetectionCopy,
    exploreIsLoading: input.isBooting || input.isSending,
    explore: view,
    emptyCopyBySlot: {
      exploreChatEmpty: view.emptyPrompt,
      exploreGroundingEmpty: view.groundingSectionIntro,
      exploreQuestionsEmptyList: view.questions.emptyListCopy,
      exploreQuestionsEmptyDetail: view.questions.emptyDetailCopy,
      exploreInvestigationsEmptyList: view.investigations.emptyListCopy,
      exploreInvestigationsEmptyDetail: view.investigations.emptyDetailCopy,
      exploreFieldworkEmpty: view.fieldwork.emptyListCopy,
    },
  });
}
