import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { V0_EXPLORE_LIVE_DETECTION_COPY } from "../../lib/orvek-adapters/explore";
import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { withProductionContract } from "../../lib/orvek-v0/display-contract";
import { buildActiveQuestionsProductionDataApi } from "../../lib/orvek-v0/production/active-questions-api";
import { buildExperimentProductionDataApi } from "../../lib/orvek-v0/production/experiment-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import { buildInvestigationsProductionDataApi } from "../../lib/orvek-v0/production/investigations-api";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";
import {
  hasLiveExploreChatFromProvider,
  shouldMergeFreeExploreChatProductionApi,
} from "../../lib/orvek-v0/production/free-explore-chat-presentation";
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

describe("free explore chat tab alignment", () => {
  it("FreeExplore consumes gated exploreMessages when session gate passes", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("exploreMessages");
    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable");
    expect(freeExploreBlock).toContain("hasLiveExploreChat");
    expect(freeExploreBlock).toContain("hasLiveExploreChatFromProvider");
    expect(freeExploreBlock).not.toContain("isProductionDisplay");
  });

  it("can surface ready Free Explore chat production data through the hybrid provider path", () => {
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

    expect(hybridApi.freeExploreChatSessionId).toBe("sess-ready-1");
    expect(hybridApi.exploreMessages?.length).toBe(2);
    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);
    expect(hybridApi.displayContract).toBeUndefined();
    expect(hasLiveExploreChatFromProvider(hybridApi)).toBe(true);
  });

  it("falls back to reference transcript when production chat data fails readiness", () => {
    const baseApi = createMockOrvekDataApi();
    const unsafeChatApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());
    unsafeChatApi.exploreMessages = [
      {
        id: "msg-broken",
        role: "orvek",
        content: '{"model_update_candidate":true}',
      },
    ];

    expect(shouldMergeFreeExploreChatProductionApi(unsafeChatApi)).toBe(false);
    expect(hasLiveExploreChatFromProvider(unsafeChatApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      unsafeChatApi,
    );

    expect(hybridApi.exploreMessages).toBeUndefined();
    expect(hasLiveExploreChatFromProvider(hybridApi)).toBe(false);
  });

  it("falls back to reference transcript on booting, auth, and fetch states", () => {
    const baseApi = createMockOrvekDataApi();
    const bootingApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ isBooting: true }),
    );
    const authErrorApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ errorMessage: "401 Unauthorized — please sign in" }),
    );
    const loadingApi = buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput());
    loadingApi.exploreIsLoading = true;

    expect(hasLiveExploreChatFromProvider(bootingApi)).toBe(false);
    expect(hasLiveExploreChatFromProvider(authErrorApi)).toBe(false);
    expect(hasLiveExploreChatFromProvider(loadingApi)).toBe(false);
    expect(hasLiveExploreChatFromProvider(baseApi)).toBe(false);
  });

  it("supports safe empty-live state through the hybrid provider path", () => {
    const baseApi = createMockOrvekDataApi();
    const emptyChatApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({ messages: [] }),
    );

    expect(shouldMergeFreeExploreChatProductionApi(emptyChatApi)).toBe(true);

    const hybridApi = buildHybridWorkbenchDataApi(
      baseApi,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      emptyChatApi,
    );

    expect(hybridApi.exploreMessages).toEqual([]);
    expect(hasLiveExploreChatFromProvider(hybridApi)).toBe(true);
  });

  it("keeps Ask/send disabled until freeExploreSendHandlerAvailable is true", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable === true");
    expect(freeExploreBlock).toContain("disabled={!canSend}");
    expect(freeExploreBlock).not.toContain("freeExploreSendHandlerAvailable === false &&");

    const hybridApi = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput()),
    );

    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(false);

    const sendReadyHybridApi = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      buildFreeExploreChatProductionDataApi(
        readyFreeExploreChatInput({ sendHandlerAvailable: true }),
      ),
    );

    expect(sendReadyHybridApi.freeExploreSendHandlerAvailable).toBe(true);
  });

  it("mounts production explore handlers at the workbench root when session send is ready", () => {
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(workbenchSource).toContain("OrvekPageHandlersProvider");
    expect(shellSource).toContain("handlers={handlers}");
    expect(shellSource).not.toContain("handlers={{}}");
    expect(hookSource).toContain("sendMessage");
    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
  });

  it("does not display raw stream chunks in FreeExplore", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(explorePageSource).toContain("Thinking…");
    expect(explorePageSource).not.toContain("Orvek is thinking…");
    expect(explorePageSource).toContain("o-breathe");
    expect(explorePageSource).toContain('role="status"');
    expect(freeExploreBlock).toContain("showThinkingRow");
    expect(freeExploreBlock).toContain("bubbleMessages");
    expect(freeExploreBlock).toContain("{message.content}");
    expect(freeExploreBlock).not.toContain("isStreamingAssistant");
    expect(freeExploreBlock).toMatch(/\{showThinkingRow \? \([\s\S]*<ThinkingIndicator/);
    expect(freeExploreBlock).not.toContain("chunk");
  });

  it("withholds fake grounding, movement, and live-detection as production", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toMatch(/allowReferenceSample\s*=\s*referenceSurface\s*===\s*true/);
    expect(freeExploreBlock).toMatch(
      /useReferenceGrounding\s*=\s*allowReferenceSample\s*&&\s*!hasLiveExploreChat/,
    );
    expect(freeExploreBlock).toContain("V0_EXPLORE_LIVE_DETECTION_COPY");
    expect(freeExploreBlock).toContain("Review possible model movement in the inspector.");
    expect(freeExploreBlock).toContain("4 places");
    expect(freeExploreBlock).not.toContain("exploreMovement");
  });

  it("preserves reference transcript fallback wiring", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("REFERENCE_FREE_EXPLORE_MESSAGES");
    expect(explorePageSource).toContain(
      "Why do I feel like we need to see the architecture visually before locking design?",
    );
  });

  it("keeps grounding chips opening Inspector safely", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("onClick={() => select(c.id)}");
    expect(freeExploreBlock).toContain("EXPLORE_GROUNDING");
  });

  it("Fieldwork Bridge remains unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
    expect(explorePageSource).toContain('referenceFieldworkId = "f2"');
  });

  it("Active Questions remains unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const questionsBlock =
      explorePageSource.match(/function Questions\(\) \{([\s\S]*?)\n\}\n\nfunction Investigations/)?.[1] ??
      "";

    expect(questionsBlock).toContain("hasLiveQuestions");
    expect(questionsBlock).toContain("resolveActiveQuestionsOpenSelectionId");
    expect(questionsBlock).not.toContain("hasLiveExploreChat");
  });

  it("Investigations remains unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain("hasLiveInvestigations");
    expect(investigationsBlock).toContain("resolveInvestigationsOpenSelectionId");
    expect(investigationsBlock).not.toContain("hasLiveExploreChat");
  });

  it("preserves unrelated hybrid parity surfaces when chat tab aligns", () => {
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

  it("does not leak displayContract through hybrid chat merge", () => {
    const leakedApi = withProductionContract(
      buildFreeExploreChatProductionDataApi(readyFreeExploreChatInput()),
    );

    expect(hasLiveExploreChatFromProvider(leakedApi)).toBe(false);
  });

  it("uses honest live detection copy when live chat is active", () => {
    expect(V0_EXPLORE_LIVE_DETECTION_COPY).toBe("No live model signal detected yet.");
  });

  it("keeps the old production shell quarantined and does not restore legacy /explore as root UI", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");

    expect(shellSource).toContain("useOrvekHybridWorkbenchDataApi");
    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
  });
});
