import { describe, expect, it } from "vitest";

import {
  EXPLORE_CHAT_SURFACE_PRESET,
  JOURNAL_CHAT_SURFACE_PRESET,
  buildChatSurfacePreset,
  getSessionStorageKeyForSurface,
  resolveChatSurfacePresetFromSearchParam,
} from "../chat-surface-presets";

describe("chat surface presets", () => {
  it("journal chat preset uses journal_chat surface type", () => {
    expect(JOURNAL_CHAT_SURFACE_PRESET).toEqual({
      surfaceType: "journal_chat",
      sessionStorageKey: "double:journal-chat:lastSessionId",
    });
  });

  it("explore preset uses explore_chat surface type", () => {
    expect(EXPLORE_CHAT_SURFACE_PRESET).toEqual({
      surfaceType: "explore_chat",
      sessionStorageKey: "double:explore:lastSessionId",
    });
  });

  it("/chat defaults to explore_chat when query param is missing", () => {
    expect(resolveChatSurfacePresetFromSearchParam(null)).toEqual({
      surfaceType: "explore_chat",
      sessionStorageKey: "double:explore:lastSessionId",
    });
  });

  it("/chat resolves explore mode from query param", () => {
    expect(resolveChatSurfacePresetFromSearchParam("explore_chat")).toEqual({
      surfaceType: "explore_chat",
      sessionStorageKey: "double:explore:lastSessionId",
    });
  });

  it("buildChatSurfacePreset matches explicit surface input", () => {
    expect(buildChatSurfacePreset("journal_chat")).toEqual(
      JOURNAL_CHAT_SURFACE_PRESET
    );
    expect(buildChatSurfacePreset("explore_chat")).toEqual(
      EXPLORE_CHAT_SURFACE_PRESET
    );
  });

  it("returns per-surface storage keys", () => {
    expect(getSessionStorageKeyForSurface("journal_chat")).toBe(
      "double:journal-chat:lastSessionId"
    );
    expect(getSessionStorageKeyForSurface("explore_chat")).toBe(
      "double:explore:lastSessionId"
    );
  });
});
