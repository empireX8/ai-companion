import {
  EXPLORE_CHAT_EMPTY_PROMPT,
  EXPLORE_CHAT_PLACEHOLDER,
  EXPLORE_GROUNDING_SECTION_INTRO,
} from "../../explore-surface";
import { mapExploreDataToV0Props } from "../../orvek-adapters/explore";
import type { OrvekDataApi, OrvekExploreMessage } from "../data-provider";
import { EMPTY_ORVEK_DATA_API } from "../empty-api";
import {
  isFreeExploreChatMessagePresentationReady,
  isTemporaryFreeExploreChatMessageId,
  mapFreeExploreChatRoleToReference,
  normalizeFreeExploreChatContent,
  type FreeExploreChatProductionRole,
} from "./free-explore-chat-presentation";

export type FreeExploreChatMessageInput = {
  id: string;
  role: FreeExploreChatProductionRole;
  content: string;
  createdAt?: string;
};

export type BuildFreeExploreChatProductionDataApiInput = {
  sessionId: string | null;
  sessionTitle?: string | null;
  messages: FreeExploreChatMessageInput[];
  composerDraft?: string;
  isBooting: boolean;
  isSending: boolean;
  errorMessage?: string | null;
  sendHandlerAvailable: boolean;
};

function mapInputMessagesToExploreMessages(
  messages: FreeExploreChatMessageInput[],
  options: { allowStreamingAssistantEmpty: boolean },
): OrvekExploreMessage[] {
  const mapped: OrvekExploreMessage[] = [];

  for (const [index, message] of messages.entries()) {
    const role = mapFreeExploreChatRoleToReference(message.role);
    if (!role) {
      continue;
    }

    const content = normalizeFreeExploreChatContent(message.content);
    const isStreamingAssistant =
      options.allowStreamingAssistantEmpty &&
      role === "orvek" &&
      index === messages.length - 1;
    const isPendingUserMessage =
      options.allowStreamingAssistantEmpty &&
      role === "user" &&
      isTemporaryFreeExploreChatMessageId(message.id);

    if (
      !isFreeExploreChatMessagePresentationReady(
        {
          id: message.id.trim(),
          role,
          content: message.content,
        },
        {
          allowStreamingAssistantEmpty: options.allowStreamingAssistantEmpty,
          isStreamingAssistant,
          allowPendingUserMessage: options.allowStreamingAssistantEmpty,
          isPendingUserMessage,
        },
      )
    ) {
      continue;
    }

    mapped.push({
      id: message.id.trim(),
      role,
      content: content ?? "",
    });
  }

  return mapped;
}

export function buildFreeExploreChatProductionDataApi(
  input: BuildFreeExploreChatProductionDataApiInput,
): OrvekDataApi {
  const exploreMessages = mapInputMessagesToExploreMessages(input.messages, {
    allowStreamingAssistantEmpty: input.isSending,
  });

  const adapterMessages = input.messages
    .map((message) => {
      const role =
        message.role === "user"
          ? ("user" as const)
          : message.role === "assistant" || message.role === "orvek"
            ? ("assistant" as const)
            : null;
      if (!role) {
        return null;
      }

      return {
        id: message.id,
        role,
        content: message.content,
      };
    })
    .filter(
      (
        message,
      ): message is {
        id: string;
        role: "user" | "assistant";
        content: string;
      } => message !== null,
    );

  const view = mapExploreDataToV0Props({
    activeTab: "free",
    hasActionHandoffRequest: false,
    handoffContext: null,
    isLoadingHandoff: false,
    handoffError: null,
    messages: adapterMessages,
    composerDraft: input.composerDraft ?? "",
    isBooting: input.isBooting,
    isSending: input.isSending,
    errorMessage: input.errorMessage ?? null,
  });

  return {
    ...EMPTY_ORVEK_DATA_API,
    exploreMessages,
    exploreGrounding: [],
    exploreMovement: [],
    exploreLiveDetectionCopy: undefined,
    exploreIsLoading: input.isBooting,
    freeExploreChatSessionId: input.sessionId,
    freeExploreSendHandlerAvailable: input.sendHandlerAvailable,
    explore: view,
    emptyCopyBySlot: {
      exploreChatEmpty: EXPLORE_CHAT_EMPTY_PROMPT,
      exploreGroundingEmpty: EXPLORE_GROUNDING_SECTION_INTRO,
    },
  };
}
