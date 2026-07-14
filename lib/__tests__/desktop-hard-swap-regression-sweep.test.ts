import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const QUARANTINED_LEGACY_ROUTES = [
  "app/(root)/(routes)/journal-chat/page.tsx",
  "app/(root)/(routes)/your-map/page.tsx",
  "app/(root)/(routes)/timeline/page.tsx",
  "app/(root)/(routes)/actions/page.tsx",
  "app/(root)/(routes)/watch-for/page.tsx",
  "app/(root)/(routes)/active-questions/page.tsx",
  "app/(root)/(routes)/explore/page.tsx",
] as const;

const ACTIVE_V0_PAGES = [
  "components/orvek-v0/pages/today.tsx",
  "components/orvek-v0/pages/map.tsx",
  "components/orvek-v0/pages/timeline.tsx",
  "components/orvek-v0/pages/decisions.tsx",
  "components/orvek-v0/pages/explore.tsx",
] as const;

const OLD_SHELL_MARKERS = [
  "RouteTopBar",
  "RouteSidebar",
  "ProductionInspectorAside",
  "OrvekTopBar",
  "OrvekSidebar",
  "OrvekEvidencePanel",
] as const;

describe("desktop hard-swap regression sweep", () => {
  it("1 — root hard-swap shell mounts reference workbench and ignores route children", () => {
    const appLayout = readSource("app/(root)/layout.tsx");
    const appShell = readSource("components/layout/AppShell.tsx");
    const shell = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbench = readSource("components/orvek-v0/workbench.tsx");

    expect(appLayout).toContain("AppShell");
    expect(appShell).toContain("OrvekWorkbenchShell");
    expect(shell).toContain("void children");
    expect(shell).toContain("DurableActionsRefreshProvider");
    expect(shell).toContain("<Workbench dataApi={dataApi} handlers={handlers} />");
    expect(shell).toContain("useOrvekHybridWorkbenchDataApi");
    expect(workbench).toContain("OrvekShellLayout");
    expect(workbench).toContain("<PageContent />");

    for (const marker of OLD_SHELL_MARKERS) {
      expect(shell).not.toContain(marker);
    }
  });

  it("2 — reference route stays mock-only and send-disabled", () => {
    const referenceRoute = readSource("app/dev/orvek-v0-reference/page.tsx");
    const workbench = readSource("components/orvek-v0/workbench.tsx");
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );

    expect(referenceRoute).toContain('data-testid="orvek-v0-reference-route"');
    expect(referenceRoute).toContain("<Workbench />");
    expect(referenceRoute).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(referenceRoute).not.toContain("handlers=");
    expect(referenceRoute).not.toContain("buildHybridWorkbenchDataApi");
    expect(workbench).toContain("createMockOrvekDataApi");
    expect(hybridHook).not.toContain("orvek-v0-reference");
  });

  it("3 — Today remains store-driven re-entry surface inside root shell", () => {
    const todayPage = readSource("components/orvek-v0/pages/today.tsx");
    const workbench = readSource("components/orvek-v0/workbench.tsx");

    expect(workbench).toContain('case "today"');
    expect(todayPage).toContain("runTodayWorkbenchCommands");
    expect(todayPage).toContain("setPage");
    expect(todayPage).not.toContain("router.push");
    expect(todayPage).not.toContain("TimelineSurface");
    expect(todayPage).not.toContain("Calendar");
  });

  it("4 — Map bridge stays readiness-gated in hybrid workbench", () => {
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const mapPresentation = readSource("lib/orvek-v0/production/map-presentation.ts");
    const mapPage = readSource("components/orvek-v0/pages/map.tsx");
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );

    expect(hybridApi).toContain("shouldMergeMapProductionApi");
    expect(mapPresentation).toContain("shouldMergeMapProductionApi");
    expect(hybridHook).toContain("buildMapProductionDataApi");
    expect(mapPage).toContain("mapHasContent");
    expect(mapPage).not.toContain("V0MapView");
    expect(mapPage).not.toContain("router.push");
  });

  it("5 — Timeline remains semantic evolution surface, not Calendar", () => {
    const timelinePage = readSource("components/orvek-v0/pages/timeline.tsx");
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");

    expect(timelinePage).toContain("TIMELINE_SEMANTIC_FILTERS");
    expect(timelinePage).not.toContain("Calendar");
    expect(timelinePage).not.toContain("router.push");
    expect(hybridApi).toContain("shouldMergeTimelineProductionApi");
  });

  it("6 — Decisions bridge stays readiness-gated", () => {
    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    const decisionsPage = readSource("components/orvek-v0/pages/decisions.tsx");

    expect(hybridApi).toContain("shouldMergeDecisionsProductionApi");
    expect(decisionsPage).not.toContain("DecisionsPriorityBand");
    expect(decisionsPage).not.toContain("router.push");
  });

  it("7 — Explore send gates and post-send honesty remain wired", () => {
    const explorePage = readSource("components/orvek-v0/pages/explore.tsx");
    const hybridHook = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    const evidencePanel = readSource("components/orvek-v0/evidence-panel.tsx");

    expect(explorePage).toContain("freeExploreSendHandlerAvailable");
    expect(explorePage).toContain("useReferenceGrounding = !hasLiveExploreChat");
    expect(explorePage).toContain("Thinking…");
    expect(explorePage).toContain("border-b border-border/40");
    expect(hybridHook).toContain("exploreChatSendReady");
    expect(hybridHook).toContain("onSend");
    expect(evidencePanel).toContain("showReferenceConversationMovement = exploreActive && !hasLiveExploreChat");
    expect(evidencePanel).toContain("Recent model movement");
  });

  it("8 — Inspector avoids false current-conversation movement in live Explore", () => {
    const evidencePanel = readSource("components/orvek-v0/evidence-panel.tsx");

    expect(evidencePanel).toContain("showLiveConversationMovementEmpty");
    expect(evidencePanel).toContain("EXPLORE_CONVERSATION_MOVEMENT_EMPTY_COPY");
    expect(evidencePanel).toContain("From this conversation");
    expect(evidencePanel).toContain("Recent model movement");
  });

  it("9 — legacy route-first pages remain quarantined; active v0 pages use store navigation", () => {
    for (const pagePath of QUARANTINED_LEGACY_ROUTES) {
      expect(() => readSource(pagePath)).not.toThrow();
    }

    const exploreLegacy = readSource(QUARANTINED_LEGACY_ROUTES[6]);
    expect(exploreLegacy).toContain("OrvekExplorePage");

    for (const pagePath of ACTIVE_V0_PAGES) {
      const source = readSource(pagePath);
      expect(source).not.toContain("router.push");
    }

    const sidebar = readSource("components/orvek-v0/sidebar.tsx");
    expect(sidebar).toContain("setPage");
    expect(sidebar).not.toContain("router.push");
  });

  it("10 — production readiness honesty guardrails remain in place", () => {
    const repoRoot = readSource("AGENTS.md");
    const mockApi = readSource("lib/orvek-v0/mock-api.ts");

    expect(repoRoot).toContain("Do not invent fake intelligence");
    expect(mockApi).toContain("createMockOrvekDataApi");

    const hybridApi = readSource("lib/orvek-v0/production/hybrid-workbench-api.ts");
    expect(hybridApi).toContain("exploreGrounding: freeExploreChatApi.exploreGrounding");
    expect(hybridApi).toContain("exploreMovement: freeExploreChatApi.exploreMovement");

    const grepTargets = [
      "components/orvek-workbench/OrvekWorkbenchShell.tsx",
      "lib/orvek-v0/production/hybrid-workbench-api.ts",
      "components/orvek-v0/workbench.tsx",
    ];
    for (const file of grepTargets) {
      expect(readSource(file)).not.toMatch(/displayContract:\s*["']production["']/);
    }
  });
});
