import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockOrvekDataApi } from "../../lib/orvek-v0/mock-api";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
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

describe("free explore chat handler provider mount (E1)", () => {
  it("mounts OrvekPageHandlersProvider in Workbench with optional handlers prop", () => {
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");

    expect(workbenchSource).toContain("OrvekPageHandlersProvider");
    expect(workbenchSource).toContain("handlers?: OrvekPageHandlers");
    expect(workbenchSource).toContain("handlers ?? {}");
    expect(shellSource).toContain("handlers={{}}");
    expect(shellSource).not.toContain("onSend");
    expect(shellSource).not.toContain("sendMessage");
  });

  it("keeps hybrid hook free of handler wiring and sendMessage in E1", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).not.toContain("OrvekPageHandlersProvider");
    expect(hookSource).not.toContain("sendMessage");
    expect(hookSource).toContain("sendHandlerAvailable: false");
  });

  it("keeps FreeExplore dual gate unsatisfied without onSend handler", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("freeExploreSendHandlerAvailable === true");
    expect(freeExploreBlock).toContain("Boolean(exploreHandlers?.onSend)");
    expect(freeExploreBlock).toContain("disabled={!canSend}");
  });

  it("keeps freeExploreSendHandlerAvailable false on hybrid merge", () => {
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

  it("keeps reference route mock-only without handler or hybrid wiring", () => {
    const referencePageSource = readSource("app/dev/orvek-v0-reference/page.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(referencePageSource).toContain("<Workbench />");
    expect(referencePageSource).not.toContain("handlers=");
    expect(referencePageSource).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });

  it("keeps legacy /explore route and old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const exploreRouteSource = readSource("app/(root)/(routes)/explore/page.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("OrvekExplorePage");
    expect(exploreRouteSource).toContain("OrvekExplorePage");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(shellSource).not.toContain("RouteTopBar");
  });
});
