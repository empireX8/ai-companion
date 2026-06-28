import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildInspectorSelection,
  resolveInspectorSourceSurfaceFromPathname,
  shouldClearInspectorSelectionOnNavigation,
} from "../inspector-selection";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("inspector surface wiring", () => {
  it("wires Today movement selection to inspector model_update + movement tab", () => {
    const container = readSource("components/orvek-workbench/OrvekTodayPage.tsx");
    const view = readSource("components/orvek-v0/pages/today.tsx");
    const bridge = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    const source = `${container}\n${view}\n${bridge}`;
    expect(source).toContain("ProductionInspectorBridge");
    expect(bridge).toContain('return "model_update"');
    expect(bridge).toContain("resolveInspectorSourceSurfaceFromPathname");
    expect(bridge).toContain("sourceSurface:");
    expect(source).toContain("openInspectorSelection");
    expect(source).toContain('"movement"');
    expect(source).toContain("See why it moved");
  });

  it("tags Today bridge selections with the today surface so navigation sync does not clear them", () => {
    const bridge = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    expect(bridge).toContain("sourceSurface: resolveInspectorSourceSurfaceFromPathname(pathname)");

    const bridged = buildInspectorSelection({
      objectType: "model_update",
      objectId: "mu-1",
      sourceSurface: resolveInspectorSourceSurfaceFromPathname("/"),
    });

    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/",
        selection: bridged,
      })
    ).toBe(false);

    const stale = buildInspectorSelection({
      objectType: "model_update",
      objectId: "mu-1",
    });

    expect(stale?.sourceSurface).toBe("unknown");
    expect(
      shouldClearInspectorSelectionOnNavigation({
        pathname: "/",
        selection: stale,
      })
    ).toBe(true);
  });

  it("wires Your Map workbench list selection to usermap_conclusion inspector context", () => {
    const pageSource = readSource("app/(root)/(routes)/your-map/page.tsx");
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");

    expect(pageSource).toContain("OrvekMapPage");
    expect(mapApiSource).toContain('inspectorObjectType: "usermap_conclusion"');
    expect(workbenchSource).toContain("OrvekV0PageShell");
    expect(viewSource).toContain('data-testid="orvek-v0-map-page"');
  });

  it("wires Timeline model changes and linked activity hrefs to inspector", () => {
    const container = readSource("components/orvek-workbench/OrvekTimelinePage.tsx");
    const view = readSource("components/orvek-v0/pages/timeline.tsx");
    const adapter = readSource("lib/orvek-adapters/timeline.ts");
    const timelineApi = readSource("lib/orvek-v0/production/timeline-api.ts");
    const bridge = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    const source = `${container}\n${view}\n${adapter}\n${timelineApi}\n${bridge}`;
    const inspectorSource = readSource("components/timeline/TimelineInspectorAction.tsx");
    expect(timelineApi).toContain("inspectorObjectType");
    expect(bridge).toContain('return "model_update"');
    expect(adapter).toContain('objectType: "model_update"');
    expect(inspectorSource).toContain('objectType === "model_update"');
    expect(inspectorSource).toContain('sourceSurface: "timeline"');
    expect(source).toContain("TIMELINE_SEMANTIC_FILTERS");
    expect(source).toContain("fetchTimelineSemanticEntries");
    expect(adapter).toContain("parseSelectableObjectFromHref");
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
    expect(panelSource).toContain("Evidence Packet Summary");
    expect(panelSource).toContain("ThinPacketNotice");
    expect(panelSource).toContain("no receipt packet is linked yet");
    expect(panelSource).toContain("What Would Change This Conclusion");
    expect(panelSource).toContain("filterResolvableEvidenceRefs");
    expect(panelSource).toContain("InspectorEvidenceSelectionControl");
    expect(panelSource).not.toContain("<Link href={ref.href}");
    expect(panelSource).toContain("ExploreSessionMovementInspectorList");

    const exploreMovementSource = readSource("components/explore/ExploreModelMovementStrip.tsx");
    expect(exploreMovementSource).toContain("ORVEK_COPY.mindModelMovement");
    expect(exploreMovementSource).toContain("from this conversation");
  });

  it("keeps the shared inspector read-only while rendering richer object sections", () => {
    const panelSource = readSource(
      "components/inspector/panels/SelectedObjectEvidencePanel.tsx"
    );

    expect(panelSource).toContain("Supporting & conflicting");
    expect(panelSource).toContain("Relevant background / context");
    expect(panelSource).toContain("What would change this");
    expect(panelSource).toContain("Next step");
    expect(panelSource).toContain("getActionGateReason");
    expect(panelSource).toContain("useOptionalOrvekData");
    expect(panelSource).not.toContain("useOrvekData");
    expect(panelSource).toContain("INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT");
    expect(panelSource).toContain("Related map conclusion");
    expect(panelSource).toContain("Movement summary");
    expect(panelSource).toContain("What would change this");
    expect(panelSource).toContain("projectInspectorEvidenceCard");
    expect(panelSource).toContain("dedupeInspectorEvidenceLinks");
    expect(panelSource).toContain("InspectorEvidenceSelectionControl");
    expect(panelSource).not.toContain("<Link href={card.href}");
    expect(panelSource).not.toMatch(/<Link[^>]+href=\{[^}]*\/patterns/);
    expect(panelSource).not.toContain("suggestClaimAction");
    expect(panelSource).not.toContain("updateClaimAction");
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
