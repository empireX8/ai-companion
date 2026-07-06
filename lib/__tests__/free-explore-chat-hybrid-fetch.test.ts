import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import { buildInvestigationsProductionDataApi } from "../../lib/orvek-v0/production/investigations-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import { shouldMergeFreeExploreChatProductionApi } from "../../lib/orvek-v0/production/free-explore-chat-presentation";
import type { ActiveQuestionItem } from "../active-questions";
import type { ExploreInvestigationItem } from "../investigations";
import type { WatchForItem } from "../watch-for";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function readyFreeExploreChatInput(
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

const READY_INVESTIGATIONS: ExploreInvestigationItem[] = [
  {
    id: "inv-resolved-1",
    title: "Why do I reopen scope before design?",
    organizingQuestion: "Understanding the trigger could break the most expensive loop.",
    status: "resolved",
    statusLabel: "Resolved",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

const READY_ACTIVE_QUESTIONS: ActiveQuestionItem[] = [
  {
    id: "aq-live-1",
    title: "Does public visibility trigger overbuilding?",
    organizingQuestion: "Testing whether anticipated visibility drives scope reopening.",
    status: "open",
    statusLabel: "Open",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

const READY_WATCH_FOR_ITEMS: WatchForItem[] = [
  {
    id: "fw-active",
    prompt: "Notice whether scope pressure rises before the next review.",
    reason: "Recent pattern signal suggests visibility triggers overbuilding.",
    status: "active",
    statusLabel: "Active",
    linkedObjectType: "pattern_claim",
    linkedObjectId: "pc-fw-2",
    linkedObjectHref: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

describe("bounded free explore chat hybrid fetch bridge", () => {
  it("wires Explore chat session/message read state into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const chatHookSource = readSource("components/orvek-workbench/useOrvekExploreChat.ts");

    expect(hookSource).toContain("useOrvekExploreChat");
    expect(hookSource).toContain("buildFreeExploreChatProductionDataApi");
    expect(hookSource).toContain("freeExploreChatApi");
    expect(hookSource).toContain("sendHandlerAvailable: false");
    expect(hookSource).not.toContain("sendMessage");
    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
    expect(hookSource).not.toContain("onSend");
    expect(chatHookSource).toContain("/api/message/list");
    expect(chatHookSource).toContain("buildAppSessionListUrl");
  });

  it("passes freeExploreChatApi as the ninth argument to buildHybridWorkbenchDataApi", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toMatch(
      /buildHybridWorkbenchDataApi\(\s*baseApi,\s*todayApi,\s*mapApi,\s*timelineApi,\s*decisionsApi,\s*experimentApi,\s*activeQuestionsApi,\s*investigationsApi,\s*freeExploreChatApi,\s*\)/,
    );
  });

  it("can surface ready Free Explore chat production data through the hybrid workbench", () => {
    const baseApi = createMockOrvekDataApi();
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());

    expect(shouldMergeFreeExploreChatProductionApi(freeExploreChatApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      freeExploreChatApi,
    );

    expect(hybridApi.displayContract).toBeUndefined();
    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
    expect(hybridApi.exploreMessages?.length).toBe(2);
    expect(hybridApi.exploreGrounding).toEqual(baseApi.exploreGrounding);
  });

  it("merges safe empty-live session when gate passes", () => {
    const baseApi = createMockOrvekDataApi();
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ messages: [] }),
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
      freeExploreChatApi,
    );

    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.exploreMessages).toEqual([]);
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
  });

  it("falls back to reference chat when session boot/auth state fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const bootingChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ isBooting: true }),
    );
    const authErrorChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({
        messages: [],
        errorMessage: "Please sign in to view sessions.",
      }),
    );

    expect(
      buildHybridWorkbenchDataApi(
        baseApi,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        bootingChatApi,
      ).exploreMessages,
    ).toBeUndefined();

    expect(
      buildHybridWorkbenchDataApi(
        baseApi,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        authErrorChatApi,
      ).freeExploreChatSessionId,
    ).toBeUndefined();
  });

  it("falls back when chat messages are malformed", () => {
    const baseApi = createMockOrvekDataApi();
    const readyApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());
    const malformedApi = {
      ...readyApi,
      exploreMessages: [
        {
          id: "msg-bad",
          role: "system" as "user",
          content: '{"model_update_candidate":"unsafe"}',
        },
      ],
    } as typeof readyApi;

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      malformedApi,
    );

    expect(hybridApi.exploreMessages).toBeUndefined();
  });

  it("does not mount production write handlers at the workbench root", () => {
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(workbenchSource).not.toContain("OrvekPageHandlersProvider");
    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
    expect(hookSource).not.toContain("sendMessage");
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
    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
  });

  it("preserves Active Questions, Investigations, and Fieldwork parity when chat fetch is wired", () => {
    const baseApi = createMockOrvekDataApi();
    const experimentApi = buildExperimentProductionDataApi(READY_WATCH_FOR_ITEMS);
    const activeQuestionsApi = buildActiveQuestionsProductionDataApi(READY_ACTIVE_QUESTIONS);
    const investigationsApi = buildInvestigationsProductionDataApi(READY_INVESTIGATIONS);
    const freeExploreChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      experimentApi,
      activeQuestionsApi,
      investigationsApi,
      freeExploreChatApi,
    );

    expect(hybridApi.exploreFieldworkIds).toEqual(["fw-active"]);
    expect(hybridApi.exploreQuestionIds).toEqual(["aq-live-1"]);
    expect(hybridApi.exploreInvestigationIds).toBeUndefined();
    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
  });

  it("keeps the old production shell quarantined and does not restore legacy /explore as root UI", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");

    expect(shellSource).toContain("useOrvekHybridWorkbenchDataApi");
    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
  });
});
