import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import {
  areFreeExploreChatMessagesLiveReady,
  hasLiveExploreChatFromProvider,
  isFreeExploreChatSessionSendReady,
} from "../../lib/orvek-v0/production/free-explore-chat-presentation";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";

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
    ],
    composerDraft: "",
    isBooting: false,
    isSending: false,
    errorMessage: null,
    sendHandlerAvailable: false,
    ...overrides,
  };
}

function freeExploreBlock(source: string): string {
  return (
    source.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ?? ""
  );
}

describe("free explore chat send/draft/stream wiring (E2/E3)", () => {
  it("passes explore handlers from production shell only", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const referencePageSource = readSource("app/dev/orvek-v0-reference/page.tsx");

    expect(shellSource).toContain("useOrvekHybridWorkbenchDataApi()");
    expect(shellSource).toContain("dataApi, handlers");
    expect(shellSource).toContain("handlers={handlers}");
    expect(shellSource).not.toContain("handlers={{}}");
    expect(hookSource).toContain("sendMessage");
    expect(hookSource).toContain("onSend:");
    expect(hookSource).toContain("onDraftChange: setExploreChatDraft");
    expect(hookSource).toContain("onQuickPrompt:");
    expect(referencePageSource).toContain("<Workbench />");
    expect(referencePageSource).not.toContain("handlers=");
    expect(referencePageSource).not.toContain("useOrvekHybridWorkbenchDataApi");
  });

  it("keeps /dev/orvek-v0-reference send-disabled without hybrid handlers", () => {
    const referencePageSource = readSource("app/dev/orvek-v0-reference/page.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(referencePageSource).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
    expect(workbenchSource).toContain("handlers ?? {}");
  });

  it("marks session send readiness false without safe session id", () => {
    expect(
      isFreeExploreChatSessionSendReady({
        sessionId: null,
        isBooting: false,
        errorMessage: null,
      }),
    ).toBe(false);

    expect(
      isFreeExploreChatSessionSendReady({
        sessionId: "sess-ready-1",
        isBooting: true,
        errorMessage: null,
      }),
    ).toBe(false);

    expect(
      isFreeExploreChatSessionSendReady({
        sessionId: "sess-ready-1",
        isBooting: false,
        errorMessage: "Please sign in to view sessions.",
      }),
    ).toBe(false);
  });

  it("marks session send readiness true when session gate passes", () => {
    expect(
      isFreeExploreChatSessionSendReady({
        sessionId: "sess-ready-1",
        isBooting: false,
        errorMessage: null,
      }),
    ).toBe(true);
  });

  it("keeps freeExploreSendHandlerAvailable false without session/write readiness", () => {
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
  });

  it("passes freeExploreSendHandlerAvailable true when upstream marks handler availability", () => {
    const hybridApi = buildHybridWorkbenchDataApi(
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

    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(true);
  });

  it("gates Ask button on draft, handler, availability, and not sending", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("freeExploreSendHandlerAvailable === true");
    expect(block).toContain("Boolean(exploreHandlers?.onSend)");
    expect(block).toContain("!composerDisabled");
    expect(block).toContain("composerDraft.trim().length > 0");
    expect(block).toContain("disabled={!canSend}");
    expect(block).toContain("composerDisabled = isBooting || isSending");
  });

  it("routes send through handleSend for Ask and Enter with duplicate guard", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("const handleSend = useCallback");
    expect(block).toContain("setPendingUserMessage(outgoing)");
    expect(block).toContain("handleSend()");
    expect(block).toContain('event.key !== "Enter"');
    expect(block).toContain("if (!canSend)");
  });

  it("shows immediate pending user message without waiting for server reconciliation", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("PENDING_USER_MESSAGE_ID");
    expect(block).toContain("pendingAlreadyVisible");
    expect(block).toContain("setPendingUserMessage(outgoing)");
  });

  it("preserves transcript during send instead of falling back to reference", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("lastStableLiveMessagesRef");
    expect(block).toContain("preservedLiveMessages");
    expect(block).toContain("freeExploreSendHandlerAvailable === true");

    const sendingApi = buildFreeExploreChatProductionDataApi(
      readyFreeExploreChatInput({
        isSending: true,
        messages: [
          {
            id: "msg-user-1",
            role: "user",
            content: "Earlier question",
          },
          {
            id: "tmp-user-send",
            role: "user",
            content: "New outgoing question",
          },
          {
            id: "tmp-assistant-send",
            role: "assistant",
            content: "",
          },
        ],
      }),
    );

    expect(hasLiveExploreChatFromProvider(sendingApi)).toBe(true);
    expect(areFreeExploreChatMessagesLiveReady(sendingApi.exploreMessages ?? [], true)).toBe(
      true,
    );
  });

  it("routes draft changes through provider/hook setter when send is available", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("exploreView?.composerDraft");
    expect(block).toContain("exploreHandlers.onDraftChange(nextValue)");
  });

  it("restores draft on failed send from hook and FreeExplore error effect", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const hookSource = readSource("components/orvek-workbench/useOrvekExploreChat.ts");
    const block = freeExploreBlock(explorePageSource);

    expect(hookSource).toContain("setDraft(content)");
    expect(block).toContain("exploreView?.errorMessage");
    expect(block).toContain("exploreHandlers.onDraftChange(pendingUserMessage");
    expect(block).toContain("setPendingUserMessage(null)");
  });

  it("shows inline thinking row after latest user message without bubble chrome", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(explorePageSource).toContain("Thinking…");
    expect(explorePageSource).not.toContain("Orvek is thinking…");
    expect(explorePageSource).toContain("o-breathe");
    expect(explorePageSource).toContain('role="status"');
    expect(explorePageSource).toContain('aria-live="polite"');
    expect(block).toContain("bubbleMessages");
    expect(block).toContain("showThinkingRow");
    expect(block).toContain("hasAssistantContentAfterLatestUser");
    expect(block).toContain("{message.content}");
    expect(block).not.toContain("isStreamingAssistant");
    expect(block).toMatch(/\{showThinkingRow \? \([\s\S]*<ThinkingIndicator/);
    expect(block).not.toContain("isStreamingAssistant");
    expect(block).not.toContain("chunk");
  });

  it("renders thinking row only after user turn with no assistant content yet", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("message.content.trim().length > 0");
    expect(block).toContain("hasAssistantContentAfterLatestUser(bubbleMessages)");
    expect(block).toContain("isSending && !hasAssistantContentAfterLatestUser");
  });

  it("wires hook sendMessage through explore handlers when session send ready", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("isFreeExploreChatSessionSendReady");
    expect(hookSource).toContain("exploreChatSendReady");
    expect(hookSource).toContain("sendHandlerAvailable: exploreChatSendReady");
    expect(hookSource).toContain("void sendMessage()");
    expect(hookSource).toContain(
      "return { dataApi, handlers, durableActionsRevision, refreshAfterDurableWrite }",
    );
    expect(hookSource).toContain("if (isLoadingSnapshot) {");
    expect(hookSource).toContain("freeExploreChatApi");
  });

  it("merges free explore send readiness while Today snapshot is still loading", () => {
    const hybridApi = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      buildFreeExploreChatProductionDataApi(
        readyFreeExploreChatInput({
          sendHandlerAvailable: true,
          messages: [],
        }),
      ),
    );

    expect(hybridApi.freeExploreSendHandlerAvailable).toBe(true);
    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
  });

  it("withholds reference grounding and sample transcript when production send is unavailable", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("allowReferenceSample = referenceSurface === true");
    expect(block).toContain(
      "useReferenceGrounding = allowReferenceSample && !hasLiveExploreChat",
    );
    expect(block).toContain("allowReferenceSample && !hasLiveExploreChat && preservedLiveMessages");
    expect(block).toContain('data-testid="explore-grounding-empty"');
  });

  it("keeps labelled reference grounding only on explicit referenceSurface", () => {
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(workbenchSource).toContain("referenceSurface: true");
    expect(explorePageSource).toContain("REFERENCE_FREE_EXPLORE_MESSAGES");
    expect(explorePageSource).toContain("allowReferenceSample = referenceSurface === true");
  });

  it("keeps legacy /explore UI and old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(shellSource).not.toContain("RouteTopBar");
  });

  it("keeps Fieldwork Bridge, Active Questions, and Investigations unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("function FieldworkBridge");
    expect(explorePageSource).toContain("function Questions");
    expect(explorePageSource).toContain("function Investigations");
    expect(explorePageSource).not.toMatch(
      /function FieldworkBridge\([\s\S]*hasLiveExploreChat/,
    );
  });
});
