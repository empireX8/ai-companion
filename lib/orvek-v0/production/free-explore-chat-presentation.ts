import type { OrvekDataApi, OrvekExploreMessage } from "../data-provider";
import { ORVEK_DISPLAY_CONTRACT_PRODUCTION } from "../display-contract";

export const FREE_EXPLORE_CHAT_CONTENT_MAX_LENGTH = 8000;
export const FREE_EXPLORE_CHAT_RAW_TEXT_REJECT_LENGTH = 320;
export const FREE_EXPLORE_CHAT_SESSION_ID_MAX_LENGTH = 128;

export type FreeExploreChatProductionRole = "user" | "assistant" | "orvek";

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

const AUTH_SESSION_ERROR_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /please sign in/i,
  /sign in to (?:view|create)/i,
  /session not found/i,
  /could not initialize chat/i,
  /unauthorized/i,
];

const TEMP_MESSAGE_ID_PREFIX = "tmp-";

export function collapseFreeExploreChatWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function looksLikeUnsafeRawFreeExploreChatText(
  value: string | null | undefined,
): boolean {
  const collapsed = collapseFreeExploreChatWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > FREE_EXPLORE_CHAT_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function looksLikeRawJsonFreeExploreChatBlob(value: string | null | undefined): boolean {
  const collapsed = collapseFreeExploreChatWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (
    (collapsed.startsWith("{") && collapsed.endsWith("}")) ||
    (collapsed.startsWith("[") && collapsed.includes("{"))
  ) {
    return true;
  }

  return /\bmodel_update_candidate\b|\breceipt_extracted\b|\bcompetingTheories\b/.test(collapsed);
}

export function looksLikeAuthOrSessionBootError(
  value: string | null | undefined,
): boolean {
  const collapsed = collapseFreeExploreChatWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  return AUTH_SESSION_ERROR_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function isSafeFreeExploreChatSessionId(value: string | null | undefined): boolean {
  const collapsed = collapseFreeExploreChatWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > FREE_EXPLORE_CHAT_SESSION_ID_MAX_LENGTH) {
    return false;
  }

  return /^[a-zA-Z0-9_-]+$/.test(collapsed);
}

export function mapFreeExploreChatRoleToReference(
  role: FreeExploreChatProductionRole,
): OrvekExploreMessage["role"] | null {
  if (role === "user") {
    return "user";
  }

  if (role === "assistant" || role === "orvek") {
    return "orvek";
  }

  return null;
}

export function normalizeFreeExploreChatContent(
  value: string | null | undefined,
): string | null {
  const collapsed = collapseFreeExploreChatWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (
    looksLikeUnsafeRawFreeExploreChatText(collapsed) ||
    looksLikeRawJsonFreeExploreChatBlob(collapsed)
  ) {
    return null;
  }

  if (collapsed.length <= FREE_EXPLORE_CHAT_CONTENT_MAX_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, FREE_EXPLORE_CHAT_CONTENT_MAX_LENGTH - 1).trimEnd()}…`;
}

export function isTemporaryFreeExploreChatMessageId(id: string | null | undefined): boolean {
  const collapsed = collapseFreeExploreChatWhitespace(id ?? "");
  return collapsed.startsWith(TEMP_MESSAGE_ID_PREFIX);
}

export function isFreeExploreChatMessagePresentationReady(
  message: OrvekExploreMessage,
  options: {
    allowStreamingAssistantEmpty?: boolean;
    isStreamingAssistant?: boolean;
  } = {},
): boolean {
  const id = collapseFreeExploreChatWhitespace(message.id);
  if (!id) {
    return false;
  }

  if (
    isTemporaryFreeExploreChatMessageId(id) &&
    !options.allowStreamingAssistantEmpty
  ) {
    return false;
  }

  if (message.role !== "user" && message.role !== "orvek") {
    return false;
  }

  const content = normalizeFreeExploreChatContent(message.content);
  if (content) {
    return true;
  }

  return (
    message.role === "orvek" &&
    Boolean(options.allowStreamingAssistantEmpty && options.isStreamingAssistant)
  );
}

export function normalizeFreeExploreChatMessage(
  message: OrvekExploreMessage,
): OrvekExploreMessage | null {
  const id = collapseFreeExploreChatWhitespace(message.id);
  if (!id || isTemporaryFreeExploreChatMessageId(id)) {
    return null;
  }

  if (message.role !== "user" && message.role !== "orvek") {
    return null;
  }

  const content = normalizeFreeExploreChatContent(message.content);
  if (!content) {
    return null;
  }

  return {
    id,
    role: message.role,
    content,
  };
}

export function hasFreeExploreChatProductionDisplayContractLeak(
  api: OrvekDataApi | undefined,
): boolean {
  return api?.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function hasFreeExploreChatFakeMovementOrReviewLeak(
  api: OrvekDataApi | undefined,
): boolean {
  if (!api) {
    return false;
  }

  if (typeof api.exploreLiveDetectionCopy === "string" && api.exploreLiveDetectionCopy.trim()) {
    return true;
  }

  if ((api.exploreGrounding?.length ?? 0) > 0) {
    return true;
  }

  if ((api.exploreMovement?.length ?? 0) > 0) {
    return true;
  }

  return false;
}

export function isFreeExploreSendHandlerExplicit(
  api: OrvekDataApi | undefined,
): boolean {
  return typeof api?.freeExploreSendHandlerAvailable === "boolean";
}

export function isSafeEmptyLiveFreeExploreChatState(api: OrvekDataApi | undefined): boolean {
  if (!api || !isSafeFreeExploreChatSessionId(api.freeExploreChatSessionId)) {
    return false;
  }

  if (api.exploreIsLoading || api.explore?.isBooting) {
    return false;
  }

  if (looksLikeAuthOrSessionBootError(api.explore?.errorMessage)) {
    return false;
  }

  if ((api.exploreMessages?.length ?? 0) > 0) {
    return false;
  }

  return true;
}

export function isFreeExploreChatPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.exploreIsLoading || api.explore?.isBooting) {
    return false;
  }

  if (hasFreeExploreChatProductionDisplayContractLeak(api)) {
    return false;
  }

  if (hasFreeExploreChatFakeMovementOrReviewLeak(api)) {
    return false;
  }

  if (looksLikeAuthOrSessionBootError(api.explore?.errorMessage)) {
    return false;
  }

  if (!isFreeExploreSendHandlerExplicit(api)) {
    return false;
  }

  if (!isSafeFreeExploreChatSessionId(api.freeExploreChatSessionId)) {
    return false;
  }

  const messages = api.exploreMessages ?? [];
  const allowStreamingAssistantEmpty = Boolean(api.explore?.isSending);

  if (messages.length === 0) {
    return isSafeEmptyLiveFreeExploreChatState(api);
  }

  for (const [index, message] of messages.entries()) {
    const isStreamingAssistant =
      allowStreamingAssistantEmpty &&
      message.role === "orvek" &&
      index === messages.length - 1;

    if (
      !isFreeExploreChatMessagePresentationReady(message, {
        allowStreamingAssistantEmpty,
        isStreamingAssistant,
      })
    ) {
      return false;
    }
  }

  return true;
}

export function shouldMergeFreeExploreChatProductionApi(
  api: OrvekDataApi | undefined,
): boolean {
  if (!api || api.exploreIsLoading) {
    return false;
  }

  return isFreeExploreChatPresentationReady(api);
}

export function normalizeFreeExploreChatProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const allowStreamingAssistantEmpty = Boolean(api.explore?.isSending);
  const normalizedMessages: OrvekExploreMessage[] = [];

  for (const [index, message] of (api.exploreMessages ?? []).entries()) {
    const isStreamingAssistant =
      allowStreamingAssistantEmpty &&
      message.role === "orvek" &&
      index === (api.exploreMessages?.length ?? 0) - 1;

    if (
      !isFreeExploreChatMessagePresentationReady(message, {
        allowStreamingAssistantEmpty,
        isStreamingAssistant,
      })
    ) {
      continue;
    }

    if (isStreamingAssistant && !normalizeFreeExploreChatContent(message.content)) {
      normalizedMessages.push({
        id: collapseFreeExploreChatWhitespace(message.id),
        role: "orvek",
        content: "",
      });
      continue;
    }

    const normalized = normalizeFreeExploreChatMessage(message);
    if (normalized) {
      normalizedMessages.push(normalized);
    }
  }

  const {
    displayContract: _displayContract,
    exploreLiveDetectionCopy: _liveDetectionCopy,
    ...apiWithoutLegacyShell
  } = api;

  const sessionId = api.freeExploreChatSessionId;

  return {
    ...apiWithoutLegacyShell,
    exploreMessages: normalizedMessages,
    exploreGrounding: [],
    exploreMovement: [],
    exploreLiveDetectionCopy: undefined,
    freeExploreChatSessionId: isSafeFreeExploreChatSessionId(sessionId)
      ? collapseFreeExploreChatWhitespace(sessionId ?? "")
      : null,
    freeExploreSendHandlerAvailable: api.freeExploreSendHandlerAvailable,
    explore: api.explore
      ? {
          ...api.explore,
          messages: api.explore.messages.filter((message) =>
            isFreeExploreChatMessagePresentationReady(
              {
                id: message.id,
                role: message.role,
                content: message.content,
              },
              {
                allowStreamingAssistantEmpty,
                isStreamingAssistant:
                  allowStreamingAssistantEmpty &&
                  message.role === "orvek" &&
                  message.id === api.explore?.messages.at(-1)?.id,
              },
            ),
          ),
        }
      : api.explore,
  };
}
