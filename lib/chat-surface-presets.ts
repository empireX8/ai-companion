import {
  resolveSessionSurfaceType,
  type SessionSurfaceType,
} from "./chat-surface-routing";

export type ChatSurfacePreset = {
  surfaceType: SessionSurfaceType;
  sessionStorageKey: string;
};

export const SESSION_STORAGE_KEY_BY_SURFACE: Record<SessionSurfaceType, string> = {
  journal_chat: "double:journal-chat:lastSessionId",
  explore_chat: "double:explore:lastSessionId",
};

export function getSessionStorageKeyForSurface(
  surfaceType: SessionSurfaceType
): string {
  return SESSION_STORAGE_KEY_BY_SURFACE[surfaceType];
}

export function buildChatSurfacePreset(
  surfaceType: SessionSurfaceType
): ChatSurfacePreset {
  return {
    surfaceType,
    sessionStorageKey: getSessionStorageKeyForSurface(surfaceType),
  };
}

export function resolveChatSurfacePresetFromSearchParam(
  value: string | null | undefined
): ChatSurfacePreset {
  const surfaceType = resolveSessionSurfaceType(value);
  return buildChatSurfacePreset(surfaceType);
}

export const JOURNAL_CHAT_SURFACE_PRESET: ChatSurfacePreset = buildChatSurfacePreset(
  "journal_chat"
);

export const EXPLORE_CHAT_SURFACE_PRESET: ChatSurfacePreset = buildChatSurfacePreset(
  "explore_chat"
);
