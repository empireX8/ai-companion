import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { withProductionContract } from "../../lib/orvek-v0/display-contract";
import { buildExploreProductionDataApi } from "../../lib/orvek-v0/production/explore-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  hasFreeExploreChatFakeMovementOrReviewLeak,
  hasFreeExploreChatProductionDisplayContractLeak,
  hasLiveExploreChatFromProvider,
  isFreeExploreChatMessagePresentationReady,
  isFreeExploreChatPresentationReady,
  isSafeEmptyLiveFreeExploreChatState,
  mapFreeExploreChatRoleToReference,
  normalizeFreeExploreChatProductionDataApi,
  shouldMergeFreeExploreChatProductionApi,
} from "../../lib/orvek-v0/production/free-explore-chat-presentation";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function readyChatInput(
  overrides: Partial<Parameters<typeof buildFreeExploreChatProductionDataApi>[0]> = {},
) {
  return {
    sessionId: "sess-ready-1",
    sessionTitle: "Architecture uncertainty thread",
    messages: [
      {
        id: "msg-user-1",
        role: "user" as const,
        content: "Why do I need to see the architecture visually before locking design?",
        createdAt: "2026-06-20T10:00:00.000Z",
      },
      {
        id: "msg-assistant-1",
        role: "assistant" as const,
        content:
          "You seem to trust decisions more once the system can express itself visually.",
        createdAt: "2026-06-20T10:00:05.000Z",
      },
    ],
    composerDraft: "",
    isBooting: false,
    isSending: false,
    errorMessage: null,
    sendHandlerAvailable: false,
    ...overrides,
  };
}

