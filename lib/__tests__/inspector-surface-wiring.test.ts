import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("inspector surface wiring", () => {
  it("wires Today movement selection to inspector model_update + movement tab", () => {
    const container = readSource("components/orvek-workbench/OrvekTodayPage.tsx");
    const view = readSource("components/orvek-workbench/views/V0TodayView.tsx");
    const source = `${container}\n${view}`;
    expect(source).toContain("useOrvekInspector");
    expect(source).toContain('objectType: "model_update"');
    expect(source).toContain('tab: "movement"');
    expect(source).toContain("See why it moved");
  });

  it("wires Your Map workbench list selection to usermap_conclusion inspector context", () => {
    const pageSource = readSource("app/(root)/(routes)/your-map/page.tsx");
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const viewSource = readSource("components/orvek-workbench/views/V0MapView.tsx");

    expect(pageSource).toContain("OrvekMapPage");
    expect(workbenchSource).toContain('objectType: "usermap_conclusion"');
    expect(viewSource).toContain('data-testid="orvek-map-page"');
  });

  it("wires Timeline model changes and linked activity hrefs to inspector", () => {
    const container = readSource("components/orvek-workbench/OrvekTimelinePage.tsx");
    const view = readSource("components/orvek-workbench/views/V0TimelineView.tsx");
    const adapter = readSource("lib/orvek-adapters/timeline.ts");
    const source = `${container}\n${view}\n${adapter}`;
    const inspectorSource = readSource("components/timeline/TimelineInspectorAction.tsx");
    expect(source).toContain("TimelineInspectorAction");
    expect(source).toContain('objectType: "model_update"');
    expect(source).toContain('tab: "movement"');
    expect(inspectorSource).toContain('objectType === "model_update"');
    expect(inspectorSource).toContain('sourceSurface: "timeline"');
    expect(source).toContain("TIMELINE_SEMANTIC_FILTERS");
    expect(source).toContain("fetchTimelineSemanticEntries");
    expect(source).toContain("parseSelectableObjectFromHref");
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
    expect(exploreMovementSource).toContain("ORVEK_COPY.mindModelMovement");
    expect(exploreMovementSource).toContain("from this conversation");
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

    expect(reviewSource).toContain("ORVEK_COPY.mindModelMovement");
    expect(reviewSource).toContain("ORVEK_COPY.reviewBeforeApplying");
    expect(movementSource).toContain("ORVEK_COPY.mindModelMovement");
    expect(reviewStripSource).toContain("EXPLORE_REVIEW_DRAFT_BADGE");
    expect(reviewStripSource).not.toContain("published Mind Model movement from this conversation");
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
