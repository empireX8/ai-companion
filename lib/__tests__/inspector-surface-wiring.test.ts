import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("inspector surface wiring", () => {
  it("wires Today movement selection to inspector model_update + movement tab", () => {
    const source = readSource("app/(root)/page.tsx");
    expect(source).toContain("selectObject");
    expect(source).toContain('objectType: "model_update"');
    expect(source).toContain('tab: "movement"');
    expect(source).toContain("See movement");
    expect(source).toContain("parseSelectableObjectFromHref");
  });

  it("wires Your Map workbench list selection to usermap_conclusion inspector context", () => {
    const pageSource = readSource("app/(root)/(routes)/your-map/page.tsx");
    const workbenchSource = readSource("components/your-map/YourMapWorkbench.tsx");

    expect(pageSource).toContain("YourMapWorkbench");
    expect(workbenchSource).toContain('objectType: "usermap_conclusion"');
    expect(workbenchSource).toContain('sourceSurface: "map"');
    expect(workbenchSource).toContain('data-testid="your-map-workbench"');
  });

  it("wires Timeline model changes and linked activity hrefs to inspector", () => {
    const source = readSource(
      "app/(root)/(routes)/timeline/_components/TimelineSurface.tsx"
    );
    expect(source).toContain('objectType: "model_update"');
    expect(source).toContain('tab: "movement"');
    expect(source).toContain("TIMELINE_SEMANTIC_FILTERS");
    expect(source).toContain("fetchTimelineSemanticEntries");
    expect(source).toContain('sourceSurface: "timeline"');
  });

  it("keeps inspector context lightweight and tab defaults explicit", () => {
    const source = readSource("components/inspector/InspectorContext.tsx");
    expect(source).toContain("buildInspectorSelection");
    expect(source).not.toContain("setSelection(input");
    expect(source).toContain(
      'input.tab ?? (input.objectType === "model_update" ? "movement" : "evidence")'
    );
  });

  it("routes movement tab through scoped detail with safe fallback", () => {
    const panelSource = readSource(
      "components/inspector/panels/ModelMovementInspectorPanel.tsx"
    );
    const routerSource = readSource("components/inspector/InspectorPanelRouter.tsx");

    expect(routerSource).toContain("ModelMovementInspectorPanel");
    expect(panelSource).toContain("resolveActiveModelUpdateId");
    expect(panelSource).toContain("TODAY_INTELLIGENCE_UPDATES_ENDPOINT");
    expect(panelSource).toContain("beforeSummary/afterSummary need");
    expect(panelSource).toContain("ExploreSessionMovementInspectorList");

    const exploreMovementSource = readSource("components/explore/ExploreModelMovementStrip.tsx");
    expect(exploreMovementSource).toContain("Published movement from this conversation");
  });

  it("clears cross-surface inspector selection on navigation", () => {
    const syncSource = readSource("components/inspector/InspectorNavigationSync.tsx");
    const contextSource = readSource("components/inspector/InspectorContext.tsx");

    expect(syncSource).toContain("shouldClearInspectorSelectionOnNavigation");
    expect(syncSource).toContain("useLayoutEffect");
    expect(contextSource).toContain("InspectorNavigationSync");
  });

  it("keeps explore draft review separate from published movement copy", () => {
    const reviewSource = readSource("lib/explore-conversation-review.ts");
    const movementSource = readSource("lib/explore-session-model-updates.ts");
    const reviewStripSource = readSource(
      "components/explore/ExploreConversationReviewStrip.tsx"
    );

    expect(reviewSource).toContain("Published model movement appears separately");
    expect(movementSource).toContain("published model movement");
    expect(reviewStripSource).toContain("Draft review items");
    expect(reviewStripSource).not.toContain("published model movement from this conversation");
  });

  it("does not expose internal candidate fields in inspector API routes", () => {
    const patternRoute = readSource("app/api/inspector/pattern-claims/[id]/route.ts");
    const contradictionRoute = readSource(
      "app/api/inspector/contradictions/[id]/route.ts"
    );
    const detailRoute = readSource("app/api/what-changed/[id]/route.ts");
    const detailRouteBody = detailRoute
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.includes("{/*"))
      .join("\n");

    for (const source of [patternRoute, contradictionRoute, detailRouteBody]) {
      expect(source).not.toContain("internalNotes");
      expect(source).not.toContain("sourceRunId");
      expect(source).not.toContain("beforeSummary");
      expect(source).not.toContain("afterSummary");
      expect(source).not.toContain('status: "candidate"');
    }

    expect(patternRoute).toContain("projectVisiblePatternClaim");
    expect(contradictionRoute).toContain('status: { in: PUBLIC_CONTRADICTION_STATUSES }');
  });
});
