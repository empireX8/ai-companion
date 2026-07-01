import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("your-map workbench", () => {
  it("renders master-detail layout on /your-map", () => {
    const pageSource = readSource("app/(root)/(routes)/your-map/page.tsx");
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const adapterSource = readSource("lib/orvek-adapters/map.ts");
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");
    const mindContextSource = readSource("components/your-map/YourMapMindContextPanel.tsx");

    expect(pageSource).toContain("OrvekMapPage");
    expect(workbenchSource).toContain("buildMapProductionDataApi");
    expect(workbenchSource).toContain("fetchInspectorUserMapDetail");
    expect(workbenchSource).toContain("fetchMindContextSnapshot");
    expect(adapterSource).toContain("buildOntologyRailGroups");
    expect(adapterSource).toContain("V0_MAP_ONTOLOGY_RAIL_LABELS");
    expect(viewSource).toContain("mapHasContent");
    expect(viewSource).toContain("mapIsLoading");
    expect(mapApiSource).toContain("mapHasContent");
    expect(mapApiSource).toContain("resolveMapSelectedId");
    expect(workbenchSource).toContain("isMindContextLoading");
    expect(readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx")).toContain(
      "OrvekShellLayout"
    );
    expect(readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx")).toContain(
      "<ProductionInspectorAside />"
    );
    expect(readSource("components/orvek-workbench/ProductionMapHeader.tsx")).toContain(
      "flex flex-wrap items-end justify-between gap-3"
    );
    expect(readSource("components/orvek-workbench/ProductionMapHeader.tsx")).toContain(
      "flex items-baseline justify-end gap-6 whitespace-nowrap"
    );
    expect(readSource("components/orvek-workbench/ProductionMapHeader.tsx")).toContain(
      "font-medium tabular-nums text-foreground"
    );
    expect(viewSource).toContain("ProductionMapHeader");
    expect(viewSource).toContain("flex flex-wrap items-end justify-between gap-3");
    expect(viewSource).toContain("grid-cols-1 lg:grid-cols-[300px_1fr]");
    expect(mindContextSource).toContain('data-testid="your-map-mind-context-panel"');
    expect(mindContextSource).toContain("fetchMindContextSnapshot");
    expect(mindContextSource).toContain("MIND_CONTEXT_EMPTY_PRIMARY");
  });

  it("keeps map page header layout aligned with the v0 reference zip", () => {
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const referenceSource = readSource(
      ".reference/v0-orvek-workbench/components/orvek/pages/map.tsx"
    );

    expect(viewSource).toContain("flex flex-wrap items-end justify-between gap-3");
    expect(referenceSource).toContain("flex flex-wrap items-end justify-between gap-3");
    expect(viewSource).toContain("ProductionMapHeader");
    expect(viewSource).not.toContain('isProduction ? "flex-nowrap"');
    expect(viewSource).not.toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(viewSource).not.toContain("row-span-2");
  });

  it("surfaces model goals as first-class selectable objects in the production workspace", () => {
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");
    const bridgeSource = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    const inspectorSource = readSource("components/inspector/panels/SelectedObjectEvidencePanel.tsx");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const adapterSource = readSource("lib/orvek-adapters/map.ts");

    expect(adapterSource).toContain('isGoal ? "model_goal" : "conclusion"');
    expect(adapterSource).toContain("Model Goals");
    expect(viewSource).toContain("Model Goals");
    expect(viewSource).toContain("goal-");
    expect(mapApiSource).toContain('type = "model-goal"');
    expect(mapApiSource).toContain('inspectorObjectType = "model_goal"');
    expect(mapApiSource).toContain("Capture correction in Capture Life Data");
    expect(bridgeSource).toContain('return "model_goal"');
    expect(inspectorSource).toContain('case "model_goal"');
    expect(inspectorSource).toContain("Correct this model goal.");
    expect(inspectorSource).toContain("Capture Life Data");
  });

  it("selects map rows into inspector evidence context without full navigation", () => {
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");
    const bridgeSource = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    const mindContextSource = readSource("components/your-map/YourMapMindContextPanel.tsx");

    expect(mapApiSource).toContain('inspectorObjectType: "usermap_conclusion"');
    expect(bridgeSource).toContain('return "usermap_conclusion"');
    expect(workbenchSource).toContain("OrvekV0PageShell");
    expect(mindContextSource).toContain('objectType: "pattern_claim"');
    expect(mindContextSource).not.toContain("personality");
    expect(mindContextSource).not.toContain("mock");
  });

  it("shows mind context detail copy and capture correction handoff in the production workspace", () => {
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const bridgeSource = readSource("components/orvek-v0/production/ProductionInspectorBridge.tsx");
    const inspectorSource = readSource("components/inspector/panels/SelectedObjectEvidencePanel.tsx");
    const contextPageSource = readSource("app/(root)/(routes)/context/page.tsx");

    expect(mapApiSource).toContain('inspectorObjectType = "context_profile"');
    expect(viewSource).toContain("Mind Context");
    expect(viewSource).toContain("Linked path");
    expect(viewSource).toContain("Missing evidence");
    expect(bridgeSource).toContain('return "context_profile"');
    expect(inspectorSource).toContain('case "context_profile"');
    expect(inspectorSource).toContain("Capture correction");
    expect(inspectorSource).toContain("mindlabs:today-capture-handoff");
    expect(inspectorSource).toContain("User correction is first-class evidence");
    expect(contextPageSource).toContain("Mind Context");
    expect(contextPageSource).toContain("Capture correction");
    expect(contextPageSource).toContain("/journal-chat");
  });

  it("loads conclusions from the public API and shows honest empty state copy", () => {
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const adapterSource = readSource("lib/orvek-adapters/map.ts");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const surfaceSource = readSource("lib/your-map-surface.ts");

    expect(workbenchSource).toContain("fetchYourMapConclusions");
    expect(adapterSource).toContain("YOUR_MAP_EMPTY_PRIMARY");
    expect(adapterSource).toContain("YOUR_MAP_EMPTY_SECONDARY");
    expect(adapterSource).toContain("buildOntologyRailGroups");
    expect(adapterSource).toContain("V0_MAP_ONTOLOGY_RAIL_LABELS");
    expect(surfaceSource).toContain("journal, explore, import, decisions");
    expect(workbenchSource).not.toContain("mock");
    expect(viewSource).not.toContain("mock");
  });

  it("renders movement and open-question preview bands with inspector wiring for published movement", () => {
    const previewSource = readSource("components/your-map/YourMapPreviewBands.tsx");
    const surfaceSource = readSource("lib/your-map-preview-surface.ts");

    expect(previewSource).toContain("MAP_MOVEMENT_EMPTY_COPY");
    expect(previewSource).toContain("MAP_OPEN_QUESTIONS_EMPTY_COPY");
    expect(previewSource).toContain('sourceSurface: "map"');
    expect(surfaceSource).toContain("TODAY_INTELLIGENCE_UPDATES_ENDPOINT");
    expect(surfaceSource).toContain("ACTIVE_QUESTIONS_ENDPOINT");
  });

  it("keeps conclusion groups separate from Mind Context foundation", () => {
    const adapterSource = readSource("lib/orvek-adapters/map.ts");
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const surfaceSource = readSource("lib/mind-context-surface.ts");

    expect(adapterSource).toContain("buildOntologyRailGroups");
    expect(adapterSource).toContain("V0_MAP_ONTOLOGY_RAIL_LABELS");
    expect(viewSource).toContain('data-testid="orvek-v0-map-page"');
    expect(surfaceSource).toContain("MIND_CONTEXT_SECTION_LABEL");
    expect(surfaceSource).not.toContain("ProfileArtifact");
    expect(surfaceSource).not.toContain("/api/internal/");
  });

  it("keeps centre detail shallow and defers full evidence depth to inspector", () => {
    const detailSource = readSource("components/your-map/YourMapDetailPane.tsx");

    expect(detailSource).toContain("summarizeCentreEvidence");
    expect(detailSource).toContain("YOUR_MAP_INSPECTOR_EVIDENCE_HINT");
    expect(detailSource).toContain("fetchInspectorUserMapDetail");
    expect(detailSource).toContain("fetchInspectorEvidenceLinks");
    expect(detailSource).not.toContain("internalNotes");
    expect(detailSource).not.toContain("candidate");
  });

  it("preserves /your-map/[id] permalink route by redirecting into the v0 workbench", () => {
    const detailPageSource = readSource("app/(root)/(routes)/your-map/[id]/page.tsx");

    expect(detailPageSource).toContain('redirect(`/your-map?selected=');
    expect(detailPageSource).not.toContain("ml-material");
    expect(detailPageSource).not.toContain("ml-raised");
    expect(detailPageSource).not.toContain("<form");
  });

  it("renders production conclusion detail skeleton sections with honest empty copy", () => {
    const viewSource = readSource("components/orvek-v0/pages/map.tsx");
    const mapApiSource = readSource("lib/orvek-v0/production/map-api.ts");

    expect(viewSource).toContain("V0_MAP_ONTOLOGY_RAIL_ORDER");
    expect(viewSource).toContain("showProductionDetailSkeleton");
    expect(viewSource).not.toContain("if (isProduction && !mapHasContent)");
    expect(viewSource).toContain("mapWhyEmpty");
    expect(viewSource).toContain("mapSupportingEmpty");
    expect(viewSource).toContain("mapConflictingEmpty");
    expect(viewSource).toContain("mapRelatedEmpty");
    expect(mapApiSource).toContain("mapCurrentUnderstandingEmpty");
    expect(mapApiSource).toContain("YOUR_MAP_EVIDENCE_BREADTH_INTRO");
  });
});