describe("free explore chat presentation readiness", () => {
  it("passes readiness for a valid safe transcript", () => {
    const api = buildFreeExploreChatProductionDataApi(readyChatInput());

    expect(shouldMergeFreeExploreChatProductionApi(api)).toBe(true);
    expect(api.exploreMessages).toEqual([
      {
        id: "msg-user-1",
        role: "user",
        content: "Why do I need to see the architecture visually before locking design?",
      },
      {
        id: "msg-assistant-1",
        role: "orvek",
        content: "You seem to trust decisions more once the system can express itself visually.",
      },
    ]);
    expect(mapFreeExploreChatRoleToReference("assistant")).toBe("orvek");
  });

  it("represents safe empty-live state when session is ready with no messages", () => {
    const api = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        messages: [],
      }),
    );

    expect(isSafeEmptyLiveFreeExploreChatState(api)).toBe(true);
    expect(shouldMergeFreeExploreChatProductionApi(api)).toBe(true);
    expect(api.exploreMessages).toEqual([]);
  });

  it("rejects missing or malformed messages", () => {
    const baseApi = buildFreeExploreChatProductionDataApi(readyChatInput());
    const missingIdApi = {
      ...baseApi,
      exploreMessages: [{ id: "   ", role: "user" as const, content: "Hello" }],
    };

    expect(shouldMergeFreeExploreChatProductionApi(missingIdApi)).toBe(false);

    const rawJsonApi = {
      ...baseApi,
      exploreMessages: [
        {
          id: "msg-user-1",
          role: "user" as const,
          content: '{"model_update_candidate":"unsafe"}',
        },
      ],
    };

    expect(shouldMergeFreeExploreChatProductionApi(rawJsonApi)).toBe(false);
  });

  it("rejects unknown roles", () => {
    const api = buildFreeExploreChatProductionDataApi(readyChatInput());
    const invalidRoleApi = {
      ...api,
      exploreMessages: [
        {
          id: "msg-system-1",
          role: "system",
          content: "Hidden system prompt",
        },
      ],
    } as unknown as typeof api;

    expect(shouldMergeFreeExploreChatProductionApi(invalidRoleApi)).toBe(false);
  });

  it("rejects empty raw stream chunks unless actively streaming the final assistant row", () => {
    const baseApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        messages: [],
      }),
    );

    const staleTempApi = {
      ...baseApi,
      exploreMessages: [{ id: "tmp-assistant-1", role: "orvek" as const, content: "" }],
    };

    expect(shouldMergeFreeExploreChatProductionApi(staleTempApi)).toBe(false);

    const streamingApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        isSending: true,
        messages: [
          {
            id: "msg-user-1",
            role: "user",
            content: "Continue this thread.",
          },
          {
            id: "tmp-assistant-2",
            role: "assistant",
            content: "",
          },
        ],
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(streamingApi)).toBe(true);
    expect(streamingApi.exploreMessages?.at(-1)).toEqual({
      id: "tmp-assistant-2",
      role: "orvek",
      content: "",
    });
  });

  it("fails or degrades safely on auth/session boot errors", () => {
    const authErrorApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        messages: [],
        errorMessage: "Please sign in to view sessions.",
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(authErrorApi)).toBe(false);

    const bootingApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        isBooting: true,
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(bootingApi)).toBe(false);
  });

  it("requires explicit send handler availability", () => {
    const missingHandlerFlagApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        sendHandlerAvailable: undefined as unknown as boolean,
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(missingHandlerFlagApi)).toBe(false);

    const readOnlyApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({
        sendHandlerAvailable: false,
      }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(readOnlyApi)).toBe(true);
    expect(readOnlyApi.freeExploreSendHandlerAvailable).toBe(false);
  });

  it("withholds grounding, movement, and review production gaps instead of faking them", () => {
    const api = buildFreeExploreChatProductionDataApi(readyChatInput());

    expect(api.exploreGrounding).toEqual([]);
    expect(api.exploreMovement).toEqual([]);
    expect(api.exploreLiveDetectionCopy).toBeUndefined();
    expect(hasFreeExploreChatFakeMovementOrReviewLeak(api)).toBe(false);

    const leakedApi = normalizeFreeExploreChatProductionDataApi({
      ...api,
      exploreGrounding: ["r6"],
      exploreLiveDetectionCopy: "1 receipt extracted",
      exploreMovement: [{ id: "ex1", kind: "Receipt extracted", text: "Unsafe" }],
    });

    expect(leakedApi.exploreGrounding).toEqual([]);
    expect(leakedApi.exploreMovement).toEqual([]);
    expect(leakedApi.exploreLiveDetectionCopy).toBeUndefined();
    expect(hasFreeExploreChatFakeMovementOrReviewLeak(leakedApi)).toBe(false);
    expect(shouldMergeFreeExploreChatProductionApi({ ...api, exploreGrounding: ["r6"] })).toBe(
      false,
    );
  });

  it("strips global displayContract production leaks", () => {
    const api = buildFreeExploreChatProductionDataApi(readyChatInput());
    const leakedApi = withProductionContract(api);

    expect(hasFreeExploreChatProductionDisplayContractLeak(leakedApi)).toBe(true);
    expect(shouldMergeFreeExploreChatProductionApi(leakedApi)).toBe(false);

    const normalized = normalizeFreeExploreChatProductionDataApi(leakedApi);
    expect(normalized.displayContract).toBeUndefined();
  });

  it("rejects legacy /explore production builder assumptions", () => {
    const legacyApi = buildExploreProductionDataApi({
      activeTab: "free",
      hasActionHandoffRequest: false,
      handoffContext: null,
      isLoadingHandoff: false,
      handoffError: null,
      messages: [],
      composerDraft: "",
      isBooting: false,
      isSending: false,
      errorMessage: null,
    });

    expect(legacyApi.displayContract).toBe("production");
    expect(shouldMergeFreeExploreChatProductionApi(legacyApi)).toBe(false);
  });

  it("keeps root hybrid hook wired for bounded Explore chat session read fetch", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("useOrvekExploreChat");
    expect(hookSource).toContain("buildFreeExploreChatProductionDataApi");
    expect(hookSource).toContain("freeExploreChatApi");
    expect(hookSource).toContain("sendHandlerAvailable: false");
    expect(hookSource).not.toContain("sendMessage");
    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
  });

  it("detects live explore chat from provider when gate passes", () => {
    const api = buildFreeExploreChatProductionDataApi(readyChatInput());

    expect(hasLiveExploreChatFromProvider(api)).toBe(true);
  });

  it("rejects live explore chat from provider when session gate fails", () => {
    const api = buildFreeExploreChatProductionDataApi(
      readyChatInput({ errorMessage: "401 Unauthorized — please sign in" }),
    );

    expect(hasLiveExploreChatFromProvider(api)).toBe(false);
  });

  it("keeps FreeExplore consuming gated live exploreMessages read-only", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("hasLiveExploreChat");
    expect(freeExploreBlock).toContain("hasLiveExploreChatFromProvider");
    expect(freeExploreBlock).not.toContain("isProductionDisplay");
    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable === true");
  });

  it("keeps Fieldwork Bridge, Active Questions, and Investigations untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("hasLiveQuestions");
    expect(explorePageSource).toContain("hasLiveInvestigations");
    expect(explorePageSource).toContain("hasLiveExploreChat");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(workbenchSource).not.toContain("V0ExploreView");
  });

  it("preserves unrelated hybrid parity surfaces when chat gate exists", () => {
    const baseApi = createMockOrvekDataApi();
    const chatApi = buildFreeExploreChatProductionDataApi(readyChatInput());

    expect(baseApi.exploreQuestionIds).toBeUndefined();
    expect(baseApi.exploreInvestigationIds).toBeUndefined();
    expect(baseApi.exploreFieldworkIds).toBeUndefined();
    expect(chatApi.exploreQuestionIds).toBeUndefined();
    expect(chatApi.exploreInvestigationIds).toBeUndefined();
    expect(chatApi.exploreFieldworkIds).toBeUndefined();
    expect(isFreeExploreChatPresentationReady(chatApi)).toBe(true);
  });
});

describe("free explore chat hybrid overlay merge", () => {
  it("merges ready chat overlay as ninth hybrid argument when gate passes", () => {
    const baseApi = createMockOrvekDataApi();
    const chatApi = buildFreeExploreChatProductionDataApi(readyChatInput());

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      chatApi,
    );

    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.exploreMessages?.length).toBe(2);
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
    expect(hybridApi.displayContract).toBeUndefined();
  });

  it("falls back to reference chat fields when hybrid overlay fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const bootingApi = buildFreeExploreChatProductionDataApi(
      readyChatInput({ isBooting: true }),
    );

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      bootingApi,
    );

    expect(hybridApi).toBe(baseApi);
    expect(hybridApi.exploreMessages).toBeUndefined();
  });
});
