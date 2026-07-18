import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { V0_EXPLORE_LIVE_DETECTION_COPY } from "../../lib/orvek-adapters/explore";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import {
  hasFreeExploreChatFakeMovementOrReviewLeak,
  isTemporaryFreeExploreChatMessageId,
  normalizeFreeExploreChatMessage,
} from "../../lib/orvek-v0/production/free-explore-chat-presentation";
import { buildHybridWorkbenchDataApi } from "../../lib/orvek-v0/production/hybrid-workbench-api";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function freeExploreBlock(source: string): string {
  return (
    source.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ?? ""
  );
}

function readyLiveChatInput(
  overrides: Partial<Parameters<typeof buildFreeExploreChatProductionDataApi>[0]> = {},
) {
  return {
    sessionId: "sess-ready-1",
    messages: [
      {
        id: "msg-user-1",
        role: "user" as const,
        content: "Post-send side-effect audit probe",
      },
      {
        id: "msg-assistant-1",
        role: "assistant" as const,
        content: "A concise assistant reply.",
      },
    ],
    composerDraft: "",
    isBooting: false,
    isSending: false,
    errorMessage: null,
    sendHandlerAvailable: true,
    ...overrides,
  };
}

describe("free explore post-send side-effect audit", () => {
  it("does not show reference grounding chips during live chat send path", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toMatch(/allowReferenceSample\s*=\s*referenceSurface\s*===\s*true/);
    expect(block).toMatch(
      /useReferenceGrounding\s*=\s*allowReferenceSample\s*&&\s*!hasLiveExploreChat/,
    );
    expect(block).toContain("exploreGrounding");
  });

  it("strips fake movement, grounding, and live-detection leaks from production chat overlay", () => {
    const liveApi = buildFreeExploreChatProductionDataApi(readyLiveChatInput());

    expect(liveApi.exploreGrounding).toEqual([]);
    expect(liveApi.exploreMovement).toEqual([]);
    expect(liveApi.exploreLiveDetectionCopy).toBeUndefined();
    expect(hasFreeExploreChatFakeMovementOrReviewLeak(liveApi)).toBe(false);

    const hybridApi = buildHybridWorkbenchDataApi(
      createMockOrvekDataApi(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      liveApi,
    );

    expect(hybridApi.exploreGrounding).toEqual([]);
    expect(hybridApi.exploreMovement).toEqual([]);
    expect(hybridApi.exploreLiveDetectionCopy).toBeUndefined();
  });

  it("uses honest live detection copy and hedged movement language when live chat is active", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(V0_EXPLORE_LIVE_DETECTION_COPY).toBe("No live model signal detected yet.");
    expect(block).toContain("V0_EXPLORE_LIVE_DETECTION_COPY");
    expect(block).toContain("Review possible model movement in the inspector.");
    expect(block).not.toContain("exploreMovement");
    expect(block).not.toContain("1 receipt extracted");
  });

  it("does not expose tmp IDs or raw stream artifacts in normalized assistant messages", () => {
    expect(
      normalizeFreeExploreChatMessage({
        id: "tmp-assistant-abc",
        role: "orvek",
        content: "Visible assistant reply",
      }),
    ).toBeNull();
    expect(isTemporaryFreeExploreChatMessageId("tmp-user-abc")).toBe(true);

    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("message.content.trim().length > 0");
    expect(block).not.toContain("chunk");
    expect(block).not.toContain("isStreamingAssistant");
  });

  it("keeps send ordering and duplicate-send guards intact", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const block = freeExploreBlock(explorePageSource);

    expect(block).toContain("setPendingUserMessage(outgoing)");
    expect(block).toContain("showThinkingRow");
    expect(block).toMatch(/\{showThinkingRow \? \([\s\S]*<ThinkingIndicator/);
    expect(block).toContain("composerDisabled = isBooting || isSending");
    expect(block).toContain("disabled={!canSend}");
  });

  it("keeps reference route mock-only and send-disabled", () => {
    const referencePageSource = readSource("app/dev/orvek-v0-reference/page.tsx");
    const frozenWorkbenchSource = readSource("components/orvek-v0-reference-frozen/workbench.tsx");

    expect(referencePageSource).toContain("<FrozenReferenceWorkbench />");
    expect(referencePageSource).not.toContain("handlers=");
    expect(referencePageSource).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(frozenWorkbenchSource).toContain("createFrozenReferenceDataApi");
  });

  it("keeps root hard-swapped workbench and quarantines legacy /explore UI", () => {
    const appShellSource = readSource("components/layout/AppShell.tsx");
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(appShellSource).toContain("OrvekWorkbenchShell");
    expect(shellSource).toContain("CanonicalLiveRuntimeEntry");
    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(shellSource).not.toContain("RouteTopBar");
  });

  it("does not wire explore send through map, timeline, or decisions adapters", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");
    const chatHookSource = readSource("components/orvek-workbench/useOrvekExploreChat.ts");

    expect(hookSource).toContain("sendMessage");
    expect(hookSource).not.toContain("onConversationUpdated");
    expect(chatHookSource).toContain('fetch("/api/message"');
    expect(chatHookSource).not.toContain("/api/map");
    expect(chatHookSource).not.toContain("timeline");
    expect(chatHookSource).not.toContain("decisions");
  });

  it("withholds reference inspector movement cards during live Free Explore chat", () => {
    const evidencePanelSource = readSource("components/orvek-v0-authority/evidence-panel.tsx");

    expect(evidencePanelSource).toContain("hasLiveExploreChatFromProvider");
    expect(evidencePanelSource).toContain("showReferenceConversationMovement");
    expect(evidencePanelSource).toContain("showLiveConversationMovementEmpty");
    expect(evidencePanelSource).toContain("EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY");
    expect(evidencePanelSource).toMatch(
      /showReferenceConversationMovement\s*&&\s*\([\s\S]*referenceConversationMovement\.map/,
    );
    expect(evidencePanelSource).not.toMatch(
      /exploreActive\s*&&\s*\([\s\S]*referenceConversationMovement\.map/,
    );
  });
});
