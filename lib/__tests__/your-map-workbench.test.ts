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
    const viewSource = readSource("components/orvek-workbench/views/V0MapView.tsx");
    const adapterSource = readSource("lib/orvek-adapters/map.ts");
    const mindContextSource = readSource("components/your-map/YourMapMindContextPanel.tsx");

    expect(pageSource).toContain("OrvekMapPage");
    expect(workbenchSource).toContain("mapMapDataToV0Props");
    expect(workbenchSource).toContain("fetchInspectorUserMapDetail");
    expect(workbenchSource).toContain("fetchMindContextSnapshot");
    expect(adapterSource).toContain("groupUserMapConclusionsByStatus");
    expect(viewSource).toContain('data-testid="orvek-map-page"');
    expect(viewSource).toContain("grid-cols-1 lg:grid-cols-[300px_1fr]");
    expect(mindContextSource).toContain('data-testid="your-map-mind-context-panel"');
    expect(mindContextSource).toContain("fetchMindContextSnapshot");
    expect(mindContextSource).toContain("MIND_CONTEXT_EMPTY_PRIMARY");
  });

  it("selects map rows into inspector evidence context without full navigation", () => {
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const mindContextSource = readSource("components/your-map/YourMapMindContextPanel.tsx");

    expect(workbenchSource).toContain('objectType: "usermap_conclusion"');
    expect(workbenchSource).toContain("useOrvekInspector");
    expect(workbenchSource).toContain('tab: "evidence"');
    expect(mindContextSource).toContain('objectType: "pattern_claim"');
    expect(mindContextSource).not.toContain("personality");
    expect(mindContextSource).not.toContain("mock");
  });

  it("loads conclusions from the public API and shows honest empty state copy", () => {
    const workbenchSource = readSource("components/orvek-workbench/OrvekMapPage.tsx");
    const adapterSource = readSource("lib/orvek-adapters/map.ts");
    const viewSource = readSource("components/orvek-workbench/views/V0MapView.tsx");
    const surfaceSource = readSource("lib/your-map-surface.ts");

    expect(workbenchSource).toContain("fetchYourMapConclusions");
    expect(adapterSource).toContain("YOUR_MAP_EMPTY_PRIMARY");
    expect(adapterSource).toContain("YOUR_MAP_EMPTY_SECONDARY");
    expect(adapterSource).toContain("groupUserMapConclusionsByStatus");
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
    const viewSource = readSource("components/orvek-workbench/views/V0MapView.tsx");
    const surfaceSource = readSource("lib/mind-context-surface.ts");

    expect(adapterSource).toContain("groupUserMapConclusionsByStatus");
    expect(viewSource).toContain("MindContextHeader");
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

  it("preserves /your-map/[id] permalink route for backwards compatibility", () => {
    const detailPageSource = readSource("app/(root)/(routes)/your-map/[id]/page.tsx");

    expect(detailPageSource).toContain("MapDetailInspectorSync");
    expect(detailPageSource).toContain("listYourMapPublicEvidenceContinuity");
    expect(detailPageSource).toContain('href="/your-map"');
    expect(detailPageSource).not.toContain("<form");
  });
});
